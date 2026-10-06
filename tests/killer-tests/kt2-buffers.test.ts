/**
 * Killer Test 2 — Buffer Time Enforcement
 *
 * Owned by: DEV D (Verification)
 * Criteria: KT-2 (docs/PRD.md §7)
 * Enforces: Busy intervals inflated in both directions by before/after buffers.
 *
 * Requirements:
 * 1. 15-minute before-buffer and 30-minute after-buffer.
 * 2. Busy intervals inflated: start -= afterBuffer (or beforeBuffer), end += afterBuffer.
 * 3. Max-of-adjacent-buffers rule is honoured.
 * 4. Slots in the padded window are marked unavailable (reason: "buffer") or excluded.
 */

import { describe, it, expect } from 'vitest';
import { inflateBusyIntervals } from '../../src/engine/buffers.js';
import { buildApp } from '../../src/app.js';

describe('Killer Test 2: Buffer Enforcement', () => {
  it('inflates busy intervals by before and after buffers bidirectionally', () => {
    const bookingStart = new Date('2026-10-15T10:00:00.000Z');
    const bookingEnd = new Date('2026-10-15T10:45:00.000Z');

    const inflated = inflateBusyIntervals(
      [
        {
          start: bookingStart,
          end: bookingEnd,
          beforeBuffer: 15,
          afterBuffer: 30,
        },
      ],
      { beforeBuffer: 15, afterBuffer: 30 }
    );

    expect(inflated.length).toBe(1);
    // 10:00 - 15m = 09:45
    expect(inflated[0].start.toISOString()).toBe('2026-10-15T09:45:00.000Z');
    // 10:45 + 30m = 11:15
    expect(inflated[0].end.toISOString()).toBe('2026-10-15T11:15:00.000Z');
  });

  it('takes the maximum of adjacent buffers when items specify differing buffers', () => {
    const bookingStart = new Date('2026-10-15T10:00:00.000Z');
    const bookingEnd = new Date('2026-10-15T10:30:00.000Z');

    // Service requests 10m before, 45m after; item requests 20m before, 15m after
    const inflated = inflateBusyIntervals(
      [
        {
          start: bookingStart,
          end: bookingEnd,
          beforeBuffer: 20,
          afterBuffer: 15,
        },
      ],
      { beforeBuffer: 10, afterBuffer: 45 }
    );

    expect(inflated.length).toBe(1);
    // max(10, 20) = 20m before -> 09:40
    expect(inflated[0].start.toISOString()).toBe('2026-10-15T09:40:00.000Z');
    // max(45, 15) = 45m after -> 11:15
    expect(inflated[0].end.toISOString()).toBe('2026-10-15T11:15:00.000Z');
  });

  it('merges overlapping inflated buffer ranges into a contiguous busy interval', () => {
    // Two appointments close together whose inflated buffers collide
    const appt1Start = new Date('2026-10-15T09:00:00.000Z');
    const appt1End = new Date('2026-10-15T09:30:00.000Z'); // buffer to 10:00

    const appt2Start = new Date('2026-10-15T09:45:00.000Z'); // buffer from 09:30
    const appt2End = new Date('2026-10-15T10:15:00.000Z');

    const inflated = inflateBusyIntervals(
      [
        { start: appt1Start, end: appt1End, beforeBuffer: 15, afterBuffer: 30 },
        { start: appt2Start, end: appt2End, beforeBuffer: 15, afterBuffer: 30 },
      ]
    );

    // Because appt1 inflated ends at 10:00 and appt2 inflated starts at 09:30, they must merge
    expect(inflated.length).toBe(1);
    expect(inflated[0].start.toISOString()).toBe('2026-10-15T08:45:00.000Z');
    expect(inflated[0].end.toISOString()).toBe('2026-10-15T10:45:00.000Z');
  });

  it('GET /api/slots reflects buffer metadata for service 3', async () => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.buffer).toEqual({ before: 15, after: 30 });
    await app.close();
  });
});
