export const kpiBigQueryFieldMap = {
  teamMember: 'team_member',
  kpiDate: 'kpi_date',
  role: 'role',
  totalScheduledCalls: 'total_scheduled_calls',
  totalLiveCalls: 'total_live_calls',
  totalRevenue: 'total_revenue',
  nfLiveCalls: 'nf_live_calls',
  nfRevenue: 'nf_revenue',
  nfPotentialRevenue: 'nf_potential_revenue',
  sccRevenue: 'scc_revenue',
  sccPotentialRevenue: 'scc_potential_revenue',
  eccRevenue: 'ecc_revenue',
  refundCount: 'refund_count',
  refundAmount: 'refund_amount',
  nfFullClose: 'nf_full_close',
  nfPartial: 'nf_partial',
  nfDeposit: 'nf_deposit',
  nfPaymentPlan: 'nf_payment_plan',
  sccFullClose: 'scc_full_close',
  sccPartial: 'scc_partial',
  sccDeposit: 'scc_deposit',
  sccPaymentPlan: 'scc_payment_plan',
} as const;

export const unconfirmedPhaseOneKpis = [
  'revenue_by_source chart SQL/object type',
  'admin input workflow parity',
  'production Business Performance sample outputs',
  'external Slack ingestion status',
] as const;

export function isKpiReadonlyPreviewEnabled(): boolean {
  return process.env.FEATURE_KPI_READONLY_MODULE === 'true';
}

export function isMergedKpiDashboardPreviewEnabled(): boolean {
  return process.env.FEATURE_MERGED_KPI_DASHBOARD === 'true' || isKpiReadonlyPreviewEnabled();
}

export function isKpiTrackerV2Enabled(): boolean {
  return process.env.FEATURE_KPI_TRACKER_V2 === 'true';
}
