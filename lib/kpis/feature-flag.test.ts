import { describe, expect, it, vi } from 'vitest';

describe('KPI preview feature flag', () => {
  it('is disabled by default unless FEATURE_KPI_READONLY_MODULE=true', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'false');
    vi.stubEnv('FEATURE_MERGED_KPI_DASHBOARD', 'false');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled, isMergedKpiDashboardPreviewEnabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(false);
    expect(isMergedKpiDashboardPreviewEnabled()).toBe(false);
  });

  it('enables the hidden KPI preview only with the explicit KPI feature flag', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'true');
    vi.stubEnv('FEATURE_MERGED_KPI_DASHBOARD', 'false');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled, isMergedKpiDashboardPreviewEnabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(true);
    expect(isMergedKpiDashboardPreviewEnabled()).toBe(true);
  });

  it('enables the merged preview with its dedicated feature flag', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'false');
    vi.stubEnv('FEATURE_MERGED_KPI_DASHBOARD', 'true');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled, isMergedKpiDashboardPreviewEnabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(false);
    expect(isMergedKpiDashboardPreviewEnabled()).toBe(true);
  });
});
