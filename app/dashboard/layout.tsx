import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserWithRole();

  // Not authenticated — redirect to sign in
  if (!user?.userId) {
    redirect("/sign-in");
  }

  // Handle blocked states
  if (user.blocked === 'no_rep' || user.blocked === 'disabled' || user.blocked === 'clerk_mismatch') {
    redirect("/unauthorized");
  }

  if (user.blocked === 'invited') {
    // Rep exists but hasn't accepted invite yet
    const token = user.rep?.invite_token;
    if (token) {
      redirect(`/accept-invite?token=${token}`);
    }
    redirect("/accept-invite");
  }

  // Rep not found (shouldn't happen after above checks, but safety net)
  if (!user.rep || user.rep.status !== 'active') {
    redirect("/unauthorized");
  }

  return (
    <DashboardShell orgName="Credit Club Team" userRole={user.rep.role} isAdmin={user.isAdminUser}>
      {children}
    </DashboardShell>
  );
}
