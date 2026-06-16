import Link from 'next/link';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, Lock, ShieldCheck } from 'lucide-react';
import { isMergedKpiDashboardPreviewEnabled } from '@/lib/kpis/field-map';
import { normalizeMergedPreviewFilters } from '@/lib/kpis/filters';
import { buildMergedDashboardModel, type DisplayMetric } from '@/lib/kpis/merged-preview';

export const dynamic = 'force-dynamic';

interface MergedPreviewPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MergedDashboardPreviewPage({ searchParams }: MergedPreviewPageProps) {
  const enabled = isMergedKpiDashboardPreviewEnabled();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = normalizeMergedPreviewFilters(resolvedSearchParams);
  const model = buildMergedDashboardModel({ filters });

  if (!enabled) {
    return (
      <main className="space-y-6">
        <PreviewWarning title="Merged sales + KPI preview disabled">
          This controlled Phase 2A route is hidden by default. Set <code>FEATURE_MERGED_KPI_DASHBOARD=true</code> or{' '}
          <code>FEATURE_KPI_READONLY_MODULE=true</code> in an approved preview environment to view it.
        </PreviewWarning>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" /> Phase 2B internal beta
            </p>
            <h1 className="mt-2 text-3xl font-bold">Merged Sales + KPI Dashboard Beta</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6">
              {model.betaStatus.banner}
            </p>
          </div>
          <div className="rounded-2xl bg-white/70 p-4 text-sm dark:bg-black/20">
            <p className="font-semibold">Guards active</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Feature-flagged route</li>
              <li>KPI module read-only</li>
              <li>No BigQuery writes</li>
              <li>Sales tracker routes unchanged</li>
            </ul>
          </div>
        </div>
      </section>

      <FilterSummary filters={model.filters} availableMembers={model.availableMembers} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {model.warnings.map((warning) => (
          <div key={warning} className="rounded-2xl border border-amber-200 bg-white p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-zinc-900 dark:text-amber-100">
            <AlertTriangle className="mb-2 h-5 w-5" />
            {warning}
          </div>
        ))}
      </section>

      <DashboardSection title="Beta status and parity risk" description="Managers can review this beta, but launch blockers remain visible and unchanged.">
        <StatusGrid items={model.betaStatus.parityItems} />
      </DashboardSection>

      <DashboardSection title="Manager review notes" description="Read-only review checklist. This does not save notes or write to BigQuery/production data.">
        <Checklist columns={[model.managerReviewChecklist, model.launchReadinessChecklist]} headings={['Internal beta review', 'Launch readiness blockers']} />
      </DashboardSection>

      <DashboardSection title="Combined Performance Summary" description="A preview-only home for sales tracker links and KPI status. Existing sales tracker logic remains on the original routes.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {model.salesMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection title="Sales Tracker" description="Phase 2A preserves the current sales tracker. These links route to the existing pages instead of reimplementing sales formulas here.">
        <div className="flex flex-wrap gap-3">
          <PreviewLink href="/dashboard">Existing overview</PreviewLink>
          <PreviewLink href="/dashboard/calls">Calls</PreviewLink>
          <PreviewLink href="/dashboard/reps">Reps</PreviewLink>
          <PreviewLink href="/dashboard/analysis">Analysis</PreviewLink>
        </div>
      </DashboardSection>

      <DashboardSection title="KPI Tracker — Closer Section" description="Uses lib/kpis calculation helpers and legacy-compatible formatting. Closer A parity passed for captured values; remaining non-closer parity gaps are labelled below.">
        <MetricGrid metrics={model.closerMetrics} />
      </DashboardSection>

      <DashboardSection title="KPI Tracker — SDR Section" description="Read-only preview using the same KPI helpers. SDR dashboard parity remains a launch blocker until manual capture/assertion tests are complete.">
        <MetricGrid metrics={model.sdrMetrics} />
      </DashboardSection>

      <DashboardSection title="KPI Tracker — Business Performance" description="Read-only preview. Business Performance, ad-spend, refund, and role parity are not final until remaining Phase 1.5 gaps are closed.">
        <MetricGrid metrics={model.businessMetrics} />
      </DashboardSection>
    </main>
  );
}

function PreviewWarning({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"><Lock className="h-4 w-4" /> Hidden route</p>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-sm leading-6">{children}</p>
    </section>
  );
}

function FilterSummary({ filters, availableMembers }: { filters: ReturnType<typeof normalizeMergedPreviewFilters>; availableMembers: string[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
        <BarChart3 className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Shared preview filters</h2>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
        <FilterPill label="Start" value={filters.startDate} />
        <FilterPill label="End" value={filters.endDate} />
        <FilterPill label="Role" value={filters.role} />
        <FilterPill label="Team" value={filters.team} />
        <FilterPill label="Member" value={filters.teamMember} />
        <FilterPill label="Section" value={filters.section} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <PreviewLink href="/dashboard/merged-preview?role=all&team=All&teamMember=All&section=overview">All Members</PreviewLink>
        <PreviewLink href="/dashboard/merged-preview?role=closer&team=All&teamMember=All&section=closers">Closer scope</PreviewLink>
        <PreviewLink href="/dashboard/merged-preview?role=sdr&team=All&teamMember=All&section=sdrs">SDR scope</PreviewLink>
        <PreviewLink href="/dashboard/merged-preview?team=Team%20A&teamMember=All&role=all&section=overview">Unsupported Team A warning</PreviewLink>
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Available sanitized preview members: {availableMembers.length > 0 ? availableMembers.join(', ') : 'none for this scope'}.
        Live BigQuery reads remain behind the read-only data layer and are not required for this sanitized preview render.
      </p>
    </section>
  );
}

function FilterPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}

function DashboardSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: DisplayMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

function MetricCard({ metric }: { metric: DisplayMetric }) {
  const tone = metric.status === 'confirmed'
    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
    : metric.status === 'gap'
      ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
      : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{metric.label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{metric.value}</p>
      {metric.status && <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">{metric.status}</p>}
      {metric.note && <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{metric.note}</p>}
    </div>
  );
}

function StatusGrid({ items }: { items: { label: string; state: string; note: string }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <CheckCircle2 className="h-4 w-4" /> {item.label}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">{item.state}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

function Checklist({ columns, headings }: { columns: string[][]; headings: string[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {columns.map((items, index) => (
        <div key={headings[index]} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
            <ClipboardCheck className="h-4 w-4" /> {headings[index]}
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PreviewLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:text-zinc-200" href={href}>
      {children}
    </Link>
  );
}
