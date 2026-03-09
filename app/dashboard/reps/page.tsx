import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { Users, UserCheck, Crown, BarChart3, Flag } from "lucide-react";

interface RepWithStats {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  callCount: number;
  avgScore: number | null;
  flaggedCount: number;
}

export default async function RepsPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  // Get all reps
  const { data: reps, error } = await supabase
    .from("reps")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching reps:", error);
  }
  
  // Get all calls with scores
  const { data: callsWithScores } = await supabase
    .from("calls")
    .select("id, rep_id, call_scores(opening_score, discovery_score, rapport_score, objection_handling_score, closing_score, structure_score, product_knowledge_score)")
    .eq("org_id", orgId);
  
  // Get all flags
  const { data: flags } = await supabase
    .from("flags")
    .select("call_id, call:calls(rep_id)")
    .eq("org_id", orgId);
  
  // Calculate stats per rep
  const repStats: Record<string, { 
    callCount: number; 
    totalScore: number; 
    scoredCalls: number;
    flaggedCount: number;
  }> = {};
  
  // Initialize stats for all reps
  reps?.forEach(rep => {
    repStats[rep.id] = { callCount: 0, totalScore: 0, scoredCalls: 0, flaggedCount: 0 };
  });
  
  // Count calls per rep
  callsWithScores?.forEach((call: any) => {
    const repId = call.rep_id;
    if (repId && repStats[repId]) {
      repStats[repId].callCount++;
      
      // Calculate average score for this call
      if (call.call_scores) {
        const scores = [
          call.call_scores.opening_score,
          call.call_scores.discovery_score,
          call.call_scores.rapport_score,
          call.call_scores.objection_handling_score,
          call.call_scores.closing_score,
          call.call_scores.structure_score,
          call.call_scores.product_knowledge_score,
        ].filter((s: number | null) => s !== null) as number[];
        
        if (scores.length > 0) {
          const callAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
          repStats[repId].totalScore += callAvg;
          repStats[repId].scoredCalls++;
        }
      }
    }
  });
  
  // Count flags per rep
  flags?.forEach((flag: any) => {
    const repId = flag.call?.rep_id;
    if (repId && repStats[repId]) {
      repStats[repId].flaggedCount++;
    }
  });
  
  // Build final rep list with stats
  const repsWithStats: RepWithStats[] = (reps || []).map(rep => ({
    ...rep,
    callCount: repStats[rep.id]?.callCount || 0,
    avgScore: repStats[rep.id]?.scoredCalls > 0 
      ? Math.round((repStats[rep.id].totalScore / repStats[rep.id].scoredCalls) * 10) / 10 
      : null,
    flaggedCount: repStats[rep.id]?.flaggedCount || 0,
  }));
  
  const otherReps = repsWithStats.filter(r => r.id !== user?.rep?.id);
  const currentUserStats = repsWithStats.find(r => r.id === user?.rep?.id);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Reps</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Team performance and call statistics</p>
        </div>
      </div>

      {/* Current User Stats */}
      {currentUserStats && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Your Performance</h2>
          </div>
          
          <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <span className="text-indigo-600 dark:text-indigo-400 font-medium text-lg">{currentUserStats.name.split(" ").map(n => n[0]).join("").toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-zinc-900 dark:text-white text-lg">{currentUserStats.name}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{currentUserStats.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 text-sm font-medium rounded-full capitalize ${currentUserStats.role === "admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : currentUserStats.role === "manager" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {currentUserStats.role === "admin" && <Crown className="w-3.5 h-3.5 inline mr-1" />}
                {currentUserStats.role}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <StatBox icon={<BarChart3 className="w-4 h-4" />} label="Calls" value={currentUserStats.callCount.toString()} />
            <StatBox 
              icon={<BarChart3 className="w-4 h-4" />} 
              label="Avg Score" 
              value={currentUserStats.avgScore?.toFixed(1) || "-"} 
              highlight={currentUserStats.avgScore && currentUserStats.avgScore >= 8 ? "green" : currentUserStats.avgScore && currentUserStats.avgScore < 7 ? "red" : undefined}
            />
            <StatBox 
              icon={<Flag className="w-4 h-4" />} 
              label="Flagged" 
              value={currentUserStats.flaggedCount.toString()}
              highlight={currentUserStats.flaggedCount > 0 ? "red" : undefined}
            />
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Team Members</h2>
            <span className="ml-auto text-sm text-zinc-500 dark:text-zinc-400">{otherReps.length + 1} total</span>
          </div>
        </div>
        
        {repsWithStats.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {repsWithStats.map((rep) => (
              <div key={rep.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">{rep.name.split(" ").map(n => n[0]).join("").toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">{rep.name}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{rep.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${rep.role === "admin" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : rep.role === "manager" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>{rep.role}</span>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${rep.status === "active" ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>{rep.status}</span>
                    {rep.id === user?.rep?.id && <span className="text-xs text-indigo-600 dark:text-indigo-400">You</span>}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 ml-14">
                  <div className="text-center p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <p className="text-lg font-semibold text-zinc-900 dark:text-white">{rep.callCount}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Calls</p>
                  </div>
                  <div className="text-center p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <p className={`text-lg font-semibold ${rep.avgScore && rep.avgScore >= 8 ? "text-green-600 dark:text-green-400" : rep.avgScore && rep.avgScore < 7 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white"}`}>
                      {rep.avgScore?.toFixed(1) || "-"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Score</p>
                  </div>
                  <div className="text-center p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <p className={`text-lg font-semibold ${rep.flaggedCount > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white"}`}>
                      {rep.flaggedCount}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Flagged</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">No team members found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: "green" | "red" }) {
  const highlightClass = highlight === "green" 
    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" 
    : highlight === "red"
    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
    : "bg-zinc-50 dark:bg-zinc-800/50";
  
  return (
    <div className={`text-center p-3 rounded-lg ${highlightClass}`}>
      <div className="flex items-center justify-center gap-1 mb-1 text-zinc-500 dark:text-zinc-400">
        {icon}
      </div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
