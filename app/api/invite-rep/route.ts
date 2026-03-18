import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/invite-rep
 * Invite a new rep to the team. Admin-only.
 * Body: { name, email, role, sales_role? }
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

    const body = await request.json();
    const { name, email, role, sales_role, fathom_email } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing rep with same email (case-insensitive)
    const { data: existing } = await supabase
      .from("reps")
      .select("id, status")
      .ilike("email", normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "A rep with this email already exists" },
        { status: 409 }
      );
    }

    // Generate invite token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    // Create rep with invited status
    const { data: newRep, error: insertError } = await supabase
      .from("reps")
      .insert({
        org_id: DEFAULT_ORG_ID,
        name,
        email: normalizedEmail,
        fathom_email: fathom_email?.toLowerCase().trim() || null,
        role: role || "member",
        sales_role: sales_role || null,
        status: "invited",
        invited_at: new Date().toISOString(),
        invited_by: admin.id,
        invite_token: inviteToken,
        invite_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[INVITE_REP] Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Record in invite_history
    await supabase.from("invite_history").insert({
      rep_id: newRep.id,
      invited_by: admin.id,
      invited_at: new Date().toISOString(),
      status: "pending",
    });

    // Build invite URL
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const inviteUrl = `${baseUrl}/accept-invite?token=${inviteToken}`;

    return NextResponse.json({
      success: true,
      rep: newRep,
      invite_url: inviteUrl,
      invite_token: inviteToken,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[INVITE_REP] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
