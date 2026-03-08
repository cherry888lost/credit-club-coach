import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  console.log("[TEST_WEBHOOK] ===== ROUTE HIT =====");
  console.log(`[TEST_WEBHOOK] URL: ${request.url}`);
  console.log(`[TEST_WEBHOOK] Method: ${request.method}`);
  
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log("[TEST_WEBHOOK] Request body parsed:", JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error("[TEST_WEBHOOK] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body", details: String(parseError) },
        { status: 400 }
      );
    }
    
    const { payload } = body;
    
    if (!payload) {
      console.error("[TEST_WEBHOOK] Missing payload in request");
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }
    
    // Get secret
    const secret = process.env.FATHOM_WEBHOOK_SECRET;
    console.log(`[TEST_WEBHOOK] FATHOM_WEBHOOK_SECRET exists: ${!!secret}`);
    
    if (!secret) {
      console.error("[TEST_WEBHOOK] FATHOM_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { 
          error: "Webhook secret not configured on server",
          hint: "Add FATHOM_WEBHOOK_SECRET to your environment variables"
        },
        { status: 500 }
      );
    }
    
    // Generate signature
    const payloadString = JSON.stringify(payload);
    const signature = createHash("sha256")
      .update(payloadString + secret)
      .digest("hex");
    
    console.log(`[TEST_WEBHOOK] Generated signature: ${signature.substring(0, 20)}...`);
    console.log(`[TEST_WEBHOOK] Payload: ${payloadString.substring(0, 200)}...`);
    
    // Build webhook URL - use absolute URL for production
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/webhook/fathom`;
    console.log(`[TEST_WEBHOOK] Target URL: ${webhookUrl}`);
    
    // Send to actual webhook endpoint
    console.log("[TEST_WEBHOOK] Sending request to webhook endpoint...");
    let response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fathom-Signature": signature,
        },
        body: payloadString,
      });
      console.log(`[TEST_WEBHOOK] Webhook response status: ${response.status}`);
    } catch (fetchError) {
      console.error("[TEST_WEBHOOK] Fetch failed:", fetchError);
      return NextResponse.json(
        { 
          error: "Failed to connect to webhook endpoint", 
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 500 }
      );
    }
    
    // Get response body
    let result;
    const responseText = await response.text();
    console.log(`[TEST_WEBHOOK] Raw response: ${responseText.substring(0, 500)}`);
    
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { rawResponse: responseText };
    }
    
    console.log("[TEST_WEBHOOK] ==================== END ====================");
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      result,
    });
    
  } catch (error) {
    console.error("[TEST_WEBHOOK] Unhandled error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error in test webhook",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
