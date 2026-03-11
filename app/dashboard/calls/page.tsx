import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Phone } from "lucide-react";

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
  const user = await getCurrentUser();

  if (!user || !user.rep) {
    return null;
  }

  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();

  // Next.js 15+: searchParams is a Promise — must await it
  const params = await searchParams;

  const repFilter = params.rep || undefined;
  const roleFilter = (params.role as "closer" | "sdr" | undefined) || undefined;
  const statusFilter = (params.status as "scored" | "not_scored" | "low_signal" | undefined) || undefined;
  const outcomeFilter = (params.outcome as "closed" | "follow_up" | "no_sale" | undefined) || undefined;
  const dateFilter = (params.date as "today" | "yesterday" | "this_week" | "this_month" | undefined) || undefined;
  const sortFilter = (params.sort as "newest" | "oldest" | "highest" | "lowest" | undefined) || undefined;

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

  // Get all calls for this org
  let callsQuery = supabase
    .from("calls")
    .select("id, title, created_at, source, rep_id, fathom_call_id")
    .eq("org_id", orgId)
    .neq("source", "demo");

  // Apply rep filter server-side
  if (repFilter) {
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
    .select("call_id, overall_score, manual_outcome, outcome, low_signal");

  const scoreMap = new Map(
    scoresData?.map((s) => [
      s.call_id,
      {
        overall_score: s.overall_score as number | null,
        manual_outcome: s.manual_outcome as string | null,
        outcome: s.outcome as string | null,
        low_signal: s.low_signal as boolean | null,
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
    return {
      ...call,
      rep,
      score: scoreData?.overall_score ?? null,
      low_signal: scoreData?.low_signal ?? false,
      effectiveOutcome,
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
    calls = calls.filter((c) => c.score != null && !c.low_signal);
  } else if (statusFilter === "not_scored") {
    calls = calls.filter((c) => c.score == null && !c.low_signal);
  } else if (statusFilter === "low_signal") {
    calls = calls.filter((c) => c.low_signal);
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

  const totalCount = calls.length;

  // Check if any filter is active
  const hasActiveFilters = !!(repFilter || roleFilter || statusFilter || outcomeFilter || dateFilter || sortFilter);

  // Format date nicely
  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " · " + d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Get initials for avatar
  function getInitials(name?: string) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // Serialize rep options for the inline script
  const repOptionsJson = JSON.stringify(repOptions.map((r) => ({ id: r.id, name: r.name })));

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

      {/* Compact Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div id="calls-filter-bar" className="flex flex-wrap items-center gap-2.5">
          {/* Rep */}
          <FilterSelect
            name="rep"
            value={repFilter}
            placeholder="All Reps"
            options={repOptions.map((r) => ({ value: r.id, label: r.name }))}
          />

          {/* Role */}
          <FilterSelect
            name="role"
            value={roleFilter}
            placeholder="All Roles"
            options={[
              { value: "closer", label: "Closers" },
              { value: "sdr", label: "SDRs" },
            ]}
          />

          {/* Divider */}
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />

          {/* Status */}
          <FilterSelect
            name="status"
            value={statusFilter}
            placeholder="All Statuses"
            options={[
              { value: "scored", label: "Scored" },
              { value: "not_scored", label: "Not Scored" },
              { value: "low_signal", label: "Low Signal" },
            ]}
          />

          {/* Outcome */}
          <FilterSelect
            name="outcome"
            value={outcomeFilter}
            placeholder="All Outcomes"
            options={[
              { value: "closed", label: "Closed" },
              { value: "follow_up", label: "Follow Up" },
              { value: "no_sale", label: "No Sale" },
            ]}
          />

          {/* Divider */}
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />

          {/* Date */}
          <FilterSelect
            name="date"
            value={dateFilter}
            placeholder="All Time"
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "this_week", label: "This Week" },
              { value: "this_month", label: "This Month" },
            ]}
          />

          {/* Sort */}
          <FilterSelect
            name="sort"
            value={sortFilter}
            placeholder="Newest"
            options={[
              { value: "oldest", label: "Oldest" },
              { value: "highest", label: "Highest Score" },
              { value: "lowest", label: "Lowest Score" },
            ]}
          />
        </div>
      </div>

      {/* Inline script for auto-navigation on select change */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  var bar = document.getElementById('calls-filter-bar');
  if (!bar) return;
  bar.addEventListener('change', function(e) {
    if (e.target.tagName !== 'SELECT') return;
    var selects = bar.querySelectorAll('select');
    var params = new URLSearchParams();
    selects.forEach(function(s) {
      if (s.value) params.set(s.name, s.value);
    });
    var qs = params.toString();
    window.location.href = '/dashboard/calls' + (qs ? '?' + qs : '');
  });
})();
          `,
        }}
      />

      {/* Calls List */}
      {calls.length > 0 ? (
        <div className="space-y-2.5">
          {calls.map((call: any) => {
            const isLowSignal = call.low_signal;
            return (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className={`block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-4 ${
                  isLowSignal ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Left: Avatar + Rep info */}
                  <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      call.rep?.sales_role === "closer"
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : call.rep?.sales_role === "sdr"
                        ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {getInitials(call.rep?.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {call.rep?.name || "Unassigned"}
                        </span>
                        {call.rep?.sales_role && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase flex-shrink-0 ${
                            call.rep.sales_role === "closer"
                              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                              : "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                          }`}>
                            {call.rep.sales_role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center: Title + Date */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {call.title || "Untitled Call"}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatDate(call.created_at)}
                    </p>
                  </div>

                  {/* Right: Score / Status + Outcome */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isLowSignal ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        Low Signal
                      </span>
                    ) : call.score != null ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${
                        call.score >= 8
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                          : call.score >= 6
                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                          : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                      }`}>
                        {call.score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        Not Scored
                      </span>
                    )}

                    {call.effectiveOutcome && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        call.effectiveOutcome === "closed"
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                          : call.effectiveOutcome === "follow_up"
                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                          : call.effectiveOutcome === "no_sale"
                          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {call.effectiveOutcome.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-12 text-center">
          <Phone className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No calls found</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {hasActiveFilters
              ? "No calls match the current filters. Try adjusting your filters."
              : "Waiting for Fathom calls to come in."}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Compact Filter Select ─────────────────────────────────────────────── */

function FilterSelect({
  name,
  value,
  placeholder,
  options,
}: {
  name: string;
  value: string | undefined;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const isActive = !!value;
  return (
    <select
      name={name}
      defaultValue={value || ""}
      className={`
        h-8 pl-2.5 pr-7 text-xs font-medium rounded-lg border appearance-none cursor-pointer
        transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500
        bg-[length:16px_16px] bg-[position:right_4px_center] bg-no-repeat
        [background-image:url("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%2020%2020'%3e%3cpath%20stroke='%236b7280'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='1.5'%20d='M6%208l4%204%204-4'/%3e%3c/svg%3e")]
        ${
          isActive
            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
            : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
        }
      `}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
