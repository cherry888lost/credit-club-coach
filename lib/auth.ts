import { auth } from "@clerk/nextjs/server";
import { createClient } from "./supabase/server";
import type { Rep, Organization } from "@/types";

export async function getCurrentUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }
  
  const supabase = await createClient();
  
  // Get rep record with org
  const { data: rep, error } = await supabase
    .from("reps")
    .select("*, organizations(*)")
    .eq("clerk_user_id", userId)
    .single();
  
  if (error || !rep) {
    return {
      userId,
      rep: null,
      org: null,
      isOnboarded: false,
    };
  }
  
  return {
    userId,
    rep: rep as Rep,
    org: rep.organizations as Organization,
    isOnboarded: true,
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }
  
  return user;
}

export async function requireOnboarding() {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }
  
  if (!user.isOnboarded) {
    throw new Error("Onboarding required");
  }
  
  return user;
}
