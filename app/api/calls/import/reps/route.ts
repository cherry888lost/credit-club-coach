import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserWithRole, isAdmin, DEFAULT_ORG_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calls/import/reps
 *
 * Returns list of reps for the import form dropdown.
 * Admin only.
 */
export async function GET() {
  const user = await getCurrentUserWithRole();
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createServiceClient();

  const { data: reps, error } = await supabase
    .from("reps")
    .select("id, name, email")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reps: (reps || []).map((r) => ({
      id: r.id,
      name: r.name || r.email || "Unknown",
    })),
  });
}
