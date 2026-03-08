export default function HomePage() {
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>Credit Club Coach</h1>
      <p>App is loading. Environment check:</p>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'}</li>
        <li>NEXT_PUBLIC_SUPABASE_PROJECT_URL: {process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ? '✅' : '❌'}</li>
        <li>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? '✅' : '❌'}</li>
      </ul>
      <a href="/sign-in" style={{ color: 'blue' }}>Go to Sign In</a>
    </div>
  );
}