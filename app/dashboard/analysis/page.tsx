import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { BarChart3, TrendingUp, Award, Users, Flag, Phone } from "lucide-react";

interface RepStats {
  id: string;
  name: string;
  callCount: number;
  avgScore: number | null;
  flaggedCount: number;
}

export default async function AnalysisPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  // Fetch all reps first (source of truth)
  const { data: reps } = await supabase
    .from("reps")
    .select("id, name")
    .eq("org_id", orgId);
  
  // Fetch all scored calls with rep info
  const { data: callsWithData } = await supabase
    .from("calls")
    .select(`
      id,
      rep_id,
      call_scores(
        opening_score, discovery_score, rapport_score,
        objection_handling_score, closing_score, structure_score, product_knowledge_score,
        strengths, improvements
      )
    `)
    .eq("org_id", orgId)
    .not("call_scores", "is", null);
  
  // Fetch all flags
  const { data: allFlags } = await supabase
    .from("flags")
    .select("call_id")
    .eq("org_id", orgId);
  
  const flagSet = new Set(allFlags?.map(f => f.call_id) || []);
  
  // Calculate rep stats properly
  const repStatsMap: Record<string, RepStats> = {};
  
  // Initialize all reps
  reps?.forEach(rep => {
    repStatsMap[rep.id] = {
      id: rep.id,
      name: rep.name,
      callCount: 0,
      avgScore: null,
      flaggedCount: 0,
    };
  });
  
  const allScores: number[] = [];
  const allStrengths: string[] = [];
  const allImprovements: string[] = [];
  
  callsWithData?.forEach((call: any) => {
    const scores = call.call_scores;
    if (!scores) return;
    
    const scoreValues = [
      scores.opening_score, scores.discovery_score, scores.rapport_score,
      scores.objection_handling_score, scores.closing_score, scores.structure_score,
      scores.product_knowledge_score,
    ].filter((s: number | null): s is number => s !== null && s !== undefined);
    
    if (scoreValues.length === 0) return;
    
    const callAvg = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
    allScores.push(callAvg);
    
    // Parse strengths/improvements
    if (scores.strengths) {
      const s = typeof scores.strengths === 'string' ? JSON.parse(scores.strengths) : scores.strengths;
      if (Array.isArray(s)) allStrengths.push(...s);
    }
    if (scores.improvements) {
      const i = typeof scores.improvements === 'string' ? JSON.parse(scores.improvements) : scores.improvements;
      if (Array.isArray(i)) allImprovements.push(...i);
    }
    
    // Update rep stats
    const repId = call.rep_id;
    if (repId && repStatsMap[repId]) {
      const rep = repStatsMap[repId];
      rep.callCount++;
      
      // Calculate running average
      if (rep.avgScore === null) {
        rep.avgScore = callAvg;
      } else {
        rep.avgScore = (rep.avgScore * (rep.callCount - 1) + callAvg) / rep.callCount;
      }
      
      if (flagSet.has(call.id)) {
        rep.flaggedCount++;
      }
    }
  });
  
  const overallAvg = allScores.length > 0 
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
    : null;
  
  const leaderboard = Object.values(repStatsMap)
    .filter(r => r.callCount > 0)
    .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
  
  const categoryScores = {
    Opening: calculateCategoryAvg(callsWithData, 'opening_score'),
    Discovery: calculateCategoryAvg(callsWithData, 'discovery_score'),
    Rapport: calculateCategoryAvg(callsWithData, 'rapport_score'),
    'Objection Handling': calculateCategoryAvg(callsWithData, 'objection_handling_score'),
    Closing: calculateCategoryAvg(callsWithData, 'closing_score'),
    Structure: calculateCategoryAvg(callsWithData, 'structure_score'),
    'Product Knowledge': calculateCategoryAvg(callsWithData, 'product_knowledge_score'),
  };
  
  const strengthCounts = countFrequency(allStrengths);
  const improvementCounts = countFrequency(allImprovements);
  
  const topStrengths = Object.entries(strengthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const topImprovements = Object.entries(improvementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const hasData = allScores.length > 0;
  const totalReps = Object.values(repStatsMap).filter(r => r.callCount > 0).length;
  const totalFlagged = Array.from(flagSet).filter(callId => 
    callsWithData?.some(c => c.id === callId)
  ).length;
  
  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Analysis</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">AI-powered insights and call scoring</p>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-4">
            <BarChart3 className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">No scored calls yet</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Send test webhooks to generate demo calls with scores.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Analysis</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Team performance and coaching insights</p>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          icon={<BarChart3 className="w-5 h-5" />}
          label="Team Average"
          value={overallAvg?.toFixed(1) || "-"}
          color={overallAvg && overallAvg >= 8 ? "green" : overallAvg && overallAvg < 7 ? "red" : "default"}
        />
        <KpiCard 
          icon={<Phone className="w-5 h-5" />}
          label="Scored Calls"
          value={allScores.length.toString()}
        />
        <KpiCard 
          icon={<Users className="w-5 h-5" />}
          label="Active Reps"
          value={totalReps.toString()}
        />
        <KpiCard 
          icon={<Flag className="w-5 h-5" />}
          label="Flagged"
          value={totalFlagged.toString()}
          color={totalFlagged > 0 ? "red" : "default"}
        />
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="xl:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Rep Leaderboard</h2>
            </div>
          </div>
          
          {leaderboard.length > 0 ? (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {leaderboard.map((rep, index) => (
                <div key={rep.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <RankBadge rank={index + 1} />
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">{rep.name}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{rep.callCount} calls</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {rep.flaggedCount > 0 && (
                      <span className="text-sm text-red-600 dark:text-red-400">{rep.flaggedCount} flagged</span>
                    )}
                    <ScoreBadge score={rep.avgScore} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
              No rep data available
            </div>
          )}
        </div>
        
        {/* Score Breakdown */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Score Breakdown</h2>
          </div>
          <div className="space-y-4">
            {Object.entries(categoryScores).map(([name, score]) => (
              <div key={name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{name}</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">{score?.toFixed(1) || "-"}</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full" 
                    style={{ width: score ? `${(score / 10) * 100}%` : "0%" }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-green-600 dark:text-green-400 mb-4">Top Strengths</h3>
          {topStrengths.length > 0 ? (
            <ul className="space-y-3">
              {topStrengths.map(([strength, count]) => (
                <li key={strength} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">{strength}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No data yet</p>
          )}
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-amber-600 dark:text-amber-400 mb-4">Areas for Improvement</h3>
          {topImprovements.length > 0 ? (
            <ul className="space-y-3">
              {topImprovements.map(([improvement, count]) => (
                <li key={improvement} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">{improvement}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color = "default" }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  color?: "green" | "red" | "default";
}) {
  const colorClasses = {
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
    default: "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white",
  };
  
  return (
    <div className={`p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2 text-zinc-500 dark:text-zinc-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = [
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  ];
  
  return (
    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${colors[Math.min(rank - 1, 3)]}`}>
      {rank}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-zinc-400">-</span>;
  
  const color = score >= 8 ? "text-green-600 dark:text-green-400" : score < 7 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white";
  
  return (
    <span className={`text-lg font-bold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function calculateCategoryAvg(calls: any[] | null, field: string): number | null {
  if (!calls) return null;
  const values = calls
    .map(c => c.call_scores?.[field])
    .filter((v): v is number => v !== null && v !== undefined);
  
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function countFrequency(items: string[]): Record<string, number> {
  return items.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
