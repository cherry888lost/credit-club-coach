# Source Logic Register — Old KPI Tracker

Status: **Source audit only. No source edits. No deployment changes.**

Source root inspected: Cloud Run source bundle for `kpi-dashboard`.

## `app.py`

Purpose:

- Main Dash application entry point.
- Creates Dash app, Flask server, Basic Auth wrapper, and full dashboard layout/tabs.

Important logic:

- imports `PROJECT_ID`, `DATASET_ID` from `config.py`.
- imports `VALID_USERNAME_PASSWORD_PAIRS` from `auth.py`.
- creates `dash_auth.BasicAuth(app, VALID_USERNAME_PASSWORD_PAIRS)`.
- defines tabs: Closer Dashboard, SDR Dashboard, Business Performance, Daily KPI Input, Ad Spend Input, Admin.
- calls `register_callbacks(app)`.

KPIs depending on it:

- All KPIs depend indirectly because it wires layout IDs to callbacks.

BigQuery tables/views:

- none queried directly.

Migrate:

- Migrate conceptual tab/page structure and card/chart inventory.
- Do not migrate Dash-specific UI directly into Next.js/React except as a reference.
- Do not copy Basic Auth pattern directly.

Risks:

- fallback Flask secret key exists in source if env var missing.
- BasicAuth uses plaintext/password-pair style auth.

---

## `config.py`

Purpose:

- Defines Google Cloud/BigQuery config, color theme, fallback credentials/profiles.
- Initializes BigQuery client.

Important logic:

- `PROJECT_ID` from `GCP_PROJECT_ID`, default `credit-club-tracking`.
- `DATASET_ID = "kpi_tracking"`.
- `client = bigquery.Client(project=PROJECT_ID)`.
- default/fallback credentials and profiles exist in code.

KPIs depending on it:

- All BigQuery-backed KPIs depend on `client`, `PROJECT_ID`, and `DATASET_ID`.

BigQuery tables/views:

- all app tables/views via shared client/config.

Migrate:

- Migrate config concept, not literal secrets/fallback credentials.
- Use environment variables and service identity in new app.

Do not copy directly:

- any credential/password/default-secret material.

Risks:

- secret/fallback user data in source.
- BigQuery client created globally.

---

## `auth.py`

Purpose:

- Loads active users and profiles from BigQuery.
- Provides current user, role helpers, team-member visibility helpers.

Important functions:

- `_load_credentials_from_db()` — queries `users` for `username,password` where active.
- `_load_profiles_from_db()` — queries `users` for username/team_member/role/display_name.
- `reload_auth()` — reloads credentials and profiles after user CRUD.
- `get_current_user()` — reads HTTP Basic Auth username from Flask request.
- `get_user_profile(username)` — returns team_member/role/display_name.
- `user_has_role(profile, check_role)` — supports comma-separated roles.
- `get_allowed_team_members(username)` — admin/viewer all, others own team_member.
- `get_sdr_members()` / `get_closer_members()` — derive members from profiles.
- `get_allowed_sdr_data(username)` — admin/viewer all SDR, SDR own, closer all SDR.
- `get_team_members()` — all team members from active profiles.

KPIs depending on it:

- Role-filtered visibility and which dashboard tabs/records users can see/input.

BigQuery tables/views:

- `kpi_tracking.users`.

Migrate:

- Role/team mapping logic should be migrated conceptually.
- Replace auth with existing sales tracker auth/Clerk/Supabase mapping if present.

Do not copy directly:

- plaintext Basic Auth credential handling.

Risks:

- plaintext passwords.
- default fallback admin behavior if auth lookup fails.

---

## `database/kpi.py`

Purpose:

- BigQuery access layer for KPI records and summary views.

Important functions:

### `load_daily_kpi_summary(start_date=None, end_date=None, team_members=None, role=None)` — lines 15-132

Queries `kpi_tracking.daily_kpi_summary` and applies date/team/role filters.

Fields selected:

- `team_member`, `kpi_date`, `role`
- `total_scheduled_calls`, `total_live_calls`, `total_full_closes`, `total_revenue`, `total_potential_revenue`, `show_up_rate`, `close_rate`
- `nf_revenue`, `nf_potential_revenue`, `org_revenue`, `ecc_revenue`, `scc_revenue`, `scc_potential_revenue`
- refund fields
- NF/SCC close-type fields

Python-derived formulas:

- `first_call_cash = nf_revenue`
- `recovery_cash = scc_revenue + ecc_revenue`
- `potential_revenue_calc = nf_potential_revenue + scc_potential_revenue - ecc_revenue`
- `new_customers = NF close types + SCC close types`
- `close_rate_calc = NF close types / nf_live_calls * 100`
- `refund_rate = refund_count / new_customers * 100`

### `load_summary_stats(...)` — lines 134-166

Aggregates summary totals from `daily_kpi_summary`.

### `load_revenue_by_source(...)` — lines 168-196

Queries `revenue_by_source`, maps NF/ORG/ECC/SCC revenue into long-form source rows.

### `load_kpi_records(...)` — lines 198-307

Queries raw `kpi_records` for history/edit table; includes display aliases such as scheduled_calls/live_calls/full_close/payment_plan/etc.

### `insert_daily_kpi(kpi_data)` — lines 309-363

Builds manual record ID and inserts into `kpi_records`.

### `update_daily_kpi(record_id, kpi_data)` — lines 365-400

Updates selected KPI record by `slack_message_ts`.

### `delete_daily_kpi(record_id)` — lines 402-416

Deletes selected KPI record by `slack_message_ts`.

KPIs depending on it:

- All Closer/SDR KPIs.
- Business Performance sales-side KPIs.
- KPI input history/edit/delete.

Migrate:

- Query/filter semantics.
- Derived KPI formulas.
- Raw record edit history shape if manual input is retained.

Do not copy directly:

- f-string SQL queries.
- Slack-named record ID design unless preserving historical compatibility.

Risks:

- SQL injection from direct string interpolation.
- potential mismatch between view `total_potential_revenue` clamp and Python aggregate clamp.
- delete is hard delete for KPI records.

---

## `database/ad_spend.py`

Purpose:

- BigQuery access layer for ad spend rows and Business Performance ad summary.

Important functions:

- `load_ad_spend_data(start_date=None, end_date=None)` — reads row-level ad spend history.
- `get_ad_spend_summary(start_date=None, end_date=None)` — returns `SUM(ad_spend)` and `SUM(leads)`.
- `insert_ad_spend(date, ad_spend, leads)` — inserts UUID, date, spend, leads, cpl.
- `update_ad_spend(record_id, ad_spend, leads)` — recalculates cpl and updates record.
- `delete_ad_spend(record_id)` — deletes by ID.
- `get_ad_spend_by_date(date)` — lookup by date.

Formulas/filters:

- Row CPL = `ad_spend / max(leads, 1)`.
- Summary CPL is calculated in callback as total spend / total leads.
- Date filters are inclusive on `date`.

KPIs depending on it:

- Ad Spend.
- Total Leads.
- CPL.
- Cost Per Call.
- Cost Per Show.
- CAC.
- Blended CAC.
- ROAS.
- Profit.

Migrate:

- Table mapping and aggregate formulas.
- Date-range behavior.

Do not copy directly:

- f-string SQL queries.
- hard delete pattern unless approved.

Risks:

- SQL injection.
- per-row CPL zero-lead behavior differs from summary CPL behavior.

---

## `database/users.py`

Purpose:

- BigQuery CRUD for users, roles, and team-member mapping.
- Handles data migrations when users change role/name.

Important functions:

- `load_users_from_db()` — active user list.
- `get_users_credentials()` — username/password pairs for auth.
- `get_user_profiles_from_db()` — team_member/role/display_name profile map.
- `username_exists(username)` — existence check.
- `insert_user(...)` — inserts active user.
- `update_user(...)` — updates username/password/email/display/team/role.
- `delete_user(user_id)` — soft deletes via `is_active = FALSE`.
- `get_user_by_id(user_id)` — fetch for edit.
- `migrate_kpi_records_for_role_change(...)` — updates existing KPI record roles when removed.
- `migrate_kpi_records_for_name_change(...)` — updates existing KPI records when team_member name changes.

KPIs depending on it:

- Data visibility by team/role.
- Historical KPI row grouping when team member names/roles change.

BigQuery tables/views:

- `users`
- `kpi_records` for migration helpers.

Migrate:

- Active user/team member/role mapping behavior.
- Need an explicit migration strategy for old `users` table into existing sales tracker auth.

Do not copy directly:

- plaintext password model.
- SQL interpolation.

Risks:

- role/name changes mutate historical KPI records.
- username/team_member changes can affect old reports.
- no explicit audit log beyond updated timestamps.

---

## `callbacks.py`

Purpose:

- Registers all Dash server callbacks.
- Contains most dashboard aggregation logic, form handling, admin/ad-spend/KPI CRUD callbacks.

Important logic areas:

### Tab/user callbacks — early file

- current user store.
- tab visibility by role.
- member dropdown behavior.

### KPI form preview — around lines 232-241

- `total_revenue = fc_cash + scc_cash + ecc_cash - refund_amount`.
- `show_up = live / scheduled * 100`.
- `close_rate = first_call_closes / live * 100`.

### KPI form submit/edit/delete — around lines 296-400 and later modal callbacks

- maps form fields into `kpi_data`.
- calls database insert/update/delete functions.

### Closer dashboard — lines 413-488

- loads role `closer` data.
- sums first call cash, recovery cash, total cash, potential, calls, customers, refunds.
- calculates aggregate show-up, close rate, ARPU.
- builds revenue/call/close/gauge charts.

### SDR dashboard — lines 532-600

- same pattern as closer dashboard with role `sdr`.

### Business Performance — lines 641-777

- loads closer and SDR data separately.
- loads ad spend summary.
- calculates Cash Collected, Recovered Cash, Total Cash, Net Cash, Profit, ARPU, funnel metrics, CPL, cost-per-call/show, CAC, Blended CAC, ROAS, deal mix, refund rate.

### Ad spend callbacks — around lines 1030-1170

- load history.
- calculate CPL preview.
- insert/update/delete ad spend rows.

KPIs depending on it:

- Almost all displayed KPIs/cards.

Migrate:

- All formulas should move into `lib/kpis/calculations.ts` and `lib/kpis/registry.ts`.
- UI components should consume already-calculated KPI view models.

Do not copy directly:

- Dash callback structure.
- role checks coupled to UI callbacks.
- f-string SQL indirectly via database functions.

Risks:

- formulas live inside UI callback logic instead of a dedicated calculation layer.
- Business Performance logic is easy to misread because KPI labels are broader than their exact source definitions.

---

## `charts.py`

Purpose:

- Plotly chart/gauge creation.

Important functions:

- `create_revenue_trend_chart(df, selected_members='All')`
- `create_team_performance_chart(df, selected_members='All')`
- `create_close_rate_gauge_chart(df, selected_members='All')`
- `create_calls_comparison_chart(df, selected_members='All')`
- `create_show_rate_gauge_chart(df, selected_members='All')`
- `create_refund_rate_gauge_chart(df, selected_members='All')`
- `create_bp_funnel_chart(...)`
- `create_bp_deal_mix_chart(...)`
- `create_close_mix_chart(df, selected_members='All')`

Formulas/thresholds:

- Close Rate Gauge: first-call closes / NF live calls; thresholds red 0-10, amber 10-30, green 30-100.
- Show Rate Gauge: total live / total scheduled; thresholds red 0-40, amber 40-70, green 70-100.
- Refund Rate Gauge: refunds / new customers; thresholds green 0-3, amber 3-6, red 6-15.
- Close Mix: NF+SCC close types only.
- BP Funnel: supplied values lead/scheduled/live/first-call closes.
- BP Deal Mix: supplied close type counts, title uses ARPU.

KPIs depending on it:

- gauge KPIs and chart displays.

Migrate:

- Threshold constants and chart data transformations.
- Visual implementation can be in Recharts or another library, but calculations must stay in `lib/kpis`.

Do not copy directly:

- Plotly-specific rendering if merged dashboard uses existing React chart stack.

Risks:

- Some formulas are repeated in callbacks and charts; new app should centralize them.

---

## `components.py`

Purpose:

- Creates Dash UI components/forms/tables.

Important functions:

- `create_header()`
- `create_kpi_input_form()`
- `create_business_performance_section()`
- `create_ad_spend_input_section()`
- `create_admin_user_management_section()`
- `create_kpi_records_section()`
- `create_edit_modal()`
- `create_delete_modal()`
- scorecard/chart helpers.

KPIs depending on it:

- Defines visible cards/tables/forms and component IDs that callbacks target.

Migrate:

- Form field inventory.
- Dashboard tab/card/table structure.

Do not copy directly:

- Dash component implementation.
- Admin user/password form pattern without security redesign.

Risks:

- UI IDs tightly couple to callback logic.

---

## `assets/callbacks.js`

Purpose:

- Client-side behavior for tab visibility/input filtering.

Migrate:

- Role-based tab visibility concept.
- Numeric input constraints if still required.

Do not copy directly:

- Dash-specific clientside callback code.

---

## `docs/update_view.py`

Purpose:

- Script to create/replace `daily_kpi_summary` BigQuery view.

Critical migration value:

- This is the canonical documented SQL logic for the view.

Migrate:

- Preserve view SQL or replicate exact logic in new data layer.
- Prefer keeping BigQuery view in Phase 1 to reduce migration risk.

Do not touch old production view without approval.

Risks:

- Recreating the view incorrectly will change KPI outputs.

---

## `docs/migrate_schema.py`, `docs/migrate_schema_v2.py`

Purpose:

- Historical schema migration scripts.

Migrate:

- Use only as schema history/reference.

Do not run against production without approval.

Risks:

- Migration scripts can alter production schema.

---

## `tests/`

Purpose:

- Unit tests for KPI calculations and bug fixes.

Important file:

- `tests/test_kpi_calculations.py` documents client KPI specs and independent formula tests.

Migrate:

- Convert these into TypeScript parity/unit tests for `lib/kpis`.
- Preserve client specs exactly.

Do not copy directly:

- Python tests without translating into new stack unless keeping Python logic.
