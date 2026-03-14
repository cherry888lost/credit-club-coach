import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { Users, ArrowUpDown, Crown } from "lucide-react";

export const dynamic = "force-dynamic";

interface RepPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  sales_role: string | null;
  status: string;
  callCount: number;
  avgScore: number | null;
  closed: number;
  followUp: number;
  noSale: number;
}

function roleBadge(role: string | null) {
  if (!role) return null;
  const styles: Record<string, string> = {
    closer: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    sdr: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
    admin: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[role] || styles.admin}`}>
      {role.toUpperCase()}
    </span>
  );
}

function statusBadge(status: string) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        status === "active"
          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}

function coachingDot(avgScore: number | null) {
  if (avgScore == null) return <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600 inline-block" title="No data" />;
  if (avgScore >= 8) return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" title="On track" />;
  if (avgScore >= 6) return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" title="Needs attention" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" title="Needs coaching" />;
}

export default async function RepsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user || !user.rep) {
    return null;
  }

  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  const sortBy = params.sort || "score";

  // Get all reps — only show actual sales reps (closer/sdr)
  const { data: reps } = await supabase
    .from("reps")
    .select("id, name, email, role, sales_role, status")
    .eq("org_id", orgId)
    .in("sales_role", ["closer", "sdr"])
    .order("name");

  // Get all production calls with scores (excluding soft-deleted)
  const { data: callsWithScores } = await supabase
    .from("calls")
    .select(`
      id,
      rep_id,
      call_scores(
        overall_score,
        score_total,
        close_outcome
      )
    `)
    .eq("org_id", orgId)
    .is("deleted_at", null); // CRITICAL: Exclude soft-deleted calls

  // Calculate stats per rep
  const repPerf: Record<string, { scores: number[]; closed: number; followUp: number; noSale: number; callCount: number }> = {};

  for (const rep of reps || []) {
    repPerf[rep.id] = { scores: [], closed: 0, followUp: 0, noSale: 0, callCount: 0 };
  }

  for (const call of callsWithScores || []) {
    const repId = call.rep_id;
    if (!repId || !repPerf[repId]) continue;

    repPerf[repId].callCount++;

    const rawCs = (call as any).call_scores;
    const cs = Array.isArray(rawCs) ? rawCs[0] : rawCs;
    if (!cs) continue;

    const effectiveScore = cs.overall_score ?? cs.score_total;
    if (effectiveScore != null) {
      repPerf[repId].scores.push(effectiveScore);
    }

    const outcome = cs.close_outcome;
    if (outcome === "closed") repPerf[repId].closed++;
    else if (outcome === "follow_up") repPerf[repId].followUp++;
    else if (outcome === "no_sale") repPerf[repId].noSale++;
  }

  // Build rep list
  let repList: RepPerformance[] = (reps || []).map((rep) => {
    const stats = repPerf[rep.id];
    const avgScore = stats && stats.scores.length > 0
      ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
      : null;

    return {
      id: rep.id,
      name: rep.name,
      email: rep.email,
      role: rep.role,
      sales_role: rep.sales_role,
      status: rep.status,
      callCount: stats?.callCount || 0,
      avgScore,
      closed: stats?.closed || 0,
      followUp: stats?.followUp || 0,
      noSale: stats?.noSale || 0,
    };
  });

  // Sort
  switch (sortBy) {
    case "name":
      repList.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "volume":
      repList.sort((a, b) => b.callCount - a.callCount);
      break;
    case "role":
      repList.sort((a, b) => (a.sales_role || "zzz").localeCompare(b.sales_role || "zzz"));
      break;
    case "score":
    default:
      repList.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
      break;
  }

  const currentUserId = user.rep.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Team Performance</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          {repList.length} team member{repList.length !== 1 ? "s" : ""} · All-time performance
        </p>
      </div>

      {/* Sort Bar */}
      <div className="flex items-center gap-3">
        <ArrowUpDown className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Sort by:</span>
        <div className="flex items-center gap-1.5">
          <SortPill href="/dashboard/reps?sort=score" active={sortBy === "score"}>Score</SortPill>
          <SortPill href="/dashboard/reps?sort=name" active={sortBy === "name"}>Name</SortPill>
          <SortPill href="/dashboard/reps?sort=volume" active={sortBy === "volume"}>Volume</SortPill>
          <SortPill href="/dashboard/reps?sort=role" active={sortBy === "role"}>Role</SortPill>
        </div>
      </div>

      {/* Rep Cards */}
      {repList.length > 0 ? (
        <div className="space-y-3">
          {repList.map((rep) => {
            const isCurrentUser = rep.id === currentUserId;
            return (
              <div
                key={rep.id}
                className={`bg-white dark:bg-zinc-900 rounded-xl border shadow-sm p-5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                  isCurrentUser
                    ? "border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Avatar + Info */}
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 relative">
                      <span className="text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
                        {rep.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      {/* Coaching dot */}
                      <span className="absolute -bottom-0.5 -right-0.5">
                        {coachingDot(rep.avgScore)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-900 dark:text-white truncate">{rep.name}</span>
                        {isCurrentUser && (
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">(You)</span>
                        )}
                        {rep.role === "admin" && roleBadge("admin")}
                        {rep.sales_role && roleBadge(rep.sales_role)}
                        {statusBadge(rep.status)}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{rep.email}</p>
                    </div>
                  </div>

                  {/* Right: Stats Grid */}
                  <div className="grid grid-cols-5 gap-3 sm:gap-4">
                    <StatCell label="Calls" value={rep.callCount.toString()} />
                    <StatCell
                      label="Avg Score"
                      value={rep.avgScore?.toFixed(1) || "-"}
                      className={
                        rep.avgScore != null
                          ? rep.avgScore >= 8
                            ? "text-green-600 dark:text-green-400"
                            : rep.avgScore < 6
                            ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400"
                          : ""
                      }
                    />
                    <StatCell label="Closed" value={rep.closed.toString()} className="text-green-700 dark:text-green-400" />
                    <StatCell label="Follow-up" value={rep.followUp.toString()} className="text-blue-700 dark:text-blue-400" />
                    <StatCell label="No Sale" value={rep.noSale.toString()} className="text-red-700 dark:text-red-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No team members found</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Add team members to see performance stats here.</p>
        </div>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function StatCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="text-center min-w-[60px]">
      <p className={`text-lg font-bold ${className || "text-zinc-900 dark:text-white"}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function SortPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </a>
  );
}
