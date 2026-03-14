/**
 * Credit Club Sales Scoring Prompts V2
 * 
 * Enhanced with:
 * - Pattern library integration
 * - Actionable coaching output (what_went_wrong, why_it_matters, better_response_example)
 * - Specific objection handling scripts
 * - Credit Club context in all feedback
 */

export { SCORING_CATEGORIES, MIN_TRANSCRIPT_LENGTH, CLOSE_TYPES, OUTCOMES } from './prompts';
export type { ScoringCategory, CloseType, Outcome } from './prompts';

export const PATTERN_CATEGORIES = [
  'discovery_depth',
  'pain_amplification', 
  'authority_demo',
  'objection_handling',
  'close_attempts',
  'urgency_creation',
] as const;

export type PatternCategory = typeof PATTERN_CATEGORIES[number];

export interface EnhancedWeakness {
  category: string;
  what_went_wrong: string;
  why_it_matters: string;
  better_response_example: string;
  credit_club_context?: string;
}

export interface ObjectionScript {
  objection: string;
  prospect_said: string;
  rep_said: string;
  better_response: string;
  technique: string;
}

export interface PatternData {
  score?: number;
  techniques?: string[];
  key_questions?: string[];
  trigger_phrases?: string[];
  credibility_moves?: string[];
  evidence?: string;
  reusable_template?: string;
  objections?: Array<{
    objection: string;
    response: string;
    technique: string;
  }>;
  count?: number;
  timing?: string;
}

export interface ExtractedPatterns {
  discovery_depth: PatternData;
  pain_amplification: PatternData;
  authority_demo: PatternData;
  objection_handling: PatternData;
  close_attempts: PatternData;
  urgency_creation: PatternData;
  overall_assessment?: string;
}

/**
 * Build the V2 scoring prompt with pattern references and enhanced coaching.
 */
export function buildScoringPromptV2(
  transcript: string,
  winningPatterns?: Array<{ extracted_patterns: ExtractedPatterns }>,
  repName?: string
): string {
  const patternContext = buildPatternContext(winningPatterns);

  return `You are an expert sales coach analyzing a Credit Club sales call transcript.
${repName ? `The sales rep is "${repName}".` : ''}

## Credit Club Context
- Product: Premium credit card education course (£3,000)
- Focus: UK credit cards, Amex UK (personal + business), transfer partners (Avios, Emirates Skywards, Marriott Bonvoy)
- Delivery: Skool community + training videos + 1-1 Telegram support
- Target: People who want to optimize credit card points and travel rewards
- Close types: full_close (paid £3,000), deposit (£200-£500 upfront), payment_plan (installments), partial_access (limited access pending full payment)
${patternContext}

## Scoring Rubric (0-10 each, 10 categories)

1. **rapport_tone** — Genuine warmth, trust-building, natural flow
2. **discovery_quality** — Depth of questions about situation, goals, timeline, motivation
3. **call_control** — Guiding conversation, redirecting tangents, authority
4. **pain_amplification** — Deepening emotional impact, connecting to real consequences
5. **offer_explanation** — Clarity, benefit-focused, tied to specific pain points
6. **objection_handling** — Isolate, empathize, reframe technique
7. **urgency_close_attempt** — Creating urgency, confident close asks
8. **confidence_authority** — Certainty, expertise positioning, trust
9. **next_steps_clarity** — Clear next steps, confirmed commitment, timeline
10. **overall_close_quality** — Holistic conversion assessment

## Enhanced Output Requirements

### For EACH category, provide:
- score (0-10)
- reasoning (1-2 sentences)
- evidence (verbatim quote from transcript)
- improvement_tip (specific, actionable)

### For EACH weakness, also provide enhanced_weaknesses with:
- **what_went_wrong**: The specific moment/behavior that was suboptimal
- **why_it_matters**: How it impacts conversion probability (with Credit Club context)
- **better_response_example**: An EXACT script they could have used, specific to Credit Club

### For EACH objection detected, provide objection_scripts with:
- **objection**: The objection category
- **prospect_said**: Direct quote of what the prospect actually said
- **rep_said**: Direct quote of how the rep responded
- **better_response**: A better response script for Credit Club context
- **technique**: Name of the technique (e.g., "Isolate-Empathize-Reframe", "Feel-Felt-Found")

### All coaching MUST reference Credit Club context:
- Price objections → reference the £3,000 value vs. lifetime of wasted points
- Trust objections → reference the Skool community proof, 1-1 Telegram support, success stories
- Timing objections → reference upcoming cohort dates, Amex sign-up bonuses that expire
- "I need to think" → reference the risk of waiting (credit card bonuses change, points devalue)

## Transcript
---
${transcript.substring(0, 15000)}
---

## Required JSON Output (no markdown fences, no commentary):
{
  "overall_score": 0-100,
  "quality_label": "poor|average|strong|elite",
  "outcome": "closed|follow_up|no_sale|disqualified",
  "close_type": null,
  "categories": {
    "<category>": {
      "score": 0-10,
      "reasoning": "1-2 sentences",
      "evidence": "verbatim transcript quote",
      "improvement_tip": "specific actionable tip"
    }
  },
  "strengths": ["specific strength with evidence"],
  "weaknesses": ["brief weakness description"],
  "enhanced_weaknesses": [
    {
      "category": "category_name",
      "what_went_wrong": "Specific description",
      "why_it_matters": "Impact on conversion with Credit Club context",
      "better_response_example": "Exact Credit Club script example"
    }
  ],
  "objections_detected": ["objection"],
  "objections_handled_well": ["well-handled objection"],
  "objections_missed": ["missed objection"],
  "objection_scripts": [
    {
      "objection": "The objection",
      "prospect_said": "direct quote",
      "rep_said": "what they responded",
      "better_response": "Credit Club specific better script",
      "technique": "Technique name"
    }
  ],
  "next_coaching_actions": ["specific coaching action"],
  "coaching_markers": [
    {
      "timestamp": "MM:SS",
      "seconds": 0,
      "title": "Short descriptive title",
      "category": "one of the 10 scoring categories",
      "type": "positive|negative",
      "severity": "high|medium|low",
      "note": "1-2 sentence explanation grounded in transcript"
    }
  ]
}

## Coaching Markers Instructions

Extract 5-10 key coaching moments from the transcript — specific timestamps where something notable happened (good or bad):
- Strong rapport moments, missed discovery, weak objection handling, strong close attempts, missed close opportunities, good pain amplification, poor offer explanation, good urgency creation, weak next steps
- Each marker MUST be grounded in actual transcript content
- Use real timestamps if available; if not, estimate approximate position and prefix with "~"
- Do NOT hallucinate timestamps — if timing is truly unknown, use "00:00" with seconds=0
- 5-10 most useful moments, mix of positive and negative, severity=high for critical moments

CRITICAL RULES:
- Be honest and critical — inflate nothing
- Most calls score 5-7 (average range)
- Do NOT guess close_type — set null unless prospect clearly committed to pay
- enhanced_weaknesses should have REAL script examples, not vague advice
- objection_scripts must include actual quotes from the transcript
- ALL feedback must be Credit Club specific, not generic sales advice`;
}

function buildPatternContext(
  patterns?: Array<{ extracted_patterns: ExtractedPatterns }>
): string {
  if (!patterns || patterns.length === 0) return '';

  const sections: string[] = [];

  for (const p of patterns.slice(0, 3)) {
    const ep = p.extracted_patterns;
    if (!ep) continue;

    const lines: string[] = [];
    
    if (ep.discovery_depth?.techniques?.length) {
      lines.push(`  - Discovery: ${ep.discovery_depth.techniques.join(', ')}`);
    }
    if (ep.pain_amplification?.trigger_phrases?.length) {
      lines.push(`  - Pain triggers: "${ep.pain_amplification.trigger_phrases.join('", "')}"` );
    }
    if (ep.authority_demo?.credibility_moves?.length) {
      lines.push(`  - Authority: ${ep.authority_demo.credibility_moves.join(', ')}`);
    }
    if (ep.objection_handling?.objections?.length) {
      for (const obj of ep.objection_handling.objections.slice(0, 2)) {
        lines.push(`  - Objection "${obj.objection}" → ${obj.technique}`);
      }
    }
    if (ep.close_attempts?.techniques?.length) {
      lines.push(`  - Close: ${ep.close_attempts.techniques.join(', ')}`);
    }
    if (ep.urgency_creation?.trigger_phrases?.length) {
      lines.push(`  - Urgency: "${ep.urgency_creation.trigger_phrases.join('", "')}"` );
    }

    if (lines.length > 0) {
      sections.push(lines.join('\n'));
    }
  }

  if (sections.length === 0) return '';

  return `\n## Winning Patterns from Your Team (benchmark)

These techniques have been used in successful closes:\n\n${sections.join('\n\n')}\n\nUse these as benchmarks. Note when the rep uses or misses these proven techniques.`;
}

/**
 * Build pattern extraction prompt for analyzing winning calls.
 */
export function buildPatternExtractionPrompt(
  transcript: string,
  outcome: string,
  closeType?: string | null
): string {
  return `Analyze this Credit Club sales call transcript and extract winning patterns.

CALL OUTCOME: ${outcome}${closeType ? ` (${closeType})` : ''}

CREDIT CLUB CONTEXT:
- £3,000 premium credit card education course
- UK credit cards, Amex, travel rewards
- Skool community + 1-1 Telegram support

TRANSCRIPT:
---
${transcript.substring(0, 12000)}
---

Extract patterns in 6 categories:

{
  "discovery_depth": {
    "score": 0-10,
    "techniques": ["technique"],
    "key_questions": ["effective question asked"],
    "evidence": "verbatim quote",
    "reusable_template": "Template version for other reps"
  },
  "pain_amplification": {
    "score": 0-10,
    "techniques": ["technique"],
    "trigger_phrases": ["phrase that amplified pain"],
    "evidence": "verbatim quote",
    "reusable_template": "Template"
  },
  "authority_demo": {
    "score": 0-10,
    "techniques": ["technique"],
    "credibility_moves": ["move"],
    "evidence": "verbatim quote",
    "reusable_template": "Template"
  },
  "objection_handling": {
    "score": 0-10,
    "objections": [{ "objection": "...", "response": "...", "technique": "..." }],
    "evidence": "verbatim quote",
    "reusable_template": "Template"
  },
  "close_attempts": {
    "count": 0,
    "techniques": ["technique"],
    "timing": "When in call",
    "evidence": "verbatim quote",
    "reusable_template": "Template"
  },
  "urgency_creation": {
    "score": 0-10,
    "techniques": ["technique"],
    "trigger_phrases": ["phrase"],
    "evidence": "verbatim quote",
    "reusable_template": "Template"
  },
  "overall_assessment": "Brief summary"
}`;
}
