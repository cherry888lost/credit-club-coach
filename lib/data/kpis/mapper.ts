import type { AdSpendSummary, KpiRole, KpiSummaryRow } from '../../kpis/types';

type RawRow = Record<string, unknown>;

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toDateString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') return value.value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function toRole(value: unknown): KpiRole {
  if (value === 'closer' || value === 'sdr') return value;
  throw new Error(`Unsupported KPI row role: ${String(value)}`);
}

export function normalizeKpiSummaryRow(row: RawRow): KpiSummaryRow {
  return {
    teamMember: String(row.team_member ?? ''),
    kpiDate: toDateString(row.kpi_date),
    role: toRole(row.role),
    totalScheduledCalls: toNumber(row.total_scheduled_calls),
    totalLiveCalls: toNumber(row.total_live_calls),
    totalRevenue: toNumber(row.total_revenue),
    nfLiveCalls: toNumber(row.nf_live_calls),
    nfRevenue: toNumber(row.nf_revenue),
    nfPotentialRevenue: toNumber(row.nf_potential_revenue),
    sccRevenue: toNumber(row.scc_revenue),
    sccPotentialRevenue: toNumber(row.scc_potential_revenue),
    eccRevenue: toNumber(row.ecc_revenue),
    refundCount: toNumber(row.refund_count),
    refundAmount: toNumber(row.refund_amount),
    nfFullClose: toNumber(row.nf_full_close),
    nfPartial: toNumber(row.nf_partial),
    nfDeposit: toNumber(row.nf_deposit),
    nfPaymentPlan: toNumber(row.nf_payment_plan),
    sccFullClose: toNumber(row.scc_full_close),
    sccPartial: toNumber(row.scc_partial),
    sccDeposit: toNumber(row.scc_deposit),
    sccPaymentPlan: toNumber(row.scc_payment_plan),
  };
}

export function normalizeAdSpendSummary(row: RawRow | undefined): AdSpendSummary {
  return {
    totalAdSpend: toNumber(row?.total_ad_spend),
    totalLeads: toNumber(row?.total_leads),
  };
}
