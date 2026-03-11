import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/api/webhook(.*)",  // Webhooks must be public
  "/api/test-webhook", // Test endpoint must be public
]);

export default clerkMiddleware(async (auth, req) => {
  console.log(`[MIDDLEWARE] ${req.method} ${req.url}`);
  
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    console.log(`[MIDDLEWARE] Protecting route: ${req.url}`);
    await auth.protect();
  } else {
    console.log(`[MIDDLEWARE] Public route, skipping auth: ${req.url}`);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
