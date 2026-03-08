import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LandingPage from "./_components/LandingPage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();
  
  // If authenticated, redirect to dashboard
  if (userId) {
    redirect("/dashboard");
  }
  
  // Otherwise show landing page
  return <LandingPage />;
}
