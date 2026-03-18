import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import AcceptInviteClient from "./AcceptInviteClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token;

  // No token provided
  if (!token) {
    return <AcceptInviteClient status="no_token" />;
  }

  // Look up the invite
  const supabase = await createServiceClient();
  const { data: rep } = await supabase
    .from("reps")
    .select("*")
    .eq("invite_token", token)
    .single();

  if (!rep) {
    return <AcceptInviteClient status="invalid" />;
  }

  // Check expiry
  if (rep.invite_expires_at && new Date(rep.invite_expires_at) < new Date()) {
    return <AcceptInviteClient status="expired" />;
  }

  // Check if already accepted
  if (rep.status === "active") {
    redirect("/dashboard");
  }

  // Check if user is signed in
  const { userId } = await auth();

  if (!userId) {
    // Not signed in — redirect to sign-in with return URL
    const returnUrl = `/accept-invite?token=${token}`;
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
  }

  // User is signed in — verify email matches
  const clerkUser = await currentUser();
  const userEmail = clerkUser?.emailAddresses[0]?.emailAddress?.toLowerCase();
  const repEmail = rep.email?.toLowerCase();

  if (userEmail !== repEmail) {
    return (
      <AcceptInviteClient
        status="email_mismatch"
        inviteEmail={rep.email}
        currentEmail={userEmail}
      />
    );
  }

  // Everything checks out — activate the rep
  const { error } = await supabase
    .from("reps")
    .update({
      status: "active",
      clerk_user_id: userId,
      accepted_at: new Date().toISOString(),
      invite_token: null,
      invite_expires_at: null,
    })
    .eq("id", rep.id);

  if (error) {
    console.error("[ACCEPT_INVITE] Error activating rep:", error);
    return <AcceptInviteClient status="error" />;
  }

  // Update invite_history
  await supabase
    .from("invite_history")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("rep_id", rep.id)
    .eq("status", "pending");

  redirect("/dashboard");
}
