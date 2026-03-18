import { redirect } from "next/navigation";

// Onboarding is disabled — invite-only system
// Users must be invited by an admin before they can access the dashboard
export default async function OnboardingPage() {
  redirect("/dashboard");
}
