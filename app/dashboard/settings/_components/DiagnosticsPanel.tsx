"use client";

import { useState, useEffect } from "react";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface WebhookLog {
  id: string;
  source: string;
  event_type: string;
  status: 'success' | 'error' | 'pending';
  error_message: string | null;
  created_at: string;
}

export default function DiagnosticsPanel() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    error: 0,
    last24h: 0,
  });

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/diagnostics");
      const data = await res.json();
      setLogs(data.logs || []);
      setStats(data.stats || { total: 0, success: 0, error: 0, last24h: 0 });
    } catch (err) {
      console.error("Failed to fetch diagnostics:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expanded) {
      fetchLogs();
    }
  }, [expanded]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Activity className="w-4 h-4" />
        Show Diagnostics
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="mt-6 p-4 bg-zinc-950 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-400" />
          <span className="font-medium text-zinc-300">System Diagnostics</span>
        </div>        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>          
          <button
            onClick={() => setExpanded(false)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>        
        </div>
      </div>      
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatBox label="Total" value={stats.total} />
        <StatBox label="Success" value={stats.success} color="green" />
        <StatBox label="Errors" value={stats.error} color="red" />
        <StatBox label="24h" value={stats.last24h} />
      </div>      
      
      {/* Recent Logs */}
      <div className="space-y-2 max-h-64 overflow-auto">
        {logs.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No recent activity</p>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className="flex items-center gap-3 p-2 bg-zinc-900 rounded text-sm"
            >
              {log.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : log.status === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              )}              
              <div className="flex-1 min-w-0">
                <p className="text-zinc-300 truncate">{log.event_type}</p>                
                {log.error_message && (
                  <p className="text-xs text-red-400 truncate">{log.error_message}</p>
                )}
              </div>              
              <span className="text-xs text-zinc-600">
                {new Date(log.created_at).toLocaleTimeString()}
              </span>            
            </div>
          ))
        )}
      </div>    
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: "green" | "red" }) {
  const colorClass = color === "green" ? "text-green-400" : color === "red" ? "text-red-400" : "text-zinc-300";
  
  return (
    <div className="text-center p-2 bg-zinc-900 rounded">
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>      
      <p className="text-xs text-zinc-500">{label}</p>    
    </div>
  );
}
