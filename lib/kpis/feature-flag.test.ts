import { describe, expect, it, vi } from 'vitest';

describe('KPI preview feature flags', () => {
  it('disables all KPI preview routes by default', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'false');
    vi.stubEnv('FEATURE_MERGED_KPI_DASHBOARD', 'false');
    vi.stubEnv('FEATURE_KPI_TRACKER_V2', 'false');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled, isMergedKpiDashboardPreviewEnabled, isKpiTrackerV2Enabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(false);
    expect(isMergedKpiDashboardPreviewEnabled()).toBe(false);
    expect(isKpiTrackerV2Enabled()).toBe(false);
  });

  it('enables the hidden KPI preview only with the explicit KPI feature flag', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'true');
    vi.stubEnv('FEATURE_MERGED_KPI_DASHBOARD', 'false');
    vi.stubEnv('FEATURE_KPI_TRACKER_V2', 'false');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled, isMergedKpiDashboardPreviewEnabled, isKpiTrackerV2Enabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(true);
    expect(isMergedKpiDashboardPreviewEnabled()).toBe(true);
    expect(isKpiTrackerV2Enabled()).toBe(false);
  });

  it('enables the merged preview with its dedicated feature flag without enabling the separate KPI Tracker', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'false');
    vi.stubEnv('FEATURE_MERGED_KPI_DASHBOARD', 'true');
    vi.stubEnv('FEATURE_KPI_TRACKER_V2', 'false');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled, isMergedKpiDashboardPreviewEnabled, isKpiTrackerV2Enabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(false);
    expect(isMergedKpiDashboardPreviewEnabled()).toBe(true);
    expect(isKpiTrackerV2Enabled()).toBe(false);
  });

  it('enables the separate KPI Tracker only with FEATURE_KPI_TRACKER_V2=true', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'false');
    vi.stubEnv('FEATURE_MERGED_KPI_DASHBOARD', 'false');
    vi.stubEnv('FEATURE_KPI_TRACKER_V2', 'true');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled, isMergedKpiDashboardPreviewEnabled, isKpiTrackerV2Enabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(false);
    expect(isMergedKpiDashboardPreviewEnabled()).toBe(false);
    expect(isKpiTrackerV2Enabled()).toBe(true);
  });
});
