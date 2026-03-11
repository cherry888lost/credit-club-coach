# Credit Club Coach — V2 Upgrade Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                         │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Cherry (main) │    │ scoring-bg   │    │ reason       │   │
│  │ Kimi 2.5      │    │ (silent bg)  │    │ GPT-5.4      │   │
│  │ Interactive    │    │ polls queue  │    │ scores calls │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                    │           │
│    User chat           Cron every 2m         Spawned by     │
│    Telegram            No output on success   scoring-bg    │
│                        Alert on failure                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Database                          │
│                                                              │
│  scoring_requests → call_scores → calls                     │
│  winning_call_patterns (NEW)                                │
│  call_outcomes (manual, NEW)                                │
│  follow_up_messages (NEW)                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Dashboard (Vercel)                       │
│                                                              │
│  • Call detail page (existing)                               │
│  • Outcome logging UI (NEW)                                  │
│  • Pattern library viewer (NEW)                              │
│  • Follow-up message generator (NEW)                         │
│  • Enhanced coaching display (UPDATED)                       │
└─────────────────────────────────────────────────────────────┘
```

## Agent Responsibilities

| Agent        | Model      | Role                                      |
|-------------|------------|-------------------------------------------|
| `main`      | Kimi 2.5   | Interactive chat, user commands            |
| `scoring-bg`| (NEW) none | Silent cron worker, polls queue, spawns reasoner |
| `reason`    | GPT-5.4    | Scores transcripts, extracts patterns      |
| `coding`    | Claude Opus| Implementation, code changes               |

---

## Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `~/.openclaw/bin/scoring-worker-v2.js` | Silent background worker |
| 2 | `credit-club-coach/migrations/002_sales_outcomes.sql` | Outcome + pattern tables |
| 3 | `credit-club-coach/lib/scoring/prompts-v2.ts` | Enhanced scoring prompt with patterns |
| 4 | `credit-club-coach/app/api/calls/[id]/outcome/route.ts` | Outcome logging API |
| 5 | `credit-club-coach/app/api/calls/[id]/follow-up/route.ts` | Follow-up message API |
| 6 | `credit-club-coach/app/api/patterns/route.ts` | Pattern library API |
| 7 | `credit-club-coach/app/api/patterns/analyze/route.ts` | Pattern extraction API |
| 8 | `credit-club-coach/app/dashboard/calls/[id]/_components/OutcomeLogger.tsx` | Outcome UI component |
| 9 | `credit-club-coach/app/dashboard/calls/[id]/_components/FollowUpGenerator.tsx` | Follow-up UI component |
| 10 | `credit-club-coach/app/dashboard/calls/[id]/_components/EnhancedCoaching.tsx` | Enhanced coaching display |

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `~/.openclaw/config.json` | Add `scoring-bg` agent |
| 2 | `credit-club-coach/app/dashboard/calls/[id]/page.tsx` | Add outcome + follow-up + coaching components |
| 3 | `credit-club-coach/lib/scoring/prompts.ts` | Update with enhanced coaching output format |

## Cron Changes

| Action | Command |
|--------|---------|
| Remove old | `openclaw cron rm 7c561b4c-5014-4fc9-a12d-fb8a37e71363` |
| Add new | `openclaw cron add --name "scoring-worker-v2" --every "2m" --agent scoring-bg --message "Run scoring cycle" --session isolated --no-deliver` |

---

## Implementation Order

1. Database migration (002_sales_outcomes.sql)
2. Config: add scoring-bg agent
3. Worker: scoring-worker-v2.js (silent)
4. Cron: swap old → new
5. API routes: outcome, follow-up, patterns
6. UI components: OutcomeLogger, FollowUpGenerator, EnhancedCoaching
7. Update call detail page
8. Enhanced prompts with pattern integration
