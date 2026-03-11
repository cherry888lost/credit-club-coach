import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/patterns
 * List winning call patterns for the org.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();
    const orgId = await getDefaultOrgId();

    const { searchParams } = new URL(request.url);
    const outcome = searchParams.get("outcome");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    let query = supabase
      .from("winning_call_patterns")
      .select("*")
      .eq("org_id", orgId)
      .order("overall_score", { ascending: false })
      .limit(limit);

    if (outcome) {
      query = query.eq("outcome", outcome);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patterns: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
