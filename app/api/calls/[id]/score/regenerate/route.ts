import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { MIN_TRANSCRIPT_LENGTH } from "@/lib/scoring/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calls/[id]/score/regenerate
 *
 * Delete existing score and queue a new scoring request for Cherry.
 * Admin only.
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

    // Check if user is admin
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("clerk_id", userId)
      .single();

    if (user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

    // Fetch call with all metadata needed for scoring
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id, transcript, title, org_id, rep_id, occurred_at, duration_seconds")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (!call.transcript || call.transcript.length < MIN_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        { error: "Transcript missing or too short for scoring" },
        { status: 400 }
      );
    }

    // Delete existing score
    const { error: deleteError } = await supabase
      .from("call_scores")
      .delete()
      .eq("call_id", callId);

    if (deleteError) {
      console.error("[RESCORE] Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete existing score" },
        { status: 500 }
      );
    }

    // Cancel any existing pending/processing requests for this call
    await supabase
      .from("scoring_requests")
      .update({ status: "failed", error_message: "Superseded by regenerate request", updated_at: new Date().toISOString() })
      .eq("call_id", callId)
      .in("status", ["pending", "processing"]);

    // Resolve rep name
    let repName: string | null = null;
    if (call.rep_id) {
      const { data: rep } = await supabase
        .from("reps")
        .select("name")
        .eq("id", call.rep_id)
        .single();
      repName = rep?.name ?? null;
    }

    // Insert new scoring request
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
      console.error("[RESCORE] Failed to queue scoring request:", insertError);
      return NextResponse.json(
        { error: "Failed to queue scoring request", details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`[RESCORE] Deleted old score, queued request ${scoringRequest.id} for call ${callId}`);

    return NextResponse.json(
      {
        success: true,
        status: "queued",
        message: "Score deleted and regeneration queued",
        previous_score_deleted: true,
        requestId: scoringRequest.id,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("[RESCORE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
