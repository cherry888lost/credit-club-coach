import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/members - List all members
export async function GET(request: NextRequest) {
  try {
    const { userId: adminId } = await auth();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const serviceSupabase = await createServiceClient();
    const { data: admin } = await serviceSupabase
      .from("reps")
      .select("role")
      .eq("clerk_user_id", adminId)
      .single();

    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get all reps with call stats
    const { data: reps, error } = await serviceSupabase
      .from("reps")
      .select(`
        *,
        calls:calls(count)
      `)
      .eq("org_id", DEFAULT_ORG_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ADMIN_MEMBERS] Error fetching reps:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get scores separately to avoid relation issues
    const { data: allScores } = await serviceSupabase
      .from("call_scores")
      .select("call_id, overall_score, calls!inner(rep_id)")
      .in("call_id", 
        (await serviceSupabase
          .from("calls")
          .select("id")
          .eq("org_id", DEFAULT_ORG_ID)
        ).data?.map(c => c.id) || []
      );

    // Calculate scores per rep
    const scoresByRep: Record<string, number[]> = {};
    allScores?.forEach((score: any) => {
      const repId = score.calls?.rep_id;
      if (repId) {
        if (!scoresByRep[repId]) scoresByRep[repId] = [];
        if (score.overall_score) scoresByRep[repId].push(score.overall_score);
      }
    });

    // Process stats
    const members = reps?.map((rep: any) => {
      const scores = scoresByRep[rep.id] || [];
      const avgScore = scores.length > 0 
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length 
        : null;

      return {
        id: rep.id,
        name: rep.name,
        email: rep.email,
        fathom_email: rep.fathom_email,
        role: rep.role,
        status: rep.status,
        clerk_user_id: rep.clerk_user_id,
        created_at: rep.created_at,
        updated_at: rep.updated_at,
        sales_role: rep.sales_role,
        invited_at: rep.invited_at,
        accepted_at: rep.accepted_at,
        invite_token: rep.invite_token,
        stats: {
          call_count: rep.calls?.[0]?.count || 0,
          avg_score: avgScore,
        },
      };
    });

    return NextResponse.json({ members });

  } catch (error) {
    console.error("[ADMIN_MEMBERS] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/members - Create new member via invite
// NOTE: Prefer using /api/invite-rep for new invites.
// This endpoint is kept for backward compatibility but now creates invited reps.
export async function POST(request: NextRequest) {
  try {
    const { userId: adminId } = await auth();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const serviceSupabase = await createServiceClient();
    const { data: admin } = await serviceSupabase
      .from("reps")
      .select("id, role, status")
      .eq("clerk_user_id", adminId)
      .single();

    if (!admin || admin.role !== "admin" || admin.status !== "active") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, sales_role, fathom_email } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (role && !['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be 'admin' or 'member'." }, { status: 400 });
    }
    
    if (sales_role && !['closer', 'sdr'].includes(sales_role)) {
      return NextResponse.json({ error: "Invalid sales_role. Must be 'closer', 'sdr', or null." }, { status: 400 });
    }

    // Check if email already exists (case-insensitive)
    const { data: existing } = await serviceSupabase
      .from("reps")
      .select("id")
      .ilike("email", email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: "A member with this email already exists" }, { status: 409 });
    }

    // Generate invite token
    const crypto = require("crypto");
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create rep with invited status — NO Clerk user created upfront
    const { data: newRep, error: repError } = await serviceSupabase
      .from("reps")
      .insert({
        org_id: DEFAULT_ORG_ID,
        email: email.toLowerCase(),
        fathom_email: fathom_email?.toLowerCase() || null,
        name,
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

    if (repError) {
      console.error("[ADMIN_MEMBERS] Supabase insert error:", repError);
      return NextResponse.json({ error: repError.message }, { status: 500 });
    }

    // Record invite history
    await serviceSupabase.from("invite_history").insert({
      rep_id: newRep.id,
      invited_by: admin.id,
      invited_at: new Date().toISOString(),
      status: "pending",
    });

    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const inviteUrl = `${baseUrl}/accept-invite?token=${inviteToken}`;

    return NextResponse.json({
      success: true,
      member: newRep,
      invite_url: inviteUrl,
      message: "Invite created. Share the invite link with the new member.",
    });

  } catch (error) {
    console.error("[ADMIN_MEMBERS] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/members - Update member
export async function PATCH(request: NextRequest) {
  try {
    const { userId: adminId } = await auth();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceSupabase = await createServiceClient();
    
    // Verify admin
    const { data: admin } = await serviceSupabase
      .from("reps")
      .select("role")
      .eq("clerk_user_id", adminId)
      .single();

    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, email, fathom_email, role, sales_role, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    // Check for email conflict if changing email
    if (email) {
      const { data: existing } = await serviceSupabase
        .from("reps")
        .select("id")
        .eq("email", email.toLowerCase())
        .neq("id", id)
        .single();

      if (existing) {
        return NextResponse.json({ error: "Another member already uses this email" }, { status: 409 });
      }
    }

    // Build update object — role and sales_role are independent
    const updates: any = { updated_at: new Date().toISOString() };
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (fathom_email !== undefined) updates.fathom_email = fathom_email?.toLowerCase() || null;
    if (role && ['admin', 'member'].includes(role)) updates.role = role;
    if (sales_role !== undefined) updates.sales_role = sales_role || null;
    if (status) updates.status = status;

    // Update in Supabase
    const { data: updatedRep, error } = await serviceSupabase
      .from("reps")
      .update(updates)
      .eq("id", id)
      .eq("org_id", DEFAULT_ORG_ID)
      .select()
      .single();

    if (error) {
      console.error("[ADMIN_MEMBERS] Update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If clerk_user_id exists, update Clerk user too
    if (updatedRep?.clerk_user_id) {
      try {
        const clerk = await clerkClient();
        await clerk.users.updateUser(updatedRep.clerk_user_id, {
          firstName: updates.name?.split(' ')[0],
          lastName: updates.name?.split(' ').slice(1).join(' ') || undefined,
          publicMetadata: {
            role: updates.role || updatedRep.role,
          },
        });
      } catch (err) {
        console.error("[ADMIN_MEMBERS] Clerk update error (non-fatal):", err);
      }
    }

    return NextResponse.json({ success: true, member: updatedRep });

  } catch (error) {
    console.error("[ADMIN_MEMBERS] PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/members - Soft delete (deactivate) member
export async function DELETE(request: NextRequest) {
  try {
    const { userId: adminId } = await auth();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const hardDelete = searchParams.get("hard") === "true";

    if (!id) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    const serviceSupabase = await createServiceClient();
    
    // Verify admin
    const { data: admin } = await serviceSupabase
      .from("reps")
      .select("role")
      .eq("clerk_user_id", adminId)
      .single();

    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get member before deletion
    const { data: member } = await serviceSupabase
      .from("reps")
      .select("clerk_user_id, name, role")
      .eq("id", id)
      .single();

    // Prevent self-deletion
    if (member?.clerk_user_id === adminId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    if (hardDelete && member?.clerk_user_id) {
      // Hard delete: remove from Clerk
      try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(member.clerk_user_id);
      } catch (err) {
        console.error("[ADMIN_MEMBERS] Clerk delete error:", err);
      }
    }

    if (hardDelete) {
      // Remove clerk_user_id from calls (preserve calls but unlink rep)
      await serviceSupabase
        .from("calls")
        .update({ rep_id: null })
        .eq("rep_id", id);

      // Delete rep
      const { error } = await serviceSupabase
        .from("reps")
        .delete()
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Member permanently deleted" });
    } else {
      // Soft delete: disable
      const { error } = await serviceSupabase
        .from("reps")
        .update({ status: "disabled", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Member deactivated" });
    }

  } catch (error) {
    console.error("[ADMIN_MEMBERS] DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// generateTempPassword removed — invite-only system, no Clerk user creation at invite time
