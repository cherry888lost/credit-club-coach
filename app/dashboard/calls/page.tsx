import { getCurrentUserWithRole, getDefaultOrgId, isAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Phone } from "lucide-react";
import { FilterBar } from "./_components/FilterBar";
import { CallsList } from "./_components/CallsList";

export const dynamic = "force-dynamic";

type SearchParams = {
  rep?: string;
  role?: string;
  status?: string;
  outcome?: string;
  date?: string;
  sort?: string;
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUserWithRole();

  if (!user || !user.rep) {
    return null;
  }

  const userIsAdmin = user.isAdminUser;
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();

  // Next.js 15+: searchParams is a Promise — must await it
  const params = await searchParams;

  // SERVER-SIDE ENFORCEMENT: non-admins can only see their own calls
  // Ignore any rep filter from URL for non-admins (prevents URL tampering)
  const repFilter = userIsAdmin ? (params.rep || undefined) : undefined;
  const roleFilter = (params.role as "closer" | "sdr" | undefined) || undefined;
  const statusFilter = (params.status as "scored" | "not_scored" | undefined) || undefined;
  const outcomeFilter = (params.outcome as "closed" | "follow_up" | "no_sale" | undefined) || undefined;
  const dateFilter = (params.date as "today" | "yesterday" | "this_week" | "this_month" | undefined) || undefined;
  const sortFilter = (params.sort as "newest" | "oldest" | "highest" | "lowest" | undefined) || undefined;

  console.log("[CallsPage] Raw params:", JSON.stringify(params));
  console.log("[CallsPage] Filters:", { repFilter, roleFilter, statusFilter, outcomeFilter, dateFilter, sortFilter });

  // Build date range
  const now = new Date();
  const startOfDay = (d: Date) => {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s;
  };

  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;

  if (dateFilter === "today") {
    dateFrom = startOfDay(now);
    dateTo = new Date(dateFrom.getTime() + 86400000);
  } else if (dateFilter === "yesterday") {
    dateTo = startOfDay(now);
    dateFrom = new Date(dateTo.getTime() - 86400000);
  } else if (dateFilter === "this_week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    dateFrom = startOfDay(new Date(now.getTime() - diff * 86400000));
  } else if (dateFilter === "this_month") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Get all calls for this org (excluding soft-deleted)
  let callsQuery = supabase
    .from("calls")
    .select("id, title, created_at, rep_id, rep_name, call_date, duration_seconds")
    .eq("org_id", orgId)
    .is("deleted_at", null); // CRITICAL: Exclude soft-deleted calls

  // SERVER-SIDE ENFORCEMENT: non-admins always scoped to own calls
  if (!userIsAdmin) {
    callsQuery = callsQuery.eq("rep_id", user.rep.id);
  } else if (repFilter) {
    callsQuery = callsQuery.eq("rep_id", repFilter);
  }

  if (dateFrom) {
    callsQuery = callsQuery.gte("created_at", dateFrom.toISOString());
  }
  if (dateTo) {
    callsQuery = callsQuery.lt("created_at", dateTo.toISOString());
  }

  // Default sort by newest
  const ascending = sortFilter === "oldest";
  if (sortFilter !== "highest" && sortFilter !== "lowest") {
    callsQuery = callsQuery.order("created_at", { ascending });
  } else {
    callsQuery = callsQuery.order("created_at", { ascending: false });
  }

  const { data: callsData, error: callsError } = await callsQuery;

  console.log("[CallsPage] Query returned:", callsData?.length, "calls, error:", callsError?.message || "none");

  if (callsError) {
    console.error("[CallsPage] Error:", callsError);
  }

  // Get reps for lookup
  const { data: repsData } = await supabase
    .from("reps")
    .select("id, name, email, fathom_email, role, sales_role")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  const repMap = new Map(repsData?.map((r) => [r.id, r]) || []);

  // Build rep list for the filter dropdown
  const repOptions = (repsData || []).map((r) => ({
    id: r.id,
    name: r.name || r.email || "Unknown",
  }));

  // Get scores for lookup
  const { data: scoresData } = await supabase
    .from("call_scores")
    .select("call_id, overall_score, score_total, close_outcome, close_type, score_grade, manual_outcome, manual_close_type")
    .eq("org_id", orgId);

  const scoreMap = new Map(
    scoresData?.map((s) => [
      s.call_id,
      {
        overall_score: (s.overall_score ?? s.score_total) as number | null,
        manual_outcome: s.manual_outcome as string | null,
        outcome: s.close_outcome as string | null,
        close_type: s.close_type as string | null,
        manual_close_type: s.manual_close_type as string | null,
        score_total: s.score_total as number | null,
      },
    ]) || []
  );

  // Get flags for lookup
  const { data: flagsData } = await supabase.from("flags").select("call_id");

  const flaggedCallIds = new Set(flagsData?.map((f) => f.call_id) || []);

  // Process and enrich calls
  let calls = (callsData || []).map((call) => {
    const rep = repMap.get(call.rep_id);
    const scoreData = scoreMap.get(call.id);
    const effectiveOutcome = scoreData?.manual_outcome || scoreData?.outcome || null;
    // Use manual close type if set; suppress close type entirely for no_sale outcomes
    const effectiveCloseType = effectiveOutcome === "no_sale"
      ? null
      : (scoreData?.manual_close_type || scoreData?.close_type || null);
    return {
      ...call,
      rep,
      score: scoreData?.overall_score ?? scoreData?.score_total ?? null,
      effectiveOutcome,
      effectiveCloseType,
      hasFlag: flaggedCallIds.has(call.id),
    };
  });

  // Rep filter already applied server-side in Supabase query

  // Apply role filter
  if (roleFilter) {
    calls = calls.filter((c) => c.rep?.sales_role === roleFilter);
  }

  // Apply status filter
  if (statusFilter === "scored") {
    calls = calls.filter((c) => c.score != null);
  } else if (statusFilter === "not_scored") {
    calls = calls.filter((c) => c.score == null);
  }

  // Apply outcome filter
  if (outcomeFilter) {
    calls = calls.filter((c) => c.effectiveOutcome === outcomeFilter);
  }

  // Apply score-based sorting
  if (sortFilter === "highest") {
    calls.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  } else if (sortFilter === "lowest") {
    calls.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
  }

  console.log("[CallsPage] After all filters:", calls.length, "calls remaining");

  const totalCount = calls.length;

  // Check if any filter is active
  const hasActiveFilters = !!(repFilter || roleFilter || statusFilter || outcomeFilter || dateFilter || sortFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Calls</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {totalCount} call{totalCount !== 1 ? "s" : ""}
            {hasActiveFilters && " · Filtered"}
          </p>
        </div>
        {hasActiveFilters && (
          <Link
            href="/dashboard/calls"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            Clear all filters
          </Link>
        )}
      </div>

      {/* Compact Filter Bar (client component — smooth navigation) */}
      <FilterBar
        repOptions={repOptions}
        currentFilters={{
          rep: repFilter,
          role: roleFilter,
          status: statusFilter,
          outcome: outcomeFilter,
          date: dateFilter,
          sort: sortFilter,
        }}
        isAdmin={userIsAdmin}
      />

      {/* Calls List (client component with selection + delete) */}
      <CallsList calls={calls} isAdmin={userIsAdmin} totalCount={totalCount} />
    </div>
  );
}
