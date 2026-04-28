#!/usr/bin/env bash
# E2E test for chat-poc using wscat (WebSocket CLI)
# Install: npm install -g wscat
#
# Usage: ./scripts/e2e-test.sh

set -euo pipefail

BASE_URL="http://localhost:3001"
WS_URL="ws://localhost:3001"
PASS=0
FAIL=0

green()  { echo -e "\033[32m✓ $*\033[0m"; }
red()    { echo -e "\033[31m✗ $*\033[0m"; }
header() { echo -e "\n\033[1;34m── $* ──\033[0m"; }

assert() {
  local desc="$1"
  local actual="$2"
  local expected="$3"
  if echo "$actual" | grep -q "$expected"; then
    green "$desc"
    ((PASS++))
  else
    red "$desc (expected: $expected, got: $actual)"
    ((FAIL++))
  fi
}

# ── 1. Health check ──────────────────────────────────────────
header "Health"
HEALTH=$(curl -sf "$BASE_URL/health")
assert "GET /health returns ok" "$HEALTH" '"status":"ok"'

# ── 2. WebSocket connect ─────────────────────────────────────
header "WebSocket connect"
# Connect alice and bob in background, capture output
ALICE_OUT=$(wscat -c "$WS_URL/socket.io/?userId=alice&EIO=4&transport=websocket" \
  --wait 2 --no-color 2>&1 || true)
assert "alice can connect" "$ALICE_OUT" "0{"

BOB_OUT=$(wscat -c "$WS_URL/socket.io/?userId=bob&EIO=4&transport=websocket" \
  --wait 2 --no-color 2>&1 || true)
assert "bob can connect" "$BOB_OUT" "0{"

# ── 3. Missing userId rejected ───────────────────────────────
header "Auth validation"
NOAUTH_OUT=$(wscat -c "$WS_URL/socket.io/?EIO=4&transport=websocket" \
  --wait 2 --no-color 2>&1 || true)
assert "connection without userId is rejected" "$NOAUTH_OUT" "userId is required"

# ── 4. Summary ───────────────────────────────────────────────
echo ""
echo "────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"
echo "────────────────────────────"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
