# KPI Tracker Controlled Migration Architecture Plan

> **For Hermes:** Do not implement this plan until Arshid explicitly approves build work.

Status: **Plan only. No implementation.**

Goal: merge the old KPI tracker into the existing sales tracker while preserving all existing sales tracker behavior and old KPI formulas exactly.

## Non-negotiable guardrails

- Original KPI tracker remains untouched.
- No Cloud Run, BigQuery, source, credential, permission, or production-data changes without explicit approval.
- No credential files/plaintext passwords copied into the merged app.
- Existing sales tracker remains intact; KPI module is added behind isolated routes/modules.
- KPI formulas must not live directly in UI components.
- Old KPI tracker remains live until parity is verified.

## Proposed module structure

Use the requested dedicated KPI logic layer:

```text
lib/kpis/
  registry.ts
  calculations.ts
  formatting.ts
  filters.ts
  parity.ts
```

Recommended expanded structure:

```text
lib/kpis/
  registry.ts                 # KPI metadata, source fields, formula IDs, confidence
  calculations.ts             # pure calculation functions, no DB/UI
  business-performance.ts     # BP-specific composition formulas
  formatting.ts               # GBP/count/percent/ROAS formatters
  filters.ts                  # date/team/role filter builders
  thresholds.ts               # gauge/traffic-light thresholds
  parity.ts                   # old-vs-new comparison helpers
  types.ts                    # row/result types
  field-map.ts                # old BigQuery field names to internal names

lib/data/kpis/
  bigquery.ts                 # BigQuery client/query adapter
  queries.ts                  # parameterized SQL only
  mapper.ts                   # BigQuery rows -> typed KPI rows
  fixtures.ts                 # approved parity fixtures

app/(dashboard)/kpis/
  page.tsx                    # KPI dashboard shell
  closer/page.tsx             # optional route/view
  sdr/page.tsx
  business/page.tsx
  input/page.tsx              # later, only after write flow approved

components/kpis/
  KpiCard.tsx
  KpiGauge.tsx
  KpiChart.tsx
  KpiFilterBar.tsx
  KpiInputForm.tsx            # later phase only
```

## Existing sales tracker stays intact

- Do not modify existing sales pages/data models until KPI module is proven in isolation.
- Add KPI routes under a separate route group or feature flag.
- Sales tracker formulas remain in their current domain module; if none exists, create `lib/sales/` separately.
- Shared UI components may be reused, but sales logic and KPI logic stay separate.

Recommended separation:

```text
lib/sales/
  calculations.ts
  filters.ts
  formatting.ts

lib/kpis/
  calculations.ts
  filters.ts
  formatting.ts
```

## Formula placement

- `lib/kpis/registry.ts`: declares each KPI, inputs, formula function, dashboard locations, confidence.
- `lib/kpis/calculations.ts`: Closer/SDR formulas.
- `lib/kpis/business-performance.ts`: Business Performance formulas.
- `lib/kpis/thresholds.ts`: close/show/refund gauge thresholds.
- UI components receive calculated display models; they must not compute KPI formulas.

## Shared filters

Filter shape:

```ts
type KpiFilters = {
  startDate: string; // YYYY-MM-DD, inclusive
  endDate: string;   // YYYY-MM-DD, inclusive
  teamMembers: string[] | 'All';
  role?: 'closer' | 'sdr';
};
```

Rules:

- Date ranges map to `kpi_date >= @startDate AND kpi_date <= @endDate`.
- Team filter maps to `team_member IN UNNEST(@teamMembers)` if not All.
- Closer Dashboard role = `closer`.
- SDR Dashboard role = `sdr`.
- Business Performance loads closer and SDR separately and ignores member filter unless a future approved design says otherwise.

## Team member mapping

- Old KPI tracker uses BigQuery `users.team_member` and `kpi_records.team_member` strings.
- Existing sales tracker may have Clerk/Supabase users; do not assume one-to-one mapping.
- Create mapping table/config in new app:

```ts
type TeamMemberMapping = {
  kpiTeamMember: string;
  salesUserId?: string;
  clerkUserId?: string;
  displayName: string;
  roles: Array<'closer' | 'sdr' | 'admin' | 'viewer'>;
  active: boolean;
};
```

Phase 1 can read old KPI `users` only for mapping, excluding password field.

## Role mapping

Old roles:

- `admin`
- `viewer`
- `closer`
- `sdr`
- `closer,sdr`

New roles should map into existing sales tracker auth roles if available:

- owner/admin: all dashboards + admin settings.
- viewer/leadership: read-only dashboards.
- closer: closer dashboard + own input if approved.
- sdr: SDR dashboard + own input if approved.

Do not migrate plaintext passwords. Auth should use the existing sales tracker auth provider.

## Date range logic

- Preserve inclusive date boundaries.
- Use date-only strings in business timezone.
- Do not convert dates through UTC timestamps for `kpi_date` filters.
- Default date range should match old dashboard unless user approves a new default.

## BigQuery access strategy

Recommended Phase 1: **live read from existing BigQuery views/tables**, read-only.

Why:

- Lowest risk.
- Preserves existing `daily_kpi_summary` view logic.
- Avoids data migration before formula parity.

Implementation approach after approval:

- Use server-side BigQuery queries only.
- Parameterize all SQL.
- Do not expose service credentials to client.
- Prefer workload identity/service account on deployment platform.
- If deploying outside GCP, use secure secret manager/env vars; no credential files in repo.

## Live vs synced/cached/imported

Recommended progression:

1. Read-only live queries for parity build.
2. Add short cache only after parity, e.g. 60-300 seconds, if performance needs it.
3. Do not import historical data into app DB initially.
4. Consider later snapshot/cache table only if BigQuery cost/latency becomes a problem.

## Historical data

- Keep history in BigQuery initially.
- Preserve `slack_message_ts` / manual IDs as legacy record IDs.
- Do not rewrite old records.
- If eventually moving storage, perform an export/import with immutable IDs and row counts/checksums.

## Admin/input workflow

Phase 1:

- Read-only dashboard only.
- No KPI input writes from new app.
- No ad spend writes from new app.

Phase 2 after approval/parity:

- Add input forms behind feature flag.
- Writes should be parameterized.
- Prefer soft delete/audit logs rather than hard deletes.
- Keep old app write-enabled until new input workflow is approved, then controlled cutover.

## Future KPI addition

Add new KPIs through registry only:

1. Add source fields to `types.ts` / `field-map.ts`.
2. Add pure formula in `calculations.ts` or `business-performance.ts`.
3. Add metadata in `registry.ts`.
4. Add unit tests.
5. Add parity test if replacing old KPI.
6. Add UI card/chart that consumes registry result.

## Migration phases

### Phase 0 — approval checkpoint

- Review these deliverables.
- Decide whether to proceed to read-only build.

### Phase 1 — read-only KPI module

- Add `lib/kpis` and read-only BigQuery adapter.
- Build Closer/SDR/Business KPI pages under separate route/feature flag.
- No writes.

### Phase 2 — parity testing

- Compare old dashboard outputs vs new calculations for approved date/member/role samples.
- Fix differences or document approved deviations.

### Phase 3 — role/team integration

- Map old roles/team members to sales tracker users.
- Confirm read visibility.

### Phase 4 — input/admin migration, only if approved

- Add Daily KPI Input and Ad Spend Input.
- Implement safer auth, parameterized writes, audit log.
- Test with non-production dataset first.

### Phase 5 — cutover

- Run old/new side by side.
- Freeze old writes only at approved cutover time.
- Keep old dashboard read-only for one reporting cycle.

## Recommendation

Proceed only to a **read-only KPI module build** after approval. Do not migrate writes/admin input until formula parity and role mapping are confirmed.
