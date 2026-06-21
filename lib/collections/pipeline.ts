import type { CollectionRecord } from './types';
import { collectionBucket, computedCollectionStatus, daysUntil, outstandingBalance } from './format';

export type CollectionPipelineFilters = {
  query?: string;
  statusFilter?: string;
  riskFilter?: string;
  typeFilter?: string;
  ownerFilter?: string;
  showCollected?: boolean;
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

export function filterCollectionPipeline(
  records: CollectionRecord[],
  filters: CollectionPipelineFilters = {},
  now = new Date(),
): CollectionRecord[] {
  const q = (filters.query || '').trim().toLowerCase();
  const includeCollected = shouldShowCollectedForStatusFilter(filters.statusFilter, Boolean(filters.showCollected));

  return records.filter((record) => {
    const status = computedCollectionStatus(record, now);
    const hay = [record.client_name, record.telegram, record.phone_number, record.owner_name, record.collection_type, record.notes]
      .join(' ')
      .toLowerCase();

    if (!includeCollected && status === 'Collected') return false;

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
