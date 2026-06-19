import { DEFAULT_ORG_ID, isAdmin, requireAuth, type CurrentUser } from '../auth';
import { createServiceClient } from '../supabase/server';
import type { Rep } from '../../types';

export type ViewAsOption = Pick<Rep, 'id' | 'name' | 'email' | 'role' | 'sales_role' | 'status' | 'org_id'>;

export interface ViewAsContext {
  actualRepId: string;
  actualRepName: string;
  effectiveRepId: string;
  effectiveRepName: string;
  isActualAdmin: boolean;
  isViewingAs: boolean;
  canUseAdminActions: boolean;
  collectionOwnerFilter: string | null;
  label: string;
  requestedViewAsRepId: string | null;
  viewAsError?: string;
}

export function normalizeRequestedViewAs(value: string | null | undefined): string | null {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

export function resolveViewAsContext({
  actualUser,
  requestedViewAsRepId,
  reps,
}: {
  actualUser: CurrentUser;
  requestedViewAsRepId?: string | null;
  reps: ViewAsOption[];
}): ViewAsContext {
  if (!actualUser.rep || actualUser.rep.status !== 'active') throw new Error('No active account');

  const requested = normalizeRequestedViewAs(requestedViewAsRepId);
  const actualRep = actualUser.rep;
  const actualIsAdmin = isAdmin(actualUser);
  const base: ViewAsContext = {
    actualRepId: actualRep.id,
    actualRepName: actualRep.name,
    effectiveRepId: actualRep.id,
    effectiveRepName: actualRep.name,
    isActualAdmin: actualIsAdmin,
    isViewingAs: false,
    canUseAdminActions: actualIsAdmin,
    collectionOwnerFilter: actualIsAdmin ? null : actualRep.id,
    label: actualIsAdmin ? 'Admin View' : actualRep.name,
    requestedViewAsRepId: requested,
  };

  if (!requested) return base;

  if (!actualIsAdmin) {
    return { ...base, viewAsError: 'View-as is only available to admins' };
  }

  const invalidAdminView = (viewAsError: string): ViewAsContext => ({
    ...base,
    isViewingAs: true,
    canUseAdminActions: false,
    collectionOwnerFilter: '__invalid_view_as__',
    viewAsError,
  });

  const candidate = reps.find((rep) => rep.id === requested && rep.org_id === actualRep.org_id);
  if (!candidate) {
    return invalidAdminView('Requested view-as user was not found');
  }

  if (candidate.status !== 'active') {
    return invalidAdminView('Requested view-as user is not active');
  }

  return {
    actualRepId: actualRep.id,
    actualRepName: actualRep.name,
    effectiveRepId: candidate.id,
    effectiveRepName: candidate.name,
    isActualAdmin: true,
    isViewingAs: true,
    canUseAdminActions: false,
    collectionOwnerFilter: candidate.id,
    label: candidate.name,
    requestedViewAsRepId: requested,
  };
}

export function buildViewAsHref(currentHref: string, viewAsRepId: string | null): string {
  const url = new URL(currentHref, 'https://credit-club.local');
  if (viewAsRepId) url.searchParams.set('view_as', viewAsRepId);
  else url.searchParams.delete('view_as');
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

export async function listDashboardViewAsOptions(user?: CurrentUser): Promise<ViewAsOption[]> {
  const actualUser = user || await requireAuth();
  if (!isAdmin(actualUser)) return [];

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('reps')
    .select('id,name,email,role,sales_role,status,org_id')
    .eq('org_id', actualUser.rep?.org_id || DEFAULT_ORG_ID)
    .eq('status', 'active')
    .order('name');

  if (error) throw error;
  return (data || []) as ViewAsOption[];
}

export async function resolveViewAsContextFromRequest(requestedViewAsRepId?: string | null, user?: CurrentUser): Promise<ViewAsContext> {
  const actualUser = user || await requireAuth();
  const reps = await listDashboardViewAsOptions(actualUser);
  return resolveViewAsContext({ actualUser, requestedViewAsRepId, reps });
}
