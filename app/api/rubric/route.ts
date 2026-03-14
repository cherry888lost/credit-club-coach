import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/rubric
 *
 * Get the active master rubric.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('master_rubric')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/**
 * PUT /api/rubric
 *
 * Update the active rubric (creates a new version).
 */
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createServiceClient();
  const orgId = '00000000-0000-0000-0000-000000000001';

  // Deactivate current rubric
  const { data: current } = await supabase
    .from('master_rubric')
    .select('version')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .single();

  const currentVersion = current?.version || 0;

  await supabase
    .from('master_rubric')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('is_active', true);

  // Create new version
  const { data, error } = await supabase
    .from('master_rubric')
    .insert({
      org_id: orgId,
      version: currentVersion + 1,
      is_active: true,
      categories: body.categories,
      quality_thresholds: body.quality_thresholds || undefined,
      disqualification_rules: body.disqualification_rules || undefined,
      low_signal_criteria: body.low_signal_criteria || undefined,
      notes: body.notes || null,
      created_by: userId,
    })
    .select('id, version')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
