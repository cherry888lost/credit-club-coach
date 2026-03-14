import { sessionsSpawn } from "../../utils/spawn";

/**
 * Scoring Worker for Credit Club 2.0
 * Processes call transcripts through the reasoner agent for analysis
 */

export interface ScoringRequest {
  id: string;
  call_id: string;
  transcript: string;
  call_title?: string;
  rep_name?: string;
  call_date?: string;
  duration_seconds?: number;
}

export interface CloseAnalysis {
  type: "full" | "payment_plan" | "partial_access" | "deposit" | "none";
  confidence: number;
  structure: {
    upfront_amount: number;
    total_amount: number;
    remainder_amount: number;
    timing: string;
  };
  evidence: string[];
}

export interface ObjectionDetail {
  type: "pricing" | "need_to_think" | "partner" | "other";
  timestamp?: string;
  quote: string;
  response_quote: string;
  handling_score: number;
}

export interface CallScore {
  call_id: string;
  prospect_name: string;
  call_date: string;
  rep_name: string;
  
  close_analysis: CloseAnalysis;
  
  objections: {
    detected: string[];
    details: ObjectionDetail[];
    overall_objection_handling: number;
  };
  
  techniques: {
    value_stacking: {
      score: number;
      components_used: string[];
      evidence: string[];
    };
    urgency_creation: {
      score: number;
      types_used: string[];
      evidence: string[];
    };
  };
  
  scoring: {
    close_quality: number;
    objection_handling: number;
    value_stacking: number;
    urgency_usage: number;
    discovery_rapport: number;
    professionalism: number;
    total: number;
    grade: string;
  };
  
  strengths: string[];
  weaknesses: string[];
  next_coaching_actions: string[];
}

/**
 * Spawn reasoner agent to analyze transcript
 */
export async function analyzeTranscript(
  request: ScoringRequest
): Promise<CallScore> {
  
  const prompt = buildScoringPrompt(request);
  
  // Spawn reasoner agent for analysis
  const result = await sessionsSpawn({
    agentId: "reasoner",
    runtime: "subagent",
    mode: "run",
    task: prompt,
    timeoutSeconds: 120
  });
  
  // Parse JSON response
  try {
    const scoreData: CallScore = JSON.parse(result);
    return scoreData;
  } catch (e) {
    console.error("[SCORING] Failed to parse reasoner response:", e);
    console.error("[SCORING] Raw response:", result);
    throw new Error("Failed to parse scoring analysis");
  }
}

/**
 * Build the scoring prompt for the reasoner agent
 */
function buildScoringPrompt(request: ScoringRequest): string {
  return `
You are a sales call analyst for Credit Club 2.0. Analyze the following transcript and return structured JSON scoring.

## CALL INFORMATION
- Call ID: ${request.call_id}
- Prospect: ${request.call_title || "Unknown"}
- Date: ${request.call_date || "Unknown"}
- Rep: ${request.rep_name || "Papur"}
- Duration: ${request.duration_seconds ? formatDuration(request.duration_seconds) : "Unknown"}

## TRANSCRIPT
${request.transcript}

## SCORING RUBRIC

### 1. Close Type Detection (Choose one)

**Full Close:** £3,000 paid upfront, immediate onboarding
**Payment Plan:** Split payment (£2,000 + £1,000 typical), full access after first payment
**Partial Access:** £500 upfront, £2,500 after approval, limited access initially
**Deposit:** £50-£500 to lock price, remainder due later (not tied to approval)
**None:** No close achieved

### 2. Objection Detection
Look for:
- **Pricing:** "expensive", "can't afford", "discount", "too much"
- **Need to think:** "think about it", "consider", "get back to you"
- **Partner:** "partner", "spouse", "discuss with"

Score handling 0-10 based on:
- 9-10: Diagnosed real concern, offered solution
- 7-8: Good response but limited probing
- 5-6: Acceptable handling
- 3-4: Weak handling
- 0-2: Poor or no handling

### 3. Value Stacking (0-10)
Score components (0-2 each):
- ROI quantification (flight savings)
- Credit repair value
- Software/tools demonstrated
- Support system described
- Social proof shown

### 4. Urgency Creation (0-10)
Score types used (0-2 each):
- Price increase (£3k → £4k)
- Travel timeline
- Opportunity cost
- Offer expiration
- Flexibility pairing

Subtract 3 for artificial urgency ("spots left", "expires tonight")

### 5. Overall Scoring (0-100)
- Close quality: 25%
- Objection handling: 20%
- Value stacking: 20%
- Urgency usage: 15%
- Discovery/rapport: 10%
- Professionalism: 10%

Grades: 90-100 A+, 80-89 A, 70-79 B, 60-69 C, 50-59 D, <50 F

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no explanation):

{
  "call_id": "${request.call_id}",
  "prospect_name": "extract from transcript or title",
  "call_date": "${request.call_date || "2026-03-14"}",
  "rep_name": "${request.rep_name || "Papur"}",
  
  "close_analysis": {
    "type": "full|payment_plan|partial_access|deposit|none",
    "confidence": 0-100,
    "structure": {
      "upfront_amount": number,
      "total_amount": number,
      "remainder_amount": number,
      "timing": "description"
    },
    "evidence": ["exact quotes"]
  },
  
  "objections": {
    "detected": ["pricing|need_to_think|partner"],
    "details": [
      {
        "type": "pricing|need_to_think|partner",
        "timestamp": "mm:ss",
        "quote": "prospect quote",
        "response_quote": "rep response",
        "handling_score": 0-10
      }
    ],
    "overall_objection_handling": 0-10
  },
  
  "techniques": {
    "value_stacking": {
      "score": 0-10,
      "components_used": ["roi", "credit_repair", "software", "support", "social_proof"],
      "evidence": ["quotes"]
    },
    "urgency_creation": {
      "score": 0-10,
      "types_used": ["price_increase", "travel_timeline", "opportunity_cost", "offer_expiration", "flexibility"],
      "evidence": ["quotes"]
    }
  },
  
  "scoring": {
    "close_quality": 0-25,
    "objection_handling": 0-20,
    "value_stacking": 0-20,
    "urgency_usage": 0-15,
    "discovery_rapport": 0-10,
    "professionalism": 0-10,
    "total": 0-100,
    "grade": "A+|A|B|C|D|F"
  },
  
  "strengths": ["specific strength with evidence"],
  "weaknesses": ["specific weakness with evidence"],
  "next_coaching_actions": ["actionable recommendation"]
}

## RULES
1. Use ONLY evidence from the transcript
2. Include exact quotes for all evidence
3. Be consistent with scoring criteria
4. Return pure JSON only - no markdown code blocks, no explanation text
5. If no close achieved, type is "none" with confidence 100
6. If transcript is truncated/incomplete, note in weaknesses

Analyze the transcript now and return JSON.
`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Determine quality label from score
 */
export function getQualityLabel(score: number): string {
  if (score >= 90) return "elite";
  if (score >= 80) return "strong";
  if (score >= 70) return "good";
  if (score >= 60) return "average";
  if (score >= 50) return "below_average";
  return "poor";
}

/**
 * Determine close outcome from analysis
 */
export function getCloseOutcome(closeType: string): string {
  switch (closeType) {
    case "full":
      return "closed";
    case "payment_plan":
      return "closed";
    case "partial_access":
      return "closed";
    case "deposit":
      return "follow_up";
    case "none":
      return "no_sale";
    default:
      return "unknown";
  }
}

/**
 * Get close type label for display
 */
export function getCloseTypeLabel(closeType: string): string {
  switch (closeType) {
    case "full":
      return "Full Close";
    case "payment_plan":
      return "Payment Plan";
    case "partial_access":
      return "Partial Access";
    case "deposit":
      return "Deposit";
    case "none":
      return "No Close";
    default:
      return "Unknown";
  }
}
