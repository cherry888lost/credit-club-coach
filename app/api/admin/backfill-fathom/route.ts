import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/backfill-fathom - Re-fetch Fathom data for existing calls
export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const serviceSupabase = await createServiceClient();
    
    // Check if admin
    const { data: admin } = await serviceSupabase
      .from("reps")
      .select("role")
      .eq("clerk_user_id", userId)
      .single();
    
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    
    // Get body params
    const body = await request.json();
    const { callId, recordingId, allMissing } = body;
    
    const fathomApiKey = process.env.FATHOM_API_KEY;
    if (!fathomApiKey) {
      return NextResponse.json({ error: "FATHOM_API_KEY not configured" }, { status: 500 });
    }
    
    let callsToProcess: any[] = [];
    
    if (callId) {
      // Single call mode
      const { data: call } = await serviceSupabase
        .from("calls")
        .select("id, fathom_call_id")
        .eq("id", callId)
        .eq("org_id", DEFAULT_ORG_ID)
        .single();
      
      if (!call) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      
      if (!call.fathom_call_id) {
        return NextResponse.json({ error: "Call has no fathom_call_id" }, { status: 400 });
      }
      
      callsToProcess = [call];
    } else if (allMissing) {
      // Find calls missing media URLs
      const { data: calls } = await serviceSupabase
        .from("calls")
        .select("id, fathom_call_id")
        .eq("org_id", DEFAULT_ORG_ID)
        .is("share_url", null)
        .not("fathom_call_id", "is", null)
        .limit(10);
      
      callsToProcess = calls || [];
    } else if (recordingId) {
      // Process by recording ID
      callsToProcess = [{ id: null, fathom_call_id: recordingId }];
    } else {
      return NextResponse.json({ error: "Must provide callId, recordingId, or allMissing=true" }, { status: 400 });
    }
    
    const results = [];
    
    for (const call of callsToProcess) {
      const rid = call.fathom_call_id;
      console.log(`[BACKFILL] Processing recording: ${rid}`);
      
      try {
        // Fetch from Fathom API
        const fathomUrl = `https://api.fathom.video/v1/recordings/${rid}`;
        const res = await fetch(fathomUrl, {
          headers: {
            "Authorization": `Bearer ${fathomApiKey}`,
            "Accept": "application/json",
          },
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          results.push({
            recording_id: rid,
            success: false,
            error: `HTTP ${res.status}: ${res.statusText}`,
            error_body: errorText.substring(0, 200),
          });
          continue;
        }
        
        const data = await res.json();
        
        // Extract all fields
        const updates: any = {};
        
        // Media URLs
        if (data.share_url || data.public_share_url) updates.share_url = data.share_url || data.public_share_url;
        if (data.embed_url || data.embed_iframe_url) updates.embed_url = data.embed_url || data.embed_iframe_url;
        if (data.video_url || data.video_download_url) updates.video_url = data.video_url || data.video_download_url;
        if (data.recording_url || data.audio_url) updates.recording_url = data.recording_url || data.audio_url;
        if (data.thumbnail_url || data.thumbnail) updates.thumbnail_url = data.thumbnail_url || data.thumbnail;
        
        // Content
        if (data.transcript || data.transcript_text) updates.transcript = data.transcript || data.transcript_text;
        if (data.summary || data.ai_summary) updates.summary = data.summary || data.ai_summary;
        if (data.highlights || data.key_highlights) updates.highlights = data.highlights || data.key_highlights;
        if (data.action_items || data.actions) updates.action_items = data.action_items || data.actions;
        
        // Other data
        if (data.duration_seconds) updates.duration_seconds = data.duration_seconds;
        if (data.duration) updates.duration_seconds = data.duration;
        if (data.status) updates.fathom_status = data.status;
        if (data.speakers) updates.speakers = data.speakers;
        if (data.participants) updates.participants = data.participants;
        
        if (call.id && Object.keys(updates).length > 0) {
          // Update existing call
          const { error: updateError } = await serviceSupabase
            .from("calls")
            .update({
              ...updates,
              metadata: {
                backfilled_at: new Date().toISOString(),
                backfill_fields_added: Object.keys(updates),
              },
            })
            .eq("id", call.id);
          
          if (updateError) {
            results.push({ recording_id: rid, success: false, error: updateError.message });
          } else {
            results.push({ recording_id: rid, success: true, fields_updated: Object.keys(updates) });
          }
        } else if (Object.keys(updates).length > 0) {
          results.push({ recording_id: rid, success: true, fields_found: Object.keys(updates), note: "Dry run - no call ID" });
        } else {
          results.push({ recording_id: rid, success: false, error: "No fields to update" });
        }
        
      } catch (err: any) {
        results.push({ recording_id: rid, success: false, error: err.message });
      }
    }
    
    return NextResponse.json({
      processed: callsToProcess.length,
      results,
    });
    
  } catch (error: any) {
    console.error("[BACKFILL] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/admin/backfill-fathom - List calls missing Fathom data
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const serviceSupabase = await createServiceClient();
    
    // Check if admin
    const { data: admin } = await serviceSupabase
      .from("reps")
      .select("role")
      .eq("clerk_user_id", userId)
      .single();
    
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    
    // Find calls missing media
    const { data: calls, count } = await serviceSupabase
      .from("calls")
      .select("id, title, fathom_call_id, created_at", { count: "exact" })
      .eq("org_id", DEFAULT_ORG_ID)
      .is("share_url", null)
      .not("fathom_call_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    
    return NextResponse.json({
      total_missing: count,
      calls: calls || [],
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
