import { describe, expect, it } from 'vitest';
import { buildAdSpendSummaryQuery, buildKpiSummaryQuery } from './queries';

type BigQueryParameterValue =
  | { value: string }
  | { arrayValues: Array<{ value: string }> };

interface BigQueryQueryParameter {
  name: string;
  parameterType: { type: string; arrayType?: { type: string } };
  parameterValue: BigQueryParameterValue;
}

interface BigQueryRestRow {
  f?: Array<{ v: unknown }>;
}

const runLiveParity = process.env.KPI_LIVE_PARITY === 'true';
const projectId = process.env.KPI_BIGQUERY_PROJECT_ID ?? 'credit-club-tracking';
const startDate = process.env.KPI_PARITY_START_DATE ?? '2026-06-01';
const endDate = process.env.KPI_PARITY_END_DATE ?? '2026-06-15';

function toQueryParameters(params: Record<string, unknown> = {}): BigQueryQueryParameter[] {
  return Object.entries(params).map(([name, value]) => {
    if (Array.isArray(value)) {
      return {
        name,
        parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } },
        parameterValue: { arrayValues: value.map((item) => ({ value: String(item) })) },
      };
    }

    return {
      name,
      parameterType: { type: 'STRING' },
      parameterValue: { value: String(value) },
    };
  });
}

async function getAccessToken(): Promise<string> {
  const envToken = process.env.KPI_BIGQUERY_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;

  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  try {
    const { stdout } = await execFileAsync('gcloud', ['auth', 'print-access-token']);
    const token = stdout.trim();
    if (!token) throw new Error('gcloud did not return an access token.');
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Live KPI parity requires read-only BigQuery credentials. Set KPI_BIGQUERY_ACCESS_TOKEN at runtime or install/authenticate gcloud. No credentials should be committed. Details: ${message}`,
    );
  }
}

async function runReadOnlyBigQuery(sql: string, params: Record<string, unknown> = {}): Promise<BigQueryRestRow[]> {
  const token = await getAccessToken();
  const response = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: sql,
      useLegacySql: false,
      parameterMode: 'NAMED',
      queryParameters: toQueryParameters(params),
      maxResults: 25,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`BigQuery read-only query failed: ${JSON.stringify(json)}`);
  }
  return json.rows ?? [];
}

const liveDescribe = runLiveParity ? describe : describe.skip;

liveDescribe('live read-only KPI BigQuery parity harness', () => {
  it('can read closer KPI summary rows with parameterized SELECT-only SQL', async () => {
    const spec = buildKpiSummaryQuery({ startDate, endDate, role: 'closer' });
    const rows = await runReadOnlyBigQuery(spec.sql, spec.params);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('can read SDR KPI summary rows with parameterized SELECT-only SQL', async () => {
    const spec = buildKpiSummaryQuery({ startDate, endDate, role: 'sdr' });
    const rows = await runReadOnlyBigQuery(spec.sql, spec.params);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('can read ad spend summary rows with parameterized SELECT-only SQL', async () => {
    const spec = buildAdSpendSummaryQuery({ startDate, endDate });
    const rows = await runReadOnlyBigQuery(spec.sql, spec.params);
    expect(Array.isArray(rows)).toBe(true);
  });
});
