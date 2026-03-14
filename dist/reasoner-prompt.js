"use strict";
// cherry-worker/reasoner-prompt.ts
// Prompt template for the reasoning agent that scores sales calls
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORING_RUBRIC = void 0;
exports.buildScoringPrompt = buildScoringPrompt;
exports.SCORING_RUBRIC = {
    categories: [
        'rapport_tone',
        'discovery_quality',
        'call_control',
        'pain_amplification',
        'offer_explanation',
        'objection_handling',
        'urgency_close_attempt',
        'confidence_authority',
        'next_steps_clarity',
        'overall_close_quality',
    ],
    closeTypes: ['deposit', 'full_close', 'partial_access', 'payment_plan', null],
    outcomes: ['closed', 'follow_up', 'no_sale', 'disqualified'],
    qualityLabels: ['poor', 'average', 'strong', 'elite'],
};
function buildScoringPrompt(transcript, agentName) {
    const agentCtx = agentName ? `The sales agent's name is "${agentName}".` : '';
    return `You are an expert sales call analyst for Credit Club, a premium credit repair and financial optimization service. ${agentCtx}

## Product Context — Credit Club

Credit Club helps clients improve their credit scores through:
- Dispute processing with all three bureaus (Equifax, Experian, TransUnion)
- Debt negotiation and settlement strategies
- Credit building via authorized-user tradelines
- Financial coaching and budgeting plans
- Identity theft resolution
- Business credit building programs

Typical packages range from $500–$3,000 upfront or $99–$299/month. Closers aim to collect a deposit ($200–$500) or full payment on the first call. The ideal call follows: rapport → discovery → pain amplification → offer presentation → objection handling → close attempt → next steps.

## Your Task

Analyze the following sales call transcript and produce a detailed scoring assessment.

## IMPORTANT: Transcript Format Handling

The transcript may contain speaker labels in various formats:
- "Speaker Name: What they said" (standard format)
- Multiple speakers on one line: "Speaker A: Hello. Speaker B: Hi there."
- "Rep:" or "Agent:" for the sales rep
- "Prospect:", "Customer:", or the prospect's name

When analyzing:
1. Look for speaker indicators (names followed by colons) to identify turns
2. If multiple speakers appear on one line, split mentally by the colon+name pattern
3. Count total conversation turns (should be 20+ for a real sales call)
4. If transcript length > 20,000 characters, treat as VALID and score fully

## Scoring Rubric — 10 Categories (0–10 each)

For each category, assign an integer score 0–10, explain your reasoning in 1–2 sentences, and quote a short verbatim excerpt from the transcript as evidence.

1. **rapport_tone** — Did the agent build genuine rapport? Warm, conversational, empathetic? Or robotic/scripted?
2. **discovery_quality** — Did the agent ask probing questions to understand the client's situation, goals, and timeline? Did they uncover the real motivation?
3. **call_control** — Did the agent guide the conversation or let the prospect ramble? Did they redirect tangents and maintain authority?
4. **pain_amplification** — Did the agent deepen the emotional impact of the prospect's credit problems? Did they connect poor credit to real-life consequences?
5. **offer_explanation** — Was the Credit Club offer clearly explained? Were benefits tied to the prospect's specific pain points?
6. **objection_handling** — How well did the agent address concerns (price, timing, trust, spouse, etc.)? Did they isolate, empathize, and reframe?
7. **urgency_close_attempt** — Did the agent create urgency? Did they actually ask for the sale? How many close attempts?
8. **confidence_authority** — Did the agent sound confident, knowledgeable, and authoritative? Or uncertain and hesitant?
9. **next_steps_clarity** — Were clear next steps established? Does the prospect know exactly what happens next?
10. **overall_close_quality** — Holistic assessment of the close attempt. Was it natural, assumptive, and well-timed?

## Classification

Determine:
- **outcome**: One of: closed, follow_up, no_sale, disqualified
  - "closed" = prospect agreed to pay / gave payment info
  - "follow_up" = prospect showed interest but didn't commit; callback scheduled
  - "no_sale" = prospect declined, no future commitment
  - "disqualified" = prospect doesn't qualify (wrong product, no credit issues, etc.)

- **close_type**: One of: deposit, full_close, partial_access, payment_plan, null
  - "deposit" = collected partial upfront payment
  - "full_close" = collected full payment
  - "partial_access" = gave limited access pending full payment
  - "payment_plan" = set up installment arrangement
  - null = no close occurred

- **quality_label**: Based on overall_score (sum of all 10 categories):
  - 0–40 = "poor"
  - 41–60 = "average"
  - 61–80 = "strong"
  - 81–100 = "elite"

- **low_signal**: Boolean indicating if the transcript is too short or lacks sufficient conversation to score meaningfully.
  - Set to true if transcript length is less than 500 characters OR conversation has fewer than 10 turns
  - Set to false for all normal sales calls with sufficient content
  - IMPORTANT: If transcript length is greater than 20,000 characters, ALWAYS set low_signal to false (it is definitely a real call)

## Output Format

Return ONLY valid JSON matching this exact structure (no markdown fences, no commentary outside the JSON):

{
  "overall_score": <0-100>,
  "quality_label": "<poor|average|strong|elite>",
  "outcome": "<closed|follow_up|no_sale|disqualified>",
  "close_type": "<deposit|full_close|partial_access|payment_plan|null>",
  "low_signal": <true|false>,
  "categories": {
    "rapport_tone": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "discovery_quality": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "call_control": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "pain_amplification": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "offer_explanation": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "objection_handling": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "urgency_close_attempt": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "confidence_authority": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "next_steps_clarity": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" },
    "overall_close_quality": { "score": <0-10>, "reasoning": "<1-2 sentences>", "evidence": "<verbatim quote>" }
  },
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "objections_detected": ["<objection 1>", ...],
  "objections_handled_well": ["<objection that was handled effectively>", ...],
  "objections_missed": ["<objection that was ignored or poorly handled>", ...],
  "next_coaching_actions": ["<specific actionable coaching tip 1>", ...],
  "coaching_markers": [
    {
      "timestamp": "MM:SS",
      "seconds": <total seconds from start>,
      "title": "<short descriptive title>",
      "category": "<one of the 10 scoring categories>",
      "type": "<positive|negative>",
      "severity": "<high|medium|low>",
      "note": "<1-2 sentence explanation grounded in transcript>"
    }
  ]
}

## Coaching Markers Instructions

Extract 5-10 key coaching moments from the transcript. These are specific timestamps where something notable happened — good or bad. Focus on:
- Strong rapport moments (positive)
- Missed discovery questions (negative)
- Weak objection handling (negative)
- Strong close attempts (positive)
- Missed close opportunities (negative)
- Good pain amplification (positive)
- Poor offer explanation (negative)
- Good urgency creation (positive)
- Weak next steps (negative)

Rules:
- Each marker MUST be grounded in actual transcript content
- Use real timestamps if they appear in the transcript
- If no timestamps are available, estimate approximate position based on transcript flow and set timestamp to "~MM:SS" (approximate)
- Do NOT hallucinate timestamps — if you cannot determine timing, use "00:00" with seconds=0 and note it in the marker
- Focus on the 5-10 most useful moments for a coaching review
- Mix of positive and negative markers
- severity=high for critical coaching moments, medium for notable ones, low for minor observations

## Transcript

${transcript}`;
}
