#!/usr/bin/env bash
set -e

# ==============================================================================
# Killer Test 2 Live Verification — Buffer Enforcement (Before & After Buffers)
#
# Owned by: DEV D (Verification)
# Evaluates: KT-2 live from curl as mandated by DEV-MANUAL.md §4.2, §11.1
# ==============================================================================

PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"

# Ensure server is running or start it temporarily
SERVER_STARTED=0
if ! curl -sf "${BASE_URL}/api/health" > /dev/null 2>&1; then
  echo "[KT-2 LIVE] Starting Meridian server on port ${PORT}..."
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
echo " KILLER TEST 2: LIVE BUFFER VERIFICATION                         "
echo "================================================================="

echo "1. Querying Host 7 Service 3 slots (15m before-buffer, 30m after-buffer)..."
RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata")

# Assert buffer metadata in response
if [[ "$RES" != *'"before":15'* ]] || [[ "$RES" != *'"after":30'* ]]; then
  echo "FAIL: Response does not reflect {before: 15, after: 30} buffer metadata."
  echo "Response: $RES"
  exit 1
fi
echo ">> Buffer metadata verified: before=15m, after=30m."

# Assert buffer collision detection
if [[ "$RES" != *'"reason":"buffer"'* ]]; then
  echo "FAIL: Expected slots in padded window to be marked unavailable with reason: buffer."
  echo "Response: $RES"
  exit 1
fi
echo ">> Padded window slots correctly marked unavailable (reason: 'buffer')."

# Run the strict buffer unit & integration suite
echo "2. Running engine-level bidirectional buffer inflation verification..."
npm run test:killer -- --test=kt2

echo "================================================================="
echo " KILLER TEST 2: ALL LIVE CHECKS GREEN                            "
echo "================================================================="
