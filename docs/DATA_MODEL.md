# DATA MODEL — Meridian

**Database:** PostgreSQL 15+ (developed and validated on 16.15). **Access:** Prisma. **Naming:** camelCase in Prisma, snake_case in the database.

**Everything below is buildable as written.** The Prisma schema is complete; the constraints that carry the Killer Tests are given as raw SQL because two of them are PostgreSQL features Prisma cannot express, and the third was validated by execution rather than assumption.

---

## 1. Entity map

```
Term ──┬── AvailabilityRule (holidays live here too)
       └── Allocation ──> Booking

User ──┬── (FACULTY) ──> ServiceType ──> Booking
       ├── (STUDENT) ──> Booking
       ├── (STUDENT) ──> StudentCommitment      # the student's own timetable  (D3)
       └── (STUDENT) ──> Hold

Resource ─────────────> ServiceType ──> Booking   # labs/rooms: a bookable NON-person

Booking ──┬── slot_start, slot_end, status, resources_needed
          └── time_range  (GENERATED, tstzrange)  # the exclusion constraint's key
```

**The central modelling decision.** In the original, availability always derives from a `User` or an `EventType` — there is no bookable non-person (`packages/prisma/schema.prisma:963, :965`). Meridian introduces `Resource` as a first-class bookable entity, because the Brief says "laboratory slots", and a lab is a room with a station count, not a person. A `ServiceType` can be hosted by a user, bound to a resource, or both — which is how "office hours with Prof. Rao" and "3 stations in Lab B" become the same engine.

## 2. Prisma schema

```prisma
// ---------------------------------------------------------------- enums
enum Role          { STUDENT FACULTY ADMIN }
enum AvailabilityKind { WEEKLY DATE HOLIDAY }   // one table, three meanings
enum ResourceKind  { LAB ROOM }
enum BookingStatus { RESERVED CONFIRMED CANCELLED COMPLETED NO_SHOW }

// ---------------------------------------------------------------- people & places
model User {
  id            Int      @id @default(autoincrement())
  email         String   @unique
  name          String
  role          Role     @default(STUDENT)
  timeZone      String   @default("Asia/Kolkata")   // IANA name, never an offset
  createdAt     DateTime @default(now())

  availability  AvailabilityRule[] @relation("OwnerUser")
  hosted        ServiceType[]      @relation("Host")
  bookings      Booking[]          @relation("StudentBookings")
  commitments   StudentCommitment[]
  holds         Hold[]
  ownedResources Resource[]        @relation("ResourceOwner")

  @@index([role])
}

model Resource {
  id            Int          @id @default(autoincrement())
  name          String
  kind          ResourceKind @default(LAB)
  capacity      Int          @default(1)            // stations; the KT-3b dimension
  ownerId       Int?
  owner         User?        @relation("ResourceOwner", fields: [ownerId], references: [id])
  timeZone      String       @default("Asia/Kolkata")
  active        Boolean      @default(true)

  availability  AvailabilityRule[] @relation("OwnerResource")
  services      ServiceType[]      @relation("ServiceResource")
  bookings      Booking[]          @relation("BookingResource")

  @@index([kind, active])
}

// ---------------------------------------------------------------- term calendar
model Term {
  id           Int      @id @default(autoincrement())
  name         String
  startsOn     DateTime @db.Date
  endsOn       DateTime @db.Date
  timeZone     String   @default("Asia/Kolkata")
  @@index([startsOn, endsOn])
}

/// ONE table models recurring hours, one-off date overrides AND term holidays.
/// This mirrors the original's dual-row design (packages/features/schedules/lib/date-ranges.ts:11-12)
/// but makes the kind explicit instead of inferring it from which column is non-null.
model AvailabilityRule {
  id         Int              @id @default(autoincrement())
  kind       AvailabilityKind
  ownerUserId   Int?
  ownerUser     User?   @relation("OwnerUser",     fields: [ownerUserId],  references: [id], onDelete: Cascade)
  ownerResourceId Int?
  ownerResource Resource? @relation("OwnerResource", fields: [ownerResourceId], references: [id], onDelete: Cascade)
  termId     Int?
  days       Int[]            // WEEKLY only: 0=Sun..6=Sat, matching JS getDay()
  date       DateTime? @db.Date   // DATE and HOLIDAY only
  startTime  DateTime @db.Time     // database TIME, not a timestamp
  endTime    DateTime @db.Time
  note       String?

  @@index([ownerUserId, kind])
  @@index([ownerResourceId, kind])
  @@index([date])
}

// ---------------------------------------------------------------- what can be booked
model ServiceType {
  id             Int     @id @default(autoincrement())
  name           String                       // "Office hours", "Lab B — Tue session"
  durationMins   Int     @default(30)
  beforeBuffer   Int     @default(0)          // minutes; see ARCHITECTURE.md stage 5
  afterBuffer    Int     @default(0)
  minNoticeMins  Int     @default(0)
  seatsPerSlot   Int     @default(1)          // 1 for a person; = resource capacity for a lab
  hostId         Int?
  host           User?     @relation("Host", fields: [hostId], references: [id])
  resourceId     Int?
  resource       Resource? @relation("ServiceResource", fields: [resourceId], references: [id])
  active         Boolean @default(true)

  bookings       Booking[]
  @@index([hostId, active])
  @@index([resourceId, active])
}

// ---------------------------------------------------------------- the bookings
model Booking {
  id             Int           @id @default(autoincrement())
  serviceTypeId  Int
  serviceType    ServiceType   @relation(fields: [serviceTypeId], references: [id])
  hostId         Int?                            // denormalised for the constraint
  resourceId     Int?                            // denormalised for the constraint
  studentId      Int
  student        User          @relation("StudentBookings", fields: [studentId], references: [id])
  slotStart      DateTime      @db.Timestamptz
  slotEnd        DateTime      @db.Timestamptz
  status         BookingStatus @default(RESERVED)
  resourcesNeeded Int          @default(1)       // the constraint's predicate key
  idempotencyKey String?       @unique
  note           String?
  createdAt      DateTime      @default(now())
  cancelledAt    DateTime?

  @@index([hostId, slotStart])
  @@index([resourceId, slotStart])
  @@index([studentId, slotStart])
  @@index([status])
}
```

## 3. Constraints — the part that carries the Killer Tests

These three statements are **not** optional decoration; each one is load-bearing for a specific acceptance criterion. All three were executed against PostgreSQL 16.15 during design.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

### 3.1 The overlap backstop — KT-3

```sql
-- MUST be tstzrange, NOT tsrange: tsrange(timestamptz, timestamptz) does not exist and
-- PostgreSQL rejects the DDL outright. Verified by execution.
ALTER TABLE bookings ADD COLUMN time_range tstzrange
  GENERATED ALWAYS AS (tstzrange(slot_start, slot_end)) STORED;

ALTER TABLE bookings ADD CONSTRAINT no_host_overlap
  EXCLUDE USING gist (host_id WITH =, time_range WITH &&)
  WHERE (status <> 'CANCELLED' AND resources_needed = 1);
```

- `resources_needed = 1` keeps multi-station lab slots out of the constraint's scope. **Removing this predicate silently breaks KT-3b** — a 3-station lab could then hold only one booking. The predicate is the whole reason the constraint is safe.
- `status <> 'CANCELLED'` releases a slot on cancellation (verified: the slot becomes claimable again).
- Deploying this against a database that already contains overlapping rows **fails with `ExclusionViolation`** — clean up before migrating. Observed, not theorised.

### 3.2 The advisor lock is not DDL — it is the claim

The atomic claim is described in `ARCHITECTURE.md` §4.2. It is a transaction, not a constraint, and it is what actually makes KT-3 hold. Recorded here because it is part of the data-integrity design:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended(:host_id || ':' || :day, 0));
-- SELECT count(*) of overlapping non-cancelled bookings and live holds
-- if count >= resources_needed -> ROLLBACK and return 409
INSERT INTO bookings (...) VALUES (...) RETURNING id;
COMMIT;
```

**Measured (PostgreSQL 16.15):** with the lock, 40 concurrent callers produced exactly 1 booking, five runs out of five, with the constraint disabled. Without the lock, an insert-if-not-exists guard produced **4 rows out of 20** — the guard alone is not atomic.

### 3.3 Idempotency — a retried request must not double-book

`Booking.idempotencyKey String? @unique`. A client that times out and retries presents the same key; the second attempt resolves to the first booking instead of claiming a second slot. Without this, a correct lock still produces a duplicate when the *client* is the one that retries.

## 4. The student's own timetable — D3

```prisma
model StudentCommitment {
  id         Int      @id @default(autoincrement())
  studentId  Int
  student    User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  label      String                       // "CS3011 lecture"
  slotStart  DateTime @db.Timestamptz
  slotEnd    DateTime @db.Timestamptz
  source     String   @default("manual")  // manual | ics-import
  @@index([studentId, slotStart])
}
```

This table has no counterpart in the original. The availability engine reads the **host's** calendar and never the invitee's (`packages/features/availability/lib/getUserAvailability.ts:648`), so the original cannot detect that a student's proposed slot collides with their own lecture. Stage 4 of our pipeline unions these rows into the busy set, which is what makes AC-C pass and what makes the Clash Sentinel possible.

## 5. Holds — KT-3 under a human timescale

```prisma
model Hold {
  id         Int      @id @default(autoincrement())
  hostId     Int?
  resourceId Int?
  studentId  Int
  student    User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  slotStart  DateTime @db.Timestamptz
  slotEnd    DateTime @db.Timestamptz
  expiresAt  DateTime @db.Timestamptz
  @@unique([studentId, slotStart, slotEnd])
  @@index([expiresAt])
}
```

`expiresAt` is computed from `HOLD_TTL_MINUTES` at creation time, so setting that variable to `1` makes the whole lifecycle observable in a demo. Expired holds are ignored by the claim's count and reaped by a sweeper; they are never part of the availability answer once expired.

## 6. Allocation — D2

```prisma
model Allocation {
  id         Int      @id @default(autoincrement())
  termId     Int
  studentId  Int
  bookingId  Int?     @unique
  policy     String                       // round-robin-week | by-request-time | spread-by-day
  assignedAt DateTime @default(now())
  @@index([termId, policy])
}
```

An allocation is a decision, and a decision that produced a booking points at it. Keeping the report rows separate from the bookings is what lets the admin view answer "was demand met?" without recomputing.

## 7. Invariants the database enforces, and what each protects

| Invariant | Mechanism | Criterion |
|---|---|---|
| No two capacity-1 bookings overlap on a host | Exclusion constraint `no_host_overlap` | KT-3 |
| A cancellation frees its slot | `status <> 'CANCELLED'` in the predicate | — |
| A multi-station lab can seat N at once | `resources_needed = 1` predicate **excludes** it | KT-3b |
| A retried booking does not duplicate | `idempotencyKey @unique` | — |
| A claim is atomic across processes | Transaction-scoped advisory lock | KT-3 |
| A student cannot hold the same slot twice | `@@unique([studentId, slotStart, slotEnd])` | — |
| A holiday removes availability | `AvailabilityRule.kind = HOLIDAY` | AC-B |
| An override replaces that date only | `kind = DATE` + date-scoped lookup | AC-A |

## 8. Indexes and why

| Index | Serves |
|---|---|
| `Booking(hostId, slotStart)` | The overlap count in the claim, and stage 4 of the pipeline |
| `Booking(resourceId, slotStart)` | The same, for lab slots |
| `Booking(studentId, slotStart)` | AC-C and the Clash Sentinel |
| `gist (host_id, time_range)` | The exclusion constraint (created implicitly by it) |
| `AvailabilityRule(ownerUserId, kind)`, `(ownerResourceId, kind)` | Stage 1–3, the hottest read path |
| `Hold(expiresAt)` | The sweeper |
| `User(role)` | Admin and cohort queries |

## 9. Migrations

1. `001_init` — extensions, all tables, all indexes.
2. `002_constraints` — the generated column and `no_host_overlap`, **after** a guard migration that asserts no existing rows overlap.
3. `003_seed` — one term, 15 faculty, 5 labs with capacities 20/24/24/30/12, 200 students, and a holiday, so a judge can run the demo without authoring data by hand.

Seed data is a deliberate design artifact: it makes the 200-student claim testable in one command rather than a story in a slide.
