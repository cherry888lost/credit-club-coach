import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth";
import PatternsClient from "./PatternsClient";

export default async function PatternsPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !user.rep) {
    return null;
  }

  if (!user.isAdminUser) {
    redirect("/dashboard");
  }

  return <PatternsClient />;
}
