import { describe, expect, it } from 'vitest';
import {
  calculateArpu,
  calculateCloseRate,
  calculateFirstCallCash,
  calculateGaugeBand,
  calculateNewCustomers,
  calculatePotentialRevenue,
  calculateRecoveryCash,
  calculateRefundRate,
  calculateShowUpRate,
  sumKpiRows,
} from './business-performance';
import { closeRateThresholds, refundRateThresholds, showRateThresholds } from './thresholds';
import type { KpiSummaryRow } from './types';

const row: KpiSummaryRow = {
  teamMember: 'Demo Closer',
  kpiDate: '2026-06-15',
  role: 'closer',
  totalScheduledCalls: 10,
  totalLiveCalls: 7,
  totalRevenue: 3200,
  nfLiveCalls: 7,
  nfRevenue: 1800,
  nfPotentialRevenue: 3000,
  sccRevenue: 900,
  sccPotentialRevenue: 500,
  eccRevenue: 500,
  refundCount: 1,
  refundAmount: 300,
  nfFullClose: 1,
  nfPartial: 2,
  nfDeposit: 1,
  nfPaymentPlan: 0,
  sccFullClose: 0,
  sccPartial: 1,
  sccDeposit: 0,
  sccPaymentPlan: 1,
};

describe('confirmed KPI formulas', () => {
  it('calculates first call cash from nf_revenue', () => {
    expect(calculateFirstCallCash(row)).toBe(1800);
  });

  it('calculates recovery cash from scc_revenue + ecc_revenue', () => {
    expect(calculateRecoveryCash(row)).toBe(1400);
  });

  it('calculates potential revenue and clamps display at zero', () => {
    expect(calculatePotentialRevenue(row)).toBe(3000);
    expect(calculatePotentialRevenue({ ...row, nfPotentialRevenue: 100, sccPotentialRevenue: 50, eccRevenue: 500 })).toBe(0);
  });

  it('calculates new customers from first-call and second-call closes, excluding collection/ECC', () => {
    expect(calculateNewCustomers(row)).toBe(6);
  });

  it('calculates close rate from first-call closes over first-call live calls', () => {
    expect(calculateCloseRate(row)).toBeCloseTo((4 / 7) * 100, 6);
    expect(calculateCloseRate({ ...row, nfLiveCalls: 0 })).toBe(0);
  });

  it('calculates show-up rate from live calls over scheduled calls', () => {
    expect(calculateShowUpRate(row)).toBe(70);
    expect(calculateShowUpRate({ ...row, totalScheduledCalls: 0 })).toBe(0);
  });

  it('calculates refund rate from refund count over new customers', () => {
    expect(calculateRefundRate(row)).toBeCloseTo((1 / 6) * 100, 6);
    expect(calculateRefundRate({ ...row, nfFullClose: 0, nfPartial: 0, nfDeposit: 0, sccPartial: 0, sccPaymentPlan: 0 })).toBe(0);
  });

  it('calculates ARPU because it is confirmed in the register', () => {
    expect(calculateArpu([row])).toBeCloseTo(3200 / 6, 6);
    expect(calculateArpu([{ ...row, nfFullClose: 0, nfPartial: 0, nfDeposit: 0, sccPartial: 0, sccPaymentPlan: 0 }])).toBe(0);
  });

  it('aggregates dashboard rows using confirmed formulas', () => {
    const totals = sumKpiRows([row, { ...row, teamMember: 'Second Demo', nfRevenue: 200, sccRevenue: 100, eccRevenue: 0 }]);

    expect(totals.firstCallCash).toBe(2000);
    expect(totals.recoveryCash).toBe(1500);
    expect(totals.newCustomers).toBe(12);
    expect(totals.closeRate).toBeCloseTo(8 / 14 * 100, 6);
    expect(totals.showUpRate).toBe(70);
  });

  it('uses confirmed gauge thresholds', () => {
    expect(calculateGaugeBand(9, closeRateThresholds)).toBe('red');
    expect(calculateGaugeBand(20, closeRateThresholds)).toBe('amber');
    expect(calculateGaugeBand(30, closeRateThresholds)).toBe('green');
    expect(calculateGaugeBand(39, showRateThresholds)).toBe('red');
    expect(calculateGaugeBand(50, showRateThresholds)).toBe('amber');
    expect(calculateGaugeBand(70, showRateThresholds)).toBe('green');
    expect(calculateGaugeBand(2, refundRateThresholds)).toBe('green');
    expect(calculateGaugeBand(4, refundRateThresholds)).toBe('amber');
    expect(calculateGaugeBand(7, refundRateThresholds)).toBe('red');
  });
});
