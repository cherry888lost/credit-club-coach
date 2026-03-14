import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { approvePattern, rejectPattern, promoteToBenchmark, updateObjectionFromPattern } from '@/lib/scoring/controlled-learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/learning-queue/[id]/review
 *
 * Admin review: approve, reject, or promote a learning queue entry.
 * Body: { action: 'approve' | 'reject' | 'promote_benchmark' | 'promote_objection', notes?, benchmark_data?, objection_data? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: patternId } = await params;
  const body = await request.json();
  const { action, notes, benchmark_data, objection_data } = body;

  const supabase = await createServiceClient();
  const orgId = '00000000-0000-0000-0000-000000000001'; // TODO: from auth context

  switch (action) {
    case 'approve': {
      const result = await approvePattern(supabase, patternId, userId, notes);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Approve failed' }, { status: 500 });
      }
      return NextResponse.json(result);
    }

    case 'reject': {
      const result = await rejectPattern(supabase, patternId, userId, notes);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Reject failed' }, { status: 500 });
      }
      return NextResponse.json(result);
    }

    case 'promote_benchmark': {
      // First approve if not already
      await approvePattern(supabase, patternId, userId, notes);

      // Auto-generate minimal benchmark_data from the pattern if not provided
      const effectiveBenchmarkData = benchmark_data || {
        outcome: 'closed',
        quality_rating: 'strong',
        why_this_is_good: 'Promoted from learning queue review',
      };

      const result = await promoteToBenchmark(supabase, patternId, orgId, effectiveBenchmarkData);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Promote failed' }, { status: 500 });
      }
      return NextResponse.json(result);
    }

    case 'promote_objection': {
      if (!objection_data) {
        return NextResponse.json({ error: 'objection_data required' }, { status: 400 });
      }
      await approvePattern(supabase, patternId, userId, notes);
      const result = await updateObjectionFromPattern(supabase, patternId, orgId, objection_data);
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json({ error: 'Invalid action. Use: approve, reject, promote_benchmark, promote_objection' }, { status: 400 });
  }
}
