import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { Rep } from "@/types";
import AddRepButton from "./_components/AddRepButton";
import { Users, UserCheck, Crown } from "lucide-react";

export default async function RepsPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  const isAdmin = user.rep.role === "admin" || user.rep.role === "manager";
  
  const { data: reps, error } = await supabase
    .from("reps")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching reps:", error);
  }
  
  // Get call counts per rep
  const { data: repStats } = await supabase
    .from("calls")
    .select("rep_id, count")
    .eq("org_id", orgId)
    .group("rep_id");
  
  const callCounts: Record<string, number> = {};
  repStats?.forEach((stat: any) => {
    callCounts[stat.rep_id] = parseInt(stat.count);
  });
  
  const otherReps = reps?.filter(r => r.clerk_user_id !== user.userId) || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Reps</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage team members and view performance</p>
        </div>
        {isAdmin && <AddRepButton />}
      </div>

      {/* Current User Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">You</h2>
        </div>
        <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <span className="text-indigo-600 dark:text-indigo-400 font-medium text-lg">{user.rep.name.split(" ").map(n => n[0]).join("").toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-zinc-900 dark:text-white text-lg">{user.rep.name}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.rep.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 text-sm font-medium rounded-full capitalize ${user.rep.role === "admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : user.rep.role === "manager" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"}`}>
              {user.rep.role === "admin" && <Crown className="w-3.5 h-3.5 inline mr-1" />}
              {user.rep.role}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{callCounts[user.rep.id] || 0} calls</span>
          </div>
        </div>
      </div>

      {/* Other Team Members */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Team Members</h2>
          </div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{otherReps.length} other{otherReps.length !== 1 ? 's' : ''}</span>
        </div>
        
        {otherReps.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {otherReps.map((rep: Rep) => (
              <div key={rep.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">{rep.name.split(" ").map(n => n[0]).join("").toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{rep.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{rep.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${rep.role === "admin" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : rep.role === "manager" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>{rep.role}</span>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${rep.status === "active" ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" : rep.status === "pending" ? "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>{rep.status}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{callCounts[rep.id] || 0} calls</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-4">
              <Users className="w-12 h-12" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">No other reps yet</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{isAdmin ? "You're the only team member. Add reps to start tracking everyone's calls." : "You're the only team member currently."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
