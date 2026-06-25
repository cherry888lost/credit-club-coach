import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellPath = 'app/dashboard/_components/DashboardShell.tsx';
const analysisPagePath = 'app/dashboard/analysis/page.tsx';
const learningPagePath = 'app/dashboard/learning-queue/page.tsx';
const learningClientPath = 'app/dashboard/learning-queue/LearningQueueClient.tsx';
const patternsPagePath = 'app/dashboard/patterns/page.tsx';
const patternsClientPath = 'app/dashboard/patterns/PatternsClient.tsx';
const settingsPagePath = 'app/dashboard/settings/page.tsx';

const protectedApiPaths = [
  'app/api/learning-queue/route.ts',
  'app/api/learning-queue/stats/route.ts',
  'app/api/learning-queue/[id]/review/route.ts',
  'app/api/patterns/route.ts',
  'app/api/patterns/stats/route.ts',
  'app/api/patterns/analyze/route.ts',
  'app/api/benchmark-calls/route.ts',
];

const shellSource = readFileSync(shellPath, 'utf8');
const analysisPageSource = readFileSync(analysisPagePath, 'utf8');
const learningPageSource = readFileSync(learningPagePath, 'utf8');
const patternsPageSource = readFileSync(patternsPagePath, 'utf8');
const settingsPageSource = readFileSync(settingsPagePath, 'utf8');

const navigationItems = Array.from(
  shellSource.matchAll(/\{ name: "([^"]+)", href: "([^"]+)", icon: [^,]+, adminOnly: (true|false) \}/g),
).map((match) => ({ name: match[1], href: match[2], adminOnly: match[3] === 'true' }));

function visibleSidebarNames(isAdmin: boolean) {
  return navigationItems
    .filter((item) => !item.adminOnly || isAdmin)
    .map((item) => item.name);
}

describe('dashboard sidebar soft-hide for stale learning surfaces', () => {
  it('keeps Analysis and Collections in the dashboard sidebar', () => {
    expect(shellSource).toContain('Analysis');
    expect(shellSource).toContain('/dashboard/analysis');
    expect(shellSource).toContain('Collections');
    expect(shellSource).toContain('/dashboard/collections');
  });

  it('removes Learning Queue and Pattern Library from the dashboard sidebar', () => {
    expect(shellSource).not.toContain('Learning Queue');
    expect(shellSource).not.toContain('/dashboard/learning-queue');
    expect(shellSource).not.toContain('Pattern Library');
    expect(shellSource).not.toContain('/dashboard/patterns');
  });
});

describe('settings dashboard permissions', () => {
  it('keeps Settings in the sidebar for admins only, while common items remain visible to all', () => {
    expect(shellSource).toContain('{ name: "Overview", href: "/dashboard", icon: LayoutDashboard, adminOnly: false }');
    expect(shellSource).toContain('{ name: "Calls", href: "/dashboard/calls", icon: Phone, adminOnly: false }');
    expect(shellSource).toContain('{ name: "Reps", href: "/dashboard/reps", icon: Users, adminOnly: false }');
    expect(shellSource).toContain('{ name: "Analysis", href: "/dashboard/analysis", icon: BarChart3, adminOnly: true }');
    expect(shellSource).toContain('{ name: "Import Calls", href: "/dashboard/import-calls", icon: Upload, adminOnly: true }');
    expect(shellSource).toContain('{ name: "Settings", href: "/dashboard/settings", icon: Settings, adminOnly: true }');
    expect(shellSource).toContain('{ name: "Collections", href: "/dashboard/collections", icon: WalletCards, adminOnly: false }');
    expect(shellSource).toContain('.filter((item) => !item.adminOnly || isAdminUser)');
  });

  it('shows the expected admin sidebar including Collections', () => {
    expect(visibleSidebarNames(true)).toEqual([
      'Overview',
      'Calls',
      'Reps',
      'Analysis',
      'Import Calls',
      'Settings',
      'Collections',
    ]);
  });

  it.each(['closer', 'SDR', 'setter'])('shows Collections but not admin-only items for %s sidebar users', () => {
    expect(visibleSidebarNames(false)).toEqual(['Overview', 'Calls', 'Reps', 'Collections']);
    expect(visibleSidebarNames(false)).not.toContain('Settings');
    expect(visibleSidebarNames(false)).not.toContain('Analysis');
    expect(visibleSidebarNames(false)).not.toContain('Import Calls');
    expect(visibleSidebarNames(false)).not.toContain('Learning Queue');
    expect(visibleSidebarNames(false)).not.toContain('Pattern Library');
  });

  it('protects direct Settings access server-side for authenticated non-admins', () => {
    expect(settingsPageSource).toContain('getCurrentUserWithRole');
    expect(settingsPageSource).toContain('!user.isAdminUser');
    expect(settingsPageSource).toContain('redirect("/dashboard")');
    expect(settingsPageSource).toContain('Settings');
  });
});

describe('admin-only direct dashboard routes', () => {
  it('keeps Analysis admin-only while allowing admins through', () => {
    expect(analysisPageSource).toContain('getCurrentUserWithRole');
    expect(analysisPageSource).toContain('!user.isAdminUser');
    expect(analysisPageSource).toContain('redirect("/dashboard")');
  });

  it('keeps Learning Queue route present but redirects non-admins to /dashboard', () => {
    expect(existsSync(learningClientPath)).toBe(true);
    expect(learningPageSource).toContain('getCurrentUserWithRole');
    expect(learningPageSource).toContain('!user.isAdminUser');
    expect(learningPageSource).toContain('redirect("/dashboard")');
    expect(learningPageSource).toContain('<LearningQueueClient />');
  });

  it('keeps Pattern Library route present but redirects non-admins to /dashboard', () => {
    expect(existsSync(patternsClientPath)).toBe(true);
    expect(patternsPageSource).toContain('getCurrentUserWithRole');
    expect(patternsPageSource).toContain('!user.isAdminUser');
    expect(patternsPageSource).toContain('redirect("/dashboard")');
    expect(patternsPageSource).toContain('<PatternsClient />');
  });
});

describe('admin-only learning and pattern APIs', () => {
  it('uses the shared admin API guard that returns 403 for authenticated non-admins', () => {
    const guardSource = readFileSync('lib/auth/admin-api.ts', 'utf8');
    expect(guardSource).toContain('requireAdmin()');
    expect(guardSource).toContain('Admin access required');
    expect(guardSource).toContain('status = message.includes("Admin access required") ? 403 : 401');
  });

  it('protects Learning Queue and Pattern Library APIs with the admin guard', () => {
    for (const apiPath of protectedApiPaths) {
      const source = readFileSync(apiPath, 'utf8');
      expect(source, apiPath).toContain('requireAdminApi');
      expect(source, apiPath).toContain('if (admin.response) return admin.response');
      expect(source, apiPath).not.toContain("from '@clerk/nextjs/server'");
      expect(source, apiPath).not.toContain('from "@clerk/nextjs/server"');
    }
  });
});
