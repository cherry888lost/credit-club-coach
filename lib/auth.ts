import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "./supabase/server";
import type { Rep, RepRole } from "@/types";

export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface CurrentUser {
  userId: string;
  email: string;
  rep: Rep | null;
  orgId: string;
  isOnboarded: boolean;
  error?: string;
  /** Why user was blocked — used by middleware/layout for redirects */
  blocked?: 'no_rep' | 'disabled' | 'invited' | 'clerk_mismatch';
}

/**
 * Look up existing rep by Clerk user ID or email.
 * NEVER creates a new rep — invite-only system.
 */
async function findRep(
  userId: string,
  email: string
): Promise<{ rep: Rep | null; blocked?: CurrentUser['blocked']; error: string | null }> {
  try {
    const supabase = await createServiceClient();

    // 1. Try by clerk_user_id first (already linked)
    const { data: byClerk } = await supabase
      .from("reps")
      .select("*")
      .eq("clerk_user_id", userId)
      .single();

    if (byClerk) {
      const rep = byClerk as Rep;
      if (rep.status === 'disabled') return { rep, blocked: 'disabled', error: null };
      if (rep.status === 'invited') return { rep, blocked: 'invited', error: null };
      return { rep, error: null };
    }

    // 2. Try by email (case-insensitive) — for pre-invited reps
    if (email) {
      const { data: byEmail } = await supabase
        .from("reps")
        .select("*")
        .ilike("email", email)
        .single();

      if (byEmail) {
        const rep = byEmail as Rep;

        // If this rep already has a different clerk_user_id, block (account takeover)
        if (rep.clerk_user_id && rep.clerk_user_id !== userId) {
          return { rep: null, blocked: 'clerk_mismatch', error: "Account already linked to different user" };
        }

        if (rep.status === 'disabled') return { rep, blocked: 'disabled', error: null };

        // If invited, link the Clerk ID but keep invited status
        if (rep.status === 'invited') {
          await supabase
            .from("reps")
            .update({ clerk_user_id: userId })
            .eq("id", rep.id);
          return { rep: { ...rep, clerk_user_id: userId }, blocked: 'invited', error: null };
        }

        // Active rep without clerk_user_id — link it
        if (!rep.clerk_user_id) {
          const { data: linked } = await supabase
            .from("reps")
            .update({ clerk_user_id: userId, accepted_at: rep.accepted_at || new Date().toISOString() })
            .eq("id", rep.id)
            .select()
            .single();

          if (linked) return { rep: linked as Rep, error: null };
        }

        return { rep, error: null };
      }
    }

    // 3. No rep found — user is not invited
    return { rep: null, blocked: 'no_rep', error: null };
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

  const { rep, blocked, error } = await findRep(userId, email);

  if (!rep) {
    return {
      userId,
      email,
      rep: null,
      orgId: DEFAULT_ORG_ID,
      isOnboarded: false,
      blocked: blocked || 'no_rep',
      error: error || undefined,
    };
  }

  return {
    userId,
    email,
    rep,
    orgId: DEFAULT_ORG_ID,
    isOnboarded: rep.status === 'active',
    blocked,
  };
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.userId) throw new Error("Unauthorized");
  if (user.blocked) throw new Error(`Access denied: ${user.blocked}`);
  if (!user.rep || user.rep.status !== 'active') throw new Error("No active account");
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
 */
export function isAdmin(user: CurrentUser | null): boolean {
  if (!user?.rep) return false;
  return user.rep.role === "admin";
}

/**
 * Check if user is a regular sales rep — i.e. NOT admin.
 */
export function isSalesRep(user: CurrentUser | null): boolean {
  if (!user?.rep) return false;
  return !isAdmin(user);
}

/**
 * Get current user with role helpers pre-computed.
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
