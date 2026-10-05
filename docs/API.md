# API — Meridian

**Style:** JSON over HTTPS, resource-oriented. **Base path:** `/api`. **Auth:** session cookie for host/admin routes; a signed booking token for the booking-holder routes. No API key is required to browse.

**This document is the contract.** A developer or agent with `docs/` alone must be able to implement and test every endpoint from it. Where a response shape encodes a Killer Test, the examples are normative rather than illustrative.

---

## 1. Conventions

- All timestamps are **RFC 3339 with an explicit offset** (`2026-10-15T03:30:00Z`). A timestamp without an offset is rejected with `422`.
- Every endpoint that returns availability takes a required `tz` parameter (IANA name). There is no server-side default: defaulting is how a booking lands at the wrong hour.
- Errors are `{ "error": { "code": "...", "message": "...", "details": {...} } }`.
- All lists are ordered deterministically. Availability is ordered by instant ascending.

## 2. Endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Liveness and version | none |
| GET | `/api/hosts` | Faculty who publish office hours | none |
| GET | `/api/resources` | Labs and rooms with capacity | none |
| GET | `/api/services` | Bookable service types, with buffers and duration | none |
| GET | `/api/slots` | **The availability engine** | none |
| POST | `/api/holds` | Hold a slot for `HOLD_TTL_MINUTES` | none |
| POST | `/api/bookings` | **Book a slot — the atomic claim** | none |
| GET | `/api/bookings/:id` | Read one booking | token or owner |
| DELETE | `/api/bookings/:id` | Cancel | token or owner |
| POST | `/api/bookings/:id/reschedule` | Move a booking | token or owner |
| GET | `/api/admin/demand` | Demand vs supply for a term | admin |
| POST | `/api/intel/concierge` | **D1** — natural language to a validated slot | none |
| POST | `/api/intel/allocate` | **D2** — allocate scarce slots across a cohort | admin |
| GET | `/api/intel/clashes` | **D3** — the booker's own conflicts | none |
| GET | `/api/intel/suggest` | **D4** — history-ranked slots | none |

## 3. `GET /api/slots` — the availability engine

**Query:** `hostId` or `resourceId` (exactly one), `serviceId`, `from`, `to` (inclusive date range, max 31 days), `tz` (required, IANA).

```
GET /api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=America/Los_Angeles
```

```jsonc
{
  "hostId": 7,
  "serviceId": 3,
  "timeZone": "America/Los_Angeles",
  "duration": 45,
  "buffer": { "before": 15, "after": 30 },
  "slots": [
    { "start": "2026-10-14T20:30:00-07:00", "end": "2026-10-14T21:15:00-07:00",
      "available": true, "remaining": 1 },
    { "start": "2026-10-14T21:15:00-07:00", "end": "2026-10-14T22:00:00-07:00",
      "available": false, "remaining": 0, "reason": "buffer" }
  ]
}
```

- Slots are returned **in the requested zone**, converted from the host's zone by the zone database. On 2026-10-15 a 09:00 IST start is `20:30` the previous day in `America/Los_Angeles`, because California is on PDT (UTC−7) in October. `PRD.md` KT-1 explains why this is the correct answer and why a test asserting 19:30 would fail.
- `remaining` is the capacity left: `seatsPerSlot` minus existing bookings and live holds. For a lab with 3 stations that is `0..3`.
- `reason` is informational and never used to hide a slot that exists. Allowed: `booked`, `buffer`, `hold`, `override`, `holiday`, `notice`, `clash`.
- A day with no availability returns `200` with an empty `slots` array — never `404`, never an error.

**Failure modes:** `404` unknown host/service, `422` missing or non-IANA `tz`, `422` `to` before `from`, `422` range longer than 31 days.

## 4. `POST /api/bookings` — the atomic claim

The single most important endpoint. Its status codes **are** Killer Test 3.

**Headers:** `Idempotency-Key: <uuid>` (recommended; required for automatic retries).

```jsonc
// request
{ "serviceId": 3, "hostId": 7, "studentId": 42,
  "start": "2026-10-15T03:30:00Z", "end": "2026-10-15T04:15:00Z",
  "note": "Project review" }
```

**Responses**

| Code | When | Body |
|---|---|---|
| `201` | The claim won | the booking, with `id`, `status`, `slotStart`, `slotEnd`, `resourceId`, `remaining` |
| `409` | **Lost the race** — someone else holds the slot | `{ "error": { "code": "slot_taken", "details": { "alternatives": [ ... ] } } }` |
| `409` | Hold expired mid-form | `code: "hold_expired"` — distinguishable from `slot_taken` |
| `409` | Student's own timetable clashes | `code: "student_clash"`, with the conflicting commitment named (D3) |
| `422` | Missing/ malformed fields, non-IANA zone | field-level details |
| `423` | Slot exists but is outside the notice window or is a holiday | `code: "unavailable_date"` |
| `200` | Idempotent replay of a key that already succeeded | the original booking, unchanged |

**Normative rule.** The loser of a race receives `409` and **the winner's booking id is never disclosed**. Verified in `ARCHITECTURE.md` §4.3: with the advisory lock, 40 concurrent callers produce exactly one `201` and 39 `409`s, five runs out of five, with the database constraint disabled — so the guarantee comes from the claim itself, not from a backstop.

`alternatives` on a `409` is the same shape as `GET /api/slots` and is computed fresh at failure time, so the client can offer a recovery without a second round trip.

## 5. `POST /api/holds`

```jsonc
{ "serviceId": 3, "hostId": 7, "studentId": 42,
  "start": "2026-10-15T03:30:00Z", "end": "2026-10-15T04:15:00Z" }
```

Returns `201` with `expiresAt`. The TTL is `HOLD_TTL_MINUTES` from `.env` — set it to `1` and the whole lifecycle is observable in under a minute, which is the point of the requirement that time windows be configurable rather than hard-coded. A hold is visible to the availability engine as a `remaining` decrement, and to the claim as a competing row.

## 6. Cancellation and reschedule

- `DELETE /api/bookings/:id` — authorises by **session owner** or by a **signed token** issued to the booking holder at creation. Both paths are required: without the token a student who booked without an account cannot cancel their own booking; without the session check a host cannot cancel on behalf of the department.
- **This is a direct fix of a real defect in the original**, where the cancellation route substitutes a user id of `-1` when there is no session (`apps/web/app/api/cancel/route.ts:52`) and the handler performs no ownership check for ordinary bookings (`packages/features/bookings/lib/handleCancelBooking.ts:153`). Our equivalent route uses a `404`, never a `403` with the record's fields attached, so the endpoint cannot be used to test whether a booking id exists.
- Cancelling frees the slot immediately: the constraint's `status <> 'CANCELLED'` predicate and the claim's count both exclude it. Verified.
- `POST /api/bookings/:id/reschedule` performs a claim for the new interval and a release of the old one **in the same transaction**, so a reschedule cannot lose a booking that never landed.

## 7. Intelligence endpoints

### `POST /api/intel/concierge` — D1
```jsonc
// request
{ "studentId": 42, "text": "45 min with Prof Rao before Friday, I'm busy 2-4 on Wednesday",
  "tz": "America/Los_Angeles" }
// response
{ "parsed": { "duration": 45, "hostId": 7, "before": "2026-10-16T23:59:59Z",
              "busyWindows": [ { "start": "2026-10-14T21:00:00Z", "end": "2026-10-14T23:00:00Z" } ] },
  "source": "llm",            // or "form" when no key is configured
  "candidates": [ { "start": "...", "end": "...", "why": "only free morning slot" } ] }
```
**The invariant that makes this safe:** the model returns **constraints** (`duration`, `hostId`, `before`, `busyWindows`), never slots. Every candidate in the response has been produced by the same availability engine that serves `GET /api/slots`, so a hallucinated time cannot reach the client. With `OPENAI_API_KEY` unset the endpoint still returns `200`, with `source: "form"`, and a client-supplied constraint object instead of parsed text. This is what AC-E tests.

### `POST /api/intel/allocate` — D2
```jsonc
{ "termId": 1, "policy": "round-robin-week", "cohort": "CS-sem5" }
// ->
{ "assigned": 180, "unfilled": 20, "policy": "round-robin-week",
  "loadByDay": { "Mon": 42, "Tue": 38, "Wed": 36, "Thu": 32, "Fri": 32 },
  "notServiced": [ { "studentId": 91, "reason": "no slot within constraints" } ] }
```
Deterministic; no LLM. Every assignment goes through the same claim, so an allocation cannot create an overlap.

### `GET /api/intel/clashes?studentId=&from=&to=` — D3
Returns the student's own commitments and any booking that overlaps them. No LLM.

### `GET /api/intel/suggest?studentId=&serviceId=&tz=` — D4
The legal candidate list, ranked, with a `score` and a human-readable `why`. **Ranking only** — it can neither introduce a slot the engine did not produce nor remove a legal one.

## 8. Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `slot_taken` | 409 | Lost the race |
| `hold_expired` | 409 | Hold lapsed before submit |
| `student_clash` | 409 | Conflicts with the student's own timetable |
| `capacity_full` | 409 | All places in a lab slot taken |
| `unavailable_date` | 423 | Holiday, override-excluded, or inside the notice window |
| `validation_failed` | 422 | Field-level problems |
| `not_found` | 404 | Unknown id — also the response for a booking owned by someone else |
| `rate_limited` | 429 | Only when optional Redis is configured |

## 9. `.env.example`

Every setting, no real secrets. Committed to the repo root.

```dotenv
# ---- required
DATABASE_URL=postgresql://meridian:meridian@localhost:5432/meridian
PORT=3000

# ---- scheduling windows (all overridable: the Brief requires time limits to be testable in minutes)
HOLD_TTL_MINUTES=10
MIN_NOTICE_MINUTES=0
MAX_BOOKINGS_PER_STUDENT_PER_WEEK=5
SLOT_RANGE_MAX_DAYS=31
TERM_HOLIDAYS=2026-10-20,2026-11-14

# ---- behaviour
ALLOCATION_POLICY=round-robin-week
DEFAULT_TIMEZONE=Asia/Kolkata
ENABLE_CLASH_SENTINEL=true
ENABLE_SUGGESTIONS=true
LOG_LEVEL=info

# ---- optional AI. Leave the key EMPTY and the app still runs; the concierge
# ---- degrades to its structured form. Nothing in the core path calls out.
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=

# ---- optional rate limiting only. Never in the correctness path.
REDIS_URL=

# ---- optional email
SMTP_URL=
EMAIL_FROM=
```

## 10. What is deliberately absent

- **No `/api/slots` cache and no cache-invalidation endpoint.** The database is the source of truth (see `ARCHITECTURE.md` §1); a cache would add a staleness class of bug for no benefit at this scale.
- **No calendar-sync endpoints.** Out of scope, and stated as such in `PRD.md` §5 rather than quietly omitted.
- **No GraphQL or tRPC layer.** The original uses tRPC (`packages/trpc/server/routers/viewer/slots/_router.tsx:17`); a REST surface is smaller to build, easier for a judge to exercise with `curl`, and keeps the Killer Tests invokable without a client.
