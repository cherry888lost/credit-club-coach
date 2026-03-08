import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const serviceSupabase = await createServiceClient();
    
    // Find ALL demo/test calls using multiple patterns
    // This catches: demo_*, test_*, fathom_test_*, and specific titles
    const { data: demoCalls, error: findError } = await serviceSupabase
      .from("calls")
      .select("id, title, fathom_call_id")
      .or('fathom_call_id.like.demo_%,fathom_call_id.like.test_%,fathom_call_id.like.fathom_test_%,title.eq.Test Webhook Call,metadata-\u003e\u003esource.eq.demo_webhook,metadata-\u003e\u003esource.eq.dashboard_test');
    
    if (findError) {
      console.error("[RESET_DEMO] Error finding demo calls:", findError);
      return NextResponse.json({
        success: false,
        error: findError.message,
      }, { status: 500 });
    }
    
    const demoCallIds = demoCalls?.map(c => c.id) || [];
    
    console.log("[RESET_DEMO] Found calls:", demoCalls?.map(c => ({ title: c.title, fathom_call_id: c.fathom_call_id })));
    
    if (demoCallIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No demo data to reset",
        deleted: 0,
      });
    }
    
    console.log(`[RESET_DEMO] Deleting ${demoCallIds.length} demo calls`);
    
    // Delete related records first (order matters for FK constraints)
    await serviceSupabase.from("call_scores").delete().in("call_id", demoCallIds);
    await serviceSupabase.from("flags").delete().in("call_id", demoCallIds);
    
    // Delete the calls
    const { error: deleteError } = await serviceSupabase
      .from("calls")
      .delete()
      .in("id", demoCallIds);
    
    if (deleteError) {
      console.error("[RESET_DEMO] Error deleting calls:", deleteError);
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
