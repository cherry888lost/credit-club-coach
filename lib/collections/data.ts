import { NextResponse } from 'next/server';
import { DEFAULT_ORG_ID, isAdmin, requireAuth, type CurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { canAccessCollection, canAssignCollectionOwner, resolveCreateOwnerUserId } from './permissions';
import type { CollectionInput, CollectionRecord, CollectionsUserContext } from './types';

export type CollectionActionResult<T> = { data: T; status?: number } | { error: string; status: number };

export function userToCollectionsContext(user: CurrentUser): CollectionsUserContext {
  if (!user.rep) throw new Error('No active account');
  return { repId: user.rep.id, isAdmin: isAdmin(user) };
}

export function jsonResult<T>(result: CollectionActionResult<T>) {
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status || 200 });
}

const collectionSelect = `
  id, org_id, legacy_google_sheet_id, client_name, telegram, phone_number,
  owner_user_id, owner_name, owner_role,
  total_sale_value, amount_paid, balance_due, collection_type,
  sale_date, balance_due_date, next_follow_up_date,
  risk, status, payment_link, notes, source,
  created_by, updated_by, created_at, updated_at
`;

function normalizeMoney(value: unknown): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

type RepIdentity = { id: string; name: string; role?: string | null; sales_role?: string | null };

async function repIdentityMap(ids: Array<string | null | undefined>) {
  const clean = [...new Set(ids.filter(Boolean) as string[])];
  if (clean.length === 0) return new Map<string, RepIdentity>();
  const supabase = await createServiceClient();
  const { data } = await supabase.from('reps').select('id,name,role,sales_role').in('id', clean);
  return new Map(((data || []) as RepIdentity[]).map((rep) => [rep.id, rep]));
}

export async function listRepsForCollections() {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  const supabase = await createServiceClient();
  let query = supabase
    .from('reps')
    .select('id,name,email,role,sales_role,status')
    .eq('org_id', DEFAULT_ORG_ID)
    .eq('status', 'active')
    .order('name');

  if (!context.isAdmin) query = query.eq('id', context.repId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listCollections(): Promise<CollectionRecord[]> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  const supabase = await createServiceClient();
  let query = supabase
    .from('collections')
    .select(collectionSelect)
    .eq('org_id', DEFAULT_ORG_ID)
    .order('updated_at', { ascending: false });

  if (!context.isAdmin) {
    query = query.eq('owner_user_id', context.repId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CollectionRecord[];
}

export async function getCollectionById(id: string): Promise<CollectionActionResult<{ collection: CollectionRecord }>> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('collections')
    .select(collectionSelect)
    .eq('org_id', DEFAULT_ORG_ID)
    .eq('id', id)
    .single();

  if (error || !data) return { error: 'Collection not found', status: 404 };
  const collection = data as CollectionRecord;
  if (!canAccessCollection(collection, context)) return { error: 'Forbidden', status: 403 };
  return { data: { collection } };
}

export async function createCollection(input: CollectionInput): Promise<CollectionActionResult<{ collection: CollectionRecord }>> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  const requestedOwnerUserId = input.owner_user_id || null;
  const ownerUserId = resolveCreateOwnerUserId(requestedOwnerUserId, context);
  if (!canAssignCollectionOwner({ ownerUserId }, context)) {
    return { error: 'Cannot create an ownerless collection or assign collection to another user', status: 403 };
  }

  const identities = await repIdentityMap([ownerUserId]);
  const owner = ownerUserId ? identities.get(ownerUserId) : null;
  if (ownerUserId && !owner) return { error: 'Owner not found', status: 400 };
  const payload = {
    org_id: DEFAULT_ORG_ID,
    client_name: normalizeText(input.client_name),
    telegram: normalizeText(input.telegram),
    phone_number: normalizeText(input.phone_number),
    owner_user_id: ownerUserId,
    owner_name: owner?.name || null,
    owner_role: owner?.sales_role || owner?.role || null,
    total_sale_value: normalizeMoney(input.total_sale_value),
    amount_paid: normalizeMoney(input.amount_paid),
    collection_type: normalizeText(input.collection_type) || 'Deposit then balance',
    sale_date: normalizeDate(input.sale_date),
    balance_due_date: normalizeDate(input.balance_due_date),
    next_follow_up_date: normalizeDate(input.next_follow_up_date),
    risk: input.risk || 'Medium',
    status: input.status || 'Open',
    payment_link: normalizeText(input.payment_link),
    notes: normalizeText(input.notes),
    source: 'native',
    created_by: context.repId,
    updated_by: context.repId,
  };

  if (!payload.client_name) return { error: 'Client name is required', status: 400 };

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from('collections').insert(payload).select(collectionSelect).single();
  if (error) return { error: error.message, status: 500 };
  return { data: { collection: data as CollectionRecord }, status: 201 };
}

export async function updateCollection(id: string, input: Partial<CollectionInput>): Promise<CollectionActionResult<{ collection: CollectionRecord }>> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  const existingResult = await getCollectionById(id);
  if ('error' in existingResult) return existingResult;
  const existing = existingResult.data.collection;
  if (!canAccessCollection(existing, context)) return { error: 'Forbidden', status: 403 };

  const nextOwner = input.owner_user_id !== undefined ? input.owner_user_id : existing.owner_user_id;
  if (!canAssignCollectionOwner({ ownerUserId: nextOwner || null }, context)) {
    return { error: 'Cannot assign collection to another user', status: 403 };
  }

  const identities = await repIdentityMap([nextOwner]);
  const owner = nextOwner ? identities.get(nextOwner) : null;
  const payload: Record<string, unknown> = {
    updated_by: context.repId,
  };

  if (input.client_name !== undefined) payload.client_name = normalizeText(input.client_name);
  if (input.telegram !== undefined) payload.telegram = normalizeText(input.telegram);
  if (input.phone_number !== undefined) payload.phone_number = normalizeText(input.phone_number);
  if (input.owner_user_id !== undefined) {
    payload.owner_user_id = nextOwner || null;
    payload.owner_name = owner?.name || null;
    payload.owner_role = owner?.sales_role || owner?.role || null;
  }
  if (input.total_sale_value !== undefined) payload.total_sale_value = normalizeMoney(input.total_sale_value);
  if (input.amount_paid !== undefined) payload.amount_paid = normalizeMoney(input.amount_paid);
  if (input.collection_type !== undefined) payload.collection_type = normalizeText(input.collection_type) || 'Deposit then balance';
  if (input.sale_date !== undefined) payload.sale_date = normalizeDate(input.sale_date);
  if (input.balance_due_date !== undefined) payload.balance_due_date = normalizeDate(input.balance_due_date);
  if (input.next_follow_up_date !== undefined) payload.next_follow_up_date = normalizeDate(input.next_follow_up_date);
  if (input.risk !== undefined) payload.risk = input.risk;
  if (input.status !== undefined) payload.status = input.status;
  if (input.payment_link !== undefined) payload.payment_link = normalizeText(input.payment_link);
  if (input.notes !== undefined) payload.notes = normalizeText(input.notes);

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('collections')
    .update(payload)
    .eq('org_id', DEFAULT_ORG_ID)
    .eq('id', id)
    .select(collectionSelect)
    .single();
  if (error) return { error: error.message, status: 500 };
  return { data: { collection: data as CollectionRecord } };
}

export async function deleteCollection(id: string): Promise<CollectionActionResult<{ success: true }>> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  const existingResult = await getCollectionById(id);
  if ('error' in existingResult) return existingResult;
  if (!canAccessCollection(existingResult.data.collection, context)) return { error: 'Forbidden', status: 403 };
  const supabase = await createServiceClient();
  const { error } = await supabase.from('collections').delete().eq('org_id', DEFAULT_ORG_ID).eq('id', id);
  if (error) return { error: error.message, status: 500 };
  return { data: { success: true } };
}

export async function exportCollections(): Promise<CollectionActionResult<{ collections: CollectionRecord[] }>> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  if (!context.isAdmin) return { error: 'Admin access required', status: 403 };
  return { data: { collections: await listCollections() } };
}

export async function clearCollections(confirmed: boolean): Promise<CollectionActionResult<{ success: true }>> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  if (!context.isAdmin) return { error: 'Admin access required', status: 403 };
  if (!confirmed) return { error: 'Confirmation required', status: 400 };
  const supabase = await createServiceClient();
  const { error } = await supabase.from('collections').delete().eq('org_id', DEFAULT_ORG_ID);
  if (error) return { error: error.message, status: 500 };
  return { data: { success: true } };
}

export async function importCollections(records: CollectionInput[]): Promise<CollectionActionResult<{ imported: number }>> {
  const user = await requireAuth();
  const context = userToCollectionsContext(user);
  if (!context.isAdmin) return { error: 'Admin access required', status: 403 };
  if (!Array.isArray(records)) return { error: 'Invalid import payload', status: 400 };
  const supabase = await createServiceClient();
  const ownerIds = records.map((record) => record.owner_user_id || null);
  if (ownerIds.some((ownerId) => !ownerId)) {
    return { error: 'Every imported collection must have an owner_user_id', status: 400 };
  }

  const identities = await repIdentityMap(ownerIds);
  const payload = records.map((record) => {
    const ownerUserId = record.owner_user_id as string;
    const owner = identities.get(ownerUserId);
    if (!owner) throw new Error(`Owner not found for collection import: ${ownerUserId}`);
    return {
      org_id: DEFAULT_ORG_ID,
      client_name: normalizeText(record.client_name),
      telegram: normalizeText(record.telegram),
      phone_number: normalizeText(record.phone_number),
      owner_user_id: ownerUserId,
      owner_name: owner.name,
      owner_role: owner.sales_role || owner.role || null,
      total_sale_value: normalizeMoney(record.total_sale_value),
      amount_paid: normalizeMoney(record.amount_paid),
      collection_type: normalizeText(record.collection_type) || 'Deposit then balance',
      sale_date: normalizeDate(record.sale_date),
      balance_due_date: normalizeDate(record.balance_due_date),
      next_follow_up_date: normalizeDate(record.next_follow_up_date),
      risk: record.risk || 'Medium',
      status: record.status || 'Open',
      payment_link: normalizeText(record.payment_link),
      notes: normalizeText(record.notes),
      source: 'backup_import',
      created_by: context.repId,
      updated_by: context.repId,
    };
  }).filter((record) => record.client_name);

  const { error } = await supabase.from('collections').insert(payload);
  if (error) return { error: error.message, status: 500 };
  return { data: { imported: payload.length }, status: 201 };
}
