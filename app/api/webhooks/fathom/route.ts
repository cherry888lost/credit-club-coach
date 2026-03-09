import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fathom webhook handler
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  console.log(`[FATHOM_WEBHOOK ${requestId}] Received webhook at ${timestamp}`);

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Fathom-Signature");

    if (!signature) {
      console.error(`[FATHOM_WEBHOOK ${requestId}] Missing signature`);
      await logWebhook(DEFAULT_ORG_ID, "fathom", "signature_missing", { error: "Missing signature" }, "error");
      return NextResponse.json({ error: "Unauthorized - Missing signature" }, { status: 401 });
    }

    // Verify signature
    const secret = process.env.FATHOM_WEBHOOK_SECRET;
    if (!secret) {
      console.error(`[FATHOM_WEBHOOK ${requestId}] FATHOM_WEBHOOK_SECRET not configured`);
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const expectedSignature = createHash("sha256").update(rawBody + secret).digest("hex");
    
    if (signature !== expectedSignature) {
      console.error(`[FATHOM_WEBHOOK ${requestId}] Invalid signature`);
      await logWebhook(DEFAULT_ORG_ID, "fathom", "invalid_signature", { error: "Signature mismatch" }, "error");
      return NextResponse.json({ error: "Unauthorized - Invalid signature" }, { status: 401 });
    }

    // Parse webhook payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error(`[FATHOM_WEBHOOK ${requestId}] JSON parse error:`, e);
      await logWebhook(DEFAULT_ORG_ID, "fathom", "parse_error", { error: "Invalid JSON" }, "error");
      return NextResponse.json({ error: "Bad Request - Invalid JSON" }, { status: 400 });
    }

    console.log(`[FATHOM_WEBHOOK ${requestId}] Event type: ${payload.event_type}`);

    // Only process completed/processed recordings
    if (!["recording.completed", "recording.processed", "meeting.ended"].includes(payload.event_type)) {
      console.log(`[FATHOM_WEBHOOK ${requestId}] Ignoring event type: ${payload.event_type}`);
      return NextResponse.json({ success: true, message: "Event type ignored" });
    }

    const serviceSupabase = await createServiceClient();

    // Check for duplicate
    const fathomCallId = payload.data?.id || payload.recording_id || payload.meeting_id;
    if (fathomCallId) {
      const { data: existing } = await serviceSupabase
        .from("calls")
        .select("id")
        .eq("fathom_call_id", fathomCallId)
        .single();

      if (existing) {
        console.log(`[FATHOM_WEBHOOK ${requestId}] Duplicate call: ${fathomCallId}`);
        return NextResponse.json({ success: true, message: "Call already exists", callId: existing.id });
      }
    }

    // Fetch full recording data from Fathom API
    const fathomApiKey = process.env.FATHOM_API_KEY;
    if (!fathomApiKey) {
      console.error(`[FATHOM_WEBHOOK ${requestId}] FATHOM_API_KEY not configured`);
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let recordingData = payload.data;
    
    // If we have a recording_id but limited data, fetch full details
    const recordingId = payload.data?.recording_id || payload.recording_id || fathomCallId;
    if (recordingId && (!recordingData?.transcript || !recordingData?.summary)) {
      console.log(`[FATHOM_WEBHOOK ${requestId}] Fetching full recording data from Fathom API`);
      
      try {
        const fathomResponse = await fetch(`https://api.fathom.video/v1/recordings/${recordingId}`, {
          headers: {
            "Authorization": `Bearer ${fathomApiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (fathomResponse.ok) {
          const fullData = await fathomResponse.json();
          recordingData = { ...recordingData, ...fullData };
        } else {
          console.error(`[FATHOM_WEBHOOK ${requestId}] Fathom API error: ${fathomResponse.status}`);
        }
      } catch (err) {
        console.error(`[FATHOM_WEBHOOK ${requestId}] Error fetching from Fathom:`, err);
      }
    }

    // Extract host email
    const hostEmail = recordingData?.host?.email || recordingData?.host_email || payload.host_email;
    console.log(`[FATHOM_WEBHOOK ${requestId}] Host email: ${hostEmail}`);

    // Match rep by email
    let repId: string | null = null;
    let matchedRepName: string | null = null;

    if (hostEmail) {
      // Try fathom_email first, then email
      const { data: repByFathomEmail } = await serviceSupabase
        .from("reps")
        .select("id, name")
        .eq("org_id", DEFAULT_ORG_ID)
        .eq("fathom_email", hostEmail.toLowerCase())
        .eq("status", "active")
        .single();

      if (repByFathomEmail) {
        repId = repByFathomEmail.id;
        matchedRepName = repByFathomEmail.name;
        console.log(`[FATHOM_WEBHOOK ${requestId}] Matched by fathom_email: ${matchedRepName}`);
      } else {
        // Try regular email
        const { data: repByEmail } = await serviceSupabase
          .from("reps")
          .select("id, name")
          .eq("org_id", DEFAULT_ORG_ID)
          .eq("email", hostEmail.toLowerCase())
          .eq("status", "active")
          .single();

        if (repByEmail) {
          repId = repByEmail.id;
          matchedRepName = repByEmail.name;
          console.log(`[FATHOM_WEBHOOK ${requestId}] Matched by email: ${matchedRepName}`);
        }
      }
    }

    if (!repId) {
      console.warn(`[FATHOM_WEBHOOK ${requestId}] No rep matched for email: ${hostEmail}`);
    }

    // Create call record
    const callData = {
      org_id: DEFAULT_ORG_ID,
      rep_id: repId,
      fathom_call_id: recordingId || fathomCallId,
      title: recordingData?.title || recordingData?.name || `${matchedRepName || 'Unknown'} - Call`,
      occurred_at: recordingData?.started_at || recordingData?.created_at || timestamp,
      duration_seconds: recordingData?.duration_seconds || recordingData?.duration,
      transcript: recordingData?.transcript || recordingData?.transcript_text,
      summary: recordingData?.summary || recordingData?.ai_summary,
      recording_url: recordingData?.recording_url || recordingData?.audio_url,
      video_url: recordingData?.video_url,
      host_email: hostEmail?.toLowerCase(),
      participants: recordingData?.participants?.map((p: any) => p.email || p.name) || [],
      source: "fathom" as const,
      metadata: {
        ...recordingData,
        webhook_event: payload.event_type,
        webhook_id: requestId,
        matched_rep: matchedRepName,
        matched_rep_id: repId,
      },
    };

    const { data: newCall, error: callError } = await serviceSupabase
      .from("calls")
      .insert(callData)
      .select()
      .single();

    if (callError) {
      console.error(`[FATHOM_WEBHOOK ${requestId}] Error creating call:`, callError);
      await logWebhook(DEFAULT_ORG_ID, "fathom", payload.event_type, { error: callError.message }, "error");
      return NextResponse.json({ error: "Failed to create call record" }, { status: 500 });
    }

    console.log(`[FATHOM_WEBHOOK ${requestId}] Created call: ${newCall.id}`);

    // Trigger AI scoring (async, don't wait)
    scoreCallAsync(newCall.id, repId, callData.transcript, callData.summary);

    // Log success
    await logWebhook(DEFAULT_ORG_ID, "fathom", payload.event_type, { 
      call_id: newCall.id,
      rep_id: repId,
      host_email: hostEmail,
    }, "success");

    return NextResponse.json({ 
      success: true, 
      callId: newCall.id,
      repMatched: !!repId,
      repName: matchedRepName,
    });

  } catch (error) {
    console.error(`[FATHOM_WEBHOOK ${requestId}] Unhandled error:`, error);
    await logWebhook(DEFAULT_ORG_ID, "fathom", "unknown", { 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, "error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper: Log webhook to database
async function logWebhook(
  orgId: string, 
  source: string, 
  eventType: string, 
  payload: any, 
  status: 'success' | 'error' | 'pending'
) {
  try {
    const serviceSupabase = await createServiceClient();
    await serviceSupabase.from("webhook_logs").insert({
      org_id: orgId,
      source,
      event_type: eventType,
      payload,
      status,
      error_message: status === "error" ? payload.error : null,
    });
  } catch (err) {
    console.error("[WEBHOOK_LOG] Failed to log:", err);
  }
}

// Helper: Score call asynchronously
async function scoreCallAsync(callId: string, repId: string | null, transcript: string | null, summary: string | null) {
  try {
    const serviceSupabase = await createServiceClient();

    // Get rep role to determine rubric
    let rubricType: 'closer' | 'sdr' | 'generic' = 'generic';
    
    if (repId) {
      const { data: rep } = await serviceSupabase
        .from("reps")
        .select("role")
        .eq("id", repId)
        .single();
      
      if (rep?.role === 'closer' || rep?.role === 'sdr') {
        rubricType = rep.role;
      }
    }

    // For now, generate mock scores (replace with real AI later)
    const scores = generateMockScores(rubricType);
    
    const { error } = await serviceSupabase.from("call_scores").insert({
      call_id: callId,
      rubric_type: rubricType,
      overall_score: scores.overall,
      ...scores.categories,
      ai_summary: summary || `Call analyzed using ${rubricType} rubric.`,
      strengths: scores.strengths,
      improvements: scores.improvements,
      coaching_recommendation: scores.coaching,
    });

    if (error) {
      console.error(`[SCORING] Error scoring call ${callId}:`, error);
    } else {
      console.log(`[SCORING] Scored call ${callId} with ${rubricType} rubric`);
    }

  } catch (err) {
    console.error(`[SCORING] Error:`, err);
  }
}

// Helper: Generate mock scores (replace with real AI)
function generateMockScores(rubricType: 'closer' | 'sdr' | 'generic') {
  const randomScore = () => Math.floor(Math.random() * 4) + 6; // 6-9 range
  
  if (rubricType === 'closer') {
    return {
      overall: 7.2,
      categories: {
        opening_score: randomScore(),
        rapport_score: randomScore(),
        discovery_score: randomScore(),
        credit_expertise_score: randomScore(),
        value_explanation_score: randomScore(),
        objection_handling_score: randomScore(),
        close_attempt_score: randomScore(),
        structure_score: randomScore(),
        product_knowledge_score: randomScore(),
      },
      strengths: ["Strong product knowledge", "Good rapport building"],
      improvements: ["Could ask more discovery questions", "Closing could be more assumptive"],
      coaching: "Focus on assumptive closing techniques in next training.",
    };
  } else if (rubricType === 'sdr') {
    return {
      overall: 7.5,
      categories: {
        opening_score: randomScore(),
        rapport_score: randomScore(),
        qualification_score: randomScore(),
        curiosity_probing_score: randomScore(),
        agenda_control_score: randomScore(),
        booking_quality_score: randomScore(),
        urgency_score: randomScore(),
        structure_score: randomScore(),
        communication_clarity_score: randomScore(),
      },
      strengths: ["Great opening hook", "Clear communication"],
      improvements: ["Could create more urgency", "Qualification depth"],
      coaching: "Work on creating urgency without being pushy.",
    };
  }
  
  return {
    overall: 7.0,
    categories: {
      opening_score: randomScore(),
      discovery_score: randomScore(),
      rapport_score: randomScore(),
      objection_handling_score: randomScore(),
      closing_score: randomScore(),
      structure_score: randomScore(),
      product_knowledge_score: randomScore(),
    },
    strengths: ["Good engagement"],
    improvements: ["Structure could be tighter"],
    coaching: "General coaching recommended.",
  };
}
