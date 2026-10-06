/**
 * Killer Test 1 — Timezone Parity (IST vs PST/PDT)
 *
 * Owned by: DEV D (Verification)
 * Criteria: KT-1 (docs/PRD.md §7)
 * Enforces: Exact instant identity between host timezone and booker timezone.
 *
 * Requirements:
 * 1. Asia/Kolkata (IST) vs America/Los_Angeles on 2026-10-15 (PDT, UTC-7).
 *    09:00 IST -> 20:30 the previous day (2026-10-14).
 * 2. Standard time equivalent (PST, UTC-8) on e.g. 2026-12-15.
 * 3. Driven by IANA zone database; NO hardcoded offset constants (+05:30, -07:00).
 */

import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';

describe('Killer Test 1: Timezone Parity', () => {
  it('converts 09:00 IST on 2026-10-15 to 20:30 PDT on 2026-10-14 without offset constants', () => {
    const istStart = DateTime.fromObject(
      { year: 2026, month: 10, day: 15, hour: 9, minute: 0 },
      { zone: 'Asia/Kolkata' }
    );
    const laTime = istStart.setZone('America/Los_Angeles');

    // October date is Daylight Saving Time (PDT, UTC-7)
    expect(laTime.year).toBe(2026);
    expect(laTime.month).toBe(10);
    expect(laTime.day).toBe(14);
    expect(laTime.hour).toBe(20);
    expect(laTime.minute).toBe(30);
    expect(laTime.isInDST).toBe(true);
  });

  it('converts 09:00 IST on 2026-12-15 to 19:30 PST on 2026-12-14 in Standard Time', () => {
    const istWinter = DateTime.fromObject(
      { year: 2026, month: 12, day: 15, hour: 9, minute: 0 },
      { zone: 'Asia/Kolkata' }
    );
    const laTime = istWinter.setZone('America/Los_Angeles');

    // December date is Standard Time (PST, UTC-8)
    expect(laTime.year).toBe(2026);
    expect(laTime.month).toBe(12);
    expect(laTime.day).toBe(14);
    expect(laTime.hour).toBe(19);
    expect(laTime.minute).toBe(30);
    expect(laTime.isInDST).toBe(false);
  });
});
