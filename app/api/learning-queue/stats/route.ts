import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/learning-queue/stats
 *
 * Get counts by status for the learning queue.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('learning_queue')
    .select('status');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats: Record<string, number> = {
    pending_review: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    promoted: 0,
  };

  for (const row of data || []) {
    const status = row.status as string;
    if (stats[status] !== undefined) {
      stats[status]++;
    }
  }
  // Map 'pending' to 'pending_review' for frontend compatibility
  stats.pending_review = stats.pending_review + stats.pending;

  return NextResponse.json(stats);
}
