/**
 * Acceptance Criteria Integration Test Suite (AC-C, AC-D, AC-F)
 *
 * Owned by: DEV D (Verification)
 * Criteria: docs/PRD.md §7 & docs/API.md
 *
 * Requirements:
 * 1. AC-C (D3 Clash Sentinel): Student's own timetable clash is rejected with 409 (code: "student_clash").
 * 2. AC-D (Cancellation & No-Leak): DELETE /api/bookings/:id requires valid token; unauthorized gets 404 (zero leak).
 * 3. AC-F (Hold Lifecycle): Active hold blocks competitors; expiration derives from HOLD_TTL_MINUTES.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db/client.js';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Integration Acceptance Criteria (AC-C, AC-D, AC-F)', () => {
  let app: FastifyInstance;
  const HOST_ID = 7;
  const SERVICE_ID = 3;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. AC-C: D3 Clash Sentinel
  // ---------------------------------------------------------------------------
  describe('AC-C: D3 Clash Sentinel', () => {
    const clashStudentId = 110;
    const cleanStudentId = 111;
    const clashSlotStart = new Date('2026-10-15T12:00:00.000Z');
    const clashSlotEnd = new Date('2026-10-15T12:45:00.000Z');

    beforeAll(async () => {
      // Clean previous test data
      await prisma.booking.deleteMany({
        where: { hostId: HOST_ID, slotStart: clashSlotStart },
      });
      await prisma.studentCommitment.deleteMany({
        where: { studentId: clashStudentId },
      });

      // Insert personal commitment for clashStudentId overlapping the slot
      await prisma.studentCommitment.upsert({
        where: { id: 999 },
        update: {
          studentId: clashStudentId,
          label: 'CS301 Advanced Operating Systems Lecture',
          slotStart: new Date('2026-10-15T11:30:00.000Z'),
          slotEnd: new Date('2026-10-15T12:30:00.000Z'),
        },
        create: {
          id: 999,
          studentId: clashStudentId,
          label: 'CS301 Advanced Operating Systems Lecture',
          slotStart: new Date('2026-10-15T11:30:00.000Z'),
          slotEnd: new Date('2026-10-15T12:30:00.000Z'),
        },
      });
    });

    afterAll(async () => {
      await prisma.booking.deleteMany({
        where: { hostId: HOST_ID, slotStart: clashSlotStart },
      });
      await prisma.studentCommitment.deleteMany({
        where: { id: 999 },
      });
    });

    it('rejects claim with 409 student_clash when slot collides with student commitments', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          serviceId: SERVICE_ID,
          hostId: HOST_ID,
          studentId: clashStudentId,
          start: clashSlotStart.toISOString(),
          end: clashSlotEnd.toISOString(),
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('student_clash');
      expect(body.error.message).toContain('CS301 Advanced Operating Systems Lecture');
    });

    it('allows a student without a clash to claim the same slot', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          serviceId: SERVICE_ID,
          hostId: HOST_ID,
          studentId: cleanStudentId,
          start: clashSlotStart.toISOString(),
          end: clashSlotEnd.toISOString(),
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.status).toBe('RESERVED');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. AC-D: Cancellation Security & No-Leak
  // ---------------------------------------------------------------------------
  describe('AC-D: Cancellation Security & No-Leak', () => {
    it('enforces cancellation token and returns 404 on unauthorized access without leaking details', async () => {
      // Step 1: Create a booking
      const bookRes = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          serviceId: SERVICE_ID,
          hostId: HOST_ID,
          studentId: 115,
          start: '2026-10-15T13:00:00.000Z',
          end: '2026-10-15T13:45:00.000Z',
        },
      });

      expect(bookRes.statusCode).toBe(201);
      const booking = JSON.parse(bookRes.body);
      expect(booking.id).toBeDefined();
      expect(booking.cancellationToken).toBeDefined();

      // Step 2: Attempt cancellation without token -> must return 404 (never 403)
      const noTokenRes = await app.inject({
        method: 'DELETE',
        url: `/api/bookings/${booking.id}`,
      });
      expect(noTokenRes.statusCode).toBe(404);

      // Step 3: Attempt cancellation with wrong token -> must return 404 (never 403)
      const wrongTokenRes = await app.inject({
        method: 'DELETE',
        url: `/api/bookings/${booking.id}`,
        headers: {
          'x-cancellation-token': 'invalid-token-12345',
        },
      });
      expect(wrongTokenRes.statusCode).toBe(404);

      // Step 4: Cancel with correct token -> returns 200 OK and marks CANCELLED
      const correctRes = await app.inject({
        method: 'DELETE',
        url: `/api/bookings/${booking.id}`,
        headers: {
          'x-cancellation-token': booking.cancellationToken,
        },
      });
      expect(correctRes.statusCode).toBe(200);
      const cancelBody = JSON.parse(correctRes.body);
      expect(cancelBody.status).toBe('CANCELLED');

      // Cleanup
      await prisma.booking.deleteMany({
        where: { hostId: HOST_ID, slotStart: new Date('2026-10-15T13:00:00.000Z') },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. AC-F: Hold Lifecycle
  // ---------------------------------------------------------------------------
  describe('AC-F: Hold Lifecycle', () => {
    const holdSlotStart = new Date('2026-10-15T14:00:00.000Z');
    const holdSlotEnd = new Date('2026-10-15T14:45:00.000Z');

    beforeAll(async () => {
      await prisma.hold.deleteMany({
        where: { hostId: HOST_ID, slotStart: holdSlotStart },
      });
      await prisma.booking.deleteMany({
        where: { hostId: HOST_ID, slotStart: holdSlotStart },
      });
    });

    afterAll(async () => {
      await prisma.hold.deleteMany({
        where: { hostId: HOST_ID, slotStart: holdSlotStart },
      });
      await prisma.booking.deleteMany({
        where: { hostId: HOST_ID, slotStart: holdSlotStart },
      });
    });

    it('verifies that an active hold in the database blocks competing bookings with 409 slot_taken', async () => {
      // Student 120 holds the slot via active DB hold with TTL derived from HOLD_TTL_MINUTES
      const ttlMinutes = Number(process.env.HOLD_TTL_MINUTES) || 10;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      await prisma.hold.create({
        data: {
          hostId: HOST_ID,
          studentId: 120,
          slotStart: holdSlotStart,
          slotEnd: holdSlotEnd,
          expiresAt,
        },
      });

      // Competing student 121 attempts to claim the slot -> rejected with 409 slot_taken
      const claimRes = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          serviceId: SERVICE_ID,
          hostId: HOST_ID,
          studentId: 121,
          start: holdSlotStart.toISOString(),
          end: holdSlotEnd.toISOString(),
        },
      });

      expect(claimRes.statusCode).toBe(409);
      const claimBody = JSON.parse(claimRes.body);
      expect(claimBody.error.code).toBe('slot_taken');

      // Holding student 120 is allowed to claim their own held slot
      const holderClaimRes = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          serviceId: SERVICE_ID,
          hostId: HOST_ID,
          studentId: 120,
          start: holdSlotStart.toISOString(),
          end: holdSlotEnd.toISOString(),
        },
      });

      expect(holderClaimRes.statusCode).toBe(201);
    });
  });
});
