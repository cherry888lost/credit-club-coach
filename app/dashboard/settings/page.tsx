import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Users,
  Webhook,
  Database,
  Shield,
  Activity,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  Terminal,
  Radio,
  ArrowRight,
  CheckSquare,
  XSquare,
  ChevronDown,
  Settings,
  Bug
} from "lucide-react";
import ResetDemoButton from "./_components/ResetDemoButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const isAdmin = user.rep.role === "admin";
  
  // ========== RAW ENV VAR DIAGNOSTICS ==========
  const envDiagnostics = {
    NEXT_PUBLIC_SUPABASE_URL: {
      present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      value: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...` : null
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `eyJ...${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(-8)}` : null
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      value: process.env.SUPABASE_SERVICE_ROLE_KEY ? `eyJ...${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-8)}` : null
    },
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {
      present: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      value: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? `pk_live_...${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(-8)}` : null
    },
    CLERK_SECRET_KEY: {
      present: !!process.env.CLERK_SECRET_KEY,
      value: process.env.CLERK_SECRET_KEY ? `sk_live_...${process.env.CLERK_SECRET_KEY.slice(-8)}` : null
    },
    FATHOM_API_KEY: {
      present: !!process.env.FATHOM_API_KEY,
      value: process.env.FATHOM_API_KEY ? `Present (${process.env.FATHOM_API_KEY.length} chars)` : null
    },
    FATHOM_WEBHOOK_SECRET: {
      present: !!process.env.FATHOM_WEBHOOK_SECRET,
      value: process.env.FATHOM_WEBHOOK_SECRET ? `Present (${process.env.FATHOM_WEBHOOK_SECRET.length} chars)` : null
    }
  };
  
  const supabaseUrlPresent = envDiagnostics.NEXT_PUBLIC_SUPABASE_URL.present;
  const supabaseServiceKeyPresent = envDiagnostics.SUPABASE_SERVICE_ROLE_KEY.present;
  
  const clerkConfigured = envDiagnostics.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.present && envDiagnostics.CLERK_SECRET_KEY.present;
  const supabaseConfigured = supabaseUrlPresent && supabaseServiceKeyPresent;
  const fathomApiConfigured = envDiagnostics.FATHOM_API_KEY.present;
  const fathomWebhookConfigured = envDiagnostics.FATHOM_WEBHOOK_SECRET.present;
  
  // ========== LIVE WEBHOOK DIAGNOSTICS ==========
  let liveWebhookDiag: any = null;
  let recentWebhooks: any[] = [];
  let dbError: string | null = null;
  
  if (supabaseConfigured) {
    try {
      const supabase = await createServiceClient();
      
      // Get the most recent detailed webhook log
      const { data: lastWebhook } = await supabase
        .from("webhook_logs_detailed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (lastWebhook) {
        const trace = lastWebhook.trace_data || {};
        
        liveWebhookDiag = {
          source: trace.step_3_source_detection?.source_detected || lastWebhook.source || "unknown",
          received_at: lastWebhook.created_at,
          request_id: lastWebhook.request_id,
          event_type: lastWebhook.event_type,
          status: lastWebhook.status,
          recording_id: trace.step_5_processing?.received_data?.recording_id,
          // Source detection
          source_detected: trace.step_3_source_detection?.source_detected,
          is_zapier: trace.step_3_source_detection?.is_zapier,
          // Signature check
          signature_check_skipped_for_zapier: trace.step_4_route_decision?.signature_check === "SKIPPED",
          signature_required: trace.step_4_route_decision?.signature_check === "REQUIRED",
          signature_present: trace.step_5_processing?.signature_header_present,
          signature_valid: trace.step_5_processing?.signature_valid,
          signature_error: trace.step_5_processing?.signature_error,
          // Route decision
          route: trace.step_4_route_decision?.route,
          // Fathom API fetch (detailed)
          fathom_fetch_success: trace.step_5_processing?.fathom_api_fetch?.success,
          fathom_fetch_error: trace.step_5_processing?.fathom_api_fetch?.error,
          // Base recording endpoint
          base_recording_endpoint: trace.step_5_processing?.fathom_api_fetch?.base_recording_endpoint,
          base_recording_status: trace.step_5_processing?.fathom_api_fetch?.base_recording_status,
          base_recording_keys: trace.step_5_processing?.fathom_api_fetch?.base_recording_keys,
          // Child endpoints
          transcript_status: trace.step_5_processing?.fathom_api_fetch?.transcript_status,
          summary_status: trace.step_5_processing?.fathom_api_fetch?.summary_status,
          // Extracted fields
          fields_extracted: trace.step_5_processing?.fathom_api_fetch?.fields_extracted,
          // Host email
          host_email: trace.step_5_processing?.received_data?.host_email || trace.step_5_processing?.rep_match?.email,
          // Rep match
          rep_matched: !!trace.step_5_processing?.rep_match?.rep_id,
          rep_name: trace.step_5_processing?.rep_match?.rep_name,
          rep_id: trace.step_5_processing?.rep_match?.rep_id,
          match_method: trace.step_5_processing?.rep_match?.method,
          // DB insert
          call_inserted: !!trace.step_5_processing?.call_created,
          call_id: trace.step_5_processing?.call_created,
          db_error: trace.step_5_processing?.db_error,
          // Result
          final_action: trace.result?.action,
          final_error: trace.result?.error,
          http_status: lastWebhook.status === "error" ? 500 : 200,
        };
      }
      
      // Get recent webhooks (last 5)
      const { data: recent } = await supabase
        .from("webhook_logs_detailed")
        .select("request_id, event_type, status, created_at, trace_data->result")
        .order("created_at", { ascending: false })
        .limit(5);
      
      recentWebhooks = recent || [];
      
    } catch (err: any) {
      dbError = err.message;
    }
  }
  
  // ========== WEBHOOK URL INFO ==========
  const webhookRoutePath = "/api/webhooks/fathom";
  const webhookFullUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}${webhookRoutePath}`
    : `https://your-domain.com${webhookRoutePath}`;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Configuration and diagnostics</p>
      </div>

      <div className="space-y-5">
        
        {/* ========== 1. TEAM MANAGEMENT (always visible) ========== */}
        {isAdmin && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white">Team Management</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage team members and roles</p>
                </div>
              </div>
              <Link 
                href="/dashboard/team"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                Manage Team
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* ========== 2. INTEGRATION STATUS (always visible) ========== */}
        {isAdmin && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-zinc-400" />
              <h3 className="font-semibold text-zinc-900 dark:text-white">Integration Status</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <StatusItem 
                icon={<Shield className="w-5 h-5" />}
                label="Clerk Authentication"
                status={clerkConfigured ? "connected" : "error"}
                detail={clerkConfigured ? "Keys configured" : "Missing keys"}
              />
              <StatusItem 
                icon={<Database className="w-5 h-5" />}
                label="Supabase Database"
                status={supabaseConfigured ? "connected" : "error"}
                detail={supabaseConfigured ? "Connected" : dbError || "Missing config"}
              />
              <StatusItem 
                icon={<Webhook className="w-5 h-5" />}
                label="Fathom API"
                status={fathomApiConfigured ? "configured" : "warning"}
                detail={fathomApiConfigured ? "API key present" : "Not configured"}
              />
              <StatusItem 
                icon={<Shield className="w-5 h-5" />}
                label="Fathom Webhook"
                status={fathomWebhookConfigured ? "configured" : "warning"}
                detail={fathomWebhookConfigured ? "Secret configured" : "Not secure"}
              />
            </div>
          </div>
        )}

        {/* ========== 3. WEBHOOKS (collapsible, collapsed by default) ========== */}
        {isAdmin && (
          <details className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden group">
            <summary className="p-5 flex items-center gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
              <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180" />
              <Radio className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span className="font-semibold text-zinc-900 dark:text-white">Webhooks</span>
              {liveWebhookDiag && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  liveWebhookDiag.status === 'error'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                }`}>
                  {liveWebhookDiag.status === 'error' ? 'Last: Error' : 'Last: OK'}
                </span>
              )}
              <span className="ml-auto text-xs text-zinc-400">Click to expand</span>
            </summary>
            <div className="p-5 pt-0 border-t border-zinc-200 dark:border-zinc-800">
              {/* Webhook URL */}
              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Webhook URL to configure in Fathom:</p>
                <code className="text-sm text-indigo-600 dark:text-cyan-400 font-mono break-all">{webhookFullUrl}</code>
              </div>

              {/* Live Webhook Diagnostics Trace (dark terminal style) */}
              <div className="mt-4 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-sm font-semibold text-white">Live Webhook Trace</span>
                  <span className="ml-auto text-xs text-slate-500 font-mono">Route: {webhookRoutePath}</span>
                </div>
                
                <div className="p-4 space-y-4">
                  {!liveWebhookDiag ? (
                    <div className="p-4 bg-slate-800 rounded-lg text-center">
                      <p className="text-slate-400">No webhooks received yet</p>
                      <p className="text-xs text-slate-500 mt-1">Send a test call from Fathom to see diagnostics</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Timestamp & Source */}
                      <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-sm">Last webhook</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            liveWebhookDiag.source === 'zapier' 
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                              : liveWebhookDiag.source === 'fathom'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {liveWebhookDiag.source?.toUpperCase() || 'UNKNOWN'}
                          </span>
                        </div>
                        <span className="text-white font-mono text-sm">{formatTimeAgo(liveWebhookDiag.received_at)}</span>
                      </div>
                      
                      {/* Trace Steps */}
                      <div className="space-y-2">
                        {/* Step 1: Request received */}
                        <TraceStep 
                          number={1}
                          label="Request received"
                          status="success"
                          detail={`Request ID: ${liveWebhookDiag.request_id?.slice(0, 8)}... | Event: ${liveWebhookDiag.event_type}`}
                        />
                        
                        {/* Step 2: Signature verification */}
                        <TraceStep 
                          number={2}
                          label={liveWebhookDiag.signature_check_skipped_for_zapier ? "Signature check (SKIPPED for Zapier)" : "Signature verification"}
                          status={liveWebhookDiag.signature_valid ? "success" : liveWebhookDiag.signature_error ? "error" : liveWebhookDiag.signature_check_skipped_for_zapier ? "warning" : "pending"}
                          detail={
                            liveWebhookDiag.signature_check_skipped_for_zapier
                              ? "Signature check skipped - Zapier source detected"
                              : liveWebhookDiag.signature_error 
                                ? `Error: ${liveWebhookDiag.signature_error}`
                                : liveWebhookDiag.signature_valid 
                                  ? "Signature valid" 
                                  : liveWebhookDiag.signature_present 
                                    ? "Checking..." 
                                    : "No signature header"
                          }
                        />
                        
                        {/* Step 3: Payload parsed */}
                        <TraceStep 
                          number={3}
                          label="Payload parsed"
                          status={liveWebhookDiag.payload_parsed !== false ? "success" : "error"}
                          detail={liveWebhookDiag.source_detected ? `Source detected: ${liveWebhookDiag.source_detected}` : "Parsing..."}
                        />
                        
                        {/* Step 4: Fathom API fetch (for Zapier) */}
                        {liveWebhookDiag.source === 'zapier' && (
                          <>
                            <TraceStep 
                              number={4}
                              label="Fathom API fetch"
                              status={liveWebhookDiag.fathom_fetch_success ? "success" : liveWebhookDiag.fathom_fetch_error ? "error" : "pending"}
                              detail={
                                liveWebhookDiag.fathom_fetch_error 
                                  ? `Error: ${liveWebhookDiag.fathom_fetch_error}`
                                  : liveWebhookDiag.fathom_fetch_success 
                                    ? "Fetched full recording data"
                                    : "Fetching..."
                              }
                            />
                            
                            {/* Fathom fetch details (expandable) */}
                            {liveWebhookDiag.fathom_fetch_details && (
                              <div className="ml-8 p-3 bg-slate-800 rounded-lg text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Endpoint:</span>
                                  <span className="text-slate-400 font-mono truncate max-w-[200px]">{liveWebhookDiag.fathom_fetch_endpoint}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Status:</span>
                                  <span className={liveWebhookDiag.fathom_fetch_status === 200 ? "text-green-400" : "text-red-400"}>
                                    {liveWebhookDiag.fathom_fetch_status || "N/A"} {liveWebhookDiag.fathom_fetch_status_text || ""}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Auth:</span>
                                  <span className="text-slate-400">{liveWebhookDiag.fathom_fetch_auth_mode}</span>
                                </div>
                                {liveWebhookDiag.fathom_fetch_fields_found && liveWebhookDiag.fathom_fetch_fields_found.length > 0 && (
                                  <div className="pt-2 border-t border-slate-700 mt-2">
                                    <span className="text-slate-500">Fields found:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {liveWebhookDiag.fathom_fetch_fields_found.slice(0, 8).map((field: string) => (
                                        <span key={field} className="px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded text-[10px]">
                                          {field}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {liveWebhookDiag.fathom_fetch_error && (
                                  <div className="pt-2 border-t border-slate-700 mt-2 text-red-400">
                                    {liveWebhookDiag.fathom_fetch_error}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Host email extracted */}
                        <TraceStep 
                          number={liveWebhookDiag.source === 'zapier' ? 5 : 4}
                          label="Host email extraction"
                          status={liveWebhookDiag.host_email ? "success" : "warning"}
                          detail={liveWebhookDiag.host_email || "No email found in payload"}
                        />
                        
                        {/* Rep matching */}
                        <TraceStep 
                          number={liveWebhookDiag.source === 'zapier' ? 6 : 5}
                          label="Rep matching"
                          status={liveWebhookDiag.rep_matched ? "success" : "warning"}
                          detail={
                            liveWebhookDiag.rep_matched 
                              ? `Matched: ${liveWebhookDiag.rep_name} (via ${liveWebhookDiag.match_method})`
                              : `No match for: ${liveWebhookDiag.host_email}`
                          }
                        />
                        
                        {/* Show help if no match */}
                        {!liveWebhookDiag.rep_matched && liveWebhookDiag.host_email && (
                          <div className="ml-8 p-3 bg-slate-800 rounded-lg">
                            <p className="text-xs text-slate-400 mb-2">
                              No rep matched for: {liveWebhookDiag.host_email}
                            </p>
                            <p className="text-xs text-slate-500">
                              Check that reps.fathom_email matches this email exactly
                            </p>
                          </div>
                        )}
                        
                        {/* DB Insert */}
                        <TraceStep 
                          number={liveWebhookDiag.source === 'zapier' ? 7 : 6}
                          label="Database insert"
                          status={liveWebhookDiag.call_inserted ? "success" : liveWebhookDiag.insert_error ? "error" : "pending"}
                          detail={
                            liveWebhookDiag.db_error 
                              ? `Error: ${liveWebhookDiag.db_error}`
                              : liveWebhookDiag.call_inserted 
                                ? `Call ID: ${liveWebhookDiag.call_id?.slice(0, 8)}... | Recording: ${liveWebhookDiag.recording_id?.slice(0, 12)}...`
                                : "Not inserted"
                          }
                        />
                        
                        {/* Scoring */}
                        <TraceStep 
                          number={liveWebhookDiag.source === 'zapier' ? 8 : 7}
                          label="Scoring triggered"
                          status={liveWebhookDiag.call_inserted ? "success" : "pending"}
                          detail={liveWebhookDiag.call_inserted ? "Async scoring started" : "N/A"}
                        />
                      </div>
                      
                      {/* Final result */}
                      <div className={`p-3 rounded-lg ${liveWebhookDiag.status === "error" ? "bg-red-900/30 border border-red-800" : "bg-green-900/30 border border-green-800"}`}>
                        <div className="flex items-center gap-2">
                          {liveWebhookDiag.status === "error" ? (
                            <XSquare className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckSquare className="w-5 h-5 text-green-400" />
                          )}
                          <span className={liveWebhookDiag.status === "error" ? "text-red-300" : "text-green-300"}>
                            {liveWebhookDiag.final_action === "call_created" 
                              ? "Call successfully created" 
                              : liveWebhookDiag.final_action === "duplicate_skipped"
                              ? "Duplicate call skipped"
                              : liveWebhookDiag.final_action === "ignored"
                              ? "Event ignored"
                              : liveWebhookDiag.final_error || "Processing completed"}
                          </span>
                        </div>
                        {liveWebhookDiag.final_error && (
                          <p className="text-red-400 text-xs mt-1 ml-7">{liveWebhookDiag.final_error}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent webhooks */}
              {recentWebhooks.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 font-medium">Recent webhooks (last 5):</p>
                  <div className="space-y-1">
                    {recentWebhooks.map((wh: any) => (
                      <div key={wh.request_id} className="flex items-center gap-3 text-xs p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <span className={wh.status === "error" ? "text-red-500 dark:text-red-400" : "text-green-500 dark:text-green-400"}>
                          {wh.status === "error" ? "✗" : "✓"}
                        </span>
                        <span className="text-zinc-700 dark:text-zinc-300">{wh.event_type}</span>
                        <span className="text-zinc-400 dark:text-zinc-500 ml-auto">{formatTimeAgo(wh.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        {/* ========== 4. ENVIRONMENT (collapsible, collapsed by default) ========== */}
        {isAdmin && (
          <details className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden group">
            <summary className="p-5 flex items-center gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
              <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180" />
              <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-zinc-900 dark:text-white">Environment</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                Object.values(envDiagnostics).every((d: any) => d.present)
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              }`}>
                {Object.values(envDiagnostics).filter((d: any) => d.present).length}/{Object.keys(envDiagnostics).length} configured
              </span>
              <span className="ml-auto text-xs text-zinc-400">Click to expand</span>
            </summary>
            <div className="p-5 pt-0 border-t border-zinc-200 dark:border-zinc-800">
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-sm">
                {Object.entries(envDiagnostics).map(([name, data]: [string, any]) => (
                  <div key={name} className={`p-3 rounded-lg border ${data.present ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                    <div className="flex items-center gap-2">
                      {data.present ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      )}
                      <span className={`text-xs ${data.present ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                        {name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

        {/* ========== 5. DIAGNOSTICS (collapsible, collapsed by default) ========== */}
        {isAdmin && (
          <details className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden group">
            <summary className="p-5 flex items-center gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
              <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180" />
              <Bug className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-zinc-900 dark:text-white">Diagnostics</span>
              <span className="ml-auto text-xs text-zinc-400">Click to expand</span>
            </summary>
            <div className="p-5 pt-0 border-t border-zinc-200 dark:border-zinc-800">
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Demo Data</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Reset demo data to its initial state. This will remove all existing calls and re-seed sample data.</p>
                  <ResetDemoButton />
                </div>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function TraceStep({ number, label, status, detail }: { number: number; label: string; status: "success" | "error" | "warning" | "pending"; detail: string }) {
  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-amber-500",
    pending: "bg-slate-500",
  };
  
  const textColors = {
    success: "text-green-400",
    error: "text-red-400",
    warning: "text-amber-400",
    pending: "text-slate-400",
  };
  
  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 rounded-full ${colors[status]} flex items-center justify-center flex-shrink-0 text-xs font-bold text-white`}>
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300">{label}</p>
        <p className={`text-xs ${textColors[status]} truncate`}>{detail}</p>
      </div>
    </div>
  );
}

function StatusItem({ icon, label, status, detail }: { icon: React.ReactNode; label: string; status: "connected" | "configured" | "warning" | "error"; detail: string }) {
  const colors = {
    connected: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    configured: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    error: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  };
  
  return (
    <div className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[status]}`}>
        {icon}
      </div>
      <div>
        <p className="font-medium text-zinc-900 dark:text-white text-sm">{label}</p>
        <p className="text-xs text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
