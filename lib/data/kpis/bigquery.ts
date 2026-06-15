import { normalizeAdSpendSummary, normalizeKpiSummaryRow } from './mapper';
import { buildAdSpendSummaryQuery, buildKpiSummaryQuery } from './queries';
import type { AdSpendSummary, KpiFilters, KpiSummaryRow, QuerySpec } from '../../kpis/types';

interface ReadOnlyBigQueryClient {
  query(options: { query: string; params?: QuerySpec['params'] }): Promise<[Record<string, unknown>[]]>;
}

async function runReadOnlyQuery(client: ReadOnlyBigQueryClient, spec: QuerySpec): Promise<Record<string, unknown>[]> {
  const { assertReadOnlySql } = await import('./queries');
  assertReadOnlySql(spec.sql);
  const [rows] = await client.query({ query: spec.sql, params: spec.params });
  return rows;
}

export async function fetchKpiSummaryRows(
  client: ReadOnlyBigQueryClient,
  filters: KpiFilters = {},
): Promise<KpiSummaryRow[]> {
  const rows = await runReadOnlyQuery(client, buildKpiSummaryQuery(filters));
  return rows.map(normalizeKpiSummaryRow);
}

export async function fetchAdSpendSummary(
  client: ReadOnlyBigQueryClient,
  filters: Pick<KpiFilters, 'startDate' | 'endDate'> = {},
): Promise<AdSpendSummary> {
  const rows = await runReadOnlyQuery(client, buildAdSpendSummaryQuery(filters));
  return normalizeAdSpendSummary(rows[0]);
}
