import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();
  
  // If user is signed in, go straight to dashboard
  if (userId) {
    redirect("/dashboard");
  }
  
  // Otherwise show sign-in link
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>Credit Club Coach</h1>
      <p>App is loading. Environment check:</p>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'}</li>
        <li>NEXT_PUBLIC_SUPABASE_PROJECT_URL: {process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ? '✅' : '❌'}</li>
        <li>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? '✅' : '❌'}</li>
      </ul>
      <a href="/sign-in" style={{ color: 'blue' }}>Go to Sign In</a>
    </div>
  );
}
