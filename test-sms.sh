#!/bin/bash
# Test SMS sending via the Agentic Property Manager

echo "=== Testing SMS via /events endpoint ==="
echo ""

# Check if server is running
echo "1. Checking server health..."
HEALTH=$(curl -s http://localhost:8000/health 2>&1)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "   ✓ Server is running"
  echo "   $HEALTH"
else
  echo "   ✗ Server is NOT running. Start it with: npm run dev"
  exit 1
fi

echo ""
echo "2. Sending guest message event..."
RESPONSE=$(curl -s -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{"type":"guest_message","from":"+18339874206","body":"Can I check out late tomorrow?"}')

echo "   Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"status":"queued"'; then
  echo "   ✓ Event queued successfully"
  echo ""
  echo "3. Watch your server terminal for:"
  echo "   - [AGENT] Starting loop..."
  echo "   - [TOOL:send_sms] SMS sent via Surge API (success)"
  echo "   - or [TOOL:send_sms] Surge API error (failure)"
else
  echo "   ✗ Event was not queued"
fi
