"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Brain,
  CheckCircle,
  XCircle,
  BookOpen,
  Loader2,
  Filter,
  Clock,
  Sparkles,
  ChevronDown,
  TrendingUp,
  Shield,
  Target,
  Star,
  Search,
} from "lucide-react";

interface LearningQueueItem {
  id: string;
  call_id: string;
  rep_name: string | null;
  pattern_type: string;
  quote: string;
  context: string;
  technique_score: number | null;
  confidence: number;
  status: string;
  notes: string | null;
  created_at: string;
  calls?: {
    title: string | null;
    call_date: string | null;
  } | null;
}

interface Stats {
  pending_review: number;
  approved: number;
  rejected: number;
  promoted: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  discovery: "Discovery",
  pain_amplification: "Pain Amplification",
  rapport_tone: "Rapport & Tone",
  rapport_building: "Rapport Building",
  authority_confidence: "Authority & Confidence",
  offer_explanation: "Offer Explanation",
  objection_handling: "Objection Handling",
  objection_handling_pricing: "Objection: Pricing",
  objection_handling_think: "Objection: Think About It",
  urgency: "Urgency",
  urgency_creation: "Urgency Creation",
  close_attempt: "Close Attempt",
  closing_phrase: "Closing Phrase",
  follow_up_quality: "Follow-Up Quality",
  disqualification_logic: "Disqualification Logic",
  new_objection: "New Objection",
  new_technique: "New Technique",
  script_improvement: "Script Improvement",
  value_stacking: "Value Stacking",
  other: "Other",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  value_stacking: TrendingUp,
  objection_handling: Shield,
  urgency: Clock,
  close_attempt: Target,
  discovery: Search,
  pain_amplification: TrendingUp,
  rapport_tone: Star,
  authority_confidence: Shield,
  offer_explanation: BookOpen,
  new_technique: Sparkles,
  new_objection: Shield,
  script_improvement: BookOpen,
};

const CATEGORY_TABS = [
  { key: "", label: "All Categories", icon: Filter },
  { key: "value_stacking", label: "Value Stacking", icon: TrendingUp },
  { key: "objection_handling", label: "Objection Handling", icon: Shield },
  { key: "urgency", label: "Urgency", icon: Clock },
  { key: "close_attempt", label: "Close Attempt", icon: Target },
  { key: "discovery", label: "Discovery", icon: Search },
];

const STATUS_OPTIONS = [
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "promoted", label: "Promoted" },
  { value: "rejected", label: "Rejected" },
];

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  // DB stores confidence as integer (85) or decimal (0.85)
  const pct = confidence > 1 ? Math.round(confidence) : Math.round(confidence * 100);
  const colorClass =
    pct >= 85
      ? "bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50"
      : pct >= 70
      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"
      : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
    >
      {pct}% confidence
    </span>
  );
}

export default function LearningQueuePage() {
  const [items, setItems] = useState<LearningQueueItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending_review: 0,
    approved: 0,
    rejected: 0,
    promoted: 0,
  });
  const [activeStatus, setActiveStatus] = useState("pending_review");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [repFilter, setRepFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeStatus,
        limit: "50",
      });
      if (categoryFilter) params.set("category", categoryFilter);

      const [itemsRes, statsRes] = await Promise.all([
        fetch(`/api/learning-queue?${params}`),
        fetch("/api/learning-queue/stats"),
      ]);

      if (itemsRes.status === 403) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
      const itemsData = await itemsRes.json();
      const statsData = await statsRes.json();

      let filtered = itemsData.data || [];
      if (repFilter) {
        filtered = filtered.filter((i: LearningQueueItem) =>
          i.rep_name?.toLowerCase().includes(repFilter.toLowerCase())
        );
      }

      setItems(filtered);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, categoryFilter, repFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (itemId: string, action: string) => {
    setProcessingId(itemId);
    try {
      const res = await fetch(`/api/learning-queue/${itemId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Action failed");
      } else {
        await fetchData();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessingId(null);
    }
  };

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-zinc-400 dark:text-zinc-600" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Access Denied
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            You need admin access to view the learning queue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Learning Queue
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Review AI-extracted patterns from scored calls. Approve valuable
          patterns to build the Pattern Library.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_OPTIONS.map(({ value, label }) => {
          const count = stats[value as keyof Stats] ?? 0;
          const isActive = activeStatus === value;
          const iconMap: Record<string, React.ReactNode> = {
            pending_review: (
              <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            ),
            approved: (
              <CheckCircle className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            ),
            promoted: (
              <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            ),
            rejected: (
              <XCircle className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
            ),
          };

          return (
            <button
              key={value}
              onClick={() => setActiveStatus(value)}
              className={`
                relative rounded-xl border p-5 text-left transition-all duration-150
                bg-white dark:bg-zinc-900
                ${
                  isActive
                    ? "border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-500/30"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }
              `}
            >
              <div className="flex items-center justify-between mb-3">
                {iconMap[value]}
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                {count}
              </div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                {label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((cat) => {
          const Icon = cat.icon;
          const isActive = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Additional Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category dropdown for categories not in tabs */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 pr-8 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>

        {/* Rep filter */}
        <input
          type="text"
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          placeholder="Filter by rep name..."
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors w-48"
        />

        {(categoryFilter || repFilter) && (
          <button
            onClick={() => {
              setCategoryFilter("");
              setRepFilter("");
            }}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Queue Items */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading queue...</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
            No items in this queue
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {activeStatus === "pending_review"
              ? "Score some calls to see AI-extracted patterns here for review."
              : `No ${activeStatus.replace("_", " ")} items yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const CategoryIcon =
              CATEGORY_ICONS[item.pattern_type] || Brain;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-all duration-150 hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Tags */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                        <CategoryIcon className="w-3 h-3" />
                        {CATEGORY_LABELS[item.pattern_type] ||
                          item.pattern_type}
                      </span>
                      <ConfidenceBadge confidence={item.confidence} />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.rep_name || "Unknown rep"}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>

                    {/* Quote */}
                    <blockquote className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 border-l-2 border-indigo-500 dark:border-indigo-400 pl-3">
                      &ldquo;
                      {item.quote.length > 200
                        ? item.quote.slice(0, 200) + "..."
                        : item.quote}
                      &rdquo;
                    </blockquote>

                    {/* Explanation */}
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      {item.context}
                    </p>

                    {/* Technique Score */}
                    {item.technique_score != null && (
                      <p className="text-sm text-indigo-600 dark:text-indigo-400">
                        <span className="font-medium">Category Score:</span>{" "}
                        {item.technique_score}/10
                      </p>
                    )}

                    {/* Call link */}
                    {item.calls?.title && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                        From:{" "}
                        <Link
                          href={`/dashboard/calls/${item.call_id}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {item.calls.title}
                        </Link>
                        {item.calls?.call_date &&
                          ` · ${formatDate(item.calls?.call_date)}`}
                      </p>
                    )}

                    {/* Review notes */}
                    {item.notes && (
                      <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800">
                        <span className="font-medium">Review notes:</span>{" "}
                        {item.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {activeStatus === "pending_review" && (
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(item.id, "reject")}
                        disabled={processingId === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                      >
                        {processingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Reject</span>
                      </button>

                      <button
                        onClick={() => handleAction(item.id, "approve")}
                        disabled={processingId === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {processingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Approve</span>
                      </button>

                      <button
                        onClick={() =>
                          handleAction(item.id, "promote_benchmark")
                        }
                        disabled={processingId === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        title="Promote to Pattern Library as benchmark"
                      >
                        {processingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Promote</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
