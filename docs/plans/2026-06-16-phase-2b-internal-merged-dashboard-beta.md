# Phase 2B — Internal Merged Dashboard Beta

Date: 2026-06-16
Status: Internal beta / rollout-prep only. Not approved for production launch.

## What Phase 2B added

Phase 2B keeps `/dashboard/merged-preview` feature-flagged and improves it into a manager-reviewable internal beta dashboard. It adds:

- Internal beta banner and read-only/source-of-truth labels.
- Visible parity/status model for confirmed and unconfirmed KPI areas.
- Shared filter quick links for aggregate, closer, SDR, and unsupported-team warning review.
- Manager review checklist.
- Launch-readiness checklist.
- Unsupported filter warning model.
- Tests for beta status, unsupported filters, and launch checklist behavior.

## Feature flag

Enable locally only when reviewing the beta:

```bash
FEATURE_MERGED_KPI_DASHBOARD=true npm run dev
```

Default remains false/unset. When the flag is not set, `/dashboard/merged-preview` shows a disabled hidden-route message.

Compatibility note: the route also honors the existing KPI preview flag through `isMergedKpiDashboardPreviewEnabled()`, but `FEATURE_MERGED_KPI_DASHBOARD` is the Phase 2B flag.

## Routes

- `/dashboard` — existing sales tracker default. Must remain unchanged.
- `/dashboard/kpis-preview` — existing read-only KPI preview route.
- `/dashboard/merged-preview` — Phase 2B internal beta, feature-flagged.

## Read-only boundaries

The beta is read-only:

- No admin input workflow.
- No write API.
- No BigQuery mutation helper.
- No BigQuery table/view/schema changes.
- No Cloud Run or old KPI tracker changes.

KPI data access remains limited to the approved read-only layer under `lib/data/kpis/`.

## Known parity gaps

Accepted for internal beta only; still launch blockers:

1. SDR dashboard parity not fully captured.
2. Business Performance parity not fully captured.
3. Refund/ad-spend parity not fully captured.
4. Historical User A role-check parity not fully captured.
5. Assertion-level old-vs-new parity tests not fully complete.

## Known security gaps

Still not production-remediated:

1. Old app plaintext-password risk.
2. Old source bundle credential-related file risk.
3. Old Cloud Run public-network + Basic Auth model.
4. Old direct string interpolation query patterns.
5. Legacy Slack fields / `slack_message_ts` identifier behavior.
6. Admin input migration/write strategy not approved.
7. Production Secret Manager/IAM strategy not finalized.

## Manager beta review instructions

1. Start locally with `FEATURE_MERGED_KPI_DASHBOARD=true npm run dev`.
2. Open `/dashboard/merged-preview`.
3. Confirm the top banner says the dashboard is internal beta/read-only/not final production replacement.
4. Review the Sales Tracker section and confirm it links back to existing sales pages.
5. Review KPI sections as preview-only values.
6. Use the quick filters to review All Members, closer scope, SDR scope, and unsupported Team A warning.
7. Report mismatches with:
   - dashboard section,
   - filter scope,
   - old dashboard displayed value,
   - beta displayed value,
   - date range,
   - role/member/team scope.
8. Do not treat the beta as source of truth; old KPI tracker remains source of truth.

## How to report mismatches

Use this format:

```text
Section:
KPI:
Old dashboard value:
Beta value:
Date range:
Role:
Team:
Member:
Screenshot/capture available? yes/no
Notes:
```

Do not commit screenshots/raw captures to the repo.

## Rollback plan

Because Phase 2B is feature-flagged, rollback is simple:

1. Unset `FEATURE_MERGED_KPI_DASHBOARD`.
2. Confirm `/dashboard/merged-preview` shows the disabled hidden-route message.
3. Keep `/dashboard` as the active/default sales tracker.
4. If code rollback is required, revert the Phase 2B commit only; do not touch Phase 1.5 or Phase 2A commits unless separately approved.

## Launch-readiness checklist

Before production launch or replacement can be proposed:

- [ ] Complete SDR dashboard parity.
- [ ] Complete Business Performance parity.
- [ ] Complete refund/ad-spend parity, including zero-ad-spend behavior.
- [ ] Complete Historical User A role-check parity.
- [ ] Complete assertion-level old-vs-new parity tests.
- [ ] Complete final user acceptance testing.
- [ ] Approve BigQuery write/admin input strategy before any write workflow exists.
- [ ] Implement production security remediation plan.
- [ ] Approve rollback/cutover plan explicitly.
- [ ] Confirm old KPI tracker replacement timing explicitly.

## Test commands

```bash
npm test -- --run
npm run typecheck
npx eslint app/dashboard/merged-preview/page.tsx app/dashboard/kpis-preview/page.tsx lib/kpis/beta-status.ts lib/kpis/beta-status.test.ts lib/kpis/formatting.ts lib/kpis/formatting.test.ts lib/kpis/filters.ts lib/kpis/filters.test.ts lib/kpis/merged-preview.ts lib/kpis/merged-preview.test.ts lib/kpis/field-map.ts lib/kpis/feature-flag.test.ts
npm run build
```

Full repo lint currently has pre-existing unrelated failures; use targeted lint for Phase 2B files and report full lint separately.
