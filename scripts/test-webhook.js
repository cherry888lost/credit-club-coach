/**
 * Test Fathom Webhook
 * 
 * Run this from your browser console or use the curl command below
 */

async function testWebhook() {
  const WEBHOOK_URL = "http://localhost:3000/api/webhook/fathom";
  const SECRET = "dev-webhook-secret-12345";
  
  const payload = {
    id: `call_${Date.now()}`,
    title: "Test Sales Call with Prospect",
    started_at: new Date().toISOString(),
    transcript: "Rep: Hi, this is Alex from Credit Club. Prospect: Hi Alex, thanks for calling. Rep: I wanted to discuss how we can help you maximize your credit card points. The Amex Gold is perfect for your spending...",
    recording_url: "https://example.com/recording.mp4",
    host: {
      email: "arshid@creditclub.com",
      name: "Arshid"
    },
    participants: [
      {
        email: "prospect@example.com",
        name: "John Prospect"
      }
    ],
    metadata: {
      duration: 1800,
      source: "test-script"
    }
  };
  
  // Generate signature (in real scenario, this is done by Fathom)
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload) + SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log("Sending test webhook...");
  console.log("Signature:", signature);
  
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fathom-Signature": signature,
    },
    body: JSON.stringify(payload),
  });
  
  const result = await response.json();
  console.log("Response:", response.status, result);
}

testWebhook();
