# HACKBACK code review · DBG-498 · Smart Slot Booking
- Reviewed at: 2026-10-06T08:28:00Z (2026-10-06T13:58:00+05:30 IST)
- Judged commit: 377c50e710ac352293890891c628e7a4e335fa57 (2026-10-06T13:15:20+05:30) · the last commit before the code freeze
- Reviewer: AI agent run by a HACKBACK judge

### DBG-498 · Smart Slot Booking
Commit: 377c50e710ac352293890891c628e7a4e335fa57 · 2026-10-06T13:15:20+05:30 · Clean-room: see flags

| Section | Score | Why (path:line) |
|---|---|---|
| A. Core flow | 20/30 | Engine calculations (`src/engine/availability.ts:118`), IANA timezone projections (`src/engine/zones.ts:127`), and atomic booking claims (`src/booking/claim.ts:69`) succeed against PostgreSQL. However, `GET /api/slots` route invokes `getSlotsFromEngine` without passing the `db` client, triggering an unhandled TypeError that silently falls back to a hardcoded stub generator (`src/routes/engineAdapter.ts:34-120`). Cancellation (`src/routes/bookings.ts:144-178`) and reschedule (`src/routes/bookings.ts:180-226`) operate solely on an in-memory Map (`bookingStorage.set`, `src/routes/bookings.ts:173`) and never persist to PostgreSQL. Holds (`src/routes/holds.ts:24-32`) return simulated IDs without writing to the database. |
| B. Killer Tests | 23/30 | KT-1 (10/10) handles IANA zones and DST shifts across PDT/PST without numeric offset constants (`src/engine/zones.ts:22-174`, `tests/killer-tests/kt1-zones.test.ts:34-90`). KT-2 (3/10) correctly inflates busy windows in pure engine logic (`src/engine/buffers.ts:15-36`), but the server booking claim engine (`src/booking/claim.ts:168-178`) completely ignores buffer windows during overlap checks, allowing direct API calls to book into buffers. KT-3 (10/10) uses PostgreSQL transaction-scoped advisory locks (`src/booking/claim.ts:125-127`) proven under 40-client HTTP concurrency (`tests/concurrency/http-claim.test.ts:74`) and 40-caller barrier testing with the database constraint disabled (`tests/concurrency/run.ts:77-127`). |
| C. Two improvements | 15/20 | Improvement 1 (10/10): Atomic slot claim via Postgres advisory lock (`src/booking/claim.ts:57-239`, `tests/concurrency/run.ts:77-127`) fully built and wired. Improvement 2 (5/10): Meridian Intelligence (`docs/GAPS.md:38`, `SUBMISSION.md:76`) promised D1–D4. D1 Concierge, D2 Allocator, and D4 Suggest are not found anywhere in `src/`. D3 Clash Sentinel is partly built: student commitment overlap check is enforced in `src/booking/claim.ts:131-145`, but route `GET /api/intel/clashes` returns hardcoded mock commitments (`src/routes/intel.ts:27-44`) and `claimAdapter.ts:47-58` hardcodes student 42. |
| D. Built from their docs | 5/10 | Core engine and schema follow `docs/PRD.md` and `docs/DATA_MODEL.md`, but significant drift exists: 4 routes from `docs/API.md` are unbuilt (`/api/admin/demand`, `/api/intel/concierge`, `/api/intel/allocate`, `/api/intel/suggest`), metadata endpoints return hardcoded static arrays (`src/routes/meta.ts:7-36`), holds and cancellations operate in memory rather than on DB, and migration 002 for the exclusion constraint was never deployed. |
| E. Engineering | 6/10 | Strict Zod validation on routes (`src/routes/slots.ts:9`, `src/routes/bookings.ts:43`), central error formatting (`src/app.ts:26-36`), anti-enumeration 404 on cancellation without token (`src/routes/bookings.ts:167`), clean `.env.example`, and UTC timestamptz storage. However, `claim.ts` omits working hours and past slot validation, `tests/killer-tests/runner.ts:44` has a Windows process spawn failure, and `tests/api/routes.test.ts:146, :169` fails on unseeded student foreign key constraint violation. |
| Total | 69/100 | |

Killer Tests:
1. READY · 10/10 · Exact instant identity across DST boundaries (09:00 IST -> 20:30 PDT on 2026-10-15; 19:30 PST on 2026-12-15) using Intl / Luxon zone conversion (`src/engine/zones.ts:34-96`, `src/routes/engineAdapter.ts:94-99`). Proven by unit suite (`tests/killer-tests/kt1-zones.test.ts:34-90`) and live curl runner (`tests/killer-tests/kt1-live.sh:35-73`).
2. PARTIAL · 3/10 · Bidirectional buffer inflation implemented in pure engine (`src/engine/buffers.ts:15-36`, `src/engine/availability.ts:254-257`) and stubbed in route adapter (`src/routes/engineAdapter.ts:77-84`). However, server booking validation in `src/booking/claim.ts:168-178` checks only raw slot overlap (`slotStart < slotEnd AND slotEnd > slotStart`) without applying buffers from `ServiceType`, allowing direct API bookings into buffer windows.
3. READY · 10/10 · Atomic claim implemented via transaction-scoped advisory lock `SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))` in `src/booking/claim.ts:125-127`. Proven under high concurrency: 40 concurrent HTTP requests produce exactly 1 winner (201) and 39 losers (409) (`tests/concurrency/http-claim.test.ts:74`), and 40-thread barrier test over 5 runs with constraint disabled yields 1 winner and 39 losers each run (`tests/concurrency/run.ts:77-127`). Multi-station lab capacity (KT-3b) admits exactly 3 into 3-station lab (`tests/killer-tests/kt3b-capacity.test.ts:46-80`).

Improvements:
1. Atomic slot claim (G-01 / KT-3) · 10/10 · Advisory lock transaction in PostgreSQL guarantees exactly one winner for contested slots (`src/booking/claim.ts:57-239`, `src/routes/bookings.ts:58`). Verified across multiple runs and against negative control (`tests/concurrency/run.ts:77-127`, `tests/concurrency/negative-control.ts:67-86`).
2. Meridian Intelligence (D1–D4) · 5/10 · Promised four capabilities in `docs/GAPS.md:38-60` and `SUBMISSION.md:76-98`. D1 Concierge, D2 Allocator, and D4 Suggest are not found in `src/`. D3 Clash Sentinel is partly built: student commitment overlap check is enforced in `src/booking/claim.ts:131-145` and `src/engine/availability.ts:259-283`, but `GET /api/intel/clashes` returns hardcoded mock commitments (`src/routes/intel.ts:27-44`) and `src/routes/claimAdapter.ts:47-58` hardcodes student 42.

Flags:
- Fake: `src/routes/meta.ts:7-36` returns hardcoded mock data for hosts, resources, and services instead of querying database records.
- Fake: `src/routes/holds.ts:24-32` (`POST /api/holds`) generates a random ID and expiration without writing to the Prisma `Hold` model.
- Fake: `src/routes/intel.ts:27-44` (`GET /api/intel/clashes`) returns hardcoded mock timetable commitments.
- Fake: `src/routes/slots.ts:57` calls `getSlotsFromEngine` without `db`, causing `src/engine/availability.ts` to fail and silently fall back to `src/routes/engineAdapter.ts:34-120` which returns hardcoded mock slots with simulated buffer/clash states.
- Fake: `src/routes/bookings.ts:26-37, 144-178` (`DELETE /api/bookings/:id`) operates on an in-memory `bookingStorage` Map pre-populated with mock booking 42, never modifying PostgreSQL bookings.

3 questions for the judges to ask this team in their Defence, aimed at the weakest spots you found:
1. In `src/booking/claim.ts:168-178`, why does the concurrency overlap check only query raw interval bounds (`slotStart < slotEnd AND slotEnd > slotStart`) without applying the service's `beforeBuffer` and `afterBuffer`, allowing direct API bookings to violate buffer periods?
2. In `src/routes/slots.ts:57`, why is `getSlotsFromEngine` invoked without passing the database client, resulting in the availability engine throwing and falling back to the hardcoded mock generator in `src/routes/engineAdapter.ts:34-120`?
3. In `SUBMISSION.md:76` and `docs/GAPS.md:38`, you claimed Meridian Intelligence delivers D1 Concierge, D2 Allocator, D3 Clash Sentinel, and D4 Suggest in `src/intel/*`. Why are D1, D2, and D4 entirely missing from `src/`, while `GET /api/intel/clashes` returns hardcoded mock data?

SCORE core=20 kt=23 imp=15 docs=5 eng=6 total=69
