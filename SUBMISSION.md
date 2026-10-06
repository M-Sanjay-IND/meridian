# SUBMISSION — Meridian

## Team

| | |
|---|---|
| **Team ID** | `<FILL: TEAM-ID>` |
| **Repo** | https://github.com/M-Sanjay-IND/meridian |
| **Members** | Vijval Parakkat · M. Sanjay · `<FILL: teammates>` |

> **Before you submit:** replace `<FILL: …>` above. An unfilled token reads as unfinished work.

## The card

| | |
|---|---|
| **Project** | Workflow & Trust · The Clock — Smart Slot Booking |
| **Difficulty** | Brutal (1.2× point multiplier) |
| **Original** | Cal.com · scheduling infrastructure |
| **Original repo** | https://github.com/calcom/cal.diy |
| **Commit studied** | `54343aa685ae8f33159d2f485ec4a57bad5c574a` |
| **Build for** | Faculty office hours and lab slots for 200 students |

## Run command

```bash
cp .env.example .env && docker compose up -d db && npm ci \
  && npm run db:migrate && npm run db:seed && npm run dev
```

Serves on `http://localhost:3000`. **No API key required** — the app runs fully with the AI
variables empty.

---

## Our two improvements

The Brief requires **at least two**: at least one fix drawn from our `GAPS.md`, and at least one
differentiator the original does not have at all. Both are detailed in `docs/GAPS.md` Part 1.

### 1 · Improvement — make the slot claim atomic, so exactly one booking wins

**A fix, drawn from the gap register (G-01). Carries Killer Test 3.**

**What is wrong in the original.** Availability is checked early and the booking is written much
later with nothing spanning the two: the gate is invoked at
`packages/features/bookings/lib/service/RegularBookingService.ts:902` and the row is persisted at
`:1707`, with calendar and video work in between. `grep -c '\$transaction'` on that file returns
**0**, and the booking table carries no unique or exclusion constraint over a time interval — only
ordinary indexes (`packages/prisma/schema.prisma:918-930`). Both concurrent requests pass the check
and both write. Upstream tracks this as **open issue `#29605`**, with `#29967` and `#29958` alongside it.

The original does hold slots softly — a `SelectedSlots` row with `releaseAt`
(`packages/prisma/schema.prisma:1437`) — but its unique key includes both `userId` *and* `uid`
(`:1445`), so two *different* visitors are not blocked from holding the same slot; and the booking
path never reads the table at all (`grep -rn 'SelectedSlot' packages/features/bookings/` → 0 matches).

**What we do.** A transaction-scoped advisory lock on `(host, day)` wraps a count of overlapping
bookings and live holds, followed by the insert. Competing claims serialise; the lock releases
automatically on commit, rollback or connection loss. A scoped exclusion constraint remains as a
backstop for writes that bypass the service.

**Measured, not asserted** (PostgreSQL 16.15, threads released from a common barrier):

| Setup | Rows stored for one slot |
|---|---|
| Unguarded insert, 20 concurrent callers | **20** — the defect reproduces, so the harness detects it |
| Insert-if-not-exists guard, no lock, no constraint | **4** — *the obvious guard is not atomic* |
| The same guard **with** the exclusion constraint | 1 — the constraint won, not the guard |
| The same guard, 3-station lab slot, 8 callers | **8 admitted into 3 places** — capacity silently broken |
| **Ours:** advisory lock, no constraint, 40 callers | exactly **1**, five runs out of five |
| **Ours:** advisory lock, 3-station lab, 8 callers | exactly **3** |

The middle rows are the finding: a team that writes the naive guard, adds a constraint and tests
only the capacity-1 case sees a perfect result and never learns that their lab slots admit three
times their capacity. `npm run test:concurrency` runs the real case with the constraint disabled.

### 2 · Improvement — Meridian Intelligence: four capabilities the original has none of

**Our differentiator (D1–D4).** Checked by search, not assumed — `docs/OBSERVATIONS.md` §F.

| | Feature | Why the original cannot do it |
|---|---|---|
| **D3** | **Clash Sentinel** — a student is never offered a slot that collides with their own timetable, and a rejection names the specific conflict | The engine reads the *host's* calendar and never the invitee's (`packages/features/availability/lib/getUserAvailability.ts:648`). Structurally impossible in the original's architecture. |
| **D1** | **Concierge** — *"45 min with Prof. Rao before Friday, I'm busy 2–4 on Wednesday"* returns a genuinely bookable slot | No LLM scheduling assistance exists; the original's only AI is telephony (`packages/prisma/schema.prisma:2541`). |
| **D2** | **Allocator** — distributes scarce slots across a cohort by a stated fairness policy and reports demand vs supply | No allocation, quota or priority concept exists. |
| **D4** | **Suggest** — ranks slots from what has worked before | Past bookings never feed slot ranking. |

**Why this is a differentiator and not decoration.**

- **It cannot hallucinate.** The concierge's model returns *constraints* — duration, host, before,
  busy windows — never slots. Every candidate is produced by the same availability engine that
  serves `GET /api/slots`, so an invented time cannot reach the client.
- **It degrades to a working non-AI path.** With `OPENAI_API_KEY` empty the endpoint returns
  identical results from a structured form. D2, D3 and D4 are pure computation and need no network
  at all. The app runs with the AI off — that is a tested configuration, not a promise.
- **It is additive.** With `ENABLE_CLASH_SENTINEL=false` and no API key, Killer Tests 1, 2 and 3
  still pass unchanged. A differentiator never replaces the hard core; we verified rather than assumed.
- **Each solves a named user's problem** — the student in a hurry, the admin rationing capacity, the
  student whose own timetable the original cannot see. `docs/PRD.md` §8.

---

## Killer Tests

| Test | Where it is enforced | Verified by |
|---|---|---|
| 1 · IST host and PST booker see the correct slots | one zone module, zone-database driven, at the slot-emission stage | `tests/killer-tests/kt1-zones` |
| 2 · Buffer time between bookings is respected | busy intervals inflated in both directions at pipeline stage 5 | `tests/killer-tests/kt2-buffers` |
| 3 · Two bookings for the same slot, exactly one succeeds | transaction-scoped advisory lock + count + insert | `tests/concurrency` — 40 callers × 5 runs |

Plus `KT-3b`: a 3-station lab slot admits exactly 3. This is the case a blanket
`EXCLUDE (host_id, time_range)` constraint would break — see upstream `#21467`.

---

## Libraries used

All third-party libraries are general-purpose. **No `@calcom/*` package is installed, directly or
transitively**, and no source from the original repository is included.

| Library | Used for | Why this one |
|---|---|---|
| `typescript` (strict) | the whole codebase | type safety across engine, API and tests |
| `fastify` | HTTP server | small, schema-validated routes; the Killer Tests stay runnable with `curl` |
| `prisma` + `@prisma/client` | schema, migrations, access | the exclusion constraint is raw SQL, but migrations and typed access are not worth hand-rolling |
| `postgresql` **16** | the database | the advisory lock and the `EXCLUDE USING gist` constraint are what make Killer Test 3 hold |
| `luxon` | time-zone arithmetic | a real zone database, so DST is handled rather than approximated |
| `zod` | request and env validation | one schema validates request bodies and `.env` |
| `dotenv` | configuration | every window is settable |
| `react` + `vite` | the two pages (book, admin) | no SSR needed |
| `vitest` | unit tests | fast, TypeScript-native |
| `supertest` | API tests | exercises the real routes |
| `openai` | **optional** concierge only | never imported on the core path; the app runs with no key |

Scoring-relevant choices: the concurrency guarantee comes from **PostgreSQL** — an advisory lock and
a scoped exclusion constraint — not from an application-level lock or a cache. Optional Redis is
used only for rate limiting and never sits in the correctness path.

---

## Layout

```
README.md · SUBMISSION.md · deck.pdf · .env.example
docs/            the 7 mandated documents
src/engine/      availability pipeline — zones, buffers, overrides, slot slicing
src/booking/     the atomic claim (the only module permitted to write a booking)
src/intel/       the differentiator: concierge, allocator, sentinel, suggest
src/routes/      HTTP surface
tests/           killer tests + the concurrency harness
reference/       the original's published API spec, kept for context — not code, not depended on
```

## Clean-room declaration

- No code was copied from the original repository.
- The original was studied by reading it and by reading its issue tracker.
- No `@calcom/*` package is installed.
- Every claim about the original in `docs/` is a repo-relative `path:line` or an upstream issue
  number, so each can be checked rather than trusted.
- Nothing in this repository is addressed to a scorer or a rubric.
