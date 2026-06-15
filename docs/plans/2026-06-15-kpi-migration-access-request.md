# Missing Access Request — Minimum Necessary Access

Status: **Access planning only. No broad admin requested.**

Principle: request read-only access wherever possible. Do not request Owner, Editor, or broad Admin. Do not request Secret Manager secret values unless a future issue proves they are essential.

| Access needed | Exact service/resource | Minimum role/permission | Why needed | Read/write | Secrets exposed? | Safer alternative | Required now/later | Inspect | Will not touch |
|---|---|---|---|---|---|---|---|---|---|
| BigQuery metadata/schema read | BigQuery project `credit-club-tracking`, dataset `kpi_tracking` | `roles/bigquery.metadataViewer` on dataset/project | Confirm deployed table/view schemas and view SQL, especially `daily_kpi_summary` and `revenue_by_source` object type | Read-only | No row data/secrets, but schema names visible | User/developer can export schema/view SQL to file | Now, before build plan approval | table schemas, view definitions, column types | no queries that read data, no edits |
| BigQuery limited query read for parity | BigQuery dataset `kpi_tracking` | ideally custom role with `bigquery.jobs.create` + `bigquery.tables.getData` on specific tables/views, or `roles/bigquery.dataViewer` scoped to dataset | Pull sample KPI/ad-spend outputs for approved date ranges to create parity fixtures | Read-only | May expose business KPI rows and users table if too broad | User can export anonymized sample rows; restrict to views and exclude `users.password` | Later, before implementation/parity testing | selected rows from `daily_kpi_summary`, `ad_spend`, maybe `kpi_records`; avoid full exports | no writes, no deletes, no user password reads |
| Source artifact read | Cloud Run source/artifact for service `kpi-dashboard`; Cloud Storage source bucket shown by Cloud Run | storage object viewer on source artifact bucket/object only, or console source-download access | Re-verify source bundle if it changes; inspect code without deploy rights | Read-only | Source bundle may include credential files; handle as sensitive | Developer can provide redacted source zip | Already achieved; later only if source changes | Python source files, tests, docs | no deploys, no source edits |
| Cloud Run service config read | Cloud Run service `kpi-dashboard` in `us-central1` | `roles/run.viewer` scoped to service/project | Confirm deployed revision, env vars names, service account, traffic, ingress, URL | Read-only | Env var values may include non-secret config; Secret refs visible but not secret values | User can screenshot/export YAML with secret values redacted | Later before final cutover plan | service YAML metadata and revision settings | no deploys, no traffic changes, no permission changes |
| IAM service account metadata read | Service account `kpi-tracker@credit-club-tracking.iam.gserviceaccount.com` | IAM viewer or service account viewer metadata only | Understand what the app can read/write in BigQuery | Read-only | Does not expose keys unless key viewer granted; do not grant key/secret access | User can provide role list for service account | Later, security review | service account role bindings | no keys, no impersonation, no changes |
| Secret Manager metadata read only | Only if Cloud Run uses secret refs | `secretmanager.secrets.get/list` metadata only, not `secretmanager.versions.access` | Confirm whether secrets are referenced by name; not values | Read-only metadata | Secret names exposed, not values | User can confirm no Secret Manager used | Later only if service config references secrets | secret names/labels only | no secret values, no rotation, no edits |
| Existing sales tracker repo access | Local repo `/Users/papur/credit-club-coach` | local read access already available | Plan integration without breaking existing sales tracker | Read-only until approval | May expose app config/env if opened; do not read `.env` unless approved | User can provide architecture summary | Now for planning, later for build | package structure, app routes, data model | no edits/build until approved |

## Access not requested

- Owner role: not needed.
- Editor role: not needed.
- Project IAM Admin: not needed.
- Cloud Run Admin/developer: not needed for audit/planning.
- BigQuery Admin: not needed.
- Secret Manager secret value access: not needed now.
- Service account key creation/access: not needed.

## Current remaining unknowns access would resolve

- Exact deployed schema/types for every BigQuery object.
- Exact deployed SQL for `daily_kpi_summary` and `revenue_by_source` if different from source bundle.
- Exact sample outputs for Business Performance cards by approved date range.
- Whether any external process writes to `kpi_records`.
