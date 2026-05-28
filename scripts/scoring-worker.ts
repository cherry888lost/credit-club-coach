#!/usr/bin/env tsx
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { retryFailedRequests, runWorkerCycle } from '../lib/scoring/worker';

const hermesEnvPath = resolve(process.env.HOME || '', '.hermes/.env');
if (existsSync(hermesEnvPath)) {
  loadDotenv({ path: hermesEnvPath });
}

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  loadDotenv({ path: envPath });
} else {
  loadDotenv();
}

function intArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  const parsed = Number.parseInt(process.argv[idx + 1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const mode = process.argv[2] || 'once';
  const max = intArg('--max', Number.parseInt(process.env.SCORING_MAX_PER_CYCLE || '1', 10) || 1);
  const intervalSeconds = intArg('--interval-seconds', Number.parseInt(process.env.SCORING_POLL_INTERVAL_SECONDS || '30', 10) || 30);

  if (mode === 'retry-failed') {
    const stats = await retryFailedRequests();
    console.log(JSON.stringify({ mode, ...stats }, null, 2));
    return;
  }

  if (mode === 'once') {
    const stats = await runWorkerCycle({ maxPerCycle: max });
    console.log(JSON.stringify({ mode, ...stats }, null, 2));
    if (hasFlag('--fail-on-error') && stats.failed > 0) process.exit(1);
    return;
  }

  if (mode === 'continuous') {
    console.log(`Credit Club scoring worker running continuously. interval=${intervalSeconds}s max=${max}`);
    let totalProcessed = 0;
    let totalFailed = 0;
    while (true) {
      try {
        const stats = await runWorkerCycle({ maxPerCycle: max });
        totalProcessed += stats.processed;
        totalFailed += stats.failed;
        if (stats.processed || stats.failed || stats.skipped) {
          console.log(JSON.stringify({ cycle: stats, totalProcessed, totalFailed, at: new Date().toISOString() }));
        } else {
          process.stdout.write('.');
        }
      } catch (err: any) {
        totalFailed += 1;
        console.error('[continuous] cycle crashed:', err?.message || String(err));
      }
      await sleep(intervalSeconds * 1000);
    }
  }

  console.error(`Unknown mode: ${mode}. Use once, continuous, or retry-failed.`);
  process.exit(2);
}

main().catch(err => {
  console.error('Fatal scoring worker error:', err?.message || err);
  process.exit(1);
});
