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

export async function POST(req: Request) {
 const body = await req.json();

 const { id, email_addresses, first_name, last_name } = body.data;

 const email = email_addresses?.[0]?.email_address;

 await supabase.from("reps").upsert({
   clerk_user_id: id,
   email: email,
   name: `${first_name ?? ""} ${last_name ?? ""}`,
   role: "member",
 });

 return NextResponse.json({ success: true });
}

