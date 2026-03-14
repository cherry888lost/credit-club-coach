"use client";

import { cn } from "@/lib/utils";

const CLOSE_TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  full: { label: "Full Close", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  payment_plan: { label: "Payment Plan", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
  partial_access: { label: "Partial Access", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400" },
  deposit: { label: "Deposit", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  none: { label: "No Close", bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-400" },
};

interface CloseTypeBadgeProps {
  type: string;
  confidence?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CloseTypeBadge({ type, confidence, size = "md", className }: CloseTypeBadgeProps) {
  const style = CLOSE_TYPE_STYLES[type] || CLOSE_TYPE_STYLES.none;
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-semibold rounded-full",
      style.bg, style.text,
      sizeClasses[size],
      className
    )}>
      {style.label}
      {confidence != null && (
        <span className="opacity-70 text-[0.85em]">({confidence}%)</span>
      )}
    </span>
  );
}
