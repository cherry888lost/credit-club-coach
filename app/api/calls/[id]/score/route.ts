import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { MIN_TRANSCRIPT_LENGTH } from "@/lib/scoring/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calls/[id]/score
 *
 * Queue a scoring request for async processing by Cherry.
 * Inserts a row into scoring_requests and returns 202 immediately.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: callId } = await params;

  try {
    const supabase = await createServiceClient();

    // 1. Fetch the call with transcript + metadata needed for scoring
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id, transcript, title, org_id, rep_id, occurred_at, duration_seconds")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      console.error("[SCORE] Call not found:", callError);
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // 2. Validate transcript exists
    if (!call.transcript) {
      return NextResponse.json(
        { error: "No transcript available for scoring" },
        { status: 400 }
      );
    }

    // 3. Validate transcript length
    if (call.transcript.length < MIN_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        {
          error: "Transcript too short for scoring",
          details: `Transcript is ${call.transcript.length} chars, minimum is ${MIN_TRANSCRIPT_LENGTH}`,
        },
        { status: 400 }
      );
    }

    // 4. Check if score already exists
    const { data: existingScore } = await supabase
      .from("call_scores")
      .select("id")
      .eq("call_id", callId)
      .single();

    if (existingScore) {
      return NextResponse.json(
        {
          error: "Score already exists",
          message: "Use POST /api/calls/[id]/score/regenerate to rescore",
          scoreId: existingScore.id,
        },
        { status: 409 }
      );
    }

    // 5. Check if there's already a pending/processing request
    const { data: existingRequest } = await supabase
      .from("scoring_requests")
      .select("id, status")
      .eq("call_id", callId)
      .in("status", ["pending", "processing"])
      .single();

    if (existingRequest) {
      return NextResponse.json(
        {
          status: "already_queued",
          message: "Scoring request already in progress",
          requestId: existingRequest.id,
          requestStatus: existingRequest.status,
        },
        { status: 202 }
      );
    }

    // 6. Resolve rep name if rep_id exists
    let repName: string | null = null;
    if (call.rep_id) {
      const { data: rep } = await supabase
        .from("reps")
        .select("name")
        .eq("id", call.rep_id)
        .single();
      repName = rep?.name ?? null;
    }

    // 7. Insert scoring request for Cherry to pick up
    const { data: scoringRequest, error: insertError } = await supabase
      .from("scoring_requests")
      .insert({
        call_id: callId,
        status: "pending",
        transcript: call.transcript,
        call_title: call.title ?? null,
        rep_name: repName,
        call_date: call.occurred_at ?? null,
        duration_seconds: call.duration_seconds ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[SCORE] Failed to queue scoring request:", insertError);
      return NextResponse.json(
        { error: "Failed to queue scoring request", details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`[SCORE] Queued scoring request ${scoringRequest.id} for call ${callId}`);

    return NextResponse.json(
      {
        status: "queued",
        message: "Scoring request queued for processing",
        requestId: scoringRequest.id,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("[SCORE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
