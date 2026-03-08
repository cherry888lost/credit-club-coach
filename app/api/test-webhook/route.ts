import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo data templates
const DEMO_NAMES = ["Sarah Johnson", "Michael Chen", "Emily Davis", "David Smith", "Jessica Brown", "James Wilson"];
const DEMO_REPS = ["Test Closer", "Test Manager"];

const DEMO_TRANSCRIPTS = [
  "Rep: Hi, thanks for joining today. I wanted to understand your current credit card setup.\n\nCustomer: Yeah I have a few cards but I'm not really maximizing the points.\n\nRep: Great, let me show you how our system can help you earn 3x on travel...",
  "Rep: Hi, following up on our conversation about the Amex Gold. Did you have a chance to review the materials?\n\nCustomer: I'm still thinking about the annual fee. It seems high.\n\nRep: I understand, let me break down how the dining credits and Uber credits offset that completely...",
  "Rep: Hello! I saw you downloaded our credit optimization guide. What questions can I answer?\n\nCustomer: I'm confused about which card to get first.\n\nRep: Perfect question. For someone in your situation with good credit but no premium cards, I'd recommend starting with the Chase Sapphire Preferred...",
];

const DEMO_STRENGTHS = [
  ["Strong rapport building", "Clear value proposition", "Good pacing"],
  ["Excellent product knowledge", "Confident delivery", "Good use of social proof"],
  ["Strong opening hook", "Effective discovery questions", "Clear next steps"],
];

const DEMO_IMPROVEMENTS = [
  ["Could ask more about travel spending", "Closing could be more assumptive"],
  ["Discovery questions too brief", "Did not address the annual fee proactively"],
  ["Should have mentioned signup bonus earlier", "No urgency created"],
];

export async function POST(request: NextRequest) {
  try {
    const serviceSupabase = await createServiceClient();
    
    // Get current user count to vary demo data
    const { count: callCount } = await serviceSupabase
      .from("calls")
      .select("*", { count: "exact", head: true });
    
    const demoIndex = (callCount || 0) % DEMO_NAMES.length;
    const customerName = DEMO_NAMES[demoIndex];
    const repName = DEMO_REPS[demoIndex % DEMO_REPS.length];
    const repEmail = repName.toLowerCase().replace(/\s+/g, '.') + "@creditclub.com";
    
    // Find or create demo rep
    let repId: string | null = null;
    const { data: existingRep } = await serviceSupabase
      .from("reps")
      .select("id")
      .eq("name", repName)
      .single();
    
    if (existingRep) {
      repId = existingRep.id;
    } else {
      // Create demo rep
      const { data: newRep } = await serviceSupabase
        .from("reps")
        .insert({
          org_id: DEFAULT_ORG_ID,
          clerk_user_id: `demo_${repName.toLowerCase().replace(/\s+/g, '_')}`,
          email: repEmail,
          name: repName,
          role: repName.includes("Manager") ? "manager" : "closer",
          status: "active",
        })
        .select()
        .single();
      if (newRep) repId = newRep.id;
    }
    
    // Generate realistic scores (6-9 range)
    const scores = {
      opening: Math.floor(Math.random() * 4) + 6,
      discovery: Math.floor(Math.random() * 4) + 6,
      rapport: Math.floor(Math.random() * 4) + 6,
      objection_handling: Math.floor(Math.random() * 4) + 6,
      closing: Math.floor(Math.random() * 4) + 6,
      structure: Math.floor(Math.random() * 4) + 6,
      product_knowledge: Math.floor(Math.random() * 4) + 6,
    };
    
    const avgScore = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 7) * 10) / 10;
    
    // Create the call directly (bypass webhook for demo data)
    const { data: newCall, error: callError } = await serviceSupabase
      .from("calls")
      .insert({
        org_id: DEFAULT_ORG_ID,
        rep_id: repId,
        fathom_call_id: `demo_call_${Date.now()}`,
        title: `${customerName} - Discovery Call`,
        occurred_at: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
        transcript: DEMO_TRANSCRIPTS[demoIndex % DEMO_TRANSCRIPTS.length],
        recording_url: "https://example.com/demo-recording.mp4",
        metadata: {
          source: "demo_webhook",
          customer_name: customerName,
          demo_index: demoIndex,
        },
      })
      .select()
      .single();
    
    if (callError || !newCall) {
      console.error("Failed to create demo call:", callError);
      return NextResponse.json({
        success: false,
        error: callError?.message || "Failed to create call",
      }, { status: 500 });
    }
    
    // Create call scores
    const strengths = DEMO_STRENGTHS[demoIndex % DEMO_STRENGTHS.length];
    const improvements = DEMO_IMPROVEMENTS[demoIndex % DEMO_IMPROVEMENTS.length];
    
    const { error: scoreError } = await serviceSupabase
      .from("call_scores")
      .insert({
        call_id: newCall.id,
        opening_score: scores.opening,
        discovery_score: scores.discovery,
        rapport_score: scores.rapport,
        objection_handling_score: scores.objection_handling,
        closing_score: scores.closing,
        structure_score: scores.structure,
        product_knowledge_score: scores.product_knowledge,
        ai_summary: `Good discovery call with ${customerName}. Rep demonstrated solid product knowledge and built rapport effectively. Overall score: ${avgScore}/10.`,
        strengths: JSON.stringify(strengths),
        improvements: JSON.stringify(improvements),
      });
    
    if (scoreError) {
      console.error("Failed to create scores:", scoreError);
    }
    
    // Flag low-scoring calls
    if (avgScore < 7) {
      await serviceSupabase.from("flags").insert({
        org_id: DEFAULT_ORG_ID,
        call_id: newCall.id,
        type: "coaching_needed",
        note: `Low score (${avgScore}/10). Review ${improvements.join(", ")}.`,
      });
    }
    
    return NextResponse.json({
      success: true,
      callId: newCall.id,
      demoData: {
        customerName,
        repName,
        avgScore,
        scores,
      }
    });
    
  } catch (error) {
    console.error("[TEST_WEBHOOK] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
