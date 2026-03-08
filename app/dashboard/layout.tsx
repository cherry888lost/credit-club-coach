import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  console.log("[DashboardLayout] user:", user?.userId, "error:", (user as any)?.error);
  
  // Only redirect to sign-in if user is not authenticated with Clerk
  // If user is authenticated but rep creation failed, show error instead of looping
  if (!user || !user.userId) {
    console.log("[DashboardLayout] No authenticated user, redirecting to sign-in");
    redirect("/sign-in");
  }
  
  // If rep creation failed, show error UI instead of redirecting
  if ("error" in user && user.error) {
    console.log("[DashboardLayout] Rep creation error:", user.error);
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
            {user.error}
          </pre>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <DashboardShell orgName={user.org?.name || "Credit Club Team"} userRole={user.rep?.role}>
      {children}
    </DashboardShell>
  );
}
