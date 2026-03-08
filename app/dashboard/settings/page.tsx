import { getCurrentUser } from "@/lib/auth";
import WebhookHealth from "./_components/WebhookHealth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const isAdmin = user.rep.role === "admin";
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage your team and integrations</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Team</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Team Name</label>
              <input type="text" defaultValue="Credit Club Team" disabled className="w-full max-w-md px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed" />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Single-tenant mode</p>
            </div>
          </div>
        </div>

        {isAdmin && <WebhookHealth />}

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Fathom Integration</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Calls from Fathom are automatically imported via webhook.</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400"><div className="w-2 h-2 bg-green-500 rounded-full" />Webhook endpoint active</div>
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400"><div className="w-2 h-2 bg-green-500 rounded-full" />Signature verification enabled</div>
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400"><div className="w-2 h-2 bg-green-500 rounded-full" />Duplicate prevention active</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Your Account</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between max-w-md"><span className="text-sm text-zinc-600 dark:text-zinc-400">Name</span><span className="text-sm font-medium text-zinc-900 dark:text-white">{user.rep.name}</span></div>
            <div className="flex items-center justify-between max-w-md"><span className="text-sm text-zinc-600 dark:text-zinc-400">Email</span><span className="text-sm font-medium text-zinc-900 dark:text-white">{user.rep.email}</span></div>
            <div className="flex items-center justify-between max-w-md"><span className="text-sm text-zinc-600 dark:text-zinc-400">Role</span><span className="text-sm font-medium text-zinc-900 dark:text-white capitalize">{user.rep.role}</span></div>
            <div className="flex items-center justify-between max-w-md"><span className="text-sm text-zinc-600 dark:text-zinc-400">Status</span><span className="text-sm font-medium text-green-600 dark:text-green-400 capitalize">{user.rep.status}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
