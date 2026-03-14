import { createServiceClient } from '@/lib/supabase/service';
import type { EnhancedCallScore, CloseOutcome } from './types';

function getCloseOutcome(closeType: string): CloseOutcome {
  switch (closeType) {
    case 'full':
    case 'payment_plan':
    case 'partial_access':
      return 'closed';
    case 'deposit':
      return 'follow_up';
    case 'none':
    default:
      return 'no_sale';
  }
}

function getQualityLabel(score: number): string {
  if (score >= 90) return 'elite';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 60) return 'average';
  if (score >= 50) return 'below_average';
  return 'poor';
}

export async function saveEnhancedAnalysis(
  callId: string,
  scoreId: string,
  analysis: EnhancedCallScore
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('call_scores')
    .update({
      // Core scores
      overall_score: analysis.scoring.total,
      quality_label: getQualityLabel(analysis.scoring.total),
      grade: analysis.scoring.grade,

      // Close analysis
      close_type: analysis.close_analysis.type,
      close_outcome: getCloseOutcome(analysis.close_analysis.type),
      close_confidence: analysis.close_analysis.confidence,
      close_analysis: analysis.close_analysis,

      // Score breakdown
      score_breakdown: analysis.scoring,

      // Objections
      objections_detected: analysis.objections.detected,
      objection_details: analysis.objections.details,

      // Techniques
      techniques_detected: analysis.techniques,
      value_stacking_score: analysis.techniques.value_stacking.score,
      urgency_score: analysis.techniques.urgency_creation.score,

      // Strengths & weaknesses
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      missed_opportunities: analysis.missed_opportunities || [],

      // Coaching
      next_coaching_actions: analysis.next_coaching_actions,
      coaching_feedback: analysis.next_coaching_actions,

      // Key quotes
      key_quotes: analysis.key_quotes || [],

      // Metadata
      rep_name: analysis.rep_name,
      prospect_name: analysis.prospect_name,
    })
    .eq('id', scoreId);

  if (error) {
    console.error('[SAVE_ANALYSIS] Failed to save enhanced analysis:', error);
    throw error;
  }

  console.log(`[SAVE_ANALYSIS] Saved enhanced analysis for call ${callId}`);
}
