"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { RefreshCw, Send, CheckCircle, AlertCircle, Webhook } from "lucide-react";

interface Rep {
  name: string;
}

interface Call {
  id: string;
  fathom_call_id: string | null;
  title: string | null;
  created_at: string;
  reps: Rep[] | null;
}

export default function WebhookHealth() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();
  
  // Derive webhook URL from current location
  useEffect(() => {
    const origin = window.location.origin;
    setWebhookUrl(`${origin}/api/webhook/fathom`);
  }, []);
  
  // Fetch recent calls
  const fetchRecentCalls = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from("calls")
        .select("id, fathom_call_id, title, created_at, reps(name)")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setCalls((data || []) as Call[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch calls");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchRecentCalls();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchRecentCalls, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Send test webhook
  const sendTestWebhook = async () => {
    setTestStatus("loading");
    setTestResult(null);
    
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
      
      // Generate signature
      const secret = "dev-webhook-secret-12345"; // Match the env var
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(testPayload) + secret);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const response = await fetch("/api/webhook/fathom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fathom-Signature": signature,
        },
        body: JSON.stringify(testPayload),
      });
      
      const result = await response.json();
      setTestResult({ status: response.status, ...result });
      setTestStatus(response.ok ? "success" : "error");
      
      // Refresh calls list after a moment
      setTimeout(fetchRecentCalls, 1000);
    } catch (err) {
      setTestStatus("error");
      setTestResult({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  };
  
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
          <Webhook className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
            Webhook Health
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Monitor Fathom webhook ingestion
          </p>
        </div>
      </div>
      
      {/* Webhook URL */}
      <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Webhook Endpoint URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={webhookUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-mono text-zinc-600 dark:text-zinc-400"
          />
          <button
            onClick={() => navigator.clipboard.writeText(webhookUrl)}
            className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors"
          >
            Copy
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Configure this URL in your Fathom dashboard webhook settings
        </p>
      </div>
      
      {/* Test Button */}
      <div className="mb-6">
        <button
          onClick={sendTestWebhook}
          disabled={testStatus === "loading"}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {testStatus === "loading" ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Test Webhook
            </>
          )}
        </button>
        
        {testStatus === "success" && testResult && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Test successful!
              </span>
            </div>
            <pre className="text-xs text-green-600 dark:text-green-400 overflow-x-auto">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
        
        {testStatus === "error" && testResult && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                Test failed
              </span>
            </div>
            <pre className="text-xs text-red-600 dark:text-red-400 overflow-x-auto">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      {/* Recent Calls */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-white">
            Recent Ingested Calls
          </h4>
          <button
            onClick={fetchRecentCalls}
            disabled={isLoading}
            className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        
        {calls.length > 0 ? (
          <div className="space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {call.title || "Untitled"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {call.reps?.[0]?.name || "Unknown"} • {new Date(call.created_at).toLocaleString()}
                  </p>
                </div>                
                {call.fathom_call_id && (
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    {call.fathom_call_id.slice(0, 12)}...
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
            No calls ingested yet. Send a test webhook to see it appear here.
          </p>
        )}
      </div>
    </div>
  );
}
