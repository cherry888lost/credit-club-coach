import { NextRequest } from 'next/server';
import { importCollections, jsonResult } from '@/lib/collections/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('view_as')) {
      return Response.json({ error: 'Exit view-as mode to make admin changes' }, { status: 403 });
    }
    const body = await request.json();
    return jsonResult(await importCollections(Array.isArray(body) ? body : body.collections));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
