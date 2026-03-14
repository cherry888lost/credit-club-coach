#!/usr/bin/env node
/**
 * Direct scoring worker runner - processes pending scoring requests
 * Usage: node scripts/run-scoring-worker.js
 */

const { createClient } = require('@supabase/supabase-js');
const { loadConfig, runScoringCycle } = require('../dist/index');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

// Simple spawn function that uses a subprocess or API call
// For now, we'll simulate by reading from stdin or using a mock
async function spawnFn(prompt, agentId) {
  console.log(`[spawnFn] Would spawn agent ${agentId} with prompt length ${prompt.length}`);
  
  // For testing, we'll use the OpenAI API directly
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  console.log('[spawnFn] Calling OpenAI API...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a sales call analysis expert. Return ONLY valid JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });
  
  return response.choices[0].message.content;
}

async function main() {
  console.log('[scoring-worker] Starting scoring cycle...');
  
  const config = loadConfig();
  const stats = await runScoringCycle(config, spawnFn);
  
  console.log('[scoring-worker] Cycle complete:', stats);
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[scoring-worker] Fatal error:', err);
  process.exit(1);
});
