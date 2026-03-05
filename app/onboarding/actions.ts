"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createOrganization(formData: FormData) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }
  
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const userName = formData.get("userName") as string;
  
  if (!name || !email || !userName) {
    throw new Error("Missing required fields");
  }
  
  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  const supabase = await createClient();
  
  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug,
      settings: {},
    })
    .select()
    .single();
  
  if (orgError) {
    console.error("Org creation error:", orgError);
    throw new Error("Failed to create organization: " + orgError.message);
  }
  
  // Create rep (admin)
  const { error: repError } = await supabase
    .from("reps")
    .insert({
      org_id: org.id,
      clerk_user_id: userId,
      email,
      name: userName,
      role: "admin",
      status: "active",
    });
  
  if (repError) {
    console.error("Rep creation error:", repError);
    throw new Error("Failed to create user record: " + repError.message);
  }
  
  redirect("/dashboard");
}
