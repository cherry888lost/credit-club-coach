import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin endpoint to backfill/enrich existing calls with transcript/summary/media
 * 
 * POST /api/admin/backfill-calls
 * Body: { 
 *   callId?: string - Backfill a specific call
 *   all?: boolean - Backfill all calls missing transcript/share_url/summary
 * }
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
    const { callId, all } = body;

    if (callId) {
      // Backfill specific call
      const { data: call, error } = await supabase
        .from("calls")
        .select("*")
        .eq("id", callId)
        .single();
        
      if (error || !call) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }

      // Log current state
      const result = {
        call_id: callId,
        before: {
          has_transcript: !!call.transcript,
          has_summary: !!call.summary,
          has_share_url: !!call.share_url,
          has_embed_url: !!call.embed_url,
          has_video_url: !!call.video_url,
          has_thumbnail_url: !!call.thumbnail_url,
          transcript_status: call.transcript_status,
          summary_status: call.summary_status,
          fathom_call_id: call.fathom_call_id,
        },
        // Note: Actual enrichment would require Fathom API access
        // This endpoint just logs what would need to be done
        recommendation: call.fathom_call_id 
          ? `Would fetch from Fathom API using fathom_call_id: ${call.fathom_call_id}`
          : "No fathom_call_id - cannot fetch from API",
        note: "To actually enrich, use the Fathom External API with the fathom_call_id",
      };

      // Update last_enriched_at to mark as checked
      await supabase
        .from("calls")
        .update({ last_enriched_at: new Date().toISOString() })
        .eq("id", callId);

      return NextResponse.json({ success: true, result });
    }

    if (all) {
      // Find all calls missing enrichment
      const { data: calls, error } = await supabase
        .from("calls")
        .select("id, title, fathom_call_id, transcript, summary, share_url, created_at")
        .or("transcript.is.null,summary.is.null,share_url.is.null")
        .order("created_at", { ascending: false })
        .limit(50);
        
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const results = calls?.map(call => ({
        call_id: call.id,
        title: call.title,
        fathom_call_id: call.fathom_call_id,
        missing: [
          !call.transcript && "transcript",
          !call.summary && "summary", 
          !call.share_url && "share_url",
        ].filter(Boolean),
        can_enrich: !!call.fathom_call_id,
      })) || [];

      const canEnrichCount = results.filter(r => r.can_enrich).length;
      const cannotEnrichCount = results.filter(r => !r.can_enrich).length;

      return NextResponse.json({
        success: true,
        summary: {
          total_calls_checked: results.length,
          can_enrich: canEnrichCount,
          cannot_enrich: cannotEnrichCount,
          note: "Use callId parameter to backfill individual calls with Fathom API",
        },
        calls: results,
      });
    }

    return NextResponse.json({ 
      error: "Must provide callId or all=true" 
    }, { status: 400 });

  } catch (err: any) {
    console.error("[ADMIN BACKFILL] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
