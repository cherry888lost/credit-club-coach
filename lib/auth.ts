import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "./supabase/server";
import type { Rep, RepRole } from "@/types";

export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface CurrentUser {
  userId: string;
  rep: Rep | null;
  orgId: string;
  isOnboarded: boolean;
  error?: string;
}

/**
 * Get or create rep record for current Clerk user
 */
async function getOrCreateRep(
  userId: string, 
  email: string, 
  name: string
): Promise<{ rep: Rep | null; error: string | null }> {
  try {
    const supabase = await createServiceClient();
    
    // Check existing by clerk_user_id
    const { data: existing } = await supabase
      .from("reps")
      .select("*")
      .eq("clerk_user_id", userId)
      .single();
    
    if (existing) return { rep: existing as Rep, error: null };
    
    // Fallback: match by email for pre-created reps (e.g. added via admin before first login)
    if (email) {
      const { data: emailMatch } = await supabase
        .from("reps")
        .select("*")
        .eq("email", email.toLowerCase())
        .is("clerk_user_id", null)
        .single();
      
      if (emailMatch) {
        // Link the pre-created rep to this Clerk user
        const { data: linked, error: linkErr } = await supabase
          .from("reps")
          .update({ clerk_user_id: userId, name: name || emailMatch.name })
          .eq("id", emailMatch.id)
          .select()
          .single();
        
        if (linked) return { rep: linked as Rep, error: null };
        if (linkErr) console.error("[auth] Email match link failed:", linkErr.message);
      }
    }
    
    // First user = admin, others = closer
    const { count } = await supabase
      .from("reps")
      .select("*", { count: "exact", head: true });
    
    const role: RepRole = count === 0 ? "admin" : "member";
    
    const { data: newRep, error } = await supabase
      .from("reps")
      .insert({
        org_id: DEFAULT_ORG_ID,
        clerk_user_id: userId,
        email: email.toLowerCase(),
        name,
        role,
        status: "active",
      })
      .select()
      .single();
    
    if (error) {
      // Handle race condition
      if (error.code === "23505") {
        const { data: raceRep } = await supabase
          .from("reps")
          .select("*")
          .eq("clerk_user_id", userId)
          .single();
        if (raceRep) return { rep: raceRep as Rep, error: null };
      }
      return { rep: null, error: error.message };
    }
    
    return { rep: newRep as Rep, error: null };
  } catch (err) {
    return { rep: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();
  if (!userId) return null;
  
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  
  const email = clerkUser.emailAddresses[0]?.emailAddress || "";
  const name = clerkUser.firstName && clerkUser.lastName 
    ? `${clerkUser.firstName} ${clerkUser.lastName}`
    : clerkUser.firstName || clerkUser.lastName || email.split("@")[0] || "User";
  
  const { rep, error } = await getOrCreateRep(userId, email, name);
  
  if (!rep) {
    return {
      userId,
      rep: null,
      orgId: DEFAULT_ORG_ID,
      isOnboarded: false,
      error: error || "Failed to create user record",
    };
  }
  
  return {
    userId,
    rep,
    orgId: DEFAULT_ORG_ID,
    isOnboarded: true,
  };
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.userId) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (!isAdmin(user)) throw new Error("Admin access required");
  return user;
}

export async function getDefaultOrgId(): Promise<string> {
  return DEFAULT_ORG_ID;
}

export async function requireOnboarding(): Promise<CurrentUser> {
  return requireAuth();
}

/**
 * Check if user has required role
 */
export function hasRole(user: CurrentUser | null, roles: RepRole[]): boolean {
  if (!user?.rep) return false;
  return roles.includes(user.rep.role);
}

/**
 * Check if user has full admin access.
 * role field: 'admin' | 'member'
 * sales_role field: 'closer' | 'sdr' | null (independent of admin status)
 */
export function isAdmin(user: CurrentUser | null): boolean {
  if (!user?.rep) return false;
  return user.rep.role === "admin";
}

/**
 * Check if user is a regular sales rep (closer or SDR) — i.e. NOT admin.
 */
export function isSalesRep(user: CurrentUser | null): boolean {
  if (!user?.rep) return false;
  return !isAdmin(user);
}

/**
 * Get current user with role helpers pre-computed.
 * Returns the user plus boolean flags for easy consumption.
 */
export async function getCurrentUserWithRole(): Promise<
  (CurrentUser & { isAdminUser: boolean; isSalesRepUser: boolean }) | null
> {
  const user = await getCurrentUser();
  if (!user) return null;
  return {
    ...user,
    isAdminUser: isAdmin(user),
    isSalesRepUser: isSalesRep(user),
  };
}
