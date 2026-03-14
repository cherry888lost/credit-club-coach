import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/calls/[id]
 *
 * Soft delete a call (admin only).
 * Sets deleted_at = NOW() instead of actually deleting the row.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify admin access
    await requireAdmin();
  } catch (error) {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }

  const { id: callId } = await params;

  try {
    const supabase = await createServiceClient();

    // 2. Check if call exists and isn't already deleted
    const { data: existingCall, error: fetchError } = await supabase
      .from("calls")
      .select("id, deleted_at")
      .eq("id", callId)
      .single();

    if (fetchError || !existingCall) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    if (existingCall.deleted_at) {
      return NextResponse.json(
        { error: "Call is already deleted" },
        { status: 409 }
      );
    }

    // 3. Perform soft delete
    const { error: updateError } = await supabase
      .from("calls")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", callId);

    if (updateError) {
      console.error("[DELETE CALL] Failed to soft delete:", updateError);
      return NextResponse.json(
        { error: "Failed to delete call", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[DELETE CALL] Soft deleted call ${callId}`);

    return NextResponse.json(
      {
        success: true,
        message: "Call deleted successfully",
        callId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[DELETE CALL] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
