import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
   role: "closer",
 });

 return NextResponse.json({ success: true });
}

