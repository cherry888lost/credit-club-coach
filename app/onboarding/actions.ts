"use server";

import { redirect } from "next/navigation";

// Onboarding actions are disabled - app is single-tenant
// Users are auto-created on first sign-in via lib/auth.ts
export async function createOrganization(formData: FormData) {
  // No-op: redirect to dashboard
  redirect("/dashboard");
}
