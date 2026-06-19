import { isAdmin, requireAuth } from '@/lib/auth';
import { listCollections, listRepsForCollections } from '@/lib/collections/data';
import { resolveViewAsContextFromRequest } from '@/lib/dashboard/view-as';
import CollectionsClient from './CollectionsClient';

export const dynamic = 'force-dynamic';

type CollectionsPageProps = {
  searchParams: Promise<{ view_as?: string }>;
};

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const viewAsContext = await resolveViewAsContextFromRequest(params.view_as, user);
  const [collections, reps] = await Promise.all([
    listCollections({ viewAsContext }),
    listRepsForCollections(),
  ]);
  const admin = isAdmin(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Collections</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Native Credit Club collections dashboard for deposits, balances, payment plans, partial access and failed payment follow-up.
        </p>
      </div>
      <div className="sr-only">Collection pipeline</div>
      <CollectionsClient
        key={viewAsContext.requestedViewAsRepId || 'admin-view'}
        initialCollections={collections}
        reps={reps}
        isAdmin={admin}
        viewAsContext={viewAsContext}
      />
    </div>
  );
}
