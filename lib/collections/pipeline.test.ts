import { describe, expect, it } from 'vitest';
import { filterCollectionsForUser } from './permissions';
import type { CollectionRecord, CollectionsUserContext } from './types';
import {
  buildCollectionSummary,
  filterCollectionPipeline,
  shouldShowCollectedForStatusFilter,
} from './pipeline';

const admin: CollectionsUserContext = { repId: 'admin', isAdmin: true };
const closerA: CollectionsUserContext = { repId: 'closer-a', isAdmin: false };

const records: CollectionRecord[] = [
  {
    id: 'open-a',
    client_name: 'Open A',
    owner_user_id: 'closer-a',
    total_sale_value: 3000,
    amount_paid: 500,
    balance_due: 2500,
    status: 'Open',
    risk: 'Medium',
    collection_type: 'Deposit then balance',
    created_at: '2026-06-21T09:00:00Z',
  },
  {
    id: 'collected-a',
    client_name: 'Magdi Fernandes',
    owner_user_id: 'closer-a',
    total_sale_value: 3000,
    amount_paid: 3000,
    balance_due: 0,
    status: 'Collected',
    risk: 'Low',
    collection_type: 'Deposit then balance',
    created_at: '2026-06-20T09:00:00Z',
  },
  {
    id: 'collected-b',
    client_name: 'Collected B',
    owner_user_id: 'closer-b',
    total_sale_value: 3000,
    amount_paid: 3000,
    balance_due: 0,
    status: 'Collected',
    risk: 'Low',
    collection_type: 'Partial access collection',
    created_at: '2026-06-14T09:00:00Z',
  },
  {
    id: 'overdue-a',
    client_name: 'Overdue A',
    owner_user_id: 'closer-a',
    total_sale_value: 3000,
    amount_paid: 1000,
    balance_due: 2000,
    status: 'Open',
    balance_due_date: '2026-01-01',
    risk: 'High',
    collection_type: 'Payment plan',
    created_at: '2026-05-20T09:00:00Z',
  },
  {
    id: 'older-open-a',
    client_name: 'Older Open A',
    owner_user_id: 'closer-a',
    total_sale_value: 3000,
    amount_paid: 1000,
    balance_due: 2000,
    status: 'Open',
    risk: 'Low',
    collection_type: 'Manual invoice',
    created_at: '2026-04-15T09:00:00Z',
  },
];

describe('collections pipeline filtering', () => {
  it('hides status = Collected records by default', () => {
    const visible = filterCollectionPipeline(records, { showCollected: false }, new Date('2026-06-21T00:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['open-a', 'overdue-a', 'older-open-a']);
  });

  it('shows collected records when Show collected is enabled', () => {
    const visible = filterCollectionPipeline(records, { showCollected: true }, new Date('2026-06-21T00:00:00Z'));

    expect(visible.map((record) => record.id)).toContain('collected-a');
    expect(visible.map((record) => record.id)).toContain('collected-b');
  });

  it('hides collected records again when the toggle is off', () => {
    const visible = filterCollectionPipeline(records, { showCollected: false }, new Date('2026-06-21T00:00:00Z'));

    expect(visible.some((record) => record.id.startsWith('collected'))).toBe(false);
  });

  it('treats selecting the Collected status filter as an explicit request to show collected', () => {
    expect(shouldShowCollectedForStatusFilter('Collected', false)).toBe(true);

    const visible = filterCollectionPipeline(records, { statusFilter: 'Collected', showCollected: false }, new Date('2026-06-21T00:00:00Z'));
    expect(visible.map((record) => record.id)).toEqual(['collected-a', 'collected-b']);
  });

  it('removes a newly collected record from the default active pipeline without deleting it from local state', () => {
    const updated = records.map((record) => record.id === 'open-a'
      ? { ...record, status: 'Collected', amount_paid: record.total_sale_value, balance_due: 0 }
      : record);

    const visible = filterCollectionPipeline(updated, { showCollected: false }, new Date('2026-06-21T00:00:00Z'));

    expect(updated.find((record) => record.id === 'open-a')).toBeTruthy();
    expect(visible.map((record) => record.id)).not.toContain('open-a');
  });

  it('lets admins include collected records across all permitted owners', () => {
    const permitted = filterCollectionsForUser(records, admin);
    const visible = filterCollectionPipeline(permitted, { showCollected: true }, new Date('2026-06-21T00:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(expect.arrayContaining(['collected-a', 'collected-b']));
  });

  it('lets non-admins include only their own collected records after server-side permission filtering', () => {
    const permitted = filterCollectionsForUser(records, closerA);
    const visible = filterCollectionPipeline(permitted, { showCollected: true }, new Date('2026-06-21T00:00:00Z'));

    expect(visible.map((record) => record.id)).toContain('collected-a');
    expect(visible.map((record) => record.id)).not.toContain('collected-b');
  });

  it('does not count collected records as active outstanding balance in summary cards', () => {
    const visible = filterCollectionPipeline(records, { showCollected: true }, new Date('2026-06-21T00:00:00Z'));
    const summary = buildCollectionSummary(visible, new Date('2026-06-21T00:00:00Z'));

    expect(summary.outstandingBalance).toBe(6500);
    expect(summary.activeCount).toBe(3);
    expect(summary.activeRecords.map((record) => record.id)).toEqual(['open-a', 'overdue-a', 'older-open-a']);
  });

  it('all time shows all permitted active records', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'all' }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['open-a', 'overdue-a', 'older-open-a']);
  });

  it('today filter shows only records created today', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'today' }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['open-a']);
  });

  it('last 7 days filter shows only records created in the last 7 days', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'last7', showCollected: true }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['open-a', 'collected-a', 'collected-b']);
  });

  it('last 30 days filter shows only records created in the last 30 days', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'last30', showCollected: true }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['open-a', 'collected-a', 'collected-b']);
  });

  it('this month filter shows records from the current calendar month', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'thisMonth', showCollected: true }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['open-a', 'collected-a', 'collected-b']);
  });

  it('custom range filters records between from/to date-added dates', () => {
    const visible = filterCollectionPipeline(records, {
      dateAddedFilter: 'custom',
      dateAddedFrom: '2026-06-14',
      dateAddedTo: '2026-06-20',
      showCollected: true,
    }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['collected-a', 'collected-b']);
  });

  it('date filter combines with search', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'last7', query: 'magdi', showCollected: true }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['collected-a']);
  });

  it('date filter combines with status', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'last7', statusFilter: 'Collected' }, new Date('2026-06-21T12:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['collected-a', 'collected-b']);
  });

  it('date filter combines with Show collected', () => {
    const hiddenCollected = filterCollectionPipeline(records, { dateAddedFilter: 'last7', showCollected: false }, new Date('2026-06-21T12:00:00Z'));
    const visibleCollected = filterCollectionPipeline(records, { dateAddedFilter: 'last7', showCollected: true }, new Date('2026-06-21T12:00:00Z'));

    expect(hiddenCollected.map((record) => record.id)).toEqual(['open-a']);
    expect(visibleCollected.map((record) => record.id)).toEqual(['open-a', 'collected-a', 'collected-b']);
  });

  it('admin date filter keeps all permitted owners visible while non-admin date filter only filters their own records', () => {
    const adminVisible = filterCollectionPipeline(filterCollectionsForUser(records, admin), { dateAddedFilter: 'last7', showCollected: true }, new Date('2026-06-21T12:00:00Z'));
    const closerVisible = filterCollectionPipeline(filterCollectionsForUser(records, closerA), { dateAddedFilter: 'last7', showCollected: true }, new Date('2026-06-21T12:00:00Z'));

    expect(adminVisible.map((record) => record.id)).toEqual(['open-a', 'collected-a', 'collected-b']);
    expect(closerVisible.map((record) => record.id)).toEqual(['open-a', 'collected-a']);
    expect(closerVisible.map((record) => record.id)).not.toContain('collected-b');
  });

  it('summary cards update based on date-filtered active records', () => {
    const visible = filterCollectionPipeline(records, { dateAddedFilter: 'today', showCollected: true }, new Date('2026-06-21T12:00:00Z'));
    const summary = buildCollectionSummary(visible, new Date('2026-06-21T12:00:00Z'));

    expect(summary.activeRecords.map((record) => record.id)).toEqual(['open-a']);
    expect(summary.outstandingBalance).toBe(2500);
    expect(summary.depositsCollected).toBe(500);
  });
});
