import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";
import { Webhook } from "svix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  // ============================================
  // EARLY ARRIVAL LOGGING - Before any processing
  // ============================================
  const headerNames = Array.from(request.headers.keys());
  const contentType = request.headers.get("content-type");
  const userAgent = request.headers.get("user-agent");
  
  // Check for Svix-style headers (Fathom uses Svix for webhooks)
  const webhookId = request.headers.get("webhook-id");
  const webhookSignature = request.headers.get("webhook-signature");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  
  // Read raw body immediately for length logging
  const rawBody = await request.text();
  
  const earlyDiagnostics = {
    debugVersion: "FATHOM-SVIX-FIX-V1",
    request_received: true,
    method: request.method,
    content_type: contentType,
    user_agent: userAgent,
    has_webhook_id: !!webhookId,
    has_webhook_signature: !!webhookSignature,
    has_webhook_timestamp: !!webhookTimestamp,
    header_names: headerNames,
    raw_body_length: rawBody.length,
    received_at: receivedAt,
    failure_stage: null as string | null,
  };

  console.log(`[WEBHOOK ${requestId}] ========================================`);
  console.log(`[WEBHOOK ${requestId}] EARLY ARRIVAL LOG`, earlyDiagnostics);
  console.log(`[WEBHOOK ${requestId}] ========================================`);

  const trace = {
    request_id: requestId,
    received_at: receivedAt,
    source_detected: null as string | null,
    processing: {} as any,
    result: null as any,
    early_diagnostics: earlyDiagnostics,
  };

  try {
    // Parse body
    let payload: any;
    
    try {
      payload = JSON.parse(rawBody);
    } catch (err: any) {
      console.error(`[WEBHOOK ${requestId}] JSON PARSE ERROR:`, err.message);
      trace.early_diagnostics.failure_stage = "payload_parse";
      await logDiagnostics(requestId, trace.early_diagnostics);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // SOURCE DETECTION - Svix headers take priority
    let sourceDetected: "zapier" | "fathom_direct";
    
    if (webhookId && webhookSignature && webhookTimestamp) {
      // Svix-style Fathom direct webhook (check FIRST - takes priority)
      sourceDetected = "fathom_direct";
    } else if (payload.source === "zapier") {
      // Explicit Zapier marker
      sourceDetected = "zapier";
    } else if (payload.event_type?.includes("recording") || payload.transcript || payload.summary) {
      // Direct Fathom webhook (fallback detection)
      sourceDetected = "fathom_direct";
    } else {
      // Default to fathom_direct for unknown sources
      sourceDetected = "fathom_direct";
    }
    
    trace.source_detected = sourceDetected;
    console.log(`[WEBHOOK ${requestId}] SOURCE DETECTED: ${sourceDetected}`);
    console.log(`[WEBHOOK ${requestId}] Payload keys: ${Object.keys(payload).join(", ")}`);

    // Route based on source
    if (sourceDetected === "zapier") {
      return await processZapierWebhook(requestId, payload, trace);
    } else {
      return await processFathomDirectWebhook(requestId, payload, rawBody, request, trace);
    }

  } catch (error: any) {
    console.error(`[WEBHOOK ${requestId}] CRITICAL ERROR:`, error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// ZAPIER WEBHOOK HANDLER - Creates call with share_url
// ============================================================================
async function processZapierWebhook(requestId: string, payload: any, trace: any) {
  console.log(`[WEBHOOK ${requestId}] ========== ZAPIER PROCESSING ==========`);
  
  const recordingId = payload.recording_id;
  const hostEmail = payload.host_email;
  const meetingTitle = payload.meeting_title || payload.title;
  const duration = payload.duration;
  const createdAt = payload.created_at;
  const zapierShareUrl = payload.share_url || payload.public_url || payload.fathom_video_url;
  const zapierShareToken = payload.share_token || payload.public_token;
  
  console.log(`[WEBHOOK ${requestId}] Zapier data:`);
  console.log(`[WEBHOOK ${requestId}] - recording_id: ${recordingId}`);
  console.log(`[WEBHOOK ${requestId}] - share_url: ${zapierShareUrl || 'NOT PROVIDED'}`);
  
  trace.processing = {
    handler: "zapier",
    recording_id: recordingId,
    share_url: zapierShareUrl,
  };

  if (!recordingId) {
    return NextResponse.json({ error: "Missing recording_id" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    
    // Extract share_token from share_url if needed
    let finalShareToken = zapierShareToken;
    if (zapierShareUrl && !finalShareToken) {
      const match = zapierShareUrl.match(/\/share\/([a-zA-Z0-9_-]+)/);
      if (match) finalShareToken = match[1];
    }

    // UPSERT: Try to find existing call
    const { data: existingCall, error: findError } = await supabase
      .from("calls")
      .select("id, rep_id, share_url, transcript, summary")
      .eq("fathom_call_id", recordingId)
      .maybeSingle();

    const callDate = createdAt || new Date().toISOString();
    const callData: any = {
      org_id: DEFAULT_ORG_ID,
      fathom_call_id: recordingId,
      title: meetingTitle || "Untitled",
      occurred_at: callDate,
      call_date: callDate,
      duration_seconds: duration ? Math.round(parseFloat(duration) * 60) : null,
      host_email: hostEmail?.toLowerCase(),
      source: "zapier",
      // Field ownership tracking
      share_url_source: "zapier",
      last_enriched_at: new Date().toISOString(),
      // Status tracking
      transcript_status: "pending",
      summary_status: "pending",
      score_status: "pending",
    };

    // Only set share fields if provided (don't overwrite existing)
    if (zapierShareUrl) {
      callData.share_url = zapierShareUrl;
      callData.share_token = finalShareToken;
    }

    let call;
    
    if (existingCall) {
      // UPDATE: Merge with existing, don't overwrite populated fields
      const updateData: any = {
        ...callData,
        // Never overwrite existing share_url with null
        share_url: zapierShareUrl || existingCall.share_url,
        // Never overwrite existing transcript/summary
        transcript: existingCall.transcript,
        summary: existingCall.summary,
        transcript_status: existingCall.transcript ? "ready" : "pending",
        summary_status: existingCall.summary ? "ready" : "pending",
      };
      
      const { data, error } = await supabase
        .from("calls")
        .update(updateData)
        .eq("id", existingCall.id)
        .select()
        .single();
        
      if (error) throw error;
      call = data;
      console.log(`[WEBHOOK ${requestId}] Updated existing call: ${call.id}`);
    } else {
      // CREATE: New call
      const { data, error } = await supabase
        .from("calls")
        .insert(callData)
        .select()
        .single();
        
      if (error) throw error;
      call = data;
      console.log(`[WEBHOOK ${requestId}] Created new call: ${call.id}`);
    }

    // Match rep by host email
    console.log(`[WEBHOOK ${requestId}] ZAPIER REP MATCHING: email = ${hostEmail || "none"}`);
    const { repId, repName } = await findRep(hostEmail);
    console.log(`[WEBHOOK ${requestId}] ZAPIER REP RESULT: repId=${repId || "none"}, repName=${repName || "none"}`);
    if (repId && !existingCall?.rep_id) {
      await supabase.from("calls").update({ rep_id: repId, rep_name: repName }).eq("id", call.id);
      console.log(`[WEBHOOK ${requestId}] ZAPIER: Linked rep ${repName} (${repId}) to call ${call.id}`);
    }

    trace.result = { action: existingCall ? "updated" : "created", call_id: call.id };

    return NextResponse.json({
      debugVersion: "HYBRID-FATHOM-V2",
      success: true,
      callId: call.id,
      sourceDetected: "zapier",
      action: existingCall ? "updated" : "created",
      recordingId: recordingId,
      shareUrlStored: !!call.share_url,
      transcriptStatus: call.transcript_status,
      summaryStatus: call.summary_status,
    });

  } catch (err: any) {
    console.error(`[WEBHOOK ${requestId}] ZAPIER ERROR:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================================
// FATHOM DIRECT WEBHOOK HANDLER - Official Svix signature verification
// ============================================================================
async function processFathomDirectWebhook(
  requestId: string, 
  payload: any, 
  rawBody: string, 
  request: NextRequest,
  trace: any
) {
  console.log(`[WEBHOOK ${requestId}] ========== FATHOM DIRECT PROCESSING ==========`);
  
  // Get Svix-style headers
  const webhookId = request.headers.get("webhook-id") || "";
  const webhookSignature = request.headers.get("webhook-signature") || "";
  const webhookTimestamp = request.headers.get("webhook-timestamp") || "";
  const secret = process.env.FATHOM_WEBHOOK_SECRET;
  
  // Log secret presence (safely)
  const secretPreview = secret ? secret.substring(0, 6) + "***" : "NOT_SET";
  
  console.log(`[WEBHOOK ${requestId}] Svix headers:`, {
    has_webhook_id: !!webhookId,
    has_webhook_signature: !!webhookSignature,
    has_webhook_timestamp: !!webhookTimestamp,
    env_secret_present: !!secret,
    secret_prefix_preview: secretPreview,
  });
  
  if (!webhookId || !webhookSignature || !webhookTimestamp || !secret) {
    console.error(`[WEBHOOK ${requestId}] Missing Svix headers or secret`);
    trace.early_diagnostics.sourceDetected = "fathom_direct";
    trace.early_diagnostics.signature_valid = false;
    trace.early_diagnostics.failure_stage = "signature_check";
    trace.early_diagnostics.env_secret_present = !!secret;
    trace.early_diagnostics.secret_prefix_preview = secretPreview;
    await logDiagnostics(requestId, trace.early_diagnostics);
    return NextResponse.json({ error: "Unauthorized - Missing Svix headers" }, { status: 401 });
  }
  
  // Verify using official Svix library
  let isValid = false;
  let verificationError = "";
  
  try {
    const wh = new Webhook(secret);
    
    // Svix verify expects headers as an object with specific casing
    const headers = {
      "webhook-id": webhookId,
      "webhook-signature": webhookSignature,
      "webhook-timestamp": webhookTimestamp,
    };
    
    // Verify the webhook - this throws on invalid signature
    wh.verify(rawBody, headers);
    isValid = true;
    
    console.log(`[WEBHOOK ${requestId}] Svix signature verified (official library)`);
  } catch (err: any) {
    isValid = false;
    verificationError = err.message;
    console.error(`[WEBHOOK ${requestId}] Svix verification failed:`, err.message);
  }
  
  if (!isValid) {
    console.error(`[WEBHOOK ${requestId}] Invalid Svix signature`);
    trace.early_diagnostics.sourceDetected = "fathom_direct";
    trace.early_diagnostics.signature_valid = false;
    trace.early_diagnostics.failure_stage = "signature_check";
    trace.early_diagnostics.env_secret_present = true;
    trace.early_diagnostics.secret_prefix_preview = secretPreview;
    trace.early_diagnostics.verification_library_used = true;
    trace.early_diagnostics.verification_error_message = verificationError;
    await logDiagnostics(requestId, trace.early_diagnostics);
    return NextResponse.json({ error: "Invalid signature", detail: verificationError }, { status: 401 });
  }
  
  trace.early_diagnostics.signature_valid = true;
  trace.early_diagnostics.env_secret_present = true;
  trace.early_diagnostics.secret_prefix_preview = secretPreview;
  trace.early_diagnostics.verification_library_used = true;

  // ============================================
  // PAYLOAD DISCOVERY - Log full structure
  // ============================================
  console.log(`[WEBHOOK ${requestId}] PAYLOAD STRUCTURE DISCOVERY`);
  console.log(`[WEBHOOK ${requestId}] Top-level keys:`, Object.keys(payload).join(", "));
  
  // Log raw payload for diagnostics (limit size)
  const payloadJson = JSON.stringify(payload);
  console.log(`[WEBHOOK ${requestId}] RAW PAYLOAD (first 2000 chars):`, payloadJson.substring(0, 2000));
  
  // Discover recording/data objects if present
  if (payload.recording) {
    console.log(`[WEBHOOK ${requestId}] Recording object keys:`, Object.keys(payload.recording).join(", "));
  }
  if (payload.data) {
    console.log(`[WEBHOOK ${requestId}] Data object keys:`, Object.keys(payload.data).join(", "));
    if (payload.data.recording) {
      console.log(`[WEBHOOK ${requestId}] Data.recording object keys:`, Object.keys(payload.data.recording).join(", "));
    }
  }
  
  // ============================================
  // RECORDING ID CANDIDATE DISCOVERY
  // ============================================
  const candidateIds = {
    // Top level fields
    id: payload.id,
    recording_id: payload.recording_id,
    recordingId: payload.recordingId,
    meeting_id: payload.meeting_id,
    uuid: payload.uuid,
    external_id: payload.external_id,
    
    // Nested in data object (Fathom Svix envelope)
    data_id: payload.data?.id,
    data_recording_id: payload.data?.recording_id,
    data_recordingId: payload.data?.recordingId,
    data_uuid: payload.data?.uuid,
    
    // Nested in recording object
    recording_obj_id: payload.recording?.id,
    recording_obj_uuid: payload.recording?.uuid,
    recording_obj_external_id: payload.recording?.external_id,
    recording_obj_recording_id: payload.recording?.recording_id,
    
    // Nested in data.recording object
    data_recording_obj_id: payload.data?.recording?.id,
    data_recording_obj_recording_id: payload.data?.recording?.recording_id,
    
    // From share URL extraction (check all possible share_url locations)
    share_url_token: (payload.share_url || payload.data?.share_url || payload.recording?.share_url || payload.data?.recording?.share_url)
      ? ((payload.share_url || payload.data?.share_url || payload.recording?.share_url || payload.data?.recording?.share_url).match(/\/share\/([a-zA-Z0-9_-]+)/)?.[1] || null) 
      : null,
  };
  
  console.log(`[WEBHOOK ${requestId}] RECORDING ID CANDIDATES:`, candidateIds);
  
  // Extract identifiers from payload - try multiple sources INCLUDING data.* envelope
  const recordingId = payload.recording_id?.toString() || 
                      payload.data?.recording_id?.toString() ||
                      payload.data?.id?.toString() ||
                      payload.id?.toString() || 
                      payload.recording?.id?.toString() || 
                      payload.recording?.recording_id?.toString() || 
                      payload.data?.recording?.id?.toString() ||
                      payload.data?.recording?.recording_id?.toString() ||
                      null;
                      
  const shareUrl = payload.share_url || payload.data?.share_url || payload.recording?.share_url || payload.data?.recording?.share_url || null;
  const url = payload.url || payload.data?.url || payload.recording?.url || payload.data?.recording?.url || null;
  const embedUrl = payload.embed_url || payload.data?.embed_url || payload.recording?.embed_url || payload.data?.recording?.embed_url || null;
  const videoUrl = payload.video_url || payload.data?.video_url || payload.recording?.video_url || payload.data?.recording?.video_url || null;
  const recordingUrl = payload.recording_url || payload.data?.recording_url || payload.recording?.recording_url || payload.data?.recording?.recording_url || null;
  const thumbnailUrl = payload.thumbnail_url || payload.data?.thumbnail_url || payload.recording?.thumbnail_url || payload.data?.recording?.thumbnail_url || null;
  
  // Extract call ID from URL (format: https://fathom.video/calls/{id})
  let fathomCallIdFromUrl: string | null = null;
  if (url) {
    const urlMatch = url.match(/\/calls\/(\d+)/);
    if (urlMatch) {
      fathomCallIdFromUrl = urlMatch[1];
    }
  }
  
  // ============================================
  // URL NORMALIZATION - Strip query params, trailing slash, lowercase for matching
  // ============================================
  const normalizeUrl = (u: string | null): string | null => {
    if (!u) return null;
    try {
      const parsed = new URL(u);
      // Strip query params and hash, lowercase, remove trailing slash
      return (parsed.origin + parsed.pathname).toLowerCase().replace(/\/+$/, "");
    } catch {
      // If URL parsing fails, do basic normalization
      return u.split("?")[0].split("#")[0].toLowerCase().replace(/\/+$/, "");
    }
  };
  
  // Extract share_token from any share URL
  const extractShareToken = (u: string | null): string | null => {
    if (!u) return null;
    const match = u.match(/\/share\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };
  
  const normalizedShareUrl = normalizeUrl(shareUrl);
  const shareToken = extractShareToken(shareUrl);
  
  // Extract event type (check data.* envelope too)
  const eventType = payload.type || payload.event || payload.event_type || payload.data?.type || payload.data?.event_type || payload.recording?.event_type || payload.data?.recording?.event_type || "unknown";
  
  // Store diagnostics
  trace.early_diagnostics.webhook_recording_id_raw = payload.recording_id;
  trace.early_diagnostics.api_recording_id_used = recordingId;
  trace.early_diagnostics.all_candidate_ids = candidateIds;
  trace.early_diagnostics.payload_top_level_keys = Object.keys(payload);
  trace.early_diagnostics.payload_recording_keys = payload.recording ? Object.keys(payload.recording) : null;
  
  // ============================================
  // TRANSCRIPT EXTRACTION - Check all paths
  // ============================================
  let transcriptText: string | null = null;
  let transcriptPathMatched: string | null = null;
  let transcriptTypeDetected = "none";
  let transcriptArrayLength = 0;
  
  // Helper to extract text from various transcript formats
  const extractTranscript = (value: any, path: string): { text: string | null; type: string; arrayLen: number } => {
    if (!value) return { text: null, type: "null", arrayLen: 0 };
    
    if (typeof value === 'string') {
      return { text: value, type: "string", arrayLen: 0 };
    }
    
    if (Array.isArray(value)) {
      const text = value
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item?.text) return item.text;
          if (item?.content) return item.content;
          return "";
        })
        .filter(Boolean)
        .join("\n");
      return { text, type: "array", arrayLen: value.length };
    }
    
    if (typeof value === 'object') {
      if (value.text) return { text: value.text, type: "object.text", arrayLen: 0 };
      if (value.content) return { text: value.content, type: "object.content", arrayLen: 0 };
      if (value.segments && Array.isArray(value.segments)) {
        const text = value.segments
          .map((item: any) => item?.text || item?.content || "")
          .filter(Boolean)
          .join("\n");
        return { text, type: "object.segments", arrayLen: value.segments.length };
      }
    }
    
    return { text: null, type: typeof value, arrayLen: 0 };
  };
  
  // Check all transcript paths
  const transcriptPaths = [
    { value: payload.transcript, path: "transcript" },
    { value: payload?.transcript?.text, path: "transcript.text" },
    { value: payload?.transcript?.content, path: "transcript.content" },
    { value: payload?.data?.transcript, path: "data.transcript" },
    { value: payload?.data?.transcript?.text, path: "data.transcript.text" },
    { value: payload?.data?.transcript?.content, path: "data.transcript.content" },
    { value: payload?.payload?.transcript, path: "payload.transcript" },
    { value: payload?.payload?.transcript?.text, path: "payload.transcript.text" },
    { value: payload?.payload?.transcript?.content, path: "payload.transcript.content" },
  ];
  
  for (const { value, path } of transcriptPaths) {
    if (value !== undefined && value !== null) {
      const result = extractTranscript(value, path);
      if (result.text && result.text.length > 0) {
        transcriptText = result.text;
        transcriptPathMatched = path;
        transcriptTypeDetected = result.type;
        transcriptArrayLength = result.arrayLen;
        break;
      }
    }
  }
  
  // ============================================
  // SUMMARY EXTRACTION - Check all paths
  // ============================================
  let summaryText: string | null = null;
  let summaryPathMatched: string | null = null;
  let summaryTypeDetected = "none";
  
  // Check all summary paths
  const summaryPaths = [
    { value: payload.summary, path: "summary" },
    { value: payload?.summary?.text, path: "summary.text" },
    { value: payload?.summary?.content, path: "summary.content" },
    { value: payload?.data?.summary, path: "data.summary" },
    { value: payload?.data?.summary?.text, path: "data.summary.text" },
    { value: payload?.data?.summary?.content, path: "data.summary.content" },
    { value: payload?.payload?.summary, path: "payload.summary" },
    { value: payload?.payload?.summary?.text, path: "payload.summary.text" },
    { value: payload?.payload?.summary?.content, path: "payload.summary.content" },
    { value: payload.default_summary, path: "default_summary" },
    { value: payload.ai_summary, path: "ai_summary" },
  ];
  
  for (const { value, path } of summaryPaths) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'string' && value.length > 0) {
        summaryText = value;
        summaryPathMatched = path;
        summaryTypeDetected = "string";
        break;
      }
      if (typeof value === 'object' && (value.text || value.content)) {
        summaryText = value.text || value.content;
        summaryPathMatched = path;
        summaryTypeDetected = "object";
        break;
      }
    }
  }
  
  // ============================================
  // ACTION ITEMS (check data.* envelope too)
  // ============================================
  const actionItems = Array.isArray(payload.action_items) ? payload.action_items : 
                      Array.isArray(payload.data?.action_items) ? payload.data.action_items :
                      Array.isArray(payload.recording?.action_items) ? payload.recording.action_items : 
                      Array.isArray(payload.data?.recording?.action_items) ? payload.data.recording.action_items :
                      null;
  
  // ============================================
  // HIGHLIGHTS (check data.* envelope too)
  // ============================================
  const highlights = Array.isArray(payload.highlights) ? payload.highlights : 
                     Array.isArray(payload.data?.highlights) ? payload.data.highlights :
                     Array.isArray(payload.recording?.highlights) ? payload.recording.highlights : 
                     Array.isArray(payload.data?.recording?.highlights) ? payload.data.recording.highlights :
                     null;
  
  // ============================================
  // SPEAKERS (check data.* envelope too)
  // ============================================
  const speakers = Array.isArray(payload.speakers) ? payload.speakers : 
                   Array.isArray(payload.data?.speakers) ? payload.data.speakers :
                   Array.isArray(payload.recording?.speakers) ? payload.recording.speakers : 
                   Array.isArray(payload.data?.recording?.speakers) ? payload.data.recording.speakers :
                   null;
  
  // ============================================
  // PARTICIPANTS (check data.* envelope too)
  // ============================================
  const participants = Array.isArray(payload.participants) ? payload.participants : 
                       Array.isArray(payload.data?.participants) ? payload.data.participants :
                       Array.isArray(payload.recording?.participants) ? payload.recording.participants : 
                       Array.isArray(payload.data?.recording?.participants) ? payload.data.recording.participants :
                       null;
  
  // ============================================
  // IDENTIFIER LOGS
  // ============================================
  console.log(`[WEBHOOK ${requestId}] IDENTIFIERS DETECTED:`, {
    recordingIdDetected: recordingId,
    shareUrlDetected: shareUrl,
    embedUrlDetected: embedUrl,
    videoUrlDetected: videoUrl,
    recordingUrlDetected: recordingUrl,
    thumbnailUrlDetected: thumbnailUrl,
    fathomCallIdFromUrlDetected: fathomCallIdFromUrl,
  });
  
  // ============================================
  // TRANSCRIPT LOGS
  // ============================================
  console.log(`[WEBHOOK ${requestId}] TRANSCRIPT NORMALIZED:`, {
    transcriptPathMatched,
    transcriptTypeDetected,
    transcriptArrayLength,
    transcriptChars: transcriptText ? transcriptText.length : 0,
    transcriptPreviewFirst120: transcriptText ? transcriptText.substring(0, 120) + "..." : "none",
  });
  
  // ============================================
  // SUMMARY LOGS
  // ============================================
  console.log(`[WEBHOOK ${requestId}] SUMMARY NORMALIZED:`, {
    summaryPathMatched,
    summaryTypeDetected,
    summaryChars: summaryText ? summaryText.length : 0,
    summaryPreviewFirst120: summaryText ? summaryText.substring(0, 120) + "..." : "none",
  });
  
  // ============================================
  // CONTENT DETECTION LOGS
  // ============================================
  console.log(`[WEBHOOK ${requestId}] CONTENT DETECTED:`, {
    transcriptDetected: !!transcriptText,
    transcriptChars: transcriptText ? transcriptText.length : 0,
    summaryDetected: !!summaryText,
    summaryChars: summaryText ? summaryText.length : 0,
    actionItemsCount: actionItems ? actionItems.length : 0,
    highlightsCount: highlights ? highlights.length : 0,
    speakersCount: speakers ? speakers.length : 0,
    participantsCount: participants ? participants.length : 0,
    meetingTitle: payload.meeting_title || payload.title || payload.recording?.title || "Untitled",
  });

  trace.early_diagnostics.sourceDetected = "fathom_direct";
  trace.early_diagnostics.eventTypeDetected = eventType;
  trace.early_diagnostics.recordingIdDetected = recordingId;
  trace.early_diagnostics.transcriptTypeDetected = transcriptTypeDetected;
  trace.early_diagnostics.transcriptArrayLength = transcriptArrayLength;
  trace.early_diagnostics.transcriptChars = transcriptText ? transcriptText.length : 0;
  trace.early_diagnostics.summaryChars = summaryText ? summaryText.length : 0;
  await logDiagnostics(requestId, trace.early_diagnostics);

  trace.processing = {
    handler: "fathom_direct",
    event_type: eventType,
    recording_id: recordingId,
  };

  try {
    const supabase = await createServiceClient();

    // ============================================
    // STEP-BY-STEP MATCHING - Using REAL columns only
    // ============================================
    let existingCall: any = null;
    let matchedBy: string | null = null;
    let stepError: string | null = null;
    
    // 1️⃣ MATCH STEP 1: share_url exact match (highest priority - real column)
    console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 START: share_url exact match`);
    if (shareUrl) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 QUERY VALUE: ${shareUrl}`);
      try {
        const result = await supabase
          .from("calls")
          .select("id, share_url, share_token, fathom_call_id, transcript, summary")
          .eq("share_url", shareUrl)
          .limit(1);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 QUERY FINISHED`);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 ROW COUNT: ${result.data?.length ?? 0}`);
        if (result.error) {
          stepError = result.error.message;
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 ERROR: ${result.error.message}`);
        } else if (result.data && result.data.length > 0) {
          existingCall = result.data[0];
          matchedBy = "share_url";
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 FOUND CALL ID: ${existingCall.id}`);
          console.log(`[WEBHOOK ${requestId}] FOUND MATCH BY share_url: ${existingCall.id}`);
        } else {
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 NOT FOUND`);
        }
      } catch (err: any) {
        stepError = err.message;
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1 ERROR: ${err.message}`);
      }
    } else {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1: skipped (no share_url)`);
    }
    
    // 1b️⃣ MATCH STEP 1b: Normalized share_url match (strip query params, trailing slash, lowercase)
    if (!existingCall && normalizedShareUrl) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1b START: normalized share_url match`);
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1b QUERY VALUE (ilike): ${normalizedShareUrl}%`);
      try {
        // Fetch recent calls with share_url and compare normalized
        const result = await supabase
          .from("calls")
          .select("id, share_url, share_token, fathom_call_id, transcript, summary")
          .not("share_url", "is", null)
          .limit(100);
        if (result.error) {
          stepError = result.error.message;
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1b ERROR: ${result.error.message}`);
        } else if (result.data) {
          const match = result.data.find((row: any) => normalizeUrl(row.share_url) === normalizedShareUrl);
          if (match) {
            existingCall = match;
            matchedBy = "share_url_normalized";
            console.log(`[WEBHOOK ${requestId}] MATCH STEP 1b FOUND CALL ID: ${existingCall.id}`);
            console.log(`[WEBHOOK ${requestId}] DB share_url: "${match.share_url}" vs webhook: "${shareUrl}"`);
          } else {
            console.log(`[WEBHOOK ${requestId}] MATCH STEP 1b NOT FOUND (checked ${result.data.length} rows)`);
          }
        }
      } catch (err: any) {
        stepError = err.message;
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1b ERROR: ${err.message}`);
      }
    }
    
    // 1c️⃣ MATCH STEP 1c: share_token match (extract token from URL path, match against share_token column)
    if (!existingCall && shareToken) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c START: share_token match`);
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c QUERY VALUE: ${shareToken}`);
      try {
        const result = await supabase
          .from("calls")
          .select("id, share_url, share_token, fathom_call_id, transcript, summary")
          .eq("share_token", shareToken)
          .limit(1);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c QUERY FINISHED`);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c ROW COUNT: ${result.data?.length ?? 0}`);
        if (result.error) {
          stepError = result.error.message;
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c ERROR: ${result.error.message}`);
        } else if (result.data && result.data.length > 0) {
          existingCall = result.data[0];
          matchedBy = "share_token";
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c FOUND CALL ID: ${existingCall.id}`);
        } else {
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c NOT FOUND`);
        }
      } catch (err: any) {
        stepError = err.message;
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c ERROR: ${err.message}`);
      }
    } else if (!shareToken) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1c: skipped (no share_token)`);
    }
    
    // 1d️⃣ MATCH STEP 1d: share_token extracted from DB share_url (if share_token column is empty but share_url has token)
    if (!existingCall && shareToken) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 1d START: share_token via LIKE on share_url column`);
      try {
        const result = await supabase
          .from("calls")
          .select("id, share_url, share_token, fathom_call_id, transcript, summary")
          .like("share_url", `%/share/${shareToken}%`)
          .limit(1);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1d ROW COUNT: ${result.data?.length ?? 0}`);
        if (result.error) {
          stepError = result.error.message;
        } else if (result.data && result.data.length > 0) {
          existingCall = result.data[0];
          matchedBy = "share_token_in_url";
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1d FOUND CALL ID: ${existingCall.id}`);
        } else {
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 1d NOT FOUND`);
        }
      } catch (err: any) {
        stepError = err.message;
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 1d ERROR: ${err.message}`);
      }
    }
    
    // 2️⃣ MATCH STEP 2: fathom_call_id exact match (recording_id from payload)
    if (!existingCall && recordingId) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 START: fathom_call_id exact match`);
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 QUERY VALUE: ${recordingId}`);
      try {
        const result = await supabase
          .from("calls")
          .select("id, share_url, share_token, fathom_call_id, transcript, summary")
          .eq("fathom_call_id", recordingId)
          .limit(1);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 QUERY FINISHED`);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 ROW COUNT: ${result.data?.length ?? 0}`);
        if (result.error) {
          stepError = result.error.message;
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 ERROR: ${result.error.message}`);
        } else if (result.data && result.data.length > 0) {
          existingCall = result.data[0];
          matchedBy = "fathom_call_id";
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 FOUND CALL ID: ${existingCall.id}`);
          console.log(`[WEBHOOK ${requestId}] FOUND MATCH BY fathom_call_id: ${existingCall.id}`);
        } else {
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 NOT FOUND`);
        }
      } catch (err: any) {
        stepError = err.message;
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 2 ERROR: ${err.message}`);
      }
    } else if (!recordingId) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 2: skipped (no recording_id)`);
    }
    
    // 3️⃣ MATCH STEP 3: fathom_call_id from URL (extracted from payload.url)
    if (!existingCall && fathomCallIdFromUrl) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 START: fathom_call_id from url exact match`);
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 QUERY VALUE: ${fathomCallIdFromUrl}`);
      try {
        const result = await supabase
          .from("calls")
          .select("id, share_url, share_token, fathom_call_id, transcript, summary")
          .eq("fathom_call_id", fathomCallIdFromUrl)
          .limit(1);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 QUERY FINISHED`);
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 ROW COUNT: ${result.data?.length ?? 0}`);
        if (result.error) {
          stepError = result.error.message;
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 ERROR: ${result.error.message}`);
        } else if (result.data && result.data.length > 0) {
          existingCall = result.data[0];
          matchedBy = "fathom_call_id_from_url";
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 FOUND CALL ID: ${existingCall.id}`);
          console.log(`[WEBHOOK ${requestId}] FOUND MATCH BY fathom_call_id_from_url: ${existingCall.id}`);
        } else {
          console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 NOT FOUND`);
        }
      } catch (err: any) {
        stepError = err.message;
        console.log(`[WEBHOOK ${requestId}] MATCH STEP 3 ERROR: ${err.message}`);
      }
    } else if (!fathomCallIdFromUrl) {
      console.log(`[WEBHOOK ${requestId}] MATCH STEP 3: skipped (no fathom_call_id from url)`);
    }
    
    // 4️⃣ No more steps - if no match found by now, create new
    if (!existingCall) {
      console.log(`[WEBHOOK ${requestId}] NO MATCH FOUND AFTER ALL STEPS`);
    }

    console.log(`[WEBHOOK ${requestId}] MATCHING COMPLETE:`, {
      matchedExistingCall: !!existingCall,
      matchedBy: matchedBy,
      existingCallId: existingCall?.id || null,
      stepError: stepError,
    });

    const updateData: any = {
      source: "fathom_direct",
      fathom_event_type: eventType,
      last_enriched_at: new Date().toISOString(),
      raw_webhook_meta: {
        event_type: eventType,
        received_at: new Date().toISOString(),
        matched_by: matchedBy,
      },
    };

    // Only update fields if provided (don't overwrite with null)
    if (transcriptText !== null && transcriptText !== undefined && transcriptText.length > 0) {
      updateData.transcript = transcriptText;
      updateData.transcript_status = "ready";
      updateData.transcript_source = "fathom_direct";
    }
    
    if (summaryText !== null && summaryText !== undefined && summaryText.length > 0) {
      updateData.summary = summaryText;
      updateData.summary_status = "ready";
      updateData.summary_source = "fathom_direct";
    }
    
    if (actionItems !== null && actionItems !== undefined && actionItems.length > 0) {
      updateData.action_items = actionItems;
      updateData.action_items_source = "fathom_direct";
    }
    
    if (highlights !== null && highlights !== undefined && highlights.length > 0) {
      updateData.highlights = highlights;
    }
    
    if (speakers !== null && speakers !== undefined && speakers.length > 0) {
      updateData.speakers = speakers;
    }
    
    if (participants !== null && participants !== undefined && participants.length > 0) {
      updateData.participants = participants;
    }
    
    // Update identifiers and media URLs if not already set
    if (shareUrl && !existingCall?.share_url) {
      updateData.share_url = shareUrl;
    }
    if (embedUrl && !existingCall?.embed_url) {
      updateData.embed_url = embedUrl;
    }
    if (videoUrl && !existingCall?.video_url) {
      updateData.video_url = videoUrl;
    }
    if (recordingUrl && !existingCall?.recording_url) {
      updateData.recording_url = recordingUrl;
    }
    if (thumbnailUrl && !existingCall?.thumbnail_url) {
      updateData.thumbnail_url = thumbnailUrl;
    }
    if (recordingId && !existingCall?.fathom_call_id) {
      updateData.fathom_call_id = recordingId;
    }
    
    // Update highlights/speakers/participants if present and not already set (check data.* too)
    const payloadHighlights = payload.highlights || payload.data?.highlights || payload.recording?.highlights || payload.data?.recording?.highlights;
    const payloadSpeakers = payload.speakers || payload.data?.speakers || payload.recording?.speakers || payload.data?.recording?.speakers;
    const payloadParticipants = payload.participants || payload.data?.participants || payload.recording?.participants || payload.data?.recording?.participants;
    if (payloadHighlights && !existingCall?.highlights) {
      updateData.highlights = payloadHighlights;
    }
    if (payloadSpeakers && !existingCall?.speakers) {
      updateData.speakers = payloadSpeakers;
    }
    if (payloadParticipants && !existingCall?.participants) {
      updateData.participants = payloadParticipants;
    }

    // ============================================
    // REP MATCHING - Extract email from payload and match to reps table
    // ============================================
    const repEmail =
      payload.user?.email ||
      payload.host?.email ||
      payload.host_email ||
      payload.data?.host_email ||
      payload.data?.user?.email ||
      payload.data?.host?.email ||
      payload.recording?.host_email ||
      payload.data?.recording?.host_email ||
      (Array.isArray(payload.participants) && payload.participants[0]?.email) ||
      (Array.isArray(payload.data?.participants) && payload.data.participants[0]?.email) ||
      (Array.isArray(payload.recording?.participants) && payload.recording.participants[0]?.email) ||
      (Array.isArray(payload.data?.recording?.participants) && payload.data.recording.participants[0]?.email) ||
      null;

    console.log(`[WEBHOOK ${requestId}] REP MATCHING: email candidate = ${repEmail || "none"}`);

    const { repId, repName } = await findRep(repEmail ?? undefined);

    console.log(`[WEBHOOK ${requestId}] REP MATCHING RESULT:`, {
      repEmail,
      repId: repId || "no match",
      repName: repName || "no match",
    });

    // Attach rep fields to updateData so they persist on both update & insert paths
    if (repId) {
      updateData.rep_id = repId;
      updateData.rep_name = repName;
    }

    let call;
    
    if (existingCall) {
      // UPDATE existing
      const { data, error } = await supabase
        .from("calls")
        .update(updateData)
        .eq("id", existingCall.id)
        .select()
        .single();
        
      if (error) throw error;
      call = data;
      console.log(`[WEBHOOK ${requestId}] UPDATED EXISTING CALL: ${call.id}`);
    } else {
      // CREATE new call
      console.log(`[WEBHOOK ${requestId}] No match found - creating new call`);
      const meetingTitle = payload.meeting_title || payload.title || payload.data?.title || payload.data?.meeting_title || payload.recording?.title || payload.data?.recording?.title || "Untitled";
      const callDate = payload.created_at || payload.occurred_at || payload.started_at || payload.data?.created_at || payload.data?.occurred_at || payload.data?.started_at || payload.recording?.created_at || payload.data?.recording?.created_at || new Date().toISOString();
      const durationRaw = payload.duration_seconds || payload.duration || payload.data?.duration_seconds || payload.data?.duration || payload.recording?.duration_seconds || payload.data?.recording?.duration_seconds || null;
      const durationSeconds = durationRaw ? Math.round(Number(durationRaw)) : null;

      const insertData: any = {
        org_id: DEFAULT_ORG_ID,
        fathom_call_id: recordingId || fathomCallIdFromUrl,
        title: meetingTitle,
        occurred_at: callDate,
        call_date: callDate,
        duration_seconds: durationSeconds,
        host_email: (repEmail || payload.host_email || payload.data?.host_email || payload.recording?.host_email || payload.data?.recording?.host_email || "").toLowerCase() || null,
        share_url: shareUrl,
        embed_url: embedUrl,
        video_url: videoUrl,
        recording_url: recordingUrl,
        thumbnail_url: thumbnailUrl,
        rep_id: repId,
        rep_name: repName,
        ...updateData,
        transcript_status: transcriptText ? "ready" : "pending",
        summary_status: summaryText ? "ready" : "pending",
      };
      
      // Only add JSONB fields if they exist (check data.* envelope too)
      if (payloadHighlights) {
        insertData.highlights = payloadHighlights;
      }
      if (payloadSpeakers) {
        insertData.speakers = payloadSpeakers;
      }
      if (payloadParticipants) {
        insertData.participants = payloadParticipants;
      }
      
      const { data, error } = await supabase
        .from("calls")
        .insert(insertData)
        .select()
        .single();
        
      if (error) throw error;
      call = data;
      console.log(`[WEBHOOK ${requestId}] CREATED NEW CALL: ${call.id}`);
    }

    // Auto-enqueue scoring if transcript is long enough
    if (call.transcript && call.transcript.length > 500 && call.score_status !== "completed") {
      console.log(`[WEBHOOK ${requestId}] Triggering scoring for call: ${call.id}`);
      try {
        const { data: scoringReq, error: scoreError } = await supabase
          .from("scoring_requests")
          .insert({
            call_id: call.id,
            status: "pending",
            transcript: call.transcript,
            rep_name: call.rep_name,
            call_title: call.title ?? null,
            call_date: call.occurred_at ?? null,
          })
          .select("id")
          .single();

        if (scoreError) {
          console.error(`[WEBHOOK ${requestId}] Failed to enqueue scoring:`, scoreError.message);
        } else {
          console.log(`[WEBHOOK ${requestId}] Auto-enqueued scoring request ${scoringReq.id} for call ${call.id}`);
        }
      } catch (scoreErr: any) {
        console.error(`[WEBHOOK ${requestId}] Scoring enqueue error:`, scoreErr.message);
      }
    }

    trace.result = { 
      action: existingCall ? "updated" : "created", 
      call_id: call.id,
      matched_existing_call: !!existingCall,
      matched_by: matchedBy,
      transcript_updated: !!transcriptText,
      summary_updated: !!summaryText,
    };

    console.log(`[WEBHOOK ${requestId}] FINAL STORED FIELDS:`, {
      transcriptStored: !!call.transcript,
      transcriptChars: call.transcript ? call.transcript.length : 0,
      summaryStored: !!call.summary,
      summaryChars: call.summary ? call.summary.length : 0,
      actionItemsStored: !!call.action_items,
      highlightsStored: !!call.highlights,
      speakersStored: !!call.speakers,
      participantsStored: !!call.participants,
      shareUrlStored: !!call.share_url,
      embedUrlStored: !!call.embed_url,
      videoUrlStored: !!call.video_url,
      recordingUrlStored: !!call.recording_url,
      thumbnailUrlStored: !!call.thumbnail_url,
    });

    console.log(`[WEBHOOK ${requestId}] FINAL RESULT:`, {
      matchedExistingCall: !!existingCall,
      matchedBy: matchedBy,
      existingCallId: existingCall?.id || null,
      updatedExistingCallId: existingCall ? call.id : null,
      createdNewCallId: existingCall ? null : call.id,
      transcriptChars: transcriptText ? transcriptText.length : 0,
      summaryChars: summaryText ? summaryText.length : 0,
      actionItemsCount: actionItems ? actionItems.length : 0,
      highlightsCount: highlights ? highlights.length : 0,
      speakersCount: speakers ? speakers.length : 0,
      recordingIdDetected: recordingId,
      fathomCallIdFromUrlDetected: fathomCallIdFromUrl,
      shareUrlStored: !!call.share_url,
      embedUrlStored: !!call.embed_url,
      videoUrlStored: !!call.video_url,
      recordingUrlStored: !!call.recording_url,
      thumbnailUrlStored: !!call.thumbnail_url,
    });

    return NextResponse.json({
      debugVersion: "FATHOM-SVIX-FIX-V1",
      success: true,
      callId: call.id,
      sourceDetected: "fathom_direct",
      signatureValid: true,
      matchedExistingCall: !!existingCall,
      matchedBy: matchedBy,
      eventType: eventType,
      action: existingCall ? "updated" : "created",
      transcriptUpdated: !!transcriptText,
      summaryUpdated: !!summaryText,
      actionItemsUpdated: !!actionItems,
    });

  } catch (err: any) {
    console.error(`[WEBHOOK ${requestId}] FATHOM DIRECT ERROR:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findRep(email?: string): Promise<{ repId: string | null; repName: string | null }> {
  if (!email) return { repId: null, repName: null };
  
  try {
    const supabase = await createServiceClient();
    
    // Try fathom_email first
    const { data: byFathomEmail } = await supabase
      .from("reps")
      .select("id, name")
      .ilike("fathom_email", email)
      .maybeSingle();
    
    if (byFathomEmail) {
      return { repId: byFathomEmail.id, repName: byFathomEmail.name };
    }
    
    // Fallback to regular email
    const { data: byEmail } = await supabase
      .from("reps")
      .select("id, name")
      .ilike("email", email)
      .maybeSingle();
    
    if (byEmail) {
      return { repId: byEmail.id, repName: byEmail.name };
    }
    
    return { repId: null, repName: null };
  } catch {
    return { repId: null, repName: null };
  }
}

async function scoreCall(callId: string, repId: string | null, transcript: string | null, summary: string | null) {
  // Placeholder for scoring logic
  console.log(`[SCORE] Would score call ${callId}`);
  return { scored: false, reason: "Scoring not implemented" };
}

async function saveTrace(requestId: string, action: string, source: string, trace: any, status: string) {
  // Placeholder for trace logging
  console.log(`[TRACE ${requestId}] ${action} - ${status}`);
}

async function logDiagnostics(requestId: string, diagnostics: any) {
  console.log(`[DIAGNOSTICS ${requestId}]`, diagnostics);
}
