import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellPath = 'app/dashboard/_components/DashboardShell.tsx';
const pagePath = 'app/dashboard/collections/page.tsx';
const clientPath = 'app/dashboard/collections/CollectionsClient.tsx';
const apiPath = 'app/api/collections/route.ts';
const shellSource = readFileSync(shellPath, 'utf8');
const pageSource = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
const clientSource = existsSync(clientPath) ? readFileSync(clientPath, 'utf8') : '';
const apiSource = existsSync(apiPath) ? readFileSync(apiPath, 'utf8') : '';

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

  it('wires Collections through server-validated view_as context', () => {
    expect(pageSource).toContain('searchParams');
    expect(pageSource).toContain('resolveViewAsContextFromRequest');
    expect(pageSource).toContain('viewAsContext');
    expect(pageSource).toContain('listCollections({ viewAsContext })');
    expect(apiSource).toContain("request.nextUrl.searchParams.get('view_as')");
  });

  it('renders read-only preview UI when admin is viewing as another user', () => {
    expect(clientSource).toContain('isViewingAs');
    expect(clientSource).toContain('Admin actions are disabled in preview mode');
    expect(clientSource).toContain('Exit view-as mode to make admin changes');
    expect(clientSource).toContain('canManageCollections');
    expect(clientSource).toContain('disabled={isViewingAs}');
  });

  it('adds admin-only View As controls to the dashboard shell', () => {
    expect(shellSource).toContain('viewAsOptions');
    expect(shellSource).toContain('Viewing as');
    expect(shellSource).toContain('Admin View / All Records');
    expect(shellSource).toContain('isAdminUser && viewAsOptions.length');
    expect(shellSource).toContain('Exit view-as');
  });
});
