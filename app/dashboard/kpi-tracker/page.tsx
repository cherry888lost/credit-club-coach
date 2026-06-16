import { AlertTriangle, BarChart3, Ban, CalendarDays, CheckCircle2, Database, Lock, Users } from 'lucide-react';
import { sanitizedAdSpendSummary, sanitizedCloserRows, sanitizedSdrRows } from '@/lib/data/kpis/fixtures';
import { isKpiTrackerV2Enabled } from '@/lib/kpis/field-map';
import { buildKpiTrackerV2ViewModel, type KpiTrackerMetric } from '@/lib/kpis/kpi-tracker-v2';

export const dynamic = 'force-dynamic';

const previewFilters = {
  startDate: 'Preview range start',
  endDate: 'Preview range end',
  teamMembers: 'All' as const,
};

const REQUIRED_WARNINGS = {
  readOnly: 'Read-only KPI Tracker preview. Not approved as final production replacement. Old KPI tracker remains source of truth.',
  input: 'KPI input workflow is not migrated yet.',
  inputTitle: 'KPI Input Workflow — Coming in Phase 3C',
  inputButton: 'Input workflow not enabled',
} as const;

const REQUIRED_STATUS_LABELS = [
  'Closer parity: mostly verified',
  'Formatting parity: verified for tested values',
  'SDR parity: pending',
  'Business Performance parity: pending',
  'Refund/ad-spend parity: pending',
  'Historical role parity: pending',
  'Input workflow: not migrated',
  'BigQuery writes: not approved',
  'Old KPI tracker remains source of truth',
] as const;

export default function KpiTrackerV2Page() {
  const enabled = isKpiTrackerV2Enabled();
  const model = buildKpiTrackerV2ViewModel({
    closerRows: sanitizedCloserRows,
    sdrRows: sanitizedSdrRows,
    adSpend: sanitizedAdSpendSummary,
    filters: previewFilters,
  });

  if (!enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">KPI Tracker</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Separate read-only KPI Tracker preview is disabled.
          </p>
        </div>

        <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Feature flag disabled
              </p>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mt-1">
                FEATURE_KPI_TRACKER_V2 is false or unset
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                {REQUIRED_WARNINGS.readOnly}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {REQUIRED_WARNINGS.input}
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">KPI Tracker</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Separate read-only dashboard preview · Old KPI tracker remains source of truth
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="amber">Read-only preview</StatusPill>
          <StatusPill tone="zinc">FEATURE_KPI_TRACKER_V2</StatusPill>
        </div>
      </div>

      <section className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {REQUIRED_WARNINGS.readOnly}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {REQUIRED_WARNINGS.input}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard icon={<CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />} label="Selected Date Range" value={model.selectedDateRange} />
        <InfoCard icon={<Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />} label="Team / Member Filter" value={model.selectedTeamMembers} />
        <InfoCard icon={<Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />} label="Role Filter" value={model.selectedRole} />
      </section>

      <section>
        <SectionHeader title="KPI Overview" description="Read-only summary cards using the existing KPI calculation and formatting layers." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {model.summaryCards.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Closer Dashboard" description="Closer KPI values preserve audited formulas; remaining parity gaps stay labelled." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {model.closerMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="SDR Dashboard" description="Visible but clearly pending full old-vs-new parity capture." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {model.sdrMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Business Performance" description="Ad-spend/refund dependent metrics are labelled carefully until parity is complete." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {model.businessMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Trends / Period Comparison" description="No unconfirmed trend calculations are presented as final values in Phase 3B." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {model.trendMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Known Gaps / Status" description="This preview is intentionally not production-approved." />
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
          {REQUIRED_STATUS_LABELS.map((label) => (
            <div key={label} className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
              <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Disabled placeholder
              </p>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mt-1">{REQUIRED_WARNINGS.inputTitle}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-3xl">
                {model.inputWorkflow.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
          >
            {REQUIRED_WARNINGS.inputButton}
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}

function MetricCard({ metric }: { metric: KpiTrackerMetric }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5 h-full">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{metric.label}</span>
        </div>
        {metric.status && <StatusPill tone={metric.status === 'mostly verified' ? 'green' : metric.status === 'pending' ? 'amber' : 'zinc'}>{metric.status}</StatusPill>}
      </div>
      <p className="text-3xl font-bold text-zinc-900 dark:text-white">{metric.value}</p>
      {metric.note && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{metric.note}</p>}
    </div>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'green' | 'zinc' }) {
  const tones = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    zinc: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  };

  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
}
