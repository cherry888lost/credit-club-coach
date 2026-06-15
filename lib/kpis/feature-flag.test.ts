import { describe, expect, it, vi } from 'vitest';

describe('KPI preview feature flag', () => {
  it('is disabled by default unless FEATURE_KPI_READONLY_MODULE=true', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'false');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(false);
  });

  it('enables the hidden preview only with the explicit feature flag', async () => {
    vi.stubEnv('FEATURE_KPI_READONLY_MODULE', 'true');
    vi.resetModules();
    const { isKpiReadonlyPreviewEnabled } = await import('./field-map');
    expect(isKpiReadonlyPreviewEnabled()).toBe(true);
  });
});
