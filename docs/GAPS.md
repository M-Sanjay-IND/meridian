# GAPS — what is missing or broken, and what Meridian does about it

**How to read this file.** Part 1 is the claim we are scored on: the Brief requires **at least two improvements — at least one fix drawn from this register, and at least one differentiator that the original does not have at all**. They are stated first and labelled. Part 2 is the evidence behind them: a severity-ranked register of every gap found, each with who it hurts and what fixing it would take. Part 3 records what we deliberately chose not to do, because a list of improvements with no rejections is a list that was not thought about.

**Severity:** `S1` breaks a stated Killer Test · `S2` breaks correctness or safety in ordinary use · `S3` degrades experience or maintainability. Every claim about the original cites a repository path and line, or an upstream issue number, and all citations are repo-relative so they can be opened. Full detail in `OBSERVATIONS.md`.

---

# Part 1 · The two improvements we claim

## IMPROVEMENT 1 (the required **fix**) — Make the slot claim atomic: exactly one booking wins

**Gap closed:** G-01 (`S1`). **Killer Test:** KT-3. **Where:** `src/booking/claim.ts`.

**What is wrong in the original.** Availability is checked early and written much later with nothing spanning the two: the gate is invoked at `packages/features/bookings/lib/service/RegularBookingService.ts:902` and the row is persisted at `:1707`, with calendar and video work in between; `grep -c '\$transaction'` on that file returns **0**. There is no unique or exclusion constraint over a time interval anywhere on the booking table — only eleven ordinary indexes (`packages/prisma/schema.prisma:918-930`). Both concurrent requests therefore pass the check and both write. Upstream tracks this as `#29605` ("booking limits can be exceeded by concurrent requests — TOCTOU race between limit check and insert"), with two related open defects at `#29967` and `#29958`.

The original does hold slots softly — a `SelectedSlots` row with `releaseAt` (`packages/prisma/schema.prisma:1437`) — but its uniqueness is keyed on `(userId, slotUtcStartDate, slotUtcEndDate, uid)` (`:1445`), so because *both* `userId` and `uid` are in the key, **two different visitors holding the same slot are not blocked by it**; and the booking feature never reads the table at all (`grep -rn 'SelectedSlot' packages/features/bookings/` → 0 matches). The hold shapes what a visitor is shown; it does not protect the write.

**Who it hurts.** The faculty member who finds two students in the same office-hour, and the lab whose station is double-assigned. In a campus of 200 students this is not a theoretical race: office hours are released on a schedule and sought simultaneously, which is the worst possible traffic shape.

**What we do instead.** A transaction-scoped advisory lock on `(host, day)` wraps a count of overlapping bookings and live holds, followed by the insert. Competing claims serialise; the lock releases automatically on commit, rollback or connection loss. The database constraint (§ below) remains as a backstop for anything that bypasses the service.

**We measured it rather than asserting it.** Against PostgreSQL 16.15:

| Setup | Result |
|---|---|
| Unguarded insert, 20 concurrent callers, one slot | **20 rows stored** — the defect reproduces, so the harness detects it |
| Insert-if-not-exists guard, no lock, no constraint, 20 callers | **4 rows stored** — *the obvious guard is not atomic* |
| Same, **with** the exclusion constraint | 1 row — it passes because the **constraint** catches it, not the guard |
| Same guard, capacity-3 lab slot, 8 callers | **8 admitted into 3 places** — capacity is silently broken |
| Our design: advisory lock, no constraint, 40 callers | exactly **1**, five runs out of five |
| Our design: advisory lock, capacity-3 lab, 8 callers | exactly **3** |

The middle rows are the finding. A team that writes the naive guard, adds a constraint and tests only the capacity-1 case will see a perfect result and never learn that their lab slots admit three times their capacity. We found this by building the negative control first, and it is why our KT-3 harness is required to fire 40 callers from a common barrier and to be shown failing before it is believed.

**Cost if unbuilt:** KT-3 fails, and with it the Brief's third Killer Test. This is the highest-value fix available.

## IMPROVEMENT 2 (the required **differentiator**) — Meridian Intelligence: four capabilities the original has none of

**Gap closed:** G-11, G-12, G-13, G-14 (`S3`, but the Brief requires a differentiator so they are promoted to first-class work). **Where:** `src/intel/*`.

**What the original cannot do.** Checked by search, not assumed (`OBSERVATIONS.md` §F):

- No LLM scheduling assistance of any kind. The only AI in the product is telephony — agent and phone-number tables and three migrations (`packages/prisma/schema.prisma:2541`).
- No fairness or allocation concept: nothing assigns scarce slots across a cohort; no priority, quota or lottery exists.
- No bookable **resource** separate from a person: availability derives from a user or an event type only (`packages/prisma/schema.prisma:963, :965`).
- No awareness of the *booker's* other commitments: the engine reads the host's calendar and never the invitee's (`packages/features/availability/lib/getUserAvailability.ts:648`).
- No history-driven recommendation: past bookings never feed slot ranking.

Upstream corroborates two adjacent wants that were never built: gaps in the middle of a day (`#6084`, open, help-wanted) and availability overrides (`#5779`, open, 17 comments).

**D1 — Concierge.** The student types *"45 min with Prof. Rao before Friday, I'm busy 2–4 on Wednesday"* and receives a genuinely bookable slot. The model returns **constraints**, never slots; every candidate is re-validated by the availability engine before it is shown or written. With no API key the same endpoint returns identical results from a structured constraint object.

**D2 — Allocator.** Fairly distributes scarce office-hour and lab capacity across a cohort by a stated policy (`round-robin-week`, `by-request-time`, `spread-by-day`), maximising students served and spreading load across the week, and reports demand, supply, served and unfilled. Deterministic; no LLM.

**D3 — Clash Sentinel.** Models the **booker's** timetable. A student with a 14:00 lecture is never offered a slot that collides with it, and a rejecting response names the conflict and offers the nearest alternatives. This is the capability the architecture of the original makes structurally impossible, and it is the one that most directly serves the Brief's "without clashes".

**D4 — Suggest.** Ranks the legal slot list by what has worked before — the student's own history, cohort frequency, host fill rate — surfaced as "usually works for you". Ranking only: it can neither invent a slot nor remove a legal one.

**Why this is a differentiator and not a decoration.** Each of the four solves a named user's problem; each is demoable in under a minute; each degrades to a working non-AI path; and the whole layer is **additive** — with `ENABLE_CLASH_SENTINEL=false` and no API key, KT-1 to KT-3 still pass unchanged. The Brief is explicit that a differentiator never replaces the hard core, so this is verified rather than claimed.

**Cost if unbuilt:** the Brief's "Two improvements" requirement is unmet — one of the two must be a differentiator, and a second gap-fix does not satisfy it.

---

# Part 2 · The gap register

## G-01 · Two bookings for one slot can both succeed — `S1`
*Killer Test 3.* Check at `packages/features/bookings/lib/service/RegularBookingService.ts:902`, write at `:1707`, **no transaction anywhere in the file**, no interval constraint on the table (`packages/prisma/schema.prisma:918-930`). Reproduced: 20 unguarded concurrent inserts for one slot stored 20 rows.
**Hurts:** faculty, lab supervisors, any student who arrives to find their slot taken.
**Fix:** Improvement 1. **Upstream:** `#29605`, `#29967`, `#29958`.

## G-02 · Unconfirmed bookings do not hold their slot — `S1`
The busy-time query filters `status: ACCEPTED` (`packages/features/busyTimes/services/getBusyTimes.ts:81`, repeated at `:348` and `:471`). An event type that requires confirmation creates a booking the availability engine cannot see, so a second student is offered the same slot.
**Hurts:** every student booking a confirm-first service; the host who must decline one of two.
**Fix:** treat any non-cancelled booking as busy (pipeline stage 4). **Upstream:** `#29967`, `#29958`.

## G-03 · The soft hold does not block a second visitor — `S2`
`SelectedSlots` exists with `releaseAt` (`packages/prisma/schema.prisma:1437`) but its unique key includes `userId` and `uid` (`:1445`), so two visitors can each hold the same slot; the compensating check is a read-then-write (`packages/trpc/server/routers/viewer/slots/reserveSlot.handler.ts:68`); and the booking path never consults the table.
**Hurts:** the visitor shown a slot as available that is being held by someone else.
**Fix:** a hold table that the claim actually counts (G-01), with a TTL from `.env`.

## G-04 · Cancellation is not ownership-checked — `S1`
The cancel route substitutes `-1` for a missing session (`apps/web/app/api/cancel/route.ts:52`); the handler performs no ownership check for ordinary bookings (`packages/features/bookings/lib/handleCancelBooking.ts:153`). A booking id is enough to cancel someone else's appointment.
**Hurts:** students and staff whose appointments can be cancelled by anyone who learns an id.
**Fix:** session-or-signed-token authorisation, and `404` rather than a differentiating error so the endpoint cannot confirm that an id exists.

## G-05 · Anyone can mark a host as a no-show — `S2`
A public procedure (`packages/trpc/server/routers/publicViewer/markHostAsNoShow.handler.ts:9`) with no reporter tracking, acknowledged in its own comment.
**Hurts:** faculty, whose record can be altered without authentication.
**Fix:** restrict to the booking holder or an admin, and record who acted.

## G-06 · No bookable resource — `S2` relative to the Brief
Availability derives only from a user or an event type (`packages/prisma/schema.prisma:963, :965`). "Lab slot" has no representation: there is no room, no station count, no capacity except a seat count on an event type (`:222`).
**Hurts:** every lab booking in the Brief; the lab supervisor who must ration stations.
**Fix:** `Resource` as a first-class entity with capacity — `DATA_MODEL.md` §2, criterion KT-3b.

## G-07 · No day-off override — `S2`
No holiday concept exists; `#8918` (holiday calendars should block slots) was closed without a native implementation, and an override is only expressible as a per-date availability row (`packages/features/schedules/lib/date-ranges.ts:11`).
**Hurts:** the whole cohort on a public holiday, and any faculty member who wants one day changed without touching their weekly pattern.
**Fix:** `AvailabilityRule.kind = HOLIDAY | DATE`, term-scoped — criteria AC-A and AC-B.

## G-08 · Buffers are easy to get subtly wrong — `S2`
Buffers live on the event type (`packages/prisma/schema.prisma:220, :221`) and work by **inflating busy intervals** (`packages/features/busyTimes/services/getBusyTimes.ts:266, :267`), taking the maximum of the adjacent event types' buffers (`:135, :136`), with the busy query window widened by the largest configured buffer (`:109-114`).
**Hurts:** anyone who implements buffers as a post-filter over slot start times: a long appointment beginning just before the buffer survives, so the buffer is silently violated.
**Fix:** implement inflation, not filtering — KT-2 and `ARCHITECTURE.md` stage 5.

## G-09 · Time-zone handling is easy to get subtly wrong — `S1`
Conversion is `dayjs(...).tz(timeZone)` at the slot boundary (`packages/trpc/server/routers/viewer/slots/util.ts:290`) and again per slot (`packages/features/schedules/lib/slots.ts:138`); out-of-office suppression is keyed by a date string that must itself be computed in a specific zone (`:190`); a missing zone is an error rather than a default (`packages/trpc/server/routers/viewer/slots/util.ts:287`).
**Hurts:** everyone, when a fixed offset is used instead of the zone database. Note the trap in PRD KT-1: in October, `America/Los_Angeles` is on PDT (UTC−7), so 09:00 IST is **20:30**, not the 19:30 that "PST" suggests.
**Fix:** one zone module, zone-database-driven, no offset constants anywhere; `tz` required on every availability endpoint.

## G-10 · No student-side clash detection — `S2`
The engine never reads the invitee's commitments (`packages/features/availability/lib/getUserAvailability.ts:648`).
**Hurts:** the student who books over their own lecture — the exact failure the Brief's "without clashes" names.
**Fix:** D3, the Clash Sentinel, backed by `StudentCommitment`.

## G-11 · Simulated capacity rather than measured — `S2` for the Brief's scale
Nothing in the original models a cohort of 200 competing for a fixed set of slots; there is no demand view, no served/unfilled accounting and no load distribution.
**Hurts:** the administrator, who cannot answer "are we meeting demand?"
**Fix:** D2 plus `/api/admin/demand`.

## G-12 · Unrequested gaps in the middle of a day — `S3`
`#6084` (open, help-wanted, 10 comments) asks exactly this. Slot slicing can leave a dead interval between bookings that no one can use.
**Hurts:** both sides, in wasted capacity.
**Fix:** the allocator's day-level view (D2) and overflow-aware slicing in the engine.

## G-13 · No history-driven ranking — `S3`
Past bookings never influence ordering; slot order is purely chronological.
**Hurts:** the returning student, who re-derives their own preferences every week.
**Fix:** D4.

## G-14 · No natural-language access to availability — `S3`
No conversational or text interface exists. The original's only AI is telephony (`packages/prisma/schema.prisma:2541`).
**Hurts:** the student on a phone between classes, who would rather state an intent than navigate a calendar.
**Fix:** D1.

## G-15 · The default route's data access is unbounded — `S2`
A listing query with no range bound (`packages/trpc/server/routers/viewer/users/_router.ts:57`), the same pattern as the slot range.
**Hurts:** nobody today at small scale; everybody at 200 students if copied.
**Fix:** every list endpoint takes an explicit range, validated (`API.md` §3).

## G-16 · Documentation drift in the original — `S3`
The README states teams, organisations and SSO are removed (`README.md:47, :48`), yet a SAML dependency remains (`apps/web/package.json:34`); the permissions guide cites handlers that do not exist on disk (`PERMISSIONS.md:11, :37`); seeding still creates team rows (`scripts/seed.ts:1057`); and a maintenance script cannot execute (`scripts/delete-empty-google-credentials.sql:11`).
**Hurts:** anyone who rebuilds from the documentation rather than the code — which is exactly what the Doc Test simulates. We treat the code as authoritative and say so.
**Fix:** our own `docs/` are generated from and checked against the code; every claim is a resolvable `path:line`.

---

# Part 3 · Improvements we considered and rejected

| Considered | Rejected because |
|---|---|
| Redis distributed lock for the claim | Puts a network dependency in the correctness path and still leaves a slot unreserved if the process dies mid-hold. PostgreSQL gives the guarantee we need; Redis is used only for rate limiting. Already an explicit exclusion in `ARCHITECTURE.md` §7. |
| A blanket `EXCLUDE` on `(host_id, time_range)` | Would forbid a 3-station lab from holding three bookings — the regression upstream warns about at `#21467`. The `resources_needed = 1` predicate is what makes the constraint safe (KT-3b). |
| Google/Outlook calendar sync | High value in the original, but it is an integration problem, not an availability-engine problem, and the Brief's hard core does not include it. Named as an explicit exclusion in `PRD.md` §5 rather than left as an omission. |
| SERIALIZABLE isolation for the claim | Correct, but requires application-level retry on serialization failure and surfaces as a confusing error to the loser. The advisory lock serialises the same critical section with a deterministic `409`. |
| Reimplementing the original's dead schema | The denormalised booking table, calendar cache, directory sync and telephony agents (`packages/prisma/schema.prisma:1527, :1594, :1785, :2541`) carry no behaviour the Brief names. |
| An LLM that proposes slots directly | It can hallucinate a slot that does not exist. The concierge is restricted to returning constraints, and every candidate is re-validated by the engine — `ARCHITECTURE.md` §5. |
