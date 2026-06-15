import type { GaugeBand } from './types';

export interface GaugeThresholds {
  readonly red: readonly [number, number];
  readonly amber: readonly [number, number];
  readonly green: readonly [number, number];
}

export const closeRateThresholds: GaugeThresholds = {
  red: [0, 10],
  amber: [10, 30],
  green: [30, 100],
};

export const showRateThresholds: GaugeThresholds = {
  red: [0, 40],
  amber: [40, 70],
  green: [70, 100],
};

export const refundRateThresholds: GaugeThresholds = {
  green: [0, 3],
  amber: [3, 6],
  red: [6, 15],
};

export function thresholdBand(value: number, thresholds: GaugeThresholds): GaugeBand {
  const entries: Array<[GaugeBand, readonly [number, number]]> = [
    ['green', thresholds.green],
    ['amber', thresholds.amber],
    ['red', thresholds.red],
  ];

  const match = entries.find(([, [min, max]]) => value >= min && value < max);
  if (match) return match[0];

  if (value >= thresholds.green[1]) return 'green';
  if (value >= thresholds.red[1]) return 'red';
  return 'red';
}
