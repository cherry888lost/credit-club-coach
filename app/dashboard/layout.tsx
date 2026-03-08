import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  console.log("[DashboardLayout] userId:", user?.userId, "hasRep:", !!user?.rep, "error:", (user as any)?.error);
  
  // Only redirect to sign-in if user is not authenticated with Clerk
  if (!user || !user.userId) {
    console.log("[DashboardLayout] No authenticated user, redirecting to sign-in");
    redirect("/sign-in");
  }
  
  // If rep creation failed, show error UI instead of redirecting
  if (!user.rep) {
    const errorMsg = (user as any).error || "Failed to load user profile";
    console.log("[DashboardLayout] No rep found, showing error:", errorMsg);
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-900 p-6">
          <h1 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
            Setup Error
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            There was a problem setting up your account:
          </p>
          <pre className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded text-xs text-zinc-700 dark:text-zinc-300 overflow-auto">
            {errorMsg}
          </pre>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Try refreshing the page. If the problem persists, contact support.
          </p>
          <div className="mt-4 flex gap-3">
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
