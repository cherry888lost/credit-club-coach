import { describe, expect, it } from 'vitest';
import { normalizeAdSpendSummary, normalizeKpiSummaryRow } from './mapper';

describe('KPI BigQuery mapper normalization', () => {
  it('maps snake_case BigQuery summary rows into typed camelCase rows with numeric defaults', () => {
    const row = normalizeKpiSummaryRow({
      team_member: 'Demo Closer',
      kpi_date: { value: '2026-06-15' },
      role: 'closer',
      total_scheduled_calls: '10',
      total_live_calls: 7,
      total_revenue: '3200.50',
      nf_live_calls: '7',
      nf_revenue: '1800',
      nf_potential_revenue: null,
      scc_revenue: '900',
      scc_potential_revenue: '500',
      ecc_revenue: '100',
      refund_count: '1',
      refund_amount: '300',
      nf_full_close: '1',
      nf_partial: '2',
      nf_deposit: '1',
      nf_payment_plan: '0',
      scc_full_close: '0',
      scc_partial: '1',
      scc_deposit: '0',
      scc_payment_plan: '1',
    });

    expect(row).toMatchObject({
      teamMember: 'Demo Closer',
      kpiDate: '2026-06-15',
      role: 'closer',
      totalScheduledCalls: 10,
      totalLiveCalls: 7,
      totalRevenue: 3200.5,
      nfPotentialRevenue: 0,
      sccPotentialRevenue: 500,
      nfPartial: 2,
      sccPaymentPlan: 1,
    });
  });

  it('rejects unsupported roles instead of guessing', () => {
    expect(() => normalizeKpiSummaryRow({ team_member: 'Demo', kpi_date: '2026-06-15', role: 'admin' })).toThrow(/unsupported KPI row role/i);
  });

  it('normalizes sanitized ad spend summaries', () => {
    expect(normalizeAdSpendSummary({ total_ad_spend: '1000.25', total_leads: '50' })).toEqual({
      totalAdSpend: 1000.25,
      totalLeads: 50,
    });
  });
});
