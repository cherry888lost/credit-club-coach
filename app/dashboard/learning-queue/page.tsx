import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth";
import LearningQueueClient from "./LearningQueueClient";

export default async function LearningQueuePage() {
  const user = await getCurrentUserWithRole();

  if (!user || !user.rep) {
    return null;
  }

  if (!user.isAdminUser) {
    redirect("/dashboard");
  }

  return <LearningQueueClient />;
}
