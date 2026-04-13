"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown } from "lucide-react";

const OUTCOMES = [
  { value: "closed", label: "Closed", color: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" },
  { value: "no_sale", label: "No Sale", color: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" },
];

const CLOSE_TYPES = [
  { value: "full_close", label: "Full Close" },
  { value: "deposit", label: "Deposit" },
  { value: "payment_plan", label: "Payment Plan" },
  { value: "partial_access", label: "Partial Access" },
];

export function OutcomeLogger({ callId, initialOutcome, initialCloseType }: {
  callId: string;
  initialOutcome?: string | null;
  initialCloseType?: string | null;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<string>(initialOutcome || "");
  const [closeType, setCloseType] = useState<string>(initialCloseType || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing outcome
  useEffect(() => {
    fetch(`/api/calls/${callId}/outcome`)
      .then(r => r.json())
      .then(data => {
        if (data.manual_outcome) {
          setOutcome(data.manual_outcome);
          setSaved(true);
        }
        if (data.manual_close_type) {
          setCloseType(data.manual_close_type);
        }
      })
      .catch(() => {});
  }, [callId]);

  const handleSave = async () => {
    if (!outcome) return;
    if (outcome === "closed" && !closeType) {
      setError("Please select a close type");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/calls/${callId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          close_type: outcome === "closed" ? closeType : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      // Re-fetch server component data so the header outcome badge updates
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-indigo-600" />
          Log Outcome
        </h3>
        {showSuccess && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800 animate-[fadeIn_0.3s_ease-in-out]">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        {saved && !showSuccess && (
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Saved
          </span>
        )}
      </div>

      {/* Outcome Selection */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-2">
            Call Outcome
          </label>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setOutcome(o.value);
                  if (o.value !== "closed") setCloseType("");
                  setSaved(false);
                  setShowSuccess(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  outcome === o.value
                    ? `${o.color} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 ring-indigo-500`
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Close Type (only for "closed" outcome) */}
        {outcome === "closed" && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">
              Close Type <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CLOSE_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => {
                    setCloseType(ct.value);
                    setSaved(false);
                    setShowSuccess(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    closeType === ct.value
                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 ring-indigo-500 border border-indigo-200 dark:border-indigo-800"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!outcome || saving || (outcome === "closed" && !closeType)}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            !outcome || saving || (outcome === "closed" && !closeType)
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm hover:shadow-md"
          }`}
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : saved ? "Update Outcome" : "Save Outcome"}
        </button>
      </div>
    </div>
  );
}
