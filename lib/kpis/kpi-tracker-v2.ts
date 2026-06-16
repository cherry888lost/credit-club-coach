import { calculateBusinessPerformance, sumKpiRows } from './business-performance';
import { formatKpiCount, formatKpiCurrency, formatKpiMultiple, formatKpiPercent } from './formatting';
import type { AdSpendSummary, KpiFilters, KpiSummaryRow } from './types';

export interface KpiTrackerMetric {
  label: string;
  value: string;
  note?: string;
  status?: 'confirmed' | 'mostly verified' | 'pending' | 'careful';
}

export interface KpiTrackerStatusItem {
  label: string;
  state: string;
}

interface BuildKpiTrackerV2ViewModelInput {
  closerRows: KpiSummaryRow[];
  sdrRows: KpiSummaryRow[];
  adSpend: AdSpendSummary;
  filters: KpiFilters;
}

export function buildKpiTrackerV2ViewModel({
  closerRows,
  sdrRows,
  adSpend,
  filters,
}: BuildKpiTrackerV2ViewModelInput) {
  const closerTotals = sumKpiRows(closerRows);
  const sdrTotals = sumKpiRows(sdrRows);
  const businessPerformance = calculateBusinessPerformance(closerRows, sdrRows, adSpend);
  const cpl = adSpend.totalLeads > 0 ? adSpend.totalAdSpend / adSpend.totalLeads : 0;
  const zeroAdSpendNote = adSpend.totalAdSpend === 0
    ? 'Zero ad-spend behaviour is labelled carefully pending refund/ad-spend parity.'
    : undefined;

  const selectedDateRange = filters.startDate && filters.endDate
    ? `${filters.startDate} to ${filters.endDate}`
    : 'Current selected range';

  const selectedTeamMembers = Array.isArray(filters.teamMembers) && filters.teamMembers.length > 0
    ? filters.teamMembers.join(', ')
    : 'All team members';

  const summaryCards: KpiTrackerMetric[] = [
    { label: 'Cash Collected', value: formatKpiCurrency(businessPerformance.cashCollected), status: 'pending', note: 'Business Performance parity pending.' },
    { label: 'Recovered Cash', value: formatKpiCurrency(businessPerformance.recoveredCash), status: 'pending', note: 'Includes closer recovery plus SDR total revenue per audited logic.' },
    { label: 'CAC', value: formatKpiCurrency(businessPerformance.cac), status: 'pending', note: 'Depends on ad-spend parity.' },
    { label: 'Blended CAC', value: formatKpiCurrency(businessPerformance.blendedCac), status: 'pending', note: 'Depends on ad-spend and customer parity.' },
  ];

  const closerMetrics: KpiTrackerMetric[] = [
    { label: 'First Call Cash', value: formatKpiCurrency(closerTotals.firstCallCash), status: 'mostly verified' },
    { label: 'Recovery Cash', value: formatKpiCurrency(closerTotals.recoveryCash), status: 'mostly verified' },
    { label: 'Potential Revenue', value: formatKpiCurrency(closerTotals.potentialRevenue), status: 'mostly verified' },
    { label: 'New Customers', value: formatKpiCount(closerTotals.newCustomers), status: 'mostly verified' },
    { label: 'Close Rate', value: formatKpiPercent(closerTotals.closeRate), status: 'mostly verified' },
    { label: 'Show Up Rate', value: formatKpiPercent(closerTotals.showUpRate), status: 'mostly verified' },
    { label: 'Refund Rate', value: formatKpiPercent(closerTotals.refundRate), status: 'pending', note: 'Refund parity pending.' },
    { label: 'ARPU', value: formatKpiCurrency(closerTotals.arpu), status: 'mostly verified' },
  ];

  const sdrMetrics: KpiTrackerMetric[] = [
    { label: 'Show Up Rate', value: formatKpiPercent(sdrTotals.showUpRate), status: 'pending', note: 'SDR parity pending.' },
    { label: 'Cash / Revenue Contribution', value: formatKpiCurrency(sdrTotals.totalCash), status: 'pending', note: 'SDR dashboard parity not fully captured.' },
    { label: 'Lead / Call Metrics', value: `${formatKpiCount(sdrTotals.scheduledCalls)} scheduled · ${formatKpiCount(sdrTotals.liveCalls)} live`, status: 'pending' },
    { label: 'Recovery Cash', value: formatKpiCurrency(sdrTotals.recoveryCash), status: 'pending' },
    { label: 'Potential Revenue', value: formatKpiCurrency(sdrTotals.potentialRevenue), status: 'pending' },
  ];

  const businessMetrics: KpiTrackerMetric[] = [
    { label: 'Cash Collected', value: formatKpiCurrency(businessPerformance.cashCollected), status: 'pending' },
    { label: 'Recovered Cash', value: formatKpiCurrency(businessPerformance.recoveredCash), status: 'pending' },
    { label: 'CAC', value: formatKpiCurrency(businessPerformance.cac), status: 'pending', note: 'CAC parity pending.' },
    { label: 'Blended CAC', value: formatKpiCurrency(businessPerformance.blendedCac), status: 'pending' },
    { label: 'ROAS', value: formatKpiMultiple(businessPerformance.roas), status: 'careful', note: zeroAdSpendNote || 'Ad-spend parity pending.' },
    { label: 'Ad Spend', value: formatKpiCurrency(adSpend.totalAdSpend), status: 'pending', note: 'Ad-spend parity pending.' },
    { label: 'CPL', value: formatKpiCurrency(cpl), status: 'careful', note: zeroAdSpendNote || 'CPL uses total ad spend / total leads when leads > 0.' },
  ];

  const trendMetrics: KpiTrackerMetric[] = [
    { label: 'Period Trend', value: 'Not enabled', status: 'pending', note: 'Existing data can support trends later, but Phase 3B does not invent period comparison calculations.' },
  ];

  const statusItems: KpiTrackerStatusItem[] = [
    { label: 'Closer parity', state: 'mostly verified' },
    { label: 'Formatting parity', state: 'verified for tested values' },
    { label: 'SDR parity', state: 'pending' },
    { label: 'Business Performance parity', state: 'pending' },
    { label: 'Refund/ad-spend parity', state: 'pending' },
    { label: 'Historical role parity', state: 'pending' },
    { label: 'Input workflow', state: 'not migrated' },
    { label: 'BigQuery writes', state: 'not approved' },
    { label: 'Old KPI tracker remains source of truth', state: 'active' },
  ];

  return {
    readOnlyWarning: 'Read-only KPI Tracker preview. Not approved as final production replacement. Old KPI tracker remains source of truth.',
    inputWarning: 'KPI input workflow is not migrated yet.',
    selectedDateRange,
    selectedTeamMembers,
    selectedRole: filters.role || 'All roles',
    summaryCards,
    closerMetrics,
    sdrMetrics,
    businessMetrics,
    trendMetrics,
    statusItems,
    inputWorkflow: {
      enabled: false,
      title: 'KPI Input Workflow — Coming in Phase 3C',
      buttonLabel: 'Input workflow not enabled',
      description: 'Input workflow is not active. No data can be submitted here yet. Old KPI tracker remains the place/source for current input. New input workflow will be designed separately. No BigQuery writes are approved yet.',
    },
  };
}
