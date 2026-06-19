import { isAdmin, requireAuth } from '@/lib/auth';
import { listCollections, listRepsForCollections } from '@/lib/collections/data';
import CollectionsClient from './CollectionsClient';

export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const user = await requireAuth();
  const [collections, reps] = await Promise.all([listCollections(), listRepsForCollections()]);
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
      <CollectionsClient initialCollections={collections} reps={reps} isAdmin={admin} />
    </div>
  );
}
