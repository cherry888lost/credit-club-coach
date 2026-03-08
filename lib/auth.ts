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
  const { data: org, error: fetchError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", DEFAULT_ORG_ID)
    .single();
  
  if (org) {
    return org;
  }
  
  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is expected if org doesn't exist
    console.error("[getOrCreateDefaultOrg] Fetch error:", fetchError);
  }
  
  // Create default org if not exists
  const { data: newOrg, error: insertError } = await supabase
    .from("organizations")
    .insert({
      id: DEFAULT_ORG_ID,
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
      settings: {},
    })
    .select()
    .single();
  
  if (insertError) {
    // If unique violation, org was created by another request - fetch it
    if (insertError.code === "23505") {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", DEFAULT_ORG_ID)
        .single();
      if (existingOrg) return existingOrg;
    }
    console.error("[getOrCreateDefaultOrg] Insert error:", insertError);
    throw new Error("Failed to initialize workspace: " + insertError.message);
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
  const { data: existingRep, error: fetchError } = await supabase
    .from("reps")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();
  
  if (existingRep) {
    return existingRep as Rep;
  }
  
  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[getOrCreateRep] Fetch error:", fetchError);
  }
  
  // Get or create default org
  const org = await getOrCreateDefaultOrg();
  
  // Check if this is the first user (no other reps exist)
  const { count: repCount, error: countError } = await supabase
    .from("reps")
    .select("*", { count: "exact", head: true });
  
  if (countError) {
    console.error("[getOrCreateRep] Count error:", countError);
  }
  
  // First user becomes admin, others default to closer
  const role = repCount === 0 ? "admin" : "closer";
  
  console.log(`[getOrCreateRep] Creating new rep: ${email} with role: ${role}`);
  
  // Create new rep
  const { data: newRep, error: insertError } = await supabase
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
  
  if (insertError) {
    // If unique violation, rep was created by another request - fetch it
    if (insertError.code === "23505") {
      const { data: raceRep } = await supabase
        .from("reps")
        .select("*")
        .eq("clerk_user_id", userId)
        .single();
      if (raceRep) return raceRep as Rep;
    }
    console.error("[getOrCreateRep] Insert error:", insertError);
    throw new Error("Failed to create user record: " + insertError.message);
  }
  
  console.log(`[getOrCreateRep] Created rep: ${newRep?.id}`);
  return newRep as Rep;
}

export async function getCurrentUser() {
  const { userId } = await auth();
  
  console.log("[getCurrentUser] userId from Clerk:", userId);
  
  if (!userId) {
    console.log("[getCurrentUser] No userId, returning null");
    return null;
  }
  
  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    console.log("[getCurrentUser] No clerkUser, returning null");
    return null;
  }
  
  const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress || "";
  const fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
  
  console.log(`[getCurrentUser] Clerk user: ${primaryEmail}, ${fullName}`);
  
  try {
    // Auto-create rep if missing (no onboarding required)
    const rep = await getOrCreateRep(userId, primaryEmail, fullName);
    const org = await getOrCreateDefaultOrg();
    
    console.log("[getCurrentUser] Success - rep:", rep.id, "role:", rep.role);
    
    return {
      userId,
      rep,
      org,
      isOnboarded: true,
    };
  } catch (error) {
    console.error("[getCurrentUser] Error creating rep:", error);
    // Return user info even if rep creation fails - don't redirect to sign-in
    // This prevents the redirect loop
    return {
      userId,
      rep: null,
      org: null,
      isOnboarded: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user || !user.userId) {
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
