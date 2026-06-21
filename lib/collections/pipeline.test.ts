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
  },
];

describe('collections pipeline filtering', () => {
  it('hides status = Collected records by default', () => {
    const visible = filterCollectionPipeline(records, { showCollected: false }, new Date('2026-06-21T00:00:00Z'));

    expect(visible.map((record) => record.id)).toEqual(['open-a', 'overdue-a']);
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

    expect(summary.outstandingBalance).toBe(4500);
    expect(summary.activeCount).toBe(2);
    expect(summary.activeRecords.map((record) => record.id)).toEqual(['open-a', 'overdue-a']);
  });
});
