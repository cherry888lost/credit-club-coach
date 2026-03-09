import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const serviceSupabase = await createServiceClient();
    const { data: user } = await serviceSupabase
      .from("reps")
      .select("role")
      .eq("clerk_user_id", userId)
      .single();

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get recent webhook logs
    const { data: logs } = await serviceSupabase
      .from("webhook_logs")
      .select("id, source, event_type, status, error_message, created_at")
      .eq("org_id", DEFAULT_ORG_ID)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get stats
    const { data: statsData } = await serviceSupabase
      .from("webhook_logs")
      .select("status, created_at")
      .eq("org_id", DEFAULT_ORG_ID)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const stats = {
      total: statsData?.length || 0,
      success: statsData?.filter((d: any) => d.status === "success").length || 0,
      error: statsData?.filter((d: any) => d.status === "error").length || 0,
      last24h: statsData?.length || 0,
    };

    return NextResponse.json({ logs: logs || [], stats });

  } catch (error) {
    console.error("[DIAGNOSTICS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
