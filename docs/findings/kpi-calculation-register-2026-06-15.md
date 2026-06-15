# KPI Calculation Register — Old KPI Tracker

Status: **Audit/register only. No implementation. No production changes.**

Old dashboard: `https://kpi-dashboard-606295947266.us-central1.run.app/`

Project/service: `credit-club-tracking` / Cloud Run `kpi-dashboard` / region `us-central1`

Source inspected read-only from Cloud Run source bundle. Secret/credential values intentionally excluded.

## Source-location legend

- `database/kpi.py:15-132` — `load_daily_kpi_summary(...)`, reads `daily_kpi_summary`, derives row-level fields.
- `callbacks.py:413-488` — Closer dashboard callback aggregation/formatting.
- `callbacks.py:532-600` — SDR dashboard callback aggregation/formatting.
- `callbacks.py:641-777` — Business Performance callback aggregation/formatting.
- `database/ad_spend.py:15-43` — `load_ad_spend_data(...)`.
- `database/ad_spend.py:45-62` — `get_ad_spend_summary(...)`.
- `database/ad_spend.py:66-107` — ad spend insert/update CPL logic.
- `charts.py:130-184` — close-rate gauge.
- `charts.py:257-304` — show-rate gauge.
- `charts.py:306-359` — refund-rate gauge.
- `charts.py:361-399` — Business Performance funnel chart.
- `charts.py:401-471` — Business Performance deal-mix chart.
- `charts.py:473-543` — Closer/SDR close-mix chart.
- `docs/update_view.py:52-156` — BigQuery SQL for `daily_kpi_summary`.

## Global dashboard filter logic

- Date range: callbacks pass `start_date` and `end_date` to BigQuery query filters.
- Date WHERE clause: `kpi_date >= DATE('{start_date}')` and `kpi_date <= DATE('{end_date}')` in `database/kpi.py:60-64`.
- Team filter: if team member filter is not `All`, the query adds `team_member IN (...)` in `database/kpi.py:66-70`.
- Role filter: dashboard callbacks call `load_daily_kpi_summary(..., role='closer')` or `role='sdr'`; query adds `role = '{role}'` in `database/kpi.py:72-74`.
- Closer dashboard: `role='closer'`, source `daily_kpi_summary`, callback `callbacks.py:413-488`.
- SDR dashboard: `role='sdr'`, source `daily_kpi_summary`, callback `callbacks.py:532-600`.
- Business Performance: separately loads all closer rows and SDR rows, no member filter; callback `callbacks.py:641-777`.
- Formatting: dashboard cards generally use GBP zero decimals (`£{value:,.0f}`), integer counts (`{value:,}`), percentages one decimal (`{value:.1f}%`), ROAS two decimals (`{value:.2f}x`).

---

## KPI register

### 1. First Call Cash

- Appears: Closer Dashboard, SDR Dashboard, Business Performance input into Cash Collected.
- Business meaning: cash collected from first-call / new first-sale revenue.
- Data source: BigQuery view `kpi_tracking.daily_kpi_summary`.
- BigQuery fields: `nf_revenue`.
- Python source: `database/kpi.py:99`; dashboard sums in `callbacks.py:445` and `callbacks.py:560`; Business Performance uses closer rows in `callbacks.py:668`.
- Input fields: `nf_revenue` from raw `kpi_records`.
- Exact formula: `first_call_cash = nf_revenue`; dashboard aggregate `SUM(first_call_cash)`.
- Filters: date range, team member filter, role filter (`closer` or `sdr`).
- Date logic: inclusive start/end date on `kpi_date`.
- Role/team logic: Closer tab only closer rows; SDR tab only SDR rows; admin/viewer can view all selected team members; non-admin role visibility constrained by user profile.
- Target/benchmark: no hard target found.
- Threshold/gauge: none for card.
- Rounding/formatting: GBP, zero decimals.
- Edge cases: empty dataframe returns `£0`.
- Example old-dashboard output observed: Closer Dashboard `£9,400` for 2026-06-01 to 2026-06-15 with all visible members.
- Status: CONFIRMED.
- Still needed: sample parity outputs across more team/date combinations.

### 2. Recovery Cash

- Appears: Closer Dashboard, SDR Dashboard, Business Performance input into Recovered Cash.
- Business meaning: cash collected from second-call closes plus existing-customer/collection cash.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `scc_revenue`, `ecc_revenue`.
- Python source: `database/kpi.py:102`; dashboard sums in `callbacks.py:446` and `callbacks.py:561`; Business Performance uses closer recovery in `callbacks.py:670`.
- Input fields: `scc_revenue`, `ecc_revenue`.
- Exact formula: `recovery_cash = scc_revenue + ecc_revenue`; dashboard aggregate `SUM(recovery_cash)`.
- Filters/date/role: same as global dashboard filters.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: GBP zero decimals.
- Edge cases: empty data returns zero.
- Example old-dashboard output observed: `£27,800` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: parity outputs by team/member.

### 3. Total Cash Collected / Total Cash

- Appears: Closer Dashboard, SDR Dashboard, Business Performance.
- Business meaning: total gross cash/revenue before refund subtraction in Closer/SDR; Business Performance total combines special Cash Collected + Recovered Cash definitions.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `total_revenue`, plus `nf_revenue`, `scc_revenue`, `ecc_revenue`, `org_revenue` in view.
- Python source: Closer/SDR `callbacks.py:447`, `callbacks.py:562`; Business Performance `callbacks.py:682`.
- Exact formula, Closer/SDR: `total_cash = SUM(total_revenue)`.
- BigQuery view formula: `total_revenue = SUM(nf_revenue) + SUM(org_revenue) + SUM(ecc_revenue) + SUM(scc_revenue)` in `docs/update_view.py:99-103`.
- Exact formula, Business Performance: `total_cash = cash_collected + recovered_cash`, where cash_collected is closer first-call cash and recovered_cash is closer recovery + SDR total cash.
- Filters/date/role: Closer/SDR use role filters; Business Performance loads all closer and all SDR rows for date range.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: GBP zero decimals.
- Edge cases: refunds are not subtracted from Closer/SDR `Total Cash Collected`; net cash subtracts refunds only in Business Performance.
- Example old-dashboard output observed: `£37,200` for Closer Dashboard 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: confirm if business intentionally wants `org_revenue` included in Closer/SDR total cash while new_customers excludes organic closes.

### 4. Potential Revenue

- Appears: Closer Dashboard, SDR Dashboard.
- Business meaning: potential uncollected revenue net of collection cash already collected.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `nf_potential_revenue`, `scc_potential_revenue`, `ecc_revenue`, `total_potential_revenue`.
- Python source: `database/kpi.py:105-111`; Closer/SDR aggregate `callbacks.py:448`, `callbacks.py:563`.
- Exact formula: row-level Python `potential_revenue_calc = nf_potential_revenue + scc_potential_revenue - ecc_revenue`; dashboard aggregate `potential_revenue = max(0, SUM(potential_revenue_calc))`.
- BigQuery view formula: `GREATEST(0, SUM(nf_potential_revenue) + SUM(scc_potential_revenue) - SUM(ecc_revenue))` in `docs/update_view.py:105-111`.
- Filters/date/role: same as global.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: GBP zero decimals.
- Edge cases: Python intentionally allows negative per-row potential before final aggregate clamp, so cross-day collection can reduce total; final display cannot go below zero.
- Example old-dashboard output observed: `£48,300` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: parity tests across date ranges where ECC exceeds potential.

### 5. Scheduled Calls

- Appears: Closer Dashboard, SDR Dashboard, Business Performance funnel/cost-per-call.
- Business meaning: scheduled calls booked for sales.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `total_scheduled_calls`, `nf_scheduled_call`, `org_scheduled_call`.
- Python source: dashboard aggregate `callbacks.py:449`, `callbacks.py:564`; Business Performance closer-only `callbacks.py:700`.
- Exact formula: `scheduled_calls = SUM(total_scheduled_calls)`; BigQuery view `total_scheduled_calls = SUM(nf_scheduled_call) + SUM(org_scheduled_call)`.
- Filters/date/role: Closer/SDR role-specific; Business Performance funnel uses closer rows only.
- Target/benchmark: none found.
- Threshold/gauge: none directly; affects Show Up Rate and Cost Per Call.
- Rounding/formatting: integer count with commas.
- Edge cases: zero scheduled calls makes show-up rate zero.
- Example old-dashboard output observed: `192` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: confirm whether `org_scheduled_call` is still populated/used operationally.

### 6. Live Calls

- Appears: Closer Dashboard, SDR Dashboard, Business Performance funnel/cost-per-show/close rate denominator.
- Business meaning: calls that actually happened / shows.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `total_live_calls`, `nf_live_calls`, `org_live_calls`.
- Python source: `callbacks.py:450`, `callbacks.py:565`, Business Performance closer-only `callbacks.py:701`.
- Exact formula: `live_calls = SUM(total_live_calls)`; BigQuery view `total_live_calls = SUM(nf_live_calls) + SUM(org_live_calls)`.
- Role/team/date: same as global; Business Performance uses closer rows only for funnel.
- Target/benchmark: none found.
- Threshold/gauge: affects Show Up Rate and Close Rate.
- Rounding/formatting: integer count.
- Edge cases: zero live calls makes close rate zero.
- Example old-dashboard output observed: `126` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: confirm organic live calls usage.

### 7. New Customer

- Appears: Closer Dashboard, SDR Dashboard, Business Performance.
- Business meaning: newly closed customers from first-call and second-call closes, excluding collection/ECC.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `nf_full_close`, `nf_partial`, `nf_deposit`, `nf_payment_plan`, `scc_full_close`, `scc_partial`, `scc_deposit`, `scc_payment_plan`.
- Python source: `database/kpi.py:114-115`; aggregate `callbacks.py:451`, `callbacks.py:566`; Business Performance total `callbacks.py:677-679`.
- Exact formula: `new_customers = nf_full_close + nf_partial + nf_deposit + nf_payment_plan + scc_full_close + scc_partial + scc_deposit + scc_payment_plan`; dashboard aggregate `SUM(new_customers)`.
- Filters/date/role: same as global; Business Performance closer + SDR.
- Target/benchmark: none found.
- Threshold/gauge: denominator for ARPU, Refund Rate, Blended CAC.
- Rounding/formatting: integer count.
- Edge cases: ECC/collection closes explicitly excluded; organic closes not included in Python-derived new_customers.
- Example old-dashboard output observed: `28` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: business confirmation that excluding organic closes is still intended.

### 8. First Call Close Customer

- Appears: Closer Dashboard card; Business Performance funnel/CAC.
- Business meaning: customers closed on first call only.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `nf_full_close`, `nf_partial`, `nf_deposit`, `nf_payment_plan`.
- Python source: `callbacks.py:452-456`, `callbacks.py:702`; `charts.py:136-144` for gauge denominator logic.
- Exact formula: `first_call_close_customers = SUM(nf_full_close + nf_partial + nf_deposit + nf_payment_plan)`.
- Filters/date/role: Closer dashboard closer rows; Business Performance closer rows only.
- Target/benchmark: none found.
- Threshold/gauge: denominator for CAC; numerator for Close Rate.
- Rounding/formatting: integer count.
- Edge cases: excludes second-call closes and collections.
- Example old-dashboard output observed: `22` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: more sample outputs for parity.

### 9. Customers Refunded

- Appears: Closer Dashboard, SDR Dashboard, Business Performance refund display.
- Business meaning: count of customers refunded.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `refund_count`.
- Python source: `callbacks.py:457`, `callbacks.py:572`, Business Performance `callbacks.py:686-687`.
- Exact formula: `customers_refunded = SUM(refund_count)`.
- Filters/date/role: same as global; Business Performance closer + SDR.
- Target/benchmark: none found.
- Threshold/gauge: numerator for Refund Rate.
- Rounding/formatting: integer count.
- Edge cases: zero new customers makes refund rate zero.
- Example old-dashboard output observed: `0` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: parity with refund-containing date range.

### 10. Refunded Amount

- Appears: Closer Dashboard, SDR Dashboard, Business Performance refunds/net cash.
- Business meaning: GBP amount refunded.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `refund_amount`.
- Python source: `callbacks.py:458`, `callbacks.py:573`, Business Performance `callbacks.py:688`.
- Exact formula: `refunded_amount = SUM(refund_amount)`.
- Filters/date/role: same as global; Business Performance closer + SDR.
- Target/benchmark: none found.
- Threshold/gauge: affects Net Cash/Profit; refund-rate gauge uses count, not amount.
- Rounding/formatting: GBP zero decimals.
- Edge cases: Closer/SDR total cash does not subtract this; Business Performance net cash does.
- Example old-dashboard output observed: `£0` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: parity with refund-containing date range.

### 11. Show Up Rate

- Appears: Closer Dashboard card/gauge, SDR Dashboard card/gauge, Business Performance funnel.
- Business meaning: percentage of scheduled calls that became live calls/shows.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `total_live_calls`, `total_scheduled_calls`, `show_up_rate`.
- Python source: dashboard aggregate `callbacks.py:459`, `callbacks.py:574`; chart threshold `charts.py:257-304`; Business Performance `callbacks.py:704`.
- Exact dashboard formula: `show_up_rate = SUM(total_live_calls) / SUM(total_scheduled_calls) * 100` when scheduled > 0 else 0.
- BigQuery view formula: `ROUND((SUM(nf_live_calls)+SUM(org_live_calls))*100/(SUM(nf_scheduled_call)+SUM(org_scheduled_call)), 2)` when scheduled > 0 else 0.
- Filters/date/role: same as global; Business Performance uses closer rows only for funnel.
- Target/benchmark: no explicit target; gauge visual threshold.
- Threshold/gauge rules: red 0-40, amber 40-70, green 70-100 in `charts.py:283-289`.
- Rounding/formatting: one decimal percent.
- Edge cases: zero scheduled calls => 0.0%.
- Example old-dashboard output observed: `65.6%` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: no further formula access; parity samples only.

### 12. Close Rate

- Appears: Closer Dashboard card/gauge, SDR Dashboard card/gauge, Business Performance funnel.
- Business meaning: first-call close rate only; second-call closes do not affect this.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `nf_full_close`, `nf_partial`, `nf_deposit`, `nf_payment_plan`, `nf_live_calls`, `close_rate`.
- Python source: `database/kpi.py:116-119`; aggregate `callbacks.py:460`, `callbacks.py:575`; gauge `charts.py:130-184`; Business Performance `callbacks.py:705`.
- Exact dashboard formula: `(SUM(nf_full_close + nf_partial + nf_deposit + nf_payment_plan) / SUM(nf_live_calls)) * 100` when `SUM(nf_live_calls) > 0`, else 0.
- BigQuery view formula: same first-call-only close numerator divided by `SUM(nf_live_calls)`, rounded to 2 decimals, in `docs/update_view.py:139-149`.
- Filters/date/role: same as global; Business Performance closer rows only.
- Target/benchmark: no explicit target; gauge threshold.
- Threshold/gauge rules: red 0-10, amber 10-30, green 30-100 in `charts.py:168-174`.
- Rounding/formatting: one decimal percent in cards.
- Edge cases: zero first-call live calls => 0.0%; second-call closes excluded.
- Example old-dashboard output observed: `17.5%` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: parity samples only.

### 13. ARPU

- Appears: Closer Dashboard, SDR Dashboard, Business Performance.
- Business meaning: average revenue per new customer.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `total_revenue`, derived `new_customers`.
- Python source: `callbacks.py:462`, `callbacks.py:577`, Business Performance `callbacks.py:696`.
- Exact formula Closer/SDR: `ARPU = SUM(total_revenue) / SUM(new_customers)` if new customers > 0 else 0.
- Exact formula Business Performance: `ARPU = total_cash / total_new_customers` where total_cash = Business Performance cash collected + recovered cash.
- Filters/date/role: same as dashboard context.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: GBP zero decimals.
- Edge cases: zero new customers => `£0`.
- Example old-dashboard output observed: `£1,329` for 2026-06-01 to 2026-06-15.
- Status: CONFIRMED.
- Still needed: parity samples only.

### 14. Refund Rate

- Appears: Closer Dashboard gauge, SDR Dashboard gauge, Business Performance refund-rate gauge.
- Business meaning: customer refund count as percentage of new customers.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `refund_count`, derived `new_customers`.
- Python source: `database/kpi.py:120-121`; chart formula `charts.py:306-359`; Business Performance `callbacks.py:740-744`.
- Exact formula: `refund_rate = SUM(refund_count) / SUM(new_customers) * 100` if new customers > 0 else 0.
- Filters/date/role: same as dashboard context.
- Target/benchmark: lower is better; no hard target beyond gauge bands.
- Threshold/gauge rules: green 0-3, amber 3-6, red 6-15 in `charts.py:345-351`.
- Rounding/formatting: one decimal percent in gauge title/indicator.
- Edge cases: zero new customers => 0%; gauge max is 15.
- Example old-dashboard output observed: 0% for observed range because refunds/new customers = 0.
- Status: CONFIRMED.
- Still needed: parity with refund-containing date range.

### 15. Revenue Trend

- Appears: Closer Dashboard, SDR Dashboard chart.
- Business meaning: cash/revenue by day, split first-call vs recovery.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `kpi_date`, `first_call_cash`, `recovery_cash`, `total_revenue`.
- Python source: `charts.py:8-84`.
- Exact formula: group by `kpi_date`, sum `first_call_cash`, `recovery_cash`, `total_revenue`; chart plots daily revenue series.
- Filters/date/role: receives pre-filtered dataframe from callback.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: Plotly chart GBP values; title adapts selected member.
- Edge cases: empty dataframe renders empty chart.
- Example old-dashboard output: not captured numerically beyond card totals.
- Status: CONFIRMED for formula; UNCONFIRMED for exact displayed point examples.
- Still needed: screenshot/export or callback data for sample date points.

### 16. Calls Performance

- Appears: Closer Dashboard, SDR Dashboard chart.
- Business meaning: scheduled vs live calls by day/team.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `kpi_date`, `total_scheduled_calls`, `total_live_calls`.
- Python source: `charts.py:186-255`.
- Exact formula: group by `kpi_date`; sum scheduled/live; show comparison bars/lines.
- Filters/date/role: receives pre-filtered dataframe.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: integer counts.
- Edge cases: empty dataframe renders empty chart.
- Example old-dashboard output: not captured point-by-point.
- Status: CONFIRMED formula, sample points pending.
- Still needed: point-level parity samples.

### 17. Close Mix

- Appears: Closer Dashboard, SDR Dashboard chart.
- Business meaning: distribution of close types.
- Data source: `daily_kpi_summary`.
- BigQuery fields: `nf_partial`, `scc_partial`, `nf_full_close`, `scc_full_close`, `nf_deposit`, `scc_deposit`, `nf_payment_plan`, `scc_payment_plan`.
- Python source: `charts.py:473-543`.
- Exact formula: Partial = `SUM(nf_partial + scc_partial)`; Full Close = `SUM(nf_full_close + scc_full_close)`; Deposit = `SUM(nf_deposit + scc_deposit)`; Payment Plan = `SUM(nf_payment_plan + scc_payment_plan)`.
- Filters/date/role: receives pre-filtered dataframe.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: count pie/donut labels.
- Edge cases: zero values skipped/empty chart.
- Example old-dashboard output observed: Partial 18, Deposit 9, Payment Plan 1, total 28 for observed range; Full Close 0 in that sample.
- Status: CONFIRMED.
- Still needed: more date/team samples.

### 18. Business Performance — Cash Collected

- Appears: Business Performance card.
- Business meaning: closer first-call cash only.
- Data source: `daily_kpi_summary` closer rows.
- BigQuery fields: `nf_revenue` via `first_call_cash`.
- Python source: `callbacks.py:668`.
- Exact formula: `cash_collected = SUM(df_closer.first_call_cash)`.
- Filters/date/role: date range only; role fixed to closer; team member filter not applied.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: GBP zero decimals.
- Edge cases: SDR first-call cash excluded; closer recovery excluded.
- Example old-dashboard output: viewer role showed zeros previously; exact admin value for a sample range still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: read-only sample output from Business Performance with appropriate role/data visibility.

### 19. Business Performance — Recovered Cash

- Appears: Business Performance card.
- Business meaning: recovered revenue from closer recovery plus all SDR revenue.
- Data source: `daily_kpi_summary` closer and SDR rows.
- BigQuery fields: closer `recovery_cash`, SDR `total_revenue`.
- Python source: `callbacks.py:670-675`.
- Exact formula: `recovered_cash = SUM(df_closer.recovery_cash) + SUM(df_sdr.total_revenue)`.
- Filters/date/role: date range; closer and SDR role loads; no team filter.
- Target/benchmark: none found.
- Threshold/gauge: none.
- Rounding/formatting: GBP zero decimals.
- Edge cases: includes SDR total cash, not just SDR recovery.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: Business Performance sample outputs.

### 20. Business Performance — New Customers

- Appears: Business Performance card and denominators.
- Business meaning: total new customers across closers and SDRs.
- Data source: `daily_kpi_summary` closer and SDR rows.
- BigQuery fields: derived `new_customers`.
- Python source: `callbacks.py:677-679`.
- Exact formula: `total_new_customers = SUM(df_closer.new_customers) + SUM(df_sdr.new_customers)`.
- Filters/date/role: date range; closer + SDR roles.
- Formatting: integer.
- Edge cases: ECC excluded by underlying `new_customers` formula.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: Business Performance sample output.

### 21. Business Performance — Refunds

- Appears: Business Performance card.
- Business meaning: total refund count and total refund amount.
- Data source: `daily_kpi_summary` closer and SDR rows.
- BigQuery fields: `refund_count`, `refund_amount`.
- Python source: `callbacks.py:686-688`, output `callbacks.py:771`.
- Exact formula: `total_refund_count = closer_refund_count + sdr_refund_count`; `total_refund_amount = closer_refund_amount + sdr_refund_amount`; display `{count} / £{amount}`.
- Filters/date/role: date range; closer + SDR.
- Formatting: count plus GBP zero decimals.
- Edge cases: none beyond zero handling.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: Business Performance sample output.

### 22. Business Performance — Net Cash

- Appears: Business Performance card.
- Business meaning: total gross business cash minus refunded amount.
- Data source: `daily_kpi_summary` closer/SDR rows.
- Python source: `callbacks.py:691`.
- Exact formula: `net_cash = total_cash - total_refund_amount`.
- Filters/date/role: date range; closer + SDR.
- Formatting: GBP zero decimals.
- Edge cases: can be negative if refunds exceed cash.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: Business Performance sample output.

### 23. Business Performance — Ad Spend

- Appears: Business Performance card; marketing economics; Ad Spend Input tab.
- Business meaning: total advertising spend over date range.
- Data source: BigQuery table `kpi_tracking.ad_spend`.
- BigQuery fields: `ad_spend`, `date`.
- Python source: `database/ad_spend.py:45-62`, callback `callbacks.py:690`.
- Exact formula: `total_ad_spend = SUM(ad_spend)` for selected date range.
- Filters/date/role: date range inclusive on `date`; no team/role.
- Formatting: GBP zero decimals.
- Edge cases: no rows => 0.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: Business Performance/ad-spend sample rows.

### 24. Business Performance — Profit

- Appears: Business Performance card.
- Business meaning: estimated profit after ad spend.
- Data source: derived from Business Performance `net_cash` and ad spend.
- Python source: `callbacks.py:693-694`.
- Exact formula: `profit = net_cash - total_ad_spend`.
- Filters/date/role: inherits Business Performance filters.
- Formatting: GBP zero decimals.
- Edge cases: can be negative.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: sample output.

### 25. Business Performance — Total Leads

- Appears: Business Performance card/funnel.
- Business meaning: total marketing leads.
- Data source: `kpi_tracking.ad_spend`.
- BigQuery fields: `leads`.
- Python source: `database/ad_spend.py:45-62`, callback `callbacks.py:691-692`.
- Exact formula: `total_leads = SUM(leads)` for selected date range.
- Filters/date/role: date range; no team/role.
- Formatting: integer.
- Edge cases: no rows => 0.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: sample output.

### 26. Business Performance — CPL

- Appears: Business Performance metric and Ad Spend input preview.
- Business meaning: cost per lead.
- Data source: `ad_spend`.
- Python source: Business Performance `callbacks.py:710`; preview `callbacks.py:1113-1117`; insert/update `database/ad_spend.py:74`, `database/ad_spend.py:92`.
- Exact formula Business Performance: `CPL = total_ad_spend / total_leads` if leads > 0 else 0.
- Exact formula per ad-spend record: `cpl = ad_spend / max(leads, 1)`.
- Filters/date/role: date range; no team/role.
- Formatting: GBP zero decimals in Business Performance; GBP two decimals in input preview/table display.
- Edge cases: leads zero -> uses zero in BP, max(leads,1) in row save to prevent division by zero.
- Example old-dashboard output: callback preview test returned `£12.34` for ad spend 1234 and leads 100.
- Status: CONFIRMED.
- Still needed: BP sample output.

### 27. Business Performance — Cost Per Call

- Appears: Business Performance metric.
- Business meaning: ad spend per scheduled closer call.
- Data source: `ad_spend` + closer `daily_kpi_summary`.
- Python source: `callbacks.py:711`.
- Exact formula: `cost_per_call = total_ad_spend / scheduled_calls` if scheduled_calls > 0 else 0, where scheduled_calls is closer-only `SUM(total_scheduled_calls)`.
- Filters/date/role: date range; closer rows only for calls.
- Formatting: GBP zero decimals.
- Edge cases: zero scheduled calls -> 0.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: BP sample output.

### 28. Business Performance — Cost Per Show

- Appears: Business Performance metric.
- Business meaning: ad spend per live closer call/show.
- Data source: `ad_spend` + closer `daily_kpi_summary`.
- Python source: `callbacks.py:712`.
- Exact formula: `cost_per_show = total_ad_spend / live_calls` if live_calls > 0 else 0, where live_calls is closer-only `SUM(total_live_calls)`.
- Filters/date/role: date range; closer rows only for shows.
- Formatting: GBP zero decimals.
- Edge cases: zero live calls -> 0.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: BP sample output.

### 29. Business Performance — CAC

- Appears: Business Performance metric.
- Business meaning: ad spend per first-call close customer.
- Data source: ad spend + closer `daily_kpi_summary`.
- Python source: `callbacks.py:713-714`.
- Exact formula: `CAC = total_ad_spend / first_call_closes` if first_call_closes > 0 else 0.
- Filters/date/role: date range; first_call_closes from closer rows only.
- Formatting: GBP zero decimals.
- Edge cases: zero first-call closes -> 0.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: BP sample output.

### 30. Business Performance — Blended CAC

- Appears: Business Performance metric.
- Business meaning: ad spend per total new customer across closers and SDRs.
- Data source: ad spend + closer/SDR `daily_kpi_summary`.
- Python source: `callbacks.py:715-716`.
- Exact formula: `Blended CAC = total_ad_spend / total_new_customers` if total_new_customers > 0 else 0.
- Filters/date/role: date range; total_new_customers = closer + SDR.
- Formatting: GBP zero decimals.
- Edge cases: zero new customers -> 0.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: BP sample output.

### 31. Business Performance — ROAS

- Appears: Business Performance metric.
- Business meaning: return on ad spend based only on closer first-call cash.
- Data source: closer `daily_kpi_summary` + `ad_spend`.
- Python source: `callbacks.py:717`.
- Exact formula: `ROAS = cash_collected / total_ad_spend` if ad spend > 0 else 0, where cash_collected = closer first-call cash only.
- Filters/date/role: date range; closer rows only for numerator.
- Formatting: two decimals with `x`, e.g. `1.23x`.
- Edge cases: zero ad spend -> 0.00x.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.
- Still needed: BP sample output.

### 32. Business Performance — Core Funnel Chart

- Appears: Business Performance.
- Business meaning: lead-to-call-to-show-to-first-call-close funnel.
- Data source: `ad_spend` leads + closer `daily_kpi_summary`.
- Python source: `callbacks.py:699-707`, chart function `charts.py:361-399`.
- Exact formula inputs: Leads = total ad leads; Scheduled Calls = closer scheduled; Live Calls = closer live; First Call Close Customers = closer first-call closes; Show Rate = live/scheduled; Close Rate = first-call closes/live.
- Filters/date/role: date range; closer-only for sales funnel except leads.
- Formatting: horizontal funnel chart; title includes show/close rate one decimal.
- Edge cases: zero denominators -> zero rates.
- Example old-dashboard output: exact sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.

### 33. Business Performance — Deal Mix

- Appears: Business Performance.
- Business meaning: combined closer + SDR close-type distribution.
- Data source: closer and SDR `daily_kpi_summary`.
- Python source: `callbacks.py:720-737`, chart `charts.py:401-471`.
- Exact formula: Partial = closer+SDR `nf_partial + scc_partial`; Full = closer+SDR `nf_full_close + scc_full_close`; Deposit = closer+SDR `nf_deposit + scc_deposit`; Payment Plan = closer+SDR `nf_payment_plan + scc_payment_plan`.
- Filters/date/role: date range; closer + SDR.
- Formatting: pie chart; ARPU included in title.
- Edge cases: zero totals render empty/zero chart.
- Example old-dashboard output: exact BP sample still needed.
- Status: CONFIRMED formula; sample output UNCONFIRMED.

### 34. KPI Input — Total Revenue Auto Calculation

- Appears: Daily KPI Input form.
- Business meaning: form-side total cash/revenue after refund for entered day.
- Data source: form inputs before BigQuery insert.
- Python source: `callbacks.py:232-241`; form payload `callbacks.py:296-327`.
- Input fields: first-call cash, second-call cash, collection cash, refund amount.
- Exact formula: `total_revenue = fc_cash + scc_cash + ecc_cash - refund_amount` in form preview.
- Filters/date/role: not filter-based; tied to form-selected date/team/role.
- Formatting: numeric rounded to 2 decimals in hidden/store/preview callback.
- Edge cases: missing values treated as 0.
- Example old-dashboard output: callback test 1000 + 500 + 200 - 100 = 1600.
- Status: CONFIRMED.
- Still needed: confirm whether preview total exactly matches inserted `nf_revenue/scc_revenue/ecc_revenue/refund_amount` semantics in every UI case.

### 35. KPI Input — Form Show Up Rate Preview

- Appears: Daily KPI Input form.
- Formula: `live_calls / scheduled_calls * 100` if scheduled > 0 else 0.
- Python source: `callbacks.py:237-241`.
- Formatting: rounded one decimal.
- Example old-dashboard output: callback test 8/10 = 80.0.
- Status: CONFIRMED.

### 36. KPI Input — Form Close Rate Preview

- Appears: Daily KPI Input form.
- Formula: `(fc_full_close + fc_payment_plan + fc_partial + fc_deposit) / live_calls * 100` if live > 0 else 0.
- Python source: `callbacks.py:238-241`.
- Formatting: rounded one decimal.
- Example old-dashboard output: callback test 10 closes / 8 live = 125.0.
- Status: CONFIRMED.
