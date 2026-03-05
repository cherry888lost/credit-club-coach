#!/bin/bash

# Test Fathom Webhook Script
# Usage: ./scripts/test-webhook.sh

WEBHOOK_URL="http://localhost:3000/api/webhook/fathom"
SECRET="your-webhook-secret-here"

# Generate signature
PAYLOAD='{
  "id": "call_"'$(date +%s)'",
  "title": "Test Sales Call with Prospect",
  "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "transcript": "Rep: Hi, this is Alex from Credit Club. Prospect: Hi Alex, thanks for calling. Rep: I wanted to discuss how we can help you maximize your credit card points...",
  "recording_url": "https://example.com/recording.mp4",
  "host": {
    "email": "arshid@creditclub.com",
    "name": "Arshid"
  },
  "participants": [
    {
      "email": "prospect@example.com",
      "name": "John Prospect"
    }
  ]
}'

SIGNATURE=$(echo -n "$PAYLOAD$SECRET" | openssl dgst -sha256 | cut -d' ' -f2)

echo "Sending test webhook to $WEBHOOK_URL"
echo "Signature: $SIGNATURE"
echo ""
echo "Payload:"
echo "$PAYLOAD" | jq .
echo ""
echo "Response:"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Fathom-Signature: $SIGNATURE" \
  -d "$PAYLOAD" \
  -w "\nHTTP Status: %{http_code}\n"
