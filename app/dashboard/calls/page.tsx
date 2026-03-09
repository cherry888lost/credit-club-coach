import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Phone, Calendar, User, Flag, Filter } from "lucide-react";
import SendTestWebhookButton from "./_components/SendTestWebhookButton";

export const dynamic = "force-dynamic";

export default async function CallsPage({
  searchParams,
}: {
  searchParams: { role?: string; status?: string };
}) {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  const roleFilter = searchParams.role;
  
  // Build query
  let query = supabase
    .from("calls")
    .select(`
      id, title, created_at, source,
      reps!left(id, name, role),
      call_scores(overall_score),
      flags:id(id)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  
  // Apply role filter if specified
  if (roleFilter) {
    query = query.eq("reps.role", roleFilter);
  }
  
  const { data: calls, error } = await query;
  
  if (error) {
    console.error("[CallsPage] Error:", error);
  }
  
  // Process calls
  const processedCalls = (calls || []).map((call: any) => {
    const score = call.call_scores?.overall_score;
    const hasFlag = call.flags?.length > 0;
    
    return {
      ...call,
      score,
      hasFlag,
    };
  });
  
  // Count by source
  const realCalls = processedCalls.filter((c: any) => c.source === "fathom").length;
  const demoCalls = processedCalls.filter((c: any) => c.source === "demo").length;
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Calls</h1>
          <p className="text-zinc-400 mt-1">
            {processedCalls.length} total 
            {realCalls > 0 && <span className="text-zinc-500">({realCalls} real, {demoCalls} demo)</span>}
          </p>
        </div>        
        <SendTestWebhookButton />
      </div>      
      
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-zinc-500" />
        <div className="flex gap-2">
          <FilterButton href="/dashboard/calls" active={!roleFilter}>All</FilterButton>
          <FilterButton href="/dashboard/calls?role=closer" active={roleFilter === "closer"}>Closers</FilterButton>
          <FilterButton href="/dashboard/calls?role=sdr" active={roleFilter === "sdr"}>SDRs</FilterButton>
        </div>
      </div>      
      
      {processedCalls.length > 0 ? (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="divide-y divide-zinc-800">
            {processedCalls.map((call: any) => (
              <Link 
                key={call.id} 
                href={`/dashboard/calls/${call.id}`}
                className="block p-5 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white truncate">{call.title || "Untitled Call"}</h3>                      
                      {call.hasFlag && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                          <Flag className="w-3 h-3" />
                          Flagged
                        </span>
                      )}                      
                      {call.source === "demo" && (
                        <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full">Demo</span>
                      )}
                    </div>                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <User className="w-4 h-4" />
                        <span className={call.reps?.name ? "text-zinc-300" : "text-zinc-500 italic"}>
                          {call.reps?.name || "Unassigned"}
                        </span>
                        {call.reps?.role && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            call.reps.role === 'closer' 
                              ? "bg-blue-500/20 text-blue-400" 
                              : "bg-purple-500/20 text-purple-400"
                          }`}>
                            {call.reps.role.toUpperCase()}
                          </span>
                        )}
                      </span>                      
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(call.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>                  
                  <div className="flex items-center gap-3">
                    {call.score !== null && call.score !== undefined ? (
                      <div className="text-right">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold ${
                          call.score >= 8 
                            ? "bg-green-500/20 text-green-400" 
                            : call.score < 7 
                              ? "bg-red-500/20 text-red-400"
                              : "bg-zinc-800 text-zinc-300"
                        }`}>
                          {call.score.toFixed(1)}
                        </span>
                        <p className="text-xs text-zinc-500 mt-1">Score</p>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-600 px-3">Not scored</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-12 text-center">
          <Phone className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No calls yet</h3>
          <p className="text-zinc-500 mb-6">Send a test webhook or wait for Fathom calls.</p>
        </div>
      )}
    </div>
  );
}

function FilterButton({ 
  href, 
  active, 
  children 
}: { 
  href: string; 
  active: boolean; 
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active 
          ? "bg-indigo-600 text-white" 
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
      }`}
    >
      {children}
    </Link>
  );
}
