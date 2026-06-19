import { NextRequest } from 'next/server';
import { createCollection, jsonResult, listCollections } from '@/lib/collections/data';
import { resolveViewAsContextFromRequest } from '@/lib/dashboard/view-as';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const requestedViewAs = request.nextUrl.searchParams.get('view_as');
    const viewAsContext = await resolveViewAsContextFromRequest(requestedViewAs);
    const collections = await listCollections({ viewAsContext });
    return Response.json({ collections, viewAsContext });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('view_as')) {
      return Response.json({ error: 'Exit view-as mode to make admin changes' }, { status: 403 });
    }
    return jsonResult(await createCollection(await request.json()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
