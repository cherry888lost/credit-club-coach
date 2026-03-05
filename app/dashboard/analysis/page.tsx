import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AnalysisPage() {
  const user = await getCurrentUser();
  
  if (!user.isOnboarded) {
    return null;
  }
  
  const supabase = await createClient();
  const orgId = user.org?.id;
  
  // Fetch all calls with scores for this org
  const { data: callsWithScores, error } = await supabase
    .from("calls")
    .select("*, call_scores(*), reps(name)")
    .eq("org_id", orgId)
    .not("call_scores", "is", null);
  
  if (error) {
    console.error("Error fetching calls:", error);
  }
  
  // Calculate average scores across all calls
  const allScores = (callsWithScores || []).map(call => call.call_scores).filter(Boolean);
  
  const avgScores = {
    opening: calculateAvg(allScores.map(s => s?.opening_score)),
    discovery: calculateAvg(allScores.map(s => s?.discovery_score)),
    rapport: calculateAvg(allScores.map(s => s?.rapport_score)),
    objection_handling: calculateAvg(allScores.map(s => s?.objection_handling_score)),
    closing: calculateAvg(allScores.map(s => s?.closing_score)),
    structure: calculateAvg(allScores.map(s => s?.structure_score)),
    product_knowledge: calculateAvg(allScores.map(s => s?.product_knowledge_score)),
  };
  
  const overallAvg = calculateAvg([
    avgScores.opening,
    avgScores.discovery,
    avgScores.rapport,
    avgScores.objection_handling,
    avgScores.closing,
    avgScores.structure,
    avgScores.product_knowledge,
  ].filter((s): s is number => s !== null));
  
  // Collect all strengths and improvements
  const allStrengths: string[] = [];
  const allImprovements: string[] = [];
  
  allScores.forEach(score => {
    if (score?.strengths) {
      allStrengths.push(...score.strengths);
    }
    if (score?.improvements) {
      allImprovements.push(...score.improvements);
    }
  });
  
  // Count frequency
  const strengthCounts = countFrequency(allStrengths);
  const improvementCounts = countFrequency(allImprovements);
  
  // Get top 5
  const topStrengths = Object.entries(strengthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const topImprovements = Object.entries(improvementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // Build leaderboard
  const repScores: Record<string, { name: string; scores: number[]; count: number }> = {};
  
  (callsWithScores || []).forEach(call => {
    const repName = call.reps?.name || "Unknown";
    if (!repScores[repName]) {
      repScores[repName] = { name: repName, scores: [], count: 0 };
    }
    
    const callScores = [
      call.call_scores?.opening_score,
      call.call_scores?.discovery_score,
      call.call_scores?.rapport_score,
      call.call_scores?.objection_handling_score,
      call.call_scores?.closing_score,
      call.call_scores?.structure_score,
      call.call_scores?.product_knowledge_score,
    ].filter((s): s is number => s !== null);
    
    if (callScores.length > 0) {
      const callAvg = callScores.reduce((a, b) => a + b, 0) / callScores.length;
      repScores[repName].scores.push(callAvg);
      repScores[repName].count++;
    }
  });
  
  const leaderboard = Object.values(repScores)
    .map(rep => ({
      ...rep,
      avgScore: rep.scores.length > 0 
        ? rep.scores.reduce((a, b) => a + b, 0) / rep.scores.length 
        : 0
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
  
  const scoreCategories = [
    { name: "Opening", score: avgScores.opening },
    { name: "Discovery", score: avgScores.discovery },
    { name: "Rapport Building", score: avgScores.rapport },
    { name: "Objection Handling", score: avgScores.objection_handling },
    { name: "Closing", score: avgScores.closing },
    { name: "Structure", score: avgScores.structure },
    { name: "Product Knowledge", score: avgScores.product_knowledge },
  ];
  
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          Analysis
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          AI-powered insights and call scoring
        </p>
      </div>
      
      {/* Overall score card */}
      {overallAvg !== null && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <span className={`
                text-5xl font-bold
                ${overallAvg >= 8 
                  ? "text-green-600 dark:text-green-400" 
                  : overallAvg >= 6
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-red-600 dark:text-red-400"
                }
              `}>
                {overallAvg.toFixed(1)}
              </span>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Team Average
              </p>
            </div>            
            <div className="flex-1">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Based on {allScores.length} scored calls across {Object.keys(repScores).length} reps
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Score breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">
            Score Breakdown
          </h3>
          <div className="space-y-4">
            {scoreCategories.map((category) => (
              <div key={category.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{category.name}</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {category.score?.toFixed(1) || "-"}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: category.score ? `${(category.score / 10) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Top Strengths */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-medium text-green-600 dark:text-green-400 mb-4">
              Top Strengths
            </h3>
            {topStrengths.length > 0 ? (
              <ul className="space-y-2">
                {topStrengths.map(([strength, count]) => (
                  <li key={strength} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                    <span>{strength}</span>
                    <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                      {count} calls
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                No strengths data yet
              </p>
            )}
          </div>

          {/* Areas for Improvement */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-medium text-amber-600 dark:text-amber-400 mb-4">
              Common Improvements
            </h3>
            {topImprovements.length > 0 ? (
              <ul className="space-y-2">
                {topImprovements.map(([improvement, count]) => (
                  <li key={improvement} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                    <span>{improvement}</span>
                    <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                      {count} calls
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                No improvement data yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
            Rep Leaderboard
          </h2>
        </div>
        
        {leaderboard.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {leaderboard.map((rep, index) => (
              <div 
                key={rep.name}
                className="flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-4">
                  <span className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${index === 0 
                      ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : index === 1
                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                      : index === 2
                      ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                    }
                  `}>
                    {index + 1}
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {rep.name}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {rep.count} calls
                  </span>
                  <span className={`
                    text-lg font-semibold w-16 text-right
                    ${rep.avgScore >= 8 
                      ? "text-green-600 dark:text-green-400" 
                      : rep.avgScore >= 6
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                    }
                  `}>
                    {rep.avgScore.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              Leaderboard will populate once calls are scored.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateAvg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function countFrequency(items: string[]): Record<string, number> {
  return items.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
