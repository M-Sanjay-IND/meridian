/**
 * HTTP-Level Concurrency Test — Killer Test 3 via Fastify HTTP Surface
 *
 * Owned by: DEV D (Verification)
 * Criteria: KT-3 & docs/API.md §4
 * Enforces: 40 concurrent HTTP requests over POST /api/bookings
 *
 * Requirements:
 * 1. Constraint disabled in PostgreSQL: atomicity is strictly enforced by the advisory lock.
 * 2. 40 callers released from Barrier(40).
 * 3. Exactly 1 caller gets HTTP 201 Created with booking ID and cancellation token.
 * 4. Exactly 39 callers get HTTP 409 Conflict with code "slot_taken".
 * 5. Loser responses NEVER disclose the winner's booking ID (zero leakage).
 * 6. Loser response carries alternatives array.
 * 7. Exactly 1 row stored in database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Barrier } from './barrier.js';
import { prisma } from '../../src/db/client.js';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('HTTP Concurrency: Atomic Claim via POST /api/bookings', () => {
  let app: FastifyInstance;
  const CALLERS = 40;
  const HOST_ID = 7;
  const SERVICE_ID = 3;
  const SLOT_START = '2026-10-15T09:00:00.000Z';
  const SLOT_END = '2026-10-15T09:45:00.000Z';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Disable database exclusion constraint for the test
    await prisma.$executeRawUnsafe(`ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "no_host_overlap";`);

    // Clean previous bookings for host 7 on this slot
    await prisma.booking.deleteMany({
      where: {
        hostId: HOST_ID,
        slotStart: new Date(SLOT_START),
      },
    });
  });

  afterAll(async () => {
    // Restore exclusion constraint
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'no_host_overlap'
        ) THEN
          ALTER TABLE "Booking" ADD CONSTRAINT "no_host_overlap"
            EXCLUDE USING gist ("hostId" WITH =, "time_range" WITH &&)
            WHERE ("status" <> 'CANCELLED' AND "resourcesNeeded" = 1);
        END IF;
      END $$;
    `);

    await prisma.booking.deleteMany({
      where: {
        hostId: HOST_ID,
        slotStart: new Date(SLOT_START),
      },
    });

    await app.close();
  });

  it('handles 40 concurrent HTTP claims: exactly 1 wins (201), 39 lose (409) with zero winner ID leak', async () => {
    const barrier = new Barrier(CALLERS);

    const requests = Array.from({ length: CALLERS }, async (_, idx) => {
      await barrier.wait(); // All 40 released simultaneously
      const res = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `http-test-${idx}-${Date.now()}`,
        },
        payload: {
          serviceId: SERVICE_ID,
          hostId: HOST_ID,
          studentId: 101 + idx,
          start: SLOT_START,
          end: SLOT_END,
          note: `Concurrent HTTP caller #${idx}`,
        },
      });

      return {
        status: res.statusCode,
        body: JSON.parse(res.body),
      };
    });

    const results = await Promise.all(requests);

    const winners = results.filter((r) => r.status === 201);
    const losers = results.filter((r) => r.status === 409);

    // Exactly 1 winner, 39 losers
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(CALLERS - 1);

    const winnerId = winners[0].body.id;
    expect(winnerId).toBeDefined();

    // Verify zero leakage: loser response MUST NOT contain winner's booking ID
    for (const loser of losers) {
      expect(loser.body.error).toBeDefined();
      expect(loser.body.error.code).toBe('slot_taken');
      expect(JSON.stringify(loser.body)).not.toContain(`"id":${winnerId}`);
      expect(loser.body.id).toBeUndefined();
      // Fresh alternatives offered in 409 body
      expect(loser.body.error.details?.alternatives).toBeDefined();
    }

    // Verify database row count: exactly 1 stored row
    const storedCount = await prisma.booking.count({
      where: {
        hostId: HOST_ID,
        slotStart: new Date(SLOT_START),
        status: { not: 'CANCELLED' },
      },
    });

    expect(storedCount).toBe(1);
  });
});
