import { sanitizedAdSpendSummary, sanitizedCloserRows, sanitizedSdrRows } from '../data/kpis/fixtures';
import { calculateBusinessPerformance, sumKpiRows } from './business-performance';
import { filterKpiRows, getAvailableKpiMembers, type MergedPreviewFilters } from './filters';
import { formatKpiCount, formatKpiCurrency, formatKpiMultiple, formatKpiPercent } from './formatting';
import type { AdSpendSummary, BusinessPerformanceMetrics, KpiSummaryRow, KpiTotals } from './types';

export interface DisplayMetric {
  label: string;
  value: string;
  status?: 'confirmed' | 'gap' | 'preview';
  note?: string;
}

export interface MergedDashboardModel {
  filters: MergedPreviewFilters;
  availableMembers: string[];
  closerRows: KpiSummaryRow[];
  sdrRows: KpiSummaryRow[];
  closerTotals: KpiTotals;
  sdrTotals: KpiTotals;
  businessPerformance: BusinessPerformanceMetrics;
  salesMetrics: DisplayMetric[];
  closerMetrics: DisplayMetric[];
  sdrMetrics: DisplayMetric[];
  businessMetrics: DisplayMetric[];
  warnings: string[];
}

interface BuildModelInput {
  filters: MergedPreviewFilters;
  closerRows?: KpiSummaryRow[];
  sdrRows?: KpiSummaryRow[];
  adSpend?: AdSpendSummary;
}

function buildKpiMetricCards(totals: KpiTotals, parityStatus: 'confirmed' | 'gap'): DisplayMetric[] {
  return [
    { label: 'First Call Cash', value: formatKpiCurrency(totals.firstCallCash), status: parityStatus },
    { label: 'Recovery Cash', value: formatKpiCurrency(totals.recoveryCash), status: parityStatus },
    { label: 'Total Cash Collected', value: formatKpiCurrency(totals.totalCash), status: parityStatus },
    { label: 'Potential Revenue', value: formatKpiCurrency(totals.potentialRevenue), status: parityStatus },
    { label: 'Scheduled Calls', value: formatKpiCount(totals.scheduledCalls), status: parityStatus },
    { label: 'Live Calls', value: formatKpiCount(totals.liveCalls), status: parityStatus },
    { label: 'New Customers', value: formatKpiCount(totals.newCustomers), status: parityStatus },
    { label: 'First Call Close Customers', value: formatKpiCount(totals.firstCallCloseCustomers), status: parityStatus },
    { label: 'Customers Refunded', value: formatKpiCount(totals.refundCount), status: 'gap', note: 'Refund parity still launch-blocking.' },
    { label: 'Show Up Rate', value: formatKpiPercent(totals.showUpRate), status: parityStatus },
    { label: 'Close Rate', value: formatKpiPercent(totals.closeRate), status: parityStatus },
    { label: 'Refund Rate', value: formatKpiPercent(totals.refundRate), status: 'gap', note: 'Refund gauge/display parity still pending.' },
    { label: 'ARPU', value: formatKpiCurrency(totals.arpu), status: parityStatus },
    { label: 'Refunded Amount', value: formatKpiCurrency(totals.refundAmount), status: 'gap', note: 'Refund amount parity still pending.' },
  ];
}

function buildBusinessMetricCards(metrics: BusinessPerformanceMetrics): DisplayMetric[] {
  return [
    { label: 'Cash Collected', value: formatKpiCurrency(metrics.cashCollected), status: 'gap' },
    { label: 'Recovered Cash', value: formatKpiCurrency(metrics.recoveredCash), status: 'gap' },
    { label: 'Total Cash', value: formatKpiCurrency(metrics.totalCash), status: 'gap' },
    { label: 'New Customers', value: formatKpiCount(metrics.totalNewCustomers), status: 'gap' },
    { label: 'Refunds', value: `${formatKpiCount(metrics.totalRefundCount)} / ${formatKpiCurrency(metrics.totalRefundAmount)}`, status: 'gap' },
    { label: 'Ad Spend', value: formatKpiCurrency(metrics.totalAdSpend), status: 'gap' },
    { label: 'ARPU', value: formatKpiCurrency(metrics.arpu), status: 'gap' },
    { label: 'Total Leads', value: formatKpiCount(metrics.totalLeads), status: 'gap' },
    { label: 'CAC', value: formatKpiCurrency(metrics.cac), status: 'gap' },
    { label: 'Blended CAC', value: formatKpiCurrency(metrics.blendedCac), status: 'gap' },
    { label: 'ROAS', value: formatKpiMultiple(metrics.roas), status: 'gap' },
  ];
}

export function buildMergedDashboardModel({
  filters,
  closerRows = sanitizedCloserRows,
  sdrRows = sanitizedSdrRows,
  adSpend = sanitizedAdSpendSummary,
}: BuildModelInput): MergedDashboardModel {
  const allRows = [...closerRows, ...sdrRows];
  const scopedCloserRows = filterKpiRows(closerRows, filters, 'closer');
  const scopedSdrRows = filterKpiRows(sdrRows, filters, 'sdr');
  const closerTotals = sumKpiRows(scopedCloserRows);
  const sdrTotals = sumKpiRows(scopedSdrRows);
  const businessPerformance = calculateBusinessPerformance(scopedCloserRows, scopedSdrRows, adSpend);

  const warnings = [
    'Read-only merged dashboard preview. Not approved for launch. Old KPI tracker remains source of truth.',
    'SDR, Business Performance, refund/ad-spend, and historical role parity checks are still pending.',
  ];

  if (filters.team !== 'All') {
    warnings.push('Team mapping is not confirmed in Phase 2A; non-All team scope returns no KPI rows rather than mixing unknown memberships.');
  }

  if (filters.teamMember !== 'All') {
    warnings.push(`KPI scope is person-level for ${filters.teamMember}. Do not compare against aggregate old-dashboard values.`);
  }

  return {
    filters,
    availableMembers: getAvailableKpiMembers(allRows, filters.role === 'all' ? undefined : filters.role),
    closerRows: scopedCloserRows,
    sdrRows: scopedSdrRows,
    closerTotals,
    sdrTotals,
    businessPerformance,
    salesMetrics: [
      { label: 'Sales Tracker', value: 'Existing routes intact', status: 'preview', note: 'Phase 2A links to existing sales tracker sections without changing their formulas.' },
      { label: 'Calls', value: '/dashboard/calls', status: 'preview' },
      { label: 'Reps', value: '/dashboard/reps', status: 'preview' },
      { label: 'Analysis', value: '/dashboard/analysis', status: 'preview' },
    ],
    closerMetrics: buildKpiMetricCards(closerTotals, 'confirmed'),
    sdrMetrics: buildKpiMetricCards(sdrTotals, 'gap'),
    businessMetrics: buildBusinessMetricCards(businessPerformance),
    warnings,
  };
}
