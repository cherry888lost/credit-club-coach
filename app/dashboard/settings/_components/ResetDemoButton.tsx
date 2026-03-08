"use client";

import { useState } from "react";
import { RefreshCw, Trash2, AlertTriangle } from "lucide-react";

export default function ResetDemoButton({ onReset }: { onReset?: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const handleReset = async () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    
    setIsResetting(true);
    setResult(null);
    
    try {
      const response = await fetch("/api/reset-demo", {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult({ success: true, message: data.message || `Reset ${data.deleted} demo calls` });
        if (onReset) {
          setTimeout(onReset, 1000);
        }
      } else {
        setResult({ success: false, message: data.error || "Failed to reset" });
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setIsResetting(false);
      setIsConfirming(false);
    }
  };
  
  const handleCancel = () => {
    setIsConfirming(false);
    setResult(null);
  };
  
  return (
    <div className="space-y-3">
      {!isConfirming ? (
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Reset Demo Data
        </button>
      ) : (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Are you sure?</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">This will delete all demo/test calls, scores, and flags. Real F webhook data will not be affected.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-sm font-medium"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Yes, Reset"
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isResetting}
              className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.success ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
