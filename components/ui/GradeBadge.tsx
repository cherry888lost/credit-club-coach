"use client";

import { cn } from "@/lib/utils";

type Grade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F";

interface GradeBadgeProps {
  grade: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getGradeColors(grade: string): { bg: string; text: string; ring: string } {
  if (grade.startsWith("A")) {
    return {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-400",
      ring: "ring-green-500/20",
    };
  }
  if (grade.startsWith("B")) {
    return {
      bg: "bg-teal-100 dark:bg-teal-900/30",
      text: "text-teal-700 dark:text-teal-400",
      ring: "ring-teal-500/20",
    };
  }
  if (grade.startsWith("C")) {
    return {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
      ring: "ring-amber-500/20",
    };
  }
  if (grade.startsWith("D")) {
    return {
      bg: "bg-orange-100 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-400",
      ring: "ring-orange-500/20",
    };
  }
  // F
  return {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-500/20",
  };
}

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5 font-semibold",
  md: "text-sm px-3 py-1 font-bold",
  lg: "text-base px-4 py-1.5 font-bold",
};

export function GradeBadge({ grade, size = "md", className }: GradeBadgeProps) {
  const colors = getGradeColors(grade);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        colors.bg,
        colors.text,
        SIZE_CLASSES[size],
        className
      )}
    >
      {grade}
    </span>
  );
}
