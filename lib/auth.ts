import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "./supabase/server";
import type { Rep } from "@/types";

// Fixed internal workspace for single-tenant setup
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_ORG_SLUG = "credit-club-internal";
const DEFAULT_ORG_NAME = "Credit Club Team";

/**
 * Get or create the default organization for single-tenant mode.
 * This ensures we have a consistent org record without requiring onboarding.
 */
async function getOrCreateDefaultOrg() {
  const supabase = await createClient();
  
  // Try to get existing org
  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", DEFAULT_ORG_ID)
    .single();
  
  if (org) {
    return org;
  }
  
  // Create default org if not exists
  const { data: newOrg, error } = await supabase
    .from("organizations")
    .insert({
      id: DEFAULT_ORG_ID,
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
      settings: {},
    })
    .select()
    .single();
  
  if (error) {
    console.error("Failed to create default org:", error);
    throw new Error("Failed to initialize workspace");
  }
  
  return newOrg;
}

/**
 * Get or create a rep record for the current Clerk user.
 * Auto-creates rep on first sign-in with default role.
 */
async function getOrCreateRep(userId: string, email: string, name: string): Promise<Rep> {
  const supabase = await createClient();
  
  // Check if rep already exists
  const { data: existingRep } = await supabase
    .from("reps")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();
  
  if (existingRep) {
    return existingRep as Rep;
  }
  
  // Get or create default org
  const org = await getOrCreateDefaultOrg();
  
  // Check if this is the first user (no other reps exist)
  const { count: repCount } = await supabase
    .from("reps")
    .select("*", { count: "exact", head: true });
  
  // First user becomes admin, others default to closer
  const role = repCount === 0 ? "admin" : "closer";
  
  // Create new rep
  const { data: newRep, error } = await supabase
    .from("reps")
    .insert({
      org_id: org.id,
      clerk_user_id: userId,
      email,
      name,
      role,
      status: "active",
    })
    .select()
    .single();
  
  if (error) {
    console.error("Failed to create rep:", error);
    throw new Error("Failed to create user record: " + error.message);
  }
  
  return newRep as Rep;
}

export async function getCurrentUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }
  
  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    return null;
  }
  
  const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress || "";
  const fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
  
  try {
    // Auto-create rep if missing (no onboarding required)
    const rep = await getOrCreateRep(userId, primaryEmail, fullName);
    const org = await getOrCreateDefaultOrg();
    
    return {
      userId,
      rep,
      org,
      isOnboarded: true, // Always true in single-tenant mode
    };
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }
  
  return user;
}

/**
 * Get the default org ID for queries.
 * All data is scoped to this single organization.
 */
export async function getDefaultOrgId(): Promise<string> {
  const org = await getOrCreateDefaultOrg();
  return org.id;
}

/**
 * Legacy function - kept for compatibility.
 * All users are considered "onboarded" in single-tenant mode.
 */
export async function requireOnboarding() {
  return requireAuth();
}
