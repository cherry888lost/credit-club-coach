import type { CollectionRecord } from './types';

export function outstandingBalance(record: Pick<CollectionRecord, 'total_sale_value' | 'amount_paid' | 'balance_due'>): number {
  if (typeof record.balance_due === 'number') return Math.max(0, record.balance_due);
  return Math.max(0, Number(record.total_sale_value || 0) - Number(record.amount_paid || 0));
}

export function daysUntil(date: string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  const target = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function computedCollectionStatus(record: CollectionRecord, now = new Date()): string {
  const explicit = record.status || 'Open';
  if (explicit === 'Collected' || outstandingBalance(record) <= 0) return 'Collected';
  if (explicit === 'Failed Payment' || explicit === 'Refund Risk' || explicit === 'Cancelled') return explicit;
  const d = daysUntil(record.balance_due_date, now);
  if (d !== null && d < 0) return 'Overdue';
  if (d !== null && d <= 3) return 'Due Soon';
  return explicit;
}

export function collectionBucket(type: string | null | undefined): 'plan' | 'deposit' | 'other' {
  const value = String(type || '').toLowerCase();
  if (value.includes('payment plan')) return 'plan';
  if (value.includes('deposit') || value.includes('balance') || value.includes('split pay') || value.includes('partial access')) return 'deposit';
  return 'other';
}

export function formatGbp(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(value || 0));
}
