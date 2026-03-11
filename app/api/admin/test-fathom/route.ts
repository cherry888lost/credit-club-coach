import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/test-fathom?recording_id=xxx OR ?share_token=xxx
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordingId = searchParams.get("recording_id");
    const shareToken = searchParams.get("share_token");
    
    const apiKey = process.env.FATHOM_API_KEY;
    
    const result: any = {
      timestamp: new Date().toISOString(),
      api_key_present: !!apiKey,
      api_key_preview: apiKey ? `${apiKey.substring(0, 10)}...` : null,
    };

    // Mode 1: Test share URL generation from share_token
    if (shareToken) {
      result.mode = "share_url_test";
      result.share_token = shareToken;
      result.share_url = `https://fathom.video/share/${shareToken}`;
      result.note = "This is a public share link, not an API recording ID";
      
      // Validate share_token format
      const isValidToken = /^[a-zA-Z0-9_-]{10,}$/.test(shareToken);
      result.token_format_valid = isValidToken;
      
      return NextResponse.json(result);
    }

    // Mode 2: Test Fathom API with recording_id
    if (!recordingId) {
      return NextResponse.json({ 
        error: "Missing parameter",
        usage: "Use ?recording_id=1234567890 (numeric) OR ?share_token=abc123xyz"
      }, { status: 400 });
    }

    // Validate recording_id is numeric
    if (!/^\d+$/.test(recordingId)) {
      return NextResponse.json({ 
        error: "Invalid recording_id format",
        message: "recording_id must be numeric (e.g., 5944222249). If you have a share token, use ?share_token=xxx instead.",
        received_value: recordingId,
        looks_like_share_token: recordingId.length > 20 && /[a-zA-Z]/.test(recordingId),
      }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "FATHOM_API_KEY not set" }, { status: 500 });
    }

    result.mode = "api_recording_fetch";
    result.recording_id = recordingId;
    result.recording_id_is_numeric = true;
    
    const baseUrl = "https://api.fathom.ai/external/v1";
    result.base_url = baseUrl;
    
    // Test endpoints
    const endpoints = [
      { name: "base_recording", path: `/recordings/${recordingId}` },
      { name: "recording_details", path: `/recordings/${recordingId}/details` },
      { name: "recording_media", path: `/recordings/${recordingId}/media` },
      { name: "summary", path: `/recordings/${recordingId}/summary` },
      { name: "transcript", path: `/recordings/${recordingId}/transcript` },
    ];
    
    result.tests = [];

    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint.path}`;
      const testResult: any = {
        name: endpoint.name,
        url: url,
        method: "GET",
        headers_used: ["X-Api-Key", "Accept"],
      };
      
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "X-Api-Key": apiKey,
            "Accept": "application/json",
          },
        });
        
        testResult.status = res.status;
        testResult.statusText = res.statusText;
        testResult.ok = res.ok;
        
        const text = await res.text();
        testResult.response_preview = text.substring(0, 500);
        
        if (res.ok) {
          try {
            const data = JSON.parse(text);
            testResult.json_parsed = true;
            testResult.json_keys = Object.keys(data);
            
            // Extract key fields
            testResult.extracted = {
              has_transcript: !!data.transcript,
              has_summary: !!data.summary,
              has_share_url: !!(data.share_url || data.public_url),
              has_share_token: !!(data.share_token || (data.share_url && data.share_url.includes('/share/'))),
              has_embed_url: !!data.embed_url,
              has_video_url: !!data.video_url,
            };
            
            // Extract actual values
            if (data.share_url) testResult.share_url = data.share_url;
            if (data.share_token) testResult.share_token = data.share_token;
            if (data.transcript) testResult.transcript_preview = data.transcript.substring(0, 200);
            if (data.summary) testResult.summary_preview = data.summary.substring(0, 200);
            
          } catch (e: any) {
            testResult.json_parsed = false;
            testResult.json_error = e.message;
          }
        }
      } catch (err: any) {
        testResult.error = err.message;
        testResult.error_name = err.name;
      }
      
      result.tests.push(testResult);
    }
    
    // Summary
    const workingTests = result.tests.filter((t: any) => t.ok);
    result.working_endpoints = workingTests.map((t: any) => t.name);
    result.summary = {
      total_endpoints_tested: result.tests.length,
      working_endpoints: workingTests.length,
      can_fetch_recording: workingTests.some((t: any) => t.name === "base_recording"),
      can_fetch_summary: workingTests.some((t: any) => t.name === "summary"),
      can_fetch_transcript: workingTests.some((t: any) => t.name === "transcript"),
    };
    
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({
      error: "Unexpected error",
      message: error.message,
    }, { status: 500 });
  }
}
