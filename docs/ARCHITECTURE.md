# ARCHITECTURE — Meridian

**What this document is.** The complete specification of how Meridian is built. A developer or an agent with only `docs/` must be able to build the system from this file plus `DATA_MODEL.md` and `API.md`, and must be able to tell why each choice was made. Nothing here requires reading the original repository.

**Relationship to the original.** We rebuild the *engine* — the domain logic the Brief names as the hard core — as our own code, and we copy no code and install no `@calcom/*` package. Where our design mirrors the original's decomposition we say so and cite it; where we deliberately diverge we say that too, and why.

---

## 1. System context

```
      Student (200)            Faculty / lab supervisor            Admin
           |                            |                            |
           +------------- HTTPS / JSON REST ----------+             |
                                      |                  |         |
                            +----------------+   +----------------+ |
                            |  Web client    |   |  CLI / curl    | |
                            |  (React + Vite)|   |  (verification)| |
                            +----------------+   +----------------+ |
                                      \               /             |
                                       \             /              |
                                 +---------------------------+       |
                                 |   API server (Fastify)    |<------+
                                 |  routes -> services -> db |
                                 +---------------------------+
                                       |            |
                            +---------------+  +------------------+
                            | PostgreSQL    |  | Optional:        |
                            | (source of    |  | LLM provider     |
                            |  truth)       |  | (concierge only) |
                            +---------------+  +------------------+
```

**The database is the single source of truth.** There is no cache in the correctness path. This is a deliberate rejection of the original's habit of consulting Redis for slot state: `packages/trpc/server/routers/viewer/slots/util.ts` is 1,435 lines partly because it coordinates with external state, and a rebuild that keeps only the engine does not need it. Removing the cache removes a whole class of "the cache and the row disagree" bugs that the Bug Hunt round rewards.

## 2. Component map

| Layer | Module | Responsibility | Must not do |
|---|---|---|---|
| HTTP | `src/routes/*` | Parse, validate, call one service, shape the response | Contain scheduling logic |
| Domain | `src/engine/availability.ts` | Compute free slots for a host or resource | Touch HTTP or the LLM |
| Domain | `src/engine/ranges.ts` | Date-range algebra: intersect, subtract, merge | Know about bookings specifically |
| Domain | `src/engine/zones.ts` | All time-zone conversion, in one place | Appear anywhere else |
| Domain | `src/engine/buffers.ts` | Inflate busy intervals by before/after buffers | Decide whether a slot is offered |
| Domain | `src/engine/overrides.ts` | Recurring rules + date overrides + holidays → ranges | Read the request object |
| Domain | `src/booking/claim.ts` | **The atomic claim** — the only writer of bookings | Validate business rules |
| Domain | `src/booking/service.ts` | Validate → claim → persist → confirm | Open a transaction by hand in two places |
| Intelligence | `src/intel/concierge.ts` | Parse natural language → constraints | Invent availability |
| Intelligence | `src/intel/allocator.ts` | Assign scarce slots across a cohort | Write bookings directly |
| Intelligence | `src/intel/sentinel.ts` | Book a student's own commitments | Mutate host availability |
| Intelligence | `src/intel/suggest.ts` | Rank slots from history | Override a hard constraint |
| Data | `src/db/*` | Prisma client, repositories, migrations | Contain business rules |

**The single-writer rule.** `src/booking/claim.ts` is the only module in the codebase permitted to insert a `Booking` row. Every other path — the API, the allocator, the seed script — goes through it. This is a structural guarantee, not a convention: it is the reason KT-3 can be argued rather than merely tested.

## 3. The availability pipeline

Slots are computed as a pipeline of pure functions over ranges. This mirrors the original's proven shape — the original computes availability as a set subtraction at `packages/features/availability/lib/getUserAvailability.ts:648` and keeps range algebra in its own module (`packages/features/schedules/lib/date-ranges.ts:423`) — and we adopt it because it is genuinely the right decomposition: every stage is testable alone.

```
inputs: hostId | resourceId, date range, bookerTimeZone
   |
   v
[1] resolve working hours         recurring rules for the weekday  (engine/overrides)
   |
   v
[2] apply date overrides          a row for a specific date REPLACES that day
   |
   v
[3] remove term holidays          day-off overrides subtract whole days
   |
   v
[4] load busy intervals           accepted AND held AND pending-confirmation bookings
   |                              + the booker's own commitments  (D3)
   v
[5] inflate by buffers            start -= afterBuffer, end += beforeBuffer
   |
   v
[6] subtract busy from working    range algebra, not a per-slot loop
   |
   v
[7] slice into slots by duration  step = duration + spacing
   |
   v
[8] drop slots inside the lead time (minimum notice) and any blackout
   |
   v
[9] project into bookerTimeZone   and emit
   |
   v
[10] rank                             (D4, optional, never removes a legal slot)
```

**Two decisions worth defending in Q&A.**

**Stage 5 inflates the busy interval; it does not filter slots afterwards.** The original does exactly this — `packages/features/busyTimes/services/getBusyTimes.ts:266` moves a busy block's start back by the after-buffer and `:267` moves its end forward by the before-buffer. The reason is subtle and worth stating: filtering *after* slicing only removes slots whose **start** falls in the buffer, so a long appointment that begins before the buffer and extends into it survives. Inflating the interval is correct in both directions by construction, and it makes KT-2 provable.

**Stage 5 uses the maximum of the adjacent buffers.** When two bookings have different buffers, the gap must satisfy the larger of the two — the after-buffer of the earlier event and the before-buffer of the later one. The original encodes this at `packages/features/busyTimes/services/getBusyTimes.ts:135, :136`; we reproduce the *rule* deliberately, because the naive version (apply only the current event's buffers) is a real bug that a judge can trigger in thirty seconds by creating two event types with different buffers.

**Stage 4 includes holds and unconfirmed bookings.** The original queries only `ACCEPTED` bookings for busy time (`packages/features/busyTimes/services/getBusyTimes.ts:81`), which means a `PENDING` booking does not hold its slot — an open upstream defect (`#29967`, and the related `#29958`). We treat any non-cancelled booking, and any live hold, as busy. This is a one-line difference with a large consequence, and it is the first of our two scored improvements.

## 4. Concurrency

### 4.1 The defect we are fixing

In the original, availability is checked early and the booking is written much later, with no transaction spanning the two:

- `packages/features/bookings/lib/service/RegularBookingService.ts:902` — the availability gate is invoked.
- `packages/features/bookings/lib/service/RegularBookingService.ts:1707` — the booking is persisted.
- Between them: calendar fetches, video-link creation, and other awaits.
- `grep -c '\$transaction' packages/features/bookings/lib/service/RegularBookingService.ts` → **0**.

Both requests can pass the check, both write, and the slot is double-booked. Upstream tracks this as `#29605`.

The original does have a soft hold — a `SelectedSlots` row with a `releaseAt` (`packages/prisma/schema.prisma:1437`) — but its unique constraint is keyed on `(userId, slotUtcStartDate, slotUtcEndDate, uid)` (`packages/prisma/schema.prisma:1445`), and because both `userId` and `uid` are in the key, **two different visitors holding the same slot are not blocked by it**. Worse, the booking feature never consults the table at all (`grep -rn 'SelectedSlot' packages/features/bookings/` → 0 matches), so the hold shapes the list a visitor sees but is not re-checked when the booking is written.

### 4.2 Our design — and the experiment that changed it

We did not reason our way to this design. We built a negative control against a real PostgreSQL 16.15, watched the first design fail, and fixed it. The harness is a scored artifact and lives in the repo (`tests/concurrency/`). Every number below is a real observation, reproduced on the machine that built the system; the raw script is `tests/concurrency/claim-race.py`.

**The first design was wrong, and the wrongness is instructive.** Our first attempt used the single statement almost everyone reaches for — insert-if-not-exists:

```sql
INSERT INTO bookings (host_id, slot_start, slot_end, status)
SELECT $1, $2, $3, 'RESERVED'
WHERE NOT EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.status <> 'CANCELLED' AND b.slot_start < $3 AND b.slot_end > $2 AND b.host_id = $1
)
RETURNING id;
```

What the harness showed, with 20 threads released from a common barrier at the same instant:

| Experiment | Result | Meaning |
|---|---|---|
| Unguarded `INSERT`, no constraint, 20 threads, one 30-minute slot | **20 of 20 rows stored** | The defect is real and this harness detects it |
| Insert-if-not-exists, **no** constraint, 20 threads | **4 of 20 rows stored** | *The guard is not atomic on its own* |
| Same claim **with** the exclusion constraint | 1 of 20 | It passed — but the **constraint** saved it, not the guard |
| Same claim, capacity-3 lab slot, 8 threads, no constraint | **8 admitted into 3 places** | The count subquery reads a snapshot and cannot see uncommitted competitors |

That second row is the important one. Under PostgreSQL's default `READ COMMITTED`, the `NOT EXISTS` subquery is a snapshot read: 20 concurrent transactions each see zero existing bookings and each proceeds. Only if a competing `INSERT` has already **committed** does the guard see it. So the guard reduces the blast radius from 20 to 4 and stops there.

Worse, this failure is invisible if you only test the happy path. With the constraint in place, capacity-1 slots behave perfectly — so a team that tests only Killer Test 3, and adds a constraint, will never discover that their **capacity slots are badly broken**. That is precisely the class of bug this event rewards finding, so it is the first thing we fixed.

**The corrected design — three layers.**

**Layer 1 — a transaction-scoped advisory lock.** The claim runs inside one transaction that first takes an advisory lock keyed on `(host, day)`, then counts overlapping bookings, then inserts:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0));  -- host_id, YYYY-MM-DD

SELECT count(*) FROM bookings b
 WHERE b.status <> 'CANCELLED'
   AND b.slot_start < $4 AND b.slot_end > $3                                  -- half-open overlap
   AND (b.host_id = $1 OR (b.resource_id IS NOT DISTINCT FROM $5));

-- if count >= resources_needed  ->  ROLLBACK, return 409
INSERT INTO bookings (host_id, resource_id, resources_needed, slot_start, slot_end, status)
VALUES ($1, $5, $6, $3, $4, 'RESERVED') RETURNING id;
COMMIT;
```

The lock is what makes the check-and-insert atomic, because it is held for the life of the transaction and released automatically on commit or rollback — including if the process dies. Competing claims for the same host on the same day serialise; different hosts never contend. At campus scale (a few hundred bookings per day) this is free.

**The lock is keyed on the day, not on the exact slot, and that is deliberate.** Two requests for *overlapping but not identical* intervals (09:00–09:30 and 09:15–09:45) have different start times, so a lock keyed on the start time would not serialise them and the count would race. Keying on `(host, day)` serialises everything that could possibly overlap. Correctness first; the concurrency cost is irrelevant here.

**Layer 2 — a constraint as a backstop, scoped so it cannot cause a regression.**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD COLUMN time_range tstzrange
  GENERATED ALWAYS AS (tstzrange(slot_start, slot_end)) STORED;
ALTER TABLE bookings ADD CONSTRAINT no_host_overlap
  EXCLUDE USING gist (host_id WITH =, time_range WITH &&)
  WHERE (status <> 'CANCELLED' AND resources_needed = 1);
```

Two details are load-bearing and were both verified against PostgreSQL 16.15:

- The generated column must be **`tstzrange`**, not `tsrange`. `tsrange(timestamptz, timestamptz)` does not exist — PostgreSQL rejects the DDL outright (`function tsrange(timestamp with time zone, timestamp with time zone) does not exist`). Caught by running it, not by reading about it.
- The `resources_needed = 1` predicate is what keeps capacity-based slots out of the constraint. A blanket constraint on `(host_id, time_range)` would forbid exactly what a campus system needs: a lab slot with N stations holding **N** concurrent bookings — the same situation the original supports for seated events (`packages/prisma/schema.prisma:222`; `packages/trpc/server/routers/viewer/slots/reserveSlot.handler.ts:45` skips reservation for seated events). Upstream has an open issue about legitimate overlap (`#21467`).

Changing that predicate without understanding it is the single most likely way to fail **KT-3b**, which is why that criterion exists in `PRD.md`.

**Layer 3 — a hold with a TTL, for the human in the loop.** A student can hold a slot while they finish entering their details. The hold is a row with `expires_at`, is treated as busy by stage 4 of the availability pipeline, and its TTL comes from `.env` (`HOLD_TTL_MINUTES`) so a judge can set it to 1 minute and watch it expire. Unlike the original's hold, ours **is** consulted at claim time: the count in Layer 1 includes live holds.

**Why not a Redis lock.** A distributed lock works, but it puts a network dependency in the correctness path, and a lock that is not also backed by a constraint still leaves a slot unreserved if the process dies mid-flight. PostgreSQL already provides the guarantee. Optional Redis is used **only** for rate limiting, never for correctness.

**Why the constraint still matters even though the lock is correct.** The lock protects the service path; the constraint protects the *table*. If a future colleague writes a script that inserts a booking directly, or a second service appears, the constraint refuses the overlap. Verified: a direct `INSERT` of an overlapping interval while the constraint is active raises `ExclusionViolation` and leaves the row count unchanged.

### 4.3 Verified behaviour of the corrected design

All observed on PostgreSQL 16.15, 40 threads where stated, no constraint present unless noted.

| Scenario | Observed | Required |
|---|---|---|
| Capacity 1, 20 concurrent claimers, lock, no constraint | exactly **1** winner, 1 row | exactly 1 — **KT-3** |
| Capacity 1, 40 concurrent claimers, lock, 5 consecutive runs | **1, 1, 1, 1, 1** | exactly 1 every run |
| Capacity 3 lab slot, 8 concurrent claimers, lock | exactly **3** admitted, 3 rows | exactly 3 — **KT-3b** |
| Direct overlapping `INSERT` bypassing the service, constraint active | `ExclusionViolation`, row count unchanged | refused |
| Booking cancelled, then the slot claimed again | succeeds | cancelled slots are reusable |
| Same moment, no lock, no constraint | 20 rows stored | — (negative control) |
| Same moment, guard only, no lock, no constraint | 4 rows stored | — (why the lock exists) |

### 4.4 What each layer guarantees

| Failure mode | Caught by |
|---|---|
| Two simultaneous requests for one slot | Layer 1 (advisory lock serialises check + insert) — KT-3 |
| Two requests on different app instances | Layer 1 — the lock is in the database, not in the process |
| The process dies mid-claim | Layer 1 — the transaction-scoped lock releases on rollback/connection loss |
| A concurrent insert that bypasses the service | Layer 2 (constraint) |
| A lab slot that must seat 3 students | Layer 2's predicate deliberately excludes it — KT-3b |
| Student abandons the booking form | Layer 3 (TTL expiry) |
| A client that retries the same request | Idempotency key resolved before the lock (API.md §4) |

## 5. The Intelligence layer

**The governing constraint:** the app must run with no AI key at all. The intelligence layer is therefore split into a **deterministic core** and an **optional natural-language shell**, and the core is the part that carries all the value.

```
                    ┌──────────────────────────────────────────┐
   free text  ─────▶│ intel/concierge.ts                       │
                    │  if OPENAI_API_KEY: parse text ->        │
   constraints ────▶│     {duration, hostId, before, after,    │
                    │      busyWindows}                        │
                    │  else: form input -> identical struct    │
                    └───────────────┬──────────────────────────┘
                                    │ constraints are DATA, never decisions
                                    v
                    ┌──────────────────────────────────────────┐
                    │ engine/availability.ts  (deterministic)  │
                    └───────────────┬──────────────────────────┘
                                    v
                    ┌──────────────────────────────────────────┐
                    │ intel/allocator | sentinel | suggest     │
                    │  pure functions over the candidate list  │
                    └───────────────┬──────────────────────────┘
                                    v
                    ┌──────────────────────────────────────────┐
                    │ booking/claim.ts  (the only writer)      │
                    └──────────────────────────────────────────┘
```

**The safety property, stated as an invariant:** *the LLM output is typed as constraints and is re-validated by the engine before anything is offered or written.* A hallucinated slot cannot reach the client, because the concierge's candidates are filtered through the same availability function that serves the ordinary list. This is the difference between an AI feature and an AI decoration, and it is the argument to make in Q&A.

**D1 Concierge.** Input: free text. Output: a ranked, engine-validated candidate list; optionally a completed booking. Parsing falls back to a structured form when no key is present. Model choice is a `.env` value; the feature must work with any OpenAI-compatible endpoint, including a local one.

**D2 Allocator.** Pure function over `(students[], slots[], policy)`. Policies: `round-robin-week`, `by-request-time`, `spread-by-day`. Returns an assignment plus a report of demand, supply, served and unfilled. No LLM.

**D3 Clash Sentinel.** Extends stage 4 of the pipeline to include the **booker's** own commitments. On conflict, returns the conflicting commitment by name and the nearest alternatives. No LLM.

**D4 Suggest.** Ranks the legal candidate list by a score from history (the student's past attendance, cohort frequency, host fill rate). Ranking only — it can never introduce a slot the engine did not produce, nor remove a legal one. No LLM.

## 6. Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript, strict | The original is TypeScript; the team reads it fastest; one language across API, engine and tests |
| HTTP | Fastify | Small, fast, schema-validated routes. Next.js 16 would add a build step and framework weight the Brief does not ask for |
| DB | PostgreSQL 15+, via Prisma | The exclusion constraint in §4.2 is a PostgreSQL feature and is central to our fix. Prisma matches the original's access layer and the team's familiarity |
| Range algebra | `luxon` (or `date-fns-tz`) | A real zone database. Never hand-roll offsets — see PRD KT-1 |
| Client | React + Vite + TypeScript | One booking page and one admin page; no SSR needed |
| Tests | `vitest` for units, `supertest` for the API, a `concurrency` harness for KT-3 | The harness is a scored artifact, not an afterthought |
| AI | Optional, OpenAI-compatible, `.env` key | Degrades to a form; the app is fully functional without it |
| Config | `dotenv` + a validated schema | Every window and timeout is a setting, per the Brief |

**What we explicitly do not use:** any `@calcom/*` package, any code copied from the original, Redis in the correctness path, and any hard-coded time window.

## 7. Configuration

Every value that a judge might want to change in order to test in minutes rather than hours is an environment variable. Full list with defaults in `.env.example`; the ones that matter:

| Variable | Default | Why it exists |
|---|---|---|
| `DATABASE_URL` | — | Required |
| `PORT` | `3000` | — |
| `HOLD_TTL_MINUTES` | `10` | Set to `1` to demonstrate hold expiry live |
| `MIN_NOTICE_MINUTES` | `0` | Lead time before a slot is bookable |
| `MAX_BOOKINGS_PER_STUDENT_PER_WEEK` | `5` | Demonstrates a limit under concurrency |
| `TERM_HOLIDAYS` | empty | Comma-separated ISO dates for day-off overrides |
| `OPENAI_API_KEY` | empty | Optional. Empty ⇒ concierge uses its structured form |
| `OPENAI_BASE_URL` | provider default | Allows a local model |
| `OPENAI_MODEL` | provider default | — |
| `ALLOCATION_POLICY` | `round-robin-week` | `round-robin-week` \| `by-request-time` \| `spread-by-day` |
| `LOG_LEVEL` | `info` | — |

**The AI-off requirement is enforced by a test, not a promise:** AC-E in `PRD.md` starts the server with `OPENAI_API_KEY` unset and exercises browse, book and cancel.

## 8. Failure modes and their handling

| Failure | Behaviour | Rationale |
|---|---|---|
| Slot claimed by someone else | `409` + recomputed alternatives | Never a silent overwrite |
| Hold expired mid-form | `409` with `reason: hold_expired` | Distinguishable from a lost race |
| LLM provider unreachable | Concierge returns the structured form's result; the request still succeeds | The app must not depend on the network |
| LLM returns a slot that does not exist | Filtered out by the engine before it is offered | The safety invariant in §5 |
| Host has no availability for the date | Empty list, `200`, not an error | Empty is a valid answer |
| Date override present | Replaces that date entirely, other days unaffected | AC-A |
| Term holiday | Empty list for that date, no error | AC-B |
| Two instances, one slot | Constraint rejects the loser with a `409` surfaced by the service | Layer 2 |
| Client clock wrong | Irrelevant — all computation is server-side | Zone handling is server-authoritative |

## 9. How the three Killer Tests map to the architecture

| Killer Test | Where it is enforced | Module |
|---|---|---|
| KT-1 IST/PST correct slots | Single zone module; zone-database-driven conversion at stage 9; no fixed offsets anywhere | `engine/zones.ts`, stage 9 |
| KT-2 buffer respected | Busy intervals inflated at stage 5, both directions, max of adjacent buffers | `engine/buffers.ts` |
| KT-3 exactly one wins | Transaction-scoped advisory lock + count + insert + scoped constraint backstop | `booking/claim.ts`, Layers 1 & 2 |
| KT-3b lab capacity honoured | Constraint predicate excludes multi-resource slots; capacity counted in the claim | `booking/claim.ts` |
| Differentiator present | The intelligence layer, independently demoable, degradable | `intel/*` |
