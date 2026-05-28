import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes — no auth required
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/unauthorized",
  "/accept-invite",
  "/api/webhook(.*)",
  "/api/test-webhook",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Local-only developer bypass for restoring/verifying the dashboard without Clerk email codes.
  // Never enable this in Vercel/production.
  if (process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1") {
    return;
  }

  // Allow public routes through
  if (isPublicRoute(req)) {
    return;
  }

  // Protect all other routes — redirects to sign-in if not authenticated
  const { userId } = await auth.protect();

  // After Clerk auth, check rep status via API-style lookup
  // We can't import Supabase in edge middleware, so we use a lightweight check
  // The actual rep validation happens in dashboard layout and API routes
  // Middleware only ensures Clerk auth; rep checks happen server-side in pages/APIs
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
