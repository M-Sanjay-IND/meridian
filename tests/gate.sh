#!/usr/bin/env bash
set -e

# Meridian Verification Gate — Section 8.2 of DEV-MANUAL.md
# Run before every merge to main by the Integrator.

echo "1. typecheck"
npx tsc --noEmit

echo "2. fresh install"
rm -rf node_modules && npm ci

echo "3. database"
docker compose up -d db && npm run db:migrate && npm run db:seed

echo "4. server"
npm run dev &
DEV_PID=$!
sleep 6

cleanup() {
  if kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "5. health"
curl -sf localhost:3000/api/health

echo "6. KT-1 zones"
curl -sf "localhost:3000/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=America/Los_Angeles"

echo "7. KT-2 buffers"
npm run test:killer -- --test=kt2

echo "8. KT-3 concurrency"
npm run test:concurrency

echo "9. KT-3b capacity"
npm run test:killer -- --test=kt3b

echo "10. AI off"
cleanup
OPENAI_API_KEY= npm run dev &
DEV_PID=$!
sleep 6
curl -sf "localhost:3000/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata"

echo "11. clean room"
! grep -rq "@calcom" src/ package.json

echo "12. configurable"
grep -q HOLD_TTL_MINUTES .env.example

echo "GATE: ALL GREEN"
