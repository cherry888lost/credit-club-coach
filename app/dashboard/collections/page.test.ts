import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellPath = 'app/dashboard/_components/DashboardShell.tsx';
const pagePath = 'app/dashboard/collections/page.tsx';
const shellSource = readFileSync(shellPath, 'utf8');
const pageSource = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';

describe('collections dashboard route and sidebar', () => {
  it('adds Collections to the dashboard sidebar after Settings', () => {
    expect(shellSource).toContain('Collections');
    expect(shellSource).toContain('/dashboard/collections');
    expect(shellSource.indexOf('Settings')).toBeLessThan(shellSource.indexOf('Collections'));
  });

  it('creates a native /dashboard/collections page without iframe or Apps Script embed', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(pageSource).toContain('Collections');
    expect(pageSource).toContain('Collection pipeline');
    expect(pageSource).not.toMatch(/iframe|script\.google|google\.script|Apps Script/i);
  });
});
