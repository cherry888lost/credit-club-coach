import { redirect } from "next/navigation";

// Onboarding is disabled - app is single-tenant
// Users are auto-created on first sign-in
export default async function OnboardingPage() {
  redirect("/dashboard");
}
