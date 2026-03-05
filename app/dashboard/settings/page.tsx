import { getCurrentUser } from "@/lib/auth";
import WebhookHealth from "./_components/WebhookHealth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  
  if (!user.isOnboarded) {
    return null;
  }
  
  const isAdmin = user.rep?.role === "admin";
  
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your organization and integrations
        </p>
      </div>

      {/* Settings sections */}
      <div className="space-y-6">
        {/* Organization */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">
            Organization
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Organization Name
              </label>
              <input 
                type="text" 
                defaultValue={user.org?.name}
                placeholder="Your Organization"
                className="w-full max-w-md px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Slug
              </label>
              <input 
                type="text" 
                defaultValue={user.org?.slug}
                placeholder="your-org"
                className="w-full max-w-md px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>            
            {isAdmin && (
              <div className="pt-2">
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Webhook Health - Only for admins */}
        {isAdmin && <WebhookHealth />}

        {/* Fathom Integration */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">
            Fathom Integration
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Calls from Fathom are automatically imported via webhook. Configure your Fathom dashboard with the webhook URL shown above.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Webhook endpoint active
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Signature verification enabled
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Duplicate prevention active
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        {isAdmin && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-900 p-6">
            <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
              Danger Zone
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              These actions cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors">
                Delete Organization
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
