import { describe, expect, it } from 'vitest';
import { getPhase2BBetaStatus, getUnsupportedFilterWarning, getUserAcceptanceChecklist, getLaunchReadinessChecklist } from './beta-status';

describe('Phase 2C beta status model', () => {
  it('labels the internal beta as read-only and not a production replacement', () => {
    const status = getPhase2BBetaStatus();

    expect(status.banner).toContain('Internal merged dashboard beta');
    expect(status.banner).toContain('Read-only');
    expect(status.banner).toContain('Old KPI tracker remains source of truth');
    expect(status.productionReady).toBe(false);
    expect(status.bigQueryMode).toBe('read-only');
  });

  it('keeps accepted parity gaps visible as pending or partial', () => {
    const status = getPhase2BBetaStatus();

    expect(status.parityItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Closer parity', state: 'mostly-verified' }),
        expect.objectContaining({ label: 'Formatting parity', state: 'verified' }),
        expect.objectContaining({ label: 'SDR parity', state: 'pending' }),
        expect.objectContaining({ label: 'Business Performance parity', state: 'pending' }),
        expect.objectContaining({ label: 'Refund/ad-spend parity', state: 'pending' }),
        expect.objectContaining({ label: 'Historical role parity', state: 'pending' }),
        expect.objectContaining({ label: 'Admin/write workflows', state: 'not-migrated' }),
        expect.objectContaining({ label: 'Production launch', state: 'not-approved' }),
      ]),
    );
  });

  it('warns instead of calculating silently for unsupported team scope', () => {
    const warning = getUnsupportedFilterWarning({ team: 'Team A', teamMember: 'All', role: 'all' });

    expect(warning).toContain('unsupported');
    expect(warning).toContain('Team A');
    expect(warning).toContain('no KPI value should be treated as final');
  });

  it('provides manager review and launch-readiness checklist items', () => {
    expect(getUserAcceptanceChecklist()).toContain('Review Sales Tracker section without expecting changed sales formulas.');
    expect(getLaunchReadinessChecklist()).toContain('Complete SDR dashboard parity.');
    expect(getLaunchReadinessChecklist()).toContain('Approve BigQuery write/admin input strategy before any write workflow exists.');
  });
});
