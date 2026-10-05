# AGENT_LOG — how these docs were produced

**Purpose.** The Brief asks for the reasoning, not just the output: which stages ran, what the agent was asked, what it produced, what was wrong, and what a human changed. Corrections are the most valuable part of this file, so they are listed in full rather than summarised away.

**Artifact:** the seven files in this directory. **Original studied:** `calcom/cal.diy` at `54343aa`. **Base rule:** every claim about the original is a repo-relative `path:line` or an upstream issue number, and was resolved before being kept.

---

## 1. Stages run

| Stage | Task | Input | Output | Where |
|---|---|---|---|---|
| 0 | Orient on the original | `cal.diy` clone | Size, stack, entry points; 7,702 tracked files, 1.4 GB working tree | `OBSERVATIONS.md` §D |
| 1 | Recon the Brief | Card text, the original's README | The hard core named and separated from everything else | `PRD.md` §5 |
| 2 | Map the domain | Prisma schema | Four scheduling entities plus three supporting ones, and three dead enterprise models | `DATA_MODEL.md` §1–2 |
| 3 | Trace the flow | The card's hard core | Working hours − busy − buffers − overrides → slots → claim | `ARCHITECTURE.md` §3 |
| 4 | Read the data model | `packages/prisma/schema.prisma` | The dual-row override design; the `days` array; the missing interval constraint | `OBSERVATIONS.md` §A4, §D |
| 5 | Trace the Killer Tests' paths | The three Killer Tests | The engine files, the buffer mechanism, the claim race | `OBSERVATIONS.md` §A, §B |
| 6 | Find what is missing | Whole tree + upstream issues | 16 gaps; six capabilities the original does not have | `GAPS.md` |
| 7 | Design the rebuild | Stages 1–6 | Engine, three-layer claim, intelligence layer | `ARCHITECTURE.md`, `DATA_MODEL.md`, `API.md` |
| 8 | Evidence pass | Every claim | **202 citation lines resolving across 24 files**, all repo-relative, each tagged | `OBSERVATIONS.md` |
| 9 | Write the seven docs | Stages 0–8 | This directory | — |
| 10 | **Verification by execution** | The design itself | The claim race found and fixed; DDL corrected | `ARCHITECTURE.md` §4.2–4.3 |

**Stage 10 did not exist in the plan.** It was added after Stage 7 produced a design that looked correct on paper and failed when run. What follows is what that stage found.

---

## 2. The verification pass (Stage 10), in full

The instruction was to be certain, and to prefer a measured number to an argument. That led to building the negative control first — a test that *should* fail if the design is wrong — rather than a happy-path test that would pass regardless.

**Environment:** PostgreSQL 16.15 in Docker, 20–40 threads released from a common `threading.Barrier`, `psycopg` 3.3.6.

| # | Question asked | What was observed | Consequence |
|---|---|---|---|
| 1 | Does the generated-column DDL compile? | **No.** `function tsrange(timestamp with time zone, timestamp with time zone) does not exist` | DDL corrected to `tstzrange`. Would have shipped broken. |
| 2 | Does the naive path actually double-book? | **20 rows for one slot** | The defect is real, and the harness demonstrably detects it |
| 3 | Is insert-if-not-exists atomic on its own? | **4 rows out of 20** | No — the whole concurrency design was rewritten |
| 4 | Was the constraint doing the work? | With the constraint: 1 row | **Yes.** The first design passed only because of the backstop |
| 5 | Is capacity broken too? | **8 admitted into 3 places** | The failure is worse than a double-booking and invisible to a capacity-1 test |
| 6 | Does a transaction-scoped advisory lock fix it? | exactly 1, and exactly 3 for capacity | The corrected design |
| 7 | Is it stable, or lucky? | 5 consecutive runs at 40 threads: 1,1,1,1,1 | Stable |
| 8 | Does the DB catch a bypassing insert? | `ExclusionViolation`, row count unchanged | The backstop layer is real |
| 9 | Does a cancellation free the slot? | Yes | The `status <> 'CANCELLED'` predicate works |
| 10 | Is the time-zone arithmetic right? | 09:00 IST = **20:30** the previous day in `America/Los_Angeles` on an October date, not 19:30 | KT-1 rewritten to assert instant-identity, and the trap documented |

**Findings 3, 4 and 5 changed the design.** Finding 10 changed a Killer Test. Neither was visible from reading code.

---

## 3. Corrections

Every place the first pass was wrong, what it said, what it says now, and how it was caught.

| # | First pass said | Now says | Caught by |
|---|---|---|---|
| 1 | Buffers are a property of the weekly schedule | Buffers are `EventType` fields; busy intervals are inflated by them | Reading `packages/prisma/schema.prisma:220-221` after the claim failed to match the code |
| 2 | `Availability.dayOfWeek` (scalar int) | `days Int[]` — an array | Re-reading the model at `:966` |
| 3 | `Availability.dateOverride` | `date` (`@db.Date`); the override is a *second row* with `date` set | `packages/features/schedules/lib/date-ranges.ts:11-12` distinguishes the two shapes explicitly |
| 4 | Working times stored as `DateTime` | Stored as database `Time` | `packages/prisma/schema.prisma:967-968` |
| 5 | "There is no concurrency mechanism in the original" | A `SelectedSlots` soft hold exists, is keyed so it cannot block a second visitor, and is never read on the booking path | `grep -rn 'SelectedSlot' packages/features/bookings/` → 0 matches |
| 6 | "A single insert-if-not-exists statement is atomic" | It is not; under `READ COMMITTED` it admitted 4 of 20 | Executed it |
| 7 | `tsrange` for the generated interval column | `tstzrange` — `tsrange` does not accept `timestamptz` | Executed the DDL |
| 8 | A blanket exclusion constraint on `(host_id, time_range)` | Scoped with `resources_needed = 1`, or lab capacity breaks | Executed the capacity case |
| 9 | Acceptance criterion asserted New York / London | The card specifies **IST** and **PST** | Re-reading the card |
| 10 | KT-1 asserted "09:00–17:00 IST = 19:30–03:30" | Assert instant-identity and the offset difference for the date; 20:30 is correct in October because the zone is on PDT | Computing it with a real zone database and getting 20:30 |
| 11 | Evidence citations were machine-local absolute links | All repo-relative | A path valid on one laptop is not evidence to a judge |
| 12 | Repo-wide negatives cited to one file | Each carries the command used to establish it | A single file cannot prove a negative |
| 13 | `GAPS.md` listed gaps with no improvement attached | Part 1 states the two required improvements explicitly: one **fix**, one **differentiator** | Re-reading the Brief's scoring rule |
| 14 | No differentiator existed anywhere in the docs | Four, labelled D1–D4, each mapped to a gap and to a user | `grep -i differentiator` returned nothing |

**Corrections 6, 7, 8 and 10 are the ones a reader should look at first.** Three were found only by running code, and one by doing arithmetic with a real zone database instead of assuming.

---

## 4. Tools used

| Tool | Used for |
|---|---|
| `git ls-files`, `grep -rn`, `sed -n` on the clone | Every claim about the original |
| GitHub REST issue search on `calcom/cal.diy` | Upstream corroboration: `#29605`, `#29958`, `#29967`, `#6084`, `#8918`, `#21467`, `#5779`, `#13140` |
| Docker + PostgreSQL 16.15 | Executing the DDL and the concurrency harness |
| `psycopg` 3.3.6 + `threading.Barrier` | Genuine concurrent contention, not sequential calls |
| A citation resolver | Every `path:line` checked to exist, be in range, be non-empty, and say what is claimed |

**No LLM was used to produce any claim about the original.** Every one is a file, a line, or an issue number that a reader can open.

---

## 5. What was deliberately not done

- **The original was not executed.** Its own value is in the engine's logic, and running a 1.4 GB monorepo with PostgreSQL and a full install would have consumed the time budget that Stage 10 needed. The cost of this choice is stated plainly: the concurrency defect is proved from code structure and reproduced independently against our own schema, not observed live in the original.
- **Enterprise surfaces were not audited.** Teams, organisations, billing and SSO are out of the Brief. Findings there would be padding.
- **No claim was kept that could not be resolved.** Citations that would not resolve were deleted rather than softened.

---

## 6. Handover

- **If you are a person:** start at `PRD.md` §1 for the problem, `ARCHITECTURE.md` §4 for the part that is hardest to get right, and `GAPS.md` Part 1 for what we claim. `OBSERVATIONS.md` is the evidence base.
- **If you are an agent building from these docs:** `ARCHITECTURE.md` §2 gives the module map and the single-writer rule; `DATA_MODEL.md` §2 is a complete Prisma schema; `API.md` §4 defines the response codes that the third Killer Test is judged on. Build in the order in `ARCHITECTURE.md` §3 — the engine first, the claim second, the intelligence layer last, because the intelligence layer may be cut and the other two may not.
