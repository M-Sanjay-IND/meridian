#!/usr/bin/env bash
set -e

# ==============================================================================
# Killer Test 1 Live Curl Verification — Timezone Parity (IST vs PST/PDT)
#
# Owned by: DEV D (Verification)
# Evaluates: KT-1 live from curl as mandated by README.md and DEV-MANUAL.md §4
# ==============================================================================

PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"

# Ensure server is running or start it temporarily
SERVER_STARTED=0
if ! curl -sf "${BASE_URL}/api/health" > /dev/null 2>&1; then
  echo "[KT-1 LIVE] Starting Meridian server on port ${PORT}..."
  npm run dev > /dev/null 2>&1 &
  SERVER_PID=$!
  SERVER_STARTED=1
  sleep 4
fi

cleanup() {
  if [ "$SERVER_STARTED" -eq 1 ] && [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "================================================================="
echo " KILLER TEST 1: LIVE CURL VERIFICATION                           "
echo "================================================================="

# 1. October Date (PDT, UTC-7) — 12h 30m difference from IST
echo "1. Querying Host 7 on 2026-10-15 in Asia/Kolkata (IST)..."
IST_RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata")

echo "2. Querying Host 7 on 2026-10-15 in America/Los_Angeles (PDT)..."
LA_RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=America/Los_Angeles")

# Extract first slot start times
IST_START=$(echo "$IST_RES" | grep -o '"start":"[^"]*"' | head -n 1 | cut -d'"' -f4)
LA_START=$(echo "$LA_RES" | grep -o '"start":"[^"]*"' | head -n 1 | cut -d'"' -f4)

echo "   -> Asia/Kolkata start:        $IST_START"
echo "   -> America/Los_Angeles start: $LA_START"

# Verify expected timestamps
if [[ "$IST_START" != *"2026-10-15T09:00:00"* ]]; then
  echo "FAIL: Expected IST start at 09:00:00 on 2026-10-15, got $IST_START"
  exit 1
fi

if [[ "$LA_START" != *"2026-10-14T20:30:00-07:00"* ]]; then
  echo "FAIL: Expected PDT start at 20:30:00-07:00 on 2026-10-14, got $LA_START"
  exit 1
fi
echo ">> October Date PASSED: 09:00 IST = 20:30 PDT (exact instant identity across DST)."

# 2. Standard Time Date (PST, UTC-8) — 13h 30m difference from IST
echo ""
echo "3. Querying Host 7 on standard-time date 2026-12-15 in America/Los_Angeles (PST)..."
PST_RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-12-15&to=2026-12-15&tz=America/Los_Angeles")
PST_START=$(echo "$PST_RES" | grep -o '"start":"[^"]*"' | head -n 1 | cut -d'"' -f4)

echo "   -> Standard Time PST start:   $PST_START"

if [[ "$PST_START" != *"2026-12-14T19:30:00-08:00"* ]]; then
  echo "FAIL: Expected PST start at 19:30:00-08:00 on 2026-12-14, got $PST_START"
  exit 1
fi
echo ">> Standard Time Date PASSED: 09:00 IST = 19:30 PST (exact standard time conversion)."

echo ""
echo "================================================================="
echo " KILLER TEST 1: ALL LIVE CHECKS GREEN                            "
echo "================================================================="
