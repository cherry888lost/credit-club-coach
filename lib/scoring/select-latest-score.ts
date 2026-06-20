type ScoreLike = {
  id?: string | null;
  status?: string | null;
  score_total?: number | null;
  overall_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function timestampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreSortValue(score: ScoreLike): number {
  return Math.max(timestampMs(score.created_at), timestampMs(score.updated_at));
}

function hasScore(score: ScoreLike): boolean {
  return score.score_total != null || score.overall_score != null;
}

/**
 * Pick the score row the call detail page should display.
 *
 * A call can have multiple call_scores rows after controlled rescoring. Supabase
 * embedded relation ordering is not guaranteed, so never take call_scores[0].
 * Prefer the latest completed score row by created_at/updated_at, then fall back
 * to the latest scored row if older data does not have a completed status.
 */
export function selectLatestDisplayScore<T extends ScoreLike>(scores: T | T[] | null | undefined): T | null {
  const rows = (Array.isArray(scores) ? scores : scores ? [scores] : []).filter(Boolean);
  if (rows.length === 0) return null;

  const completed = rows.filter((score) => score.status === 'completed' && hasScore(score));
  const candidates = completed.length > 0 ? completed : rows.filter(hasScore);
  if (candidates.length === 0) return rows[0] ?? null;

  return [...candidates].sort((a, b) => {
    const byTimestamp = scoreSortValue(b) - scoreSortValue(a);
    if (byTimestamp !== 0) return byTimestamp;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
  })[0] ?? null;
}
