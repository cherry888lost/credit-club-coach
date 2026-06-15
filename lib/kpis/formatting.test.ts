import { describe, expect, it } from 'vitest';
import { formatKpiCount, formatKpiCurrency, formatKpiMultiple, formatKpiPercent } from './formatting';

describe('KPI display formatting parity with old Python dashboard f-strings', () => {
  it('formats percentages using Python-style half-even .1f display', () => {
    expect(formatKpiPercent(56.25)).toBe('56.2%');
    expect(formatKpiPercent(56.24)).toBe('56.2%');
    expect(formatKpiPercent(56.26)).toBe('56.3%');
    expect(formatKpiPercent(0)).toBe('0.0%');
  });

  it('formats currency using Python-style half-even ,.0f display', () => {
    expect(formatKpiCurrency(1162.5)).toBe('£1,162');
    expect(formatKpiCurrency(1162.49)).toBe('£1,162');
    expect(formatKpiCurrency(1162.51)).toBe('£1,163');
    expect(formatKpiCurrency(0)).toBe('£0');
  });

  it('formats counts as grouped whole numbers', () => {
    expect(formatKpiCount(0)).toBe('0');
    expect(formatKpiCount(1234)).toBe('1,234');
  });

  it('formats multiples using Python-style half-even .2f display', () => {
    expect(formatKpiMultiple(1.005)).toBe('1.00x');
    expect(formatKpiMultiple(1.015)).toBe('1.02x');
    expect(formatKpiMultiple(0)).toBe('0.00x');
  });
});
