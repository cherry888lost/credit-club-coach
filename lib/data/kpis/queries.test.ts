import { describe, expect, it } from 'vitest';
import { assertReadOnlySql, buildAdSpendSummaryQuery, buildKpiSummaryQuery } from './queries';

describe('KPI read-only query layer', () => {
  it('builds parameterized SELECT query specs for KPI summary filters', () => {
    const query = buildKpiSummaryQuery({
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      role: 'closer',
      teamMembers: ['Demo Closer'],
    });

    expect(query.sql).toContain('@startDate');
    expect(query.sql).toContain('@endDate');
    expect(query.sql).toContain('@role');
    expect(query.sql).toContain('@teamMembers');
    expect(query.sql).not.toContain('Demo Closer');
    expect(query.params).toMatchObject({
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      role: 'closer',
      teamMembers: ['Demo Closer'],
    });
  });

  it('builds ad spend summary with read-only SELECT SQL', () => {
    const query = buildAdSpendSummaryQuery({ startDate: '2026-06-01', endDate: '2026-06-15' });
    expect(query.sql.trim().toLowerCase()).toMatch(/^select\b/);
    expect(query.params).toEqual({ startDate: '2026-06-01', endDate: '2026-06-15' });
  });

  it('rejects non-read SQL, including mutation statements after comments', () => {
    expect(() => assertReadOnlySql('SELECT * FROM `dataset.table`')).not.toThrow();
    expect(() => assertReadOnlySql('/* nope */ INSERT INTO x VALUES (1)')).toThrow(/read-only/i);
    expect(() => assertReadOnlySql('UPDATE x SET a = 1')).toThrow(/read-only/i);
    expect(() => assertReadOnlySql('DELETE FROM x WHERE true')).toThrow(/read-only/i);
    expect(() => assertReadOnlySql('MERGE x USING y ON true WHEN MATCHED THEN UPDATE SET a = 1')).toThrow(/read-only/i);
    expect(() => assertReadOnlySql('CREATE TABLE x AS SELECT 1')).toThrow(/read-only/i);
    expect(() => assertReadOnlySql('DROP TABLE x')).toThrow(/read-only/i);
    expect(() => assertReadOnlySql('ALTER TABLE x ADD COLUMN y STRING')).toThrow(/read-only/i);
    expect(() => assertReadOnlySql('TRUNCATE TABLE x')).toThrow(/read-only/i);
  });
});
