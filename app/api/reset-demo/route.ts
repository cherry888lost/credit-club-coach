import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const serviceSupabase = await createServiceClient();
    
    // Find all demo calls
    const { data: demoCalls } = await serviceSupabase
      .from("calls")
      .select("id")
      .or(`fathom_call_id.like.demo_%,metadata->>source.eq.demo_webhook`);
    
    const demoCallIds = demoCalls?.map(c => c.id) || [];
    
    if (demoCallIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No demo data to reset",
        deleted: 0,
      });
    }
    
    // Delete related records first
    await serviceSupabase
      .from("call_scores")
      .delete()
      .in("call_id", demoCallIds);
    
    await serviceSupabase
      .from("flags")
      .delete()
      .in("call_id", demoCallIds);
    
    // Delete demo calls
    const { error: deleteError } = await serviceSupabase
      .from("calls")
      .delete()
      .in("id", demoCallIds);
    
    if (deleteError) {
      console.error("Failed to delete demo calls:", deleteError);
      return NextResponse.json({
        success: false,
        error: deleteError.message,
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Reset ${demoCallIds.length} demo calls`,
      deleted: demoCallIds.length,
    });
    
  } catch (error) {
    console.error("[RESET_DEMO] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
