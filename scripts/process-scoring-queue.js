#!/usr/bin/env node
/**
 * Process pending scoring requests using OpenAI API directly
 * Usage: node scripts/process-scoring-queue.js [--limit N]
 */

const { createClient } = require('@supabase/supabase-js');
const { loadConfig, runScoringCycle } = require('../dist/index');

const limit = process.argv.includes('--limit') 
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) 
  : undefined;

async function main() {
  console.log('[process-scoring-queue] Starting...');
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY env var');
    process.exit(1);
  }
  
  const config = loadConfig();
  
  // Create spawn function using OpenAI API
  const spawnFn = async (prompt, agentId) => {
    console.log(`[spawnFn] Sending to OpenAI (prompt length: ${prompt.length})...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a sales call analysis expert. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  };
  
  let totalProcessed = 0;
  let totalFailed = 0;
  
  // Process in batches
  while (true) {
    const stats = await runScoringCycle(config, spawnFn);
    
    totalProcessed += stats.processed;
    totalFailed += stats.failed;
    
    console.log(`[process-scoring-queue] Batch: ${stats.processed} scored, ${stats.failed} failed`);
    
    // Stop if no more calls or limit reached
    if (stats.processed === 0 && stats.failed === 0) {
      console.log('[process-scoring-queue] No more pending calls');
      break;
    }
    
    if (limit && totalProcessed >= limit) {
      console.log(`[process-scoring-queue] Reached limit of ${limit}`);
      break;
    }
    
    // Small delay between batches
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`[process-scoring-queue] Done! Total: ${totalProcessed} scored, ${totalFailed} failed`);
}

main().catch(err => {
  console.error('[process-scoring-queue] Fatal error:', err);
  process.exit(1);
});
