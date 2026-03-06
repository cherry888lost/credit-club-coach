import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  // Check if user has a rep record
  const supabase = await createClient();
  
  const { data: rep } = await supabase
    .from("reps")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();
  
  if (!rep) {
    // User is authenticated but hasn't onboarded
    redirect("/onboarding");
  }
  
  redirect("/dashboard");
}