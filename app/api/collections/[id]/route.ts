import { NextRequest } from 'next/server';
import { deleteCollection, getCollectionById, jsonResult, updateCollection } from '@/lib/collections/data';
import { resolveViewAsContextFromRequest } from '@/lib/dashboard/view-as';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewAsContext = await resolveViewAsContextFromRequest(request.nextUrl.searchParams.get('view_as'));
    return jsonResult(await getCollectionById(id, { viewAsContext }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (request.nextUrl.searchParams.get('view_as')) {
      return Response.json({ error: 'Exit view-as mode to make admin changes' }, { status: 403 });
    }
    const { id } = await params;
    return jsonResult(await updateCollection(id, await request.json()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (request.nextUrl.searchParams.get('view_as')) {
      return Response.json({ error: 'Exit view-as mode to make admin changes' }, { status: 403 });
    }
    const { id } = await params;
    return jsonResult(await deleteCollection(id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
