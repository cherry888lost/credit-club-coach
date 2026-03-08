import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createHash, timingSafeEqual, randomUUID } from "crypto";
import { DEFAULT_ORG_ID } from "@/lib/auth";

// Force Node.js runtime for crypto support
export const runtime = "nodejs";

// Fathom webhook payload type (defensive - many fields optional)
interface FathomWebhookPayload {
  id?: string;
  call_id?: string;
  title?: string;
  subject?: string;
  started_at?: string;
  occurred_at?: string;
  created_at?: string;
  transcript?: string;
  transcript_text?: string;
  transcript_url?: string;
  recording_url?: string;
  video_url?: string;
  audio_url?: string;
  participants?: Array<{
    email?: string;
    name?: string;
    user_id?: string;
  }>;
  host?: {
    email?: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WebhookLog {
  timestamp: string;
  fathom_call_id?: string;
  event: string;
  details?: Record<string, unknown>;
  error?: string;
}

const webhookLogs: WebhookLog[] = [];
const MAX_LOGS = 100;

function addLog(log: WebhookLog) {
  webhookLogs.unshift(log);
  if (webhookLogs.length > MAX_LOGS) {
    webhookLogs.pop();
  }
}

// Verify webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.FATHOM_WEBHOOK_SECRET;
  
  if (!secret) {
    console.error("[WEBHOOK] FATHOM_WEBHOOK_SECRET not configured");
    return false;
  }
  
  if (!signature) {
    console.error("[WEBHOOK] Missing signature header");
    return false;
  }
  
  // Simple HMAC-SHA256 verification
  const expectedSignature = createHash("sha256")
    .update(payload + secret)
    .digest("hex");
  
  // Timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return signature === expectedSignature;
  }
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();
  
  // EARLY LOG - confirm route is hit
  console.log(`[WEBHOOK ${requestId}] ===== ROUTE HIT =====`);
  console.log(`[WEBHOOK ${requestId}] URL: ${request.url}`);
  console.log(`[WEBHOOK ${requestId}] Method: ${request.method}`);
  console.log(`[WEBHOOK ${requestId}] Content-Type: ${request.headers.get('content-type')}`);
  
  try {
    // Get signature from header
    const signature = request.headers.get("x-fathom-signature") || 
                      request.headers.get("X-Fathom-Signature");
    
    console.log(`[WEBHOOK ${requestId}] Signature header: ${signature ? "present" : "missing"}`);
    
    // Get raw body for signature verification
    const rawBody = await request.text();
    console.log(`[WEBHOOK ${requestId}] Payload size: ${rawBody.length} bytes`);
    
    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      console.error(`[WEBHOOK ${requestId}] Invalid signature`);
      addLog({
        timestamp,
        event: "signature_verification_failed",
        error: "Invalid or missing signature",
      });
      return NextResponse.json(
        { error: "Unauthorized - Invalid signature", requestId },
        { status: 401 }
      );
    }
    
    console.log(`[WEBHOOK ${requestId}] Signature verified`);
    
    // Parse payload
    let payload: FathomWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error(`[WEBHOOK ${requestId}] JSON parse error:`, e);
      addLog({
        timestamp,
        event: "parse_error",
        error: "Invalid JSON payload",
      });
      return NextResponse.json(
        { error: "Bad Request - Invalid JSON", requestId },
        { status: 400 }
      );
    }
    
    // Extract fields defensively
    const fathomCallId = payload.id || payload.call_id;
    const title = payload.title || payload.subject || "Untitled Call";
    const occurredAt = payload.started_at || payload.occurred_at || payload.created_at || new Date().toISOString();
    const transcript = payload.transcript || payload.transcript_text || null;
    const recordingUrl = payload.recording_url || payload.video_url || payload.audio_url || null;
    
    console.log(`[WEBHOOK ${requestId}] Extracted fields:`, {
      fathomCallId,
      title,
      occurredAt,
      hasTranscript: !!transcript,
      hasRecording: !!recordingUrl,
    });
    
    // Validate required fields
    if (!fathomCallId) {
      console.error(`[WEBHOOK ${requestId}] Missing fathom_call_id`);
      addLog({
        timestamp,
        event: "validation_error",
        error: "Missing fathom_call_id",
        details: { availableFields: Object.keys(payload) },
      });
      return NextResponse.json(
        { 
          error: "Bad Request - Missing call ID", 
          requestId,
          details: { availableFields: Object.keys(payload) }
        },
        { status: 400 }
      );
    }
    
    // Find rep by email from participants
    let repId: string | null = null;
    let orgId: string | null = null;
    
    const participantEmail = payload.host?.email || 
                             payload.participants?.[0]?.email || 
                             null;
    
    console.log(`[WEBHOOK ${requestId}] Looking for rep with email: ${participantEmail}`);
    
    const supabase = createServiceClient();
    
    // Try to find rep by email
    if (participantEmail) {
      const { data: rep, error: repError } = await supabase
        .from("reps")
        .select("id, org_id")
        .eq("email", participantEmail)
        .single();
      
      if (repError) {
        console.log(`[WEBHOOK ${requestId}] Rep lookup error:`, repError.message);
      }
      
      if (rep) {
        repId = rep.id;
        orgId = rep.org_id;
        console.log(`[WEBHOOK ${requestId}] Found rep ${repId} for email ${participantEmail}`);
      } else {
        console.log(`[WEBHOOK ${requestId}] No rep found for email ${participantEmail}`);
      }
    }
    
    // Use fixed default org ID for single-tenant setup
    if (!orgId) {
      orgId = DEFAULT_ORG_ID;
      console.log(`[WEBHOOK ${requestId}] Using fixed default org ${orgId}`);
    }
    
    // Check if call already exists (idempotency)
    console.log(`[WEBHOOK ${requestId}] Checking for existing call with fathom_call_id: ${fathomCallId}`);
    const { data: existingCall, error: existingError } = await supabase
      .from("calls")
      .select("id, created_at")
      .eq("fathom_call_id", fathomCallId)
      .single();
    
    if (existingError && existingError.code !== "PGRST116") {
      console.error(`[WEBHOOK ${requestId}] Error checking existing call:`, existingError);
    }
    
    if (existingCall) {
      console.log(`[WEBHOOK ${requestId}] Call ${fathomCallId} already exists (id: ${existingCall.id}), skipping`);
      addLog({
        timestamp,
        fathom_call_id: fathomCallId,
        event: "duplicate_skipped",
        details: { existingCallId: existingCall.id, createdAt: existingCall.created_at },
      });
      return NextResponse.json(
        { 
          message: "Call already exists - idempotent skip", 
          requestId,
          callId: existingCall.id,
          fathomCallId: fathomCallId,
          createdAt: existingCall.created_at,
        },
        { status: 200 }
      );
    }
    
    console.log(`[WEBHOOK ${requestId}] No existing call found, inserting new record`);
    
    // Insert call into database
    const { data: newCall, error: callError } = await supabase
      .from("calls")
      .insert({
        org_id: orgId,
        rep_id: repId,
        fathom_call_id: fathomCallId,
        title: title,
        occurred_at: occurredAt,
        transcript: transcript,
        recording_url: recordingUrl,
        metadata: {
          ...payload.metadata,
          _webhook: {
            received_at: timestamp,
            request_id: requestId,
            raw_payload: payload,
          },
        },
      })
      .select()
      .single();
    
    if (callError) {
      console.error(`[WEBHOOK ${requestId}] Database insert error:`, callError);
      addLog({
        timestamp,
        fathom_call_id: fathomCallId,
        event: "insert_error",
        error: callError.message,
        details: { code: callError.code },
      });
      return NextResponse.json(
        { 
          error: "Database Error - Failed to insert call", 
          requestId,
          details: callError.message 
        },
        { status: 500 }
      );
    }
    
    console.log(`[WEBHOOK ${requestId}] Successfully inserted call ${newCall.id} with fathom_id ${fathomCallId}`);
    
    // Create placeholder call_scores row
    const { error: scoreError } = await supabase
      .from("call_scores")
      .insert({
        call_id: newCall.id,
        opening_score: null,
        discovery_score: null,
        rapport_score: null,
        objection_handling_score: null,
        closing_score: null,
        structure_score: null,
        product_knowledge_score: null,
        ai_summary: null,
        ai_summary_short: null,
        strengths: [],
        improvements: [],
        coaching_recommendation: null,
        example_phrase: null,
        tone_analysis: {},
        product_concepts_mentioned: [],
      });
    
    if (scoreError) {
      console.error(`[WEBHOOK ${requestId}] Failed to insert placeholder scores:`, scoreError);
      // Don't fail the webhook if scores insert fails
    } else {
      console.log(`[WEBHOOK ${requestId}] Created placeholder scores for call ${newCall.id}`);
    }
    
    addLog({
      timestamp,
      fathom_call_id: fathomCallId,
      event: "call_ingested",
      details: { 
        callId: newCall.id, 
        orgId, 
        repId,
        title,
      },
    });
    
    console.log(`[WEBHOOK ${requestId}] Completed successfully`);
    
    return NextResponse.json(
      { 
        message: "Call ingested successfully", 
        requestId,
        callId: newCall.id,
        fathomCallId: fathomCallId,
        orgId,
        repId,
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error(`[WEBHOOK ${requestId}] Unhandled error:`, error);
    addLog({
      timestamp,
      event: "unhandled_error",
      error: String(error),
    });
    return NextResponse.json(
      { error: "Internal Server Error", requestId },
      { status: 500 }
    );
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      message: "Fathom webhook endpoint active",
      timestamp: new Date().toISOString(),
      recentLogs: webhookLogs.slice(0, 10),
    },
    { status: 200 }
  );
}
