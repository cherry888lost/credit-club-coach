"use server";

import { redirect } from "next/navigation";

// Onboarding actions are disabled — invite-only system
export async function createOrganization(formData: FormData) {
  redirect("/dashboard");
}
