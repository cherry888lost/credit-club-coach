import { describe, expect, it } from 'vitest';
import { buildKpiTrackerV2ViewModel } from './kpi-tracker-v2';
import { sanitizedAdSpendSummary, sanitizedCloserRows, sanitizedSdrRows } from '../data/kpis/fixtures';

describe('KPI Tracker V2 view model', () => {
  it('builds a read-only dashboard model from KPI calculation and formatting helpers', () => {
    const model = buildKpiTrackerV2ViewModel({
      closerRows: sanitizedCloserRows,
      sdrRows: sanitizedSdrRows,
      adSpend: sanitizedAdSpendSummary,
      filters: { startDate: '2026-06-01', endDate: '2026-06-15', teamMembers: ['Closer A'] },
    });

    expect(model.readOnlyWarning).toBe('Read-only KPI Tracker preview. Not approved as final production replacement. Old KPI tracker remains source of truth.');
    expect(model.inputWarning).toBe('KPI input workflow is not migrated yet.');
    expect(model.selectedDateRange).toBe('2026-06-01 to 2026-06-15');
    expect(model.selectedTeamMembers).toBe('Closer A');
    expect(model.summaryCards.map((card) => card.label)).toEqual([
      'Cash Collected',
      'Recovered Cash',
      'CAC',
      'Blended CAC',
    ]);
    expect(model.closerMetrics.map((metric) => metric.label)).toContain('First Call Cash');
    expect(model.sdrMetrics.map((metric) => metric.label)).toContain('Show Up Rate');
    expect(model.businessMetrics.map((metric) => metric.label)).toContain('ROAS');
    expect(model.statusItems).toContainEqual({ label: 'BigQuery writes', state: 'not approved' });
    expect(model.inputWorkflow.enabled).toBe(false);
  });

  it('labels unconfirmed parity and zero-ad-spend behaviour carefully', () => {
    const model = buildKpiTrackerV2ViewModel({
      closerRows: sanitizedCloserRows,
      sdrRows: sanitizedSdrRows,
      adSpend: { totalAdSpend: 0, totalLeads: 0 },
      filters: {},
    });

    expect(model.businessMetrics.find((metric) => metric.label === 'ROAS')?.note).toContain('Zero ad-spend');
    expect(model.statusItems).toContainEqual({ label: 'SDR parity', state: 'pending' });
    expect(model.statusItems).toContainEqual({ label: 'Business Performance parity', state: 'pending' });
    expect(model.statusItems).toContainEqual({ label: 'Input workflow', state: 'not migrated' });
  });
});
