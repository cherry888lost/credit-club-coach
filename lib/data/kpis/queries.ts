import type { KpiFilters, QuerySpec } from '../../kpis/types';

const MUTATION_PATTERN = /\b(insert|update|delete|merge|create|drop|alter|truncate|grant|revoke|call)\b/i;

function stripLeadingComments(sql: string): string {
  let current = sql.trim();
  let previous = '';

  while (current !== previous) {
    previous = current;
    current = current
      .replace(/^\/\*[\s\S]*?\*\//, '')
      .replace(/^--.*(?:\n|$)/, '')
      .trim();
  }

  return current;
}

export function assertReadOnlySql(sql: string): void {
  const normalized = stripLeadingComments(sql);

  if (!/^select\b/i.test(normalized) && !/^with\b/i.test(normalized)) {
    throw new Error('KPI BigQuery layer is read-only: SQL must start with SELECT or WITH.');
  }

  if (MUTATION_PATTERN.test(normalized)) {
    throw new Error('KPI BigQuery layer is read-only: mutation/admin SQL is not allowed.');
  }
}

function addDateFilters(filters: Pick<KpiFilters, 'startDate' | 'endDate'>, conditions: string[], params: QuerySpec['params']) {
  if (filters.startDate) {
    conditions.push('kpi_date >= @startDate');
    params.startDate = filters.startDate;
  }
  if (filters.endDate) {
    conditions.push('kpi_date <= @endDate');
    params.endDate = filters.endDate;
  }
}

export function buildKpiSummaryQuery(filters: KpiFilters = {}): QuerySpec {
  const conditions: string[] = ['1 = 1'];
  const params: QuerySpec['params'] = {};

  addDateFilters(filters, conditions, params);

  if (filters.role) {
    conditions.push('role = @role');
    params.role = filters.role;
  }

  if (Array.isArray(filters.teamMembers) && filters.teamMembers.length > 0) {
    conditions.push('team_member IN UNNEST(@teamMembers)');
    params.teamMembers = filters.teamMembers;
  }

  const sql = `
    SELECT
      team_member,
      kpi_date,
      role,
      total_scheduled_calls,
      total_live_calls,
      total_revenue,
      nf_live_calls,
      nf_revenue,
      nf_potential_revenue,
      scc_revenue,
      scc_potential_revenue,
      ecc_revenue,
      refund_count,
      refund_amount,
      nf_full_close,
      nf_partial,
      nf_deposit,
      nf_payment_plan,
      scc_full_close,
      scc_partial,
      scc_deposit,
      scc_payment_plan
    FROM \`credit-club-tracking.kpi_tracking.daily_kpi_summary\`
    WHERE ${conditions.join(' AND ')}
    ORDER BY kpi_date DESC, team_member
  `;

  assertReadOnlySql(sql);
  return { sql, params };
}

export function buildAdSpendSummaryQuery(filters: Pick<KpiFilters, 'startDate' | 'endDate'> = {}): QuerySpec {
  const conditions: string[] = ['1 = 1'];
  const params: QuerySpec['params'] = {};

  if (filters.startDate) {
    conditions.push('date >= @startDate');
    params.startDate = filters.startDate;
  }
  if (filters.endDate) {
    conditions.push('date <= @endDate');
    params.endDate = filters.endDate;
  }

  const sql = `
    SELECT
      COALESCE(SUM(ad_spend), 0) AS total_ad_spend,
      COALESCE(SUM(leads), 0) AS total_leads
    FROM \`credit-club-tracking.kpi_tracking.ad_spend\`
    WHERE ${conditions.join(' AND ')}
  `;

  assertReadOnlySql(sql);
  return { sql, params };
}
