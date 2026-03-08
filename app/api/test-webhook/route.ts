import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payload } = body;
    
    if (!payload) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }
    
    const secret = process.env.FATHOM_WEBHOOK_SECRET;
    
    if (!secret) {
      console.error("[TEST_WEBHOOK] FATHOM_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured on server" },
        { status: 500 }
      );
    }
    
    // Generate signature exactly like the webhook route expects
    const payloadString = JSON.stringify(payload);
    const signature = createHash("sha256")
      .update(payloadString + secret)
      .digest("hex");
    
    console.log("[TEST_WEBHOOK] Generated signature for test payload");
    
    // Send the webhook request
    const origin = request.headers.get("origin") || "http://localhost:3000";
    const webhookUrl = `${origin}/api/webhook/fathom`;
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fathom-Signature": signature,
      },
      body: payloadString,
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      result,
    });
    
  } catch (error) {
    console.error("[TEST_WEBHOOK] Error:", error);
    return NextResponse.json(
      { error: "Failed to send test webhook" },
      { status: 500 }
    );
  }
}
