"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const VALID_OUTCOMES = ["closed", "no_sale"] as const;
const VALID_CLOSE_TYPES = ["full_close", "deposit", "payment_plan", "partial_access"] as const;

export async function saveOutcome(callId: string, outcome: string, closeType?: string) {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized" };
  }

  // Validate outcome
  if (!outcome || !VALID_OUTCOMES.includes(outcome as any)) {
    return { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}` };
  }

  // Validate close_type rules
  if (outcome === "closed") {
    if (!closeType || !VALID_CLOSE_TYPES.includes(closeType as any)) {
      return { error: `When outcome is "closed", close_type is required. Must be one of: ${VALID_CLOSE_TYPES.join(", ")}` };
    }
  } else if (closeType) {
    return { error: `close_type should only be set when outcome is "closed"` };
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
      return { error: "Call not found" };
    }

    // Check if score exists
    const { data: score, error: scoreError } = await supabase
      .from("call_scores")
      .select("id")
      .eq("call_id", callId)
      .single();

    if (scoreError || !score) {
      return { error: "No score exists for this call. Score the call first." };
    }

    // Update the score with manual outcome
    const { error: updateError } = await supabase
      .from("call_scores")
      .update({
        manual_outcome: outcome,
        manual_close_type: outcome === "closed" ? closeType : null,
        outcome_logged_at: new Date().toISOString(),
      })
      .eq("id", score.id);

    if (updateError) {
      console.error("[OUTCOME] Update failed:", updateError);
      return { error: "Failed to update outcome" };
    }

    // Revalidate all affected pages
    // Because this is a Server Action (not a Route Handler),
    // revalidatePath also busts the client-side Router Cache
    revalidatePath(`/dashboard/calls/${callId}`);
    revalidatePath("/dashboard/calls");
    revalidatePath("/dashboard");

    return {
      status: "ok",
      outcome,
      close_type: outcome === "closed" ? closeType : null,
    };
  } catch (err: any) {
    console.error("[OUTCOME] Error:", err);
    return { error: "Internal server error" };
  }
}
