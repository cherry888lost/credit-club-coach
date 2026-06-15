# KPI Tracker Parity Test Plan

Status: **Test plan only. No build. No production changes.**

Goal: prove the merged dashboard reproduces old KPI tracker outputs exactly for the same date range, role, team/member filters, and data source.

## General pass/fail rules

- Counts: exact match required.
- GBP cards: exact underlying numeric match required; displayed value must match after old rounding/formatting.
- Percentages: underlying value tolerance <= 0.01 percentage points; displayed one-decimal value must match.
- ROAS: underlying tolerance <= 0.005; displayed two-decimal `x` value must match.
- Charts: aggregated data series points must match by date/category before visual comparison.
- Any mismatch: do not launch. Triage as one of: formula bug, filter/date bug, role/team mapping bug, source-data mismatch, approved intentional change.

## Test fixtures/date ranges

Use at least these approved ranges after read-only sample access is granted:

1. Recent full operating range: `2026-06-01` to `2026-06-15`, all members.
2. Default old dashboard range: `2026-06-08` to `2026-06-29`, all members.
3. Single team member with data: choose from old dropdown, e.g. `Papur` or active closer with data.
4. Refund-containing range: find a date range where `refund_count > 0` or `refund_amount > 0`.
5. Ad-spend-containing range: date range where `ad_spend` and `leads` exist.
6. Edge range with zero denominators if present: scheduled/live/new customers/ad spend zero.

## Required old-dashboard capture method

For each fixture:

- Capture old dashboard card outputs.
- Capture old dashboard chart data if accessible via Dash callback/JSON or manually record points.
- Capture filters: start date, end date, team filter, active tab, role.
- Store captured values as read-only parity fixture; do not store credentials.

## Test cases

### Closer Dashboard tests

1. `closer_first_call_cash_all_members`
- Old source: Closer Dashboard First Call Cash card.
- New source: `lib/kpis/calculations.ts:firstCallCash(rows)`.
- Person/team/role: role `closer`, team `All`.
- Date: fixture ranges 1 and 2.
- Expected: old card value.
- Tolerance: GBP exact after rounding.
- If mismatch: check `nf_revenue`, role filter, date inclusivity.

2. `closer_recovery_cash_all_members`
- Formula: `SUM(scc_revenue + ecc_revenue)`.
- Pass: exact GBP.
- If mismatch: check SCC/ECC mapping and role filter.

3. `closer_total_cash_all_members`
- Formula: `SUM(total_revenue)`.
- Pass: exact GBP.
- If mismatch: check whether `org_revenue` is included via view.

4. `closer_potential_revenue_all_members`
- Formula: `max(0, SUM(nf_potential_revenue + scc_potential_revenue - ecc_revenue))`.
- Pass: exact GBP.
- If mismatch: check clamp timing and cross-day ECC behavior.

5. `closer_scheduled_calls_all_members`
- Formula: `SUM(total_scheduled_calls)`.
- Pass: exact count.

6. `closer_live_calls_all_members`
- Formula: `SUM(total_live_calls)`.
- Pass: exact count.

7. `closer_new_customers_all_members`
- Formula: NF + SCC close types only.
- Pass: exact count.
- If mismatch: check ECC/ORG exclusion.

8. `closer_first_call_close_customers_all_members`
- Formula: NF close types only.
- Pass: exact count.

9. `closer_customers_refunded_all_members`
- Formula: `SUM(refund_count)`.
- Pass: exact count.

10. `closer_show_up_rate_all_members`
- Formula: `SUM(total_live_calls)/SUM(total_scheduled_calls)*100`.
- Pass: displayed one decimal and underlying tolerance <=0.01.

11. `closer_close_rate_all_members`
- Formula: `SUM(NF close types)/SUM(nf_live_calls)*100`.
- Pass: displayed one decimal and underlying tolerance <=0.01.

12. `closer_arpu_all_members`
- Formula: `SUM(total_revenue)/SUM(new_customers)`.
- Pass: GBP rounded display exact.

13. `closer_refunded_amount_all_members`
- Formula: `SUM(refund_amount)`.
- Pass: exact GBP.

14. `closer_refund_rate_gauge`
- Formula: `SUM(refund_count)/SUM(new_customers)*100`.
- Pass: value and color band match.

15. `closer_close_mix_chart`
- Formula: Partial/Full/Deposit/Payment Plan = NF+SCC close types.
- Pass: category counts match exactly.

16. `closer_revenue_trend_chart`
- Formula: group by date, sum first_call_cash/recovery_cash/total_revenue.
- Pass: every date point/category matches.

17. `closer_calls_performance_chart`
- Formula: group by date, scheduled/live.
- Pass: every date point matches.

Repeat tests 1-17 for a selected individual closer/team member.

### SDR Dashboard tests

18. `sdr_first_call_cash_all_members`
- Same formula as closer but role `sdr`.
- Pass: exact GBP.

19. `sdr_recovery_cash_all_members`
- `SUM(scc_revenue + ecc_revenue)`, role `sdr`.

20. `sdr_total_cash_all_members`
- `SUM(total_revenue)`, role `sdr`.

21. `sdr_potential_revenue_all_members`
- `max(0, SUM(nf_potential_revenue + scc_potential_revenue - ecc_revenue))`, role `sdr`.

22. `sdr_scheduled_calls_all_members`
- `SUM(total_scheduled_calls)`, role `sdr`.

23. `sdr_live_calls_all_members`
- `SUM(total_live_calls)`, role `sdr`.

24. `sdr_new_customers_all_members`
- NF + SCC close types, role `sdr`.

25. `sdr_customers_refunded_all_members`
- `SUM(refund_count)`, role `sdr`.

26. `sdr_show_up_rate_all_members`
- `live/scheduled`, role `sdr`.

27. `sdr_close_rate_all_members`
- first-call closes / `nf_live_calls`, role `sdr`.

28. `sdr_arpu_all_members`
- `SUM(total_revenue)/SUM(new_customers)`, role `sdr`.

29. `sdr_refunded_amount_all_members`
- `SUM(refund_amount)`, role `sdr`.

30. `sdr_charts_all_members`
- revenue trend, calls performance, close mix, gauges match.

Repeat for selected SDR member if data exists.

### Business Performance tests

31. `bp_cash_collected`
- Old source: Business Performance Cash Collected card.
- New formula: closer `SUM(first_call_cash)` only.
- Role/team: closer rows only; no team filter.
- Pass: exact GBP.

32. `bp_recovered_cash`
- Formula: closer `SUM(recovery_cash)` + SDR `SUM(total_revenue)`.
- Pass: exact GBP.

33. `bp_total_cash`
- Formula: Cash Collected + Recovered Cash.
- Pass: exact GBP.

34. `bp_new_customers`
- Formula: closer new customers + SDR new customers.
- Pass: exact count.

35. `bp_refunds`
- Formula: closer+SDR refund count / closer+SDR refund amount.
- Pass: count and GBP display exact.

36. `bp_net_cash`
- Formula: Total Cash - refund amount.
- Pass: exact GBP.

37. `bp_ad_spend`
- Formula: `SUM(ad_spend)` for date range.
- Pass: exact GBP.

38. `bp_profit`
- Formula: Net Cash - Ad Spend.
- Pass: exact GBP.

39. `bp_arpu`
- Formula: Total Cash / total new customers.
- Pass: rounded GBP exact.

40. `bp_total_leads`
- Formula: `SUM(leads)`.
- Pass: exact count.

41. `bp_cpl`
- Formula: Total Ad Spend / Total Leads.
- Pass: GBP rounded display exact; zero leads -> £0.

42. `bp_cost_per_call`
- Formula: Total Ad Spend / closer scheduled calls.
- Pass: GBP rounded display exact.

43. `bp_cost_per_show`
- Formula: Total Ad Spend / closer live calls.
- Pass: GBP rounded display exact.

44. `bp_cac`
- Formula: Total Ad Spend / closer first-call close customers.
- Pass: GBP rounded display exact.

45. `bp_blended_cac`
- Formula: Total Ad Spend / total new customers.
- Pass: GBP rounded display exact.

46. `bp_roas`
- Formula: Cash Collected / Total Ad Spend.
- Pass: displayed two decimals exact.

47. `bp_funnel_chart`
- Formula: leads, closer scheduled, closer live, closer first-call closes; show/close rates.
- Pass: all stages and rates match.

48. `bp_deal_mix_chart`
- Formula: closer+SDR NF+SCC close types by category.
- Pass: category counts match.

49. `bp_refund_rate_gauge`
- Formula: total refund count / total new customers.
- Pass: value and color band match.

### Input/admin workflow parity tests — later only after write approval

50. `kpi_input_preview_total_revenue`
- Formula: FC cash + SCC cash + ECC cash - refund amount.
- Pass: exact numeric preview.

51. `kpi_input_preview_show_up_rate`
- Formula: live/scheduled.
- Pass: one decimal exact.

52. `kpi_input_preview_close_rate`
- Formula: first-call close types/live.
- Pass: one decimal exact.

53. `ad_spend_preview_cpl`
- Formula: ad_spend / max(leads,1).
- Pass: two decimals exact.

54. `role_visibility_mapping`
- Old source: old app role behavior.
- New source: new auth/role mapping.
- Pass: admin/viewer/closer/sdr visibility matches approved mapping.

55. `team_member_mapping`
- Old source: `users.team_member` and dashboard dropdown.
- New source: mapping table/config.
- Pass: every active old team member maps or is explicitly marked legacy/inactive.

## Launch blockers

Do not launch until:

- formula parity confirmed
- user-role mapping confirmed
- team input workflow confirmed if writes are included
- admin functions confirmed if admin is included
- historical data connected/migrated safely
- all differences fixed or explicitly approved by Arshid
