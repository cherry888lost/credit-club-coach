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
  
  if (!user.isOnboarded) {
    redirect("/onboarding");
  }
  
  return (
    <DashboardShell orgName={user.org?.name || "Organization"} userRole={user.rep?.role}>
      {children}
    </DashboardShell>
  );
}
