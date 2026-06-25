import { describe, expect, it } from 'vitest';
import {
  canAccessCollection,
  canAssignCollectionOwner,
  canClearCollections,
  canExportCollections,
  canImportCollections,
  filterCollectionsForUser,
  resolveCreateOwnerUserId,
} from './permissions';
import type { CollectionRecord, CollectionsUserContext } from './types';

const admin: CollectionsUserContext = { repId: 'admin-1', isAdmin: true };
const closerA: CollectionsUserContext = { repId: 'closer-a', isAdmin: false };
const closerB: CollectionsUserContext = { repId: 'closer-b', isAdmin: false };
const sdrA: CollectionsUserContext = { repId: 'sdr-a', isAdmin: false };
const setterA: CollectionsUserContext = { repId: 'setter-a', isAdmin: false };

const records: CollectionRecord[] = [
  { id: 'a', owner_user_id: 'closer-a' },
  { id: 'b', owner_user_id: 'closer-b' },
  { id: 'c', owner_user_id: 'sdr-a' },
  { id: 'setter', owner_user_id: 'setter-a' },
  { id: 'unassigned', owner_user_id: null },
];

describe('collections permission model', () => {
  it('allows admins to see all collections', () => {
    expect(filterCollectionsForUser(records, admin).map((r) => r.id)).toEqual(['a', 'b', 'c', 'setter', 'unassigned']);
  });

  it('allows non-admins to see only records where owner_user_id equals their rep id', () => {
    expect(filterCollectionsForUser(records, closerA).map((r) => r.id)).toEqual(['a']);
  });

  it('allows closers to see their owned collections', () => {
    expect(canAccessCollection(records[0], closerA)).toBe(true);
    expect(filterCollectionsForUser(records, closerB).map((r) => r.id)).toEqual(['b']);
  });

  it('allows SDRs to see their owned collections', () => {
    expect(filterCollectionsForUser(records, sdrA).map((r) => r.id)).toEqual(['c']);
  });

  it('allows any active non-admin rep context with a valid rep id to see owned collections without role-string checks', () => {
    expect(filterCollectionsForUser(records, setterA).map((r) => r.id)).toEqual(['setter']);
    expect(canAccessCollection(records[3], setterA)).toBe(true);
    expect(canAccessCollection(records[0], setterA)).toBe(false);
  });

  it('blocks non-admin access to another user collection even if the request input changes', () => {
    expect(canAccessCollection(records[1], closerA)).toBe(false);
    expect(canAccessCollection(records[0], closerA)).toBe(true);
  });

  it('blocks non-admin assignment to another owner or blank owner', () => {
    expect(canAssignCollectionOwner({ ownerUserId: 'closer-a' }, closerA)).toBe(true);
    expect(canAssignCollectionOwner({ ownerUserId: null }, closerA)).toBe(false);
    expect(canAssignCollectionOwner({ ownerUserId: '' }, closerA)).toBe(false);
    expect(canAssignCollectionOwner({ ownerUserId: 'closer-b' }, closerA)).toBe(false);
    expect(canAssignCollectionOwner({ ownerUserId: 'sdr-a' }, closerA)).toBe(false);
    expect(canAssignCollectionOwner({ ownerUserId: 'sdr-a' }, admin)).toBe(true);
  });

  it('forces non-admin creates to the current user owner id', () => {
    expect(resolveCreateOwnerUserId(null, closerA)).toBe('closer-a');
    expect(resolveCreateOwnerUserId('', closerA)).toBe('closer-a');
    expect(resolveCreateOwnerUserId('closer-b', closerA)).toBe('closer-a');
  });

  it('allows admin creates to use the requested valid owner id but not blank owner', () => {
    expect(resolveCreateOwnerUserId('closer-b', admin)).toBe('closer-b');
    expect(canAssignCollectionOwner({ ownerUserId: null }, admin)).toBe(false);
  });

  it('blocks non-admin updates to records they do not own', () => {
    expect(canAccessCollection(records[1], closerA)).toBe(false);
  });

  it('blocks non-admin export all records', () => {
    expect(canExportCollections(closerA)).toBe(false);
  });

  it('blocks non-admin import', () => {
    expect(canImportCollections(closerA)).toBe(false);
  });

  it('blocks non-admin clear all records', () => {
    expect(canClearCollections(closerA, true)).toBe(false);
  });

  it('allows admin export and import', () => {
    expect(canExportCollections(admin)).toBe(true);
    expect(canImportCollections(admin)).toBe(true);
  });

  it('allows admin clear all only when confirmed', () => {
    expect(canClearCollections(admin, true)).toBe(true);
    expect(canClearCollections(admin, false)).toBe(false);
  });

  it('blocks admin write actions while previewing another user with view-as', () => {
    const previewAdmin: CollectionsUserContext = { repId: 'admin-1', isAdmin: true, isViewingAs: true };

    expect(canAssignCollectionOwner({ ownerUserId: 'closer-a' }, previewAdmin)).toBe(false);
    expect(canExportCollections(previewAdmin)).toBe(false);
    expect(canImportCollections(previewAdmin)).toBe(false);
    expect(canClearCollections(previewAdmin, true)).toBe(false);
  });
});
