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
  --exec "node /Users/papur/.openclaw/bin/scoring-worker-v2.js" \
  --no-deliver \
  --description "Silent background scoring worker. No output on success. Alerts on failure only."

echo ""
echo "📋 Current cron jobs:"
openclaw cron list

echo ""
echo "✅ Done! The scoring worker will now run silently every 2 minutes."
echo "   Cherry (main) is free for interactive use."
echo "   Errors will be logged to stderr and optionally sent via Telegram."
echo ""
echo "   To test: openclaw cron run scoring-worker-v2"
