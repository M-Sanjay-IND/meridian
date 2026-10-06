**MERIDIAN — DEVELOPER MANUAL**  
**Written 09:45 IST, Tue 6 Oct 2026.** Code freeze  **12:30 IST — 2 h 45 m from now.**  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsSfYxZo/kSGMYQLPJrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA4qrBdGuSdJuAAAAAElFTkSuQmCC)  
**0 · READ THIS FIRST**  
**0.1 The situation, stated plainly**  
| | |  
|-|-|  
|   |   |   
| Docs, README, SUBMISSION, deck.pdf, .env.example | **Frozen and pushed.** Public repo verified. Good. |   
| docs/ freeze (08:30) | **Already passed.**docs/ is scored as of the last push before 08:30. It is now read-only. |   
| Code written | **Zero.** No src/, no package.json, no docker-compose.yml, no prisma/. |   
| Code freeze (12:30) | **2 h 45 m away.** Nothing may be pushed after. |   
| Deployment | **None needed.** The Brief requires the app to run on your laptop. There is no staging, no production. |   
   
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3OQQmAABRAsSdYxKY/jMFMIZ7ECt5E2BJsmZmt2gMA4C+Otbqr8+sJAACvXQ85QgYXd/O+eQAAAABJRU5ErkJggg==)  
**1 · PROJECT OVERVIEW**  
**1.1 What Meridian is**  
A **campus scheduling engine** for faculty office hours and lab slots. Roughly  **200 students**  
   
 compete for **~15 supervisors** and  **5 labs**. Today that runs on spreadsheets and fails in four  
   
 ways: two students take one slot, capacity is wasted, nobody trusts the calendar, and time zones and  
   
 term calendars are ignored.  
Meridian computes genuinely free slots across time zones, honours buffers and day-off overrides, and  
   
 guarantees that **exactly one** booking wins a contested slot.  
**1.2 Target users**  
| | | |  
|-|-|-|  
| **Who** | **Count** | **What they need** |   
| **Student** | ~200 | Get the right slot without clashing with their own classes |   
| **Faculty supervisor** | ~15 | Publish office hours, never be double-booked |   
| **Lab supervisor** | ~5 | Publish lab stations and protect equipment time |   
| **Admin** | 1–2 | See whether supply meets demand |   
   
**1.3 The five core capabilities**  
1. **Availability engine** — working hours − bookings − buffers − overrides − holidays, as date-range  
   
 algebra, not a per-slot loop.  
2. **Time zones** — host zone and booker zone are both first-class. The booker sees slots in their own zone.  
3. **Buffers** — a per-service before/after buffer that *inflates busy intervals*, so a buffer cannot be quietly violated.  
4. **Date and day-off overrides** — one-off availability keyed by date, plus term holidays that remove a day.  
5. **Atomic booking** — one contested slot produces exactly one winner.  
Plus **Meridian Intelligence** (D1–D4), a differentiator the original has none of. It is the first  
   
 thing cut and the last thing built — see §12.  
**1.4 What "done" means**  
Not "it works on my machine". Done means all four of these are true **at the same time**:  
- A fresh clone runs via the README's commands, with no API key.  
- The three Killer Tests pass **live, from ** **curl** **, on the demo laptop**.  
- The repo contains nothing copied from the original and no @calcom/* package.  
- Nothing has been pushed after 12:30.  
**1.5 Explicit non-goals**  
Do not build, and do not apologise for not building: calendar sync (Google/Outlook), payments, teams,  
   
 organisations, SSO, email delivery beyond a stored record, Redis, a migration path from the original,  
   
 or any of the original's dead models (docs/DATA_MODEL.md §2 names them). docs/PRD.md §6 records  
   
 these as deliberate exclusions — that is a strength, not a gap.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OMQ2AABAAsSNhYMEBIpD4ArCJDyywEZJWQZeZOaorAAD+4l6rrTq/ngAA8Nr+AEqmA1hl45m5AAAAAElFTkSuQmCC)  
**2 · THE RULES THAT CANNOT BE BROKEN**  
Violating any one of these voids the submission regardless of how good the code is. They are not  
   
 priorities; they are preconditions.  
**2.1 Clean room**  
| | |  
|-|-|  
| **#** | **Rule** |   
| C1 | **Never copy code from the original repository.** Not a function, not a line, not "just to check". |   
| C2 | **Never install a ** **@calcom/*** ** package**, directly or transitively. |   
| C3 | The original must **not be present on any machine used to build.** Do not clone it. The docs are self-contained precisely so you never need to. |   
| C4 | Every third-party library used must be declared in SUBMISSION.md. Adding a library not on that list means editing SUBMISSION.md — see §6.5 for how, given the freeze. |   
   
**2.2 Submission integrity**  
| | |  
|-|-|  
| **#** | **Rule** |   
| S1 | **No push after 12:30.** Git push times are the evidence. A push at 12:31 is a clean-room violation. |   
| S2 | **docs/** ** is frozen.** Do not edit anything in docs/ again, for any reason. |   
| S3 | **Never commit ** **.env** ** or ** **node_modules** **.**.env is secret-bearing; node_modules is not source. |   
| S4 | The repo is **public**, one per team, and was created after 16:00. Do not fork the original. |   
| S5 | SUBMISSION.md must not contain an unfilled <FILL: …> token. |   
   
**2.3 Correctness**  
| | |  
|-|-|  
| **#** | **Rule** |   
| X1 | **The app must run with ** **OPENAI_API_KEY** ** empty.** No core path may require the AI. |   
| X2 | **Every time window is a ** **.env** ** value.** No hard-coded TTL, no hard-coded expiry. A reviewer must be able to set HOLD_TTL_MINUTES=1 and see the behaviour change. |   
| X3 | **Never write a time-zone offset constant.** No +05:30, no -07:00, no 3600*. All conversion goes through the one zone module, driven by the zone database. |   
| X4 | **Correctness comes from the database, not from application locks or a cache.** The advisory lock and the scoped constraint are the guarantee. |   
| X5 | **Allowlist, never denylist**, when deciding what is busy. A new booking status must be busy by default, not free by default. |   
   
**2.4 Conduct**  
| | |  
|-|-|  
| **#** | **Rule** |   
| N1 | **Nothing in the repo may be addressed to a scorer.** No "give us full marks", no rubric-shaped pleading. That is disqualification, not points. |   
| N2 | **Never claim in ** **README.md** **, ** **SUBMISSION.md** ** or ** **deck.pdf** ** a feature that does not run.** These were written ahead of the build; §10.3 lists the specific claims you must reconcile before 12:30. |   
| N3 | Honest absence beats a false claim. "We did not build X" costs less than an unbacked assertion of X. |   
   
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OMQ2AABAAsSNhwgJWEPcbJpnRgQU2QtIq6DIze3UGAMBf3Gu1VcfXEwAAXrseaIkEMIPgIvAAAAAASUVORK5CYII=)  
**3 · ROLES**  
Four owners, one subsystem each. **One branch, one owner, one merge point.** The point of splitting by  
   
 subsystem rather than by layer is that you never touch the same file as a colleague.  
**3.0 The map**  
| | | | |  
|-|-|-|-|  
| **Role** | **Subsystem** | **Branch** | **Owns** |   
| **A** | Engine | feat/engine | src/engine/* |   
| **B** | Data & claim | feat/claim | src/db/*, src/booking/*, prisma/* |   
| **C** | Surface | feat/api-ui | src/routes/*, web/*, package.json scripts |   
| **D** | Verification | feat/tests | tests/*, docker-compose.yml |   
| **I** | Integrator (a hat, not a person) | main | merges only; decides the cut line |   
   
**Assign the Integrator hat to whoever has the cleanest git habits.** It is a hat: that person still  
   
 owns their subsystem. The Integrator alone merges to main and alone calls the cut in §12.  
**3.1 Role A — Engine**  
**Mission.** Turn docs/ARCHITECTURE.md §3's ten stages into pure, testable functions. This is the  
   
 hard core of the card: it decides Killer Tests 1 and 2.  
**Owns / never touches.** Owns src/engine/{ranges,zones,overrides,buffers,availability}.ts.  
   
 Never edits src/booking/*, src/db/*, src/routes/*, tests/*, or package.json.  
**Deliverables and Definition of Done**  
| | |  
|-|-|  
| **Deliverable** | **DoD** |   
| ranges.ts | intersect, subtract, mergeOverlappingRanges exported; pure; no I/O |   
| zones.ts | the **only** module that converts zones; no offset constant anywhere in it |   
| overrides.ts | recurring rules + date override (replaces that day) + holiday (removes that day) |   
| buffers.ts | inflates busy intervals in **both** directions; takes the  **max** of adjacent buffers |   
| availability.ts | the ten stages composed; returns slots in the requested zone |   
   
**Interface contract you must satisfy** (C codes against this — do not change it without telling C):  
export function getSlots(input: {  
   hostId?: number; resourceId?: number; serviceId: number;  
   from: string; to: string; tz: string;          // tz is a required IANA name  
 }, db: Db): Promise<{ slots: { start: string; end: string; available: boolean; remaining: number; reason?: string }[] }>;  
   
**Your first action (by 10:00):** write the KT-1 unit test *as a failing test* — 09:00–17:00  
   
 Asia/Kolkata must equal the same instants as 20:30–04:30 America/Los_Angeles on an October date,  
   
 **and** the standard-time equivalent. Compute both with the zone library; never hard-code either.  
**The two mistakes that will cost you Killer Tests.** (1) Implementing buffers as a filter on slot  
   
 start times instead of inflating intervals — a long appointment starting just before the buffer  
   
 survives. (2) Any offset constant. Both are in §10.  
**3.2 Role B — Data & claim**  
**Mission.** Own the database and the single most important file in the repository:  
   
 src/booking/claim.ts. Killer Test 3 lives or dies here.  
**Owns / never touches.** Owns prisma/schema.prisma, prisma/migrations/*, prisma/seed.ts,  
   
 src/db/*, src/booking/*. Never edits src/engine/*, src/routes/*, tests/*.  
**Deliverables and DoD**  
| | |  
|-|-|  
| **Deliverable** | **DoD** |   
| schema.prisma | transcribed from docs/DATA_MODEL.md §2 — **transcribe, do not redesign** |   
| migrations/ | applies cleanly to an empty database |   
| seed.ts | creates exactly the data the frozen docs promise (see §4.2) |   
| constraint SQL | tstzrange generated column + no_host_overlap EXCLUDE with the resources_needed = 1 predicate |   
| claim.ts | **the only module permitted to insert a Booking** |   
   
**The claim algorithm, exactly** (docs/ARCHITECTURE.md §4.2):  
BEGIN  
   pg_advisory_xact_lock(hashtextextended(host_id || ':' || day, 0))  
   count overlapping bookings + live holds on (host or resource)  
   if count >= resources_needed -> ROLLBACK, return 409  
   INSERT the booking  
 COMMIT  
   
**The two mistakes that will cost you the event.** (1) Using INSERT … WHERE NOT EXISTS alone —  
   
 **measured at 4 rows out of 20 concurrent callers. It is not atomic.** (2) EXCLUDE on  
   
 (host_id, time_range) **without** the resources_needed = 1 predicate — that breaks multi-station  
   
 lab slots, and it fails *invisibly* on capacity-1 tests. Both are in §10.  
**Your first action (by 10:05):** get the schema migrated and seeded, because A, C and D are all blocked  
   
 on real tables. Then write the claim. Do not gold-plate the schema.  
**3.3 Role C — Surface**  
**Mission.** Expose the engine and the claim over HTTP exactly as docs/API.md specifies, and keep the  
   
 repo runnable at all times.  
**Owns / never touches.** Owns src/routes/*, web/*, and  **package.json** ** scripts** (you are the only  
   
 person who edits the root manifest — this is deliberate, to stop merge conflicts). Never edits  
   
 src/engine/*, src/booking/*, prisma/*.  
**Deliverables and DoD**  
| | |  
|-|-|  
| **Deliverable** | **DoD** |   
| npm run dev | serves on :3000; GET /api/health → 200 |   
| GET /api/slots | returns the exact shape in docs/API.md §3; empty array (200) when nothing is free |   
| POST /api/bookings | 201 on win, 409 on loss — **these two codes are Killer Test 3** |   
| POST /api/holds | TTL read from HOLD_TTL_MINUTES |   
| one booking page | a single page that lists slots and books one |   
   
**Non-negotiable:** every Killer Test must be runnable with curl alone. If a judge cannot exercise it  
   
 without your UI, you have built the wrong thing. The UI is the *last* deliverable, not the first.  
**Contract you consume:** A's getSlots(...) and B's claim(...). Build your routes against the  
   
 signatures in §3.1 and §3.2 immediately, with a stub if A and B are not ready — do not wait.  
**3.4 Role D — Verification**  
**Mission.** Be the first person to see every bug.  **You write the failing test before A, B and C write**  
 **  
 the code it judges.** If you have nothing to do, you are doing it wrong.  
**Owns / never touches.** Owns tests/* and docker-compose.yml. Never edits src/* —  **if you fix a**  
 **  
 bug yourself, the bug is not verified.** You report it; the owner fixes it.  
**Deliverables and DoD**  
| | |  
|-|-|  
| **Deliverable** | **DoD** |   
| tests/concurrency/ | fires CONCURRENCY_CALLERS from a **common barrier**, CONCURRENCY_RUNS times |   
| the **negative control** | proves the harness can detect the defect: unguarded insert → 20 rows |   
| tests/killer-tests/kt1 | zone identity, October **and** standard-time dates |   
| tests/killer-tests/kt2 | buffer respected in both directions, max-of-adjacent rule |   
| tests/killer-tests/kt3b | 3-station lab admits exactly 3, 4th gets 409 |   
| tests/gate.sh | the §8.2 gate as one command the Integrator runs |   
   
**The rule that makes your work real:** run KT-3  **with the constraint disabled**. If the test only  
   
 passes because the database constraint caught the loser, you have not tested the lock — you have tested  
   
 the backstop, and the naive bug is still there.  
**Your first action (by 10:00):** stand up docker-compose.yml with Postgres 16 and hand B a working  
   
 database. You are the reason B is not blocked. Then write the harness.  
**3.5 How you collaborate — the short version**  
- You **never** edit a file you do not own. If you need a change in someone else's file, ask them or  
   
 open a PR against their branch. This is what makes four people in one repo possible without merges  
   
 turning into arguments.  
- You **never** commit to main. Only the Integrator merges.  
- You **push your branch** when a gate passes, not continuously.  
- You **tell the Integrator immediately** if you are going to miss your gate time.  
- Blocked for more than 10 minutes? Say so out loud. See §7.4.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3OQQmAABRAsSdYxKa/jL0MIR7FCt5E2BJsmZmt2gMA4C+Otbqr8+sJAACvXQ85SAYUQNBTfQAAAABJRU5ErkJggg==)  
**4 · THE FROZEN CONTRACT**  
This is the section to read if you want to know *exactly* what to build. The docs are frozen, which  
   
 means they are now a **specification your code must satisfy** — not a description you may adjust. If  
   
 your code disagrees with a frozen doc, **your code is wrong.**  
**4.1 The commands that must work**  
README.md and SUBMISSION.md promise these. They are contract, not suggestion.  
cp .env.example .env  
 docker compose up -d db                # service MUST be named db  
 npm ci  
 npm run db:migrate && npm run db:seed  
 npm run dev                            # serves http://localhost:3000  
   
Therefore package.json **must** define: dev, db:migrate, db:seed, and later  
   
 test:killer, test:concurrency. docker-compose.yml must define a service called **db** running  
   
 **PostgreSQL 16** with database meridian, user meridian, password meridian, on 5432 — because  
   
 that is what .env.example's DATABASE_URL says.  
**4.2 The seed data the docs promise**  
README.md says the seed creates "200 students, 15 faculty, 5 labs, 1 holiday". docs/DATA_MODEL.md  
   
 §9 fixes the lab capacities at **20/24/24/30/12**. And README.md's KT-1 example calls:  
GET /api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata  
   
So the seed **must** produce a host with id = 7 and a service with id = 3, and host 7 must have  
   
 availability covering **2026-10-15**. Get the ids wrong and a judge's copy-paste returns an empty list  
   
 and your submission looks broken. **This is a five-minute detail with a disproportionate cost.**  
**4.3 The endpoints**  
docs/API.md §2 is the list. Implement in this order, and stop wherever time runs out:  
1. GET /api/health — build this first, in P1, so the repo is runnable.  
2. GET /api/slots — the engine's face. Decides KT-1 and KT-2.  
3. POST /api/bookings — the claim's face. Decides KT-3.  
4. POST /api/holds — small, and it demonstrates X2 (configurable TTL).  
5. GET /api/bookings/:id, DELETE /api/bookings/:id — cancellation ownership from docs/GAPS.md G-04.  
6. GET /api/hosts, /api/resources, /api/services — cheap, and the UI needs them.  
7. GET /api/admin/demand, /api/intel/* — the differentiator. **Cut first** (§12).  
**4.4 Status codes that are not negotiable**  
| | | |  
|-|-|-|  
| **Code** | **Meaning** | **Why frozen** |   
| 201 | the claim won | KT-3 reads this |   
| 409 | **lost the race** — body carries slot_taken and fresh alternatives | KT-3 reads this |   
| 409 | hold_expired — distinguishable from slot_taken | a lost hold is not a lost race |   
| 409 | student_clash, with the conflict named | D3 |   
| 422 | missing or non-IANA tz; to before from; range > 31 days | X3 |   
| 423 | holiday, override-excluded, or inside the notice window | AC-B |   
| 200 | idempotent replay of a key that already succeeded | the retry guard |   
| 404 | unknown id **and** a booking owned by someone else | G-04 — never a differentiating error |   
   
**The loser of a race never learns the winner's booking id.** Do not leak it in the 409.  
**4.5 Module layout**  
docs/ARCHITECTURE.md §2 fixes these paths. Create them even if a file stays small; an empty  
   
 src/intel/ with a README line is more honest than a missing directory the docs promise.  
src/engine/    availability.ts  ranges.ts  zones.ts  buffers.ts  overrides.ts  
 src/booking/   claim.ts  service.ts  
 src/intel/     concierge.ts  allocator.ts  sentinel.ts  suggest.ts  
 src/db/        client.ts  repositories  
 src/routes/    one file per resource group  
 tests/         killer-tests/  concurrency/  gate.sh  
   
**The single-writer rule is structural, not stylistic:** src/booking/claim.ts is the only module in  
   
 the codebase permitted to insert a Booking row. This is what lets you *argue* KT-3 rather than merely  
   
 hope.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OMQ2AABAAsSNBCUpfDq4wwIAABiywEZJWQZeZ2ao9AAD+4liruzq/ngAA8Nr1ABweBgdur/QFAAAAAElFTkSuQmCC)  
**5 · PHASES — THE SPRINT**  
Absolute times. The clock is the plan. If a phase overruns, you do not extend it — you cut per §12.  
**5.1 Timing summary**  
| | | | |  
|-|-|-|-|  
| **Phase** | **Clock** | **Duration** | **Exit gate** |   
| **P1 Scaffold** | 09:45 → 10:05 | 20 m | npm ci && npm run dev → curl :3000/api/health = 200 |   
| **P2 Core** (parallel) | 10:05 → 10:50 | 45 m | npm run db:migrate && npm run db:seed clean on an empty DB |   
| **P3 Integration** | 10:50 → 11:25 | 35 m | **KT-3 green**, 40 callers × 5 runs, constraint  **off** |   
| **P4 Killers 1 & 2** | 11:25 → 11:50 | 25 m | KT-1 and KT-2 green via curl |   
| **P5 UI***(optional)* | 11:50 → 12:10 | 20 m | one page books a slot end to end |   
| **P6 Differentiator***(optional)* | 12:10 → 12:20 | 10 m | D3 only, behind a flag, core still green |   
| **P7 Freeze** | 12:20 → 12:30 | 10 m | §8.2 gate green, tagged, pushed |   
   
**P3 is the fulcrum.** If KT-3 is not green by 11:25, you enter emergency mode (§12.3) and everything  
   
 except KT-3 and one slot endpoint is dropped.  
**5.2 P1 · Scaffold — everyone, 20 minutes**  
Goal: **unblock all four people.** Nobody writes feature code until the repo runs.  
| | |  
|-|-|  
| **Who** | **Does** |   
| **D** | docker-compose.yml (Postgres 16, service db, matching .env.example), npm run test:concurrency stub |   
| **C** | package.json with all scripts, tsconfig.json, src/routes/health.ts, .gitignore (node_modules, .env) |   
| **B** | npx prisma init, wire DATABASE_URL, empty migration applies |   
| **A** | src/engine/ files created with exported signatures from §3.1 (bodies throw new Error("todo")) |   
| **I** | creates the four branches, adds teammates, confirms everyone can push |   
   
**Exit gate — the Integrator runs it:**  
rm -rf node_modules && npm ci && docker compose up -d db && npm run dev &  
 sleep 5 && curl -sf localhost:3000/api/health   # must print JSON, exit 0  
   
If this does not pass, **stop and fix it.** A repo that does not start at 10:05 costs everyone the day.  
**5.3 P2 · Core — parallel, 45 minutes**  
The engine, the schema and the harness are written simultaneously against the contract in §3 and §4.  
   
 Nobody waits for anybody; that is what the interfaces in §3.1 and §3.2 are for.  
| | | |  
|-|-|-|  
| **Who** | **Builds** | **Must be true by 10:50** |   
| **B** | full schema from docs/DATA_MODEL.md §2, migrate, seed.ts, constraint SQL | seed is idempotent and creates the §4.2 data |   
| **A** | ranges → zones → overrides → buffers → availability, stage by stage | KT-1 unit test written and **passing or knowingly failing with a reason** |   
| **D** | KT-1/2/3/3b tests, negative control, gate.sh | harness runs and can report a failure |   
| **C** | GET /api/slots + POST /api/bookings against stub then real engine | curl reaches the real engine |   
   
**B's ordering matters more than anyone else's.** A, C and D are all reading real tables. If the schema  
   
 slips past 10:30, everyone slips.  
**5.4 P3 · Integration — the claim, 35 minutes**  
The highest-risk phase and the one that carries the event. B wires the real claim; D runs the harness  
   
 with the constraint **deliberately disabled** so the pass comes from the lock.  
Exit gate:  
40 concurrent callers, constraint OFF, 5 consecutive runs  
   → exactly 1 × 201, 39 × 409, exactly 1 stored row   (every run)  
   → 3-station lab, 8 callers → exactly 3 admitted  
   
If the constraint is doing the work, you have the naive bug and **will** fail the live test. Fix the  
   
 lock; do not "fix" the harness.  
**5.5 P4 · Killer Tests 1 and 2 — 25 minutes**  
KT-1 verified on **two dates**: an October date (PDT, UTC−7 → 20:30)  **and** a standard-time date  
   
 (PST, UTC−8 → 19:30). A test that asserts one and not the other is a test that will fail on the day it  
   
 is run. KT-2 verified in **both directions** with differing adjacent buffers.  
**5.6 P5–P6 · UI and differentiator — optional, 30 minutes**  
These are the first casualties. Do not start either until P4's gate is green. **D3 (Clash Sentinel) is**  
 **  
 the only differentiator worth attempting** — it is the one the original structurally cannot do. It must  
   
 sit behind ENABLE_CLASH_SENTINEL so the core still passes with it off.  
**There is no deployment.** "Deploy" here means: the app starts on the demo laptop, with  
   
 .env copied from .env.example, no key set, in one command. Rehearse that once, cold.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3OMQ0AIAwAwZIgBKnVgjN8dGDBABMhuZt+/JaZIyJmAADwi9VP1NMNAABu1AaU3AUhiyfJeAAAAABJRU5ErkJggg==)  
**6 · COMMIT AND PUSH PROTOCOL**  
**6.1 Branches**  
| | | |  
|-|-|-|  
| **Branch** | **Owner** | **Rule** |   
| main | Integrator | merged into only by the Integrator, at the merge windows below |   
| feat/engine | A | A only |   
| feat/claim | B | B only |   
| feat/api-ui | C | C only |   
| feat/tests | D | D only |   
   
**Never commit to ** **main** ** directly.** In a 2 h 45 m sprint one broken main is unrecoverable, because  
   
 there is no time to bisect it.  
**6.2 When to commit**  
Commit **when a small thing becomes true**, in this rhythm:  
- One logical unit that works — a function with its test, one route, one migration — is one commit.  
- **Every commit must leave the repo compilable.**npx tsc --noEmit before you commit. A commit that  
   
 breaks the type check blocks your colleague's next pull.  
- Commit the test with the code it tests, in the same commit. A test added later is a test that was not  
   
 driving the design.  
- Never commit a broken gate "to save time". The time saved is paid back with interest at 12:20.  
**Target: 5–15 commits per person over the sprint.** Fewer means you are batching risk; more means you  
   
 are committing trivia.  
**6.3 How to write a commit message**  
<area>: <what changed, imperative>  
   
 WHY: <the reason, one line>  
   
Areas: engine, claim, schema, api, ui, tests, chore.  
claim: serialise the slot claim with an advisory lock  
   
 WHY: insert-if-not-exists admitted 4 of 20 concurrent claims; the  
      count subquery is a snapshot read under READ COMMITTED.  
   
The **WHY** line is not decoration. Your push times and messages are read as evidence that you knew  
   
 what you were doing. "fix" and "wip" are evidence of the opposite.  
**6.4 When to push**  
| | |  
|-|-|  
| **Push** | **When** |   
| your branch | the moment a gate passes — not on a timer, not at the end |   
| your branch | before you go quiet for more than 15 minutes (protects your work) |   
| main | **only** at the merge windows, and only by the Integrator |   
   
**Merge windows: 10:50, 11:25, 11:50, 12:20.** Four merges, no more. Between them main is stable and  
   
 deployable. Do not merge continuously — a main that is broken at 12:20 has no recovery.  
Across a merge: the Integrator pulls main, merges each feat/*, runs the **§8.2 gate**, and pushes.  
   
 **If the gate fails, the merge is reverted and the owner is told.** That is not a punishment; it is the  
   
 only way four people share one repo under a freeze.  
**6.5 The freeze is one-way**  
- **12:30 is a wall.** No push after, for any reason — not a typo fix, not a README comma.  
- **docs/** ** is already frozen** (08:30). Do not touch it. If the code must diverge from a frozen doc,  
   
 the divergence is recorded in the **deck** (which is not under the docs freeze) before 12:30 — see §10.3.  
- After 12:30 the repo is read-only by convention. Anything discovered after that is mentioned **in the**  
 **  
 demo, out loud**, never pushed.  
**6.6 Rollback — there is no staging, so this is it**  
1. **Tag before the last risky change:**git tag -a freeze-candidate -m "gate green" then push the tag.  
   
 A tag is your only safety net once pushing stops.  
2. **To undo a merge:**git revert -m 1 <merge-sha> on main, run the gate, push. Never  
 git reset --hard on a shared branch.  
3. **To undo a bad commit on your branch:**git revert <sha> — not a force-push. A force-push  
   
 destroys the push-time evidence the judges may look at.  
4. **If ** **main** ** is broken at 12:20:** revert to the last tagged commit, run the gate, push. Twelve  
   
 working features and a repo that starts beats twenty features and a repo that does not.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAM0lEQVR4nO3OUQmAQBBAwSdcjsu6HYxoDsEK/okwk2COmdnVGQAAf3GtalX76wkAAK/dDxFWBDkFf6+SAAAAAElFTkSuQmCC)  
**7 · COLLABORATION**  
**7.1 Stand-ups — at the merge windows**  
No new tooling. Four stand-ups, at **10:50, 11:25, 11:50, 12:20**, immediately before each merge.  
   
 Each is **90 seconds per person**, answering exactly three things:  
1. **Green:** what passed since the last window.  
2. **Red:** what is blocking me, and who I need.  
3. **Next:** what I will have green by the next window.  
Write the "next" line in the team chat. A promise in writing is what makes the next window's stand-up  
   
 measurable.  
**7.2 Code review — lightweight but real**  
Full review does not fit a 2 h 45 m sprint. The rule is:  
- **Every merge to ** **main** ** is reviewed by the Integrator**, against the §8.2 gate — not by re-reading  
   
 every line. The gate is the review.  
- **Any change to a shared interface** (A's getSlots signature, B's claim signature, C's route  
   
 shapes) is reviewed by the **consumer** before it lands. Breaking a colleague's caller silently is  
   
 the one merge mistake that costs an hour.  
- **A test change is reviewed by the code's owner.** Tests are code; D does not get to weaken a test to  
   
 make a merge pass. If D and B disagree about whether a test is fair, the Integrator decides, and the  
   
 default is **the test stands**.  
- **Nobody reviews their own work into ** **main** **.** That is the Integrator's job, and the Integrator did  
   
 not write the subsystem being merged.  
**Review criteria, in order:** does the gate pass → does it match the frozen contract in §4 → is it  
   
 copied from the original (C1) → is anything hard-coded (X2, X3).  
**7.3 Documentation — what to write and where**  
docs/ is frozen, so **code documentation lives in the code**:  
- Every non-obvious decision gets a comment explaining **why**, not what:  
 // lock on (host, day), not slot start: overlapping-but-different intervals must serialise.  
- Every module gets a one-line header saying what it owns and what it must not do.  
- **docs/AGENT_LOG.md** ** cannot receive the gate output** — it is frozen. Put the gate output in the  
   
 repo root as GATE-OUTPUT.txt (a new file is not a docs/ edit) or paste it in the team chat.  
- The deck is the one remaining document you may change before 12:30. See §10.3.  
**7.4 Blockers — the escalation ladder**  
| | |  
|-|-|  
| **Time blocked** | **Action** |   
| 5 min | Try one different approach. |   
| 10 min | **Say it out loud in the team channel.** This is the rule most often broken and the most expensive. |   
| 15 min | Name the owner who can unblock you and ask them directly. |   
| 20 min | **The Integrator decides**: work around it, cut the feature, or reassign. Do not spend 40 minutes on a 10-minute problem. |   
   
In a sprint this short, a blocker nobody hears about is a blocker that kills the submission.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsSeYxZw/lVeDGMACBrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA6fOBdd+dKAKAAAAAElFTkSuQmCC)  
**8 · QUALITY STANDARDS**  
**8.1 The metrics**  
| | | |  
|-|-|-|  
| **Metric** | **Target** | **Why** |   
| Type check | npx tsc --noEmit → **0 errors** | a type error in claim.ts is an unverifiable guarantee |   
| Lint | 0 errors (warnings tolerated) | not worth a minute more than that |   
| Tests | the 4 Killer Tests + the negative control **green** | these are the event |   
| Coverage | **no global target** — deliberately | a coverage number in a 3-hour sprint is vanity. The Killer Tests are the coverage that matters. |   
| Perf budget | GET /api/slots over a 31-day range < **500 ms** on the demo laptop | a judge will not wait longer |   
| Determinism | KT-3 green on **5 consecutive runs** | a single pass can be a lucky schedule |   
| Clean-room | grep -r "@calcom" src/ package.json → 0 | C2 |   
| Configurability | HOLD_TTL_MINUTES=1 visibly changes behaviour | X2 |   
| AI-off | app runs fully with OPENAI_API_KEY empty | X1 |   
   
**8.2 The gate — run before every push to **main  
tests/gate.sh (D owns it) must run all of this and exit non-zero on any failure.  
#!/usr/bin/env bash  
 set -e  
 echo "1. typecheck";        npx tsc --noEmit  
 echo "2. fresh install";    rm -rf node_modules && npm ci  
 echo "3. database";         docker compose up -d db && npm run db:migrate && npm run db:seed  
 echo "4. server";           npm run dev & sleep 6  
 echo "5. health";           curl -sf localhost:3000/api/health  
 echo "6. KT-1 zones";       curl -sf "localhost:3000/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=America/Los_Angeles"  
 echo "7. KT-2 buffers";     npm run test:killer -- --test=kt2  
 echo "8. KT-3 concurrency"; npm run test:concurrency     # constraint DISABLED  
 echo "9. KT-3b capacity";   npm run test:killer -- --test=kt3b  
 echo "10. AI off";          kill %1; OPENAI_API_KEY= npm run dev & sleep 6; curl -sf localhost:3000/api/slots?hostId=7\&serviceId=3\&from=2026-10-15\&to=2026-10-15\&tz=Asia/Kolkata  
 echo "11. clean room";      ! grep -rq "@calcom" src/ package.json  
 echo "12. configurable";    grep -q HOLD_TTL_MINUTES .env.example  
 echo "GATE: ALL GREEN"  
   
**Rule:** a gate that has never failed is not a gate. Before trusting step 8, watch it fail with the  
   
 constraint on — that is the point of the negative control.  
**8.3 The acceptance criteria mapping**  
Every criterion in docs/PRD.md §7 must have an owner and a test. Unmapped criteria are unbuilt  
   
 criteria.  
| | | |  
|-|-|-|  
| **Criterion** | **Owner** | **Test** |   
| KT-1 IST/PST identical instants | A | kt1, two dates |   
| KT-2 buffer both directions | A | kt2 |   
| KT-3 exactly one winner | B | concurrency + negative control |   
| KT-3b 3-station lab admits 3 | B | kt3b |   
| AC-A override replaces a date | A | kt.../override |   
| AC-B holiday removes a day | A | kt.../holiday |   
| AC-C student's own clash excluded | A (engine) + D3 | intel/clashes |   
| AC-D ownership enforced (404, no leak) | C | api/ownership |   
| AC-E runs with no AI key | C | gate step 10 |   
| AC-F windows configurable | C | gate step 12 |   
   
**8.4 The Doc Test — simulate it**  
The event includes a **Doc Test**: a fresh agent must build from docs/ alone. Your docs were written  
   
 for that and are frozen. Simulate it cheaply: give the docs to someone (or a fresh agent) who has not  
   
 seen the code and ask them for the **run command** and the  **POST /api/bookings** ** status codes**. If  
   
 they cannot produce both, the docs have a gap — and it is now too late to fix it, so it goes in the  
   
 demo as a known limitation.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OQQmAABRAsSd4NIGRTPXNaQBrWMGbCFuCLTOzV2cAAPzFvVZbdXw9AQDgtesBhZQEOYZGgUEAAAAASUVORK5CYII=)  
**9 · TOOLS AND ENVIRONMENT**  
**9.1 The stack, exactly as declared in **SUBMISSION.md  
TypeScript (strict) · Fastify · Prisma + @prisma/client · PostgreSQL **16** · luxon · zod · dotenv ·  
   
 React + Vite · vitest · supertest · openai (optional, never on the core path).  
**If you add a library not on this list, you must add it to ** **SUBMISSION.md** ** first** — an undeclared  
   
 dependency contradicts a frozen root document.  
**9.2 Environment**  
cp .env.example .env          # AI keys stay EMPTY — X1  
 docker compose up -d db       # service name MUST be "db"; Postgres 16  
 npm ci  
 npm run db:migrate && npm run db:seed  
 npm run dev                   # http://localhost:3000  
   
Database: meridian / user meridian / password meridian / port 5432 — matching  
   
 .env.example's DATABASE_URL. Test database: meridian_test, via TEST_DATABASE_URL.  
**Reset the database whenever a migration changes:**  
docker compose down -v && docker compose up -d db && npm run db:migrate && npm run db:seed  
   
**9.3 Hardening the harness**  
tests/concurrency/ must fire genuinely-concurrent requests, not sequential ones. Use a barrier, as  
   
 the reference measurement did: N callers released from the same instant. CONCURRENCY_CALLERS and  
   
 CONCURRENCY_RUNS come from .env.  
**9.4 The demo laptop, cold**  
Rehearse once, cold, on the machine you will demo from:  
git clone <repo> && cd meridian && cp .env.example .env  
 docker compose up -d db && npm ci && npm run db:migrate && npm run db:seed && npm run dev  
   
Anything that is not in that sequence is not part of your demo. **Note:** the validation Postgres used  
   
 during design was a local container; your docker-compose.yml should pin **Postgres 16** so the  
   
 environment that produced the race numbers is the environment the judge runs.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsSfYxZo/jVEMYQLPJrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA4rLBc059ysnAAAAAElFTkSuQmCC)  
**10 · KNOWN TRAPS AND COUNTERMEASURES**  
Every one of these was found by execution, not by reading. They are listed because they are the  
   
 failures that look like success.  
| | | | |  
|-|-|-|-|  
| **#** | **Trap** | **What it looks like** | **Countermeasure** |   
| T1 | **INSERT … WHERE NOT EXISTS** ** is not atomic** | capacity-1 tests look perfect | transaction-scoped pg_advisory_xact_lock(host, day); measured 4/20 without it |   
| T2 | **The constraint masks T1** | the race test passes | run KT-3 with the constraint **disabled** |   
| T3 | **Capacity slots break invisibly** | 8 admitted into 3 places | the resources_needed = 1 predicate; test KT-3b at capacity 3 |   
| T4 | **tsrange** ** does not accept ** **timestamptz** | the migration refuses to run | use **tstzrange** for the generated column |   
| T5 | **Adding the constraint to dirty data fails** | ExclusionViolation on migrate | the guard migration asserts no overlaps first (docs/DATA_MODEL.md §9) |   
| T6 | **Buffers as a post-filter** | most slots correct, some wrong | inflate intervals at stage 5; max of adjacent buffers |   
| T7 | **"PST" in October is PDT** | a hard-coded 19:30 assertion fails | assert instant identity + offset for the date; 20:30 in October |   
| T8 | **A hand-written offset** | works today, breaks on a DST boundary | one zones.ts; grep for +05:30, -07:00, 3600 before pushing |   
| T9 | **PENDING bookings invisible** | a second student takes the slot | treat any non-cancelled booking as busy (allowlist, X5) |   
| T10 | **A retried request books twice** | the lock is correct, yet there is a duplicate | Idempotency-Key + idempotencyKey @unique |   
   
**10.3 Reconcile the deck with reality — the one document you may still change**  
deck.pdf was written **before the code existed** and asserts things the build must now deliver. It is  
   
 a root file, not docs/, so it is **not under the 08:30 freeze** — it may be amended before 12:30.  
Check each claim against what actually runs, and pick one of three honest actions: **build it, cut it,**  
 **  
 or state the deviation out loud in the demo.**  
| | |  
|-|-|  
| **Deck claim** | **Safe?** |   
| Slide 3: the race numbers 20 / 4 / 8 / 1 | **Already verified** — reproduced on PostgreSQL 16.15. Safe as written. |   
| Slide 2: the ten-stage pipeline, KTs enforced at those stages | Safe only if the engine implements the stages as drawn |   
| Slide 4: D1–D4 exist in the app | **Highest risk.** If only D3 is built, say D3 — do not show four |   
| Slide 5: the verification table "all pass" | Safe only after the §8.2 gate is green on the frozen commit |   
   
**The rule from the playbook, verbatim: a past-tense claim about unbuilt work is the exact thing that**  
 **  
 discredits the true claims.** Slide 3 is true; do not let slide 4 make a reviewer doubt it.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OMQ2AABAAsSPBCj5fFyM6mJHAjAU2QtIq6DIzW7UHAMBfnGt1V8fXEwAAXrsexOEF35f1aEgAAAAASUVORK5CYII=)  
**11 · THE DEMO AND JUDGE Q&A**  
**11.1 Demo order — 3 minutes**  
1. **The problem, in one sentence.** 200 students, 15 supervisors, 5 labs, spreadsheets.  
2. **KT-1 live:** two curl calls, same instants, one IST and one PST. Say the PDT trap out loud — it shows you did the arithmetic.  
3. **KT-2 live:** the buffer window is empty.  
4. **KT-3 live:** the harness.  **Show the negative control first** (20 rows for the naive path), then yours (1). This is the strongest 60 seconds you have.  
5. **D3, if built:** a student with a clash is not offered that slot.  
6. **One honest limitation.** Volunteering it makes everything else more credible.  
**11.2 The questions you will be asked, and the correct answers**  
| | |  
|-|-|  
| **Question** | **Answer** |   
| "Why not a simple WHERE NOT EXISTS insert?" | "It's not atomic. We measured it: 4 of 20 concurrent claims landed. Under READ COMMITTED the subquery is a snapshot read — only a *committed* competitor is visible. We use a transaction-scoped advisory lock." |   
| "Isn't a database constraint enough?" | "It's the backstop, not the guarantee — and a blanket one breaks lab capacity. Upstream has an open issue about legitimate overlaps, #21467. We scope it with resources_needed = 1." |   
| "What if the AI key is missing?" | "The app runs fully. The concierge returns constraints, never slots, and every candidate is re-validated by the same engine. D2–D4 are pure computation." |   
| "Did you copy Cal.com?" | "No. We read it and its issue tracker; no code was copied and no @calcom package is installed. Every claim about it in docs/OBSERVATIONS.md is a repo-relative path:line you can open." |   
| "Which of these are your own findings?" | "The claim race and the capacity regression — and upstream's #29605, #29958, #29967 are open on exactly that. The measurement is ours; the problem is theirs." |   
| "What did you not build?" | Voluntarily: calendar sync, email delivery, and any differentiator beyond what you actually shipped. docs/PRD.md §6 records the exclusions. |   
| "Show me the timezone code." | Point at zones.ts and state that there is **no offset constant anywhere in the codebase** — that is the answer they are testing for. |   
   
**11.3 The one thing to make them remember**  
**That the obvious fix is broken, and you have the number that proves your version is not.** Almost  
   
 nobody at this event will have a measurement for their own correctness. That is your submission.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OYQ1AABSAwc8mi5wvlAB6CKCAACr4Z7a7BLfMzFYdAQDwF+da3dX+9QQAgNeuB6fWBdZMUxZ2AAAAAElFTkSuQmCC)  
**12 · THE CUT LINE**  
Decided now, at 09:45, by the Integrator, **not** at 12:10 in a panic.  
**12.1 Cut order**  
| | | |  
|-|-|-|  
| **Cut** | **What goes** | **Cost** |   
| 1st | **UI** | Judges can use curl; the API is the deliverable |   
| 2nd | **D2 allocator, D4 suggest** | no Killer Test depends on them |   
| 3rd | **D1 concierge** | keep D3; the AI story weakens, the differentiator survives |   
| 4th | **/api/admin/demand** **, ** **/api/intel/*** ** entirely** | the differentiator becomes "absent", stated honestly |   
| 5th | **KT-3b capacity** | painful — it is the case a blanket constraint breaks |   
| **Never** | **KT-1, KT-2, KT-3** | these are the event. The card says it outright: a differentiator never replaces the hard core. |   
   
**12.2 The minimum viable submission**  
All four must be true. If any is false, nothing else matters.  
1. A fresh clone runs via the README's commands **with no API key**.  
2. GET /api/slots returns correct slots for an IST host / PST booker, and respects a buffer.  
3. POST /api/bookings yields **exactly one**201 under concurrency, provably, with the constraint off.  
4. Nothing copied, no @calcom, nothing pushed after 12:30.  
**Three endpoints and a lock is a passing submission.** A beautiful UI on a broken lock is not.  
**12.3 Emergency mode — trigger at 11:25 if KT-3 is not green**  
1. **Freeze all other work.** Everyone who is not B stops feature work and starts helping.  
2. D reproduces the failure with the constraint **off** and hands B the exact failing case.  
3. C keeps only /api/slots and /api/bookings; delete nothing, just stop extending.  
4. A hands over any engine work B needs for the slot path.  
5. The Integrator cuts every optional item and re-runs the gate every 10 minutes.  
6. **At 12:10, whatever is green is what ships.** Not one minute later.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsSfYxZo/jzlMYQLPJrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA4q7Bc870TqdAAAAAElFTkSuQmCC)  
**13 · APPENDICES**  
**13.1 File ownership map — the single rule that prevents merge wars**  
| | |  
|-|-|  
| **Path** | **Owner** |   
| src/engine/** | A |   
| src/booking/**, src/db/**, prisma/** | B |   
| src/routes/**, web/**, package.json, tsconfig.json | C |   
| tests/**, docker-compose.yml | D |   
| main merges | Integrator |   
| docs/**, README.md, SUBMISSION.md, .env.example | **frozen — nobody** |   
| deck.pdf | Integrator only, before 12:30, per §10.3 |   
   
**13.2 Per-role checklist for the first 20 minutes**  
**A** — open docs/ARCHITECTURE.md §3 at the ten stages · create the five engine files with real signatures · write the KT-1 failing test with a real zone library · tell C the exact getSlots signature.  
**B** — open docs/DATA_MODEL.md §2 · transcribe the schema verbatim · migrate · write seed.ts to produce exactly §4.2 (host 7, service 3, 2026-10-15 availability, 5 labs at 20/24/24/30/12) · tell C the exact claim signature.  
**C** — open docs/API.md §3 · write package.json with every script the README promises · tsconfig strict · /api/health returning 200 · .gitignore with node_modules and .env · then the /api/slots route against a stub.  
**D** — docker-compose.yml, service db, Postgres 16, matching DATABASE_URL · get it up so B is not blocked · then the concurrency harness skeleton with a barrier · then the negative control.  
**Integrator** — create the four branches · add teammates · confirm each can push · post the clock (P1 10:05, P2 10:50, P3 11:25, P4 11:50, freeze 12:30) in the team channel.  
**13.3 Glossary**  
| | |  
|-|-|  
| **Term** | **Meaning** |   
| **KT-1/2/3** | the card's three Killer Tests: zones, buffers, exactly-one-winner |   
| **KT-3b** | our extra: a 3-station lab admits exactly 3 |   
| **AC-A…F** | the additional acceptance criteria in docs/PRD.md §7 |   
| **D1–D4** | the differentiator features: concierge, allocator, clash sentinel, suggest |   
| **the claim** | src/booking/claim.ts — the atomic booking operation |   
| **inflate** | growing a busy interval by its buffers, as opposed to filtering slots |   
| **the gate** | tests/gate.sh, §8.2 — the 12 checks before any merge |   
| **merge window** | 10:50 / 11:25 / 11:50 / 12:20 — the only times main changes |   
| **hard floor** | the minimum viable submission, §12.2 |   
| **frozen** | may not be changed again; docs/ since 08:30, everything at 12:30 |   
   
**13.4 The one-page summary**  
***Build the engine, build the lock, prove the lock, freeze.***  
 *  
 Three endpoints that work are worth more than thirty that nearly do.*  
 *  
 Write the failing test before the code. Run the concurrency test with the constraint off.*  
 *  
 Never claim what does not run. Nothing pushed after 12:30.*  
