import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../auth';
import type { Rep } from '../../types';
import { buildViewAsHref, resolveViewAsContext } from './view-as';

const orgId = 'org-1';

function rep(overrides: Partial<Rep>): Rep {
  return {
    id: overrides.id || 'rep-1',
    org_id: overrides.org_id || orgId,
    clerk_user_id: overrides.clerk_user_id ?? null,
    email: overrides.email || `${overrides.id || 'rep'}@example.com`,
    fathom_email: overrides.fathom_email ?? null,
    name: overrides.name || overrides.id || 'Rep',
    role: overrides.role || 'member',
    sales_role: overrides.sales_role ?? null,
    status: overrides.status || 'active',
    invited_at: overrides.invited_at ?? null,
    accepted_at: overrides.accepted_at ?? null,
    invited_by: overrides.invited_by ?? null,
    invite_token: overrides.invite_token ?? null,
    invite_expires_at: overrides.invite_expires_at ?? null,
    created_at: overrides.created_at || '2026-01-01T00:00:00Z',
    updated_at: overrides.updated_at || '2026-01-01T00:00:00Z',
  };
}

function user(repRow: Rep): CurrentUser {
  return {
    userId: repRow.clerk_user_id || `clerk-${repRow.id}`,
    email: repRow.email,
    rep: repRow,
    orgId: repRow.org_id,
    isOnboarded: true,
  };
}

const adminRep = rep({ id: 'admin', name: 'Papur Admin', role: 'admin' });
const adan = rep({ id: 'adan', name: 'Adan Nadeem' });
const yuvraj = rep({ id: 'yuvraj', name: 'Yuvraj Kang' });
const papur = rep({ id: 'papur', name: 'Papur' });
const inactive = rep({ id: 'inactive', name: 'Inactive Rep', status: 'disabled' });
const otherOrg = rep({ id: 'other-org', name: 'Other Org', org_id: 'org-2' });
const options = [adminRep, adan, yuvraj, papur, inactive, otherOrg];

describe('resolveViewAsContext', () => {
  it('keeps admin in Admin View with all-record access when no view_as is selected', () => {
    const context = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: null, reps: options });

    expect(context.actualRepId).toBe('admin');
    expect(context.effectiveRepId).toBe('admin');
    expect(context.isActualAdmin).toBe(true);
    expect(context.isViewingAs).toBe(false);
    expect(context.canUseAdminActions).toBe(true);
    expect(context.collectionOwnerFilter).toBeNull();
    expect(context.label).toBe('Admin View');
  });

  it('lets an admin view as Adan with owner filtering and read-only preview actions', () => {
    const context = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: 'adan', reps: options });

    expect(context.effectiveRepId).toBe('adan');
    expect(context.effectiveRepName).toBe('Adan Nadeem');
    expect(context.isViewingAs).toBe(true);
    expect(context.canUseAdminActions).toBe(false);
    expect(context.collectionOwnerFilter).toBe('adan');
    expect(context.label).toBe('Adan Nadeem');
  });

  it('lets an admin view as Yuvraj with Yuvraj-only owner filtering', () => {
    const context = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: 'yuvraj', reps: options });

    expect(context.effectiveRepId).toBe('yuvraj');
    expect(context.collectionOwnerFilter).toBe('yuvraj');
  });

  it('distinguishes Admin View from viewing as Papur', () => {
    const adminView = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: null, reps: options });
    const papurView = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: 'papur', reps: options });

    expect(adminView.collectionOwnerFilter).toBeNull();
    expect(papurView.collectionOwnerFilter).toBe('papur');
  });

  it('does not honor view_as for non-admin users', () => {
    const context = resolveViewAsContext({ actualUser: user(adan), requestedViewAsRepId: 'yuvraj', reps: options });

    expect(context.isActualAdmin).toBe(false);
    expect(context.effectiveRepId).toBe('adan');
    expect(context.collectionOwnerFilter).toBe('adan');
    expect(context.isViewingAs).toBe(false);
    expect(context.viewAsError).toBe('View-as is only available to admins');
  });

  it('does not expose all admin data for inactive, missing, or cross-org requested reps', () => {
    const inactiveContext = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: 'inactive', reps: options });
    const missingContext = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: 'missing', reps: options });
    const crossOrgContext = resolveViewAsContext({ actualUser: user(adminRep), requestedViewAsRepId: 'other-org', reps: options });

    expect(inactiveContext.isViewingAs).toBe(true);
    expect(inactiveContext.collectionOwnerFilter).toBe('__invalid_view_as__');
    expect(inactiveContext.canUseAdminActions).toBe(false);
    expect(inactiveContext.viewAsError).toBe('Requested view-as user is not active');
    expect(missingContext.collectionOwnerFilter).toBe('__invalid_view_as__');
    expect(missingContext.viewAsError).toBe('Requested view-as user was not found');
    expect(crossOrgContext.collectionOwnerFilter).toBe('__invalid_view_as__');
    expect(crossOrgContext.viewAsError).toBe('Requested view-as user was not found');
  });
});

describe('buildViewAsHref', () => {
  it('sets or removes the view_as query parameter while preserving the dashboard path', () => {
    expect(buildViewAsHref('/dashboard/collections?status=open', 'adan')).toBe('/dashboard/collections?status=open&view_as=adan');
    expect(buildViewAsHref('/dashboard/collections?status=open&view_as=adan', null)).toBe('/dashboard/collections?status=open');
  });
});
