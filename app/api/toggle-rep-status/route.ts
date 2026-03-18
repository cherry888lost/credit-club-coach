import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/toggle-rep-status
 * Toggle a rep's status. Admin-only.
 * Body: { rep_id, action: 'disable' | 'enable' | 'revoke_invite' }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Verify admin
    const { data: admin } = await supabase
      .from("reps")
      .select("id, role, status")
      .eq("clerk_user_id", userId)
      .single();

    if (!admin || admin.role !== "admin" || admin.status !== "active") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { rep_id, action } = await request.json();
    if (!rep_id || !action) {
      return NextResponse.json({ error: "rep_id and action are required" }, { status: 400 });
    }

    // Get current rep
    const { data: rep } = await supabase
      .from("reps")
      .select("*")
      .eq("id", rep_id)
      .single();

    if (!rep) {
      return NextResponse.json({ error: "Rep not found" }, { status: 404 });
    }

    // Prevent self-disable
    if (rep.clerk_user_id === userId && (action === 'disable' || action === 'revoke_invite')) {
      return NextResponse.json({ error: "Cannot disable yourself" }, { status: 400 });
    }

    let updates: Record<string, any> = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'disable':
        updates.status = 'disabled';
        break;
      case 'enable':
        updates.status = 'active';
        if (!rep.accepted_at) {
          updates.accepted_at = new Date().toISOString();
        }
        break;
      case 'revoke_invite':
        if (rep.status !== 'invited') {
          return NextResponse.json({ error: "Can only revoke invited reps" }, { status: 400 });
        }
        updates.status = 'disabled';
        updates.invite_token = null;
        updates.invite_expires_at = null;
        // Update invite_history
        await supabase
          .from("invite_history")
          .update({ status: "revoked" })
          .eq("rep_id", rep_id)
          .eq("status", "pending");
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("reps")
      .update(updates)
      .eq("id", rep_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rep: updated });
  } catch (error) {
    console.error("[TOGGLE_REP_STATUS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
