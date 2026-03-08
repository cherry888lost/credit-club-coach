import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "./supabase/server";
import type { Rep } from "@/types";

// Fixed internal workspace for single-tenant setup
// This org must already exist in the database
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Get or create a rep record for the current Clerk user.
 * Auto-creates rep on first sign-in with default role.
 * Uses service role client to bypass RLS for rep creation.
 */
async function getOrCreateRep(userId: string, email: string, name: string): Promise<{ rep: Rep | null; error: string | null }> {
  console.log(`[getOrCreateRep] START =========================`);
  console.log(`[getOrCreateRep] Input: userId=${userId}, email=${email}, name=${name}`);
  
  try {
    // Use regular client for reading (respects RLS)
    const supabase = await createClient();
    
    console.log(`[getOrCreateRep] Checking for existing rep with clerk_user_id=${userId}`);
    
    // Check if rep already exists
    const { data: existingRep, error: fetchError } = await supabase
      .from("reps")
      .select("*")
      .eq("clerk_user_id", userId)
      .single();
    
    if (existingRep) {
      console.log(`[getOrCreateRep] FOUND existing rep: id=${existingRep.id}, role=${existingRep.role}`);
      return { rep: existingRep as Rep, error: null };
    }
    
    if (fetchError && fetchError.code !== "PGRST116") {
      console.error(`[getOrCreateRep] Fetch error:`, fetchError);
    } else {
      console.log(`[getOrCreateRep] No existing rep found (PGRST116 = no rows)`);
    }
    
    // Check if this is the first user
    const { count: repCount, error: countError } = await supabase
      .from("reps")
      .select("*", { count: "exact", head: true });
    
    if (countError) {
      console.error(`[getOrCreateRep] Count error:`, countError);
    } else {
      console.log(`[getOrCreateRep] Total reps in system: ${repCount}`);
    }
    
    // First user becomes admin, others default to closer
    const role = repCount === 0 ? "admin" : "closer";
    const status = "active";
    
    // Prepare insert payload
    const insertPayload = {
      org_id: DEFAULT_ORG_ID,
      clerk_user_id: userId,
      email,
      name,
      role,
      status,
    };
    
    console.log(`[getOrCreateRep] INSERT payload:`, JSON.stringify(insertPayload, null, 2));
    
    // Use SERVICE ROLE client to bypass RLS for insert
    console.log(`[getOrCreateRep] Creating service client for insert...`);
    const serviceSupabase = await createServiceClient();
    
    console.log(`[getOrCreateRep] Executing INSERT...`);
    const { data: newRep, error: insertError } = await serviceSupabase
      .from("reps")
      .insert(insertPayload)
      .select()
      .single();
    
    if (insertError) {
      console.error(`[getOrCreateRep] INSERT ERROR:`, JSON.stringify(insertError, null, 2));
      
      // If unique violation, rep was created by another request
      if (insertError.code === "23505") {
        console.log(`[getOrCreateRep] Race condition (23505) - fetching existing rep`);
        const { data: raceRep } = await supabase
          .from("reps")
          .select("*")
          .eq("clerk_user_id", userId)
          .single();
        if (raceRep) {
          console.log(`[getOrCreateRep] Found rep after race: ${raceRep.id}`);
          return { rep: raceRep as Rep, error: null };
        }
      }
      
      return { 
        rep: null, 
        error: `Rep creation failed: ${insertError.code} - ${insertError.message}${insertError.details ? ` (details: ${insertError.details})` : ''}` 
      };
    }
    
    console.log(`[getOrCreateRep] SUCCESS: Created rep id=${newRep?.id}`);
    console.log(`[getOrCreateRep] END =========================`);
    
    return { rep: newRep as Rep, error: null };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[getOrCreateRep] EXCEPTION:`, error);
    return { rep: null, error: `Exception during rep creation: ${errorMsg}` };
  }
}

export async function getCurrentUser() {
  console.log(`[getCurrentUser] START =========================`);
  
  const { userId } = await auth();
  console.log(`[getCurrentUser] Clerk userId: ${userId || 'null'}`);
  
  if (!userId) {
    console.log(`[getCurrentUser] No userId - returning null`);
    return null;
  }
  
  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    console.log(`[getCurrentUser] No clerkUser - returning null`);
    return null;
  }
  
  const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress || "";
  const fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
  
  console.log(`[getCurrentUser] Clerk user: email=${primaryEmail}, name=${fullName}`);
  
  // Auto-create rep if missing
  const { rep, error: repError } = await getOrCreateRep(userId, primaryEmail, fullName);
  
  if (!rep) {
    console.error(`[getCurrentUser] FAILED to get/create rep: ${repError}`);
    return {
      userId,
      rep: null,
      orgId: DEFAULT_ORG_ID,
      isOnboarded: false,
      error: repError || "Unknown error creating user record",
    };
  }
  
  console.log(`[getCurrentUser] SUCCESS: rep=${rep.id}, role=${rep.role}`);
  console.log(`[getCurrentUser] END =========================`);
  
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
 */
export async function getDefaultOrgId(): Promise<string> {
  return DEFAULT_ORG_ID;
}

export async function requireOnboarding() {
  return requireAuth();
}
