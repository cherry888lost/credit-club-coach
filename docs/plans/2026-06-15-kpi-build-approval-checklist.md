# KPI Migration Build Approval Checklist

Status: **Approval checklist. Do not build until approved.**

## Fully confirmed

- Old KPI tracker hosting: Google Cloud Run.
- Project: `credit-club-tracking`.
- Service: `kpi-dashboard`.
- Region: `us-central1`.
- Framework: Python Plotly Dash.
- Dataset: `kpi_tracking`.
- Key BigQuery objects used: `kpi_records`, `daily_kpi_summary`, `revenue_by_source`, `ad_spend`, `users`.
- Source files inspected: `app.py`, `config.py`, `auth.py`, `callbacks.py`, `components.py`, `charts.py`, `database/kpi.py`, `database/ad_spend.py`, `database/users.py`, `docs/update_view.py`, migrations, tests.
- Core Closer/SDR formulas documented.
- Business Performance formulas documented from source.
- Security risks identified.
- Migration architecture proposed with dedicated `lib/kpis` layer.
- Parity test plan drafted.

## Partly confirmed

- `revenue_by_source`: fields and app usage confirmed; exact deployed object type/SQL not confirmed.
- BigQuery deployed schemas: source/migration scripts document expected schemas, but deployed metadata should still be verified before build.
- Old dashboard sample outputs: some Closer outputs observed; full BP/admin sample outputs still needed.
- Slack integration: legacy fields confirmed; active external Slack writer not confirmed.
- Existing sales tracker role/user mapping: needs current sales tracker auth/data model review before implementation.

## Unconfirmed

- Exact deployed SQL for `daily_kpi_summary` if it differs from source bundle.
- Exact deployed SQL/type for `revenue_by_source`.
- Whether any scheduler/external ingestion writes to `kpi_records`.
- Full Business Performance sample outputs for approved date ranges.
- Current table row counts and schema field types in BigQuery.
- Whether all old Python tests currently pass against current source/dependencies.

## Access still needed — minimum only

- BigQuery metadata viewer for `kpi_tracking` to confirm schemas/view SQL.
- Later, limited BigQuery read/query access for approved parity sample date ranges.
- Cloud Run read-only service config if final deployment/runtime settings need confirmation.
- No Owner/Editor/Admin access requested.
- No Secret Manager secret-value access requested.

## Decisions Arshid needs to make

1. Approve or reject the proposed read-only migration architecture.
2. Decide whether Phase 1 should be read-only only. Recommendation: yes.
3. Decide auth direction for new app: use existing sales tracker auth, not old Basic Auth.
4. Decide whether Business Performance should remain global/no team filter, matching old app.
5. Decide whether old organic fields should continue being included in `total_revenue/scheduled/live` but excluded from `new_customers`.
6. Decide whether writes/admin input should be deferred until after read-only parity. Recommendation: defer.
7. Approve minimum access for BigQuery metadata and later parity samples.
8. Decide if old app security remediation/credential rotation should be handled separately after migration planning.

## Recommendation

Do **not** proceed to full build yet.

Recommended next approved step:

- Proceed only to **Phase 1 read-only KPI module build planning/execution**, behind a feature flag/separate route, using live BigQuery reads and the dedicated `lib/kpis` logic layer.

Do not build write/admin/input workflows until:

- formula parity is confirmed
- role/team mapping is approved
- security fixes for new write paths are designed
- Arshid approves cutover approach
