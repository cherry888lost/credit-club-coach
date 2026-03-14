import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/objections
 *
 * List objection library entries.
 * Query params: category, sort (frequency|recent), limit
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') || 'frequency';
  const limit = parseInt(searchParams.get('limit') || '50');

  const supabase = await createServiceClient();

  let query = supabase
    .from('objection_library')
    .select('*')
    .eq('is_active', true)
    .limit(limit);

  if (category) query = query.eq('category', category);

  if (sort === 'recent') {
    query = query.order('last_seen_at', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('total_occurrences', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/**
 * POST /api/objections
 *
 * Create or update an objection entry.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createServiceClient();
  const orgId = '00000000-0000-0000-0000-000000000001';

  const { data, error } = await supabase
    .from('objection_library')
    .upsert({
      org_id: orgId,
      label: body.label,
      display_name: body.display_name || body.label.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      category: body.category || 'other',
      raw_phrasings: body.raw_phrasings || [],
      current_handling_methods: body.current_handling_methods || [],
      strong_response_examples: body.strong_response_examples || [],
      weak_response_examples: body.weak_response_examples || [],
      ad_angle_ideas: body.ad_angle_ideas || [],
      coaching_notes: body.coaching_notes || null,
      created_by: userId,
    }, {
      onConflict: 'org_id,label',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data!.id }, { status: 201 });
}
