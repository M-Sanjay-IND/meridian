# Architectural Gaps & Targeted Improvements — Cal.diy Rebuild

## 1. Verified Deficiencies in the Original Codebase

The following architectural and security gaps have been empirically verified in the original `cal.diy` codebase.

---

### Gap 1: Broken Object-Level Authorization (BOLA) on Booking Cancellation
- **Evidence**: [apps/web/app/api/cancel/route.ts:52-55](file:///home/ace/cal.diy/apps/web/app/api/cancel/route.ts#L52-L55) and [packages/features/bookings/lib/handleCancelBooking.ts:153-189](file:///home/ace/cal.diy/packages/features/bookings/lib/handleCancelBooking.ts#L153-L189) [Confirmed]
- **Deficiency**: The cancellation route permits unauthenticated callers by passing fallback user ID `-1`. Within `handleCancelBooking`, host checks are strictly confined to seated events without seat reference UIDs. For standard one-on-one appointments, there is no verification that the caller is the host or the attendee who scheduled the meeting. Anyone possessing a public booking UID can unilaterally cancel another user's appointment.

---

### Gap 2: Double Booking Race Condition Under Concurrency
- **Evidence**: [packages/features/bookings/lib/service/RegularBookingService.ts:902, 1707-1710](file:///home/ace/cal.diy/packages/features/bookings/lib/service/RegularBookingService.ts#L902) and [packages/prisma/schema.prisma:918-930](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L918-L930) [Likely]
- **Deficiency**: In `RegularBookingService`, slot availability is evaluated early at line 902 via `ensureAvailableUsers`. Booking persistence occurs down at line 1707 after extensive asynchronous operations (calendar fetching, video link creation). The database schema contains indexes on `[startTime, endTime, status]` and `[userId, status, startTime]`, but no unique or exclusion constraints exist on overlapping active time intervals. Two concurrent submissions for the same slot both pass validation and write overlapping bookings for the host.

---

### Gap 3: Bot Protection Bypass & Slot Exhaustion via Client IP Limits
- **Evidence**: [apps/web/pages/api/book/event.ts:20-25, 37-40](file:///home/ace/cal.diy/apps/web/pages/api/book/event.ts#L20-L25) [Confirmed]
- **Deficiency**: Cloudflare Turnstile token validation is only executed if `NEXT_PUBLIC_CLOUDFLARE_USE_TURNSTILE_IN_BOOKER === "1"`, defaulting to completely inactive. Furthermore, the endpoint rate limiter relies exclusively on the hashed client IP address (`createBooking:${piiHasher.hash(userIp)}`), allowing attackers rotating residential IP addresses or basic proxies to flood and exhaust a host's open calendar slots.

---

### Gap 4: Documentation Drift Regarding Enterprise Removal vs. Active Teams
- **Evidence**: [README.md:47](file:///home/ace/cal.diy/README.md#L47) vs [packages/prisma/schema.prisma:557-765](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L557-L765) and [scripts/seed.ts:1057-1155](file:///home/ace/cal.diy/scripts/seed.ts#L1057-L1155) [Confirmed]
- **Deficiency**: The project README explicitly claims that Teams, Organizations, and enterprise features have been completely removed. In reality, the Prisma schema maintains 200+ lines of active `Team`, `Membership`, and role definitions, and the default development database seed script actively creates enterprise teams and memberships during initial setup.

---

### Gap 5: Server Blindly Trusts Client Header `x-cal-force-slug`
- **Evidence**: [apps/web/pages/api/book/event.ts:55](file:///home/ace/cal.diy/apps/web/pages/api/book/event.ts#L55) and [packages/features/bookings/lib/service/RegularBookingService.ts:1718](file:///home/ace/cal.diy/packages/features/bookings/lib/service/RegularBookingService.ts#L1718) [Confirmed]
- **Deficiency**: The public booking endpoint extracts `req.headers["x-cal-force-slug"]` without validation and injects it directly into booking metadata and downstream service calls. External clients can forge slug identifiers, polluting audit records and bypassing canonical database slug lookups.

---

### Gap 6: Anonymous Host Reputation Tampering via Public No-Show Endpoint
- **Evidence**: [packages/trpc/server/routers/publicViewer/markHostAsNoShow.handler.ts:9-18](file:///home/ace/cal.diy/packages/trpc/server/routers/publicViewer/markHostAsNoShow.handler.ts#L9-L18) [Confirmed]
- **Deficiency**: The public procedure `publicViewer.markHostAsNoShow` accepts `{ bookingUid, noShowHost }` anonymously without requiring authentication or attendee verification. An internal comment acknowledges: `// TODO: Track which attendee actually called this endpoint... Currently this is completely anonymous and public endpoint.` Any party can falsify host attendance statistics.

---

### Gap 7: Unbounded Memory Allocation in Admin User Listing
- **Evidence**: [packages/trpc/server/routers/viewer/users/_router.ts:57-61](file:///home/ace/cal.diy/packages/trpc/server/routers/viewer/users/_router.ts#L57-L61) [Confirmed]
- **Deficiency**: The administrative user list query performs an unbounded `prisma.user.findMany()` with no `take`, `skip`, or cursor constraints. A code comment reads: `// TODO: Add search, pagination, etc.` On self-hosted deployments with thousands of registered accounts, invoking this query loads all records into Node.js heap memory, creating risk of Out-Of-Memory (OOM) crashes.

---

### Gap 8: Orphaned Prisma Models Creating Schema and Migration Bloat
- **Evidence**: [packages/prisma/schema.prisma:1527-1564, 1594-1611](file:///home/ace/cal.diy/packages/prisma/schema.prisma#L1527-L1564) [Likely]
- **Deficiency**: Models such as `BookingDenormalized`, `BookingTimeStatusDenormalized`, and `CalendarCache` exist in the database schema with complex composite indexes, but have zero read or write queries anywhere in active application code. Internal comments note `// To be made required in a followup`.

---

### Gap 9: Broken Documentation Links in Permissions Guide
- **Evidence**: [PERMISSIONS.md:11-15, 37-39](file:///home/ace/cal.diy/PERMISSIONS.md#L11-L15) [Confirmed]
- **Deficiency**: The PBAC permissions documentation references non-existent router handlers including `packages/trpc/server/routers/viewer/teams/create.handler.ts` and `packages/trpc/server/routers/viewer/organizations/get.handler.ts`. Both directories do not exist in the codebase.

---

### Gap 10: Syntax Error in Database Maintenance Script
- **Evidence**: [scripts/delete-empty-google-credentials.sql:11-18](file:///home/ace/cal.diy/scripts/delete-empty-google-credentials.sql#L11-L18) [Confirmed]
- **Deficiency**: The SQL cleanup script chains a `SELECT` statement directly into a `DELETE` without a semicolon or subquery wrapper, producing an immediate syntax error when executed against PostgreSQL.

---

### Gap 11: Silent Mail Transport Failure on Missing Environment Variables
- **Evidence**: [apps/web/next.config.ts:86-92](file:///home/ace/cal.diy/apps/web/next.config.ts#L86-L92) [Confirmed]
- **Deficiency**: Next.js startup code emits a simple console warning if `EMAIL_FROM` is unset. The system continues to run and allows users to complete bookings without warning the booker or host that no confirmation emails or calendar invites will be dispatched.

---

## 2. The Two Targeted Improvements for Our Rebuild

To deliver a reliable, secure scheduling product for solo professionals and students, our rebuild specifically implements two architectural improvements targeting the highest severity gaps:

### Improvement 1: Concurrency-Safe Atomic Booking Reservation Engine with PostgreSQL Exclusion Locks
- **Addressing**: Gap 2 (Double Booking Race Condition Under Concurrency).
- **Technical Implementation**:
  1. At the database layer, add a PostgreSQL exclusion constraint on the `Booking` table:
     ```sql
     ALTER TABLE "Booking" ADD CONSTRAINT "no_overlapping_active_bookings"
     EXCLUDE USING gist (
       "userId" WITH =,
       tsrange("startTime", "endTime") WITH &&
     ) WHERE ("status" != 'CANCELLED');
     ```
  2. In the application layer, wrap the slot validation and persistence sequence in an atomic transaction or acquire an advisory lock keyed on `(userId, startTime)` before calling external calendar APIs.
  3. If a concurrent request attempts to reserve the same slot, the database rejects the second transaction with an exclusion violation, returning a clean `409 Conflict` ("This slot was just reserved by another user") to the client.
- **Why It Matters to the User in the Brief**:
  Solo operators, instructors, and students (e.g., a first-year student coordinating study sessions or mock interviews) frequently broadcast their booking link across group chats, class forums, and emails. When multiple peers open the link simultaneously, the original platform permits conflicting bookings for the exact same hour. A double-booked student is forced to awkwardly cancel on a classmate or professor, causing embarrassment and scheduling friction. Our rebuild guarantees that a time slot can never be reserved twice.

---

### Improvement 2: Cryptographically Signed Action Tokens for Booking Cancellation & Status Updates
- **Addressing**: Gap 1 (Broken Object-Level Authorization on Cancellation) and Gap 6 (Anonymous Host Reputation Tampering).
- **Technical Implementation**:
  1. Eliminate the unauthenticated fallback (`userId: -1`) on `/api/cancel`.
  2. For attendees, generate a secure HMAC-SHA256 token derived from `(bookingUid, bookingCreatedAt, serverSecret)` upon booking creation, and include it strictly as a URL parameter in the private email confirmation link:
     ```text
     https://cal.diy/cancel?uid=bkg_123&token=hmac_signature
     ```
  3. When `/api/cancel` or `markHostAsNoShow` is invoked, require either:
     - An authenticated NextAuth session matching `booking.userId` or the attendee's verified email.
     - A valid HMAC signature matching the booking UID and secret.
  4. Reject any unsigned or unauthenticated cancellation attempt with `401 Unauthorized` or `403 Forbidden`.
- **Why It Matters to the User in the Brief**:
  In the original codebase, any third party who obtains a booking link or inspects network traffic can trivially cancel appointments or ruin a host's attendance record with zero authentication. For students and freelancers whose academic grades or consulting revenue depend on confirmed appointments, malicious or accidental cancellation can lead to missed exam reviews or lost clients. Cryptographic signing guarantees that only the genuine host and verified attendee can alter meeting status.
