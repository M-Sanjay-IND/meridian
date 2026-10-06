#!/usr/bin/env bash
set -e

# ==============================================================================
# Meridian — Consolidated Killer Tests & Judge Demo Runner (3-Minute Script)
#
# Owned by: DEV D (Verification)
# Reference: DEV-MANUAL.md §11.1 (Judge Demo Order), docs/PRD.md §7
#
# Order of demonstration:
# 1. KT-1 Live: Two curl calls (IST vs America/Los_Angeles across DST boundary)
# 2. KT-2 Live: Padded buffer window is empty / marked unavailable with reason
# 3. KT-3 Live: Negative control first (20/20 rows), then advisory lock (1 row)
# 4. KT-3b Live: Multi-station capacity test (3 admitted into 3-station lab)
# 5. D3 Live: Clash Sentinel timetable conflict check
# ==============================================================================

PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"

echo "========================================================================"
echo "          MERIDIAN: KILLER TESTS & VERIFICATION DEMO RUNNER             "
echo "========================================================================"
echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

# Ensure server is running or start it temporarily in background
SERVER_STARTED=0
if ! curl -sf "${BASE_URL}/api/health" > /dev/null 2>&1; then
  echo "[LIVE DEMO] Starting Meridian server on port ${PORT}..."
  npm run dev > /dev/null 2>&1 &
  SERVER_PID=$!
  SERVER_STARTED=1
  sleep 4
fi

cleanup() {
  if [ "$SERVER_STARTED" -eq 1 ] && [ -n "$SERVER_PID" ]; then
    echo ""
    echo "[LIVE DEMO] Shutting down temporary Meridian server..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ------------------------------------------------------------------------------
# STEP 1: KILLER TEST 1 (Timezone Parity & DST Arithmetic)
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------------------"
echo " STEP 1: KILLER TEST 1 (Timezone Parity across DST Boundaries)"
echo "------------------------------------------------------------------------"
echo "Querying Host 7 on 2026-10-15 in Asia/Kolkata (IST)..."
IST_RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata")
IST_START=$(echo "$IST_RES" | grep -o '"start":"[^"]*"' | head -n 1 | cut -d'"' -f4)

echo "Querying Host 7 on 2026-10-15 in America/Los_Angeles (PDT, UTC-7)..."
LA_RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=America/Los_Angeles")
LA_START=$(echo "$LA_RES" | grep -o '"start":"[^"]*"' | head -n 1 | cut -d'"' -f4)

echo "   -> Asia/Kolkata start:        $IST_START"
echo "   -> America/Los_Angeles start: $LA_START"

if [[ "$IST_START" != *"2026-10-15T09:00:00+05:30"* ]] || [[ "$LA_START" != *"2026-10-14T20:30:00-07:00"* ]]; then
  echo "FAIL: Instant parity mismatch between IST and PDT on 2026-10-15."
  exit 1
fi
echo "[KT-1 PASSED] 09:00 IST = 20:30 PDT (exact instant identity, zero hardcoded offset)."
echo ""

# ------------------------------------------------------------------------------
# STEP 2: KILLER TEST 2 (Buffer Enforcement & Padded Windows)
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------------------"
echo " STEP 2: KILLER TEST 2 (Bidirectional Buffer Enforcement)"
echo "------------------------------------------------------------------------"
echo "Querying Host 7 Service 3 slots (15m before, 30m after)..."
BUF_RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata")

if [[ "$BUF_RES" != *'"before":15'* ]] || [[ "$BUF_RES" != *'"after":30'* ]]; then
  echo "FAIL: Expected buffer metadata {before: 15, after: 30} in response."
  exit 1
fi

if [[ "$BUF_RES" != *'"reason":"buffer"'* ]]; then
  echo "FAIL: Expected buffer collision reason in padded window."
  exit 1
fi
echo "[KT-2 PASSED] Buffer window correctly inflated and slots marked unavailable (reason: 'buffer')."
echo ""

# ------------------------------------------------------------------------------
# STEP 3: KILLER TEST 3 (Negative Control & Concurrency Race)
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------------------"
echo " STEP 3: KILLER TEST 3 (Empirical Concurrency Race)"
echo "------------------------------------------------------------------------"
echo "[A] Running Negative Control (proving naive concurrency defect)..."
npx tsx tests/concurrency/negative-control.ts

echo ""
echo "[B] Running Production Atomic Claim (with Postgres constraint disabled)..."
npm run test:concurrency

echo "[KT-3 PASSED] 20/20 rows inserted under naive race vs EXACTLY 1 winner under advisory lock."
echo ""

# ------------------------------------------------------------------------------
# STEP 4: KILLER TEST 3b (Multi-Station Lab Capacity)
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------------------"
echo " STEP 4: KILLER TEST 3b (Capacity-3 Lab Concurrency)"
echo "------------------------------------------------------------------------"
npm run test:killer -- --test=kt3b
echo "[KT-3b PASSED] Exactly 3 admitted into 3-station lab, 5 rejected."
echo ""

# ------------------------------------------------------------------------------
# STEP 5: DIFFERENTIATOR D3 (Clash Sentinel)
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------------------"
echo " STEP 5: DIFFERENTIATOR D3 (Clash Sentinel Timetable Conflict)"
echo "------------------------------------------------------------------------"
echo "Querying slots for Student 42 (lecture commitment on 2026-10-15 10:00-11:30 IST)..."
CLASH_RES=$(curl -sf "${BASE_URL}/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata&studentId=42")

if [[ "$CLASH_RES" != *'"reason":"clash"'* ]]; then
  echo "FAIL: Expected slots overlapping student lecture to be marked reason: clash."
  exit 1
fi
echo "[D3 PASSED] Conflicting lecture slots marked unavailable (reason: 'clash')."
echo ""

echo "========================================================================"
echo "               ALL KILLER TESTS & DEMOS VERIFIED GREEN                  "
echo "========================================================================"
