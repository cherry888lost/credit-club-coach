# Credit Club Coach - Production Deployment Guide

## 1. Deploy to Vercel

### Option A: Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
cd /Users/papur/credit-club-coach
vercel --prod
```

### Option B: Git Integration (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Import project in Vercel dashboard
3. Vercel auto-deploys on every push to main branch

## 2. Environment Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

### Required Variables

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_SUPABASE_PROJECT_URL` | `https://...` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase Dashboard → Project Settings → API (service_role) |
| `FATHOM_WEBHOOK_SECRET` | `whsec_...` | Generate with `openssl rand -hex 32` |

### Switching Clerk to Production

1. Go to Clerk Dashboard: https://dashboard.clerk.com
2. Select your app → Configure → API Keys
3. Copy the **Production** keys (not Development)
4. Update Vercel environment variables
5. Configure allowed redirect URLs in Clerk:
   - `https://your-domain.com/sign-in`
   - `https://your-domain.com/sign-up`
   - `https://your-domain.com/dashboard`

## 3. Supabase Production Settings

### Get Real Service Role Key

⚠️ **CRITICAL**: The current `.env.local` has a placeholder `SUPABASE_SERVICE_ROLE_KEY`. You need the real one.

1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (NOT the `anon` key)
3. Add to Vercel environment variables

### RLS Policies Review

Current policies allow any authenticated user full access. For production, tighten these:

```sql
-- Example: Only allow users to see their own org's data
CREATE POLICY "org_isolation" ON calls
  FOR ALL TO authenticated
  USING (org_id IN (
    SELECT org_id FROM reps WHERE clerk_user_id = auth.uid()
  ));
```

## 4. Fathom Webhook Configuration

### Webhook URL

Set this in Fathom Dashboard:
```
https://your-domain.com/api/webhook/fathom
```

### Webhook Secret

1. Generate a strong secret:
   ```bash
   openssl rand -hex 32
   ```

2. Add to Vercel as `FATHOM_WEBHOOK_SECRET`

3. Add the same secret to Fathom webhook settings

### Testing the Webhook

1. Go to `/dashboard/settings` as admin
2. Copy the webhook URL shown
3. Click "Send Test Webhook"
4. Check that a test call appears in "Recent Ingested Calls"

## 5. Post-Deployment Verification Checklist

- [ ] Homepage redirects to sign-in
- [ ] Can sign up / sign in with Clerk
- [ ] Onboarding flow creates organization
- [ ] Dashboard shows real data (0 calls initially)
- [ ] Can add reps (admin only)
- [ ] `/api/webhook/fathom` returns 200 with GET request
- [ ] Test webhook successfully creates a call
- [ ] Call appears in `/dashboard/calls`
- [ ] Call detail page shows transcript/scores

## 6. Curl Test Commands

### Test webhook endpoint is alive:
```bash
curl https://your-domain.com/api/webhook/fathom
```

### Send test webhook:
```bash
curl -X POST https://your-domain.com/api/webhook/fathom \
  -H "Content-Type: application/json" \
  -H "X-Fathom-Signature: $(echo -n '{"id":"call_test_123","title":"Test","started_at":"2024-03-06T12:00:00Z","transcript":"Test","host":{"email":"you@example.com"}}YOUR_SECRET_HERE' | openssl dgst -sha256 | cut -d' ' -f2)" \
  -d '{
    "id": "call_test_123",
    "title": "Test Call",
    "started_at": "2024-03-06T12:00:00Z",
    "transcript": "Test transcript",
    "host": {"email": "you@example.com"}
  }'
```

## 7. Troubleshooting

### Webhook returning 401
- Check `FATHOM_WEBHOOK_SECRET` is set correctly in Vercel
- Ensure signature is being calculated correctly

### Calls not appearing
- Check Vercel logs: `vercel logs --prod`
- Verify `SUPABASE_SERVICE_ROLE_KEY` is the real JWT (starts with `eyJ`)
- Check Supabase Table Editor for inserted rows

### Database errors
- Verify all environment variables are set
- Check that database migration was applied
- Ensure service role key has proper permissions

## 8. Custom Domain (Optional)

1. In Vercel Dashboard → Domains
2. Add your domain
3. Update Clerk redirect URLs to use custom domain
4. Update Fathom webhook URL to use custom domain
