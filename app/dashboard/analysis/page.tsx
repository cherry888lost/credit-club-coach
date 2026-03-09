import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { 
  BarChart3, 
  Trophy, 
  TrendingUp, 
  Users, 
  Flag,
  Phone,
  Target
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: { role?: string };
}) {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  const roleFilter = searchParams.role as 'closer' | 'sdr' | undefined;
  
  // Fetch all reps with their calls and scores
  let repsQuery = supabase
    .from("reps")
    .select(`
      id, name, role,
      calls:calls(
        id,
        call_scores(overall_score)
      )
    `)
    .eq("org_id", orgId)
    .eq("status", "active");
  
  if (roleFilter) {
    repsQuery = repsQuery.eq("role", roleFilter);
  }
  
  const { data: reps } = await repsQuery;
  
  // Fetch all scored calls with rubric type
  const { data: scoredCalls } = await supabase
    .from("calls")
    .select(`
      id,
      call_scores(rubric_type, overall_score),
      reps!left(role)
    `)
    .eq("org_id", orgId)
    .not("call_scores", "is", null);
  
  // Fetch flagged calls count
  const { count: flaggedCount } = await supabase
    .from("flags")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  
  // Calculate team stats
  const allScores = scoredCalls
    ?.filter((c: any) => !roleFilter || c.reps?.role === roleFilter)
    ?.map((c: any) => c.call_scores?.overall_score)
    ?.filter((s: number | null): s is number => s !== null && s !== undefined) || [];
  
  const teamAvg = allScores.length > 0 
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
    : null;
  
  // Calculate rep stats
  const repStats = (reps || [])
    .map((rep: any) => {
      const scores = rep.calls
        ?.map((c: any) => c.call_scores?.overall_score)
        ?.filter((s: number | null): s is number => s !== null && s !== undefined) || [];
      
      const avgScore = scores.length > 0
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        : null;
      
      return {
        id: rep.id,
        name: rep.name,
        role: rep.role,
        callCount: rep.calls?.length || 0,
        avgScore,
      };
    })
    .filter((r: any) => r.callCount > 0)
    .sort((a: any, b: any) => (b.avgScore || 0) - (a.avgScore || 0));
  
  // Get rubric-specific scores
  const closerScores = scoredCalls
    ?.filter((c: any) => c.call_scores?.rubric_type === "closer")
    ?.map((c: any) => c.call_scores?.overall_score)
    ?.filter((s: number | null): s is number => s !== null) || [];
  
  const sdrScores = scoredCalls
    ?.filter((c: any) => c.call_scores?.rubric_type === "sdr")
    ?.map((c: any) => c.call_scores?.overall_score)
    ?.filter((s: number | null): s is number => s !== null) || [];
  
  // Calculate category averages based on rubric type
  const { data: categoryScores } = await supabase
    .from("call_scores")
    .select(`
      rubric_type,
      opening_score,
      discovery_score,
      rapport_score,
      objection_handling_score,
      closing_score,
      structure_score,
      product_knowledge_score
    `)
    .in("call_id", scoredCalls?.map((c: any) => c.id) || []);
  
  const avgByCategory: Record<string, number> = {};
  
  if (categoryScores?.length) {
    const categories = [
      "opening_score", "discovery_score", "rapport_score",
      "objection_handling_score", "closing_score", "structure_score", "product_knowledge_score"
    ];
    
    categories.forEach(cat => {
      const values = categoryScores
        .map((s: any) => s[cat])
        .filter((v: number | null): v is number => v !== null);
      
      if (values.length > 0) {
        avgByCategory[cat.replace("_score", "")] = 
          values.reduce((a: number, b: number) => a + b, 0) / values.length;
      }
    });
  }
  
  const hasData = allScores.length > 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analysis</h1>
          <p className="text-zinc-400 mt-1">Team performance insights</p>
        </div>        
        <div className="flex items-center gap-2">
          <FilterButton href="/dashboard/analysis" active={!roleFilter}>All</FilterButton>
          <FilterButton href="/dashboard/analysis?role=closer" active={roleFilter === "closer"}>Closers</FilterButton>
          <FilterButton href="/dashboard/analysis?role=sdr" active={roleFilter === "sdr"}>SDRs</FilterButton>
        </div>
      </div>      
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          icon={<BarChart3 className="w-5 h-5" />}
          label="Team Average"
          value={teamAvg?.toFixed(1) || "-"}
          color={teamAvg && teamAvg >= 8 ? "green" : teamAvg && teamAvg < 7 ? "red" : "default"}
        />
        <KpiCard 
          icon={<Phone className="w-5 h-5" />}
          label="Scored Calls"
          value={allScores.length.toString()}
        />        
        <KpiCard 
          icon={<Users className="w-5 h-5" />}
          label="Active Reps"
          value={reps?.length?.toString() || "0"}
        />        
        <KpiCard 
          icon={<Flag className="w-5 h-5" />}
          label="Flagged"
          value={flaggedCount?.toString() || "0"}
          color={flaggedCount && flaggedCount > 0 ? "red" : "default"}
        />
      </div>      
      
      {/* Role-specific averages */}
      {(closerScores.length > 0 || sdrScores.length > 0) && !roleFilter && (
        <div className="grid grid-cols-2 gap-4">
          {closerScores.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-sm text-blue-400 mb-1">Closer Average</p>
              <p className="text-2xl font-bold text-white">
                {(closerScores.reduce((a, b) => a + b, 0) / closerScores.length).toFixed(1)}
              </p>
              <p className="text-xs text-blue-400/60">{closerScores.length} calls</p>
            </div>
          )}          
          
          {sdrScores.length > 0 && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
              <p className="text-sm text-purple-400 mb-1">SDR Average</p>
              <p className="text-2xl font-bold text-white">
                {(sdrScores.reduce((a, b) => a + b, 0) / sdrScores.length).toFixed(1)}
              </p>
              <p className="text-xs text-purple-400/60">{sdrScores.length} calls</p>
            </div>
          )}
        </div>
      )}
      
      {hasData ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Leaderboard */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800">
              <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h2 className="font-semibold text-white">Leaderboard</h2>
              </div>              
              <div className="divide-y divide-zinc-800">
                {repStats.map((rep: any, index: number) => (
                  <div key={rep.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                        index === 1 ? "bg-zinc-600 text-zinc-300" :
                        index === 2 ? "bg-orange-600/20 text-orange-400" :
                        "bg-zinc-800 text-zinc-500"
                      }`}>
                        {index + 1}
                      </span>                      
                      <div>
                        <p className="font-medium text-white">{rep.name}</p>                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          rep.role === 'closer' 
                            ? "bg-blue-500/20 text-blue-400" 
                            : "bg-purple-500/20 text-purple-400"
                        }`}>
                          {rep.role.toUpperCase()}
                        </span>
                      </div>
                    </div>                    
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-zinc-500">{rep.callCount} calls</span>                      
                      <span className={`text-lg font-bold ${
                        rep.avgScore && rep.avgScore >= 8 ? "text-green-400" : 
                        rep.avgScore && rep.avgScore < 7 ? "text-red-400" : "text-white"
                      }`}>
                        {rep.avgScore?.toFixed(1) || "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>            
            
            {/* Score Breakdown */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-white">Score Breakdown</h2>
              </div>              
              <div className="space-y-3">
                {Object.entries(avgByCategory).map(([name, score]) => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-400 capitalize">{name.replace("_", " ")}</span>
                      <span className="text-sm font-medium text-white">{score.toFixed(1)}</span>
                    </div>                    
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-12 text-center">
          <Target className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No scored calls yet</h3>
          <p className="text-zinc-500">Analysis will appear once calls are scored.</p>
        </div>
      )}
    </div>
  );
}

function KpiCard({ 
  icon, 
  label, 
  value, 
  color = "default" 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  color?: "green" | "red" | "default";
}) {
  const colors = {
    green: "bg-green-500/10 border-green-500/20 text-green-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    default: "bg-zinc-900 border-zinc-800",
  };
  
  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      </div>      
      <p className={`text-2xl font-bold ${color === "default" ? "text-white" : ""}`}>{value}</p>
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
    <a
      href={href}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active 
          ? "bg-indigo-600 text-white" 
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
      }`}
    >
      {children}
    </a>
  );
}
