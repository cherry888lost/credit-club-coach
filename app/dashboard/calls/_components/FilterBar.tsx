"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface RepOption {
  id: string;
  name: string;
}

interface FilterBarProps {
  repOptions: RepOption[];
  currentFilters: {
    rep?: string;
    role?: string;
    status?: string;
    outcome?: string;
    date?: string;
    sort?: string;
  };
  isAdmin?: boolean;
}

export function FilterBar({ repOptions, currentFilters, isAdmin = true }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Rep — admin only */}
        {isAdmin && (
          <FilterSelect
            name="rep"
            value={currentFilters.rep}
            placeholder="All Reps"
            options={repOptions.map((r) => ({ value: r.id, label: r.name }))}
            onChange={handleFilterChange}
          />
        )}

        {/* Role — admin only */}
        {isAdmin && (
          <FilterSelect
            name="role"
            value={currentFilters.role}
            placeholder="All Roles"
            options={[
              { value: "closer", label: "Closers" },
              { value: "sdr", label: "SDRs" },
            ]}
            onChange={handleFilterChange}
          />
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />

        {/* Status */}
        <FilterSelect
          name="status"
          value={currentFilters.status}
          placeholder="All Statuses"
          options={[
            { value: "scored", label: "Scored" },
            { value: "not_scored", label: "Not Scored" },
          ]}
          onChange={handleFilterChange}
        />

        {/* Outcome */}
        <FilterSelect
          name="outcome"
          value={currentFilters.outcome}
          placeholder="All Outcomes"
          options={[
            { value: "closed", label: "Closed" },
            { value: "follow_up", label: "Follow Up" },
            { value: "no_sale", label: "No Sale" },
          ]}
          onChange={handleFilterChange}
        />

        {/* Divider */}
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />

        {/* Date */}
        <FilterSelect
          name="date"
          value={currentFilters.date}
          placeholder="All Time"
          options={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
            { value: "this_week", label: "This Week" },
            { value: "this_month", label: "This Month" },
          ]}
          onChange={handleFilterChange}
        />

        {/* Sort */}
        <FilterSelect
          name="sort"
          value={currentFilters.sort}
          placeholder="Newest"
          options={[
            { value: "oldest", label: "Oldest" },
            { value: "highest", label: "Highest Score" },
            { value: "lowest", label: "Lowest Score" },
          ]}
          onChange={handleFilterChange}
        />
      </div>
    </div>
  );
}

/* ── Compact Filter Select ─────────────────────────────────────────────── */

function FilterSelect({
  name,
  value,
  placeholder,
  options,
  onChange,
}: {
  name: string;
  value: string | undefined;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (name: string, value: string) => void;
}) {
  const isActive = !!value;
  return (
    <select
      name={name}
      value={value || ""}
      onChange={(e) => onChange(name, e.target.value)}
      className={`
        h-8 pl-2.5 pr-7 text-xs font-medium rounded-lg border appearance-none cursor-pointer
        transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500
        bg-[length:16px_16px] bg-[position:right_4px_center] bg-no-repeat
        [background-image:url("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%2020%2020'%3e%3cpath%20stroke='%236b7280'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='1.5'%20d='M6%208l4%204%204-4'/%3e%3c/svg%3e")]
        ${
          isActive
            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
            : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
        }
      `}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
