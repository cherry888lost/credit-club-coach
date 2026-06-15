# BigQuery Logic Register — Old KPI Tracker

Status: **Read-only logic documentation. No BigQuery changes performed.**

Project: `credit-club-tracking`

Dataset: `kpi_tracking`

Source references:

- `config.py` defines `PROJECT_ID = os.getenv("GCP_PROJECT_ID", "credit-club-tracking")` and `DATASET_ID = "kpi_tracking"`.
- `database/kpi.py` queries KPI views/tables.
- `database/ad_spend.py` queries/writes ad spend.
- `database/users.py` queries/writes users.
- `docs/update_view.py` contains the SQL definition for `daily_kpi_summary`.

## 1. `kpi_tracking.kpi_records`

- Type: BigQuery table.
- Purpose: raw KPI submission/entry records. Historical Slack-era fields remain; current app inserts manual records.
- Upstream: manual dashboard input; possible legacy Slack ingestion not confirmed.
- Downstream:
  - `daily_kpi_summary` view.
  - `load_kpi_records()` history table.
  - insert/update/delete KPI form operations.
  - user role/name migration updates.
- App source:
  - `database/kpi.py:198-307` — `load_kpi_records()`.
  - `database/kpi.py:309-363` — `insert_daily_kpi()`.
  - `database/kpi.py:365-400` — `update_daily_kpi()`.
  - `database/kpi.py:402-416` — `delete_daily_kpi()`.
  - `database/users.py:177-239` — migrations on role/name changes.
  - `docs/update_view.py:52-156` — upstream for `daily_kpi_summary`.

### Columns used by app/view

Identity/audit:

- `slack_message_ts` — unique ID. Manual records use `manual_{timestamp}_{team_member}`; legacy name remains.
- `slack_user_id` — legacy Slack field, used in view but not insert form.
- `team_member` — salesperson/team member name used for filters/grouping.
- `role` — closer/sdr/admin-related row role used for dashboard separation.
- `kpi_date` — business date for filtering/grouping.
- `submission_timestamp`, `created_at`, `updated_at` — audit timestamps.
- `raw_message` — legacy/manual raw message label.
- `user_display_name`, `user_real_name`, `user_email`, `user_title`, `user_phone` — profile/legacy fields.
- `message_type` — manual/legacy classification.

New-first-call / NF fields:

- `nf_scheduled_call`
- `nf_live_calls`
- `nf_full_close`
- `nf_partial`
- `nf_deposit`
- `nf_payment_plan`
- `nf_revenue`
- `nf_potential_revenue`

Organic / ORG fields:

- `org_scheduled_call`
- `org_live_calls`
- `org_deposit`
- `org_partial`
- `org_payment_plan`
- `org_full_close`
- `org_revenue`
- `org_potential_revenue`

Existing-customer/collection / ECC fields:

- `ecc_full_close`
- `ecc_partial`
- `ecc_deposit`
- `ecc_payment_plan`
- `ecc_revenue`

Second-call-close / SCC fields:

- `scc_full_close`
- `scc_partial`
- `scc_deposit`
- `scc_payment_plan`
- `scc_revenue`
- `scc_potential_revenue`

Refund fields:

- `refund_count`
- `refund_amount`

### Filters / WHERE clauses

- `load_kpi_records()` filters by `kpi_date` inclusive and `team_member IN (...)` if provided.
- `delete_daily_kpi()` deletes by `slack_message_ts`.
- `update_daily_kpi()` updates by `slack_message_ts`.
- User migrations update by `team_member` and/or `role`.

### Calculated fields

No calculated fields in raw table itself. Calculations happen in `daily_kpi_summary` and Python.

### Assumptions/risks

- `slack_message_ts` is still used as primary record ID despite manual-entry workflow.
- SQL strings interpolate values directly; migration should use parameterized queries.
- Legacy fields may still matter if an external Slack process writes rows; this remains unconfirmed.

---

## 2. `kpi_tracking.daily_kpi_summary`

- Type: BigQuery view, based on `docs/update_view.py`.
- Purpose: daily/member/role aggregated KPI source for dashboards.
- Upstream: `kpi_tracking.kpi_records`.
- Downstream:
  - Closer dashboard.
  - SDR dashboard.
  - Business Performance dashboard.
  - KPI charts/gauges.
- App source:
  - SQL definition in `docs/update_view.py:52-156`.
  - Query in `database/kpi.py:15-85`.
  - Python derived metrics in `database/kpi.py:99-121`.

### View grouping

`GROUP BY team_member, kpi_date, role`

### SQL definition shape

The view selects:

- grouped dimensions: `team_member`, `kpi_date`, `role`
- latest profile/audit values via `MAX(...)`
- raw field sums across NF, ORG, ECC, SCC, refund fields
- calculated totals/rates

### Important SQL calculated fields

- `total_scheduled_calls = SUM(nf_scheduled_call) + SUM(org_scheduled_call)`
- `total_live_calls = SUM(nf_live_calls) + SUM(org_live_calls)`
- `total_full_closes = SUM(nf_full_close) + SUM(org_full_close) + SUM(ecc_full_close) + SUM(scc_full_close)`
- `total_revenue = SUM(nf_revenue) + SUM(org_revenue) + SUM(ecc_revenue) + SUM(scc_revenue)`
- `total_potential_revenue = GREATEST(0, SUM(nf_potential_revenue) + SUM(scc_potential_revenue) - SUM(ecc_revenue))`
- `show_up_rate = ROUND((SUM(nf_live_calls)+SUM(org_live_calls))*100/(SUM(nf_scheduled_call)+SUM(org_scheduled_call)), 2)` if scheduled > 0 else 0
- `no_show_rate = 100 - show_up_rate` style calculation if scheduled > 0 else 0
- `close_rate = ROUND((SUM(nf_full_close)+SUM(nf_partial)+SUM(nf_deposit)+SUM(nf_payment_plan))*100/SUM(nf_live_calls), 2)` if NF live calls > 0 else 0

### Columns consumed by Python

`database/kpi.py` selects:

- dimensions: `team_member`, `kpi_date`, `role`
- summary totals: `total_scheduled_calls`, `total_live_calls`, `total_full_closes`, `total_revenue`, `total_potential_revenue`, `show_up_rate`, `close_rate`
- NF/ORG/ECC/SCC revenue and close fields
- refund fields

### Additional Python calculated fields after query

In `database/kpi.py:99-121`:

- `first_call_cash = nf_revenue`
- `recovery_cash = scc_revenue + ecc_revenue`
- `potential_revenue_calc = nf_potential_revenue + scc_potential_revenue - ecc_revenue`
- `new_customers = nf close types + scc close types`, excluding ECC/ORG
- `close_rate_calc = first-call close types / nf_live_calls * 100`
- `refund_rate = refund_count / new_customers * 100`

### Filters / WHERE clauses

`database/kpi.py` applies:

- `WHERE 1=1`
- optional `kpi_date >= DATE('{start_date}')`
- optional `kpi_date <= DATE('{end_date}')`
- optional `team_member IN (...)`
- optional `role = '{role}'`
- `ORDER BY kpi_date DESC, team_member`

### Refresh/update behaviour

- BigQuery view is live at query time.
- Changes to `kpi_records` appear in dashboard on next query/callback.
- No materialized refresh schedule found.

### Risks

- Logic is split: view calculates some totals/rates; Python recalculates others.
- `total_full_closes` includes NF+ORG+ECC+SCC full closes, but dashboard `new_customers` excludes ORG/ECC.
- View clamps total potential revenue at grouped row level; Python derives an unclamped per-row `potential_revenue_calc` then dashboard clamps after summing. Preserve this exact behavior.

---

## 3. `kpi_tracking.revenue_by_source`

- Type: table or view — exact object type not confirmed from source alone.
- Purpose: revenue source breakdown by NF/ORG/ECC/SCC.
- Upstream: likely `kpi_records` or a view over it, not confirmed.
- Downstream: `load_revenue_by_source()` and revenue source charts/logic if used.
- App source: `database/kpi.py:134-196`.

### Columns used

- `kpi_date`
- `team_member`
- `nf_revenue`
- `org_revenue`
- `ecc_revenue`
- `scc_revenue`
- `total_revenue`

### Python transformations

`load_revenue_by_source()` maps source labels:

- `nf_revenue` -> `NF`
- `org_revenue` -> `ORG`
- `ecc_revenue` -> `ECC`
- `scc_revenue` -> `SCC`

It returns a long-form dataframe with columns:

- `kpi_date`
- `team_member`
- `source`
- `revenue`

### Filters / WHERE clauses

- optional inclusive date range on `kpi_date`
- optional `team_member IN (...)`

### Refresh/update behaviour

- If a view, live at query time; if a table, update pipeline not confirmed.

### Risks/unknowns

- Exact SQL definition and object type need BigQuery metadata read to confirm.
- If new merged dashboard does not use this chart, still preserve if old chart behavior is required.

---

## 4. `kpi_tracking.ad_spend`

- Type: BigQuery table.
- Purpose: date-level marketing spend and lead counts.
- Upstream: manual dashboard input.
- Downstream: Business Performance marketing metrics and Ad Spend history table.
- App source: `database/ad_spend.py` and `callbacks.py:641-777`, `callbacks.py:1030-1170` area.

### Columns used

- `id` — UUID string.
- `date` — ad spend date.
- `ad_spend` — GBP spend amount.
- `leads` — lead count.
- `cpl` — per-record cost per lead.
- `created_at`
- `updated_at`

### Calculated fields

On insert/update:

- `cpl = ad_spend / max(leads, 1)` in `database/ad_spend.py:74` and `database/ad_spend.py:92`.

Business Performance recalculation:

- `total_ad_spend = SUM(ad_spend)`
- `total_leads = SUM(leads)`
- `CPL = total_ad_spend / total_leads` if leads > 0 else 0

### Filters / WHERE clauses

- `load_ad_spend_data()` and `get_ad_spend_summary()` filter by inclusive `date >= DATE('{start_date}')` and `date <= DATE('{end_date}')`.
- update/delete/get-by-date functions filter by `id` or `date`.

### Refresh/update behaviour

- Manual add/edit/delete through Ad Spend Input tab.
- BigQuery table updates visible on next callback.

### Risks

- Direct f-string SQL interpolation.
- Per-record CPL uses denominator `max(leads,1)` while dashboard summary CPL returns 0 for zero total leads; preserve or intentionally change with approval.

---

## 5. `kpi_tracking.users`

- Type: BigQuery table.
- Purpose: Basic Auth credentials, app role, profile/team-member mapping.
- Upstream: Admin user management tab.
- Downstream:
  - `dash-auth` username/password pairs.
  - user profile/role mapping.
  - tab visibility and data visibility behavior.
  - migration helpers update old KPI rows on name/role changes.
- App source: `auth.py`, `database/users.py`.

### Columns used

- `id`
- `username`
- `password`
- `email`
- `display_name`
- `team_member`
- `role`
- `is_active`
- `created_at`
- `updated_at`

### Filters / WHERE clauses

- auth/profile loads use `WHERE is_active = TRUE`.
- admin table loads active users only.
- username existence checks `username = ... AND is_active = TRUE`.
- delete is soft-delete: `SET is_active = FALSE`.

### Role/team logic

- Roles can be comma-separated, e.g. `closer,sdr`.
- Admin/viewer can see all team members.
- Non-admin roles are tied to `team_member`.
- Closers can see all SDR data for team visibility per `auth.py:get_allowed_sdr_data()`.

### Security risks

- Passwords appear plaintext.
- Passwords are loaded into app memory and used for Basic Auth.
- SQL interpolation risk in user CRUD.
- New merged app should not preserve this auth design as-is.

---

## Minimum BigQuery metadata still useful later

To complete parity without guessing, later request read-only access to:

- view SQL for `daily_kpi_summary` as deployed
- object type and SQL/schema for `revenue_by_source`
- table schemas for `kpi_records`, `ad_spend`, `users`
- small sampled query outputs for approved date/team ranges
