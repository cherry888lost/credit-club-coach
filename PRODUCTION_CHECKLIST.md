# Credit Club Coach - Production Deployment Checklist

## ✅ COMPLETED

### 1. Supabase Service Role Key Retrieved
- **Status**: ✅ Real JWT service_role key obtained from Supabase Dashboard
- **Updated in**: `.env.local`
- **Key format**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT)

### 2. Files Created for Production

| File | Purpose |
|------|---------|
| `lib/supabase/service.ts` | Service role client for webhook |
| `app/api/webhook/fathom/route.ts` | Production webhook endpoint with idempotency |
| `app/api/webhook/test/route.ts` | Dev-only test endpoint |
| `app/dashboard/settings/_components/WebhookHealth.tsx` | Webhook monitoring UI |
| `scripts/test-webhook.sh` | Bash script for testing webhooks |
| `scripts/test-webhook.js` | Browser console test script |
| `DEPLOYMENT.md` | Full deployment guide |
| `vercel.json` | Vercel deployment config |
| `.env.local` | Updated with real service_role key |

## 🔲 REMAINING TASKS (Require Your Sign-in)

### Step 1: Clerk Production Keys
**URL**: https://dashboard.clerk.com

1. Sign in to Clerk Dashboard
2. Select your application
3. Go to **Configure → API Keys**
4. Switch to **Production** tab
5. Copy these keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_live_`)
   - `CLERK_SECRET_KEY` (starts with `sk_live_`)

6. Configure Authorized Redirect URLs:
   - Add: `https://your-domain.com/sign-in`
   - Add: `https://your-domain.com/sign-up`
   - Add: `https://your-domain.com/dashboard`
   - Add: `https://your-domain.com/onboarding`

### Step 2: Vercel Deployment
**URL**: https://vercel.com

#### Option A: CLI Deployment (Easiest)

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login (will open browser)
vercel login

# Deploy to production
cd /Users/papur/credit-club-coach
vercel --prod
```

#### Option B: Git Integration (Recommended for CI/CD)

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Vercel auto-deploys on every push

### Step 3: Add Environment Variables to Vercel

In Vercel Dashboard → Project Settings → Environment Variables, add:

```bash
# Supabase (from .env.local - already configured ✅)
NEXT_PUBLIC_SUPABASE_URL=https://dulumwipmtsiizozmfca.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Clerk (NEED PRODUCTION KEYS FROM CLERK DASHBOARD)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...        # ← GET FROM CLERK
CLERK_SECRET_KEY=sk_live_...                        # ← GET FROM CLERK

# Fathom (generate a strong secret)
FATHOM_WEBHOOK_SECRET=whsec_...                     # ← openssl rand -hex 32
```

### Step 4: Fathom Webhook Configuration

In Fathom Dashboard:

1. Go to **Integrations → Webhooks**
2. Add webhook URL:
   ```
   https://your-domain.com/api/webhook/fathom
   ```
3. Add webhook secret (same as `FATHOM_WEBHOOK_SECRET` in Vercel)
4. Subscribe to events:
   - `call.completed`
   - `call.transcribed` (optional)

## 🔧 TESTING AFTER DEPLOYMENT

### Test 1: Webhook Endpoint Alive
```bash
curl https://your-domain.com/api/webhook/fathom
```
Expected: `{"message":"Fathom webhook endpoint active"}`

### Test 2: Send Test Webhook
```bash
# Via dashboard: Go to /dashboard/settings → Webhook Health → Click "Send Test Webhook"
# Or via curl:

PAYLOAD='{"id":"call_test_'$(date +%s)'","title":"Test Call","started_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","transcript":"Test","host":{"email":"you@example.com"}}'
SECRET='your-fathom-webhook-secret'
SIGNATURE=$(echo -n "${PAYLOAD}${SECRET}" | openssl dgst -sha256 | cut -d' ' -f2)

curl -X POST https://your-domain.com/api/webhook/fathom \
  -H "Content-Type: application/json" \
  -H "X-Fathom-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Test 3: Verify Call Appears in Dashboard
1. Go to `/dashboard/calls`
2. Should see the test call
3. Click into call detail page

## 🚀 VERCEL DEPLOYMENT COMMANDS

```bash
# One-time setup
npm i -g vercel
vercel login

# Link project (run in repo root)
cd /Users/papur/credit-club-coach
vercel link

# Deploy to production
vercel --prod

# Check logs
vercel logs --prod
```

## 📋 QUICK REFERENCE: Environment Variables

| Variable | Current Value | Needs Update |
|----------|--------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set | No |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Real JWT | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | **YES → pk_live_...** |
| `CLERK_SECRET_KEY` | `sk_test_...` | **YES → sk_live_...** |
| `FATHOM_WEBHOOK_SECRET` | `dev-...` | **YES → Generate new** |

## 🎯 POST-DEPLOYMENT VERIFICATION

- [ ] Homepage loads and redirects to sign-in
- [ ] Can sign up / sign in
- [ ] Onboarding creates organization
- [ ] Dashboard loads with 0 calls
- [ ] `/api/webhook/fathom` responds to GET
- [ ] Test webhook creates a call
- [ ] Call appears in `/dashboard/calls`
- [ ] Call detail page shows transcript/scores
- [ ] `/dashboard/settings` shows Webhook Health panel

## ⚠️ IMPORTANT NOTES

1. **Service Role Key**: Already updated with real JWT from Supabase
2. **Clerk Keys**: Must switch from `pk_test_`/`sk_test_` to `pk_live_`/`sk_live_`
3. **Webhook Secret**: Generate new strong secret for production
4. **Domain**: Update Clerk redirect URLs to match your production domain
5. **Fathom**: Configure webhook URL and secret in Fathom dashboard

## 🆘 TROUBLESHOOTING

### Webhook returns 401
- Check `FATHOM_WEBHOOK_SECRET` matches between Vercel and Fathom
- Verify signature is being calculated correctly

### Calls not appearing
- Check Vercel logs: `vercel logs --prod`
- Verify `SUPABASE_SERVICE_ROLE_KEY` is the real JWT (starts with `eyJ`)
- Check Supabase Table Editor for new rows

### Database errors
- Verify all env vars are set in Vercel
- Check that migration was applied (tables exist)
- Ensure service role key has bypass RLS permissions
