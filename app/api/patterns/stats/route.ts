import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminApi } from "@/lib/auth/admin-api";

export async function GET() {
  const admin = await requireAdminApi();
  if (admin.response) return admin.response;
  const supabase = createServiceClient();

  // Count patterns by category
  const { data: approved } = await supabase
    .from("learning_queue")
    .select("pattern_category")
    .in("status", ["approved", "promoted"]);

  const { data: benchmarks } = await supabase
    .from("benchmark_calls")
    .select("id")
    .limit(100);

  const categoryCounts: Record<string, number> = {};
  for (const item of approved || []) {
    categoryCounts[item.pattern_category] =
      (categoryCounts[item.pattern_category] || 0) + 1;
  }

  return NextResponse.json({
    total_patterns: (approved || []).length,
    total_benchmarks: (benchmarks || []).length,
    by_category: categoryCounts,
  });
}
