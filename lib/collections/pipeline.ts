import type { CollectionRecord } from './types';
import { collectionBucket, computedCollectionStatus, daysUntil, outstandingBalance } from './format';

export type DateAddedFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export type CollectionPipelineFilters = {
  query?: string;
  statusFilter?: string;
  riskFilter?: string;
  typeFilter?: string;
  ownerFilter?: string;
  showCollected?: boolean;
  dateAddedFilter?: DateAddedFilter | '';
  dateAddedFrom?: string;
  dateAddedTo?: string;
};

export type CollectionPipelineSummary = {
  activeRecords: CollectionRecord[];
  overdueRecords: CollectionRecord[];
  dueNextSevenDaysRecords: CollectionRecord[];
  outstandingBalance: number;
  overdueBalance: number;
  dueNextSevenDaysBalance: number;
  depositsCollected: number;
  activeCount: number;
};

export function shouldShowCollectedForStatusFilter(statusFilter: string | null | undefined, showCollected: boolean): boolean {
  return showCollected || statusFilter === 'Collected';
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseLocalDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function createdAtDate(record: CollectionRecord): Date | null {
  if (!record.created_at) return null;
  const date = new Date(record.created_at);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateAddedRange(filters: CollectionPipelineFilters, now: Date): { start?: Date; end?: Date } | null {
  const filter = filters.dateAddedFilter || 'all';
  if (filter === 'all') return null;

  const today = startOfLocalDay(now);
  if (filter === 'today') return { start: today, end: addDays(today, 1) };
  if (filter === 'yesterday') return { start: addDays(today, -1), end: today };
  if (filter === 'last7') return { start: addDays(today, -7), end: addDays(today, 1) };
  if (filter === 'last30') return { start: addDays(today, -30), end: addDays(today, 1) };
  if (filter === 'thisMonth') return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: addDays(today, 1) };

  const start = filters.dateAddedFrom ? parseLocalDate(filters.dateAddedFrom) ?? undefined : undefined;
  const end = filters.dateAddedTo ? addDays(parseLocalDate(filters.dateAddedTo) ?? today, 1) : undefined;
  if (!start && !end) return null;
  return { start, end };
}

function matchesDateAddedFilter(record: CollectionRecord, range: { start?: Date; end?: Date } | null): boolean {
  if (!range) return true;
  const createdAt = createdAtDate(record);
  if (!createdAt) return false;
  if (range.start && createdAt < range.start) return false;
  if (range.end && createdAt >= range.end) return false;
  return true;
}

export function filterCollectionPipeline(
  records: CollectionRecord[],
  filters: CollectionPipelineFilters = {},
  now = new Date(),
): CollectionRecord[] {
  const q = (filters.query || '').trim().toLowerCase();
  const includeCollected = shouldShowCollectedForStatusFilter(filters.statusFilter, Boolean(filters.showCollected));
  const addedRange = dateAddedRange(filters, now);

  return records.filter((record) => {
    const status = computedCollectionStatus(record, now);
    const hay = [record.client_name, record.telegram, record.phone_number, record.owner_name, record.collection_type, record.notes]
      .join(' ')
      .toLowerCase();

    if (!includeCollected && status === 'Collected') return false;
    if (!matchesDateAddedFilter(record, addedRange)) return false;

    return (!q || hay.includes(q))
      && (!filters.statusFilter || status === filters.statusFilter)
      && (!filters.riskFilter || record.risk === filters.riskFilter)
      && (!filters.typeFilter || collectionBucket(record.collection_type) === filters.typeFilter)
      && (!filters.ownerFilter || record.owner_user_id === filters.ownerFilter);
  }).sort((a, b) => outstandingBalance(b) - outstandingBalance(a));
}

export function buildCollectionSummary(records: CollectionRecord[], now = new Date()): CollectionPipelineSummary {
  const activeRecords = records.filter((record) => !['Collected', 'Cancelled'].includes(computedCollectionStatus(record, now)));
  const overdueRecords = activeRecords.filter((record) => computedCollectionStatus(record, now) === 'Overdue');
  const dueNextSevenDaysRecords = activeRecords.filter((record) => {
    const d = daysUntil(record.balance_due_date, now);
    return d !== null && d >= 0 && d <= 7;
  });

  return {
    activeRecords,
    overdueRecords,
    dueNextSevenDaysRecords,
    outstandingBalance: activeRecords.reduce((sum, record) => sum + outstandingBalance(record), 0),
    overdueBalance: overdueRecords.reduce((sum, record) => sum + outstandingBalance(record), 0),
    dueNextSevenDaysBalance: dueNextSevenDaysRecords.reduce((sum, record) => sum + outstandingBalance(record), 0),
    depositsCollected: activeRecords.reduce((sum, record) => sum + Number(record.amount_paid || 0), 0),
    activeCount: activeRecords.length,
  };
}
