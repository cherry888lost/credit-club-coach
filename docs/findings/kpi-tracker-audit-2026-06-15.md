# KPI Tracker Discovery Audit — 2026-06-15

Status: **Discovery/audit only. No build or migration performed.**

Audit target: `https://kpi-dashboard-606295947266.us-central1.run.app/`

Google Cloud project confirmed: `credit-club-tracking`

Cloud Run service confirmed: `kpi-dashboard`

Region confirmed: `us-central1`

Source bundle inspected via Google Cloud Console read-only access. Credentials and secret values are intentionally **not** recorded in this report.

---

## 1. Executive summary — non-technical

The KPI tracker is a custom web dashboard for Credit Club sales KPIs. It is not a Google Sheet dashboard and not a Looker dashboard. It is a Python web app hosted on Google Cloud Run.

The dashboard pulls its data from Google BigQuery tables/views in the `credit-club-tracking` Google Cloud project. The core dataset is `kpi_tracking`.

The app tracks:

- closer performance
- SDR performance
- total business performance
- daily KPI manual entries
- ad spend entries
- user/admin access

The dashboard has important business logic inside the Python code and in a BigQuery view. This means any migration must preserve both:

1. Python calculation logic inside the dashboard code.
2. BigQuery view/query logic behind the dashboard.

Key discovery: the dashboard previously had Slack/pipeline roots, shown by fields like `slack_message_ts` and raw message columns, but the current app now supports manual dashboard entry and says it is replacing the Slack workflow.

Important risk: the current source bundle includes sensitive credential/password material in files/tables. Do not copy this directly into a new repo/app without secret cleanup.

---

## 2. Current system structure

### Hosting

- Platform: Google Cloud Run
- Project: `credit-club-tracking`
- Service: `kpi-dashboard`
- Region: `us-central1`
- Public URL: `https://kpi-dashboard-606295947266.us-central1.run.app/`
- Deployment mode in script: `gcloud run deploy --source=.`
- Cloud Run allows unauthenticated ingress, then app-level HTTP Basic Auth protects the dashboard.

### App platform/framework

- Language: Python
- Framework: Plotly Dash
- Auth: `dash-auth` BasicAuth
- UI library: Dash Bootstrap Components
- Charts: Plotly
- Data processing: pandas/numpy
- Web serving: app runs with `python app.py`; requirements include gunicorn, but Dockerfile command uses `CMD exec python app.py`.

### Important source files

- `app.py` — main Dash app and tab layout.
- `callbacks.py` — dashboard callbacks, KPI aggregation, form logic, Business Performance calculations.
- `components.py` — reusable UI/form/table sections.
- `charts.py` — Plotly charts/gauges.
- `config.py` — Google Cloud/BigQuery config, colors, fallback defaults.
- `auth.py` — Basic Auth/user-profile loading.
- `database/kpi.py` — KPI BigQuery reads/inserts/updates/deletes.
- `database/ad_spend.py` — ad spend BigQuery reads/inserts/updates/deletes.
- `database/users.py` — user CRUD and role/name migration logic.
- `assets/callbacks.js` — client-side tab/visibility behavior.
- `docs/update_view.py` — BigQuery view definition for `daily_kpi_summary`.
- `docs/migrate_schema.py` and `docs/migrate_schema_v2.py` — historical schema migrations.
- `tests/` — unit tests covering KPI calculations and client bug fixes.

### Runtime/deployment details

From `deploy.sh`:

- Project: `credit-club-tracking`
- Service: `kpi-dashboard`
- Region: `us-central1`
- Service account: `kpi-tracker@credit-club-tracking.iam.gserviceaccount.com`
- Env var set: `GCP_PROJECT_ID=credit-club-tracking`
- CPU: 1
- Memory: 1Gi
- Timeout: 300 seconds
- Concurrency: 80
- Min instances: 0
- Max instances: 10
- Port: 8080

From `Dockerfile`:

- Base image: `python:3.11-slim`
- Workdir: `/app`
- Copies app files, database folder, assets, and a `credentials.json` file.
- Sets `GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json`.
- Exposes port 8080.

### Google services involved

Confirmed:

- Google Cloud Run
- Google Cloud Build, implied by `gcloud run deploy --source=.`
- Google BigQuery
- Google Cloud service account
- Google Cloud Storage source artifact, via Cloud Run source bundle

Not confirmed as active:

- Google Sheets
- Apps Script
- Cloud Functions
- Looker Studio
- Firestore
- Cloud SQL

### Static/live/scheduled/manual

The dashboard is **live and callback-driven**.

- Dash callbacks query BigQuery when tabs/filters/refresh/input events change.
- KPI records can be manually added/edited/deleted through the app depending on role.
- Ad spend records can be manually added/edited/deleted.
- User records can be managed in Admin.
- No scheduled refresh job was found in the app source.
- No cron/scheduler integration was confirmed.

---

## 3. Data sources

### Source A — BigQuery dataset

- Project: `credit-club-tracking`
- Dataset: `kpi_tracking`
- Source type: Google BigQuery
- Read/write: app reads and writes depending on function/user role.

Confirmed tables/views used:

1. `kpi_tracking.kpi_records`
2. `kpi_tracking.daily_kpi_summary`
3. `kpi_tracking.revenue_by_source`
4. `kpi_tracking.ad_spend`
5. `kpi_tracking.users`

---

### Source B — `kpi_records`

Type: BigQuery table.

Purpose: raw KPI entry table; used for KPI record history and manual add/edit/delete.

Read path:

- `database/kpi.py -> load_kpi_records()`

Write paths:

- `insert_daily_kpi()`
- `update_daily_kpi()`
- `delete_daily_kpi()`
- user role/name migrations can also update records.

Key fields used:

- `slack_message_ts` — unique record ID. Manual entries use generated IDs beginning with `manual_...`.
- `team_member`
- `role`
- `kpi_date`
- `submission_timestamp`
- `created_at`
- `updated_at`
- `raw_message`
- `nf_scheduled_call`
- `nf_live_calls`
- `nf_full_close`
- `nf_partial`
- `nf_deposit`
- `nf_payment_plan`
- `nf_revenue`
- `nf_potential_revenue`
- `scc_full_close`
- `scc_partial`
- `scc_deposit`
- `scc_payment_plan`
- `scc_revenue`
- `scc_potential_revenue`
- `ecc_revenue`
- `refund_count`
- `refund_amount`
- `org_revenue`
- `user_display_name`
- `message_type`

Historical/legacy fields in view script also reference:

- `slack_user_id`
- `user_real_name`
- `user_email`
- `user_title`
- `user_phone`
- organic fields such as `org_scheduled_call`, `org_live_calls`, `org_deposit`, `org_partial`, `org_payment_plan`, `org_full_close`, `org_potential_revenue`
- collection close-type fields such as `ecc_full_close`, `ecc_partial`, `ecc_deposit`, `ecc_payment_plan`

Update frequency:

- Updates whenever a user submits/edits/deletes records through the dashboard.
- May also contain historical Slack-ingested data, but active Slack ingestion was not confirmed in this app source.

Relationship:

- `daily_kpi_summary` is a BigQuery view over `kpi_records`.
- `revenue_by_source` is queried as a separate revenue breakdown source.

---

### Source C — `daily_kpi_summary`

Type: BigQuery view.

Purpose: aggregated per-day, per-team-member, per-role KPI source for Closer, SDR, and Business Performance dashboards.

View grouping:

- `team_member`
- `kpi_date`
- `role`

Key logic in `docs/update_view.py`:

- sums first-call, organic, second-call, collection, revenue, refund fields
- calculates `total_scheduled_calls`
- calculates `total_live_calls`
- calculates `total_revenue`
- calculates `total_potential_revenue`
- calculates `show_up_rate`
- calculates `no_show_rate`
- calculates `close_rate`

Update frequency:

- BigQuery view reflects underlying `kpi_records` changes immediately at query time.

Read-only/editable:

- Read-only view from app perspective.
- Underlying `kpi_records` table is editable through app functions.

---

### Source D — `revenue_by_source`

Type: BigQuery table or view, exact object type not confirmed.

Purpose: revenue breakdown chart/source analysis.

Read path:

- `database/kpi.py -> load_revenue_by_source()`

Fields used:

- `kpi_date`
- `team_member`
- `nf_revenue`
- `org_revenue`
- `ecc_revenue`
- `scc_revenue`
- `total_revenue`

Mapping:

- `nf_revenue` -> `NF`
- `org_revenue` -> `ORG`
- `ecc_revenue` -> `ECC`
- `scc_revenue` -> `SCC`

---

### Source E — `ad_spend`

Type: BigQuery table.

Purpose: ad spend and lead input for Business Performance marketing economics.

Read path:

- `database/ad_spend.py -> load_ad_spend_data()`
- `get_ad_spend_summary()`

Write paths:

- `insert_ad_spend()`
- `update_ad_spend()`
- `delete_ad_spend()`

Fields used:

- `id`
- `date`
- `ad_spend`
- `leads`
- `cpl`
- `created_at`
- `updated_at`

Formula:

- `cpl = ad_spend / max(leads, 1)` during insert/update.
- Business Performance recalculates CPL as `total_ad_spend / total_leads` if `total_leads > 0`.

Update frequency:

- Manual updates through Ad Spend Input tab.

---

### Source F — `users`

Type: BigQuery table.

Purpose: Basic Auth credentials, profile mapping, team member mapping, role access.

Read paths:

- `auth.py`
- `database/users.py`

Write paths:

- `insert_user()`
- `update_user()`
- `delete_user()` soft-deletes by setting `is_active = FALSE`.

Fields used:

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

Roles supported:

- `admin`
- `closer`
- `sdr`
- `closer,sdr`
- `viewer`

Security note:

- Passwords appear to be stored/read as plaintext strings for HTTP Basic Auth. This should be fixed during migration.

---

## 4. KPI logic register

### Shared dashboard filters

Global filters:

- start date
- end date
- team member filter
- refresh button
- active tab

Closer dashboard applies:

- `role = 'closer'`
- selected date range
- selected team members if not `All`

SDR dashboard applies:

- `role = 'sdr'`
- selected date range
- selected team members if not `All`

Business Performance applies:

- all closers: `role = 'closer'`
- all SDRs: `role = 'sdr'`
- date range
- no team member filter in callback

---

### Closer / SDR dashboard KPI logic

#### First Call Cash

Formula:

`First Call Cash = SUM(nf_revenue)`

Source:

- `database/kpi.py`: `df['first_call_cash'] = df['nf_revenue']`
- `callbacks.py`: sum of `first_call_cash`

Format:

- GBP, zero decimals.

---

#### Recovery Cash

Formula:

`Recovery Cash = SUM(scc_revenue + ecc_revenue)`

Meaning:

- second call cash plus collection cash.

Source:

- `database/kpi.py`: `df['recovery_cash'] = df['scc_revenue'] + df['ecc_revenue']`

Format:

- GBP, zero decimals.

---

#### Total Cash / Total Cash Collected

Formula in Closer/SDR dashboard:

`Total Cash = SUM(total_revenue)`

BigQuery view definition for `total_revenue`:

`total_revenue = SUM(nf_revenue) + SUM(org_revenue) + SUM(ecc_revenue) + SUM(scc_revenue)`

Note:

- Despite the card name `Total Cash Collected`, this value uses `total_revenue` from the summary/view.
- Refund amount is shown separately and is not subtracted here in Closer/SDR cards.

Format:

- GBP, zero decimals.

---

#### Potential Revenue

Python per-row formula:

`potential_revenue_calc = nf_potential_revenue + scc_potential_revenue - ecc_revenue`

Dashboard display formula:

`Potential Revenue = max(0, SUM(potential_revenue_calc))`

BigQuery view formula:

`total_potential_revenue = GREATEST(0, SUM(nf_potential_revenue) + SUM(scc_potential_revenue) - SUM(ecc_revenue))`

Important nuance:

- Python allows negative per-row potential so cross-day collections can deduct from cumulative total.
- The displayed total is clamped to zero after summing.

---

#### Scheduled Calls

Formula:

`Scheduled Calls = SUM(total_scheduled_calls)`

BigQuery view formula:

`total_scheduled_calls = SUM(nf_scheduled_call) + SUM(org_scheduled_call)`

---

#### Live Calls

Formula:

`Live Calls = SUM(total_live_calls)`

BigQuery view formula:

`total_live_calls = SUM(nf_live_calls) + SUM(org_live_calls)`

---

#### New Customer

Formula:

`New Customers = SUM(nf_full_close + nf_partial + nf_deposit + nf_payment_plan + scc_full_close + scc_partial + scc_deposit + scc_payment_plan)`

Important exclusions:

- Collections/ECC do **not** count as new customers.
- Organic close fields are not included in this Python-derived `new_customers` formula.

---

#### First Call Close Customer

Closer dashboard only.

Formula:

`First Call Close Customer = SUM(nf_full_close + nf_partial + nf_deposit + nf_payment_plan)`

---

#### Customers Refunded

Formula:

`Customers Refunded = SUM(refund_count)`

---

#### Show Up Rate

Dashboard aggregate formula:

`Show Up Rate = SUM(total_live_calls) / SUM(total_scheduled_calls) * 100`

BigQuery view formula calculates daily/member-level value after aggregation:

`ROUND((SUM(nf_live_calls) + SUM(org_live_calls)) * 100 / (SUM(nf_scheduled_call) + SUM(org_scheduled_call)), 2)`

Dashboard card/gauge uses totals, not average of daily rates.

Format:

- one decimal percent in cards/gauges.

Thresholds:

- 0–40% red
- 40–70% amber
- 70–100% green

---

#### Close Rate

Formula:

`Close Rate = SUM(nf_full_close + nf_partial + nf_deposit + nf_payment_plan) / SUM(nf_live_calls) * 100`

Important exclusions:

- second-call closes excluded
- collections excluded
- organic excluded

BigQuery view formula:

- calculates first-call-only close rate after aggregation.

Format:

- one decimal percent in dashboard.

Thresholds:

- 0–10% red
- 10–30% amber
- 30–100% green

---

#### ARPU

Formula:

`ARPU = Total Cash / New Customers`

Where:

- Closer/SDR Total Cash = `SUM(total_revenue)`
- New Customers = FC + SC close types, excluding ECC.

Format:

- GBP, zero decimals.

---

#### Refunded Amount

Formula:

`Refunded Amount = SUM(refund_amount)`

Format:

- GBP, zero decimals.

---

#### Refund Rate

Formula:

`Refund Rate = SUM(refund_count) / SUM(new_customers) * 100`

Thresholds:

- 0–3% green
- 3–6% amber
- 6–15% red

---

#### Close Mix

Formula:

- Partial = `SUM(nf_partial + scc_partial)`
- Full Close = `SUM(nf_full_close + scc_full_close)`
- Deposit = `SUM(nf_deposit + scc_deposit)`
- Payment Plan = `SUM(nf_payment_plan + scc_payment_plan)`

Exclusion:

- ECC/collection close fields excluded.

---

### Business Performance KPI logic

Business Performance combines closer + SDR in specific ways.

#### Cash Collected

Formula:

`Cash Collected = SUM(closer.first_call_cash)`

Equivalent:

`SUM(closer.nf_revenue)`

Important:

- SDR first-call cash is excluded.
- Closer recovery cash is excluded.

---

#### Recovered Cash

Formula:

`Recovered Cash = SUM(closer.recovery_cash) + SUM(sdr.total_revenue)`

Where:

- closer recovery cash = `scc_revenue + ecc_revenue`
- SDR total cash = `total_revenue`

---

#### Total Cash

Formula:

`Total Cash = Cash Collected + Recovered Cash`

---

#### New Customers

Formula:

`New Customers = SUM(closer.new_customers) + SUM(sdr.new_customers)`

---

#### Refunds

Formula:

`Refunds = total_refund_count / total_refund_amount`

Where:

- total refund count = closer refund count + SDR refund count
- total refund amount = closer refund amount + SDR refund amount

Display format:

`{count} / £{amount}`

---

#### Net Cash

Formula:

`Net Cash = Total Cash - Refunded Amount`

---

#### Ad Spend

Formula:

`Ad Spend = SUM(ad_spend.ad_spend)` for selected date range.

---

#### Profit

Formula:

`Profit = Net Cash - Ad Spend`

---

#### ARPU

Formula:

`ARPU = Total Cash / New Customers`

---

#### Total Leads

Formula:

`Total Leads = SUM(ad_spend.leads)` for selected date range.

---

#### Core Funnel

All call/show/first-call-close funnel metrics are **closers only**.

- Leads = total ad leads
- Scheduled Calls = `SUM(closer.total_scheduled_calls)`
- Live Calls = `SUM(closer.total_live_calls)`
- First Call Close Customer = `SUM(closer.nf_full_close + closer.nf_partial + closer.nf_deposit + closer.nf_payment_plan)`
- Show Rate = `Live Calls / Scheduled Calls * 100`
- Close Rate = `First Call Close Customer / Live Calls * 100`

---

#### CPL

Formula:

`CPL = Total Ad Spend / Total Leads`

---

#### Cost Per Call

Formula:

`Cost Per Call = Total Ad Spend / Closer Scheduled Calls`

---

#### Cost Per Show

Formula:

`Cost Per Show = Total Ad Spend / Closer Live Calls`

---

#### CAC

Formula:

`CAC = Total Ad Spend / First Call Close Customers`

Important:

- First call close customers are closers only.

---

#### Blended CAC

Formula:

`Blended CAC = Total Ad Spend / Total New Customers`

Important source comment:

- The code says this is the old CAC renamed.
- Uses closer + SDR new customers.

---

#### ROAS

Formula:

`ROAS = Cash Collected / Total Ad Spend`

Important:

- Uses only Business Performance `Cash Collected`, which is closer first-call cash only.

---

#### Business Performance Deal Mix

Combined closer + SDR:

- Partial = closer NF+SCC partial + SDR NF+SCC partial
- Full = closer NF+SCC full + SDR NF+SCC full
- Deposit = closer NF+SCC deposit + SDR NF+SCC deposit
- Payment Plan = closer NF+SCC payment plan + SDR NF+SCC payment plan

---

#### Business Performance Refund Rate

Formula:

`Total Refund Rate = Total Refund Count / Total New Customers * 100`

Thresholds:

- 0–3% green
- 3–6% amber
- 6–15% red

---

## 5. Dashboard structure

### Tabs/views

Confirmed tabs:

1. Closer Dashboard
2. SDR Dashboard
3. Business Performance
4. Daily KPI Input
5. Ad Spend Input
6. Admin

### Access control / role behavior

Auth is HTTP Basic Auth using usernames/passwords loaded from BigQuery `users` table, falling back to default config values if BigQuery fails.

Role checks support comma-separated roles.

Role behavior:

- `admin`: sees/manages all dashboards and admin functions.
- `viewer`: sees dashboard/business views; no input/admin edit rights intended.
- `closer`: sees closer dashboard and daily KPI input, usually own data.
- `sdr`: sees SDR dashboard and daily KPI input, usually own data.
- `closer,sdr`: dual role support.

Data visibility helper functions:

- Admin/viewer sees all members.
- Closer/SDR users are generally constrained to their own `team_member` for input and performance.
- Closers can see SDR data for team visibility per `get_allowed_sdr_data()`.

### Tables/forms

Daily KPI Input:

- Date
- Team Member
- Role
- scheduled calls
- live calls
- first call close breakdown
- first call cash/potential
- second call close breakdown
- second call cash/potential
- collection cash
- refund customers
- refund amount
- total revenue/show/close derived displays
- KPI record history table
- edit/delete selected record functions

Ad Spend Input:

- date
- ad spend
- leads
- CPL display
- ad spend history table
- edit/delete functions

Admin:

- username
- password
- email
- display name
- team member
- role
- user history table
- soft delete function

### Charts/cards

Closer dashboard:

- First Call Cash
- Recovery Cash
- Total Cash Collected
- Potential Revenue
- Scheduled Calls
- Live Calls
- New Customer
- First Call Close Customer
- Customers Refunded
- Show Up Rate
- Close Rate
- ARPU
- Refunded Amount
- Revenue Trend
- Close Rate Gauge
- Show Up Rate Gauge
- Refund Rate Gauge
- Calls Performance
- Close Mix

SDR dashboard:

- Similar to closer dashboard, without First Call Close Customer card in the visible callback output.

Business Performance:

- Cash Collected
- Recovered Cash
- Total Cash
- New Customers
- Refunds
- Net Cash
- Ad Spend
- Profit
- ARPU
- Total Leads
- Funnel Chart
- CPL
- CAC
- Blended CAC
- Cost Per Call
- Cost Per Show
- ROAS
- Deal Mix
- Refund Rate Gauge

### Export/download functionality

No explicit export/download feature was found in the inspected source.

### Alerts / automated reporting

No automated email/Slack/reporting alerts were found in the inspected source. The source has Slack-era fields, but no active Slack connector/worker was confirmed in this app source.

---

## 6. Risks and unknowns

### Confirmed risks

1. Sensitive files/secrets in source bundle
   - The source bundle contains credential-related files and user credential examples.
   - These must not be copied into a new repo or shared.

2. Password storage
   - User passwords are loaded directly from BigQuery and passed to Basic Auth.
   - Passwords appear plaintext, not hashed.

3. SQL injection risk
   - Many BigQuery SQL strings interpolate user-controlled values directly using f-strings.
   - Inputs such as username, team member, dates, and IDs should be parameterized during migration.

4. Cloud Run is public at network layer
   - The service is deployed with `--allow-unauthenticated`.
   - Protection relies on app-level Basic Auth.

5. Source of truth split
   - Some formulas live in BigQuery view logic.
   - Some formulas live in Python post-processing/callbacks.
   - Migration must preserve both layers.

6. Dockerfile copies `credentials.json`
   - Production ideally should use service account identity/ADC without baking credentials into image.

7. Business Performance formulas are non-obvious
   - For example, `Cash Collected` means closer first-call cash only, not all cash.
   - `Recovered Cash` includes SDR total cash plus closer recovery cash.
   - `ROAS` uses closer first-call cash only.

8. Legacy/Slack fields remain
   - `slack_message_ts` still serves as record ID.
   - `raw_message` and Slack user fields remain in schema/view.

### Unknowns still requiring confirmation

- Exact current BigQuery table schemas as deployed, although view/migration scripts strongly document expected schemas.
- Whether any external Slack ingestion pipeline still writes to `kpi_records` outside this dashboard.
- Whether any scheduled jobs/backfills exist outside the dashboard source.
- Whether `revenue_by_source` is a table or view.
- Current Cloud Run revision/env var values beyond what source/deploy script reveals.
- Whether all tests currently pass in the deployed source environment.

---

## 7. Recommended migration plan

### Recommendation

Do **not** rewrite this from scratch by copying only the visible dashboard. The real KPI logic is in BigQuery + Python callbacks. The safe path is a parity migration.

### Phase 1 — freeze and backup

Before any build:

1. Export current source bundle.
2. Export BigQuery schemas for:
   - `kpi_records`
   - `daily_kpi_summary`
   - `revenue_by_source`
   - `ad_spend`
   - `users`
3. Export read-only sample data for representative date ranges.
4. Do not export or store plaintext passwords/secrets in the app repo.

### Phase 2 — create KPI formula registry

Create a formula registry in the new app that mirrors this report:

- closer KPIs
- SDR KPIs
- Business Performance KPIs
- date/team/role filters
- rounding/formatting
- threshold logic

Recommended file shape for merged app:

```text
lib/kpi/
  fields.ts
  formulas.ts
  business-performance.ts
  filters.ts
  formatting.ts
  thresholds.ts
  parity-tests.ts
```

### Phase 3 — preserve BigQuery first

Do not migrate data storage immediately unless necessary.

Recommended first merged version:

- New app reads from existing BigQuery tables/views.
- New app writes to the same BigQuery tables only after write parity is tested.
- Keep existing Cloud Run dashboard live as fallback.

### Phase 4 — build parity tests

For several date ranges and team filters, compare old dashboard vs new dashboard:

- Closer dashboard totals
- SDR dashboard totals
- Business Performance totals
- ad spend/CPL/CAC/ROAS
- refunds/refund rate
- potential revenue cross-day behavior

No launch until differences are explained and approved.

### Phase 5 — improve security during migration

During migration, fix security issues without changing business logic:

- replace plaintext passwords with hashed auth or Clerk/Supabase auth
- parameterize all BigQuery queries
- remove credential files from source/image
- use Google service account identity or secret manager
- implement role-based authorization centrally
- keep audit logs for edits/deletes

### Phase 6 — controlled cutover

1. Run old and new dashboards side-by-side.
2. Let team test input and dashboard readings.
3. Freeze old writes at cutover time.
4. Move writes to new app.
5. Keep old dashboard read-only for at least one reporting cycle.

---

## 8. Final conclusion

The KPI tracker is now sufficiently discovered for planning.

Confirmed architecture:

- Python Plotly Dash app
- Cloud Run service: `kpi-dashboard`
- Google Cloud project: `credit-club-tracking`
- BigQuery dataset: `kpi_tracking`
- Core data: `kpi_records`, `daily_kpi_summary`, `ad_spend`, `users`, `revenue_by_source`

The most important migration rule:

**Preserve the formula behavior exactly, especially Business Performance logic. The names are deceptively simple, but the calculations are role-specific and source-specific.**

No build has been performed. This report is discovery only.
