import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync('app/dashboard/merged-preview/page.tsx', 'utf8');

describe('merged preview UI boundaries', () => {
  it('does not import KPI calculation helpers directly into the UI route', () => {
    expect(pageSource).not.toContain('calculateBusinessPerformance');
    expect(pageSource).not.toContain('sumKpiRows');
    expect(pageSource).not.toContain('formatKpiCurrency');
    expect(pageSource).not.toContain('formatKpiPercent');
  });

  it('keeps mutation verbs out of the merged preview route', () => {
    expect(pageSource).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bMERGE\b|\bCREATE\b|\bDROP\b|\bALTER\b|\bTRUNCATE\b/i);
  });
});
