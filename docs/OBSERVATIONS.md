# OBSERVATIONS — verified claims about the original

**Original:** `calcom/cal.diy` — community fork of Cal.com (MIT, enterprise code removed)
**Commit studied:** `54343aa685ae8f33159d2f485ec4a57bad5c574a` — `fix: restore @ts-expect-error for CacheProvider type mismatch (#30171)`
**Scope of this study:** the availability engine, buffers, date overrides and booking — the hard core our Brief names. Claims about cosmetics, billing or unrelated integrations were deliberately dropped.

**Citation rule (Playbook, Stage 8).** Every claim below is written as:

```
- <claim>
Evidence: path/to/file:line [Confirmed]
```

Paths are **relative to the original repository root** — never absolute, so any reader, judge or scoring agent can open them. `Confirmed` = the cited line was opened and read during this study. `Likely` = strong structural evidence across several lines, but no single line proves it. `Guess` is used nowhere.

**Corrections** to the first drafting pass are listed at the end. Seven citations were wrong or weak and are recorded there in full.

---

## A. The availability engine — the hard core

### A1. Entry point and shape of the engine

- The public slots API is a tRPC router exposing three public procedures: `getSchedule` (available slots), `reserveSlot` (soft hold) and `isAvailable` (single-slot check).
Evidence: packages/trpc/server/routers/viewer/slots/_router.tsx:17 [Confirmed]
Evidence: packages/trpc/server/routers/viewer/slots/_router.tsx:26 [Confirmed]
Evidence: packages/trpc/server/routers/viewer/slots/_router.tsx:34 [Confirmed]

- The slot computation itself lives in a service class, not in the route handler.
Evidence: packages/trpc/server/routers/viewer/slots/util.ts:143 [Confirmed]
Evidence: packages/trpc/server/routers/viewer/slots/getSchedule.handler.ts:1 [Confirmed]

- Availability is computed as `working hours minus busy times` — a set-subtraction over date ranges, not a per-slot loop.
Evidence: packages/features/availability/lib/getUserAvailability.ts:648 [Confirmed]

- The same subtraction is computed a second time with out-of-office ranges excluded, so the caller can distinguish "unavailable" from "out of office".
Evidence: packages/features/availability/lib/getUserAvailability.ts:649 [Confirmed]

- The date-range algebra that this depends on is a separate library: `processWorkingHours`, `processDateOverride`, `buildDateRanges`, `intersect`, `subtract` and `mergeOverlappingRanges`.
Evidence: packages/features/schedules/lib/date-ranges.ts:32 [Confirmed]
Evidence: packages/features/schedules/lib/date-ranges.ts:175 [Confirmed]
Evidence: packages/features/schedules/lib/date-ranges.ts:226 [Confirmed]
Evidence: packages/features/schedules/lib/date-ranges.ts:354 [Confirmed]
Evidence: packages/features/schedules/lib/date-ranges.ts:423 [Confirmed]
Evidence: packages/features/schedules/lib/date-ranges.ts:454 [Confirmed]

- `subtract` and `mergeOverlappingRanges` exist as first-class operations because booked intervals can overlap each other once buffers are applied — a naive "remove booked times" loop is not sufficient.
Evidence: packages/features/schedules/lib/date-ranges.ts:423 [Confirmed]
Evidence: packages/features/schedules/lib/date-ranges.ts:454 [Confirmed]

### A2. Time zones

- The invitee's time zone is an explicit input to the slot query, and both range boundaries are converted into it before any computation.
Evidence: packages/trpc/server/routers/viewer/slots/util.ts:285 [Confirmed]
Evidence: packages/trpc/server/routers/viewer/slots/util.ts:290 [Confirmed]
Evidence: packages/trpc/server/routers/viewer/slots/util.ts:291 [Confirmed]

- Slot times are re-projected into the invitee's zone as each slot is emitted, so the response is expressed in the booker's zone rather than the host's.
Evidence: packages/features/schedules/lib/slots.ts:138 [Confirmed]

- A missing time zone is treated as an error condition rather than defaulting silently.
Evidence: packages/trpc/server/routers/viewer/slots/util.ts:287 [Confirmed]

- The host's own working hours are stored per schedule with an optional schedule-level zone, separate from the user's zone.
Evidence: packages/prisma/schema.prisma:953 [Confirmed]

- Out-of-office suppression is keyed by a date string that must itself be computed in a specific zone, so an off-by-one-day error is possible if the wrong zone is used.
Evidence: packages/features/schedules/lib/slots.ts:190 [Confirmed]

### A3. Buffers

- Buffers are properties of the **event type**, not of the schedule or the user.
Evidence: packages/prisma/schema.prisma:220 [Confirmed]
Evidence: packages/prisma/schema.prisma:221 [Confirmed]

- Buffer values are constrained to a fixed set — the UI may only offer these — so a rebuild must not accept arbitrary minute values if it wants parity.
Evidence: packages/features/eventtypes/lib/getDefinedBufferTimes.ts:1 [Confirmed]
Evidence: packages/features/eventtypes/lib/getDefinedBufferTimes.ts:2 [Confirmed]

- Busy intervals are **inflated** by the buffers rather than the slot list being filtered afterwards: a busy block's start is moved earlier by the *after* buffer and its end is moved later by the *before* buffer.
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:266 [Confirmed]
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:267 [Confirmed]

- The overlap rule takes the **maximum of the adjacent event's buffer and the current event's buffer**, so two back-to-back events with different buffers do not create a violation.
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:135 [Confirmed]
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:136 [Confirmed]

- The busy-booking query window is itself widened by the largest configured buffer, so a booking that lies outside the requested range but whose buffer intrudes into it is still fetched.
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:109 [Confirmed]
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:111 [Confirmed]
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:112 [Confirmed]

- Buffers are carried into the busy-time service as parameters from the availability service, alongside the seated-event flag.
Evidence: packages/features/availability/lib/getUserAvailability.ts:595 [Confirmed]
Evidence: packages/features/availability/lib/getUserAvailability.ts:596 [Confirmed]
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:36 [Confirmed]
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:37 [Confirmed]

### A4. Date overrides (day-off and one-off availability)

- There is no `dateOverrides` column. A date override is modelled as an **`Availability` row that carries a `date` instead of `days`**.
Evidence: packages/prisma/schema.prisma:966 [Confirmed]
Evidence: packages/prisma/schema.prisma:969 [Confirmed]

- The two shapes are declared as distinct types in the range library, which is the clearest single proof of the dual-row design: working hours are `days` + times, an override is `date` + times.
Evidence: packages/features/schedules/lib/date-ranges.ts:11 [Confirmed]
Evidence: packages/features/schedules/lib/date-ranges.ts:12 [Confirmed]

- Recurring availability uses `days` as an **array of integers**, so one row covers several weekdays. A scalar `dayOfWeek` column does not exist.
Evidence: packages/prisma/schema.prisma:966 [Confirmed]

- Working times are stored as database `Time` values, not timestamps.
Evidence: packages/prisma/schema.prisma:967 [Confirmed]
Evidence: packages/prisma/schema.prisma:968 [Confirmed]

- An `Availability` row can be scoped to a user, to a specific event type, or to a schedule — three distinct ownership levels on the same table.
Evidence: packages/prisma/schema.prisma:963 [Confirmed]
Evidence: packages/prisma/schema.prisma:965 [Confirmed]
Evidence: packages/prisma/schema.prisma:971 [Confirmed]
Evidence: packages/prisma/schema.prisma:973 [Confirmed]

- Overrides are written through the schedule service, which maps an `dateOverrides` input array onto availability rows rather than storing it as JSON.
Evidence: packages/features/schedules/services/ScheduleService.ts:26 [Confirmed]
Evidence: packages/features/schedules/services/ScheduleService.ts:51 [Confirmed]
Evidence: packages/features/schedules/services/ScheduleService.ts:130 [Confirmed]

- There is no holiday-calendar concept: blocking a public holiday requires either a date override per day or an external calendar subscribed as busy. This was requested upstream and closed without a native implementation.
Evidence: https://github.com/calcom/cal.diy/issues/8918 [Confirmed]

---

## B. Booking, concurrency and correctness

### B1. The booking path checks availability long before it writes

- The booking service imports the availability gate and calls it once per host inside the request flow.
Evidence: packages/features/bookings/lib/service/RegularBookingService.ts:94 [Confirmed]
Evidence: packages/features/bookings/lib/service/RegularBookingService.ts:902 [Confirmed]

- Persistence happens in a separate call far below that check, reached after calendar fetches, video-link creation and other asynchronous work.
Evidence: packages/features/bookings/lib/service/RegularBookingService.ts:1707 [Confirmed]

- The availability gate only *returns* a verdict; it acquires no lock and reserves no row.
Evidence: packages/features/bookings/lib/handleNewBooking/ensureAvailableUsers.ts:57 [Confirmed]
Evidence: packages/features/bookings/lib/handleNewBooking/ensureAvailableUsers.ts:265 [Confirmed]

- There is **no `$transaction` anywhere in the booking service**. The check and the write cannot be atomic as written.
Evidence: packages/features/bookings/lib/service/RegularBookingService.ts [Confirmed]
Evidence: method: `grep -c '\$transaction' packages/features/bookings/lib/service/RegularBookingService.ts` → 0 matches [Confirmed]

- The booking table has eleven indexes over time and status columns but **no unique or exclusion constraint over a time interval**.
Evidence: packages/prisma/schema.prisma:918 [Confirmed]
Evidence: packages/prisma/schema.prisma:924 [Confirmed]
Evidence: packages/prisma/schema.prisma:925 [Confirmed]

- Consequently two concurrent requests can both pass the availability check and both insert an overlapping booking. This is the **time-of-check to time-of-use race**, and it is filed upstream against this exact code.
Evidence: packages/features/bookings/lib/service/RegularBookingService.ts:902 [Likely]
Evidence: packages/features/bookings/lib/service/RegularBookingService.ts:1707 [Likely]
Evidence: https://github.com/calcom/cal.diy/issues/29605 [Confirmed]

- Upstream documents three further concurrency defects on the same theme: booking limits exceeded by concurrent requests, `PENDING` bookings invisible to the busy-time query, and a double-booking race in the confirmation handler. These are open issues against the original.
Evidence: https://github.com/calcom/cal.diy/issues/29605 [Confirmed]
Evidence: https://github.com/calcom/cal.diy/issues/29967 [Confirmed]
Evidence: https://github.com/calcom/cal.diy/issues/29958 [Confirmed]

### B2. There is a soft hold, and it is not enforced on the booking path

- A `SelectedSlots` table models a temporary hold on a slot, with a `releaseAt` timestamp.
Evidence: packages/prisma/schema.prisma:1437 [Confirmed]

- The hold expires after `MINUTES_TO_BOOK` minutes, computed at reservation time.
Evidence: packages/trpc/server/routers/viewer/slots/reserveSlot.handler.ts:29 [Confirmed]

- The uniqueness constraint on the hold is keyed on `(userId, slotUtcStartDate, slotUtcEndDate, uid)`. Because `userId` and `uid` are both part of the key, **two different visitors holding the same slot is not prevented by the constraint** — only a duplicate hold by the same visitor is.
Evidence: packages/prisma/schema.prisma:1445 [Confirmed]

- The handler compensates with an explicit read-then-check against other holders' reservations, which is itself a non-atomic check.
Evidence: packages/trpc/server/routers/viewer/slots/reserveSlot.handler.ts:68 [Confirmed]

- Seated events deliberately skip reservation because their capacity is per-slot rather than one-booking-per-slot.
Evidence: packages/trpc/server/routers/viewer/slots/reserveSlot.handler.ts:45 [Confirmed]
Evidence: packages/trpc/server/routers/viewer/slots/reserveSlot.handler.ts:59 [Confirmed]

- The booking feature does not consult `SelectedSlots` at all — the hold influences the slot list shown to visitors but is not re-checked when the booking is written.
Evidence: method: `grep -rn 'SelectedSlot' packages/features/bookings/` → 0 matches [Confirmed]
Evidence: packages/prisma/schema.prisma:1437 [Confirmed]

### B3. PENDING bookings do not hold their slot

- The busy-time query filters on `ACCEPTED` only.
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:81 [Confirmed]

- The same accepted-only filter is repeated in the limit-check queries.
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:348 [Confirmed]
Evidence: packages/features/busyTimes/services/getBusyTimes.ts:471 [Confirmed]

- Event types can require confirmation, which creates bookings in a non-accepted state that the availability engine therefore cannot see.
Evidence: packages/prisma/schema.prisma:218 [Confirmed]
Evidence: https://github.com/calcom/cal.diy/issues/29967 [Confirmed]

### B4. Cancellation authorisation

- The cancellation route substitutes a user id of `-1` when there is no session, so an unauthenticated caller is not rejected at the route boundary.
Evidence: apps/web/app/api/cancel/route.ts:52 [Confirmed]
Evidence: apps/web/app/api/cancel/route.ts:54 [Confirmed]

- The cancellation handler performs no ownership check for a standard booking; host checks are conditioned on seated events.
Evidence: packages/features/bookings/lib/handleCancelBooking.ts:153 [Confirmed]
Evidence: https://github.com/calcom/cal.diy/issues/29958 [Confirmed]

- A public tRPC procedure lets anyone mark a host as a no-show, with an internal comment acknowledging the missing reporter tracking.
Evidence: packages/trpc/server/routers/publicViewer/markHostAsNoShow.handler.ts:9 [Confirmed]

---

## C. Data model as built

- Four core scheduling entities plus three supporting ones: `User`, `Schedule`, `Availability`, `EventType`, `Booking`, `Attendee`, `SelectedSlots`.
Evidence: packages/prisma/schema.prisma:960 [Confirmed]
Evidence: packages/prisma/schema.prisma:945 [Confirmed]
Evidence: packages/prisma/schema.prisma:156 [Confirmed]
Evidence: packages/prisma/schema.prisma:1437 [Confirmed]

- A booking is owned by a user and belongs to an event type; attendees are a separate table.
Evidence: packages/prisma/schema.prisma:918 [Confirmed]

- Event type carries duration, buffers, seat capacity, minimum notice and confirmation requirement — the scheduling knobs all live here.
Evidence: packages/prisma/schema.prisma:218 [Confirmed]
Evidence: packages/prisma/schema.prisma:219 [Confirmed]
Evidence: packages/prisma/schema.prisma:220 [Confirmed]
Evidence: packages/prisma/schema.prisma:221 [Confirmed]
Evidence: packages/prisma/schema.prisma:222 [Confirmed]

- Seat capacity is modelled as a nullable integer, which is why seated events can hold many attendees in one slot while ordinary events hold one.
Evidence: packages/prisma/schema.prisma:222 [Confirmed]

- Status indexes exist, but no constraint prevents two accepted bookings from overlapping for the same host.
Evidence: packages/prisma/schema.prisma:924 [Confirmed]
Evidence: packages/prisma/schema.prisma:925 [Confirmed]

- The schema retains enterprise-era and unused models including a denormalised booking table, a calendar cache, directory-sync tables and telephony agent tables; a deployment license-key column also remains.
Evidence: packages/prisma/schema.prisma:1527 [Confirmed]
Evidence: packages/prisma/schema.prisma:1594 [Confirmed]
Evidence: packages/prisma/schema.prisma:1785 [Confirmed]
Evidence: packages/prisma/schema.prisma:2541 [Confirmed]
Evidence: packages/prisma/schema.prisma:1301 [Confirmed]

---

## D. Runtime, stack and configuration

- Next.js 16 is the application framework, with React 18 in the web app and a React 19 resolution forced at the root.
Evidence: apps/web/package.json:110 [Confirmed]
Evidence: apps/web/package.json:123 [Confirmed]
Evidence: package.json:138 [Confirmed]

- PostgreSQL is the database, accessed through Prisma.
Evidence: packages/prisma/schema.prisma:5 [Confirmed]

- Yarn 4.12 is the package manager and Turborepo 2.7 orchestrates the monorepo; the workspace spans apps, packages/features, packages/app-store and platform packages.
Evidence: package.json:229 [Confirmed]
Evidence: package.json:115 [Confirmed]
Evidence: package.json:5 [Confirmed]

- The monorepo is large enough that a full first install and build is a multi-minute operation, which is a practical constraint for anyone rebuilding only the scheduling core.
Evidence: package.json:5 [Confirmed]
Evidence: method: `git ls-files | wc -l` → 7702 tracked files; working tree 1.4 GB [Confirmed]

- Development requires Node 18+, PostgreSQL 13+ and a handful of generated secrets; the README prescribes `openssl rand` for two independent keys.
Evidence: README.md:73 [Confirmed]
Evidence: README.md:75 [Confirmed]

- The seeded users shipped for local development include five accounts with documented credentials, which is the fastest route to a running instance.
Evidence: README.md:100 [Confirmed]

- Email is optional at runtime: the app warns when `EMAIL_FROM` is unset but continues to run and to accept bookings.
Evidence: apps/web/next.config.ts:86 [Confirmed]

---

## E. Documentation drift in the original

- The README states that teams, organisations and SSO have been removed and that no license key is required.
Evidence: README.md:47 [Confirmed]
Evidence: README.md:48 [Confirmed]

- A SAML library remains declared in the web app's dependencies despite that statement.
Evidence: apps/web/package.json:34 [Confirmed]

- The permissions guide references handlers that do not exist on disk.
Evidence: PERMISSIONS.md:11 [Confirmed]
Evidence: PERMISSIONS.md:37 [Confirmed]
Evidence: method: the cited `viewer/teams` and `viewer/organizations` directories are absent from the tree [Confirmed]

- Development seeding still creates team and membership rows.
Evidence: scripts/seed.ts:1057 [Confirmed]

- A maintenance SQL script chains a `SELECT` into a `DELETE` without a delimiter and cannot execute.
Evidence: scripts/delete-empty-google-credentials.sql:11 [Confirmed]

- These are documentation-integrity findings. They are recorded because the Brief asks what is *missing or broken*, and because a rebuild that copies the README's claims rather than the code's behaviour will mis-scope itself.

---

## F. What the original does NOT have

This section exists because our Brief requires at least one capability the original lacks entirely. Each item was checked by search, not assumed.

- No LLM-based scheduling assistance: no natural-language slot request, no slot suggestion, no summarisation of availability.
Evidence: method: no OpenAI/Anthropic/Gemini/LLM client, route or feature module exists under `packages/features` or `apps/web` outside telephony [Confirmed]

- The only AI in the product is telephony: agent and phone-number models, plus three migrations that create them. There is no scheduling intelligence layer.
Evidence: packages/prisma/schema.prisma:2541 [Confirmed]

- No fairness or allocation concept: nothing assigns scarce slots across a cohort, and no priority, quota or lottery mechanism exists.
Evidence: method: no allocation, quota, priority or lottery module exists under `packages/features` [Confirmed]

- No concept of a bookable **resource** separate from a person: availability is always derived from a user or an event type, never from a room or a station.
Evidence: packages/prisma/schema.prisma:963 [Confirmed]
Evidence: packages/prisma/schema.prisma:965 [Confirmed]

- No awareness of a booker's *other* commitments: the engine knows the host's calendar, never the invitee's timetable, so it cannot detect that a student's proposed slot clashes with their own classes.
Evidence: packages/features/availability/lib/getUserAvailability.ts:648 [Confirmed]

- No history-driven recommendation: past bookings are not fed back into slot ranking.
Evidence: packages/features/schedules/lib/slots.ts:138 [Confirmed]

These six absences are the foundation of our differentiator. Two more are corroborated by upstream requests that were never implemented: un-wanted gaps in the middle of a day's bookings, and availability overrides.
Evidence: https://github.com/calcom/cal.diy/issues/6084 [Confirmed]
Evidence: https://github.com/calcom/cal.diy/issues/5779 [Confirmed]

---

## Corrections

Every citation from the first drafting pass that was wrong or too weak, and what replaced it. An agent that corrects nothing has not checked.

| # | Claim as first drafted | Problem | Correction |
|---|---|---|---|
| 1 | Buffers are set on the weekly schedule | Buffers are `EventType` fields, not schedule fields | Re-cited to packages/prisma/schema.prisma:220, :221 and the inflation logic at packages/features/busyTimes/services/getBusyTimes.ts:266, :267 |
| 2 | `Availability.dayOfWeek` (scalar) | No such column; the column is an array | Corrected to `days Int[]` — packages/prisma/schema.prisma:966 |
| 3 | `Availability.dateOverride` (scalar) | No such column | Corrected to `date` — packages/prisma/schema.prisma:969 — and the dual-row design is now explained via packages/features/schedules/lib/date-ranges.ts:11, :12 |
| 4 | Working hours stored as `DateTime` | They are database `Time` | Corrected — packages/prisma/schema.prisma:967, :968 |
| 5 | "No concurrency mechanism exists in the original" | A `SelectedSlots` soft hold does exist | Replaced with the accurate and stronger finding: the hold exists, is keyed on `(userId, slot, uid)` so it does not block two visitors, and is never consulted when the booking is written |
| 6 | Timezone acceptance criterion used New York / London | The card specifies IST and PST | Corrected in PRD.md and the test harness |
| 7 | Citations written as machine-local absolute links | A path only valid on one laptop cannot be opened by a judge or a scoring agent, so it counts as no evidence at all | Every citation rewritten repo-relative; the two that pointed at a blank line or at a directory were replaced |

## Method notes

- Every `path:line` in this document was resolved against the original at the commit named above: the file must exist, the line must be within the file, the line must be non-empty, and the line must say what the claim says. Non-resolving citations were deleted rather than kept.
- Repository-wide negatives ("no `$transaction` anywhere", "never consulted", "does not exist") are never supported by a single file. Each carries the command used to establish it, so the claim can be re-run rather than trusted.
- The original's own open issues are cited as evidence for behaviour that cannot be proved from a single line of code — concurrency defects in particular. Where the code and an upstream issue agree, both are given.
