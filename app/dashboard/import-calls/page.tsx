"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText,
  ArrowLeft,
} from "lucide-react";

interface RepOption {
  id: string;
  name: string;
}

interface ImportResult {
  callId: string;
  scoringQueued: boolean;
}

const OUTCOME_OPTIONS = [
  { value: "", label: "Select outcome..." },
  { value: "closed", label: "Closed" },
  { value: "follow_up", label: "Follow Up" },
  { value: "no_sale", label: "No Sale" },
];

const CLOSE_TYPE_OPTIONS = [
  { value: "", label: "Select close type..." },
  { value: "full_close", label: "Full Close" },
  { value: "deposit", label: "Deposit" },
  { value: "payment_plan", label: "Payment Plan" },
  { value: "partial_access", label: "Partial Access" },
];

export default function ImportCallsPage() {
  const [reps, setReps] = useState<RepOption[]>([]);
  const [loadingReps, setLoadingReps] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [repId, setRepId] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [transcript, setTranscript] = useState("");
  const [outcomeHint, setOutcomeHint] = useState("");
  const [closeTypeHint, setCloseTypeHint] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/calls/import/reps")
      .then(async (res) => {
        if (res.status === 403) {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(true);
        const data = await res.json();
        setReps(data.reps || []);
      })
      .catch(() => {})
      .finally(() => setLoadingReps(false));
  }, []);

  const transcriptLength = transcript.length;
  const transcriptWarning =
    transcriptLength > 0 && transcriptLength < 200
      ? "Short transcript — scoring may be less accurate."
      : null;

  const totalDurationSeconds =
    (parseInt(durationMinutes) || 0) * 60 + (parseInt(durationSeconds) || 0);

  const handleSubmit = async (queueForScoring: boolean) => {
    setError(null);
    setResult(null);

    if (!title.trim()) {
      setError("Call title is required.");
      return;
    }
    if (!repId) {
      setError("Please select a rep.");
      return;
    }
    if (!transcript.trim()) {
      setError("Transcript is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/calls/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          rep_id: repId,
          occurred_at: dateTime || null,
          duration_seconds: totalDurationSeconds || null,
          transcript: transcript.trim(),
          outcome_hint: outcomeHint || null,
          close_type_hint: closeTypeHint || null,
          recording_url: recordingUrl.trim() || null,
          notes: notes.trim() || null,
          queue_for_scoring: queueForScoring,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed.");
        return;
      }

      const data = await res.json();
      setResult({
        callId: data.call_id,
        scoringQueued: queueForScoring,
      });

      // Reset form
      setTitle("");
      setRepId("");
      setDateTime("");
      setDurationMinutes("");
      setDurationSeconds("");
      setTranscript("");
      setOutcomeHint("");
      setCloseTypeHint("");
      setRecordingUrl("");
      setNotes("");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto mb-4 text-zinc-400 dark:text-zinc-600" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Access Denied
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            You need admin access to import calls.
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-950/30 p-8 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600 dark:text-green-400" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            Call Imported Successfully
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
            Call ID: <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-mono">{result.callId}</code>
          </p>
          {result.scoringQueued && (
            <p className="text-sm text-green-700 dark:text-green-300 mb-4">
              ✓ Queued for AI scoring
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href={`/dashboard/calls/${result.callId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              View Call
            </Link>
            <button
              onClick={() => setResult(null)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Import Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Import Call
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Manually add a call with transcript for AI scoring.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
        {/* Call Title */}
        <div className="p-5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Call Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Credit Repair Consultation — John D."
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Rep */}
        <div className="p-5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Rep <span className="text-red-500">*</span>
          </label>
          {loadingReps ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading reps...
            </div>
          ) : (
            <select
              value={repId}
              onChange={(e) => setRepId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
            >
              <option value="">Select rep...</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date & Duration row */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Duration
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                />
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 block">
                  minutes
                </span>
              </div>
              <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                :
              </span>
              <div className="flex-1">
                <input
                  type="number"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="59"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                />
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 block">
                  seconds
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="p-5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Transcript <span className="text-red-500">*</span>
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the full call transcript here..."
            rows={12}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors font-mono"
          />
          <div className="flex items-center justify-between mt-1.5">
            <div>
              {transcriptWarning && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {transcriptWarning}
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {transcriptLength.toLocaleString()} characters
            </span>
          </div>
        </div>

        {/* Outcome & Close Type row */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Outcome Hint
            </label>
            <select
              value={outcomeHint}
              onChange={(e) => setOutcomeHint(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Close Type Hint
            </label>
            <select
              value={closeTypeHint}
              onChange={(e) => setCloseTypeHint(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
            >
              {CLOSE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recording URL */}
        <div className="p-5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Recording URL{" "}
            <span className="text-zinc-400 dark:text-zinc-500 font-normal">
              (optional)
            </span>
          </label>
          <input
            type="url"
            value={recordingUrl}
            onChange={(e) => setRecordingUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Notes */}
        <div className="p-5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Notes{" "}
            <span className="text-zinc-400 dark:text-zinc-500 font-normal">
              (optional)
            </span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context for this call..."
            rows={3}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Save Only
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Save & Queue for Scoring
        </button>
      </div>
    </div>
  );
}
