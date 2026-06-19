import { NextRequest } from 'next/server';
import { createCollection, jsonResult, listCollections } from '@/lib/collections/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const collections = await listCollections();
    return Response.json({ collections });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return jsonResult(await createCollection(await request.json()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
