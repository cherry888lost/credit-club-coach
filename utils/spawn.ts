// Stub for sessions spawn utility
// This is called by the scoring analyzer worker

export interface SpawnOptions {
  task: string;
  label?: string;
  model?: string;
  timeout?: number;
  agentId?: string;
  runtime?: string;
  mode?: string;
  timeoutSeconds?: number;
  [key: string]: unknown;
}

export async function sessionsSpawn(_options: SpawnOptions): Promise<string> {
  throw new Error("sessionsSpawn is not available in this context. Use the OpenClaw sessions_spawn tool instead.");
}
