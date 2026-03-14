import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserWithRole();
  
  // Not authenticated - redirect to sign in
  if (!user?.userId) {
    redirect("/sign-in");
  }
  
  // Rep not found and couldn't be created
  if (!user.rep) {
    const isDuplicateError = user.error?.includes("23505") || user.error?.includes("duplicate");
    
    // If it's a duplicate error, the rep exists but we couldn't fetch it
    if (isDuplicateError) {
      console.log("[DashboardLayout] Duplicate key error - rep exists, retrying...");
      const retryUser = await getCurrentUserWithRole();
      if (retryUser?.rep) {
        return (
          <DashboardShell orgName="Credit Club Team" userRole={retryUser.rep.role} isAdmin={retryUser.isAdminUser}>
            {children}
          </DashboardShell>
        );
      }
    }
    
    // Show error UI
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-900 p-6">
          <h1 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Account Setup Error</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">There was a problem loading your account:</p>
          <pre className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded text-xs text-zinc-700 dark:text-zinc-300 overflow-auto mb-4">{user.error}</pre>
          <div className="flex gap-3">
            <a href="/dashboard" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Retry</a>
            <a href="/sign-in" className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium">Sign Out</a>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <DashboardShell orgName="Credit Club Team" userRole={user.rep.role} isAdmin={user.isAdminUser}>
      {children}
    </DashboardShell>
  );
}
