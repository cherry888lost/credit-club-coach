#!/usr/bin/env node
/**
 * Process pending scoring requests with rate limiting
 * Usage: node scripts/process-scoring-queue-slow.js [--limit N]
 */

const { createClient } = require('@supabase/supabase-js');
const { loadConfig, runScoringCycle } = require('../dist/index');

const limit = process.argv.includes('--limit') 
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) 
  : undefined;

// Rate limiting: wait between API calls
const RATE_LIMIT_DELAY_MS = 5000; // 5 seconds between calls

async function main() {
  console.log('[process-scoring-queue-slow] Starting with rate limiting...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY env var');
    process.exit(1);
  }
  
  const config = loadConfig();
  let callCount = 0;
  
  const spawnFn = async (prompt, agentId) => {
    callCount++;
    console.log(`[spawnFn] Call #${callCount} - Sending to OpenAI (prompt: ${prompt.length} chars)...`);
    
    // Add delay after every call to respect rate limits
    if (callCount > 1) {
      console.log(`[spawnFn] Waiting ${RATE_LIMIT_DELAY_MS}ms for rate limit...`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
    
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
  
  while (true) {
    const stats = await runScoringCycle(config, spawnFn);
    
    totalProcessed += stats.processed;
    totalFailed += stats.failed;
    
    console.log(`[process-scoring-queue-slow] Batch: ${stats.processed} scored, ${stats.failed} failed`);
    
    if (stats.processed === 0 && stats.failed === 0) {
      console.log('[process-scoring-queue-slow] No more pending calls');
      break;
    }
    
    if (limit && totalProcessed >= limit) {
      console.log(`[process-scoring-queue-slow] Reached limit of ${limit}`);
      break;
    }
  }
  
  console.log(`[process-scoring-queue-slow] Done! Total: ${totalProcessed} scored, ${totalFailed} failed`);
}

main().catch(err => {
  console.error('[process-scoring-queue-slow] Fatal error:', err);
  process.exit(1);
});
