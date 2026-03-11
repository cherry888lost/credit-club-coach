"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";

interface GenerateScoreButtonProps {
  callId: string;
  hasScore: boolean;
  hasTranscript: boolean;
  isAdmin: boolean;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function GenerateScoreButton({
  callId,
  hasScore,
  hasTranscript,
  isAdmin,
}: GenerateScoreButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    // Timeout guard
    if (Date.now() - pollStartRef.current > MAX_POLL_DURATION_MS) {
      setError("Scoring is taking longer than expected. Please refresh the page later.");
      setLoading(false);
      stopPolling();
      return;
    }

    try {
      const res = await fetch(`/api/calls/${callId}/score/status`);
      const data = await res.json();

      if (data.status === "completed") {
        stopPolling();
        window.location.reload();
        return;
      }

      if (data.status === "failed") {
        setError(data.error || "Scoring failed. Please try again.");
        setLoading(false);
        stopPolling();
        return;
      }

      if (data.status === "processing") {
        setStatusMessage("Cherry is analyzing the call…");
      } else if (data.status === "pending") {
        setStatusMessage("Queued for scoring…");
      }

      // Continue polling
      pollTimerRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
    } catch {
      // Network error — retry
      pollTimerRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
    }
  }, [callId, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  if (!isAdmin) return null;
  if (!hasTranscript) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage("Submitting scoring request…");

    try {
      const endpoint = hasScore
        ? `/api/calls/${callId}/score/regenerate`
        : `/api/calls/${callId}/score`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (res.status === 202 || data.status === "queued" || data.status === "already_queued") {
        // Start polling for completion
        setStatusMessage("Queued for scoring…");
        pollStartRef.current = Date.now();
        pollTimerRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to generate score");
        setStatusMessage(null);
        setLoading(false);
        return;
      }

      // Immediate success (shouldn't happen with queue, but handle gracefully)
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Unexpected error");
      setStatusMessage(null);
      setLoading(false);
    }
  };

  // No score yet — show prominent Generate button
  if (!hasScore) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 p-8 text-center">
        <Sparkles className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          No Score Yet
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 max-w-md mx-auto">
          Generate an AI-powered scorecard analyzing this call&apos;s sales technique, objection handling, and close quality.
        </p>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {statusMessage || "Analyzing call…"}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Score
            </>
          )}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // Score exists — show subtle Regenerate button
  return (
    <div className="flex justify-end">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusMessage || "Re-analyzing…"}
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate Score
          </>
        )}
      </button>
      {error && (
        <p className="ml-3 text-xs text-red-500 self-center">{error}</p>
      )}
    </div>
  );
}
