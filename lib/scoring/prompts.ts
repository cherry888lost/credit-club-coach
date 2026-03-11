/**
 * Credit Club Sales Scoring Prompts and Configuration
 * 
 * Scoring system for analyzing sales call transcripts
 * Uses a 10-category rubric with 0-10 scoring
 */

export const SCORING_MODEL_VERSION = "v1.0";

export const MIN_TRANSCRIPT_LENGTH = 500;

// Categories to score
export const SCORING_CATEGORIES = [
  "rapport_tone",
  "discovery_quality", 
  "call_control",
  "pain_amplification",
  "offer_explanation",
  "objection_handling",
  "urgency_close_attempt",
  "confidence_authority",
  "next_steps_clarity",
  "overall_close_quality",
] as const;

export type ScoringCategory = typeof SCORING_CATEGORIES[number];

// Close types for Credit Club
export const CLOSE_TYPES = [
  "full_close",
  "deposit",
  "partial_access",
  "payment_plan",
] as const;

export type CloseType = typeof CLOSE_TYPES[number];

// Outcomes
export const OUTCOMES = [
  "closed",
  "follow_up",
  "no_sale",
  "disqualified",
] as const;

export type Outcome = typeof OUTCOMES[number];

// Quality labels based on overall score
export function getQualityLabel(score: number): 'poor' | 'average' | 'strong' | 'elite' {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'average';
  return 'poor';
}

/**
 * Main scoring prompt for LLM
 */
export function buildScoringPrompt(transcript: string): string {
  return `You are an expert sales coach analyzing a Credit Club sales call transcript.

CREDIT CLUB CONTEXT:
- Product: High-ticket course (£3,000) teaching UK credit card points/miles strategy
- Target: People who want to learn how to maximize UK credit card rewards
- Sales process: Discovery → Pain amplification → Offer explanation → Close
- Close types: full_close (paid in full), deposit (partial payment), partial_access (limited access), payment_plan (installments)

TRANSCRIPT TO ANALYZE:
---
${transcript}
---

SCORING RUBRIC (0-10 for each category):

1. RAPPORT_TONE
Score 8-10: Warm, builds trust quickly, natural conversation flow, prospect feels comfortable
Score 5-7: Adequate rapport, somewhat mechanical but not off-putting  
Score 0-4: Cold, rushed, pushy, or creates distance with prospect

2. DISCOVERY_QUALITY
Score 8-10: Asks deep questions about current situation, goals, pain points; truly understands prospect before pitching
Score 5-7: Asks some questions but surface-level
Score 0-4: Jumps straight to pitch without understanding prospect

3. CALL_CONTROL
Score 8-10: Guides conversation smoothly, keeps focus on sales process, handles tangents well
Score 5-7: Some meandering but generally recovers
Score 0-4: Loses control, prospect dominates conversation, no clear direction

4. PAIN_AMPLIFICATION
Score 8-10: Makes prospect feel the true cost of inaction, amplifies pain points before offering solution
Score 5-7: Mentions pain but doesn't deepen or explore it fully
Score 0-4: Skips pain amplification entirely, goes straight to features

5. OFFER_EXPLANATION
Score 8-10: Clear explanation tailored to discovered pain, focuses on benefits not features
Score 5-7: Describes features but misses connection to prospect's specific needs
Score 0-4: Confusing, rushed, or feature-dumping without context

6. OBJECTION_HANDLING
Score 8-10: Addresses concerns confidently, turns objections into opportunities, doesn't get defensive
Score 5-7: Acknowledges objections but resolution is weak or rushed
Score 0-4: Ignores objections, argues with prospect, or gets flustered

7. URGENCY_CLOSE_ATTEMPT
Score 8-10: Creates genuine urgency, asks for close confidently, doesn't leave it hanging
Score 5-7: Mentions urgency but close attempt is weak or implied
Score 0-4: No close attempt, or asks "so what do you think?" passively

8. CONFIDENCE_AUTHORITY
Score 8-10: Speaks with certainty, positions as expert, prospect trusts their guidance
Score 5-7: Generally confident but some hesitation or hedging
Score 0-4: Sounds unsure, apologetic, or seeking validation from prospect

9. NEXT_STEPS_CLARITY
Score 8-10: Clear next steps agreed upon, confirmed commitment, specific timeline
Score 5-7: Vague next steps mentioned but not confirmed
Score 0-4: No next steps established, conversation ends ambiguously

10. OVERALL_CLOSE_QUALITY
Score 8-10: Would expect this call to convert based on execution
Score 5-7: Might convert with strong follow-up
Score 0-4: Unlikely to convert, fundamental issues in approach

INSTRUCTIONS:
1. Read the transcript carefully
2. Score each category 0-10 with specific reasoning
3. Include direct evidence (quotes) from transcript
4. Provide actionable improvement tip for each category
5. Determine overall_score (sum of categories, max 100)
6. Determine outcome: closed, follow_up, no_sale, or disqualified
7. If outcome is "closed", determine close_type: full_close, deposit, partial_access, or payment_plan
8. Identify objections raised by prospect
9. Identify which objections were handled well vs missed
10. List 2-3 specific next coaching actions

OUTPUT MUST BE VALID JSON:
{
  "categories": {
    "rapport_tone": { "score": 8, "reasoning": "...", "evidence": "direct quote from transcript", "improvement_tip": "..." },
    "discovery_quality": { "score": 7, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "call_control": { "score": 6, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "pain_amplification": { "score": 5, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "offer_explanation": { "score": 7, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "objection_handling": { "score": 4, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "urgency_close_attempt": { "score": 6, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "confidence_authority": { "score": 7, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "next_steps_clarity": { "score": 5, "reasoning": "...", "evidence": "...", "improvement_tip": "..." },
    "overall_close_quality": { "score": 6, "reasoning": "...", "evidence": "...", "improvement_tip": "..." }
  },
  "overall_score": 61,
  "quality_label": "average",
  "outcome": "follow_up",
  "close_type": null,
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "objections_detected": ["price", "trust", "timing"],
  "objections_handled_well": ["trust"],
  "objections_missed": ["price", "timing"],
  "next_coaching_actions": ["specific action 1", "specific action 2", "specific action 3"]
}

IMPORTANT:
- Be honest and critical - this is for coaching improvement
- Use specific quotes from transcript as evidence
- Make improvement tips actionable and specific
- Do not inflate scores - most calls should be 5-7 average range
- Only score "closed" outcome if there's clear agreement to purchase
- Only include close_type if outcome is "closed"`;
}

/**
 * Validate scoring output structure
 */
export function validateScoringOutput(output: any): { valid: boolean; error?: string } {
  if (!output || typeof output !== 'object') {
    return { valid: false, error: 'Output is not an object' };
  }

  // Check required fields
  if (!output.categories || typeof output.categories !== 'object') {
    return { valid: false, error: 'Missing categories object' };
  }

  // Check all categories exist
  for (const category of SCORING_CATEGORIES) {
    if (!output.categories[category]) {
      return { valid: false, error: `Missing category: ${category}` };
    }
    const cat = output.categories[category];
    if (typeof cat.score !== 'number' || cat.score < 0 || cat.score > 10) {
      return { valid: false, error: `Invalid score for ${category}` };
    }
    if (!cat.reasoning || typeof cat.reasoning !== 'string') {
      return { valid: false, error: `Missing reasoning for ${category}` };
    }
    if (!cat.evidence || typeof cat.evidence !== 'string') {
      return { valid: false, error: `Missing evidence for ${category}` };
    }
    if (!cat.improvement_tip || typeof cat.improvement_tip !== 'string') {
      return { valid: false, error: `Missing improvement_tip for ${category}` };
    }
  }

  // Check overall score
  if (typeof output.overall_score !== 'number' || output.overall_score < 0 || output.overall_score > 100) {
    return { valid: false, error: 'Invalid overall_score' };
  }

  // Check quality label
  if (!['poor', 'average', 'strong', 'elite'].includes(output.quality_label)) {
    return { valid: false, error: 'Invalid quality_label' };
  }

  // Check outcome
  if (!OUTCOMES.includes(output.outcome)) {
    return { valid: false, error: 'Invalid outcome' };
  }

  // Check close_type only if outcome is closed
  if (output.outcome === 'closed') {
    if (!CLOSE_TYPES.includes(output.close_type)) {
      return { valid: false, error: 'Invalid close_type for closed outcome' };
    }
  }

  // Check arrays
  if (!Array.isArray(output.strengths)) return { valid: false, error: 'strengths must be array' };
  if (!Array.isArray(output.weaknesses)) return { valid: false, error: 'weaknesses must be array' };
  if (!Array.isArray(output.objections_detected)) return { valid: false, error: 'objections_detected must be array' };
  if (!Array.isArray(output.objections_handled_well)) return { valid: false, error: 'objections_handled_well must be array' };
  if (!Array.isArray(output.objections_missed)) return { valid: false, error: 'objections_missed must be array' };
  if (!Array.isArray(output.next_coaching_actions)) return { valid: false, error: 'next_coaching_actions must be array' };

  return { valid: true };
}

/**
 * Calculate overall score from category scores
 */
export function calculateOverallScore(categories: Record<ScoringCategory, { score: number }>): number {
  const scores = Object.values(categories).map(c => c.score);
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum; // Each category is 0-10, 10 categories = 0-100
}
