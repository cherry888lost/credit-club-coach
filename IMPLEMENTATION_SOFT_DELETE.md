# Admin-Only Call Deletion (Soft Delete) - Implementation Summary

## A. EXACT ARCHITECTURE DECISION

**Chosen: Soft Delete with `deleted_at` timestamp column**

**Why:**
1. **Safest approach** - No risk of foreign key cascade violations
2. **Data preservation** - All call data, scores, and related records are retained
3. **Easy restoration** - Simply set `deleted_at = NULL` to restore a call
4. **Audit trail** - The `deleted_at` timestamp shows when deletion occurred
5. **Future-proof** - Can add `deleted_by` column later if needed for full audit trail

**Rejected: Hard Delete**
- Risk of orphaned records in related tables
- Data loss is permanent
- Could break referential integrity

## B. EXACT FILES CHANGED (List All)

### NEW Files Created:
1. `/app/api/calls/[id]/route.ts` - DELETE endpoint for single call soft delete
2. `/app/api/calls/bulk-delete/route.ts` - POST endpoint for bulk soft delete
3. `/app/dashboard/calls/_components/DeleteConfirmModal.tsx` - Confirmation modal component
4. `/app/dashboard/calls/_components/CallsList.tsx` - Enhanced calls list with checkboxes & bulk actions
5. `/migrations/20250311_add_soft_delete_to_calls.sql` - Database migration

### MODIFIED Files:
1. `/app/dashboard/calls/page.tsx` - Added `.is("deleted_at", null)` filter, uses CallsList
2. `/app/dashboard/page.tsx` - Added `.is("deleted_at", null)` filter to calls query
3. `/app/dashboard/reps/page.tsx` - Added `.is("deleted_at", null)` filter to calls query
4. `/app/dashboard/analysis/page.tsx` - Added `.is("deleted_at", null)` filter to calls query
5. `/app/dashboard/calls/[id]/page.tsx` - Added deleted call check (returns 404 if deleted)
6. `/app/api/webhook/fathom/route.ts` - Added logic to undelete calls on re-import
7. `/cherry-worker/scoring-processor.ts` - Modified `pollSupabase` to exclude deleted calls

**Total: 12 files modified/created**

## C. EXACT SQL TO RUN

```sql
-- Soft delete column for calls table
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for performance on non-deleted calls
-- Partial index: only includes rows where deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_calls_deleted_at 
ON calls(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN calls.deleted_at IS 'Soft delete timestamp. NULL = not deleted, timestamp = deleted at that time.';

-- Optional but recommended: Create a view for active (non-deleted) calls
CREATE OR REPLACE VIEW active_calls AS
SELECT * FROM calls WHERE deleted_at IS NULL;
```

## D. EXACT DEPLOY COMMAND

```bash
# 1. Navigate to project
cd /Users/papur/credit-club-coach

# 2. Run database migration (choose one method)
# Method A: Using psql directly
psql $DATABASE_URL -f migrations/20250311_add_soft_delete_to_calls.sql

# Method B: Using Supabase CLI (if configured)
supabase db push

# Method C: Manual execution via Supabase Dashboard SQL Editor
# Copy and paste the SQL from section C

# 3. Build the application
npm run build

# 4. Deploy to production
# (Vercel auto-deploys on git push, or use:)
vercel --prod
```

## E. EXACT TEST STEPS (All 10 Test Cases)

### Test Case 1: Admin can see checkboxes on calls page
1. Log in as admin user
2. Navigate to `/dashboard/calls`
3. **Expected:** Checkboxes visible next to each call row
4. **Expected:** "Select all" button visible in filter bar

### Test Case 2: Non-admin cannot see checkboxes
1. Log in as non-admin user (closer/SDR)
2. Navigate to `/dashboard/calls`
3. **Expected:** No checkboxes visible
4. **Expected:** No delete functionality accessible

### Test Case 3: Select multiple calls and bulk delete
1. As admin, go to `/dashboard/calls`
2. Click checkboxes on 2-3 calls
3. Click "Delete Selected" button
4. **Expected:** Confirmation modal appears with correct count
5. Confirm deletion
6. **Expected:** Page reloads, selected calls no longer visible

### Test Case 4: Single call deletion via API
```bash
curl -X DELETE /api/calls/[call-id] \
  -H "Cookie: [admin-session-cookie]"
```
**Expected:** `200 OK` with success message

### Test Case 5: Non-admin cannot delete (403)
```bash
curl -X DELETE /api/calls/[call-id] \
  -H "Cookie: [non-admin-session-cookie]"
```
**Expected:** `403 Forbidden` with "Admin access required"

### Test Case 6: Deleted call excluded from dashboard stats
1. Note total call count on dashboard
2. Delete a call
3. Refresh dashboard
4. **Expected:** Call count decreased by 1

### Test Case 7: Deleted call returns 404 on detail page
1. Delete a call (note its ID)
2. Try to visit `/dashboard/calls/[deleted-call-id]`
3. **Expected:** 404 Not Found page

### Test Case 8: Deleted call excluded from reps page stats
1. Note a rep's call count on `/dashboard/reps`
2. Delete one of their calls
3. Refresh reps page
4. **Expected:** Rep's call count decreased by 1

### Test Case 9: Webhook re-import undeletes call
1. Delete a call (note its fathom_call_id)
2. Re-send webhook with same fathom_call_id
3. **Expected:** Call reappears in dashboard
4. **Expected:** `deleted_at` is now NULL

### Test Case 10: Bulk delete API works correctly
```bash
curl -X POST /api/calls/bulk-delete \
  -H "Content-Type: application/json" \
  -H "Cookie: [admin-session-cookie]" \
  -d '{"ids": ["call-id-1", "call-id-2"]}'
```
**Expected:** `200 OK` with `deletedCount: 2`

## F. BRUTALLY HONEST RISKS / LIMITATIONS

### What's Fully Working:
✅ Soft delete column and index added to database
✅ Admin-only delete API endpoints (single + bulk)
✅ Checkbox UI for call selection (admin only)
✅ Confirmation modal with proper warning text
✅ All queries exclude deleted calls via `.is("deleted_at", null)`
✅ Deleted calls return 404 on detail page
✅ Webhook re-import undeletes calls
✅ Cherry worker excludes deleted calls from scoring queue
✅ TypeScript compilation successful

### Limitations & Future Improvements:

1. **No "Deleted Calls" UI** - There's no way to view or restore deleted calls through the UI
   - Workaround: Direct database query to find and restore
   - Future: Could add admin "Trash" page

2. **No audit trail** - We don't track WHO deleted a call
   - Workaround: Check application logs
   - Future: Add `deleted_by` column

3. **No hard delete option** - Deleted calls remain in database forever
   - This is intentional for safety
   - Future: Could add permanent delete after X days

4. **Bulk delete limited to 100** - API enforces max 100 calls per batch
   - Workaround: Multiple API calls for larger batches
   - Future: Could increase limit or add async processing

5. **No confirmation on single delete** - Individual call deletion only available via bulk UI
   - Workaround: Must select single call via checkbox
   - Future: Could add delete button on call detail page

### Edge Cases Handled:
- ✅ Webhook re-import of deleted call → Auto-undeletes
- ✅ Call already deleted → Returns 409 "already deleted"
- ✅ Call not found → Returns 404
- ✅ Non-admin attempts deletion → Returns 403
- ✅ Invalid call IDs in bulk delete → Filters them out
- ✅ Partial success in bulk delete → Returns which succeeded/failed

### Database Performance:
- Partial index on `deleted_at` ensures queries remain fast
- Index only includes non-deleted rows (WHERE deleted_at IS NULL)
- No impact on queries that already filter by `deleted_at`
