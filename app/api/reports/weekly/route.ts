import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { generateWeeklyReport, saveWeeklyReport } from '@/lib/scoring/weekly-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/weekly
 *
 * Get weekly reports. Query: week_start (YYYY-MM-DD), or latest if omitted.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('week_start');

  const supabase = await createServiceClient();
  const orgId = '00000000-0000-0000-0000-000000000001';

  let query = supabase
    .from('weekly_reports')
    .select('*')
    .eq('org_id', orgId)
    .order('week_start', { ascending: false });

  if (weekStart) {
    query = query.eq('week_start', weekStart);
  } else {
    query = query.limit(4); // Last 4 weeks
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/**
 * POST /api/reports/weekly
 *
 * Generate a weekly report for a given week.
 * Body: { week_start?: string } — defaults to current week
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const supabase = await createServiceClient();
  const orgId = '00000000-0000-0000-0000-000000000001';

  // Calculate week boundaries
  let weekStart: Date;
  if (body.week_start) {
    weekStart = new Date(body.week_start);
  } else {
    // Default to Monday of current week
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0
    weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
  }
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  try {
    const report = await generateWeeklyReport(supabase, orgId, weekStart, weekEnd);
    const { id, error } = await saveWeeklyReport(supabase, orgId, report, weekStart, weekEnd);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ id, report }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
