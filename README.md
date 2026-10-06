# Meridian

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-v4-black?logo=fastify&logoColor=white)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Luxon](https://img.shields.io/badge/Luxon-Timezones-orange)](https://moment.github.io/luxon/)
[![Vitest](https://img.shields.io/badge/Vitest-Passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **High-Throughput Academic Resource & Office Hours Scheduling Engine**  
> Arbitrating contested faculty advising windows, thesis defense slots, and specialized laboratory workstations across global timezones with mathematical interval algebra and atomic concurrency guarantees.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Scheduling Engine & Primitives](#core-scheduling-engine--primitives)
4. [Technology Stack](#technology-stack)
5. [Deterministic Seed Scenario](#deterministic-seed-scenario)
6. [Quickstart & Local Execution](#quickstart--local-execution)
7. [Cloud Database Integration](#cloud-database-integration)
8. [Vercel Frontend Deployment](#vercel-frontend-deployment)
9. [Verification & Killer Test Suites](#verification--killer-test-suites)
10. [REST API Reference](#rest-api-reference)
11. [Clean Room Certification](#clean-room-certification)
12. [License](#license)

---

## Executive Summary

Meridian solves the high-contention scheduling bottleneck common in universities: **200+ students** competing for appointments across **15 faculty supervisors** and **5 physical research laboratories** with limited workstation capacities.

Unlike standard calendar software that relies on naive slot loops and client-side timezone translations, Meridian guarantees:
- **Zero-Drift Timezones**: Pure IANA Luxon conversion without numeric offset constants (`+05:30`, `-07:00`, `3600*`).
- **Symmetrical Buffer Inflation**: Adjacent interval padding expanded to the maximum requirement between consecutive bookings (**KT-2**).
- **Strict Schedule Precedence**: Date overrides completely supersede recurring schedules (**AC-A**); term holidays remove availability outright (**AC-B**).
- **Atomic Race-Condition Safety**: Under simultaneous booking attempts for a single slot, exactly one caller succeeds (`201 Created`) while competing callers receive conflict rejections (`409 Conflict`) with alternative recommendations (**KT-3**).
- **Workstation Capacity Tracking**: Multi-station laboratory slots accurately track real-time bench utilization (**KT-3b**).
- **Global Invitee Clash Prevention**: Students cannot double-book overlapping appointments across different supervisors or labs (**D3**).

---

## System Architecture

Meridian uses a monolithic dual-tier architecture. A single Fastify v4 server hosts both the REST API on `/api/*` and dynamically serves the pre-compiled React 19 Single Page Application from `web/dist` on `/`.

```mermaid
graph TD
    User["Student / Faculty Booker"] -->|HTTP / Browser| Web["React 19 Frontend (web/dist at /)"]
    Web -->|REST API /api/*| Fastify["Fastify v4 API Gateway (Port 3000)"]
    
    subgraph Meridian Core Engine
        Fastify --> RangeEngine["Pure Range Algebra (ranges.ts)"]
        Fastify --> ZoneEngine["IANA Timezone Converter (zones.ts)"]
        Fastify --> BufferEngine["Adjacent Buffer Inflator (buffers.ts)"]
        Fastify --> OverrideEngine["Overrides & Holiday Purge (overrides.ts)"]
        Fastify --> Pipeline["10-Stage Slot Pipeline (availability.ts)"]
    end
    
    subgraph Persistence Layer
        Fastify --> ClaimHandler["Atomic Claim & Locking (claim.ts)"]
        ClaimHandler --> Prisma["Prisma v6 ORM"]
        Prisma --> Postgres[("PostgreSQL 16 (Row-Level Locking)")]
    end
```

---

## Core Scheduling Engine & Primitives

### 1. Pure Range Algebra (`src/engine/ranges.ts`)
Slots and busy blocks are treated as continuous mathematical half-open intervals `[start, end)`. Operations include:
- `intersectRanges(a, b)`: Computes overlapping time slices.
- `subtractRanges(base, exclusions)`: Subtracts busy blocks, buffers, and holds from raw working hours.
- `mergeOverlappingRanges(ranges)`: Consolidates adjacent and intersecting intervals.

### 2. Pure IANA Timezone Engine (`src/engine/zones.ts`)
- All system intervals are stored and arbitrated in **UTC ISO 8601**.
- Converts dates between local IANA identifiers (e.g., `Asia/Kolkata`, `America/New_York`, `UTC`) using Luxon's canonical database.
- Absolutely zero hardcoded numerical offsets.

### 3. Symmetrical Buffer Inflation (`src/engine/buffers.ts`)
To prevent faculty burnout and student overlaps, buffers are inflated to the maximum adjacent requirement:
```
Effective Buffer = max(Current Booking Buffer, Adjacent Slot Buffer)
```
If an existing booking has a 15-minute after-buffer and the next service requires a 30-minute before-buffer, the spacing enforces `max(15, 30) = 30` minutes.

### 4. Overrides & Holiday Exclusions (`src/engine/overrides.ts`)
- **AC-A (Date Overrides)**: A specific date override completely replaces recurring weekly schedules for that day.
- **AC-B (Holiday Purge)**: Academic term holidays purge all availability, returning zero slots.

### 5. Atomic Claim Engine (`src/booking/claim.ts`)
Booking attempts execute inside an interactive PostgreSQL transaction using Row-Level Locking (`SELECT ... FOR UPDATE`):
1. Verifies host availability and existing confirmed reservations.
2. Checks active temporary holds (enforcing `HOLD_TTL_MINUTES`).
3. Validates student timetable commitments to prevent double-booking.
4. Decrements workstation capacity for lab resources.
5. Emits an immutable audit record and unique cancellation token.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Language** | TypeScript 5.8 | End-to-end type safety across engine, backend, and UI |
| **API Framework** | Fastify 4.28 | Asynchronous high-throughput HTTP server with low latency |
| **ORM** | Prisma 6.4 | Strict schema migrations, typed models, relational integrity |
| **Database** | PostgreSQL 16 | Relational storage with row-level locking and transaction isolation |
| **Time Engine** | Luxon 3.5 | IANA timezone mathematical conversions |
| **Frontend UI** | React 19, Vite 8 | Institutional Brutalism layout with interactive booking arbitration |
| **Styling** | Vanilla CSS Tokens | Zero Tailwind dependency, curated typography and color tokens |
| **Testing** | Vitest 3.0 | Comprehensive unit, killer, and HTTP concurrency test suites |

---

## Deterministic Seed Scenario

The application includes an automated deterministic seed reflecting a full university department (`prisma/seed.ts`):
- **Term**: Fall 2026 (`2026-08-01` to `2026-12-31`, Timezone: `Asia/Kolkata`).
- **15 Faculty Supervisors**: Host ID 7 is **Prof. Rao** (`rao@meridian.edu`).
- **200 Students**: Seeded accounts from `student_001` to `student_200`.
- **5 Physical Research Labs**:
  - Lab Alpha Robotics: Capacity 20
  - Microfluidics Fab: Capacity 24
  - Quantum Photonics Cluster: Capacity 24
  - Cyber-Physical Testbed: Capacity 30
  - High-Voltage Enclosure: Capacity 12
- **Services**: Service 3 is **Office Hours / Thesis Review** with Host 7.
- **Academic Holidays**: Diwali observed on `2026-10-20`.

---

## Quickstart & Local Execution

### Prerequisites
- Node.js >= 18.0.0
- Docker Desktop (or local PostgreSQL)

### 1. Clone & Configure Environment
```bash
cp .env.example .env
```

### 2. Start PostgreSQL Database
```bash
docker compose up -d db
```

### 3. Install Dependencies & Generate Client
```bash
npm install
npx prisma generate
```

### 4. Deploy Migrations & Seed Scenario Data
```bash
npm run db:migrate
npm run db:seed
```

### 5. Launch the Unified Production Server
```bash
npm run start
```

Access the complete system in your browser at:  
👉 **`http://localhost:3000`**

- **Frontend Application**: Served from `/`
- **REST API Endpoints**: Available on `/api/*`

---

## Cloud Database Integration

To run Meridian with a serverless or cloud PostgreSQL database (Neon, Supabase, Railway):

### Neon Serverless PostgreSQL
1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string.
3. Update `.env`:
   ```ini
   DATABASE_URL="postgresql://user:password@ep-xyz-pooler.region.neon.tech/neondb?sslmode=require"
   ```
4. Push schema and seed:
   ```bash
   npx prisma db push
   npm run db:seed
   ```

### Supabase PostgreSQL
1. Create a project at [supabase.com](https://supabase.com).
2. Retrieve the **Transaction Pooler** URI (port 6543).
3. Update `DATABASE_URL` in `.env` and run `npx prisma db push && npm run db:seed`.

---

## Vercel Frontend Deployment

The `web/` directory is pre-configured for instant deployment on Vercel:

1. Deploy using the Vercel CLI:
   ```bash
   cd web
   npx vercel --prod
   ```
2. **API Connection Options**:
   - **Option A (Environment Variable)**: Set `VITE_API_URL=https://your-backend-api.com` in your Vercel Project Settings.
   - **Option B (Proxy Rewrite)**: Use `web/vercel.json` rewrites to proxy `/api/*` to your hosted backend.

---

## Verification & Killer Test Suites

Meridian features a rigorous verification harness covering unit mathematics, API contracts, and high-concurrency race conditions.

### Run All 34 Tests (Full Suite)
```bash
npm test
```

### Killer Tests Suite (`npm run test:killer`)
Runs the deterministic killer tests verifying core invariants:
- **KT-1**: Zero offset drift across global IANA timezones (IST vs PST).
- **KT-2**: Symmetrical buffer inflation with adjacent buffer maximization.
- **KT-3b**: Multi-station capacity slot arbitration under load.

### Concurrency Race Condition Harness (`npm run test:concurrency`)
Fires 40 concurrent HTTP requests across 5 consecutive runs targeting a single slot:
```bash
npm run test:concurrency
```
**Result**: Exactly 1 winner admitted (`201 Created`), 39 losers rejected (`409 Conflict`), and 0 double-bookings stored.

---

## REST API Reference

| Endpoint | Method | Description | Key Status Codes |
|---|---|---|---|
| `/api/health` | `GET` | Health status and engine version telemetry | `200 OK` |
| `/api/slots` | `GET` | Compute available slots given host, service, date range, and timezone | `200 OK`, `422 Unprocessable` |
| `/api/holds` | `POST` | Place a temporary 10-minute hold on a slot | `201 Created`, `409 Conflict` |
| `/api/bookings` | `POST` | Atomic claim for a slot with student clash arbitration | `201 Created`, `409 Conflict`, `422 Unprocessable` |
| `/api/bookings/:id` | `DELETE` | Cancel confirmed reservation using cancellation token | `200 OK`, `404 Not Found` |
| `/api/meta/hosts` | `GET` | Retrieve list of supervisors, bios, and disciplines | `200 OK` |
| `/api/meta/services` | `GET` | Retrieve available consultation and lab services | `200 OK` |
| `/api/intel/clashes` | `GET` | Query student timetable conflicts (Clash Sentinel) | `200 OK` |

---

## Clean Room Certification

Meridian was designed and built strictly from behavioural specifications:
- **Zero External Calendar Code**: Clean-room implementation built without copying or referencing proprietary calendar packages.
- **Dependency Audit**: `0` packages from `@calcom/*` installed directly or transitively.
- **Zero Offset Constants**: Mathematical conversions use canonical IANA identifiers; zero manual string offsets (`+05:30`, `-07:00`) in `src/engine/`.

---

## License

Distributed under the **MIT License**.
