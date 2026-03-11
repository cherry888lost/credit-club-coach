import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calls/[id]/follow-up
 * 
 * Generate follow-up messages (WhatsApp, SMS, Email) based on call analysis.
 * References specific conversation points from the call.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: callId } = await params;
  const body = await request.json();
  const { prospect_name, format } = body; // format: "all" | "whatsapp" | "sms" | "email"

  try {
    const supabase = await createServiceClient();

    // Fetch call + score data
    const { data: call } = await supabase
      .from("calls")
      .select("id, title, transcript, summary, org_id, rep_id, reps(name)")
      .eq("id", callId)
      .single();

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const { data: score } = await supabase
      .from("call_scores")
      .select("*")
      .eq("call_id", callId)
      .single();

    if (!score) {
      return NextResponse.json(
        { error: "Call must be scored before generating follow-ups" },
        { status: 400 }
      );
    }

    // Build follow-up generation prompt
    const prompt = buildFollowUpPrompt(call, score, prospect_name);

    // Call OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are a follow-up message generator for Credit Club sales. Generate professional but conversational messages. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: "AI generation failed", details: errText.substring(0, 500) },
        { status: 502 }
      );
    }

    const data = await response.json();
    let rawContent = data.choices[0].message.content.trim();
    
    // Strip markdown fences
    if (rawContent.startsWith("```")) {
      rawContent = rawContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const messages = JSON.parse(rawContent);

    // Store in database
    const { data: saved, error: saveError } = await supabase
      .from("follow_up_messages")
      .insert({
        org_id: call.org_id,
        call_id: callId,
        score_id: score.id,
        whatsapp_message: messages.whatsapp,
        sms_message: messages.sms,
        email_subject: messages.email_subject,
        email_body: messages.email_body,
        prospect_name: prospect_name || null,
        key_pain_points: messages.key_pain_points || [],
        discussed_topics: messages.discussed_topics || [],
        next_steps: messages.next_steps || null,
        cta: messages.cta || null,
        model_version: "follow-up-v1",
      })
      .select("id")
      .single();

    if (saveError) {
      console.error("[FOLLOW-UP] Save error:", saveError);
      // Still return the messages even if save fails
    }

    return NextResponse.json({
      status: "ok",
      id: saved?.id,
      messages,
    });

  } catch (err: any) {
    console.error("[FOLLOW-UP] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}

function buildFollowUpPrompt(call: any, score: any, prospectName?: string): string {
  const name = prospectName || "the prospect";
  const repName = (call.reps as any)?.name || "the rep";
  const outcome = score.manual_outcome || score.outcome || "unknown";
  const painPoints = score.weaknesses || [];
  const strengths = score.strengths || [];
  const objections = score.objections_detected || [];
  const summary = call.summary || "";
  
  // Extract key discussion points from transcript (first 3000 chars for context)
  const transcriptSnippet = call.transcript
    ? call.transcript.substring(0, 3000)
    : "";

  return `Generate follow-up messages for a Credit Club sales call.

CONTEXT:
- Prospect name: ${name}
- Rep name: ${repName}
- Call outcome: ${outcome}
- Key strengths from call: ${strengths.slice(0, 3).join("; ")}
- Objections raised: ${objections.join("; ") || "none detected"}
- Call summary: ${summary}

TRANSCRIPT EXCERPT (for specific references):
${transcriptSnippet}

CREDIT CLUB PRODUCT:
- £3,000 premium credit card education course
- Skool community + training videos + 1-1 Telegram support
- Focus: UK credit cards, Amex, travel rewards optimization

REQUIREMENTS:
1. Reference SPECIFIC things discussed in the call (not generic)
2. Address any unresolved objections naturally
3. Include a clear next step / CTA
4. Tone: professional but warm and conversational (not salesy)
5. For "follow_up" outcome: re-engage interest
6. For "no_sale" outcome: leave door open, provide value
7. For "closed" outcome: confirmation and excitement

Generate JSON:
{
  "whatsapp": "WhatsApp message (casual, short, with emojis)",
  "sms": "SMS message (under 160 chars, punchy)",
  "email_subject": "Email subject line",
  "email_body": "Full email body (3-4 paragraphs)",
  "key_pain_points": ["pain point referenced in messages"],
  "discussed_topics": ["specific topic from transcript referenced"],
  "next_steps": "What the CTA asks them to do",
  "cta": "The specific call to action"
}`;
}

/**
 * GET /api/calls/[id]/follow-up
 * Fetch previously generated follow-up messages.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: callId } = await params;

  try {
    const supabase = await createServiceClient();

    const { data: messages } = await supabase
      .from("follow_up_messages")
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({ messages: messages || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
