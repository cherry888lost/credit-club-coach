# KPI Phase 1.5 Acceptance Review and Live Read-only Parity Plan

Status: review/testing plan only. Phase 2 is not approved.

## Boundaries

Approved:

- Phase 1 acceptance review.
- Opt-in live read-only parity test preparation.
- Minimum access request documentation.
- Manual old-dashboard output capture planning.

Not approved:

- Phase 2 implementation.
- public launch.
- adding KPI preview to normal navigation.
- replacing sales tracker or old KPI tracker.
- admin input migration.
- BigQuery writes, schema edits, table/view edits.
- Cloud Run changes.
- production permission changes.
- deployment as default dashboard.

## Section 1 — Phase 1 evidence package

- Branch: `phase-1-kpi-readonly-preview`
- Phase 1 implementation commit: `76a4083f3396984c36da28feb0a49a33a1acbefd`
- Phase 1 docs commit before implementation: `0711772c1d4c1ef6ba05124fb08a4a34da9a87c8`
- Branch starting point for Phase 1 code commit: `0711772c1d4c1ef6ba05124fb08a4a34da9a87c8`
- Merge-base with `main`: `7b8956a9ed1a77367d0b26302d42bf0dfa5fffcd`

### Files created by Phase 1 implementation commit

- `app/dashboard/kpis-preview/page.tsx`
- `lib/data/kpis/bigquery.ts`
- `lib/data/kpis/fixtures.ts`
- `lib/data/kpis/mapper.test.ts`
- `lib/data/kpis/mapper.ts`
- `lib/data/kpis/queries.test.ts`
- `lib/data/kpis/queries.ts`
- `lib/kpis/business-performance.test.ts`
- `lib/kpis/business-performance.ts`
- `lib/kpis/calculations.test.ts`
- `lib/kpis/feature-flag.test.ts`
- `lib/kpis/field-map.ts`
- `lib/kpis/thresholds.ts`
- `lib/kpis/types.ts`

### Files modified by Phase 1 implementation commit

None. The Phase 1 implementation commit only added new files.

### `git status --short` before Phase 1.5 harness commit

```text
 M dist/worker.js
?? Start-Scoring-Worker.command
?? docs/plans/2026-05-28-daily-cherry-sales-call-reports.md
?? docs/plans/2026-06-15-kpi-sales-tracker-merge-discovery-plan.md
?? docs/plans/2026-06-15-kpi-sales-tracker-merge-plan.md
?? run-scoring-continuous.js
?? tmp_bulk_requeue_unscored.cjs
?? tmp_bulk_score_unscored.sh
?? tmp_processing.cjs
?? tmp_queue_audit.cjs
```

### `git diff --stat HEAD^..HEAD` for Phase 1 implementation commit

```text
 app/dashboard/kpis-preview/page.tsx   |  90 +++++++++++++++++++++
 lib/data/kpis/bigquery.ts             |  30 +++++++
 lib/data/kpis/fixtures.ts             |  60 ++++++++++++++
 lib/data/kpis/mapper.test.ts          |  55 +++++++++++++
 lib/data/kpis/mapper.ts               |  55 +++++++++++++
 lib/data/kpis/queries.test.ts         |  43 ++++++++++
 lib/data/kpis/queries.ts              | 115 +++++++++++++++++++++++++++
 lib/kpis/business-performance.test.ts |  95 +++++++++++++++++++++++
 lib/kpis/business-performance.ts      | 142 ++++++++++++++++++++++++++++++++++
 lib/kpis/calculations.test.ts         | 101 ++++++++++++++++++++++++
 lib/kpis/feature-flag.test.ts         |  17 ++++
 lib/kpis/field-map.ts                 |  35 +++++++++
 lib/kpis/thresholds.ts                |  40 ++++++++++
 lib/kpis/types.ts                     |  78 +++++++++++++++++++
 14 files changed, 956 insertions(+)
```

### Confirmations

- Unrelated dirty/untracked files were not touched by the Phase 1 commit.
- Unrelated dirty/untracked files were not committed.
- `dist/worker.js` was not committed.
- temporary scripts were not committed.
- no credentials/passwords/tokens/API keys/service account JSON/private keys/secret values were committed in Phase 1 files.
- old KPI tracker source was not modified.
- Cloud Run was not modified.
- BigQuery tables/views were not modified.
- no BigQuery write helpers were added.
- no admin input migration was added.
- KPI preview route is hidden at `/dashboard/kpis-preview`.
- `FEATURE_KPI_READONLY_MODULE` is false by default because the code only enables when it exactly equals `true`.
- route is not in normal navigation.
- preview route warning message: `Read-only KPI preview. Not approved for launch. Old KPI tracker remains source of truth.`

## Section 2 — Command results

### `npm test -- --run`

- Result: PASS.
- Summary: 5 test files passed; 24 tests passed.
- Related to Phase 1: yes, these are Phase 1 unit/query/mapper/feature-flag tests.
- Pre-existing issues: none in this command.

### `npm run typecheck`

- Result: PASS.
- Summary: `tsc --noEmit` completed successfully.
- Related to Phase 1: Phase 1 files typecheck successfully with the project.
- Pre-existing issues: none in this command.

### `npm run lint`

- Result: FAIL.
- Summary: 331 problems: 217 errors, 114 warnings.
- Related to Phase 1: no failing file is under `lib/kpis`, `lib/data/kpis`, or `app/dashboard/kpis-preview`.
- Pre-existing: yes. Failures are in existing app/API/dashboard/scoring/dist/temp files.
- Exact failing file list captured in the Phase 1.5 report output.

### Targeted Phase 1 lint

Command:

```bash
npx eslint app/dashboard/kpis-preview/page.tsx lib/kpis lib/data/kpis
```

- Result: PASS.
- Summary: no output/errors.
- Related to Phase 1: yes.

### `npm run build`

- Result: PASS.
- Summary: compiled successfully; route `/dashboard/kpis-preview` appears in route list; TypeScript and static generation completed.
- Related to Phase 1: yes, route builds.
- Pre-existing warnings: Next workspace-root lockfile warning and middleware deprecation warning.

## Section 3 — Formula implementation review

| KPI/formula | Formula implemented | Source file/function | Inputs | Output | Null/zero handling | Div/0 handling | Confirmed | Unit test |
|---|---|---|---|---|---|---|---|---|
| First Call Cash | `row.nfRevenue` | `lib/kpis/business-performance.ts:calculateFirstCallCash` | `nfRevenue` | number, formatted by UI as GBP | mapper defaults missing numeric fields to 0 | n/a | yes | `lib/kpis/calculations.test.ts`, PASS |
| Recovery Cash | `row.sccRevenue + row.eccRevenue` | `calculateRecoveryCash` | `sccRevenue`, `eccRevenue` | number/GBP | defaults 0 | n/a | yes | `calculations.test.ts`, PASS |
| Potential Revenue | `max(0, nfPotentialRevenue + sccPotentialRevenue - eccRevenue)` | `calculatePotentialRevenue`; aggregate clamp in `sumKpiRows` | potential + ECC fields | number/GBP | defaults 0 | n/a | yes | `calculations.test.ts`, PASS |
| New Customers | first-call closes + second-call closes, excluding ECC/collection | `calculateNewCustomers` | NF and SCC close type fields | count | defaults 0 | n/a | yes | `calculations.test.ts`, PASS |
| Close Rate | first-call close customers / `nfLiveCalls` * 100 | `calculateCloseRate`; aggregate in `sumKpiRows` | NF close type fields, `nfLiveCalls` | percent number | defaults 0 | returns 0 if denominator 0 | yes | `calculations.test.ts`, PASS |
| Show Up Rate | `totalLiveCalls / totalScheduledCalls * 100` | `calculateShowUpRate`; aggregate in `sumKpiRows` | total live/scheduled calls | percent number | defaults 0 | returns 0 if denominator 0 | yes | `calculations.test.ts`, PASS |
| Refund Rate | `refundCount / newCustomers * 100` | `calculateRefundRate`; aggregate in `sumKpiRows` | refund count, new customers | percent number | defaults 0 | returns 0 if denominator 0 | yes | `calculations.test.ts`, PASS |
| Cash Collected | closer first-call cash only | `calculateCashCollected` | closer rows `nfRevenue` | number/GBP | empty rows sum 0 | n/a | yes | `business-performance.test.ts`, PASS |
| Recovered Cash | closer recovery cash + SDR total cash | `calculateRecoveredCash` | closer SCC/ECC revenue, SDR total revenue | number/GBP | empty rows sum 0 | n/a | yes | `business-performance.test.ts`, PASS |
| CAC | ad spend / closer first-call close customers | `calculateCac` | ad spend, closer NF close types | number/GBP | empty rows 0 | returns 0 if denominator 0 | yes | `business-performance.test.ts`, PASS |
| Blended CAC | ad spend / total new customers | `calculateBusinessPerformance` | ad spend, closer+SDR new customers | number/GBP | empty rows 0 | returns 0 if denominator 0 | yes | `business-performance.test.ts`, PASS |
| ROAS | closer first-call cash / ad spend | `calculateRoas` | closer `nfRevenue`, ad spend | multiplier number | empty rows 0 | returns 0 if ad spend 0 | yes | `business-performance.test.ts`, PASS |
| ARPU | total cash / new customers | `sumKpiRows`; BP ARPU in `calculateBusinessPerformance` | total cash, new customers | number/GBP | empty rows 0 | returns 0 if denominator 0 | yes | `calculations.test.ts`, `business-performance.test.ts`, PASS |
| Gauge thresholds | close/show/refund threshold constants | `lib/kpis/thresholds.ts` | KPI percent value | `green`/`amber`/`red` | n/a | n/a | yes | `calculations.test.ts`, PASS |

Unimplemented in Phase 1 because still unconfirmed or out of scope:

- `revenue_by_source` chart SQL/object type.
- admin input workflow parity.
- live production Business Performance sample outputs.
- external Slack ingestion status.
- write/edit/delete/admin workflows.

## Section 4 — Live BigQuery parity test preparation

Live harness file:

- `lib/data/kpis/live-parity.test.ts`

Rules:

- Unit tests do not require live BigQuery access.
- Live parity tests are skipped unless `KPI_LIVE_PARITY=true`.
- Live test file uses read-only query builders only.
- Live test file uses named query parameters only.
- Live test file has no write/admin SQL.
- Live test file uses `gcloud auth print-access-token` at runtime; no credentials are committed.
- Captured old dashboard outputs must be manual/sanitized and not committed if sensitive.

Separation:

1. Unit tests: `lib/kpis/*.test.ts`, `lib/data/kpis/mapper.test.ts`, `lib/data/kpis/queries.test.ts`.
2. Live BigQuery integration: `lib/data/kpis/live-parity.test.ts`, opt-in only.
3. Manual old-dashboard comparison records: external/manual capture sheet or sanitized local notes; do not commit sensitive outputs.

Example live command, only after access/scope approval:

```bash
KPI_LIVE_PARITY=true KPI_PARITY_START_DATE=2026-06-01 KPI_PARITY_END_DATE=2026-06-15 npm test -- --run lib/data/kpis/live-parity.test.ts
```

## Section 5 — Minimum access request for live parity testing

| Access item | Resource | Role/permission | Read/write | Why needed | Secrets? | Sensitive data? | Safer alternative | Required | Duration | Inspect/query | Will not touch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BigQuery metadata | `credit-club-tracking.kpi_tracking` | `roles/bigquery.metadataViewer` scoped to dataset/project | read-only | verify deployed schema/view definitions | no secret values | schema names only | user exports schema/view SQL | now | table/view schemas, view SQL | no data, no writes |
| BigQuery query job creation | project `credit-club-tracking` | `bigquery.jobs.create` | read-only query execution | run parameterized SELECTs | no | depends on selected query | user provides sanitized exports | now/later | execute approved SELECT queries | no DDL/DML |
| BigQuery data read for approved objects | `daily_kpi_summary`, `ad_spend`; optionally `revenue_by_source`; avoid `users.password` | dataset/object-scoped data viewer or custom read role | read-only | calculate new KPI values from same source | no credentials | yes, business KPI data | sampled/sanitized CSV export | later before execution | approved date ranges/team filters only | no users.password, no full export, no writes |
| Old dashboard read access | old KPI dashboard UI | app-level read user only, ideally viewer/admin only if BP needed | read-only | capture old UI values for comparison | may require app login, do not share password in chat/docs | visible KPI data | screenshare/manual capture by user | later before execution | cards/charts for approved filters | no automation/risky scraping, no changes |
| Cloud Run config metadata | Cloud Run `kpi-dashboard` `us-central1` | `roles/run.viewer` only | read-only | only if source/runtime config needs re-confirming | secret refs names maybe, not values | no business rows | user supplies redacted YAML | later/optional | service URL/revision/env var names | no deploy, no traffic/IAM changes |

Not requested: Owner, Editor, Admin, Secret Manager secret-value access, BigQuery write access, Cloud Run edit/deploy access, IAM change access.

## Section 6 — Live parity test matrix

| Test ID | Area | KPI | Old source | New source | Date range | User/team | Role | Filters | Old capture | New calc | Tolerance | Pass/fail | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CLOSER-001 | Closer | First Call Cash | UI card | `calculateFirstCallCash`/`sumKpiRows` | 2026-06-01..2026-06-15 | All | closer | date+role | manual UI value | live BQ rows | exact displayed GBP | match | confirmed formula |
| CLOSER-002 | Closer | Recovery Cash | UI card | `calculateRecoveryCash` | same | All | closer | date+role | manual UI value | live BQ rows | exact GBP | match | confirmed |
| CLOSER-003 | Closer | Potential Revenue | UI card | `sumKpiRows.potentialRevenue` | same | All | closer | date+role | manual UI value | live BQ rows | exact GBP | match | includes clamp |
| CLOSER-004 | Closer | New Customers | UI card | `calculateNewCustomers` | same | All | closer | date+role | manual UI value | live BQ rows | exact count | match | excludes ECC |
| CLOSER-005 | Closer | Close Rate | UI card/gauge | `sumKpiRows.closeRate` | same | All | closer | date+role | manual UI value | live BQ rows | <=0.01 pp underlying; displayed 0.1% exact | match | first-call only |
| CLOSER-006 | Closer | Show Up Rate | UI card/gauge | `sumKpiRows.showUpRate` | same | All | closer | date+role | manual UI value | live BQ rows | <=0.01 pp; display exact | match | total live/scheduled |
| CLOSER-007 | Closer | Refund Rate | gauge | `sumKpiRows.refundRate` | refund-containing range | All | closer | date+role | manual UI value | live BQ rows | <=0.01 pp; band exact | match | edge refund test |
| CLOSER-008 | Closer | Team/member filter | UI cards | same formulas | same | selected closer | closer | date+role+member | manual UI value | live BQ rows with teamMembers | exact/percent tolerances | match | member filter |
| SDR-001 | SDR | First Call Cash | UI card | `sumKpiRows` | same | All | sdr | date+role | manual UI value | live BQ rows | exact GBP | match | role filter |
| SDR-002 | SDR | Recovery Cash | UI card | `sumKpiRows` | same | All | sdr | date+role | manual UI value | live BQ rows | exact GBP | match | role filter |
| SDR-003 | SDR | Close Rate | UI card/gauge | `sumKpiRows.closeRate` | same | All | sdr | date+role | manual UI value | live BQ rows | <=0.01 pp; display exact | match | first-call only |
| SDR-004 | SDR | Member filter | UI cards | same formulas | same | selected SDR | sdr | date+role+member | manual UI value | live BQ rows | exact/percent tolerances | match | member filter |
| BP-001 | Business Performance | Cash Collected | UI card | `calculateCashCollected` | same | All | closer input | date | manual UI value | closer live rows | exact GBP | match | closer NF only |
| BP-002 | Business Performance | Recovered Cash | UI card | `calculateRecoveredCash` | same | All | closer+sdr | date | manual UI value | live rows | exact GBP | match | closer recovery + SDR total |
| BP-003 | Business Performance | CAC | UI card | `calculateCac` | ad-spend range | All | closer | date | manual UI value | BQ rows + ad spend | exact displayed GBP | match | zero denominator test separate |
| BP-004 | Business Performance | Blended CAC | UI card | `calculateBusinessPerformance` | ad-spend range | All | closer+sdr | date | manual UI value | BQ rows + ad spend | exact displayed GBP | match | total customers |
| BP-005 | Business Performance | ROAS | UI card | `calculateRoas` | ad-spend range | All | closer | date | manual UI value | BQ rows + ad spend | <=0.005 underlying; displayed 2dp exact | match | cash collected/ad spend |
| AD-001 | Ad spend | Total Ad Spend | UI BP/ad table | `buildAdSpendSummaryQuery` | ad-spend range | n/a | n/a | date | manual UI value | live BQ ad_spend | exact GBP | match | read-only |
| AD-002 | Ad spend | CPL | UI BP/ad table | total ad spend/total leads | ad-spend range | n/a | n/a | date | manual UI value | live BQ ad_spend | exact displayed GBP | match | compare summary not row CPL |
| EDGE-001 | Date filtering | First Call Cash | UI card | live query | single day | All | closer | exact date | manual UI value | parameterized date query | exact | match | date inclusivity |
| EDGE-002 | Empty range | All core KPIs | UI cards | live query | approved no-data date | All | closer/sdr | date | manual UI value | live rows | exact zero | match | no rows |
| EDGE-003 | Zero scheduled | Show Up Rate | UI/gauge | formula | approved row/range | member if needed | closer/sdr | date+member | manual UI | live rows | exact zero | match | denominator zero |
| EDGE-004 | Zero live | Close Rate | UI/gauge | formula | approved row/range | member if needed | closer/sdr | date+member | manual UI | live rows | exact zero | match | denominator zero |
| EDGE-005 | Zero customers | ARPU/Refund Rate | UI/gauge | formula | approved row/range | member if needed | closer/sdr | date+member | manual UI | live rows | exact zero | match | denominator zero |
| EDGE-006 | Zero ad spend | ROAS/CAC | UI BP | formula | approved row/range | All | BP | date | manual UI | live rows | exact zero | match | denominator/numerator zero |
| EDGE-007 | Negative potential | Potential Revenue | UI card | aggregate clamp | approved ECC-heavy range | All/member | closer/sdr | date+role | manual UI | live rows | exact GBP | match | clamp timing |
| HIST-001 | Name/role history | Core totals | UI cards | live rows | historical changed-name range | changed member | role | date+member | manual UI | live rows | exact | match | detects historical mutation effects |

## Section 7 — Old dashboard output capture plan

Controlled capture method:

1. Use the old KPI dashboard UI manually with read-only behavior only.
2. For every capture, record date range, active tab, role, member/team filter, and exact displayed value.
3. Prefer screenshot/manual record by Arshid or a read-only user. Do not automate scraping unless approved.
4. Mark each captured value as UI, BigQuery view, or callback-derived if known.
5. Store sensitive screenshots/exports outside the repo. If a fixture is committed, sanitize names/values or use approved anonymized samples only.

Manual record template:

```text
Capture ID:
Dashboard area:
KPI:
Date range:
Role/tab:
Person/team/member filter:
Other filters:
Old dashboard value:
Capture method: UI screenshot / manual note / callback output / BigQuery view
Confirmed status: confirmed / uncertain
Notes:
```

## Section 8 — Live parity execution report template

Do not fill this until access and matrix are approved.

```text
KPI name:
Old dashboard value:
New calculation value:
Difference:
Percentage difference:
Date range:
User/team/role:
Filters:
Pass/fail:
Suspected reason for mismatch:
Fix applied:
Needs Arshid approval:
```

## Section 9 — Phase 1.5 completion criteria

Phase 1.5 is complete only when:

- Phase 1 files are reviewed.
- secret scan is confirmed clean.
- unrelated dirty/untracked files are confirmed untouched.
- new KPI code passes tests/typecheck/build or failures are proven pre-existing.
- targeted checks pass for Phase 1 files.
- live parity test plan is documented.
- minimum access request is documented.
- live parity tests are run or clearly blocked pending access.
- mismatches are documented.
- old KPI tracker remains untouched.
- existing sales tracker remains intact.
- no writes/admin workflows/launch actions were added.

Current status: blocked pending access/scope approval for live parity execution.

Recommendation: Phase 1 accepted for hidden read-only preview if Arshid accepts the lint caveat as pre-existing. Stay in parity testing; do not move to Phase 2 yet.
