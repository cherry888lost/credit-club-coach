import type { GaugeThresholds } from './thresholds';
import { thresholdBand } from './thresholds';
import type {
  AdSpendSummary,
  BusinessPerformanceMetrics,
  GaugeBand,
  KpiSummaryRow,
  KpiTotals,
} from './types';

function sum(rows: KpiSummaryRow[], selector: (row: KpiSummaryRow) => number): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function calculateFirstCallCash(row: KpiSummaryRow): number {
  return row.nfRevenue;
}

export function calculateRecoveryCash(row: KpiSummaryRow): number {
  return row.sccRevenue + row.eccRevenue;
}

export function calculatePotentialRevenue(row: KpiSummaryRow): number {
  return Math.max(0, row.nfPotentialRevenue + row.sccPotentialRevenue - row.eccRevenue);
}

export function calculateFirstCallCloseCustomers(row: KpiSummaryRow): number {
  return row.nfFullClose + row.nfPartial + row.nfDeposit + row.nfPaymentPlan;
}

export function calculateSecondCallCloseCustomers(row: KpiSummaryRow): number {
  return row.sccFullClose + row.sccPartial + row.sccDeposit + row.sccPaymentPlan;
}

export function calculateNewCustomers(row: KpiSummaryRow): number {
  return calculateFirstCallCloseCustomers(row) + calculateSecondCallCloseCustomers(row);
}

export function calculateCloseRate(row: KpiSummaryRow): number {
  return safeDivide(calculateFirstCallCloseCustomers(row), row.nfLiveCalls) * 100;
}

export function calculateShowUpRate(row: KpiSummaryRow): number {
  return safeDivide(row.totalLiveCalls, row.totalScheduledCalls) * 100;
}

export function calculateRefundRate(row: KpiSummaryRow): number {
  return safeDivide(row.refundCount, calculateNewCustomers(row)) * 100;
}

export function calculateGaugeBand(value: number, thresholds: GaugeThresholds): GaugeBand {
  return thresholdBand(value, thresholds);
}

export function sumKpiRows(rows: KpiSummaryRow[]): KpiTotals {
  const firstCallCash = sum(rows, calculateFirstCallCash);
  const recoveryCash = sum(rows, calculateRecoveryCash);
  const totalCash = sum(rows, (row) => row.totalRevenue);
  const rawPotentialRevenue = sum(rows, (row) => row.nfPotentialRevenue + row.sccPotentialRevenue - row.eccRevenue);
  const newCustomers = sum(rows, calculateNewCustomers);
  const firstCallCloseCustomers = sum(rows, calculateFirstCallCloseCustomers);
  const scheduledCalls = sum(rows, (row) => row.totalScheduledCalls);
  const liveCalls = sum(rows, (row) => row.totalLiveCalls);
  const nfLiveCalls = sum(rows, (row) => row.nfLiveCalls);
  const refundCount = sum(rows, (row) => row.refundCount);
  const refundAmount = sum(rows, (row) => row.refundAmount);

  return {
    firstCallCash,
    recoveryCash,
    totalCash,
    potentialRevenue: Math.max(0, rawPotentialRevenue),
    newCustomers,
    firstCallCloseCustomers,
    scheduledCalls,
    liveCalls,
    nfLiveCalls,
    refundCount,
    refundAmount,
    showUpRate: safeDivide(liveCalls, scheduledCalls) * 100,
    closeRate: safeDivide(firstCallCloseCustomers, nfLiveCalls) * 100,
    refundRate: safeDivide(refundCount, newCustomers) * 100,
    arpu: safeDivide(totalCash, newCustomers),
  };
}

export function calculateArpu(rows: KpiSummaryRow[]): number {
  const totals = sumKpiRows(rows);
  return totals.arpu;
}

export function calculateCashCollected(closerRows: KpiSummaryRow[]): number {
  return sum(closerRows, calculateFirstCallCash);
}

export function calculateRecoveredCash(closerRows: KpiSummaryRow[], sdrRows: KpiSummaryRow[]): number {
  return sum(closerRows, calculateRecoveryCash) + sum(sdrRows, (row) => row.totalRevenue);
}

export function calculateCac(totalAdSpend: number, closerRows: KpiSummaryRow[]): number {
  const firstCallCloses = sum(closerRows, calculateFirstCallCloseCustomers);
  return safeDivide(totalAdSpend, firstCallCloses);
}

export function calculateRoas(closerRows: KpiSummaryRow[], totalAdSpend: number): number {
  return safeDivide(calculateCashCollected(closerRows), totalAdSpend);
}

export function calculateBusinessPerformance(
  closerRows: KpiSummaryRow[],
  sdrRows: KpiSummaryRow[],
  adSpend: AdSpendSummary,
): BusinessPerformanceMetrics {
  const closerTotals = sumKpiRows(closerRows);
  const sdrTotals = sumKpiRows(sdrRows);
  const cashCollected = calculateCashCollected(closerRows);
  const recoveredCash = calculateRecoveredCash(closerRows, sdrRows);
  const totalCash = cashCollected + recoveredCash;
  const totalNewCustomers = closerTotals.newCustomers + sdrTotals.newCustomers;
  const totalRefundCount = closerTotals.refundCount + sdrTotals.refundCount;
  const totalRefundAmount = closerTotals.refundAmount + sdrTotals.refundAmount;

  return {
    cashCollected,
    recoveredCash,
    totalCash,
    totalNewCustomers,
    totalRefundCount,
    totalRefundAmount,
    refundRate: safeDivide(totalRefundCount, totalNewCustomers) * 100,
    arpu: safeDivide(totalCash, totalNewCustomers),
    totalAdSpend: adSpend.totalAdSpend,
    totalLeads: adSpend.totalLeads,
    cac: calculateCac(adSpend.totalAdSpend, closerRows),
    blendedCac: safeDivide(adSpend.totalAdSpend, totalNewCustomers),
    roas: calculateRoas(closerRows, adSpend.totalAdSpend),
  };
}
