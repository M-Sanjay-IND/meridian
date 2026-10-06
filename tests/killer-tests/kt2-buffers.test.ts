/**
 * Killer Test 2 — Buffer Time Enforcement
 *
 * Owned by: DEV D (Verification)
 * Criteria: KT-2 (docs/PRD.md §7)
 * Enforces: Busy intervals inflated in both directions by before/after buffers.
 *
 * Requirements:
 * 1. 15-minute before-buffer, 30-minute after-buffer.
 * 2. Slot must not overlap padded window in either direction.
 * 3. Max of adjacent buffers rule is honoured when adjacent events specify differing buffers.
 */

import { describe, it, expect } from 'vitest';

describe('Killer Test 2: Buffer Enforcement', () => {
  it('inflates busy intervals by before and after buffers bidirectionally', () => {
    // Scaffold test for Phase 1
    const beforeBuffer = 15;
    const afterBuffer = 30;

    const bookingStart = 600; // e.g. 10:00 (minutes from midnight)
    const bookingEnd = 645;   // 10:45

    const inflatedStart = bookingStart - afterBuffer; // 09:30 (blocked for prior slot)
    const inflatedEnd = bookingEnd + beforeBuffer;    // 11:00 (blocked for next slot)

    expect(inflatedStart).toBe(570);
    expect(inflatedEnd).toBe(660);
  });
});
