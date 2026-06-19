import type { CollectionOwnerAssignment, CollectionRecord, CollectionsUserContext } from './types';

export function canAccessCollection(record: CollectionRecord, user: CollectionsUserContext): boolean {
  if (user.isAdmin && !user.isViewingAs) return true;
  return record.owner_user_id === user.repId;
}

export function filterCollectionsForUser<T extends CollectionRecord>(records: T[], user: CollectionsUserContext): T[] {
  return records.filter((record) => canAccessCollection(record, user));
}

export function canAssignCollectionOwner(assignment: CollectionOwnerAssignment, user: CollectionsUserContext): boolean {
  if (user.isViewingAs) return false;
  if (!assignment.ownerUserId) return false;
  if (user.isAdmin) return true;
  return assignment.ownerUserId === user.repId;
}

export function resolveCreateOwnerUserId(requestedOwnerUserId: string | null | undefined, user: CollectionsUserContext): string | null {
  if (!user.isAdmin) return user.repId;
  return requestedOwnerUserId || null;
}

export function canExportCollections(user: CollectionsUserContext): boolean {
  return user.isAdmin && !user.isViewingAs;
}

export function canImportCollections(user: CollectionsUserContext): boolean {
  return user.isAdmin && !user.isViewingAs;
}

export function canClearCollections(user: CollectionsUserContext, confirmed: boolean): boolean {
  return user.isAdmin && !user.isViewingAs && confirmed;
}
