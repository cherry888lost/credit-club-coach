import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/refresh-fathom-media
// Refreshes Fathom media URLs (share_url, embed_url, etc.) for a call
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { callId } = body;
    
    if (!callId) {
      return NextResponse.json({ error: "Missing callId" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const apiKey = process.env.FATHOM_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "FATHOM_API_KEY not set" }, { status: 500 });
    }

    // Get the call
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id, fathom_call_id, share_url, share_token, embed_url, video_url, recording_url")
      .eq("id", callId)
      .single();
    
    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (!call.fathom_call_id) {
      return NextResponse.json({ error: "Call has no fathom_call_id" }, { status: 400 });
    }

    const recordingId = call.fathom_call_id;
    const baseUrl = "https://api.fathom.ai/external/v1";
    
    const result: any = {
      call_id: callId,
      recording_id: recordingId,
      previous: {
        share_url: call.share_url,
        share_token: call.share_token,
        embed_url: call.embed_url,
        video_url: call.video_url,
        recording_url: call.recording_url,
      },
      fetch_attempts: [],
    };

    // Fetch from Fathom API
    const recordingUrl = `${baseUrl}/recordings/${recordingId}`;
    
    try {
      const res = await fetch(recordingUrl, {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          "Accept": "application/json",
        },
      });
      
      result.fetch_status = res.status;
      
      if (res.ok) {
        const data = await res.json();
        result.fathom_response_keys = Object.keys(data);
        
        // Extract media URLs
        const updates: any = {};
        
        if (data.share_url && !call.share_url) {
          updates.share_url = data.share_url;
        }
        if (data.public_url && !call.share_url) {
          updates.share_url = data.public_url;
        }
        if (data.embed_url && !call.embed_url) {
          updates.embed_url = data.embed_url;
        }
        if (data.video_url && !call.video_url) {
          updates.video_url = data.video_url;
        }
        if (data.recording_url && !call.recording_url) {
          updates.recording_url = data.recording_url;
        }
        
        // Extract share_token from share_url
        if (updates.share_url && !call.share_token) {
          const shareMatch = updates.share_url.match(/\/share\/([a-zA-Z0-9_-]+)/);
          if (shareMatch) {
            updates.share_token = shareMatch[1];
          }
        }
        
        // Also check if share_token is returned directly
        if (data.share_token && !updates.share_token) {
          updates.share_token = data.share_token;
        }
        
        result.updates = updates;
        
        // Update the call if we have new data
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("calls")
            .update(updates)
            .eq("id", callId);
          
          if (updateError) {
            result.update_error = updateError.message;
          } else {
            result.updated = true;
            result.new_values = updates;
          }
        } else {
          result.updated = false;
          result.reason = "No new media URLs found in Fathom response";
        }
        
        // Also check for linked resources
        const links = data.links || data._links || {};
        result.has_links = Object.keys(links).length > 0;
        result.available_links = Object.keys(links);
        
      } else {
        const errorText = await res.text();
        result.error = `Fathom API error: ${res.status} - ${errorText.substring(0, 200)}`;
      }
      
    } catch (err: any) {
      result.error = err.message;
    }
    
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({
      error: "Unexpected error",
      message: error.message,
    }, { status: 500 });
  }
}
