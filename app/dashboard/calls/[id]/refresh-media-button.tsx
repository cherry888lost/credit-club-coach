"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface RefreshMediaButtonProps {
  callId: string;
}

export function RefreshMediaButton({ callId }: RefreshMediaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const res = await fetch("/api/admin/refresh-fathom-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      
      const data = await res.json();
      setResult(data);
      
      if (data.updated) {
        // Reload page to show new media
        window.location.reload();
      }
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-600 text-white text-xs rounded transition-colors flex items-center justify-center gap-2"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Refreshing..." : "Refresh Fathom Media"}
      </button>
      
      <p className="text-[10px] text-zinc-500 mt-1">
        Re-fetch share_url, embed_url, video_url from Fathom API
      </p>
      
      {result && !result.updated && !result.error && (
        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-[10px] text-amber-700 dark:text-amber-400">
          {result.reason || "No new media found"}
        </div>
      )}
      
      {result?.error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-[10px] text-red-700 dark:text-red-400">
          Error: {result.error}
        </div>
      )}
    </div>
  );
}
