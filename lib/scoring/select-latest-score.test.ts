import { describe, expect, it } from 'vitest';
import { selectLatestDisplayScore } from './select-latest-score';

describe('selectLatestDisplayScore', () => {
  it('prefers the latest completed score instead of the first embedded relation row', () => {
    const selected = selectLatestDisplayScore([
      {
        id: 'aea631a5-4b60-4f4a-9a58-7120e9afd55d',
        status: 'completed',
        score_total: 55,
        created_at: '2026-06-20T13:27:14.221+00:00',
        updated_at: '2026-06-20T13:27:14.560433+00:00',
      },
      {
        id: '003ea30d-9687-442f-886a-d9bc8c416b8e',
        status: 'completed',
        score_total: 60,
        created_at: '2026-06-20T19:59:38.428+00:00',
        updated_at: '2026-06-20T19:59:40.059511+00:00',
      },
    ]);

    expect(selected?.id).toBe('003ea30d-9687-442f-886a-d9bc8c416b8e');
  });

  it('uses updated_at when it is newer than created_at', () => {
    const selected = selectLatestDisplayScore([
      {
        id: 'older-created-newer-updated',
        status: 'completed',
        score_total: 70,
        created_at: '2026-06-20T10:00:00.000Z',
        updated_at: '2026-06-20T12:00:00.000Z',
      },
      {
        id: 'newer-created-older-updated',
        status: 'completed',
        score_total: 80,
        created_at: '2026-06-20T11:00:00.000Z',
        updated_at: '2026-06-20T11:01:00.000Z',
      },
    ]);

    expect(selected?.id).toBe('older-created-newer-updated');
  });

  it('falls back to latest scored row when completed status is absent on legacy data', () => {
    const selected = selectLatestDisplayScore([
      {
        id: 'legacy-old',
        score_total: 42,
        created_at: '2026-06-20T10:00:00.000Z',
      },
      {
        id: 'legacy-new',
        overall_score: 58,
        created_at: '2026-06-20T11:00:00.000Z',
      },
    ]);

    expect(selected?.id).toBe('legacy-new');
  });

  it('returns null when no score row exists', () => {
    expect(selectLatestDisplayScore(null)).toBeNull();
    expect(selectLatestDisplayScore([])).toBeNull();
  });
});
