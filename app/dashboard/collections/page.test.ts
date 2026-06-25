import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellPath = 'app/dashboard/_components/DashboardShell.tsx';
const pagePath = 'app/dashboard/collections/page.tsx';
const clientPath = 'app/dashboard/collections/CollectionsClient.tsx';
const apiPath = 'app/api/collections/route.ts';
const collectionByIdApiPath = 'app/api/collections/[id]/route.ts';
const exportApiPath = 'app/api/collections/export/route.ts';
const dataPath = 'lib/collections/data.ts';
const shellSource = readFileSync(shellPath, 'utf8');
const pageSource = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
const clientSource = existsSync(clientPath) ? readFileSync(clientPath, 'utf8') : '';
const apiSource = existsSync(apiPath) ? readFileSync(apiPath, 'utf8') : '';
const collectionByIdApiSource = existsSync(collectionByIdApiPath) ? readFileSync(collectionByIdApiPath, 'utf8') : '';
const exportApiSource = existsSync(exportApiPath) ? readFileSync(exportApiPath, 'utf8') : '';
const dataSource = existsSync(dataPath) ? readFileSync(dataPath, 'utf8') : '';

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

  it.each(['admin', 'closer', 'SDR'])('allows %s users through normal dashboard auth instead of an admin-only page guard', () => {
    expect(pageSource).toContain('requireAuth');
    expect(pageSource).not.toContain('requireAdmin');
    expect(pageSource).not.toContain('getCurrentUserWithRole');
    expect(pageSource).not.toContain('redirect("/dashboard")');
  });

  it('wires Collections through server-validated view_as context', () => {
    expect(pageSource).toContain('searchParams');
    expect(pageSource).toContain('resolveViewAsContextFromRequest');
    expect(pageSource).toContain('viewAsContext');
    expect(pageSource).toContain('listCollections({ viewAsContext })');
    expect(pageSource).toContain("key={viewAsContext.requestedViewAsRepId || 'admin-view'}");
    expect(apiSource).toContain("request.nextUrl.searchParams.get('view_as')");
  });

  it('keeps non-admin list and direct-record API access server-filtered to owner_user_id', () => {
    expect(dataSource).toContain('if (!context.isAdmin || context.isViewingAs)');
    expect(dataSource).toContain("query = query.eq('owner_user_id', context.repId)");
    expect(dataSource).toContain('canAccessCollection(collection, context)');
    expect(collectionByIdApiSource).toContain('getCollectionById(id, { viewAsContext })');
    expect(dataSource).not.toContain("query = query.eq('status'");
  });

  it('renders read-only preview UI when admin is viewing as another user', () => {
    expect(clientSource).toContain('isViewingAs');
    expect(clientSource).toContain('Admin actions are disabled in preview mode');
    expect(clientSource).toContain('Exit view-as mode to make admin changes');
    expect(clientSource).toContain('canManageCollections');
    expect(clientSource).toContain('disabled={isViewingAs}');
  });

  it('remounts CollectionsClient when view_as changes so stale admin records are not retained', () => {
    expect(pageSource).toContain("key={viewAsContext.requestedViewAsRepId || 'admin-view'}");
    expect(clientSource).toContain("useState(initialCollections)");
  });

  it('hides collected rows by default but exposes a Show collected toggle', () => {
    expect(clientSource).toContain('showCollected');
    expect(clientSource).toContain('filterCollectionPipeline');
    expect(clientSource).toContain('Show collected');
    expect(clientSource).toContain('checked={effectiveShowCollected}');
  });

  it('makes Collected status filter explicit instead of returning an empty hidden state', () => {
    expect(clientSource).toContain('handleStatusFilter');
    expect(clientSource).toContain("if (value === 'Collected') setShowCollected(true)");
    expect(clientSource).toContain('shouldShowCollectedForStatusFilter');
  });

  it('keeps summary cards focused on active uncollected money', () => {
    expect(clientSource).toContain('buildCollectionSummary');
    expect(clientSource).toContain('summary.outstandingBalance');
    expect(clientSource).toContain('Summary cards still show active, uncollected collection work only');
  });

  it('marks records collected without deleting them and explains where to find them', () => {
    expect(clientSource).toContain("status: 'Collected'");
    expect(clientSource).toContain('amount_paid: record.total_sale_value');
    expect(clientSource).toContain('Collection marked as collected. Turn on Show collected to view completed records.');
    expect(clientSource).toContain('current.map((item) => item.id === record.id ? body.collection : item)');
  });

  it('keeps admin exports as all permitted records instead of visible-row exports', () => {
    expect(clientSource).toContain('Export all backup');
    expect(clientSource).toContain('Export all CSV');
    expect(exportApiSource).toContain('exportCollections()');
    expect(dataSource).toContain('return { data: { collections: await listCollections() } }');
    expect(dataSource).not.toContain("neq('status', 'Collected')");
  });

  it('adds admin-only View As controls to the dashboard shell', () => {
    expect(shellSource).toContain('viewAsOptions');
    expect(shellSource).toContain('Viewing as');
    expect(shellSource).toContain('Admin View / All Records');
    expect(shellSource).toContain('isAdminUser && viewAsOptions.length');
    expect(shellSource).toContain('Exit view-as');
  });
});
