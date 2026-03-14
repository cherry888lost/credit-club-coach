// Enhanced scoring types for Credit Club AI Sales Coach

export interface CloseAnalysis {
  type: 'full' | 'payment_plan' | 'partial_access' | 'deposit' | 'none';
  confidence: number; // 0-100
  structure: {
    upfront_amount: number;
    total_amount: number;
    remainder_amount: number;
    timing: string;
  };
  evidence: string[];
}

export interface ObjectionDetail {
  type: 'pricing' | 'need_to_think' | 'partner' | 'other';
  timestamp?: string;
  quote: string;
  response_quote: string;
  handling_score: number; // 0-10
  confidence?: number; // 0-100
}

export interface TechniqueAnalysis {
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
  anchoring?: {
    score: number;
    evidence: string[];
  };
  authority_framing?: {
    score: number;
    evidence: string[];
  };
}

export interface ScoreBreakdown {
  close_quality: number;      // 0-25
  objection_handling: number;  // 0-20
  value_stacking: number;     // 0-20
  urgency_usage: number;      // 0-15
  discovery_rapport: number;  // 0-10
  professionalism: number;    // 0-10
}

export interface EnhancedCallScore {
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

  techniques: TechniqueAnalysis;

  scoring: ScoreBreakdown & {
    total: number;
    grade: string;
  };

  strengths: string[];
  weaknesses: string[];
  missed_opportunities?: string[];
  next_coaching_actions: string[];
  key_quotes?: Array<{ speaker: string; quote: string; context: string }>;
}

// Close type display helpers
export type CloseType = 'full' | 'payment_plan' | 'partial_access' | 'deposit' | 'none';
export type CloseOutcome = 'closed' | 'follow_up' | 'no_sale';
export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export const CLOSE_TYPE_CONFIG: Record<CloseType, { label: string; color: string; bgColor: string; darkBgColor: string }> = {
  full: { label: 'Full Close', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100', darkBgColor: 'dark:bg-green-900/30' },
  payment_plan: { label: 'Payment Plan', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100', darkBgColor: 'dark:bg-blue-900/30' },
  partial_access: { label: 'Partial Access', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-100', darkBgColor: 'dark:bg-purple-900/30' },
  deposit: { label: 'Deposit', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-100', darkBgColor: 'dark:bg-orange-900/30' },
  none: { label: 'No Close', color: 'text-zinc-600 dark:text-zinc-400', bgColor: 'bg-zinc-100', darkBgColor: 'dark:bg-zinc-800' },
};

export const CLOSE_OUTCOME_CONFIG: Record<CloseOutcome, { label: string; color: string; bgColor: string }> = {
  closed: { label: 'Closed', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  follow_up: { label: 'Follow-up', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  no_sale: { label: 'No Sale', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

export function getGradeFromScore(score: number): Grade {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+': return 'text-emerald-600 dark:text-emerald-400';
    case 'A': return 'text-green-600 dark:text-green-400';
    case 'B': return 'text-blue-600 dark:text-blue-400';
    case 'C': return 'text-amber-600 dark:text-amber-400';
    case 'D': return 'text-orange-600 dark:text-orange-400';
    case 'F': return 'text-red-600 dark:text-red-400';
    default: return 'text-zinc-600 dark:text-zinc-400';
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (score >= 60) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

// Pattern library types
export interface SalesPattern {
  id: string;
  category: 'value_stacking' | 'objection_handling' | 'urgency_creation' | 'closing_phrases';
  technique: string;
  example_phrase: string;
  context: string;
  usage_count: number;
  effectiveness_score: number;
  source_calls: string[];
  is_benchmark: boolean;
  created_at: string;
}

export const PATTERN_CATEGORIES = {
  value_stacking: { label: 'Value Stacking', icon: 'TrendingUp', color: 'indigo' },
  objection_handling: { label: 'Objection Handling', icon: 'Shield', color: 'amber' },
  urgency_creation: { label: 'Urgency Creation', icon: 'Clock', color: 'red' },
  closing_phrases: { label: 'Closing Phrases', icon: 'Target', color: 'green' },
} as const;
