/**
 * Duplicate Rep Cleanup Script
 * 
 * Finds and merges duplicate reps (by case-insensitive email).
 * Keeps the oldest record, reassigns calls/data, deletes duplicates.
 * 
 * Usage:
 *   npx tsx scripts/cleanup-duplicates.ts          # Dry run
 *   npx tsx scripts/cleanup-duplicates.ts --apply   # Actually apply changes
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dryRun = !process.argv.includes("--apply");

async function main() {
  console.log(`\n🔍 Duplicate Rep Cleanup ${dryRun ? "(DRY RUN)" : "(APPLYING CHANGES)"}\n`);

  // Get all reps
  const { data: allReps, error } = await supabase
    .from("reps")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !allReps) {
    console.error("Failed to fetch reps:", error);
    process.exit(1);
  }

  console.log(`Total reps: ${allReps.length}\n`);

  // Group by lowercase email
  const groups: Record<string, typeof allReps> = {};
  for (const rep of allReps) {
    const key = rep.email?.toLowerCase();
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rep);
  }

  // Find duplicates
  const duplicates = Object.entries(groups).filter(([, reps]) => reps.length > 1);

  if (duplicates.length === 0) {
    console.log("✅ No duplicate reps found!\n");
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate email group(s):\n`);

  for (const [email, reps] of duplicates) {
    console.log(`  📧 ${email} — ${reps.length} records`);
    
    // Keep oldest (first, since sorted by created_at)
    const keep = reps[0];
    const dupes = reps.slice(1);

    console.log(`    ✅ KEEP: id=${keep.id} name="${keep.name}" created=${keep.created_at} clerk=${keep.clerk_user_id || 'none'}`);
    
    for (const dupe of dupes) {
      console.log(`    ❌ DELETE: id=${dupe.id} name="${dupe.name}" created=${dupe.created_at} clerk=${dupe.clerk_user_id || 'none'}`);

      // Reassign calls
      const { data: calls } = await supabase
        .from("calls")
        .select("id")
        .eq("rep_id", dupe.id);

      if (calls && calls.length > 0) {
        console.log(`       → Reassigning ${calls.length} call(s) to kept rep`);
        if (!dryRun) {
          await supabase
            .from("calls")
            .update({ rep_id: keep.id })
            .eq("rep_id", dupe.id);
        }
      }

      // If dupe has clerk_user_id and keep doesn't, transfer it
      if (dupe.clerk_user_id && !keep.clerk_user_id) {
        console.log(`       → Transferring clerk_user_id ${dupe.clerk_user_id} to kept rep`);
        if (!dryRun) {
          await supabase
            .from("reps")
            .update({ clerk_user_id: dupe.clerk_user_id })
            .eq("id", keep.id);
        }
      }

      // Delete duplicate
      if (!dryRun) {
        // Clear clerk_user_id first to avoid unique constraint issues
        await supabase
          .from("reps")
          .update({ clerk_user_id: null })
          .eq("id", dupe.id);

        const { error: delErr } = await supabase
          .from("reps")
          .delete()
          .eq("id", dupe.id);

        if (delErr) {
          console.error(`       ⚠️  Failed to delete: ${delErr.message}`);
        } else {
          console.log(`       ✅ Deleted`);
        }
      }
    }
    console.log();
  }

  // Specific Callum check
  const callumReps = allReps.filter(r => r.name?.toLowerCase().includes("callum"));
  if (callumReps.length > 1) {
    console.log(`🔎 Callum specifically: Found ${callumReps.length} records`);
    callumReps.forEach(r => {
      console.log(`   - id=${r.id} email=${r.email} name="${r.name}" status=${r.status}`);
    });
  } else if (callumReps.length === 1) {
    console.log(`✅ Callum: 1 record (no duplicates)`);
  } else {
    console.log(`ℹ️  No reps named Callum found`);
  }

  if (dryRun) {
    console.log(`\n⚡ This was a dry run. Run with --apply to make changes.\n`);
  } else {
    console.log(`\n✅ Cleanup complete!\n`);
  }
}

main().catch(console.error);
