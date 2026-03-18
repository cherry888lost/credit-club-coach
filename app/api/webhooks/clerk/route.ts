import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("Missing Supabase URL: Set NEXT_PUBLIC_SUPABASE_PROJECT_URL or NEXT_PUBLIC_SUPABASE_URL");
}

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Clerk webhook handler.
 * 
 * INVITE-ONLY: We do NOT auto-create reps here.
 * We only update existing reps if their Clerk user info changes.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const eventType = body.type;
  const { id, email_addresses, first_name, last_name } = body.data;
  const email = email_addresses?.[0]?.email_address?.toLowerCase();

  console.log(`[CLERK_WEBHOOK] Event: ${eventType}, user: ${id}, email: ${email}`);

  if (!email) {
    return NextResponse.json({ success: true, skipped: "no email" });
  }

  switch (eventType) {
    case "user.created":
      // DO NOT auto-create reps. Invite-only system.
      // Just log it for debugging.
      console.log(`[CLERK_WEBHOOK] New Clerk user ${email} — NOT auto-creating rep (invite-only)`);
      break;

    case "user.updated":
      // If user's name changed, update the rep record (if it exists)
      const name = `${first_name ?? ""} ${last_name ?? ""}`.trim();
      if (name) {
        await supabase
          .from("reps")
          .update({ name })
          .eq("clerk_user_id", id);
      }
      break;

    case "user.deleted":
      // When a Clerk user is deleted, disable their rep (don't delete data)
      await supabase
        .from("reps")
        .update({ status: "disabled", clerk_user_id: null })
        .eq("clerk_user_id", id);
      break;
  }

  return NextResponse.json({ success: true });
}
