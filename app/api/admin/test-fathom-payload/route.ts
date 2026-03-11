import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin diagnostic endpoint for testing Fathom webhook payloads
 * POST /api/admin/test-fathom-payload
 * 
 * Body: { payload: <the raw Fathom webhook payload> }
 * 
 * Returns: Analysis of the payload and what would be extracted
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Check if user is admin
  const supabase = await createServiceClient();
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("clerk_id", userId)
    .single();
    
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = body.payload;
    
    if (!payload) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    // Analyze payload structure
    const analysis = {
      timestamp: new Date().toISOString(),
      
      // Top level structure
      payload_top_level_keys: Object.keys(payload),
      payload_has_recording_object: !!payload.recording,
      payload_recording_keys: payload.recording ? Object.keys(payload.recording) : null,
      
      // Recording ID candidates
      recording_id_candidates: {
        id: payload.id,
        recording_id: payload.recording_id,
        recordingId: payload.recordingId,
        meeting_id: payload.meeting_id,
        uuid: payload.uuid,
        external_id: payload.external_id,
        "recording.id": payload.recording?.id,
        "recording.uuid": payload.recording?.uuid,
        "recording.external_id": payload.recording?.external_id,
        "recording.recording_id": payload.recording?.recording_id,
      },
      
      // Chosen recording ID (what we would use)
      chosen_recording_id: payload.recording_id?.toString() || 
                          payload.id?.toString() || 
                          payload.recording?.id?.toString() || 
                          payload.recording?.recording_id?.toString() || 
                          null,
      
      // Media URLs
      media_urls: {
        share_url: payload.share_url || payload.recording?.share_url,
        url: payload.url || payload.recording?.url,
        embed_url: payload.embed_url || payload.recording?.embed_url,
        video_url: payload.video_url || payload.recording?.video_url,
        recording_url: payload.recording_url || payload.recording?.recording_url,
        thumbnail_url: payload.thumbnail_url || payload.recording?.thumbnail_url,
      },
      
      // Content
      content: {
        has_transcript: !!(payload.transcript || payload.recording?.transcript),
        has_summary: !!(payload.summary || payload.recording?.summary || payload.default_summary || payload.ai_summary),
        has_highlights: !!(payload.highlights || payload.recording?.highlights),
        has_action_items: !!(payload.action_items || payload.recording?.action_items),
        has_speakers: !!(payload.speakers || payload.recording?.speakers),
        transcript_length: payload.transcript?.length || payload.recording?.transcript?.length || 0,
        summary_length: (payload.summary || payload.default_summary)?.length || payload.recording?.summary?.length || 0,
      },
      
      // Metadata
      metadata: {
        title: payload.meeting_title || payload.title || payload.recording?.title,
        created_at: payload.created_at || payload.recording?.created_at,
        duration_seconds: payload.duration_seconds || payload.duration || payload.recording?.duration_seconds,
        host_email: payload.host_email || payload.recording?.host_email,
        event_type: payload.type || payload.event || payload.event_type || payload.recording?.event_type,
      },
      
      // Raw payload preview (first 3000 chars)
      raw_payload_preview: JSON.stringify(payload).substring(0, 3000),
    };

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (err: any) {
    console.error("[ADMIN TEST] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
