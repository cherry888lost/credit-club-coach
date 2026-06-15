# Phase 2A — Merged Sales + KPI Dashboard Preview

Date: 2026-06-15
Status: Controlled preview build only. Not approved for public launch or production cutover.

## Scope

Phase 2A adds a feature-flagged merged dashboard preview inside the existing sales tracker environment. The old KPI tracker remains the source of truth. The existing sales tracker remains intact and is not replaced.

## Route added

- `/dashboard/merged-preview`

The route is hidden by default and shows a disabled-state message unless a preview flag is explicitly enabled.

## Feature flags

Default state is false/unset.

- `FEATURE_MERGED_KPI_DASHBOARD=true` enables the merged preview route.
- `FEATURE_KPI_READONLY_MODULE=true` also enables it for compatibility with the existing KPI preview flag.

The merged preview is not added to normal production navigation.

## Dashboard structure

The merged preview contains:

1. Phase 2A warning banner
   - Read-only preview
   - Not approved for launch
   - Old KPI tracker remains source of truth
   - Remaining parity gaps visible

2. Shared preview filter summary
   - Start date
   - End date
   - Role
   - Team
   - Team member
   - Dashboard section

3. Combined Overview
   - Links/status for existing sales tracker areas
   - No sales tracker formula changes

4. Sales Tracker section
   - Links to existing routes:
     - `/dashboard`
     - `/dashboard/calls`
     - `/dashboard/reps`
     - `/dashboard/analysis`
   - Existing sales tracker logic stays on those original routes.

5. KPI Tracker sections
   - Closer Section
   - SDR Section
   - Business Performance Section

## KPI integration

KPI calculations remain in the existing logic layer:

- `lib/kpis/business-performance.ts`
- `lib/kpis/formatting.ts`
- `lib/kpis/filters.ts`
- `lib/kpis/merged-preview.ts`

Read-only data/query utilities remain in:

- `lib/data/kpis/queries.ts`
- `lib/data/kpis/bigquery.ts`
- `lib/data/kpis/mapper.ts`

The Phase 2A route currently renders from sanitized fixture data by default. Live BigQuery usage remains behind the read-only query layer and its existing guards.

## Formatting helpers

Legacy KPI display formatting is centralized in:

- `lib/kpis/formatting.ts`

The helper matches old Python/Dash f-string display behavior that was confirmed in the old dashboard `callbacks.py` source:

- Currency: `£{value:,.0f}`
- Percent: `{value:.1f}%`
- Multiples: `{value:.2f}x`

## Shared filters

Shared preview filter logic is in:

- `lib/kpis/filters.ts`

Rules:

- `All` member scope stays aggregate.
- Specific `teamMember` scope stays person-level.
- Role scope is explicit: `all`, `closer`, or `sdr`.
- Date range scope is explicit.
- Team mapping is not confirmed in Phase 2A. Non-All team scope returns no KPI rows instead of silently mixing unknown team memberships.

## Sales tracker preservation

No existing sales tracker formula, scoring rule, call scoring logic, ranking logic, or default route was intentionally changed.

The default route remains:

- `/dashboard`

The merged preview route links to existing sales tracker routes instead of reimplementing or replacing them.

## Read-only BigQuery assumptions

Existing read-only guards remain in:

- `lib/data/kpis/queries.ts`

Allowed query shape:

- `SELECT`
- `WITH`
- parameterized filters

Blocked mutation/admin terms:

- `INSERT`
- `UPDATE`
- `DELETE`
- `MERGE`
- `CREATE`
- `DROP`
- `ALTER`
- `TRUNCATE`
- `GRANT`
- `REVOKE`
- `CALL`

Phase 2A does not add BigQuery writes.

## Remaining parity gaps / launch blockers

These remain launch blockers before final rollout:

1. SDR dashboard parity not fully captured.
2. Business Performance parity not fully captured.
3. Refund/ad-spend parity not fully captured.
4. Historical User A role-check parity not fully captured.
5. Assertion-level old-vs-new parity tests not fully complete.
6. Final user acceptance testing not complete.
7. Admin input workflow not migrated.
8. BigQuery write strategy not approved.
9. Security remediation plan not implemented for production launch.

## Security assumptions

- No credential files are copied into the app.
- No plaintext passwords are added.
- Old Cloud Run service is not modified.
- BigQuery remains read-only.
- Preview remains behind feature flags.
- Known old-app security issues are not treated as fixed for production launch.

## How to test preview locally

Disabled/default state:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Enable preview route in an approved local/preview environment:

```bash
FEATURE_MERGED_KPI_DASHBOARD=true npm run dev
```

Then open:

```text
/dashboard/merged-preview
```

The existing sales dashboard remains at:

```text
/dashboard
```
