import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calls/[id]/score/status
 *
 * Poll the scoring status for a call.
 * Returns the latest scoring_request status, or the existing score if completed.
 */
export async function GET(
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

    // Check if a completed score exists
    const { data: score } = await supabase
      .from("call_scores")
      .select("id, overall_score, quality_label")
      .eq("call_id", callId)
      .single();

    if (score && score.overall_score != null) {
      return NextResponse.json({
        status: "completed",
        scoreId: score.id,
        overall_score: score.overall_score,
        quality_label: score.quality_label,
      });
    }

    // Check latest scoring request
    const { data: request_ } = await supabase
      .from("scoring_requests")
      .select("id, status, error_message, created_at")
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!request_) {
      return NextResponse.json({ status: "none" });
    }

    return NextResponse.json({
      status: request_.status,
      requestId: request_.id,
      error: request_.error_message ?? undefined,
      createdAt: request_.created_at,
    });
  } catch (err: any) {
    console.error("[SCORE_STATUS] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
