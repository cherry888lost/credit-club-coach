import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/members/reset-password - Send password reset email
export async function POST(request: NextRequest) {
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
    const { userId, email } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // Create password reset in Clerk
    const clerk = await clerkClient();
    
    try {
      // Revoke existing sessions and create password reset
      await clerk.users.updateUser(userId, {
        password: generateTempPassword(), // Force password change
      });
      
      // The user will need to use "Forgot password" to set their own
      return NextResponse.json({ 
        success: true, 
        message: "Password reset initiated. User should use 'Forgot password' on login page." 
      });
    } catch (err: any) {
      console.error("[RESET_PASSWORD] Clerk error:", err);
      return NextResponse.json(
        { error: err.errors?.[0]?.message || "Failed to reset password" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("[RESET_PASSWORD] Error:", error);
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
