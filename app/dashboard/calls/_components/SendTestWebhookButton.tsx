"use client";

import { useState, useEffect } from "react";
import { Send, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export default function SendTestWebhookButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  
  const sendTest = async () => {
    setStatus("loading");
    setResult(null);
    
    try {
      const testPayload = {
        id: `test_call_${Date.now()}`,
        title: "Test Webhook Call",
        started_at: new Date().toISOString(),
        transcript: "This is a test call to verify the webhook integration is working correctly.",
        recording_url: "https://example.com/test-recording.mp4",
        host: {
          email: "test@example.com",
          name: "Test User"
        },
        metadata: {
          source: "dashboard_test",
          timestamp: Date.now(),
        }
      };
      
      const response = await fetch("/api/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: testPayload }),
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setStatus("success");
        // Hard refresh the page to show new call
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
      setResult({ error: err instanceof Error ? err.message : "Failed" });
    }
  };
  
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sendTest}
        disabled={status === "loading"}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {status === "loading" ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Sending...
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle className="w-4 h-4" />
            Sent! Refreshing...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Test Webhook
          </>
        )}
      </button>
      
      {status === "error" && (
        <span className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {result?.error || "Failed"}
        </span>
      )}
    </div>
  );
}
