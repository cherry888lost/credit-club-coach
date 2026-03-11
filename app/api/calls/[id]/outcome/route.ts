import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_OUTCOMES = ["closed", "follow_up", "no_sale"] as const;
const VALID_CLOSE_TYPES = ["full_close", "deposit", "payment_plan", "partial_access"] as const;

/**
 * POST /api/calls/[id]/outcome
 * 
 * Manually log a sales outcome for a call.
 * AI should NOT guess close_type — this is manual-only.
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
  const body = await request.json();
  const { outcome, close_type } = body;

  // Validate outcome
  if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate close_type rules
  if (outcome === "closed") {
    if (!close_type || !VALID_CLOSE_TYPES.includes(close_type)) {
      return NextResponse.json(
        { error: `When outcome is "closed", close_type is required. Must be one of: ${VALID_CLOSE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
  } else if (close_type) {
    return NextResponse.json(
      { error: `close_type should only be set when outcome is "closed"` },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Check call exists
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Check if score exists
    const { data: score, error: scoreError } = await supabase
      .from("call_scores")
      .select("id")
      .eq("call_id", callId)
      .single();

    if (scoreError || !score) {
      return NextResponse.json(
        { error: "No score exists for this call. Score the call first." },
        { status: 400 }
      );
    }

    // Update the score with manual outcome
    const { error: updateError } = await supabase
      .from("call_scores")
      .update({
        manual_outcome: outcome,
        manual_close_type: outcome === "closed" ? close_type : null,
        outcome_logged_at: new Date().toISOString(),
      })
      .eq("id", score.id);

    if (updateError) {
      console.error("[OUTCOME] Update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to update outcome", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "Outcome logged successfully",
      outcome,
      close_type: outcome === "closed" ? close_type : null,
    });

  } catch (err: any) {
    console.error("[OUTCOME] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calls/[id]/outcome
 * Fetch the current manual outcome for a call.
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

    const { data: score } = await supabase
      .from("call_scores")
      .select("manual_outcome, manual_close_type, outcome_logged_at, outcome, close_type")
      .eq("call_id", callId)
      .single();

    if (!score) {
      return NextResponse.json({ outcome: null, close_type: null });
    }

    return NextResponse.json({
      manual_outcome: score.manual_outcome,
      manual_close_type: score.manual_close_type,
      outcome_logged_at: score.outcome_logged_at,
      ai_outcome: score.outcome,
      ai_close_type: score.close_type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
