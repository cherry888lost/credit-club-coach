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

    // Get all reps with stats
    const { data: reps, error } = await serviceSupabase
      .from("reps")
      .select(`
        *,
        calls:calls(count),
        call_scores!inner(overall_score)
      `)
      .eq("org_id", DEFAULT_ORG_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ADMIN_MEMBERS] Error fetching reps:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process stats
    const members = reps?.map((rep: any) => {
      const scores = rep.call_scores?.map((s: any) => s.overall_score).filter((s: number | null) => s !== null) || [];
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

// POST /api/admin/members - Create new member
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
      .select("role")
      .eq("clerk_user_id", adminId)
      .single();

    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, fathom_email } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!['closer', 'sdr'].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Create user in Clerk
    const clerk = await clerkClient();
    let clerkUser;
    
    try {
      clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || undefined,
        password: generateTempPassword(), // Generate secure temp password
        skipPasswordChecks: false,
        publicMetadata: {
          role: role,
          org_id: DEFAULT_ORG_ID,
        },
      });
    } catch (err: any) {
      console.error("[ADMIN_MEMBERS] Clerk create error:", err);
      return NextResponse.json(
        { error: err.errors?.[0]?.message || "Failed to create user in Clerk" },
        { status: 400 }
      );
    }

    // Create rep in Supabase
    const { data: newRep, error: repError } = await serviceSupabase
      .from("reps")
      .insert({
        org_id: DEFAULT_ORG_ID,
        clerk_user_id: clerkUser.id,
        email: email.toLowerCase(),
        fathom_email: fathom_email?.toLowerCase() || null,
        name,
        role,
        status: "active",
      })
      .select()
      .single();

    if (repError) {
      // Rollback: delete Clerk user
      await clerk.users.deleteUser(clerkUser.id);
      console.error("[ADMIN_MEMBERS] Supabase insert error:", repError);
      return NextResponse.json({ error: repError.message }, { status: 500 });
    }

    // Note: Password reset email can be triggered from frontend Clerk components
    // or via Clerk Dashboard. Skipping backend password reset for now.

    return NextResponse.json({
      success: true,
      member: newRep,
      message: "Member created successfully. User can set password via reset link at login.",
    });

  } catch (error) {
    console.error("[ADMIN_MEMBERS] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/members/[id] - Update member
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
    const { id, name, email, fathom_email, role, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    // Build update object
    const updates: any = { updated_at: new Date().toISOString() };
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (fathom_email !== undefined) updates.fathom_email = fathom_email?.toLowerCase() || null;
    if (role) updates.role = role;
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

// DELETE /api/admin/members/[id] - Soft delete (deactivate) member
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
      .select("clerk_user_id, name")
      .eq("id", id)
      .single();

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
      // Soft delete: deactivate
      const { error } = await serviceSupabase
        .from("reps")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
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

function generateTempPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
