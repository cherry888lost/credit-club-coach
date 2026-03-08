import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // No onboarding redirect - users go straight to dashboard
  // Rep records are auto-created in getCurrentUser()
  
  return (
    <DashboardShell orgName={user.org?.name || "Credit Club Team"} userRole={user.rep?.role}>
      {children}
    </DashboardShell>
  );
}
