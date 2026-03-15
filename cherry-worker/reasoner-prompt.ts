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
// PRIMARY COACHING FRAMEWORK - These MD files are the main visible teaching source
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

// PRIMARY FRAMEWORK: These MD files are the main coaching source
const KB_CLOSES = loadKBDirectory('closes');
const KB_OBJECTIONS = loadKBDirectory('objections');
const KB_TECHNIQUES = loadKBDirectory('techniques');
const KB_PRICING = loadKBDirectory('pricing');

// ---------------------------------------------------------------------------
// Internal Benchmark Library (~/credit-club-kb/benchmarks/)
// HIDDEN CALIBRATION ONLY - Used internally, NEVER exposed in output
// ---------------------------------------------------------------------------

const BENCHMARK_ROOT = join(KB_ROOT, 'benchmarks');

const BENCHMARK_LIBRARY = {
  full_close: [
    { name: 'Bina Patel', file: 'full_close/bina_patel.md' },
    { name: 'Luke Cockle', file: 'full_close/luke_cockle.md' },
    { name: 'Emma Foster', file: 'full_close/emma_foster.md' },
  ],
  deposit: [
    { name: 'Omar Pike', file: 'deposit/omar_pike.md' },
    { name: 'Fernando Cotrim', file: 'deposit/fernando_cotrim.md' },
    { name: 'Georgia Smith', file: 'deposit/georgia_smith.md' },
  ],
  partial_access: [
    { name: 'Mohit Garg', file: 'partial_access/mohit_garg.md' },
    { name: 'Rachel', file: 'partial_access/rachel.md' },
    { name: 'Andrika Das', file: 'partial_access/andrika_das.md' },
  ],
  payment_plan: [
    { name: 'Shamil Morjaria', file: 'payment_plan/shamil_morjaria.md' },
    { name: 'Nirmohan Singh Grover', file: 'payment_plan/nirmohan_singh_grover.md' },
    { name: 'Prismek Wegroc', file: 'payment_plan/prismek_wegroc.md' },
  ],
} as const;

function loadBenchmarkFile(filePath: string): string {
  try {
    return readFileSync(join(BENCHMARK_ROOT, filePath), 'utf-8');
  } catch (err) {
    console.warn(`[reasoner-prompt] Failed to load benchmark: ${filePath}`);
    return '';
  }
}

function loadBenchmarksForCloseType(closeType: string): string {
  const benchmarks = BENCHMARK_LIBRARY[closeType as keyof typeof BENCHMARK_LIBRARY];
  if (!benchmarks) return '';
  
  const parts = [];
  for (const bm of benchmarks) {
    const content = loadBenchmarkFile(bm.file);
    if (content && !content.includes('[PLACEHOLDER')) {
      // Extract key sections only to save tokens
      const lines = content.split('\n');
      const keyLines = [];
      let inWinningPatterns = false;
      
      for (const line of lines) {
        if (line.startsWith('## Winning Patterns') || line.startsWith('## Key Lines') || line.startsWith('## Key Quotes')) {
          inWinningPatterns = true;
          // Strip any names from the content - use anonymous patterns only
          keyLines.push(line.replace(/Bina Patel|Luke Cockle|Emma Foster|Omar Pike|Fernando Cotrim|Georgia Smith|Mohit Garg|Rachel|Andrika Das|Shamil Morjaria|Nirmohan Singh Grover|Prismek Wegroc/g, 'Example'));
        } else if (line.startsWith('## ')) {
          inWinningPatterns = false;
        } else if (inWinningPatterns && line.trim()) {
          // Strip names from content
          keyLines.push(line.replace(/Bina Patel|Luke Cockle|Emma Foster|Omar Pike|Fernando Cotrim|Georgia Smith|Mohit Garg|Rachel|Andrika Das|Shamil Morjaria|Nirmohan Singh Grover|Prismek Wegroc/g, 'Example'));
        }
      }
      
      parts.push(`### Example\n${keyLines.slice(0, 100).join('\n')}`);
    }
  }
  return parts.join('\n\n---\n\n');
}

// Internal calibration material - NEVER expose these names in output
const KB_BENCHMARKS = Object.keys(BENCHMARK_LIBRARY).map(type => {
  const benchmarks = loadBenchmarksForCloseType(type);
  return benchmarks ? `=== ${type.toUpperCase().replace('_', ' ')} PATTERNS ===\n${benchmarks}` : '';
}).filter(Boolean).join('\n\n');

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

export interface PatternComparison {
  matched: string[];
  missed: string[];
  what_to_say_instead: string[];
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
  pattern_comparison?: PatternComparison;
}

export function buildScoringPrompt(transcript: string, agentName?: string): string {
  const agentCtx = agentName ? `The sales agent's name is "${agentName}".` : '';

  return `You are an expert sales call analyst and coach for Credit Club, a UK-focused credit, business-card, points-and-travel education and implementation programme. ${agentCtx}

================================================================================
PRIMARY FRAMEWORK: SALES PATTERNS & TECHNIQUES (Use These As Main Guidance)
================================================================================
These MD knowledge files are your PRIMARY source for coaching and scoring guidance.
All analysis, recommendations, and "what to say instead" must be based on these patterns.

${KB_CLOSES}

================================================================================
PRIMARY FRAMEWORK: OBJECTION HANDLING PATTERNS
================================================================================
These are the objection types and handling patterns. Use these to score handling.

${KB_OBJECTIONS}

================================================================================
PRIMARY FRAMEWORK: SALES TECHNIQUES (Value Stacking & Urgency)
================================================================================
These are the techniques that elite reps use. Score whether the rep used them effectively.

${KB_TECHNIQUES}

================================================================================
PRIMARY FRAMEWORK: PRICING PSYCHOLOGY
================================================================================
This is how pricing should be positioned. Evaluate pricing conversation against these patterns.

${KB_PRICING}

================================================================================
INTERNAL CALIBRATION: WINNING CALL PATTERNS (Hidden Reference Material)
================================================================================
These are INTERNAL calibration examples only. Use them to understand what "good" looks like
by close type, but NEVER reference these by name in your output. NEVER say things like:
- "This matched [Name]'s technique"
- "[Name] handled this by..."
- "Compared to [Name]..."

Instead, use anonymous pattern language:
- "This matched a strong [close-type] pattern"
- "A better response would be to..."
- "The rep missed the urgency bridge"

${KB_BENCHMARKS}

================================================================================
CRITICAL OUTPUT RULES
================================================================================

1. **NEVER name benchmark sources**: Do NOT mention Omar Pike, Fernando Cotrim, Luke Cockle, 
   Emma Foster, Bina Patel, Georgia Smith, Mohit Garg, Rachel, Andrika Das, Shamil Morjaria,
   Nirmohan Singh Grover, or Prismek Wegroc in ANY output field.

2. **Use anonymous patterns**: Say "a strong deposit-close pattern" not "Omar's technique".
   Say "elite objection handling" not "Fernando's approach".

3. **"What to say instead" must be framework-based**: Use patterns from the MD files above,
   not verbatim quotes from benchmark transcripts.

4. **Coaching tone**: Sound like a sales trainer, not a document retrieval system.
   - GOOD: "Isolate the objection, reassure, then ask for a smaller commitment."
   - BAD: "Omar handled this by saying..."

5. **Pattern comparison section**: Compare to "winning patterns" not specific people.

================================================================================
YOUR TASK
================================================================================

Analyze the following sales call transcript and produce a detailed scoring assessment.
Use the PRIMARY FRAMEWORK MD files as your main guidance.
Use INTERNAL CALIBRATION only for understanding what good looks like.

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
- Pain amplification that connects credit problems to real-life consequences (travel, family, business)
- Clear offer explanation tied to prospect's specific situation
- Confident, assumptive close attempts with urgency
- Effective objection handling: isolate → empathize → reframe → close
- Next steps that are specific, time-bound, and committed
- Call control: guiding conversation, redirecting tangents, maintaining authority

**PENALIZE (score lower):**
- Weak discovery: generic questions, not digging into "why"
- Skipping pain amplification: rushing to offer without emotional connection
- Poor offer explanation: features without benefits, not tied to prospect's pain
- No close attempt or weak ask: "so what do you think?" vs "let's get you started"
- Missing objections: letting concerns go unaddressed
- Losing call control: letting prospect ramble, ask all the questions, control timeline
- Vague next steps: "I'll call you sometime" vs "I'll call you Tuesday at 2pm"

## What Elite Reps Do That Average Reps Miss

**Elite reps always:**
1. **Qualify hard upfront** - make sure prospect has pain and motivation
2. **Amplify pain with specifics** - "so you're telling me you've been declined 3 times, how did that feel?"
3. **Connect offer to exact pain** - "this gets you to Japan in business class with your father"
4. **Create urgency** - anniversary pricing, limited spots, price increases
5. **Assume the close** - "when we get you started" not "if you decide to join"
6. **Handle objections before they come up** - address price, timing, trust proactively
7. **Get explicit commitment** - specific next step with time and action

**Average reps often:**
1. Rush discovery or skip it entirely
2. Present offer generically without connecting to pain
3. Fail to create urgency - "take your time, no pressure"
4. Ask weak close questions - "what do you think?"
5. Let objections slide or handle them defensively
6. End with vague next steps - "I'll follow up with you"
7. Lose control of the call to the prospect

## Output Style Guidelines

**DO:**
- Write like a sales coach giving actionable feedback
- Reference patterns from the PRIMARY FRAMEWORK MD files
- Use "what worked" and "what hurt the call" framing
- Give specific improved wording in "what_to_say_instead"
- Focus on behaviors and patterns, not people

**DON'T:**
- Name or cite specific benchmark sources (Omar, Fernando, etc.)
- Sound like you're retrieving from documents
- Use generic platitudes without transcript evidence
- Miss the emotional/psychological aspects of the sale

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

## Analysis Requirements

Your analysis must cover:
1. **What the rep did well** — cite specific transcript moments
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
  "pattern_comparison": {
    "matched": ["<patterns this rep used successfully>", ...],
    "missed": ["<patterns from winning calls that were missed>", ...],
    "what_to_say_instead": ["<improved wording based on framework patterns>", ...]
  },
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

Be specific with timestamps. For each marker, explain WHY it matters in the context of the sale.

================================================================================
TRANSCRIPT TO ANALYZE
================================================================================

${transcript}

================================================================================
END OF TRANSCRIPT
================================================================================

Remember:
1. Use PRIMARY FRAMEWORK MD files as main guidance
2. INTERNAL CALIBRATION is for your understanding only - NEVER cite names
3. Write like a sales coach, not a document retriever
4. All coaching must be actionable and specific
5. NEVER mention: Omar Pike, Fernando Cotrim, Luke Cockle, Emma Foster, Bina Patel, Georgia Smith, Mohit Garg, Rachel, Andrika Das, Shamil Morjaria, Nirmohan Singh Grover, Prismek Wegroc
`;
}

// ---------------------------------------------------------------------------
// Post-processing sanitization to catch any leaked benchmark names
// ---------------------------------------------------------------------------

const BENCHMARK_NAMES = [
  'Omar Pike', 'Fernando Cotrim', 'Luke Cockle', 'Emma Foster',
  'Bina Patel', 'Georgia Smith', 'Mohit Garg', 'Rachel', 'Andrika Das',
  'Shamil Morjaria', 'Nirmohan Singh Grover', 'Prismek Wegroc', 'Nirmohan', 'Prismek'
];

const BENCHMARK_PATTERNS: Record<string, string> = {
  'Omar Pike': 'a strong deposit-close example',
  'Fernando Cotrim': 'a strong objection-handling pattern', 
  'Luke Cockle': 'a strong full-close example',
  'Emma Foster': 'a strong value-demonstration pattern',
  'Bina Patel': 'a strong business-owner close pattern',
  'Georgia Smith': 'a strong timing-based close pattern',
  'Mohit Garg': 'a strong partial-access pattern',
  'Rachel': 'a strong BA-card repositioning pattern',
  'Andrika Das': 'a strong eligibility-checker pattern',
  'Shamil Morjaria': 'a strong flexible-payment pattern',
  'Nirmohan Singh Grover': 'a strong pay-after-results pattern',
  'Nirmohan': 'a strong pay-after-results pattern',
  'Prismek Wegroc': 'a strong payment-plan pattern',
  'Prismek': 'a strong payment-plan pattern'
};

/**
 * Sanitize output to remove any benchmark names that leaked through
 */
export function sanitizeOutput(text: string): string {
  let sanitized = text;
  
  for (const name of BENCHMARK_NAMES) {
    const pattern = new RegExp(`\\b${name}\\b`, 'gi');
    const replacement = BENCHMARK_PATTERNS[name] || 'a winning pattern example';
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  // Also catch any file name references
  sanitized = sanitized.replace(/\b\w+_\w+\.md\b/g, 'reference material');
  
  return sanitized;
}

/**
 * Sanitize entire ScoringResult object
 */
export function sanitizeScoringResult(result: ScoringResult): ScoringResult {
  const sanitizeArray = (arr: string[]): string[] => 
    arr.map(s => sanitizeOutput(s));
  
  const sanitizeString = (s: string): string => sanitizeOutput(s);
  
  return {
    ...result,
    strengths: sanitizeArray(result.strengths),
    weaknesses: sanitizeArray(result.weaknesses),
    objections_detected: sanitizeArray(result.objections_detected),
    objections_handled_well: sanitizeArray(result.objections_handled_well),
    objections_missed: sanitizeArray(result.objections_missed),
    next_coaching_actions: sanitizeArray(result.next_coaching_actions),
    coach_summary: {
      did_well: sanitizeArray(result.coach_summary.did_well),
      needs_work: sanitizeArray(result.coach_summary.needs_work),
      action_items: sanitizeArray(result.coach_summary.action_items)
    },
    pattern_comparison: result.pattern_comparison ? {
      matched: sanitizeArray(result.pattern_comparison.matched),
      missed: sanitizeArray(result.pattern_comparison.missed),
      what_to_say_instead: sanitizeArray(result.pattern_comparison.what_to_say_instead)
    } : undefined,
    coaching_markers: result.coaching_markers.map(m => ({
      ...m,
      note: sanitizeString(m.note),
      title: sanitizeString(m.title)
    }))
  };
}
