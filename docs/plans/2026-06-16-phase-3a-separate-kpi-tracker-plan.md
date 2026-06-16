# Phase 3A — Separate KPI Tracker Redesign and Input Workflow Plan

Status: Planning only. No build approved.
Date: 2026-06-16

## Boundaries

This proposal does not approve or perform any of the following:

- replacing the existing Sales Tracker,
- making `/dashboard/merged-preview` the main direction,
- making any KPI route the default route,
- adding KPI Tracker to normal navigation for everyone,
- production launch,
- admin input migration,
- BigQuery writes,
- BigQuery table/view/schema edits,
- Cloud Run changes,
- IAM changes,
- old KPI tracker cleanup/removal,
- formula changes,
- sales scoring changes.

The old KPI tracker remains the source of truth until explicit future approval.

## SECTION 1 — UAT feedback acknowledgement

Manager UAT changed the product direction:

- The merged dashboard does not visually match or feel like the existing Sales Tracker.
- The merged dashboard is not approved as the final UX/product direction.
- The current merged beta is missing the KPI input workflow needed by closers/team members/admins.
- The Sales Tracker should remain separate and unchanged.
- It is acceptable, and now preferred, for the Sales Tracker and KPI Tracker to remain separate.
- The old KPI tracker remains the source of truth during planning, redesign, parity, and any future transition.
- Current `/dashboard/merged-preview` work should be treated as a technical prototype only: useful for calculations, formatting, read-only BigQuery patterns, feature-flag guardrails, and parity work, but not the approved final UX direction.

## SECTION 2 — Recommended product direction

### Option A — Separate KPI Tracker, visually aligned with Sales Tracker

- Keep Sales Tracker unchanged at `/dashboard`.
- Build a separate KPI Tracker route/app section.
- Use the same visual language and components as the current Sales Tracker.
- Preserve existing KPI calculations and BigQuery logic.
- Keep read-only mode first.
- Add proper input workflow only after separate approval.
- Keep old KPI tracker as source of truth until parity and input workflow are approved.

Pros:

- Matches the new UAT direction.
- Reduces risk of damaging the Sales Tracker.
- Lets KPI work progress without forcing one large dashboard.
- Allows a dedicated KPI input workflow instead of squeezing it into Sales Tracker UX.
- Gives managers a clearer mental model: Sales Tracker = call scoring; KPI Tracker = daily KPI reporting.

Cons:

- Requires separate route/navigation decision later.
- Some shared user/team/role mapping still needs careful integration.
- Full value comes only after input workflow is solved.

### Option B — Light connection only

- Keep Sales Tracker and KPI Tracker separate.
- Later add only a link/card/navigation item if approved.
- No forced combined dashboard.

Pros:

- Lowest UX disruption.
- Keeps the current Sales Tracker exactly as users know it.
- Still lets users discover the KPI Tracker later.

Cons:

- Does not by itself solve KPI input workflow or parity.
- Navigation/link placement needs approval.

### Option C — Continue merged dashboard

- Continue improving `/dashboard/merged-preview` into a combined Sales + KPI view.

Why this is not recommended:

- UAT explicitly rejected the merged dashboard feel/direction.
- It risks turning the Sales Tracker into a crowded multi-purpose dashboard.
- It still does not solve closer/team member KPI input workflow.
- It increases launch/cutover risk because it touches perception of the existing Sales Tracker.

### Recommendation

Recommend **Option A** as the main direction, with Option B as a later optional connection.

Do not continue Option C unless Arshid approves a revised merged-dashboard product plan.

## SECTION 3 — Existing Sales Tracker visual audit

Inspected source:

- `app/dashboard/page.tsx`
- `app/dashboard/_components/DashboardShell.tsx`
- `app/dashboard/reps/page.tsx`
- `app/dashboard/calls/page.tsx`
- `app/dashboard/calls/_components/FilterBar.tsx`
- `app/dashboard/calls/_components/CallsList.tsx`
- `app/dashboard/_components/SalesIntelligenceCharts.tsx`

### Layout structure

- Shell uses a fixed left sidebar on desktop and slide-out mobile sidebar.
- Main area uses `lg:pl-64` and page padding `p-4 sm:p-6 lg:p-8`.
- App background uses `bg-zinc-50 dark:bg-zinc-950`.
- Header is sticky, translucent, and blurred: `sticky top-0`, `bg-white/80 dark:bg-zinc-900/80`, `backdrop-blur-xl`, bottom border.
- Pages use vertical spacing like `space-y-5`, `space-y-6`, or `space-y-8`.
- Overview uses a top header row, KPI grid, weekly “At a Glance” section, chart section, and recent scored calls list.

### Card styles

Common card style:

```text
bg-white dark:bg-zinc-900
rounded-xl
border border-zinc-200 dark:border-zinc-800
shadow-sm
hover:shadow-md transition-shadow
p-5
```

Rep cards add:

```text
transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50
```

Important: the KPI Tracker should reuse this card density and subtle styling, not the heavier merged-preview prototype styling.

### Spacing

- Page-level spacing: `space-y-6` / `space-y-8`.
- Card grids: `gap-4`.
- Card internal spacing: `p-5`, headings `mb-2`, `mb-3`, `mb-4`.
- Team list rows use `gap-4`, `space-y-3`.

### Typography

- Page title: `text-2xl font-bold text-zinc-900 dark:text-white`.
- Page subtitle: `text-sm text-zinc-500/600 dark:text-zinc-400`.
- Section heading: `text-sm font-semibold text-zinc-900 dark:text-white mb-4`.
- Card eyebrow labels: `text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400`.
- Primary metric values: `text-3xl font-bold`.
- Supporting text: `text-sm text-zinc-600 dark:text-zinc-400`.

### Colours/classes used

- Neutral base: `zinc` scale.
- Primary accent: `indigo`.
- Positive: `green`.
- Warning/attention: `amber`.
- Negative/error: `red`.
- Role badges: closer blue, SDR purple, admin indigo.
- The system supports dark mode via paired `dark:` classes.

### Filters

Sales Tracker calls page uses URL search params and compact filters:

- `rep`
- `role`
- `status`
- `outcome`
- `date`
- `sort`

Non-admin rep filtering is enforced server-side; URL tampering is ignored for non-admins.

KPI Tracker should follow the same principle: filters can be URL-backed, but role/team/member access must be enforced server-side.

### Tables/lists

- Sales Tracker prefers card/list rows rather than dense data tables.
- Recent scored calls use a rounded container with row dividers and link rows.
- Team Performance uses large list cards with compact stat cells.
- Empty states use centered cards with icon, title, and explanatory text.

### Scorecards

- Scorecards are simple cards with icon + uppercase label + large number + optional subtext.
- Metrics use conditional colour only where meaningful.
- Current scorecards are not overly decorative.

### Buttons/navigation

- Sidebar nav item active state: `bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400`.
- Inactive nav: zinc text with hover background.
- Inline text links use indigo with hover.
- Header/action links are lightweight, not large primary CTAs.

### Empty states

Examples:

- “No team members found” card.
- “No objections recorded this week”.
- Metric placeholder uses `—` in muted zinc.
- Missing ranking states explain requirements, e.g. “Need at least 3 scored calls to rank”.

KPI Tracker should have clear empty states for:

- no KPI records for filter/date,
- no ad spend for range,
- no team member selected,
- parity not confirmed,
- input workflow not enabled.

### Loading states

Current inspected dashboard pages are mostly server-rendered and do not show rich skeleton states in inspected files. Future KPI Tracker can either preserve server-render style or add lightweight skeletons matching the card style if client-side fetching is introduced.

### Mobile behaviour

- Sidebar becomes overlay on mobile.
- Main shell padding reduces on small screens.
- Rep cards shift from row layout to stacked: `flex-col sm:flex-row`.
- KPI grids use `grid-cols-2` on small screens and expand on large screens.

KPI Tracker mobile design should follow these breakpoints and avoid wide tables as primary UI.

### Component files to reuse conceptually

- `DashboardShell.tsx` for global dashboard layout.
- Card patterns from `app/dashboard/page.tsx`.
- List/card patterns from `app/dashboard/reps/page.tsx`.
- Filter conventions from `app/dashboard/calls/page.tsx` and calls components.
- Chart container style from `SalesIntelligenceCharts.tsx`, but avoid copying broken chart sizing behavior without testing.

Do not change the Sales Tracker.

## SECTION 4 — KPI Tracker visual redesign plan

### Recommended route

Recommend:

```text
/dashboard/kpi-tracker
```

Reasoning:

- Clearer than `/dashboard/kpis` for non-technical users.
- Does not collide semantically with `/dashboard/kpis-preview`, which was a temporary/internal preview route.
- Makes the separation obvious: Sales Tracker remains `/dashboard`; KPI Tracker becomes a sibling route.

Alternative acceptable route:

```text
/dashboard/kpis
```

Do not replace `/dashboard` and do not make the KPI Tracker default.

### Proposed standalone KPI Tracker structure

1. KPI Tracker Overview
   - read-only transition warning,
   - date range filter,
   - role/team/member filters,
   - top KPI cards,
   - closer/SDR/business summary cards,
   - parity status badges.

2. Closer Dashboard
   - first-call cash,
   - recovery cash,
   - total cash,
   - potential revenue,
   - scheduled calls,
   - live calls,
   - show-up rate,
   - close rate,
   - new customers,
   - refunds/refund rate,
   - close mix.

3. SDR Dashboard
   - same preserved KPI logic scoped to SDR role,
   - SDR-specific member/team filters,
   - pending parity labels until confirmed.

4. Business Performance Dashboard
   - cash collected,
   - recovered cash,
   - total/net cash,
   - ad spend,
   - leads,
   - CPL,
   - cost per call/show,
   - CAC,
   - blended CAC,
   - ROAS,
   - profit,
   - refund metrics,
   - pending parity labels until confirmed.

5. KPI Input area — planned but not enabled in first read-only build
   - visible “Input workflow not migrated yet” state,
   - optional design prototype later using mock/local state only,
   - no BigQuery writes until approved.

### Visual design requirements

- Use `DashboardShell` layout.
- Use Sales Tracker card style and spacing.
- Use subtle indigo accent, not a new visual language.
- Use neutral zinc backgrounds and borders.
- Use clear badges: `Read-only`, `Pending parity`, `Source of truth: old KPI tracker`.
- Prefer compact metric cards and list sections over a giant merged dashboard.
- Keep charts secondary and useful, not decorative.

## SECTION 5 — Closer KPI input workflow audit

Sources inspected:

- `docs/findings/kpi-tracker-audit-2026-06-15.md`
- `docs/findings/source-logic-register-2026-06-15.md`
- `docs/findings/bigquery-logic-register-2026-06-15.md`

This is source/documentation-based audit only. No old dashboard writes were tested.

### Who can input KPI data

Confirmed conceptually:

- Old app has a `Daily KPI Input` tab.
- Tab visibility/input access is role-based through `auth.py` and `assets/callbacks.js`.
- Users are mapped through `kpi_tracking.users` with `username`, `team_member`, `role`, and `is_active`.
- Admin/viewer can see all team members; non-admin roles are tied to their own `team_member`.

Still needs final confirmation in a future read-only/source review:

- exact role combinations allowed to submit vs only view,
- whether closers can submit only closer rows,
- whether SDRs can submit only SDR rows,
- whether managers/admins can submit on behalf of others.

### Whether closers/SDRs/admins input data

Confirmed:

- The old app supports manual daily KPI entries.
- Roles include closer and SDR.
- `get_allowed_team_members()`, `get_sdr_members()`, `get_closer_members()`, and role helpers determine visibility/scope.
- Daily KPI rows include `role`, so both closer and SDR KPI entries can exist.

Likely but should be verified before implementing writes:

- Closers/team members input their own daily KPI data.
- Admins/managers can view or manage broader data.
- SDR rows use same core `kpi_records` table with role-specific filtering.

### Fields entered

Raw table/input-related fields from `kpi_records`:

- `team_member`
- `role`
- `kpi_date`
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

Legacy/view fields also exist:

- `slack_user_id`
- `user_real_name`
- `user_email`
- `user_title`
- `user_phone`
- `org_scheduled_call`
- `org_live_calls`
- `org_deposit`
- `org_partial`
- `org_payment_plan`
- `org_full_close`
- `org_potential_revenue`
- `ecc_full_close`
- `ecc_partial`
- `ecc_deposit`
- `ecc_payment_plan`

### Fields calculated

Preview/form calculations documented in `callbacks.py` audit:

- `total_revenue = fc_cash + scc_cash + ecc_cash - refund_amount`
- `show_up = live / scheduled * 100`
- `close_rate = first_call_closes / live * 100`

BigQuery/Python calculated fields include:

- `total_scheduled_calls`
- `total_live_calls`
- `total_full_closes`
- `total_revenue`
- `total_potential_revenue`
- `show_up_rate`
- `close_rate`
- `first_call_cash = nf_revenue`
- `recovery_cash = scc_revenue + ecc_revenue`
- `potential_revenue_calc = nf_potential_revenue + scc_potential_revenue - ecc_revenue`
- `new_customers = NF close types + SCC close types`
- `refund_rate = refund_count / new_customers * 100`

### Required/optional fields

Confirmed from source docs:

- `kpi_date`, `team_member`, `role`, and submitted numeric KPI fields are necessary to create meaningful records.

Needs confirmation before implementation:

- which numeric fields are required vs defaulted to zero,
- whether `org_*` and `ecc_*` close-type fields are exposed in current input UI,
- whether refunds are optional,
- whether potential revenue is required or derived.

### Validation

Confirmed:

- `assets/callbacks.js` includes client-side input filtering/numeric constraints conceptually.
- Preview calculations protect division by zero in documented formulas.

Needs confirmation:

- exact min/max numeric constraints,
- whether negative revenue/refund values are allowed,
- duplicate date/member/role prevention behavior,
- required date range restrictions.

### Where input data is saved

Confirmed:

- Daily KPI inputs write to `kpi_tracking.kpi_records` via `insert_daily_kpi(kpi_data)`.
- Ad spend inputs write to `kpi_tracking.ad_spend` via `insert_ad_spend(date, ad_spend, leads)`.
- User/admin edits write to `kpi_tracking.users` and can update `kpi_records` during name/role migrations.

### Whether `kpi_records` is the write target

Confirmed: yes, `kpi_records` is the old daily KPI write target.

### Whether `ad_spend` has separate input workflow

Confirmed: yes. Old app has `Ad Spend Input` tab and `database/ad_spend.py` insert/update/delete functions.

### Whether users/team members are editable

Confirmed: yes. Old app has Admin user management. `database/users.py` supports insert/update/soft-delete and role/name migrations.

### Whether Slack fields are involved

Confirmed:

- Legacy Slack fields remain in table/view.
- `slack_message_ts` is still used as unique record ID.
- Manual records use generated IDs beginning with `manual_...`.

### Whether records can be edited/deleted

Confirmed:

- KPI records can be inserted, updated, and hard-deleted by `slack_message_ts`.
- Ad spend records can be inserted, updated, and deleted by `id`.
- Users are soft-deleted via `is_active = FALSE`.

### Whether historical records mutate when names/roles change

Confirmed risk:

- `migrate_kpi_records_for_role_change(...)` updates historical KPI record roles.
- `migrate_kpi_records_for_name_change(...)` updates historical KPI records when team member names change.

This should not be copied blindly.

### Approval/review steps

Not confirmed in old source docs. No explicit approval workflow was found in audit docs.

### Whether input affects dashboards immediately

Confirmed:

- `daily_kpi_summary` is a live BigQuery view over `kpi_records`.
- Changes appear on next query/callback.
- `ad_spend` updates appear on next Business Performance callback.

### Input workflow security risks

- Plaintext passwords in `users`.
- Basic Auth pattern.
- Direct SQL string interpolation.
- Hard deletes for KPI/ad spend records.
- Slack timestamp/manual string ID as record identity.
- Historical mutation when names/roles change.
- No explicit audit log beyond timestamps.
- Potentially broad write permissions in old Cloud Run service account.

## SECTION 6 — New KPI input workflow proposal

### Principles

- Do not copy the old write workflow directly.
- Separate input permissions from dashboard viewing permissions.
- Preserve formulas in code-owned calculation modules, not editable user inputs.
- Prefer append-only/correction model over hard deletes.
- Keep old tracker as source of truth until new input workflow is approved and tested.

### Proposed permissions

Closer/team member:

- Can create their own daily KPI entry for their mapped team member and role.
- Can edit/correct their own recent entries within an approved correction window, if allowed.
- Cannot edit formulas, other users, ad spend, or user mappings.

SDR:

- Same as closer, scoped to own SDR role/team member if SDR input remains part of KPI process.

Manager/admin:

- Can view all team members.
- Can submit/edit on behalf of users only if approved.
- Can review/approve corrections if approval workflow is adopted.
- Can manage ad spend if approved.
- Should not manage passwords in KPI tables.

System/admin developer:

- Can manage schema only through explicit migration approvals, not ad hoc dashboard actions.

### Proposed input fields

For closer/SDR daily KPI entry:

- Date.
- Role.
- Team member derived from authenticated user mapping; admin override only if approved.
- NF scheduled calls.
- NF live calls.
- NF full close.
- NF partial.
- NF deposit.
- NF payment plan.
- NF revenue.
- NF potential revenue.
- SCC close counts and revenue/potential revenue, if business still uses SCC.
- ECC revenue, if business still uses recovery cash.
- Refund count.
- Refund amount.
- Optional notes/correction reason for edits.

For manager/admin ad spend entry:

- Date.
- Ad spend.
- Leads.
- Optional source/campaign later only if approved.
- Notes/correction reason.

### Required fields

Minimum required:

- date,
- authenticated user/team member mapping,
- role,
- numeric fields defaulting explicitly to zero only where business approves zero-default behavior,
- correction reason for edits after initial submission.

### Validation rules

- Date must be valid and within allowed reporting window.
- Numeric count fields must be integers >= 0.
- Revenue/spend fields must be decimal numbers >= 0 unless refund handling explicitly allows separate positive refund amount.
- `live_calls <= scheduled_calls` warning or validation, depending on business rule.
- Close counts should not exceed live calls without warning/override.
- Duplicate same date + team member + role should be blocked or treated as edit/correction.
- All writes should use server-side validation, not client-only validation.

### Duplicate prevention

Use a stable business key:

```text
kpi_date + team_member_id + role + source/system
```

Do not use Slack timestamp as the future primary record ID.

### Date handling

- Store business date separately from submission timestamp.
- Use explicit timezone policy, likely UK business date for Credit Club reporting unless Arshid approves otherwise.
- Preserve historical dates exactly.

### User/team/role mapping

- Use existing Sales Tracker auth identity as primary app identity.
- Map Clerk/Supabase user/rep to KPI team member identity through a controlled mapping table/config.
- Avoid mutating historical KPI rows when display names change.
- Historical rows should retain submitted identity snapshot plus stable user ID.

### Edit history/audit log

Recommend append-only audit model:

- create event,
- update/correction event,
- void event instead of hard delete,
- actor ID,
- timestamp,
- before/after diff or full row version,
- reason.

### Avoid hard deletes

Use `voided_at`, `voided_by`, and `void_reason`, or event-sourced corrections. Managers can hide voided records from default reporting while preserving audit trail.

### Avoid plaintext passwords

Use existing app authentication provider/session. Do not store KPI passwords in BigQuery.

### Avoid Slack timestamp as primary ID

Use UUID/ULID primary keys plus stable unique business constraints. Preserve `slack_message_ts` only as legacy external reference for old migrated rows.

### Protect formulas

- Formulas live only in `lib/kpis` calculation modules.
- Inputs are raw facts only.
- Managers cannot edit formulas through UI.
- Formula changes require code review, parity tests, and explicit approval.

### Corrections and mistakes

- Same-day edit can be allowed with audit trail.
- Post-lock-period changes require manager approval.
- Corrections should create version history rather than replacing silently.

### Historical data

- Keep old historical rows untouched during transition.
- Build read-only compatibility layer for old rows.
- If migrating, map legacy fields into new model with legacy references retained.
- Do not mutate historical names/roles as old app does unless explicitly approved.

## SECTION 7 — Data/write strategy options

### Option 1 — Continue writing to existing BigQuery tables

Description:

- New KPI Tracker writes directly to existing `kpi_records`, `ad_spend`, and possibly `users` tables.

Pros:

- Old and new trackers see the same data quickly.
- Lower migration burden.
- Preserves current `daily_kpi_summary` view behavior.

Cons:

- Highest risk of breaking old tracker.
- Requires write permissions to existing production tables.
- Keeps legacy design issues: `slack_message_ts`, hard deletes, historical mutation patterns.
- More difficult to test safely.

Required permissions if later approved:

- Least-privilege BigQuery insert/update permissions on specific tables only.
- No broad Owner/Editor/Admin.

Risk controls if chosen:

- Start with a staging dataset or allowlisted test rows.
- Parameterized queries only.
- No deletes; use approved update/correction pattern.
- Parity tests before enabling any real writes.

### Option 2 — Create new write tables for the new KPI tracker

Description:

- New KPI Tracker writes to new, safer tables while old tracker remains unchanged.
- A compatibility view/export can later feed dashboards or be mapped into old format after approval.

Pros:

- Safer transition.
- Enables proper IDs, audit trail, no hard deletes, stable user IDs.
- Avoids corrupting old tracker during prototype/UAT.
- Lets input workflow mature before cutover.

Cons:

- More design/migration work.
- Requires new tables/views later.
- Requires reconciliation between old and new sources during transition.
- Business Performance compatibility needs careful mapping.

Migration complexity:

- Moderate, but safer. Need schema design, mapping, and reconciliation jobs/views.

### Option 3 — Keep old input workflow temporarily

Description:

- Old KPI tracker remains the input system.
- New KPI Tracker is read-only and visually redesigned first.
- Input workflow is prototyped with mock/local data only until write strategy is approved.

Pros:

- Safest short-term option.
- Zero write risk.
- Lets UI/UX and parity improve without disrupting operations.
- Aligns with current constraints.

Cons:

- Does not immediately solve the missing input workflow in production.
- Users continue using old KPI tracker for inputs during transition.

### Recommendation

Recommend **Option 3 first**, then likely **Option 2** for the future write workflow.

Do not choose Option 1 unless there is a strong operational reason and explicit approval, because direct writes to existing production tables are the highest-risk path.

## SECTION 8 — Security plan for input workflow

### Authentication

- Use existing app auth/session model, not old Basic Auth.
- Do not store KPI passwords in BigQuery.
- Do not copy old plaintext password handling.

### Roles/permissions

Define explicit app roles:

- closer,
- SDR,
- manager,
- admin,
- read-only/viewer.

Permissions should be action-based:

- view own KPI,
- submit own KPI,
- edit own KPI,
- view team KPI,
- approve correction,
- manage ad spend,
- manage mappings.

### Manager/admin access

- Managers/admins can view broader scopes.
- Write/admin powers require separate permission checks.
- Admin impersonation/on-behalf submission should be explicit and audited.

### Closer/SDR access

- Scoped to own mapped team member and role by default.
- No URL/query override should expand access.
- Server-side enforcement required.

### Input validation

- Validate on server.
- Validate types, ranges, duplicate keys, date windows, and role scope.
- Treat client-side validation as UX only.

### Audit trail

- Store actor, timestamp, action, before/after, reason, and request ID.
- No hard deletes.
- Voided/corrected records remain inspectable.

### Secrets/IAM

- No service account JSON keys in repo or runtime bundle.
- Use deployed service identity or approved secret delivery.
- Use Secret Manager for secrets only if/when needed.
- Do not request Secret Manager secret-value access unless required.

### SQL safety

- Parameterized BigQuery queries only.
- No direct SQL string interpolation.
- Centralize query builder/guards.
- Keep the existing read-only guard for read-only paths.

### Least-privilege BigQuery writes

If writes are later approved:

- Scope write permissions to specific dataset/tables.
- Separate read identity from write identity if practical.
- No dataset admin unless a migration explicitly needs it.
- No Owner/Editor roles.

### Logging

- Log action metadata and record IDs.
- Do not log secrets, passwords, full sensitive payloads, or raw credentials.
- Avoid logs containing private screenshots or raw dashboard captures.

## SECTION 9 — What existing work can be reused

Reusable:

- `lib/kpis` calculation layer.
- `lib/kpis/formatting.ts` legacy display formatting helpers.
- `lib/data/kpis` read-only BigQuery layer.
- Read-only query guard patterns.
- Parity tests and live parity test structure.
- Feature-flag pattern.
- Security audit docs.
- BigQuery/source audit docs.
- KPI Calculation Register and BigQuery Logic Register.
- Route gating / internal beta warning approach.

Partially reusable:

- `app/dashboard/kpis-preview/page.tsx` as a reference for read-only KPI rendering only.
- `/dashboard/merged-preview` components as technical reference only, not final UX.
- Beta status panel content, reworked into smaller Sales Tracker-style badges/alerts.

Should be discarded or not used as final direction:

- Combined “one big dashboard” layout.
- Any visual styling that conflicts with Sales Tracker style.
- Any implication that Sales Tracker and KPI Tracker are one product surface.
- Any old Basic Auth/plaintext password patterns.
- Direct BigQuery write paths.
- Hard-delete behavior.
- Slack timestamp as future primary ID.

## SECTION 10 — Recommended next phases

### Phase 3A — Separate KPI Tracker redesign and input workflow plan

Status: this document. Planning only.

### Phase 3B — Build separate read-only KPI Tracker UI

- New route: `/dashboard/kpi-tracker`.
- Use current formulas and Sales Tracker visual style.
- Keep old KPI tracker as source of truth.
- No writes.
- No admin input migration.
- No production default route changes.

### Phase 3C — Input workflow prototype

- Prototype closer/admin input UI with local/mock data only.
- Validate UX, required fields, edit/correction flows, and manager review.
- No BigQuery writes.
- No schema changes.

### Phase 3D — Approved write strategy implementation

Only after explicit approval:

- implement chosen BigQuery/new-table write strategy,
- parameterized writes,
- audit trail,
- least-privilege IAM,
- no plaintext passwords,
- no hard deletes.

### Phase 3E — Full parity and UAT

- Compare old vs new outputs.
- Test role/team/member filters.
- Test manager workflows.
- Test closer input workflow.
- Resolve mismatch reports.

### Phase 3F — Launch/cutover proposal

Only after blockers are resolved:

- security complete,
- parity complete,
- input workflow approved,
- rollback approved,
- old KPI tracker transition timing approved,
- training/support complete.

## SECTION 11 — Immediate recommendation

- **Abandon/pause the merged dashboard as the main direction** unless a revised merged-dashboard plan is explicitly approved.
- **Keep Sales Tracker and KPI Tracker separate.**
- **Recommended new route:** `/dashboard/kpi-tracker`.
- **Input workflow risk to solve first:** safe write model with proper permissions, audit trail, duplicate prevention, stable user/team/role mapping, no hard deletes, no plaintext passwords, and no Slack timestamp as primary ID.
- **Recommended next build:** Phase 3B — separate read-only KPI Tracker UI styled like Sales Tracker, with old KPI tracker source-of-truth warnings and no writes.
- **Recommended not to build:** any further `/dashboard/merged-preview` UX as the main product direction, admin/write workflows, BigQuery writes, production navigation, or formula changes without explicit approval.
