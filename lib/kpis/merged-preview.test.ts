import { describe, expect, it } from 'vitest';
import { buildMergedDashboardModel } from './merged-preview';
import { normalizeMergedPreviewFilters } from './filters';

describe('merged dashboard model', () => {
  it('builds a read-only preview model with gap warnings', () => {
    const model = buildMergedDashboardModel({ filters: normalizeMergedPreviewFilters({}) });

    expect(model.warnings.join(' ')).toContain('Internal merged dashboard beta');
    expect(model.warnings.join(' ')).toContain('SDR, Business Performance, refund/ad-spend');
    expect(model.betaStatus.productionReady).toBe(false);
    expect(model.salesMetrics[0].value).toBe('Existing routes intact');
    expect(model.closerMetrics.some((metric) => metric.status === 'confirmed')).toBe(true);
    expect(model.sdrMetrics.every((metric) => metric.status === 'gap')).toBe(true);
  });

  it('uses legacy-compatible display formatting in preview cards', () => {
    const model = buildMergedDashboardModel({ filters: normalizeMergedPreviewFilters({}) });

    const closerCash = model.closerMetrics.find((metric) => metric.label === 'First Call Cash');
    const closerShowRate = model.closerMetrics.find((metric) => metric.label === 'Show Up Rate');

    expect(closerCash?.value).toMatch(/^£/);
    expect(closerShowRate?.value).toMatch(/%$/);
  });
});
