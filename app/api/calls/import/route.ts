import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserWithRole, isAdmin } from "@/lib/auth";
import { DEFAULT_ORG_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calls/import
 *
 * Manually import a call with transcript.
 * Admin only. Queues for AI scoring by default when transcript exists.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    title,
    rep_id,
    occurred_at,
    duration_seconds,
    transcript,
    recording_url,
    queue_for_scoring,
  } = body as {
    title?: string;
    rep_id?: string;
    occurred_at?: string | null;
    duration_seconds?: number | null;
    transcript?: string;
    recording_url?: string | null;
    queue_for_scoring?: boolean;
  };

  // Validation
  if (!title?.trim()) {
    return NextResponse.json({ error: "Call title is required" }, { status: 400 });
  }
  if (!rep_id) {
    return NextResponse.json({ error: "Rep is required" }, { status: 400 });
  }
  if (!transcript?.trim()) {
    return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify rep exists
  const { data: rep, error: repError } = await supabase
    .from("reps")
    .select("id, name, sales_role")
    .eq("id", rep_id)
    .single();

  if (repError || !rep) {
    return NextResponse.json({ error: "Rep not found" }, { status: 400 });
  }

  const shouldQueueForScoring = queue_for_scoring !== false && Boolean(transcript.trim());

  // Create call record
  // NOTE: metadata column may not exist on all DB instances; store import
  // context in fields the table definitely has.
  const callPayload: Record<string, unknown> = {
    org_id: DEFAULT_ORG_ID,
    rep_id: rep.id,
    title: title.trim(),
    call_date: occurred_at ? new Date(occurred_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    duration_seconds: duration_seconds || null,
    transcript: transcript.trim(),
    transcript_status: "ready",
    transcript_source: "manual",
    // Set to pending only after a scoring_request is confirmed below.
    score_status: null,
    source_url: recording_url || null,
    rep_name: rep.name,
  };

  const { data: call, error: callError } = await supabase
    .from("calls")
    .insert(callPayload)
    .select("id")
    .single();

  if (callError) {
    console.error("[ImportCall] Error creating call:", callError);
    return NextResponse.json(
      { error: "Failed to create call: " + callError.message },
      { status: 500 }
    );
  }

  let scoringQueued = false;
  let scoringRequestId: string | null = null;

  // Queue for scoring by default when a transcript exists, unless the admin
  // explicitly chooses the Save Without Scoring path.
  if (shouldQueueForScoring) {
    const { data: existingRequest, error: existingRequestError } = await supabase
      .from("scoring_requests")
      .select("id, status")
      .eq("call_id", call.id)
      .limit(1)
      .maybeSingle();

    if (existingRequestError) {
      console.error("[ImportCall] Error checking scoring request:", existingRequestError);
      return NextResponse.json({
        call_id: call.id,
        scoring_queued: false,
        scoring_error: existingRequestError.message,
      });
    }

    if (existingRequest?.id) {
      scoringQueued = true;
      scoringRequestId = existingRequest.id;
    } else {
      const { data: scoringRequest, error: scoringError } = await supabase
        .from("scoring_requests")
        .insert({
          call_id: call.id,
          status: "pending",
          call_title: title.trim(),
          rep_name: rep.name,
          call_date: callPayload.call_date,
          duration_seconds: duration_seconds || null,
          transcript: transcript.trim(),
          requested_by: user.userId,
        })
        .select("id")
        .single();

      if (scoringError) {
        console.error("[ImportCall] Error creating scoring request:", scoringError);
        // Call was created successfully, just scoring queue failed
        return NextResponse.json({
          call_id: call.id,
          scoring_queued: false,
          scoring_error: scoringError.message,
        });
      }

      scoringQueued = true;
      scoringRequestId = scoringRequest?.id || null;
    }

    const { error: callStatusError } = await supabase
      .from("calls")
      .update({ score_status: "pending" })
      .eq("id", call.id);

    if (callStatusError) {
      console.error("[ImportCall] Error updating call score status:", callStatusError);
    }
  }

  return NextResponse.json({
    call_id: call.id,
    scoring_queued: scoringQueued,
    scoring_request_id: scoringRequestId,
  });
}
