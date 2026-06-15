import type { AdSpendSummary, KpiSummaryRow } from '../../kpis/types';

export const sanitizedCloserRows: KpiSummaryRow[] = [
  {
    teamMember: 'Demo Closer',
    kpiDate: '2026-06-15',
    role: 'closer',
    totalScheduledCalls: 10,
    totalLiveCalls: 8,
    totalRevenue: 5000,
    nfLiveCalls: 8,
    nfRevenue: 3000,
    nfPotentialRevenue: 2500,
    sccRevenue: 1200,
    sccPotentialRevenue: 300,
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
  },
];

export const sanitizedSdrRows: KpiSummaryRow[] = [
  {
    teamMember: 'Demo SDR',
    kpiDate: '2026-06-15',
    role: 'sdr',
    totalScheduledCalls: 6,
    totalLiveCalls: 4,
    totalRevenue: 2000,
    nfLiveCalls: 4,
    nfRevenue: 500,
    nfPotentialRevenue: 400,
    sccRevenue: 1000,
    sccPotentialRevenue: 200,
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
  },
];

export const sanitizedAdSpendSummary: AdSpendSummary = {
  totalAdSpend: 1000,
  totalLeads: 50,
};
