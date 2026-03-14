import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/benchmark-calls
 *
 * List benchmark calls with optional filters.
 * Query params: quality_rating, outcome, tag, rep, limit, offset
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const quality = searchParams.get('quality_rating');
  const outcome = searchParams.get('outcome');
  const tag = searchParams.get('tag');
  const rep = searchParams.get('rep');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = await createServiceClient();

  let query = supabase
    .from('benchmark_calls')
    .select('*', { count: 'exact' })
    .order('overall_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (quality) query = query.eq('quality_rating', quality);
  if (outcome) query = query.eq('outcome', outcome);
  if (tag) query = query.contains('tags', [tag]);
  if (rep) query = query.eq('rep_name', rep);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count });
}

/**
 * POST /api/benchmark-calls
 *
 * Manually add a call to the benchmark library.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('benchmark_calls')
    .insert({
      org_id: '00000000-0000-0000-0000-000000000001',
      call_id: body.call_id || null,
      score_id: body.score_id || null,
      transcript: body.transcript || null,
      outcome: body.outcome,
      close_type: body.close_type || null,
      rep_name: body.rep_name || null,
      call_date: body.call_date || null,
      quality_rating: body.quality_rating,
      overall_score: body.overall_score || null,
      why_this_is_good: body.why_this_is_good,
      strongest_moments: body.strongest_moments || [],
      objection_examples: body.objection_examples || [],
      key_lines_to_model: body.key_lines_to_model || [],
      tags: body.tags || [],
      approved_by: userId,
      approved_at: new Date().toISOString(),
      source: 'manual',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data!.id }, { status: 201 });
}
