import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Rep } from "@/types";
import AddRepButton from "./_components/AddRepButton";

export default async function RepsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }
  
  const supabase = await createClient();
  const orgId = await getDefaultOrgId();
  const isAdmin = user.rep?.role === "admin" || user.rep?.role === "manager";
  
  // Fetch reps
  const { data: reps, error } = await supabase
    .from("reps")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching reps:", error);
  }
  
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Reps
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage team members and view performance
          </p>
        </div>
        {isAdmin && <AddRepButton />}
      </div>

      {/* Reps list */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
            Team Members ({reps?.length || 0})
          </h2>
        </div>
        
        {reps && reps.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {reps.map((rep: Rep) => (
              <div 
                key={rep.id}
                className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      {rep.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {rep.name}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {rep.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`
                    px-2.5 py-1 text-xs font-medium rounded-full capitalize
                    ${rep.role === "admin" 
                      ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" 
                      : rep.role === "manager"
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }
                  `}>
                    {rep.role}
                  </span>
                  <span className={`
                    px-2.5 py-1 text-xs font-medium rounded-full capitalize
                    ${rep.status === "active" 
                      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                      : rep.status === "pending"
                      ? "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }
                  `}>
                    {rep.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              No reps found. {isAdmin && "Add your first team member to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
