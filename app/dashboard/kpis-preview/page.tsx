import { calculateBusinessPerformance, sumKpiRows } from '@/lib/kpis/business-performance';
import { formatKpiCount, formatKpiCurrency, formatKpiMultiple, formatKpiPercent } from '@/lib/kpis/formatting';
import { isKpiReadonlyPreviewEnabled, unconfirmedPhaseOneKpis } from '@/lib/kpis/field-map';
import { sanitizedAdSpendSummary, sanitizedCloserRows, sanitizedSdrRows } from '@/lib/data/kpis/fixtures';

export default function KpisReadonlyPreviewPage() {
  const enabled = isKpiReadonlyPreviewEnabled();
  const closerTotals = sumKpiRows(sanitizedCloserRows);
  const sdrTotals = sumKpiRows(sanitizedSdrRows);
  const businessPerformance = calculateBusinessPerformance(sanitizedCloserRows, sanitizedSdrRows, sanitizedAdSpendSummary);

  if (!enabled) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-sm font-semibold uppercase tracking-wide">Hidden Phase 1 route</p>
          <h1 className="mt-2 text-2xl font-bold">Read-only KPI preview disabled</h1>
          <p className="mt-3">
            Read-only KPI preview. Not approved for launch. Old KPI tracker remains source of truth.
          </p>
          <p className="mt-2 text-sm">
            Set <code>FEATURE_KPI_READONLY_MODULE=true</code> to enable this hidden preview route locally or in an approved preview environment.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="text-sm font-semibold uppercase tracking-wide">Phase 1 hidden preview</p>
        <h1 className="mt-2 text-2xl font-bold">Read-only KPI preview</h1>
        <p className="mt-3 font-medium">
          Read-only KPI preview. Not approved for launch. Old KPI tracker remains source of truth.
        </p>
        <p className="mt-2 text-sm">
          This page uses sanitized fixtures by default. It is not in normal navigation and does not write to BigQuery.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Metric label="Closer First Call Cash" value={formatKpiCurrency(closerTotals.firstCallCash)} />
        <Metric label="Closer Recovery Cash" value={formatKpiCurrency(closerTotals.recoveryCash)} />
        <Metric label="Closer New Customers" value={formatKpiCount(closerTotals.newCustomers)} />
        <Metric label="Closer Close Rate" value={formatKpiPercent(closerTotals.closeRate)} />
        <Metric label="Closer Show Up Rate" value={formatKpiPercent(closerTotals.showUpRate)} />
        <Metric label="Closer Refund Rate" value={formatKpiPercent(closerTotals.refundRate)} />
        <Metric label="SDR First Call Cash" value={formatKpiCurrency(sdrTotals.firstCallCash)} />
        <Metric label="SDR Recovery Cash" value={formatKpiCurrency(sdrTotals.recoveryCash)} />
        <Metric label="SDR New Customers" value={formatKpiCount(sdrTotals.newCustomers)} />
        <Metric label="BP Cash Collected" value={formatKpiCurrency(businessPerformance.cashCollected)} />
        <Metric label="BP Recovered Cash" value={formatKpiCurrency(businessPerformance.recoveredCash)} />
        <Metric label="BP CAC" value={formatKpiCurrency(businessPerformance.cac)} />
        <Metric label="BP Blended CAC" value={formatKpiCurrency(businessPerformance.blendedCac)} />
        <Metric label="BP ROAS" value={formatKpiMultiple(businessPerformance.roas)} />
        <Metric label="BP ARPU" value={formatKpiCurrency(businessPerformance.arpu)} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Not implemented in Phase 1</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          {unconfirmedPhaseOneKpis.map((item) => (
            <li key={item}>{item} — UNCONFIRMED</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}
