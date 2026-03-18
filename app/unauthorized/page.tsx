"use client";

import { useClerk } from "@clerk/nextjs";
import { ShieldX, LogOut } from "lucide-react";

export default function UnauthorizedPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
            Access Denied
          </h1>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
            You are not authorized to access this dashboard. If you believe this is an error, please contact your team admin to request an invite.
          </p>

          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
