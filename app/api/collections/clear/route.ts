import { NextRequest } from 'next/server';
import { clearCollections, jsonResult } from '@/lib/collections/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return jsonResult(await clearCollections(body?.confirmed === true));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
