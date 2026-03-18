import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/resend-invite
 * Resend invite for a rep. Admin-only.
 * Body: { rep_id }
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

    const { rep_id } = await request.json();
    if (!rep_id) {
      return NextResponse.json({ error: "rep_id is required" }, { status: 400 });
    }

    // Get the rep
    const { data: rep } = await supabase
      .from("reps")
      .select("*")
      .eq("id", rep_id)
      .single();

    if (!rep) {
      return NextResponse.json({ error: "Rep not found" }, { status: 404 });
    }

    if (rep.status !== "invited") {
      return NextResponse.json(
        { error: "Can only resend invites for reps with 'invited' status" },
        { status: 400 }
      );
    }

    // Generate new token
    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: updateError } = await supabase
      .from("reps")
      .update({
        invite_token: newToken,
        invite_expires_at: expiresAt.toISOString(),
        invited_at: new Date().toISOString(),
      })
      .eq("id", rep_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Record in invite_history
    await supabase.from("invite_history").insert({
      rep_id,
      invited_by: admin.id,
      invited_at: new Date().toISOString(),
      status: "pending",
    });

    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const inviteUrl = `${baseUrl}/accept-invite?token=${newToken}`;

    return NextResponse.json({
      success: true,
      invite_url: inviteUrl,
      invite_token: newToken,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[RESEND_INVITE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
