"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PatternCard } from "@/components/ui/PatternCard";
import { BookOpen, TrendingUp, Shield, Clock, Target, Search, Loader2 } from "lucide-react";

// Category tabs
const CATEGORIES = [
  { key: "all", label: "All Patterns", icon: BookOpen },
  { key: "value_stacking", label: "Value Stacking", icon: TrendingUp },
  { key: "objection_handling", label: "Objection Handling", icon: Shield },
  { key: "urgency", label: "Urgency Creation", icon: Clock },
  { key: "close_attempt", label: "Closing Phrases", icon: Target },
];

interface Pattern {
  id: string;
  pattern_category: string;
  exact_quote: string;
  explanation: string;
  suggested_action: string | null;
  ai_confidence: number;
  status: string;
  source_call_id: string;
  source_rep_name: string | null;
  created_at: string;
  calls?: {
    title: string | null;
    occurred_at: string | null;
  } | null;
}

interface BenchmarkCall {
  id: string;
  rep_name: string | null;
  overall_score: number | null;
  key_lines_to_model: Array<{
    line: string;
    category?: string;
    context?: string;
  }> | null;
}

export default function PatternsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Load approved patterns from learning_queue
      const { data: approvedPatterns } = await supabase
        .from("learning_queue")
        .select("*, calls(title, occurred_at)")
        .in("status", ["approved", "promoted"])
        .order("created_at", { ascending: false });

      // Load benchmark call examples
      const { data: benchmarkCalls } = await supabase
        .from("benchmark_calls")
        .select("*")
        .order("overall_score", { ascending: false });

      setPatterns((approvedPatterns as Pattern[]) || []);
      setBenchmarks((benchmarkCalls as BenchmarkCall[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  // Filter by category and search
  const filteredPatterns = patterns.filter((p) => {
    if (activeCategory !== "all" && p.pattern_category !== activeCategory)
      return false;
    if (
      search &&
      !(p.exact_quote || "").toLowerCase().includes(search.toLowerCase()) &&
      !(p.explanation || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  // Extract benchmark lines organized by category
  const benchmarkLines = benchmarks.flatMap((b) =>
    (b.key_lines_to_model || []).map((line) => ({
      ...line,
      source_rep: b.rep_name,
      source_score: b.overall_score,
      is_benchmark: true,
    }))
  );

  const filteredBenchmarkLines = benchmarkLines.filter((line) => {
    if (activeCategory !== "all" && line.category !== activeCategory)
      return false;
    if (
      search &&
      !(line.line || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Pattern Library
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Approved sales patterns and benchmark examples
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search patterns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
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

      {/* Pattern Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading patterns...</span>
          </div>
        </div>
      ) : filteredPatterns.length === 0 && filteredBenchmarkLines.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">No patterns found</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Approve patterns from the Learning Queue to build your library
          </p>
        </div>
      ) : (
        <>
          {filteredPatterns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatterns.map((pattern) => (
                <PatternCard
                  key={pattern.id}
                  category={
                    pattern.pattern_category === "close_attempt"
                      ? "closing_phrases"
                      : pattern.pattern_category === "urgency"
                      ? "urgency_creation"
                      : pattern.pattern_category
                  }
                  technique={
                    pattern.explanation?.split(".")[0] ||
                    pattern.pattern_category
                  }
                  examplePhrase={pattern.exact_quote}
                  context={pattern.explanation}
                  effectivenessScore={
                    pattern.ai_confidence
                      ? Math.round(pattern.ai_confidence * 10)
                      : undefined
                  }
                  isBenchmark={pattern.status === "promoted"}
                />
              ))}
            </div>
          )}

          {/* Benchmark Examples Section */}
          {filteredBenchmarkLines.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                ⭐ Benchmark Examples
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBenchmarkLines.slice(0, 10).map((line, i) => (
                  <PatternCard
                    key={i}
                    category={
                      line.category === "close_attempt"
                        ? "closing_phrases"
                        : line.category === "urgency"
                        ? "urgency_creation"
                        : line.category || "value_stacking"
                    }
                    technique={line.context || "Benchmark"}
                    examplePhrase={line.line}
                    context={`From ${line.source_rep || "Unknown"} call (Score: ${line.source_score || "N/A"})`}
                    isBenchmark={true}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
