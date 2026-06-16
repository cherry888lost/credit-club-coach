# Phase 2C — Manager Review / UAT / Launch Readiness

Date: 2026-06-16
Status: Approved for internal manager UAT preparation only. Not approved for production launch.

## Scope

Phase 2C prepares the feature-flagged merged dashboard beta for manager review, feedback collection, mismatch reporting, and launch-readiness assessment.

This is not approval to:

- launch publicly,
- replace the old KPI tracker,
- replace the sales tracker,
- make `/dashboard/merged-preview` the default route,
- add the route to normal user navigation for everyone,
- migrate admin inputs,
- write to BigQuery,
- edit BigQuery tables/views,
- change Cloud Run,
- change IAM,
- remove or clean up the old KPI tracker,
- mark the dashboard as production-ready.

## Route and feature flag

Route:

```text
/dashboard/merged-preview
```

Feature flag:

```text
FEATURE_MERGED_KPI_DASHBOARD=true
```

Default must remain false/unset. When unset, the route displays the disabled/hidden preview message.

Local review command:

```bash
FEATURE_MERGED_KPI_DASHBOARD=true npm run dev
```

Approved test environment review may use the same flag only if explicitly configured for internal beta review.

## Manager UAT review guide

### What the dashboard is for

The merged beta is a read-only internal review surface combining:

- Sales Tracker summary/navigation,
- KPI Tracker preview values,
- combined performance context,
- visible parity and launch-readiness warnings.

The old KPI tracker remains the source of truth.

### What sections to review

Managers should review:

1. Top read-only/internal-beta warning.
2. Shared preview filters.
3. Beta status and parity risk panel.
4. Combined Performance Summary.
5. Sales Tracker section.
6. KPI Tracker — Closer Section.
7. KPI Tracker — SDR Section.
8. KPI Tracker — Business Performance.
9. Manager review notes.
10. Launch-readiness blockers.

### What is read-only

All KPI values and review content are read-only. The beta does not save notes, mutate dashboard data, write to BigQuery, or migrate admin inputs.

### What is not production-ready

The dashboard is not production-ready because these items remain incomplete:

- SDR dashboard parity,
- Business Performance parity,
- refund/ad-spend parity,
- historical role parity,
- assertion-level old-vs-new parity tests,
- admin input workflow approval,
- write strategy approval if writes are ever needed,
- production security remediation,
- final cutover/rollback approval.

### Confirmed values/status

- Closer parity: mostly verified.
- Formatting parity: verified for tested values.
- Existing sales tracker route/logic: preserved.

### Pending parity/status

- SDR parity: pending.
- Business Performance parity: pending.
- Refund/ad-spend parity: pending.
- Historical role parity: pending.
- Admin/write workflows: not migrated.
- Production launch: not approved.

### How to compare against the old KPI tracker

For any value under review:

1. Open the old KPI tracker separately.
2. Select the exact same date range.
3. Select the exact same role.
4. Select the exact same team/member scope.
5. Compare the old displayed value to the merged beta displayed value.
6. If values differ, log a mismatch using the template below.
7. If the old dashboard scope is unclear, mark the report as uncertain instead of calling it a pass/fail.

Do not rely on the merged beta as source of truth until parity is fully approved.

## Manager review checklist

Use this checklist during manager UAT:

- [ ] Sales Tracker section is visible and links to existing sales pages.
- [ ] KPI Tracker section is visible and labelled read-only.
- [ ] Combined overview is understandable.
- [ ] Date filters are clear.
- [ ] Team filters are clear.
- [ ] Person/team member filters are clear.
- [ ] Role filters are clear.
- [ ] Dashboard section filter is clear.
- [ ] KPI cards are readable.
- [ ] Sales scorecards/navigation are clear and unchanged.
- [ ] Business Performance section is readable and clearly pending parity.
- [ ] SDR section is readable and clearly pending parity.
- [ ] Closer section is readable and mostly verified.
- [ ] Warning/status labels are visible.
- [ ] Read-only warning is visible.
- [ ] Old KPI tracker source-of-truth warning is visible.
- [ ] Mobile/tablet layout is usable if managers will review on those devices.
- [ ] Labels are not confusing.
- [ ] Missing information is noted.
- [ ] Incorrect values are logged as mismatches.
- [ ] Page speed/performance is acceptable for review.

## Mismatch reporting template

Do not store screenshots in the repo unless sanitized and explicitly approved.

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
Priority: low / medium / high / blocker
```

## Usability issue reporting template

```text
Reporter name:
Date reported:
Dashboard section:
Device/browser:
Issue description:
Expected behavior:
Actual behavior:
Impact:
Priority: low / medium / high / blocker
Notes:
```

## UAT issue tracker format

Use this format for a simple spreadsheet or markdown issue log:

```text
Issue ID:
Type: value mismatch / UI issue / missing feature / performance / security / access / other
Description:
Severity: low / medium / high / blocker
Section affected:
Owner:
Status: new / triage / investigating / fixed / accepted risk / rejected / closed
Decision needed:
Resolution notes:
```

## Launch-readiness checklist

Production launch cannot proceed until all relevant items are complete/approved:

- [ ] SDR parity complete.
- [ ] Business Performance parity complete.
- [ ] Refund/ad-spend parity complete.
- [ ] Historical role parity complete.
- [ ] Assertion-level old-vs-new parity tests complete.
- [ ] Final user acceptance testing complete.
- [ ] Admin input workflow approved.
- [ ] BigQuery write strategy approved if writes are needed.
- [ ] Secret Manager/IAM strategy approved.
- [ ] Production security remediation complete.
- [ ] Rollback plan approved.
- [ ] Old KPI tracker replacement timing approved.
- [ ] Old KPI tracker remains available during transition.
- [ ] User training complete.
- [ ] Support process ready.

## Rollback / fallback plan

### Disable the merged beta feature flag

1. Unset `FEATURE_MERGED_KPI_DASHBOARD`.
2. Confirm `/dashboard/merged-preview` shows the disabled/hidden preview message.
3. Keep `/dashboard` as the active/default sales tracker.
4. Continue using the old KPI tracker as source of truth.

### Return users to current sales tracker

- Send users to `/dashboard`.
- Do not add `/dashboard/merged-preview` to normal navigation unless separately approved.
- If a test environment link was shared, tell reviewers the beta is paused and current sales tracker remains active.

### If KPI values are disputed

1. Treat old KPI tracker as source of truth.
2. Log a mismatch report.
3. Preserve exact filters/date range/role/member details.
4. Do not change formulas until source logic is confirmed.
5. Mark the beta value as pending/incorrect if confirmed.

### If BigQuery access fails

1. Do not add retries that mutate data.
2. Do not request broader IAM as first response.
3. Confirm read-only query credentials/environment.
4. Show or document that KPI beta values are unavailable/stale if appropriate.
5. Keep old KPI tracker as fallback source of truth.

### If dashboard performance is poor

1. Record route, filters, date range, and approximate load time.
2. Identify whether issue is sales route, KPI beta route, or old tracker.
3. Prefer read-only caching/query optimization proposals before production launch.
4. Do not change formulas to improve performance.

### If users report incorrect scores

1. Confirm whether issue is sales scorecard or KPI metric.
2. For sales scoring: preserve existing sales tracker logic unless explicit approval is given.
3. For KPI metric: compare against old KPI tracker with exact same filters.
4. Log issue as mismatch or UI issue.
5. Do not treat beta as source of truth.

## Accessibility permission

Accessibility permission is no longer required for the current Phase 2C documentation/UAT-prep work. It can be revoked now unless a future explicitly approved manual capture session needs it again.
