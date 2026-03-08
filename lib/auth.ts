import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "./supabase/server";
import type { Rep } from "@/types";

// Fixed internal workspace for single-tenant setup
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Get or create a rep record for the current Clerk user.
 * Uses service role for all DB operations to ensure consistency.
 */
async function getOrCreateRep(userId: string, email: string, name: string): Promise<{ rep: Rep | null; error: string | null }> {
  console.log(`[getOrCreateRep] START userId=${userId}`);
  
  try {
    // Use SERVICE ROLE for everything to avoid RLS issues
    const serviceSupabase = await createServiceClient();
    
    // Step 1: Check if rep already exists
    console.log(`[getOrCreateRep] Checking for existing rep...`);
    const { data: existingRep } = await serviceSupabase
      .from("reps")
      .select("*")
      .eq("clerk_user_id", userId)
      .single();
    
    if (existingRep) {
      console.log(`[getOrCreateRep] FOUND existing rep: ${existingRep.id}`);
      return { rep: existingRep as Rep, error: null };
    }
    
    console.log(`[getOrCreateRep] No existing rep found, creating new one...`);
    
    // Step 2: Determine role (first user = admin)
    const { count: repCount } = await serviceSupabase
      .from("reps")
      .select("*", { count: "exact", head: true });
    
    const role = repCount === 0 ? "admin" : "closer";
    
    // Step 3: Create new rep
    const insertPayload = {
      org_id: DEFAULT_ORG_ID,
      clerk_user_id: userId,
      email,
      name,
      role,
      status: "active",
    };
    
    console.log(`[getOrCreateRep] Creating rep with role=${role}...`);
    
    const { data: newRep, error: insertError } = await serviceSupabase
      .from("reps")
      .insert(insertPayload)
      .select()
      .single();
    
    if (insertError) {
      // If unique violation, fetch the existing rep (race condition)
      if (insertError.code === "23505") {
        console.log(`[getOrCreateRep] 23505 conflict - fetching existing rep...`);
        const { data: raceRep } = await serviceSupabase
          .from("reps")
          .select("*")
          .eq("clerk_user_id", userId)
          .single();
        
        if (raceRep) {
          console.log(`[getOrCreateRep] Found rep after 23505: ${raceRep.id}`);
          return { rep: raceRep as Rep, error: null };
        }
      }
      
      console.error(`[getOrCreateRep] INSERT ERROR:`, insertError);
      return { 
        rep: null, 
        error: `Database error: ${insertError.message}` 
      };
    }
    
    console.log(`[getOrCreateRep] CREATED new rep: ${newRep?.id}`);
    return { rep: newRep as Rep, error: null };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[getOrCreateRep] EXCEPTION:`, error);
    return { rep: null, error: errorMsg };
  }
}

export async function getCurrentUser() {
  const { userId } = await auth();
  
  if (!userId) return null;
  
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  
  const email = clerkUser.emailAddresses[0]?.emailAddress || "";
  const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
  
  const { rep, error } = await getOrCreateRep(userId, email, name);
  
  if (!rep) {
    return {
      userId,
      rep: null,
      orgId: DEFAULT_ORG_ID,
      isOnboarded: false,
      error: error || "Failed to load user profile",
    };
  }
  
  return {
    userId,
    rep,
    orgId: DEFAULT_ORG_ID,
    isOnboarded: true,
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user?.userId) throw new Error("Unauthorized");
  return user;
}

export async function getDefaultOrgId(): Promise<string> {
  return DEFAULT_ORG_ID;
}

export async function requireOnboarding() {
  return requireAuth();
}
