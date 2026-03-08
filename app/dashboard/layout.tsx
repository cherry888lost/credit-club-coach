import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  console.log(`[DashboardLayout] userId=${user?.userId}, hasRep=${!!user?.rep}, error=${(user as any)?.error || 'none'}`);
  
  // Only redirect to sign-in if user is not authenticated with Clerk
  if (!user || !user.userId) {
    console.log(`[DashboardLayout] No authenticated user, redirecting to /sign-in`);
    redirect("/sign-in");
  }
  
  // If rep creation failed, show detailed error UI
  if (!user.rep) {
    const errorMsg = (user as any).error || "Unknown error";
    console.log(`[DashboardLayout] Rep creation failed, showing error: ${errorMsg}`);
    
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-red-600 dark:text-red-400">
              Account Setup Error
            </h1>
          </div>
          
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            There was a problem setting up your account:
          </p>
          
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 mb-4">
            <p className="text-sm font-mono text-red-700 dark:text-red-400 break-all">
              {errorMsg}
            </p>
          </div>
          
          <div className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <p><strong>Clerk User ID:</strong> {user.userId}</p>
            <p><strong>Possible causes:</strong></p>
            <ul className="list-disc ml-5 space-y-1">
              <li>SUPABASE_SERVICE_ROLE_KEY not set in environment</li>
              <li>Organization ID does not exist in database</li>
              <li>Required columns missing in reps table</li>
              <li>Foreign key constraint violation</li>
            </ul>
          </div>
          
          <div className="mt-6 flex gap-3">
            <a 
              href="/dashboard" 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              Retry
            </a>
            <a 
              href="/sign-in" 
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium"
            >
              Sign Out
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <DashboardShell orgName="Credit Club Team" userRole={user.rep.role}>
      {children}
    </DashboardShell>
  );
}
