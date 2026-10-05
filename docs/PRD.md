# PRD — Meridian

**Product:** Meridian — campus scheduling infrastructure for faculty office hours and laboratory slots.
**Original studied:** `calcom/cal.diy` @ `54343aa` (MIT). Evidence for every claim about the original lives in `OBSERVATIONS.md`.
**Card:** Workflow & Trust · The Clock — Smart Slot Booking. Difficulty: Brutal (1.2× multiplier).

---

## 1. Problem

A department has roughly **200 students** and a small number of faculty and laboratories. Students must book office hours with lecturers and hands-on time in lab slots. Today that runs on shared spreadsheets, notice boards and group chats, and it fails in four specific ways:

1. **Clashes.** Two students book the same supervisor at the same hour, or one student books two things at once, and nobody notices until the day.
2. **Wasted capacity.** Most of the week is empty while a handful of hours are oversubscribed. Nothing measures demand against supply.
3. **No trust in the calendar.** A booking that "succeeded" is not guaranteed to have been reserved, so staff and students both keep private copies of the truth.
4. **Time zones and term calendars are ignored.** Visiting faculty, exchange students and remote staff are booked at the wrong hour; public holidays and reading weeks are treated as normal working days.

The original scheduling platform solves the general case well — it models working hours, buffers, overrides and bookings competently. It is not built for this problem: it schedules **one host against one booker**, with no notion of a cohort competing for a scarce resource, no notion of a bookable room, and no knowledge of the student's own timetable. We rebuild the engine for the campus case and add the layer the original has never had.

## 2. Target users

| Persona | Count | Job to be done | Pain today (evidence in original) |
|---|---|---|---|
| **Student** (booker) | ~200 | Get the right slot with the right person or lab, without clashing with their own classes | The engine knows the host's calendar and never the invitee's — `packages/features/availability/lib/getUserAvailability.ts:648`. Two students can hold and confirm the same slot — `packages/features/busyTimes/services/getBusyTimes.ts:81`, upstream `#29967` |
| **Faculty / supervisor** (host) | ~15 | Publish office hours, see who is coming, never be double-booked | Two concurrent requests both pass the availability check and both write — no transaction on the booking path (`packages/features/bookings/lib/service/RegularBookingService.ts:902` vs `:1707`), upstream `#29605` |
| **Lab supervisor / resource owner** | ~5 | Publish lab capacity and protect equipment time | The original has no bookable resource: availability derives from a user or an event type only — `packages/prisma/schema.prisma:963, :965` |
| **Department admin** | 1–2 | See whether supply meets demand; act on it | No allocation, quota or demand view exists anywhere in the original |

## 3. One-line problem statement

> For **faculty and students in a department of 200 who lose hours every week to clashing and wasted office-hour and lab bookings**, Meridian is a scheduling engine that computes genuinely free slots across time zones, buffers and term overrides and guarantees that **exactly one** booking wins any contested slot, unlike the original, which schedules one host against one booker with no resource model, no cohort view and no atomic reservation.

## 4. Core flow

1. **Term setup.** The admin creates a term with its date range, the teaching days, and the term's public holidays (day-off overrides).
2. **Host publishes availability.** A faculty member or lab supervisor sets weekly working hours in their own zone, a per-slot buffer, and any one-off overrides (a cancelled lecture, an extra evening session, a holiday).
3. **Resource definition.** A lab is registered as a bookable resource with a station count; a lab session offers N places in the same slot rather than one.
4. **Student discovers slots.** The student opens a host or resource page. The engine computes free slots in the **student's** zone from: working hours − existing bookings − buffers − date overrides − holidays − the student's own booked commitments.
5. **Student books.** The student submits. The server takes an atomic claim on the slot; on success it writes the booking and returns it; on contention it returns `409` with the alternative slots recomputed.
6. **Everyone is told.** Host and student receive a confirmation; a calendar file is attached; the slot immediately stops being offered to anyone else.
7. **Change or cancel.** Host and student can reschedule or cancel; the cancellation is authorised by session or by a signed token issued to the booking holder.

## 5. Features — MoSCoW

### Must have (the hard core — these carry the Killer Tests)
- **Availability engine.** Working hours − busy − buffers − overrides, evaluated per host and per resource, with correct section boundaries.
- **Time zones.** Host zone and booker zone both first-class. **Killer Test 1** depends on this being right in both directions.
- **Buffers.** Per-event before/after buffers that inflate busy intervals so adjacent slots are excluded. **Killer Test 2** depends on this.
- **Date and day-off overrides.** One-off availability rows keyed by date, plus term holidays that remove a whole day. Named explicitly in the Brief's hard core.
- **Atomic booking.** A contested slot produces exactly one winner. **Killer Test 3** depends on this.
- **Resource slots with capacity.** A lab slot holds N students, not one.
- **Public booking page** with the slot list in the student's zone.

### Should have
- **Differentiator — the Intelligence layer** (see §8): concierge, allocator, clash sentinel, history-based suggestions.
- Student timetable awareness so a student's own clashes are detected.
- Cancellation/reschedule with token authorisation (fixes a real defect in the original — `apps/web/app/api/cancel/route.ts:52`).
- Email confirmation with an ICS attachment.

### Could have
- Admin demand-versus-supply view for the term.
- Waitlist when a slot is full.
- Per-faculty office-hour quotas.

### Won't have (and why)
- **Calendars sync with Google/Outlook.** The original's value here is large but it is an integration problem, not an availability-engine problem, and the Brief's hard core does not include it. Documented as a deliberate exclusion rather than an oversight.
- **Payments, teams, round-robin, organisations.** Removed or out of scope for this Brief.
- **The original's unused schema** (denormalised booking table, calendar cache, directory sync, telephony agents): `packages/prisma/schema.prisma:1527, :1594, :1785, :2541`.

## 6. Out of scope

- Migrating any data from the original.
- Reimplementing the original's enterprise surfaces or its dead models.
- A production deployment: the Brief requires the rebuild to run on our laptop.
- Being a general-purpose Calendly replacement. Meridian is opinionated about the campus case.

## 7. Acceptance criteria

Written as Given / When / Then. **One criterion per Killer Test is mandatory**; the rest protect behaviour the tests do not reach.

### KT-1 — IST host, PST booker, same slots
- **Given** a host whose working hours are 09:00–17:00 in `Asia/Kolkata` on a day with no overrides and no existing bookings,
- **When** the slot API is queried by a booker whose zone is `America/Los_Angeles`,
- **Then** (a) the returned slots are the **identical instants** in both queries, (b) rendered in the booker's zone they run from **20:30 on the previous day to 04:30 on the requested day** — 09:00 IST = 03:30 UTC = 20:30 PDT, 17:00 IST = 11:30 UTC = 04:30 PDT — spanning **two** booker-side calendar days, and (c) the offset difference the engine applies is 12 h 30 m.
- **The trap this test is built to expose.** The card says *PST*, but the hackathon runs in October, when `America/Los_Angeles` is on **PDT (UTC−7)**, not PST (UTC−8). The correct local rendering is therefore **20:30–04:30**, and a test that hard-codes 19:30–03:30 — the literal PST answer — will fail on the day it is run. Every date-derived offset in this system must come from the zone database, never from a fixed constant. That is exactly what the original does: `packages/trpc/server/routers/viewer/slots/util.ts:290` converts with `dayjs(startTime).tz(timeZone)` and nothing in the pipeline carries a hand-written offset.
- **How the test is written so it cannot be gamed.** It asserts *instant identity* and *offset difference for the requested date*, not literal clock strings. Run on an October date it must yield 20:30–04:30; run against a date in standard time it must yield 19:30–03:30 with no code change. Both runs are in the harness.
- **Anti-criterion:** the test fails if a slot is duplicated, dropped at a day boundary, or shifted by a fixed offset rather than by the zone rules for that date.

### KT-2 — buffer respected
- **Given** an event type with a 15-minute before-buffer and a 30-minute after-buffer, and an existing booking from 10:00 to 10:30 UTC,
- **When** slots are requested for that day,
- **Then** no slot is offered that overlaps `09:45–11:00 UTC` (10:00 − 15 min through 10:30 + 30 min), the slot ending at 09:45 is legal and the slot starting at 11:00 is legal, and buffers apply in **both** directions regardless of which side of the booking the new appointment falls.
- **Anti-criterion:** the test fails if buffers are applied after slot generation as a filter on start times only — the original inflates the busy interval itself, and so must we (`packages/features/busyTimes/services/getBusyTimes.ts:266, :267`).

### KT-3 — exactly one booking wins
- **Given** one slot with capacity 1 and two independent clients that submit for it at the same moment,
- **When** both requests are in flight concurrently,
- **Then** exactly one receives `201` with a booking id, the other receives `409` with the recomputed alternative slots, and a count of stored bookings for that slot returns exactly `1`.
- **Anti-criterion:** the test fails if the two requests serialise only because the test was not actually concurrent. The harness must release both callers from a common barrier so the interleaving is genuine, and must be run repeatedly to catch a lucky schedule. **Measured baseline for the harness itself:** against a real PostgreSQL 16.15, an unguarded insert stored **20 rows out of 20** for one slot, so the harness demonstrably detects the defect it is testing for; the same harness with our design stores **1**. A concurrency test that has never been shown to fail is not evidence.
- **Scale:** the criterion is run at **40 concurrent callers**, five consecutive times, with the constraint disabled, so that the result depends on our lock rather than on the database's backstop. See `ARCHITECTURE.md` §4.3.

### KT-3b — capacity is honoured for lab slots
- **Given** a lab slot with 3 stations and three students,
- **When** all three book it,
- **Then** all three succeed and the slot reports full; a fourth attempt receives `409`.
- **Rationale:** this is the case a naive "one booking per (host, time)" exclusion constraint would break — exactly the regression upstream warns about at `https://github.com/calcom/cal.diy/issues/21467`.

### Additional criteria
- **AC-A — overrides beat recurrence.** Given a recurring 09:00–17:00 Tuesday and a date override for a specific Tuesday of 10:00–12:00, when slots are requested for that date, then only 10:00–12:00 is offered, and the following Tuesday reverts to 09:00–17:00.
- **AC-B — holidays remove the day.** Given a term holiday, when slots are requested for that date, then the response contains no slots and no error.
- **AC-C — a student's own clashes are excluded.** Given a student who already holds a booking from 14:00–15:00, when they request slots, then no slot is offered that overlaps it even if the host is free.
- **AC-D — ownership is enforced.** Given a student and another student's booking, when the first requests it by id, then the server responds `404` and leaks no fields.
- **AC-E — the app runs without an AI key.** Given no `OPENAI_API_KEY` in the environment, when the server starts, then every core flow (browse, book, cancel) works and only the concierge surface degrades to its structured form.
- **AC-F — windows are configurable.** Given `HOLD_TTL_MINUTES=1` in `.env`, when a slot is held and one minute passes, then the hold expires and the slot is offered again. No time window is hard-coded.

## 8. The differentiator — Meridian Intelligence

The Brief requires at least one capability the original does not have at all. We implement four, as one coherent layer, ordered by demo value. The layer never replaces the hard core: if the differentiator is disabled, all of KT-1 to KT-3 still pass.

### D1 · Concierge — ask for a slot in plain language
A student types *"45 minutes with Prof. Rao before Friday, I'm busy 2–4 on Wednesday."* The system returns a **real, bookable** slot and can complete the booking. The LLM's job is confined to **parsing the request and phrasing the answer**; a deterministic solver validates the candidate against the engine. Without an API key the same screen offers a structured form and produces identical results. This is safe by construction: the model can never invent availability, because every candidate it proposes is re-validated server-side before it is offered.

### D2 · Allocator — fair distribution of scarce slots across a cohort
When demand exceeds supply, place students into office-hour and lab slots by a stated policy (round-robin across the week, then by request time), maximising the number of students served and spreading load across the week instead of filling the first hours. Produces an allocation report: demand, supply, served, unfilled.

### D3 · Clash Sentinel — the student's own timetable
The engine models the **booker's** commitments, not just the host's. A student with a lecture 14:00–15:00 is never offered a clashing slot, and on a request that would clash the system names the specific conflict and offers the nearest non-clashing alternatives. The original cannot do this at all: it reads the host's calendar and never the invitee's (`packages/features/availability/lib/getUserAvailability.ts:648`).

### D4 · Suggest — history-driven ranking
Slots are ranked using what has worked before: a student's attendance history, the times their cohort most often uses, and the host's historical fill rate. Surfaces as "usually works for you" alongside the neutral list. The original never feeds past bookings back into ranking.

### Why the layer is credible rather than decorative
- **It is provably absent from the original.** `OBSERVATIONS.md` §F records six capabilities the original does not have, each established by search rather than assumed, plus two upstream feature requests that were never implemented (`#6084`, `#5779`).
- **Each surface is independently demoable.** Any one of D1–D4 can be shown in under a minute without the others.
- **Each degrades safely.** D1 falls back to a form without a key; D2–D4 are pure computation and require no network at all.
- **Each is anchored to a named user.** D1 to the student in a hurry; D2 to the admin; D3 to the student whose own timetable is invisible to the original; D4 to the returning student.
