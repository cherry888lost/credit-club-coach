export type KpiRole = 'closer' | 'sdr';
export type GaugeBand = 'red' | 'amber' | 'green';

export interface KpiSummaryRow {
  teamMember: string;
  kpiDate: string;
  role: KpiRole;
  totalScheduledCalls: number;
  totalLiveCalls: number;
  totalRevenue: number;
  nfLiveCalls: number;
  nfRevenue: number;
  nfPotentialRevenue: number;
  sccRevenue: number;
  sccPotentialRevenue: number;
  eccRevenue: number;
  refundCount: number;
  refundAmount: number;
  nfFullClose: number;
  nfPartial: number;
  nfDeposit: number;
  nfPaymentPlan: number;
  sccFullClose: number;
  sccPartial: number;
  sccDeposit: number;
  sccPaymentPlan: number;
}

export interface AdSpendSummary {
  totalAdSpend: number;
  totalLeads: number;
}

export interface KpiTotals {
  firstCallCash: number;
  recoveryCash: number;
  totalCash: number;
  potentialRevenue: number;
  newCustomers: number;
  firstCallCloseCustomers: number;
  scheduledCalls: number;
  liveCalls: number;
  nfLiveCalls: number;
  refundCount: number;
  refundAmount: number;
  showUpRate: number;
  closeRate: number;
  refundRate: number;
  arpu: number;
}

export interface BusinessPerformanceMetrics {
  cashCollected: number;
  recoveredCash: number;
  totalCash: number;
  totalNewCustomers: number;
  totalRefundCount: number;
  totalRefundAmount: number;
  refundRate: number;
  arpu: number;
  totalAdSpend: number;
  totalLeads: number;
  cac: number;
  blendedCac: number;
  roas: number;
}

export interface KpiFilters {
  startDate?: string;
  endDate?: string;
  role?: KpiRole;
  teamMembers?: string[] | 'All';
}

export interface QuerySpec {
  sql: string;
  params: Record<string, string | string[] | undefined>;
}
