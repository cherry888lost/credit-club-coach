"use client";

import { useClerk } from "@clerk/nextjs";
import { ShieldX, Clock, AlertTriangle, LogOut, Mail } from "lucide-react";

interface Props {
  status: "no_token" | "invalid" | "expired" | "email_mismatch" | "error";
  inviteEmail?: string;
  currentEmail?: string;
}

export default function AcceptInviteClient({ status, inviteEmail, currentEmail }: Props) {
  const { signOut } = useClerk();

  const content: Record<string, { icon: React.ReactNode; title: string; message: string }> = {
    no_token: {
      icon: <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
      title: "Missing Invite Link",
      message: "No invite token was provided. Please use the full invite link sent to your email.",
    },
    invalid: {
      icon: <ShieldX className="w-8 h-8 text-red-600 dark:text-red-400" />,
      title: "Invalid Invite",
      message: "This invite link is not valid. It may have already been used or revoked. Contact your admin for a new invite.",
    },
    expired: {
      icon: <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
      title: "Invite Expired",
      message: "This invite link has expired. Please ask your admin to resend the invite.",
    },
    email_mismatch: {
      icon: <Mail className="w-8 h-8 text-red-600 dark:text-red-400" />,
      title: "Email Mismatch",
      message: `This invite was sent to ${inviteEmail}, but you're signed in as ${currentEmail}. Please sign out and sign in with the correct email.`,
    },
    error: {
      icon: <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />,
      title: "Something Went Wrong",
      message: "There was an error accepting your invite. Please try again or contact your admin.",
    },
  };

  const { icon, title, message } = content[status];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            {icon}
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">{title}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">{message}</p>

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
