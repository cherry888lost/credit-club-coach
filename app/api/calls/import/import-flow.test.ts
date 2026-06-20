import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminUser = { userId: 'user_admin', isAdminUser: true };
const rep = { id: 'rep_1', name: 'Test Rep', sales_role: 'closer' };

let callInserts: Record<string, unknown>[];
let callUpdates: Record<string, unknown>[];
let scoringInserts: Record<string, unknown>[];
let existingScoringRequest: Record<string, unknown> | null;

vi.mock('@/lib/auth', () => ({
  DEFAULT_ORG_ID: 'org_1',
  getCurrentUserWithRole: vi.fn(async () => adminUser),
  isAdmin: vi.fn((user) => Boolean(user?.isAdminUser)),
}));

type SupabaseQueryMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createQuery(table: string): SupabaseQueryMock {
  const state: { insertPayload?: Record<string, unknown>; filters: Record<string, unknown> } = {
    filters: {},
  };

  const query = {} as SupabaseQueryMock;
  Object.assign(query, {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      state.filters[column] = value;
      return query;
    }),
    limit: vi.fn(() => query),
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.insertPayload = payload;
      if (table === 'calls') callInserts.push(payload);
      if (table === 'scoring_requests') scoringInserts.push(payload);
      return query;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      if (table === 'calls') callUpdates.push(payload);
      return query;
    }),
    single: vi.fn(async () => {
      if (table === 'reps') return { data: rep, error: null };
      if (table === 'calls') return { data: { id: 'call_1' }, error: null };
      return { data: null, error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (table === 'scoring_requests') return { data: existingScoringRequest, error: null };
      return { data: null, error: null };
    }),
  });

  return query;
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: vi.fn((table: string) => createQuery(table)),
  })),
}));

async function postImport(body: Record<string, unknown>) {
  const { POST } = await import('./route');
  return POST({ json: async () => body } as never);
}

describe('manual call import scoring queue behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    callInserts = [];
    callUpdates = [];
    scoringInserts = [];
    existingScoringRequest = null;
  });

  it('queues a scoring request by default when an imported call has a transcript', async () => {
    const res = await postImport({ title: 'New call', rep_id: rep.id, transcript: 'Full transcript text' });
    const body = await res.json();

    expect(body.scoring_queued).toBe(true);
    expect(scoringInserts).toHaveLength(1);
    expect(scoringInserts[0]).toMatchObject({
      call_id: 'call_1',
      status: 'pending',
      call_title: 'New call',
      rep_name: rep.name,
      transcript: 'Full transcript text',
      requested_by: adminUser.userId,
    });
  });

  it('sets transcript and score status fields consistently when queued', async () => {
    await postImport({ title: 'New call', rep_id: rep.id, transcript: 'Full transcript text' });

    expect(callInserts[0]).toMatchObject({
      transcript: 'Full transcript text',
      transcript_status: 'ready',
      transcript_source: 'manual',
      score_status: null,
    });
    expect(callUpdates).toContainEqual({ score_status: 'pending' });
  });

  it('does not create duplicate scoring requests if one already exists for the imported call', async () => {
    existingScoringRequest = { id: 'existing_request', status: 'pending' };

    const res = await postImport({ title: 'New call', rep_id: rep.id, transcript: 'Full transcript text' });
    const body = await res.json();

    expect(body.scoring_queued).toBe(true);
    expect(body.scoring_request_id).toBe('existing_request');
    expect(scoringInserts).toHaveLength(0);
  });

  it('allows an explicit Save Without Scoring path without queueing', async () => {
    const res = await postImport({
      title: 'Draft call',
      rep_id: rep.id,
      transcript: 'Full transcript text',
      queue_for_scoring: false,
    });
    const body = await res.json();

    expect(body.scoring_queued).toBe(false);
    expect(scoringInserts).toHaveLength(0);
    expect(callInserts[0]).toMatchObject({
      transcript_status: 'ready',
      transcript_source: 'manual',
      score_status: null,
    });
    expect(callUpdates).toHaveLength(0);
  });
});

describe('manual import UI copy', () => {
  const pageSource = readFileSync('app/dashboard/import-calls/page.tsx', 'utf8');

  it('makes queueing the primary import action and labels the secondary path clearly', () => {
    expect(pageSource).toContain('Import & Queue for Scoring');
    expect(pageSource).toContain('Save Without Scoring');
    expect(pageSource).not.toContain('Save Only');
    expect(pageSource).not.toContain('Save & Queue for Scoring');
  });
});

describe('scoring worker call status hygiene', () => {
  const workerSource = readFileSync('lib/scoring/worker.ts', 'utf8');

  it('marks the source call score_status completed after a score is written', () => {
    expect(workerSource).toContain('async function markCompleted(config: WorkerConfig, requestId: string, callId: string, scoreId: string)');
    expect(workerSource).toContain("'calls'");
    expect(workerSource).toContain("score_status: 'completed'");
    expect(workerSource).toContain('await markCompleted(cfg, request.id, request.call_id, scoreId)');
  });
});
