import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createOrganization } from "./actions";

export default async function OnboardingPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  const primaryEmail = user.emailAddresses[0]?.emailAddress;
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">CC</span>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Welcome to Credit Club Coach
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Let&apos;s set up your organization to get started
          </p>
        </div>
        
        <form action={createOrganization} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label 
                htmlFor="name" 
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Organization Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Acme Inc."
                required
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                This will be used for your team&apos;s workspace
              </p>
            </div>
            
            <input 
              type="hidden" 
              name="email" 
              value={primaryEmail} 
            />
            <input 
              type="hidden" 
              name="userName" 
              value={fullName} 
            />
          </div>
          
          <button
            type="submit"
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            Create Organization
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Signed in as {primaryEmail}
          </p>
        </div>
      </div>
    </div>
  );
}
