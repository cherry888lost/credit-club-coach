import { describe, expect, it } from 'vitest';
import { filterKpiRows, filtersToKpiQuery, normalizeMergedPreviewFilters } from './filters';
import type { KpiSummaryRow } from './types';

const rows: KpiSummaryRow[] = [
  {
    teamMember: 'Closer A',
    kpiDate: '2026-06-14',
    role: 'closer',
    totalScheduledCalls: 4,
    totalLiveCalls: 2,
    totalRevenue: 1000,
    nfLiveCalls: 2,
    nfRevenue: 500,
    nfPotentialRevenue: 1000,
    sccRevenue: 300,
    sccPotentialRevenue: 200,
    eccRevenue: 200,
    refundCount: 0,
    refundAmount: 0,
    nfFullClose: 1,
    nfPartial: 0,
    nfDeposit: 0,
    nfPaymentPlan: 0,
    sccFullClose: 0,
    sccPartial: 0,
    sccDeposit: 0,
    sccPaymentPlan: 0,
  },
  {
    teamMember: 'SDR A',
    kpiDate: '2026-06-14',
    role: 'sdr',
    totalScheduledCalls: 3,
    totalLiveCalls: 1,
    totalRevenue: 700,
    nfLiveCalls: 1,
    nfRevenue: 0,
    nfPotentialRevenue: 0,
    sccRevenue: 700,
    sccPotentialRevenue: 0,
    eccRevenue: 0,
    refundCount: 0,
    refundAmount: 0,
    nfFullClose: 0,
    nfPartial: 0,
    nfDeposit: 0,
    nfPaymentPlan: 0,
    sccFullClose: 0,
    sccPartial: 1,
    sccDeposit: 0,
    sccPaymentPlan: 0,
  },
];

describe('merged preview filters', () => {
  it('defaults to explicit All scope and approved MTD range', () => {
    expect(normalizeMergedPreviewFilters({})).toMatchObject({
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      role: 'all',
      team: 'All',
      teamMember: 'All',
      section: 'overview',
    });
  });

  it('keeps person-level filters explicit', () => {
    const filters = normalizeMergedPreviewFilters({ role: 'closer', teamMember: 'Closer A' });
    expect(filterKpiRows(rows, filters)).toHaveLength(1);
    expect(filterKpiRows(rows, filters)[0].teamMember).toBe('Closer A');
    expect(filtersToKpiQuery(filters)).toMatchObject({ role: 'closer', teamMembers: ['Closer A'] });
  });

  it('does not silently mix unconfirmed team scope', () => {
    const filters = normalizeMergedPreviewFilters({ team: 'Unassigned' });
    expect(filterKpiRows(rows, filters)).toEqual([]);
  });

  it('maps All Members to aggregate query scope', () => {
    const filters = normalizeMergedPreviewFilters({ role: 'sdr', teamMember: 'All' });
    expect(filtersToKpiQuery(filters)).toMatchObject({ role: 'sdr', teamMembers: 'All' });
  });
});
