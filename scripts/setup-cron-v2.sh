#!/bin/bash
# Setup V2 Scoring Cron
# This replaces the old cron that ran through Cherry (main agent)
# The new cron runs silently via exec, no agent session needed

set -e

echo "🔄 Removing old scoring cron..."
openclaw cron rm 7c561b4c-5014-4fc9-a12d-fb8a37e71363 2>/dev/null || echo "Old cron not found (may already be removed)"

echo ""
echo "✅ Adding new silent scoring cron..."
openclaw cron add \
  --name "scoring-worker-v2" \
  --every "2m" \
  --message "Run exactly this shell command and return only errors: cd /Users/papur/credit-club-coach && npm run worker:once -- --max 1 --fail-on-error. Do not run bulk scoring. Do not process more than one request." \
  --no-deliver \
  --timeout-seconds 180 \
  --description "Background scoring worker via checked-in TypeScript source and npm worker:once; max one request per cycle. No missing ~/.openclaw worker file."

echo ""
echo "📋 Current cron jobs:"
openclaw cron list

echo ""
echo "✅ Done! The scoring worker will now run silently every 2 minutes."
echo "   Cherry (main) is free for interactive use."
echo "   Errors will be logged to stderr and optionally sent via Telegram."
echo ""
echo "   To test: openclaw cron run scoring-worker-v2"
