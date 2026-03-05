// Dev-only test route for Fathom webhook
// Only works in development mode

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Test endpoint not available in production" },
      { status: 403 }
    );
  }
  
  const body = await request.json();
  const { targetUrl, secret, payload } = body;
  
  if (!targetUrl || !secret) {
    return NextResponse.json(
      { error: "Missing targetUrl or secret" },
      { status: 400 }
    );
  }
  
  try {
    // Generate signature
    const { createHash } = await import("crypto");
    const signature = createHash("sha256")
      .update(JSON.stringify(payload) + secret)
      .digest("hex");
    
    // Send test webhook
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fathom-Signature": signature,
      },
      body: JSON.stringify(payload),
    });
    
    const responseBody = await response.text();
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      response: responseBody,
      sentSignature: signature,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
