# Agent Interaction Log & Verification Journal

This document records the full interaction history across the conversation that analyzed and reverse-engineered `cal.diy`, cataloging the key user prompts, operational directives, and all empirical corrections made during the rigorous verification phase.

---

## 1. Key Conversation Prompts & Objectives

### Prompt 1: Codebase Reverse-Engineering Analysis
- **User Objective**: Perform an exhaustive, read-only analysis of the monorepo structure.
- **Deliverables**:
  - Detailed tech stack identification with pinned versions from dependency manifests.
  - Local execution commands and required environment variables.
  - Monorepo folder map detailing the purpose of key packages and top files.
  - Catalog of 10 odd/out-of-place files (legacy Heroku artifacts, suppressed API diffs, unreferenced AI skills).
  - Strict evidence citations (`path/to/file:line`) for every finding.

### Prompt 2: Product Explanation & User Role Mapping
- **User Objective**: Explain the product in plain language accessible to beginner developers and students.
- **Deliverables**:
  - Three-sentence product summary (what it does, intended audience, value to a first-year student).
  - Catalog of all user and membership roles defined in the codebase (`USER`, `ADMIN`, `MEMBER`).
  - Identification of 3–5 core features with exact implementing paths and line numbers.
  - Identification of claims made in the documentation that are unsupported by the code.

### Prompt 3: System Architecture Flowchart & State Audit
- **User Objective**: Create a systems architecture diagram and audit where state lives across the platform.
- **Deliverables**:
  - Comprehensive Mermaid flowchart illustrating frontend, backend API, tRPC router, PostgreSQL database, and external integrations (Google Calendar, SMTP, Cloudflare Turnstile).
  - Structured component proof table mapping diagram boxes to exact file lines.
  - Complete 5-tier audit of state persistence (database, cache/locks, browser local storage, server session cookies, filesystem build artifacts).

### Prompt 4: Entry Points Catalog (API & User Screens)
- **User Objective**: Document every backend endpoint and user-facing screen without relying on external documentation.
- **Deliverables**:
  - Table 1 (API & tRPC entry points): Method, path, purpose, input, output, authorization tier, and auth check lines.
  - Table 2 (Frontend screens): URL/screen name, user actions, triggered API calls, and source file paths.
  - Route counting methodology and validation against the filesystem explorer.

### Prompt 5: Data Model & Schema Documentation
- **User Objective**: Document the system data model, entity relationships, and obsolete schema elements.
- **Deliverables**:
  - Mermaid entity-relationship diagram (`erDiagram`) mapping all core models and relations.
  - Entity documentation table detailing fields, types, foreign keys, unique constraints, and indexes.
  - Identification and rationale for orphaned models (`BookingDenormalized`, `CalendarCache`, `DSyncData`, `Deployment.licenseKey`).

### Prompt 6: Senior Code Review & Architectural Gap Analysis
- **User Objective**: Conduct a senior-level code review focusing on security, correctness, data integrity, UX, missing features, and documentation drift.
- **Deliverables**:
  - Structured findings table prioritized by severity (High $\rightarrow$ Medium $\rightarrow$ Low).
  - Deep-dive analysis into 11 specific architectural gaps covering route permission checks, bot verification bypass, double-booking race conditions, client-controlled header trust, anonymous no-show reporting, unbounded admin queries, SQL syntax errors, and silent mail disablement.
  - Strict exclusion of exploit payloads, attack scripts, or proof-of-concept code.

### Prompt 7: Fact-Checking & Empirical Claim Verification Audit
- **User Objective**: Verify every assertion and citation made in the conversation against physical repository files.
- **Deliverables**:
  - Re-read every referenced file and line number.
  - Tag claims strictly as **Confirmed** (exact line proves claim), **Likely** (strong structural proof across multiple lines), or **Guess** (no direct evidence).
  - Compilation of a formal "Corrections" list documenting all refined citations.

### Prompt 8: Rebuild Documentation Generation
- **User Objective**: Author a clean, comprehensive documentation suite in `docs/` for an independent rebuild based exclusively on confirmed facts.
- **Deliverables**:
  - `OBSERVATIONS.md`
  - `PRD.md`
  - `ARCHITECTURE.md`
  - `DATA_MODEL.md`
  - `API.md`
  - `GAPS.md`
  - `AGENT_LOG.md`

---

## 2. Empirical Corrections & Citation Adjustments

During the fact-checking audit, every line number and file citation was audited against the physical filesystem. The following corrections and refinements were made:

| # | Item / File | Previous Citation | Corrected Citation | Rationale for Adjustment |
|---|---|---|---|---|
| 1 | OpenAPI Diff Suppressions | `.github/oasdiff-err-ignore.txt:1-2559` | [`.github/oasdiff-err-ignore.txt:1-2558`](file:///home/ace/cal.diy/.github/oasdiff-err-ignore.txt#L1-L2558) | The physical file contains exactly 2,558 lines; line 2559 does not exist. |
| 2 | Internationalization Lockfile | `i18n.lock:1-4652` | [`i18n.lock:1-4651`](file:///home/ace/cal.diy/i18n.lock#L1-L4651) | The physical file contains exactly 4,651 lines; line 4652 does not exist. |
| 3 | AGENTS.md Workflow Constants | `AGENTS.md:162` | [`AGENTS.md:130`](file:///home/ace/cal.diy/AGENTS.md#L130) | Line 162 in `AGENTS.md` is `select: {` inside an example Prisma query. The claim stating that workflow constants are located at `packages/features/ee/workflows/lib/constants.ts` is explicitly written on line 130 (`- Workflow constants: packages/features/ee/workflows/lib/constants.ts`). |
| 4 | Recurring Event Booking Handler | `apps/web/pages/api/book/recurring-event.ts:25` | [`apps/web/pages/api/book/recurring-event.ts:29-60`](file:///home/ace/cal.diy/apps/web/pages/api/book/recurring-event.ts#L29-L60) | Line 25 is a type definition member (`forcedSlug?: string;`) within `type RequestMeta`. The actual request handler function begins at line 29 (`async function handler(...)`) and delegates to `recurringBookingService.createBooking` at lines 47–59. |
| 5 | Calendar Cache Model Range | `packages/prisma/schema.prisma:1594-1618` | [`packages/prisma/schema.prisma:1594-1611`](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L1594-L1611) | `model CalendarCache` terminates at line 1611. Lines 1613–1618 define an unrelated enumeration (`enum RedirectType`). |
| 6 | Double Booking Concurrency Classification | Status: `Confirmed` | Status: `Likely` | While lines 902 and 1707 in `RegularBookingService.ts` and lines 924–927 in `schema.prisma` confirm the absence of database locks and constraints, the occurrence of overlapping double bookings is a runtime behavioral consequence of this architecture rather than an explicit single-line statement. |
| 7 | Permissions Guide File Validation | `packages/trpc/server/routers/viewer/teams/create.handler.ts` | Non-existent path | Verified that `PERMISSIONS.md:11` cites this file, but confirmed via filesystem lookup that the `viewer/teams` directory does not exist. Marked as confirmed documentation drift. |
