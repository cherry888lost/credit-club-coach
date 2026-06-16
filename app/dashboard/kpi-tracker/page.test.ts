import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pagePath = 'app/dashboard/kpi-tracker/page.tsx';
const pageSource = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';

describe('separate KPI Tracker route boundaries', () => {
  it('exists at /dashboard/kpi-tracker and is gated by the v2 KPI feature flag', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(pageSource).toContain('isKpiTrackerV2Enabled');
    expect(pageSource).toContain('FEATURE_KPI_TRACKER_V2');
  });

  it('shows required read-only/source-of-truth and disabled input workflow messaging', () => {
    expect(pageSource).toContain('Read-only KPI Tracker preview. Not approved as final production replacement. Old KPI tracker remains source of truth.');
    expect(pageSource).toContain('KPI input workflow is not migrated yet.');
    expect(pageSource).toContain('KPI Input Workflow — Coming in Phase 3C');
    expect(pageSource).toContain('Input workflow not enabled');
  });

  it('surfaces known parity gaps instead of presenting the route as launch-approved', () => {
    const requiredLabels = [
      'Closer parity: mostly verified',
      'Formatting parity: verified for tested values',
      'SDR parity: pending',
      'Business Performance parity: pending',
      'Refund/ad-spend parity: pending',
      'Historical role parity: pending',
      'Input workflow: not migrated',
      'BigQuery writes: not approved',
      'Old KPI tracker remains source of truth',
    ];

    for (const label of requiredLabels) {
      expect(pageSource).toContain(label);
    }
  });

  it('keeps formulas and BigQuery mutations out of the UI route', () => {
    expect(pageSource).not.toContain('calculateBusinessPerformance');
    expect(pageSource).not.toContain('sumKpiRows');
    expect(pageSource).not.toContain('formatKpiCurrency');
    expect(pageSource).not.toContain('formatKpiPercent');
    expect(pageSource).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bMERGE\b|\bCREATE\b|\bDROP\b|\bALTER\b|\bTRUNCATE\b/i);
  });

  it('uses Sales Tracker visual language rather than merged-preview styling', () => {
    expect(pageSource).toContain('bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm');
    expect(pageSource).toContain('text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400');
    expect(pageSource).toContain('text-2xl font-bold text-zinc-900 dark:text-white');
    expect(pageSource).not.toContain('rounded-3xl');
  });
});
