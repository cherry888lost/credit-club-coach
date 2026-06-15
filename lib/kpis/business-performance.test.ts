import { describe, expect, it } from 'vitest';
import {
  calculateBusinessPerformance,
  calculateCac,
  calculateRecoveredCash,
  calculateRoas,
} from './business-performance';
import type { AdSpendSummary, KpiSummaryRow } from './types';

const closer: KpiSummaryRow = {
  teamMember: 'Demo Closer',
  kpiDate: '2026-06-15',
  role: 'closer',
  totalScheduledCalls: 10,
  totalLiveCalls: 8,
  totalRevenue: 5000,
  nfLiveCalls: 8,
  nfRevenue: 3000,
  nfPotentialRevenue: 0,
  sccRevenue: 1200,
  sccPotentialRevenue: 0,
  eccRevenue: 800,
  refundCount: 1,
  refundAmount: 500,
  nfFullClose: 1,
  nfPartial: 1,
  nfDeposit: 1,
  nfPaymentPlan: 1,
  sccFullClose: 0,
  sccPartial: 1,
  sccDeposit: 0,
  sccPaymentPlan: 0,
};

const sdr: KpiSummaryRow = {
  ...closer,
  teamMember: 'Demo SDR',
  role: 'sdr',
  totalRevenue: 2000,
  nfRevenue: 500,
  sccRevenue: 1000,
  eccRevenue: 500,
  refundCount: 0,
  refundAmount: 0,
  nfFullClose: 0,
  nfPartial: 1,
  nfDeposit: 0,
  nfPaymentPlan: 0,
  sccFullClose: 0,
  sccPartial: 1,
  sccDeposit: 0,
  sccPaymentPlan: 0,
};

const adSpend: AdSpendSummary = { totalAdSpend: 1000, totalLeads: 50 };

describe('confirmed Business Performance formulas', () => {
  it('calculates cash collected as closer first-call cash only', () => {
    const bp = calculateBusinessPerformance([closer], [sdr], adSpend);
    expect(bp.cashCollected).toBe(3000);
  });

  it('calculates recovered cash as closer recovery cash plus SDR total cash', () => {
    expect(calculateRecoveredCash([closer], [sdr])).toBe(4000);
  });

  it('calculates CAC from ad spend over closer first-call close customers', () => {
    expect(calculateCac(1000, [closer])).toBe(250);
    expect(calculateCac(1000, [{ ...closer, nfFullClose: 0, nfPartial: 0, nfDeposit: 0, nfPaymentPlan: 0 }])).toBe(0);
  });

  it('calculates blended CAC from ad spend over total new customers', () => {
    const bp = calculateBusinessPerformance([closer], [sdr], adSpend);
    expect(bp.blendedCac).toBeCloseTo(1000 / 7, 6);
  });

  it('calculates ROAS from closer first-call cash over ad spend', () => {
    expect(calculateRoas([closer], 1000)).toBe(3);
    expect(calculateRoas([closer], 0)).toBe(0);
  });

  it('returns only confirmed phase 1 business performance metrics', () => {
    const bp = calculateBusinessPerformance([closer], [sdr], adSpend);

    expect(bp).toMatchObject({
      cashCollected: 3000,
      recoveredCash: 4000,
      totalNewCustomers: 7,
      cac: 250,
      roas: 3,
    });
    expect(bp.arpu).toBeCloseTo(7000 / 7, 6);
    expect(bp.refundRate).toBeCloseTo(1 / 7 * 100, 6);
  });
});
