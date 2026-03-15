import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// DEPRECATED: This route (/api/webhook/fathom) has been replaced by
// /api/webhooks/fathom which handles both Fathom direct (Svix) and Zapier
// webhooks with source detection.
//
// Retired: 2026-03-15
// Replacement: /api/webhooks/fathom
// ============================================================================

const GONE_RESPONSE = {
  error: "Gone",
  message:
    "This endpoint has been retired. Use /api/webhooks/fathom instead (note the plural 'webhooks').",
  replacement: "/api/webhooks/fathom",
  deprecated_since: "2026-03-15",
};

export async function POST(_request: NextRequest) {
  console.log(
    "[DEPRECATED WEBHOOK] /api/webhook/fathom hit — returning 410 Gone"
  );
  return NextResponse.json(GONE_RESPONSE, { status: 410 });
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(GONE_RESPONSE, { status: 410 });
}
