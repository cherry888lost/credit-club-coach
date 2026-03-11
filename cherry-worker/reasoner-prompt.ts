// cherry-worker/reasoner-prompt.ts
// Prompt template for the reasoning agent that scores sales calls

export const SCORING_RUBRIC = {
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
  closeTypes: ['deposit', 'full_close', 'partial_access', 'payment_plan', null] as const,
  outcomes: ['closed', 'follow_up', 'no_sale', 'disqualified'] as const,
  qualityLabels: ['poor', 'average', 'strong', 'elite'] as const,
} as const;

export type CloseType = (typeof SCORING_RUBRIC.closeTypes)[number];
export type Outcome = (typeof SCORING_RUBRIC.outcomes)[number];
export type QualityLabel = (typeof SCORING_RUBRIC.qualityLabels)[number];

export interface CategoryScore {
  score: number;
  reasoning: string;
  evidence: string;
}

export interface ScoringResult {
  overall_score: number;
  quality_label: QualityLabel;
  outcome: Outcome;
  close_type: CloseType;
  categories: Record<string, CategoryScore>;
  strengths: string[];
  weaknesses: string[];
  objections_detected: string[];
  objections_handled_well: string[];
  objections_missed: string[];
  next_coaching_actions: string[];
}

export function buildScoringPrompt(transcript: string, agentName?: string): string {
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

## Output Format

Return ONLY valid JSON matching this exact structure (no markdown fences, no commentary outside the JSON):

{
  "overall_score": <0-100>,
  "quality_label": "<poor|average|strong|elite>",
  "outcome": "<closed|follow_up|no_sale|disqualified>",
  "close_type": "<deposit|full_close|partial_access|payment_plan|null>",
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
  "next_coaching_actions": ["<specific actionable coaching tip 1>", ...]
}

## Transcript

${transcript}`;
}
