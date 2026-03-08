import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "./supabase/server";
import type { Rep } from "@/types";

// Fixed internal workspace for single-tenant setup
// This org must already exist in the database
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Get or create a rep record for the current Clerk user.
 * Auto-creates rep on first sign-in with default role.
 * Does NOT create organization - uses fixed org ID.
 */
async function getOrCreateRep(userId: string, email: string, name: string): Promise<Rep | null> {
  const supabase = await createClient();
  
  console.log(`[getOrCreateRep] Checking for existing rep: clerk_user_id=${userId}`);
  
  // Check if rep already exists
  const { data: existingRep, error: fetchError } = await supabase
    .from("reps")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();
  
  if (existingRep) {
    console.log(`[getOrCreateRep] Found existing rep: ${existingRep.id}, role=${existingRep.role}`);
    return existingRep as Rep;
  }
  
  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[getOrCreateRep] Fetch error:", fetchError);
  }
  
  console.log(`[getOrCreateRep] No existing rep found, creating new one`);
  
  // Check if this is the first user (no other reps exist)
  const { count: repCount, error: countError } = await supabase
    .from("reps")
    .select("*", { count: "exact", head: true });
  
  if (countError) {
    console.error("[getOrCreateRep] Count error:", countError);
  }
  
  // First user becomes admin, others default to closer
  const role = repCount === 0 ? "admin" : "closer";
  
  console.log(`[getOrCreateRep] Creating rep: email=${email}, role=${role}, org_id=${DEFAULT_ORG_ID}`);
  
  // Create new rep with fixed org ID (org must already exist)
  const { data: newRep, error: insertError } = await supabase
    .from("reps")
    .insert({
      org_id: DEFAULT_ORG_ID,
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
      console.log("[getOrCreateRep] Race condition - rep already exists, fetching");
      const { data: raceRep } = await supabase
        .from("reps")
        .select("*")
        .eq("clerk_user_id", userId)
        .single();
      if (raceRep) {
        console.log(`[getOrCreateRep] Found rep after race: ${raceRep.id}`);
        return raceRep as Rep;
      }
    }
    console.error("[getOrCreateRep] Insert error:", insertError);
    return null;
  }
  
  console.log(`[getOrCreateRep] Created rep: ${newRep?.id}`);
  return newRep as Rep;
}

export async function getCurrentUser() {
  const { userId } = await auth();
  
  console.log("[getCurrentUser] clerk userId:", userId);
  
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
  
  // Auto-create rep if missing (no onboarding required)
  const rep = await getOrCreateRep(userId, primaryEmail, fullName);
  
  if (!rep) {
    console.error("[getCurrentUser] Failed to get or create rep");
    return {
      userId,
      rep: null,
      orgId: DEFAULT_ORG_ID,
      isOnboarded: false,
      error: "Failed to create user record. Please try again.",
    };
  }
  
  console.log("[getCurrentUser] Success - rep:", rep.id, "role:", rep.role);
  
  return {
    userId,
    rep,
    orgId: DEFAULT_ORG_ID,
    isOnboarded: true,
  };
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
  return DEFAULT_ORG_ID;
}

/**
 * Legacy function - kept for compatibility.
 * All users are considered "onboarded" in single-tenant mode.
 */
export async function requireOnboarding() {
  return requireAuth();
}
