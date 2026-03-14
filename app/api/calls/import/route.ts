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
 * Admin only. Optionally queues for AI scoring.
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
    outcome_hint,
    close_type_hint,
    recording_url,
    notes,
    queue_for_scoring,
  } = body as {
    title?: string;
    rep_id?: string;
    occurred_at?: string | null;
    duration_seconds?: number | null;
    transcript?: string;
    outcome_hint?: string | null;
    close_type_hint?: string | null;
    recording_url?: string | null;
    notes?: string | null;
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

  // Create call record
  const callPayload = {
    org_id: DEFAULT_ORG_ID,
    rep_id: rep.id,
    title: title.trim(),
    occurred_at: occurred_at || new Date().toISOString(),
    duration_seconds: duration_seconds || null,
    transcript: transcript.trim(),
    recording_url: recording_url || null,
    source: "manual" as const,
    metadata: {
      imported_by: user.userId,
      import_notes: notes || null,
      outcome_hint: outcome_hint || null,
      close_type_hint: close_type_hint || null,
    },
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

  // Optionally queue for scoring
  if (queue_for_scoring) {
    const { error: scoringError } = await supabase
      .from("scoring_requests")
      .insert({
        org_id: DEFAULT_ORG_ID,
        call_id: call.id,
        status: "pending",
        rubric_type: rep.sales_role === "sdr" ? "sdr" : "closer",
        requested_by: user.userId,
        metadata: {
          outcome_hint: outcome_hint || null,
          close_type_hint: close_type_hint || null,
        },
      });

    if (scoringError) {
      console.error("[ImportCall] Error creating scoring request:", scoringError);
      // Call was created successfully, just scoring queue failed
      return NextResponse.json({
        call_id: call.id,
        scoring_queued: false,
        scoring_error: scoringError.message,
      });
    }
  }

  return NextResponse.json({
    call_id: call.id,
    scoring_queued: !!queue_for_scoring,
  });
}
