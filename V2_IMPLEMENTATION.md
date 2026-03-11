# Credit Club Coach V2 — Implementation Summary

## A. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                      │
│                                                          │
│  ┌────────────┐      ┌────────────────────┐             │
│  │ Cherry      │      │ scoring-worker-v2  │             │
│  │ (main)      │      │ (exec cron)        │             │
│  │ Kimi 2.5    │      │ Node.js script     │             │
│  │ Interactive │      │ Every 2 min        │             │
│  │ Telegram    │      │ Silent on success  │             │
│  └─────────────┘      │ Alert on failure   │             │
│        │              └────────┬───────────┘             │
│   User chats                   │                         │
│   Commands               Calls OpenAI API                │
│   Queries                directly (GPT-5.4)              │
│                                │                         │
│  ┌────────────┐      ┌────────┴───────────┐             │
│  │ coding      │      │ reason (GPT-5.4)  │             │
│  │ Claude Opus │      │ Scores calls      │             │
│  │ Dev work    │      │ Extracts patterns │             │
│  └─────────────┘      └───────────────────┘             │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                    Supabase Database                       │
│                                                           │
│  Tables:                                                  │
│  ├─ calls (existing)                                      │
│  ├─ call_scores (updated: manual_outcome, enhanced fields)│
│  ├─ scoring_requests (existing)                           │
│  ├─ winning_call_patterns (NEW)                           │
│  └─ follow_up_messages (NEW)                              │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│              Next.js Dashboard (Vercel)                    │
│                                                           │
│  Call Detail Page:                                        │
│  ├─ Score Breakdown (existing)                            │
│  ├─ Strengths/Weaknesses (existing)                       │
│  ├─ Objections (existing)                                 │
│  ├─ Coaching Actions (existing)                           │
│  ├─ ✨ Outcome Logger (NEW - manual outcome + close_type)│
│  ├─ ✨ Enhanced Coaching (NEW - scripts + why_it_matters) │
│  ├─ ✨ Follow-Up Generator (NEW - WhatsApp/SMS/Email)    │
│  └─ Transcript (existing)                                 │
│                                                           │
│  API Routes:                                              │
│  ├─ POST /api/calls/[id]/outcome (NEW)                   │
│  ├─ GET  /api/calls/[id]/outcome (NEW)                   │
│  ├─ POST /api/calls/[id]/follow-up (NEW)                 │
│  ├─ GET  /api/calls/[id]/follow-up (NEW)                 │
│  ├─ GET  /api/patterns (NEW)                              │
│  └─ POST /api/patterns/analyze (NEW)                      │
└───────────────────────────────────────────────────────────┘
```

## B. Files Created / Modified

### New Files Created

| File | Purpose |
|------|---------|
| `~/.openclaw/bin/scoring-worker-v2.js` | Silent background worker (replaces V1) |
| `migrations/002_sales_outcomes_and_patterns.sql` | DB migration for new tables + columns |
| `lib/scoring/prompts-v2.ts` | Enhanced prompt with patterns + coaching |
| `app/api/calls/[id]/outcome/route.ts` | Manual outcome logging API |
| `app/api/calls/[id]/follow-up/route.ts` | Follow-up message generation API |
| `app/api/patterns/route.ts` | Pattern library listing API |
| `app/api/patterns/analyze/route.ts` | Pattern extraction from transcripts |
| `app/dashboard/calls/[id]/_components/OutcomeLogger.tsx` | Outcome UI component |
| `app/dashboard/calls/[id]/_components/FollowUpGenerator.tsx` | Follow-up UI component |
| `app/dashboard/calls/[id]/_components/EnhancedCoaching.tsx` | Enhanced coaching display |
| `scripts/setup-cron-v2.sh` | Cron migration script |

### Files Modified

| File | Changes |
|------|---------|
| `~/.openclaw/config.json` | Added `scoring-bg` agent definition |
| `app/dashboard/calls/[id]/page.tsx` | Added imports + sections for new components |

## C. Database Migration

Run `migrations/002_sales_outcomes_and_patterns.sql` in Supabase SQL Editor.

### New Columns on `call_scores`:
- `manual_outcome` — TEXT (closed, follow_up, no_sale)
- `manual_close_type` — TEXT (full_close, deposit, payment_plan, partial_access)
- `outcome_logged_by` — UUID
- `outcome_logged_at` — TIMESTAMPTZ
- `enhanced_weaknesses` — JSONB (detailed weakness analysis)
- `objection_scripts` — JSONB (objection handling scripts)

### New Tables:
- `winning_call_patterns` — Pattern library from successful calls
- `follow_up_messages` — Generated follow-up messages

## D. Updated Scoring Prompt

The V2 prompt (`lib/scoring/prompts-v2.ts` + embedded in `scoring-worker-v2.js`) adds:

1. **Pattern Integration**: Fetches top 5 winning patterns from `winning_call_patterns` and includes them as benchmarks in the scoring prompt
2. **Enhanced Weaknesses**: Each weakness now includes `what_went_wrong`, `why_it_matters`, `better_response_example`
3. **Objection Scripts**: For each detected objection, provides `prospect_said`, `rep_said`, `better_response`, `technique`
4. **Credit Club Context**: All feedback references Credit Club specifics (£3,000 price, Skool community, Amex bonuses, etc.)
5. **Anti-Hallucination**: Explicit instruction to NOT guess close_type (leave null unless prospect committed)

## E. Step-by-Step Implementation Plan

### Phase 1: Database (5 min)
1. Open Supabase SQL Editor
2. Run `migrations/002_sales_outcomes_and_patterns.sql`
3. Verify tables created: `winning_call_patterns`, `follow_up_messages`
4. Verify new columns on `call_scores`

### Phase 2: Cron Migration (2 min)
1. Run `bash scripts/setup-cron-v2.sh`
   - Removes old cron (7c561b4c...)
   - Adds new exec-based cron with `--no-deliver`
2. Verify: `openclaw cron list`
3. Test: `openclaw cron run scoring-worker-v2`

### Phase 3: Deploy Dashboard (5 min)
1. Commit all changes:
   ```bash
   cd /Users/papur/credit-club-coach
   git add -A
   git commit -m "V2: Enhanced coaching, outcome logging, follow-up generator, pattern library"
   git push
   ```
2. Vercel auto-deploys from push
3. Verify new API routes respond (test with curl)

### Phase 4: Seed Pattern Library (10 min)
1. For each successful call in the system:
   ```bash
   curl -X POST https://your-domain.com/api/patterns/analyze \
     -H "Content-Type: application/json" \
     -d '{"call_id": "uuid-of-successful-call"}'
   ```
2. Or use the dashboard (future: add "Extract Patterns" button to call detail page)

### Phase 5: Verify End-to-End
1. Queue a new scoring request via dashboard
2. Wait for cron (2 min) or run manually: `openclaw cron run scoring-worker-v2`
3. Check call detail page for:
   - Enhanced coaching section (weakness details + scripts)
   - Outcome logger (manual outcome buttons)
   - Follow-up message generator
4. Confirm Cherry (main) Telegram is NOT getting cron output

---

### Agent Responsibility Matrix

| Task | Agent | Model |
|------|-------|-------|
| User chat / commands | `main` (Cherry) | Kimi 2.5 |
| Code changes / debugging | `coding` | Claude Opus 4 |
| Call scoring (cron) | `scoring-worker-v2.js` → OpenAI API | GPT-5.4 |
| Pattern extraction | `/api/patterns/analyze` → OpenAI API | GPT-5.4 |
| Follow-up generation | `/api/calls/[id]/follow-up` → OpenAI API | GPT-5-mini |
| Strategic analysis | `reason` | GPT-5.4 |

The `scoring-bg` agent in config.json is available for future use if you want agent-based cron instead of exec-based. Currently the cron uses `--exec` which runs the Node.js script directly — simpler and cheaper (no agent context tokens).
