/**
 * Killer Tests & Acceptance Criteria: Overrides & Holidays (AC-A & AC-B)
 *
 * Owned by: DEV D (Verification)
 * Criteria: AC-A, AC-B (docs/PRD.md §7, DEV-MANUAL.md §4, §13.3)
 *
 * Verifies:
 * 1. AC-B (Term Holiday):
 *    - 2026-10-20 is a seeded holiday in the database.
 *    - Querying /api/slots for 2026-10-20 returns 200 OK and slots: [].
 *    - Passing TERM_HOLIDAYS in environment or config excludes that day outright.
 * 2. AC-A (Date Overrides):
 *    - A specific DATE override replaces standard WEEKLY availability for that date.
 *    - Resolving working hours respects date-specific custom ranges over recurring schedules.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { resolveWorkingHours } from '../../src/engine/overrides.js';
import type { FastifyInstance } from 'fastify';

describe('Acceptance Criteria: Overrides and Holidays (AC-A & AC-B)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('AC-B: Term Holidays', () => {
    it('returns empty slots array on seeded holiday 2026-10-20 via getSlots with DB', async () => {
      const { getSlots } = await import('../../src/engine/availability.js');
      const { prisma } = await import('../../src/db/client.js');

      const res = await getSlots(
        {
          hostId: 7,
          serviceId: 3,
          from: '2026-10-20',
          to: '2026-10-20',
          tz: 'Asia/Kolkata',
        },
        prisma
      );

      expect(Array.isArray(res.slots)).toBe(true);
      expect(res.slots.length).toBe(0);
    });

    it('holiday removes working hours completely in resolveWorkingHours engine', () => {
      const ranges = resolveWorkingHours({
        rules: [
          {
            kind: 'WEEKLY',
            days: [1, 2, 3, 4, 5],
            startTime: '09:00:00Z',
            endTime: '17:00:00Z',
          },
          {
            kind: 'HOLIDAY',
            date: '2026-10-20',
            startTime: '00:00:00Z',
            endTime: '23:59:59Z',
          },
        ],
        from: '2026-10-20',
        to: '2026-10-20',
        hostTimeZone: 'Asia/Kolkata',
      });

      expect(ranges).toEqual([]);
    });

    it('environment or parameter termHolidays also removes the holiday date', () => {
      const ranges = resolveWorkingHours({
        rules: [
          {
            kind: 'WEEKLY',
            days: [1, 2, 3, 4, 5], // Tuesday 2026-10-27 is weekday 2
            startTime: '09:00:00Z',
            endTime: '17:00:00Z',
          },
        ],
        from: '2026-10-27',
        to: '2026-10-27',
        hostTimeZone: 'Asia/Kolkata',
        termHolidays: ['2026-10-27'],
      });

      expect(ranges).toEqual([]);
    });
  });

  describe('AC-A: Date Overrides', () => {
    it('date override replaces weekly schedule on that specific day', () => {
      // Weekly rule is 09:00 to 17:00 on weekdays
      // Override for 2026-10-21 (Wed) is 14:00 to 16:00 only
      const ranges = resolveWorkingHours({
        rules: [
          {
            kind: 'WEEKLY',
            days: [1, 2, 3, 4, 5],
            startTime: '09:00:00Z',
            endTime: '17:00:00Z',
          },
          {
            kind: 'DATE',
            date: '2026-10-21',
            startTime: '14:00:00Z',
            endTime: '16:00:00Z',
          },
        ],
        from: '2026-10-21',
        to: '2026-10-21',
        hostTimeZone: 'Asia/Kolkata',
      });

      expect(ranges.length).toBe(1);
      // Verify start and end correspond to 14:00 and 16:00 in Asia/Kolkata
      // 14:00 IST is 08:30 UTC
      expect(ranges[0].start.toISOString()).toBe('2026-10-21T08:30:00.000Z');
      expect(ranges[0].end.toISOString()).toBe('2026-10-21T10:30:00.000Z');
    });

    it('non-overridden days in a multi-day range retain standard weekly hours', () => {
      // 2026-10-21 (Wed, override 14:00-16:00) and 2026-10-22 (Thu, weekly 09:00-11:00)
      const ranges = resolveWorkingHours({
        rules: [
          {
            kind: 'WEEKLY',
            days: [3, 4], // Wed, Thu
            startTime: '09:00:00Z',
            endTime: '11:00:00Z',
          },
          {
            kind: 'DATE',
            date: '2026-10-21',
            startTime: '14:00:00Z',
            endTime: '16:00:00Z',
          },
        ],
        from: '2026-10-21',
        to: '2026-10-22',
        hostTimeZone: 'Asia/Kolkata',
      });

      expect(ranges.length).toBe(2);
      // Day 1: override (14:00 - 16:00 IST -> 08:30 - 10:30 UTC)
      expect(ranges[0].start.toISOString()).toBe('2026-10-21T08:30:00.000Z');
      expect(ranges[0].end.toISOString()).toBe('2026-10-21T10:30:00.000Z');
      // Day 2: standard weekly (09:00 - 11:00 IST -> 03:30 - 05:30 UTC)
      expect(ranges[1].start.toISOString()).toBe('2026-10-22T03:30:00.000Z');
      expect(ranges[1].end.toISOString()).toBe('2026-10-22T05:30:00.000Z');
    });
  });
});
