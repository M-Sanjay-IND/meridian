/**
 * Killer Test 3b — Resource Multi-Station Capacity
 *
 * Owned by: DEV D (Verification)
 * Criteria: KT-3b (docs/PRD.md §7)
 * Enforces: Multi-station lab admits exactly its station count before rejecting.
 *
 * Requirements:
 * 1. Lab with capacity = 3 admits exactly 3 concurrent bookings.
 * 2. 8 concurrent callers -> exactly 3 winners (201), 5 losers (409).
 * 3. Proves database exclusion constraint predicate (resources_needed = 1) does not
 *    break capacity slots (preventing upstream Cal.com defect #21467).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Barrier } from '../concurrency/barrier.js';
import { claim } from '../../src/booking/claim.js';
import { prisma } from '../../src/db/client.js';

describe('Killer Test 3b: Multi-Station Resource Capacity', () => {
  const labStart = '2026-10-15T15:00:00.000Z';
  const labEnd = '2026-10-15T16:00:00.000Z';
  const RESOURCE_ID = 2; // Systems Lab B, capacity 3 in service 4
  const SERVICE_ID = 4;
  const CALLERS = 8;

  beforeAll(async () => {
    // Clear test slots
    await prisma.booking.deleteMany({
      where: {
        resourceId: RESOURCE_ID,
        slotStart: new Date(labStart),
      },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({
      where: {
        resourceId: RESOURCE_ID,
        slotStart: new Date(labStart),
      },
    });
  });

  it('admits exactly 3 concurrent bookings into a 3-station lab slot, rejecting the remaining 5 with 409', async () => {
    const barrier = new Barrier(CALLERS);

    const promises = Array.from({ length: CALLERS }, async (_, idx) => {
      await barrier.wait();
      try {
        const res = await claim({
          serviceId: SERVICE_ID,
          resourceId: RESOURCE_ID,
          studentId: 101 + idx,
          start: labStart,
          end: labEnd,
        });
        return res.winner ? 201 : 409;
      } catch {
        return 500;
      }
    });

    const results = await Promise.all(promises);
    const winners = results.filter((code) => code === 201).length;
    const losers = results.filter((code) => code === 409).length;

    const storedRows = await prisma.booking.count({
      where: {
        resourceId: RESOURCE_ID,
        slotStart: new Date(labStart),
        status: { not: 'CANCELLED' },
      },
    });

    expect(winners).toBe(3);
    expect(losers).toBe(5);
    expect(storedRows).toBe(3);
  });
});
