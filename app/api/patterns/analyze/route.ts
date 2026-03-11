import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { getDefaultOrgId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/patterns/analyze
 * 
 * Analyze a call transcript and extract winning patterns.
 * Used for building the pattern library from successful calls.
 * 
 * Body: { call_id: string } or { transcript: string, outcome: string, close_type?: string }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const supabase = await createServiceClient();
    const orgId = await getDefaultOrgId();

    let transcript: string;
    let callId: string | null = null;
    let outcome: string;
    let closeType: string | null = null;
    let repName: string | null = null;
    let callDate: string | null = null;
    let overallScore: number | null = null;

    if (body.call_id) {
      // Analyze from existing call
      const { data: call } = await supabase
        .from("calls")
        .select("id, transcript, org_id, reps(name), occurred_at")
        .eq("id", body.call_id)
        .single();

      if (!call || !call.transcript) {
        return NextResponse.json({ error: "Call not found or has no transcript" }, { status: 404 });
      }

      transcript = call.transcript;
      callId = call.id;
      repName = (call.reps as any)?.name || null;
      callDate = call.occurred_at;

      // Get score data
      const { data: score } = await supabase
        .from("call_scores")
        .select("manual_outcome, outcome, manual_close_type, close_type, overall_score")
        .eq("call_id", body.call_id)
        .single();

      if (score) {
        outcome = score.manual_outcome || score.outcome || body.outcome || "closed";
        closeType = score.manual_close_type || score.close_type || body.close_type || null;
        overallScore = score.overall_score;
      } else {
        outcome = body.outcome || "closed";
        closeType = body.close_type || null;
      }
    } else if (body.transcript) {
      // Analyze from raw transcript
      transcript = body.transcript;
      outcome = body.outcome || "closed";
      closeType = body.close_type || null;
    } else {
      return NextResponse.json(
        { error: "Provide either call_id or transcript" },
        { status: 400 }
      );
    }

    if (transcript.length < 500) {
      return NextResponse.json(
        { error: "Transcript too short for pattern extraction (min 500 chars)" },
        { status: 400 }
      );
    }

    // Call AI to extract patterns
    const prompt = buildPatternExtractionPrompt(transcript, outcome, closeType);

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
        model: "gpt-5.4",
        messages: [
          {
            role: "system",
            content: "You are a sales pattern analyst for Credit Club. Extract winning sales patterns from transcripts. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: "AI analysis failed", details: errText.substring(0, 500) },
        { status: 502 }
      );
    }

    const data = await response.json();
    let rawContent = data.choices[0].message.content.trim();
    if (rawContent.startsWith("```")) {
      rawContent = rawContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const patterns = JSON.parse(rawContent);

    // Save to winning_call_patterns
    const { data: saved, error: saveError } = await supabase
      .from("winning_call_patterns")
      .insert({
        org_id: orgId,
        call_id: callId,
        outcome,
        close_type: closeType,
        overall_score: overallScore,
        extracted_patterns: patterns,
        rep_name: repName,
        call_date: callDate,
        notes: body.notes || null,
      })
      .select("id")
      .single();

    if (saveError) {
      console.error("[PATTERNS] Save error:", saveError);
      return NextResponse.json(
        { error: "Failed to save patterns", details: saveError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      id: saved.id,
      patterns,
    });

  } catch (err: any) {
    console.error("[PATTERNS] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}

function buildPatternExtractionPrompt(
  transcript: string,
  outcome: string,
  closeType: string | null
): string {
  return `Analyze this Credit Club sales call transcript and extract winning patterns.

CALL OUTCOME: ${outcome}${closeType ? ` (${closeType})` : ""}

CREDIT CLUB CONTEXT:
- £3,000 premium credit card education course
- UK credit cards, Amex, travel rewards
- Skool community + 1-1 Telegram support

TRANSCRIPT:
---
${transcript.substring(0, 12000)}
---

Extract patterns in these 6 categories. For each, identify:
- Specific techniques used
- Key phrases/questions that worked
- Direct evidence (quotes from transcript)
- A "reusable template" version of the technique

Output JSON:
{
  "discovery_depth": {
    "score": 0-10,
    "techniques": ["technique 1", "technique 2"],
    "key_questions": ["actual question asked that worked well"],
    "evidence": "verbatim quote showing effective discovery",
    "reusable_template": "A template version other reps can use"
  },
  "pain_amplification": {
    "score": 0-10,
    "techniques": ["technique 1"],
    "trigger_phrases": ["phrase that amplified pain"],
    "evidence": "verbatim quote",
    "reusable_template": "Template for pain amplification"
  },
  "authority_demo": {
    "score": 0-10,
    "techniques": ["how they demonstrated authority"],
    "credibility_moves": ["specific credibility moves"],
    "evidence": "verbatim quote",
    "reusable_template": "Template for authority building"
  },
  "objection_handling": {
    "score": 0-10,
    "objections": [
      {
        "objection": "What the prospect said",
        "response": "How the rep handled it",
        "technique": "Name of the technique used"
      }
    ],
    "evidence": "verbatim quote of best objection handling",
    "reusable_template": "Template for this type of objection"
  },
  "close_attempts": {
    "count": 0,
    "techniques": ["close technique used"],
    "timing": "When in the call closes were attempted",
    "evidence": "verbatim quote of best close attempt",
    "reusable_template": "Template close script"
  },
  "urgency_creation": {
    "score": 0-10,
    "techniques": ["urgency technique used"],
    "trigger_phrases": ["urgency phrases that worked"],
    "evidence": "verbatim quote",
    "reusable_template": "Template for creating urgency"
  },
  "overall_assessment": "Brief summary of what made this call successful or unsuccessful"
}`;
}
