# Meridian

A campus scheduling engine for **faculty office hours and lab slots** — built for a department of
~200 students competing for ~15 supervisors and 5 labs.

It computes genuinely free slots across time zones, honours buffers and day-off overrides, and
guarantees that **exactly one** booking wins any contested slot.

---

## Run it

```bash
cp .env.example .env                 # 1. defaults work as-is; AI keys stay empty
docker compose up -d db              # 2. PostgreSQL 16
npm ci                               # 3. dependencies
npm run db:migrate && npm run db:seed # 4. schema + 200 students, 15 faculty, 5 labs, 1 holiday
npm run dev                          # 5. http://localhost:3000
```

That is the whole setup. No API key is required, no external service is called, and the seed makes
the 200-student scenario real rather than a slide.

---

## What it does

| | |
|---|---|
| **Availability engine** | working hours − busy − buffers − overrides − holidays, as date-range algebra rather than a per-slot loop |
| **Time zones** | host zone and booker zone both first-class; the booker sees slots in their own zone |
| **Buffers** | per-service before/after buffers that *inflate busy intervals*, so a buffer cannot be quietly violated |
| **Date overrides** | one-off availability rows keyed by date, plus term holidays that remove a day outright |
| **Atomic booking** | a contested slot yields exactly one winner; the loser gets `409` with fresh alternatives |
| **Resource slots** | a lab is a bookable entity with a station count — 3 stations means 3 concurrent bookings, not 1 |
| **Meridian Intelligence** | four capabilities the original has none of: a natural-language concierge, a cohort allocator, a clash sentinel and history-based ranking |

---

## The three Killer Tests

Each is runnable with `curl` — no UI required. Full harness in `tests/`.

**1 · IST host, PST booker, the same slots.**
```bash
curl "localhost:3000/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata"
curl "localhost:3000/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=America/Los_Angeles"
```
The same instants both times. Rendered in `America/Los_Angeles` an 09:00 IST start is **20:30 the
previous day** — 12 h 30 m apart. On an October date that is PDT (UTC−7), not PST (UTC−8); the
offset comes from the zone database, never from a constant.

**2 · Buffers are respected.**
```bash
npm run test:killer -- --test=kt2
```
With a 15-minute before-buffer and a 30-minute after-buffer, no slot overlaps the padded window
around an existing booking — in both directions.

**3 · Exactly one booking wins.**
```bash
npm run test:concurrency             # 40 concurrent callers, 5 consecutive runs
```
```bash
# Expected, with the database constraint deliberately DISABLED:
#   winners=1  losers=39  storedRows=1   (×5 runs)
```
If you have never watched this test fail, you do not yet know it tests anything — see
`docs/ARCHITECTURE.md` §4.2 for why the obvious guard is not atomic.

---

## Configuration

Every time window is an environment variable, so behaviour can be exercised in minutes. The ones a
reviewer usually reaches for:

| Variable | Effect |
|---|---|
| `HOLD_TTL_MINUTES=1` | a slot hold expires in one minute — watch it live |
| `TERM_HOLIDAYS` | day-off overrides; those dates return an empty slot list |
| `OPENAI_API_KEY=` *(empty)* | the app still runs; the concierge uses its structured form |
| `ENABLE_CLASH_SENTINEL=false` | the differentiator switches off and all three Killer Tests still pass |

Full list with commentary in `.env.example`.

---

## Documentation

| File | What it is |
|---|---|
| `docs/OBSERVATIONS.md` | verified claims about the original — every one a repo-relative `path:line` or an upstream issue |
| `docs/PRD.md` | problem, users, acceptance criteria written as Given/When/Then, the differentiator |
| `docs/ARCHITECTURE.md` | the availability pipeline, the concurrency design and the measurements behind it |
| `docs/DATA_MODEL.md` | complete Prisma schema plus the constraints that carry the Killer Tests |
| `docs/API.md` | endpoint contract; its status codes *are* Killer Test 3 |
| `docs/GAPS.md` | the gap register, the two claimed improvements, and what we rejected |
| `docs/AGENT_LOG.md` | how the docs were produced, including every correction |

---

## Clean room

Built from the original's **documentation of behaviour**, never its code.

- No source was copied from the original repository.
- No `@calcom/*` package is installed, directly or transitively.
- The original was studied by reading it; the rebuild shares no code with it.
- Every third-party library used is listed in `SUBMISSION.md`.

## Licence

MIT.
