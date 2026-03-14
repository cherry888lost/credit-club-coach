// cherry-worker/reasoner-prompt.ts
// Prompt template for the reasoning agent that scores sales calls

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Knowledge File Loading (Files 1-5 are active context, File 6 is memory only)
// ---------------------------------------------------------------------------

const KNOWLEDGE_DIR = join(__dirname, '../lib/scoring/knowledge');

function loadKnowledgeFile(filename: string): string {
  try {
    return readFileSync(join(KNOWLEDGE_DIR, filename), 'utf-8');
  } catch (err) {
    console.warn(`[reasoner-prompt] Failed to load knowledge file: ${filename}`);
    return '';
  }
}

// Load active knowledge files (1-5) into prompt context
const CREDIT_CLUB_CONTEXT = loadKnowledgeFile('credit-club-context.md');
const CREDIT_CLUB_OFFER_MECHANISM = loadKnowledgeFile('credit-club-offer-mechanism.md');
const CREDIT_CLUB_CLOSE_TYPES = loadKnowledgeFile('credit-club-close-types.md');
const CREDIT_CLUB_SCORING_RULES = loadKnowledgeFile('credit-club-scoring-rules.md');

// NOTE: File 6 (credit-club-approved-learnings.md) is TEMPLATE ONLY for now
// It should NOT be loaded as active context until human-approved learnings are added
// const CREDIT_CLUB_APPROVED_LEARNINGS = loadKnowledgeFile('credit-club-approved-learnings.md');

// ---------------------------------------------------------------------------
// Credit Club Knowledge Base Loading (~/credit-club-kb/)
// ---------------------------------------------------------------------------

const KB_ROOT = join(process.env.HOME || '/Users/papur', 'credit-club-kb');

function loadKBDirectory(subdir: string): string {
  try {
    const dir = join(KB_ROOT, subdir);
    const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    return files.map(f => {
      const content = readFileSync(join(dir, f), 'utf-8');
      return `### ${f.replace('.md', '').replace(/_/g, ' ').toUpperCase()}\n${content}`;
    }).join('\n\n---\n\n');
  } catch (err) {
    console.warn(`[reasoner-prompt] Failed to load KB directory: ${subdir}`);
    return '';
  }
}

const KB_CLOSES = loadKBDirectory('closes');
const KB_OBJECTIONS = loadKBDirectory('objections');
const KB_TECHNIQUES = loadKBDirectory('techniques');
const KB_PRICING = loadKBDirectory('pricing');

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

export interface CoachingMarker {
  timestamp: string;
  seconds: number;
  title: string;
  category: string;
  type: 'positive' | 'negative';
  severity: 'high' | 'medium' | 'low';
  note: string;
}

export interface CoachSummary {
  did_well: string[];
  needs_work: string[];
  action_items: string[];
}

export interface ScoringResult {
  overall_score: number;
  quality_label: QualityLabel;
  outcome: Outcome;
  close_type: CloseType;
  low_signal: boolean;
  coach_summary: CoachSummary;
  categories: Record<string, CategoryScore>;
  strengths: string[];
  weaknesses: string[];
  objections_detected: string[];
  objections_handled_well: string[];
  objections_missed: string[];
  next_coaching_actions: string[];
  coaching_markers: CoachingMarker[];
}

export function buildScoringPrompt(transcript: string, agentName?: string): string {
  const agentCtx = agentName ? `The sales agent's name is "${agentName}".` : '';

  return `You are an expert sales call analyst and coach for Credit Club, a UK-focused credit, business-card, points-and-travel education and implementation programme. ${agentCtx}

================================================================================
FILE 1: CREDIT CLUB CONTEXT (What Credit Club Is)
================================================================================

${CREDIT_CLUB_CONTEXT}

================================================================================
FILE 2: CREDIT CLUB OFFER MECHANISM (What Members Receive)
================================================================================

${CREDIT_CLUB_OFFER_MECHANISM}

================================================================================
FILE 3: CREDIT CLUB CLOSE TYPES (Outcome Classification Rules)
================================================================================

${CREDIT_CLUB_CLOSE_TYPES}

================================================================================
FILE 4: CREDIT CLUB SCORING RULES (Category Scoring Guide)
================================================================================

${CREDIT_CLUB_SCORING_RULES}

================================================================================
KNOWLEDGE BASE: CLOSE PATTERNS (Benchmark Examples)
================================================================================
Use these as benchmark patterns. Compare the transcript against these real examples.

${KB_CLOSES}

================================================================================
KNOWLEDGE BASE: OBJECTION HANDLING PATTERNS
================================================================================
These are the objection types and handling patterns from real calls. Score the rep's handling against these benchmarks.

${KB_OBJECTIONS}

================================================================================
KNOWLEDGE BASE: SALES TECHNIQUES (Value Stacking & Urgency)
================================================================================
These are the techniques that elite reps use. Score whether the rep used them effectively.

${KB_TECHNIQUES}

================================================================================
KNOWLEDGE BASE: PRICING PSYCHOLOGY
================================================================================
This is how pricing should be positioned. Evaluate the rep's pricing conversation against these patterns.

${KB_PRICING}

================================================================================
YOUR TASK
================================================================================

Analyze the following sales call transcript and produce a detailed scoring assessment. Compare the rep's performance against the knowledge base patterns above.

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

## Classification Reminders (from File 3)

- **outcome**: One of: closed, follow_up, no_sale, disqualified
  - "closed" = prospect agreed to pay / gave payment info
  - "follow_up" = prospect showed interest but didn't commit; callback scheduled
  - "no_sale" = prospect declined, no future commitment
  - "disqualified" = prospect doesn't qualify (wrong product, no credit issues, etc.)

- **close_type**: One of: deposit, full_close, partial_access, payment_plan, null
  - "deposit" = collected partial upfront payment (typically £300-500)
  - "full_close" = collected full payment (typically £3,000)
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

## SCORING BEHAVIOR — What to Reward and Penalize

**REWARD (score higher):**
- Strong discovery that uncovers specific pain points, goals, timeline, and motivation
- Pain amplification that deepens emotional impact of credit/financial problems
- Clear value stack using ROI math, software demo, testimonials, support system, community
- Precise objection handling: isolate → empathize → reframe (compare against KB objection patterns)
- Clear close ask — actually asking for the sale, not hinting
- Deposit/commitment/payment plan attempt when full close isn't possible
- Good next steps with specific dates, times, actions
- Confidence and authority throughout

**PENALIZE (score lower):**
- Generic rapport with no substance (small talk that goes nowhere)
- Weak discovery — not asking about credit situation, goals, timeline
- No pain amplification — accepting surface-level problems
- No close ask — never actually asking for the sale
- No commitment attempt — not offering deposit, payment plan, or partial access when prospect stalls
- Vague next steps — "I'll send you some info" or "let me know"
- Soft objection handling — accepting "I need to think about it" at face value without probing
- Fake urgency — artificial scarcity that isn't real
- Missing deposit attempt when prospect can't pay in full

## OUTPUT QUALITY REQUIREMENTS

Your output MUST include:
1. **What the rep did well** — cite specific transcript moments, not generic praise
2. **What the rep did poorly** — cite specific transcript moments where they lost ground
3. **Exact moments that reduced close chance** — what specific thing did/didn't happen that hurt the deal
4. **Every objection that came up** — list them all with verbatim quotes
5. **Whether each objection was handled or missed** — be specific about what they said vs what they should have said
6. **Whether the close was asked clearly** — did they actually ask for the sale?
7. **Whether deposit/commitment/payment plan was attempted** — if prospect couldn't pay full, did rep offer alternatives?
8. **What the rep should have said/done differently** — specific, actionable, grounded in the KB patterns

## Coach Summary

In addition to the scoring, generate a coach_summary object with three sections:
1. **did_well**: 2-4 specific things the rep did well, with transcript evidence
2. **needs_work**: 2-4 specific things that hurt the call or were weak, with transcript evidence
3. **action_items**: 2-4 specific things to do differently next time, referencing KB techniques

## Output Format

Return ONLY valid JSON matching this exact structure (no markdown fences, no commentary outside the JSON):

{
  "overall_score": <0-100>,
  "quality_label": "<poor|average|strong|elite>",
  "outcome": "<closed|follow_up|no_sale|disqualified>",
  "close_type": "<deposit|full_close|partial_access|payment_plan|null>",
  "low_signal": <true|false>,
  "coach_summary": {
    "did_well": ["<specific thing with evidence>", ...],
    "needs_work": ["<specific weakness with evidence>", ...],
    "action_items": ["<specific action for next time>", ...]
  },
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
  "strengths": ["<specific strength with transcript evidence>", ...],
  "weaknesses": ["<specific weakness with transcript evidence>", ...],
  "objections_detected": ["<objection with verbatim quote>", ...],
  "objections_handled_well": ["<objection handled well with what rep said>", ...],
  "objections_missed": ["<objection missed or poorly handled — what they should have done>", ...],
  "next_coaching_actions": ["<specific actionable coaching tip referencing KB patterns>", ...],
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

## Scoring Reminders

1. Score real sales effectiveness, not generic friendliness
2. Do not over-score weak calls — most calls score 40-70
3. Do not reward empty rapport or generic small talk
4. Do not guess outcomes or close types without evidence
5. Prefer accurate null over guessed close_type
6. Use the exact rubric definitions from File 4 for each category
7. All evidence quotes must be verbatim from the transcript
8. Compare rep's performance against KB benchmark patterns — did they use the techniques from the knowledge base?
9. Be brutally honest — generic filler feedback is useless for coaching

================================================================================
TRANSCRIPT
================================================================================

${transcript}`;
}