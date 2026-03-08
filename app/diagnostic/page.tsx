import { auth } from "@clerk/nextjs/server";

export default async function DiagnosticPage() {
  let clerkStatus = "unknown";
  try {
    await auth();
    clerkStatus = "working";
  } catch (e) {
    clerkStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  
  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>Environment Check</h1>
      <pre>{JSON.stringify({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
        clerkPubKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'SET' : 'MISSING',
        clerkSecretKey: process.env.CLERK_SECRET_KEY ? 'SET' : 'MISSING',
        clerkStatus,
        nodeEnv: process.env.NODE_ENV,
      }, null, 2)}</pre>
    </div>
  );
}