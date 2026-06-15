# Security Remediation Plan — New Merged Dashboard

Status: **Plan only. Do not change old production tracker without explicit approval.**

## 1. Plaintext passwords in BigQuery users table

- Current risk: old app reads `username,password` from `kpi_tracking.users` and passes them to Basic Auth.
- Severity: High.
- Affects: old app now; new app only if copied.
- Recommended fix: do not migrate plaintext passwords. Use existing sales tracker auth provider (e.g. Clerk) and store role/team mapping separately. If local credentials ever needed, use salted password hashes, never plaintext.
- Timing: before or during migration for new app; old app untouched unless approved.
- Changes KPI logic: no.
- Needs approval: yes for auth/role model decisions.

## 2. Credential-related files in source bundle

- Current risk: Dockerfile copies `credentials.json`; source bundle contains credential-related material.
- Severity: Critical if credentials are valid/exposed.
- Affects: old app/source bundle; new app if copied.
- Recommended fix: do not copy credential files into new repo/image. Use service account identity/workload identity/secret manager. Add `.gitignore` and secret scanning. Rotate old exposed credentials only if user approves and confirms impact.
- Timing: before migration for new app; old credential rotation is separate approval.
- Changes KPI logic: no.
- Needs approval: yes for any old credential rotation; no for excluding credentials from new app.

## 3. Cloud Run public at network layer with app Basic Auth

- Current risk: Cloud Run allows unauthenticated requests; Basic Auth is the only app gate.
- Severity: Medium-High.
- Affects: old app.
- Recommended fix for new app: use proper app auth/session auth and deploy behind authenticated routes. If on GCP, consider Cloud Run IAM/IAP or platform-level auth if compatible. Do not rely only on Basic Auth.
- Timing: during new app build.
- Changes KPI logic: no.
- Needs approval: yes for deployment/auth architecture.

## 4. Direct SQL string interpolation

- Current risk: many BigQuery queries build SQL with f-strings using dates/team members/user input.
- Severity: High for write/admin paths, Medium for read-only filters.
- Affects: old app; new app if copied.
- Recommended fix: use parameterized BigQuery queries (`QueryJobConfig` with scalar/array parameters) in new app. Validate dates and allowed roles. Never concatenate team member/user input into SQL.
- Timing: before any new app BigQuery access.
- Changes KPI logic: no, if parameters preserve same WHERE semantics.
- Needs approval: no; safe security improvement.

## 5. Legacy Slack fields and `slack_message_ts` as record ID

- Current risk: old ID name/semantics are confusing; manual records use Slack-named ID. External Slack writer may still exist.
- Severity: Medium.
- Affects: old app and historical data model.
- Recommended fix: preserve old ID as immutable legacy external ID in new app. Add a new internal ID only for new storage if needed. Do not rewrite old IDs. Confirm whether Slack ingestion still exists before removing any field.
- Timing: during migration design; cleanup only after launch and approval.
- Changes KPI logic: no if preserved.
- Needs approval: yes for any schema/ID changes.

## 6. Hard deletes for KPI/ad-spend records

- Current risk: KPI `delete_daily_kpi` and ad spend delete perform hard deletes; audit trail can be lost.
- Severity: Medium.
- Affects: old app; new app if copied.
- Recommended fix: new app should prefer soft delete with `deleted_at`, `deleted_by`, reason, and audit log. Old app untouched.
- Timing: before enabling new write workflows.
- Changes KPI logic: could affect filters if soft-deleted rows are not excluded correctly; must add explicit `WHERE deleted_at IS NULL` in new design if used.
- Needs approval: yes before changing write/delete behavior.

## 7. Role/name change mutates historical KPI rows

- Current risk: `database/users.py` updates historical `kpi_records` when a user team_member name or role changes. This can alter historical reporting groupings.
- Severity: Medium.
- Affects: old app and migration design.
- Recommended fix: in new app, use stable user IDs plus display-name history/effective-date mapping. Avoid mutating historical KPI facts unless explicitly approved.
- Timing: during role/team migration.
- Changes KPI logic: could change historical grouping if implemented differently; must parity-test.
- Needs approval: yes.

## 8. Fallback credentials/default admin behavior

- Current risk: if BigQuery auth load fails, app can fall back to default credentials/profiles in source.
- Severity: High.
- Affects: old app; new app if copied.
- Recommended fix: new app should fail closed if auth/user mapping cannot load. No default admin credentials in code.
- Timing: during new app build.
- Changes KPI logic: no.
- Needs approval: no for new app fail-closed behavior.

## 9. Secrets/credentials in documentation and logs

- Current risk: credentials could accidentally be recorded in audit docs, terminal logs, source, or commits.
- Severity: High.
- Affects: both if mishandled.
- Recommended fix: redact credentials in docs, avoid reading `.env`/secret values unless approved, run secret scanning before commit/deploy.
- Timing: immediately and ongoing.
- Changes KPI logic: no.
- Needs approval: no.

## Remediation priority

Before new read-only build:

1. No credential files/plaintext passwords copied.
2. Parameterized BigQuery reads.
3. Auth/role mapping design.
4. Secret scanning in new repo.

Before new write workflows:

1. Parameterized writes.
2. Soft-delete/audit log design.
3. Role/team mutation policy.
4. Non-production write testing.

After launch / separate approval:

1. Old app credential rotation.
2. Old app auth hardening.
3. Old schema cleanup.
