import { NextRequest } from 'next/server';
import { exportCollections, jsonResult } from '@/lib/collections/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('view_as')) {
      return Response.json({ error: 'Exit view-as mode to make admin changes' }, { status: 403 });
    }
    return jsonResult(await exportCollections());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
