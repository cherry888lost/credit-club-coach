# Manager UAT Handover Package — Merged Dashboard Internal Beta

Date: 2026-06-16
Status: Manager UAT only. Not approved for production launch.

## Non-negotiable boundaries

This UAT package does not approve any of the following:

- replacing the old KPI tracker,
- replacing the current sales tracker,
- making `/dashboard/merged-preview` the default route,
- adding the merged dashboard to normal user navigation,
- migrating admin inputs,
- writing to BigQuery,
- editing BigQuery tables/views,
- changing Cloud Run,
- changing IAM,
- removing or cleaning up the old KPI tracker,
- production cutover.

Accessibility permission is not needed for this UAT support work and can remain revoked. Do not use Accessibility again unless explicitly approved for a specific task.

## Source-of-truth rule

The old KPI tracker remains the source of truth during manager UAT.

The merged dashboard is still:

- internal beta,
- read-only,
- not approved as final production replacement,
- not approved for launch,
- not approved for admin/write workflows.

## UAT setup instructions

### 1. Enable the beta safely

Set the feature flag only in a local or explicitly approved internal test environment:

```bash
FEATURE_MERGED_KPI_DASHBOARD=true
```

Local example:

```bash
FEATURE_MERGED_KPI_DASHBOARD=true npm run dev
```

Do not enable this in production or for normal users without separate approval.

### 2. Open the beta route

Open:

```text
/dashboard/merged-preview
```

### 3. Confirm the standard sales dashboard still works

Open:

```text
/dashboard
```

Expected result: the current Credit Club sales tracker loads normally.

### 4. Confirm the beta route is not default

- `/dashboard` should remain the default sales tracker.
- `/dashboard/merged-preview` should only be accessible by direct URL and feature flag.
- Normal user navigation should not be changed for everyone.

### 5. Confirm the required beta warning appears

The beta dashboard must visibly say:

```text
Internal merged dashboard beta. Read-only. Not approved as final production replacement. Old KPI tracker remains source of truth.
```

If this warning is missing or softened, pause UAT and fix the warning before continuing.

### 6. Disable the beta immediately

Set the flag to false or unset it:

```bash
FEATURE_MERGED_KPI_DASHBOARD=false
```

or remove the variable entirely.

Then confirm `/dashboard/merged-preview` shows the disabled/hidden preview message and `/dashboard` still works.

## UAT review process

Run UAT in three passes.

## Pass 1 — Visual/usability review

Managers should review:

- overall layout,
- readability,
- navigation,
- Sales Tracker section,
- KPI Tracker section,
- combined overview,
- date filters,
- team filters,
- person filters,
- role filters,
- warning labels,
- read-only labels,
- source-of-truth warning,
- mobile/tablet usability if relevant,
- speed/performance.

Record anything confusing, slow, missing, or misleading in the UAT feedback tracker.

## Pass 2 — Value spot-checking

Managers should compare a small number of values against the old KPI tracker.

Minimum suggested spot checks:

- one closer view,
- one SDR view,
- one Business Performance view,
- one weekly date range,
- one month-to-date date range,
- one refund/ad-spend example if visible,
- one edge case where value is zero or blank if visible.

Rules:

1. Old KPI tracker remains source of truth.
2. If a value differs, record it as a mismatch.
3. Do not assume the new merged beta dashboard is correct.
4. Do not change formulas during UAT without confirmed old source logic or explicit approval.

## Pass 3 — Launch-readiness review

Managers should answer:

- What is useful?
- What is confusing?
- What is missing?
- What should be changed before launch?
- Do they trust the layout?
- Do they trust the numbers?
- Do any labels need renaming?
- Do any filters behave unexpectedly?
- Is the dashboard ready for wider testing?

A dashboard can be useful for beta review and still not be ready for production launch.

## UAT feedback tracker format

Use this exact column format in a spreadsheet, issue tracker, or markdown log:

```text
Issue ID:
Reporter:
Date reported:
Type: value mismatch / UI issue / missing feature / performance / access / security / other
Dashboard section:
KPI or metric:
Date range:
Team selected:
Person selected:
Role selected:
Old KPI tracker value:
New beta dashboard value:
Difference:
Screenshot location if used:
Severity: low / medium / high / launch blocker
Confirmed or uncertain:
Owner:
Status:
Decision needed:
Resolution notes:
```

Do not store screenshots in the repo unless sanitized and explicitly approved.

## Mismatch reporting template

```text
Reporter name:
Date reported:
Dashboard section:
KPI or metric:
Date range selected:
Team selected:
Person selected:
Role selected:
Old KPI tracker value:
New merged beta value:
Difference:
Screenshot location if used:
Confirmed or uncertain:
Notes:
Priority: low / medium / high / launch blocker
```

## Value mismatch rule

If managers report mismatches:

1. Do not change formulas immediately.
2. First verify the old dashboard filter scope.
3. Verify the new dashboard filter scope.
4. Confirm whether both are comparing:
   - same date range,
   - same person/team,
   - same role,
   - same dashboard section,
   - same filters.
5. If it is a formatting issue, trace it to formatting logic.
6. If it is a formula issue, trace it to old KPI tracker source logic.
7. Do not change formulas unless confirmed by old source logic or approved by Arshid.

## Known UAT warnings to keep visible

The beta dashboard and UAT materials must keep these warnings visible:

- SDR parity not fully captured.
- Business Performance parity not fully captured.
- Refund/ad-spend parity not fully captured.
- Historical role parity not fully captured.
- Assertion-level old-vs-new parity tests not fully complete.
- Admin input workflow not migrated.
- BigQuery write strategy not approved.
- Production security remediation not complete.
- Old KPI tracker remains source of truth.

## Launch-readiness checklist

Production launch cannot proceed until all relevant items are complete/approved:

- [ ] SDR parity complete.
- [ ] Business Performance parity complete.
- [ ] Refund/ad-spend parity complete.
- [ ] Historical role parity complete.
- [ ] Assertion-level old-vs-new parity tests complete.
- [ ] Final manager/user acceptance testing complete.
- [ ] Admin input workflow approved.
- [ ] BigQuery write strategy approved if writes are needed.
- [ ] Secret Manager/IAM strategy approved.
- [ ] Production security remediation complete.
- [ ] Rollback plan approved.
- [ ] Old KPI tracker replacement timing approved.
- [ ] Old KPI tracker remains available during transition.
- [ ] User training complete.
- [ ] Support process ready.

## Rollback instructions

### Disable the beta

1. Set `FEATURE_MERGED_KPI_DASHBOARD=false` or unset it.
2. Confirm `/dashboard/merged-preview` shows the disabled/hidden preview message.
3. Continue sending users/managers to `/dashboard` for the current sales tracker.
4. Continue using the old KPI tracker as the KPI source of truth.

### If a manager reports incorrect KPI values

1. Treat the old KPI tracker value as source of truth.
2. Log a mismatch with exact filters and date range.
3. Do not change formulas until old source logic confirms the issue.
4. Mark the beta value as pending/untrusted for that scope if needed.

### If BigQuery read access fails

1. Do not request broader permissions as the first response.
2. Confirm read-only query environment/configuration.
3. Keep old KPI tracker as source of truth.
4. Log as access/performance issue if it affects UAT.

### If dashboard performance is poor

1. Log route, filter scope, browser/device, and rough load time.
2. Do not change formulas for performance.
3. Propose read-only caching/query optimization separately if needed.

### If sales tracker behavior appears changed

1. Pause review.
2. Confirm `/dashboard` still loads the current sales tracker.
3. Compare against pre-UAT behavior.
4. Do not continue until the sales tracker preservation issue is understood.

## Recommended UAT outcome categories

After manager UAT, classify the result as one of:

1. Begin next UAT round: feedback is minor, no launch blockers newly discovered.
2. Fix UAT-prep issues: guide/status labels/template need correction.
3. Complete remaining parity: managers found value gaps or unverified sections matter for launch.
4. Prepare production launch proposal: only after parity, security, support, rollback, and approval requirements are met.
5. Do not proceed: major mismatch, trust issue, access issue, or security concern blocks further rollout.

## Production launch approval rule

Do not proceed to production launch without explicit future approval.
