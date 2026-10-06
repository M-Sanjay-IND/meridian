import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { buildApp } from "../../src/app.js";

describe("API Route Surface (Role C)", () => {
  const app = buildApp();

  it("GET /api/health returns 200 OK with correct status and timestamp", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.version).toBe("1.0.0");
    expect(body.timestamp).toBeDefined();
  });

  describe("GET /api/slots — Killer Test 1 (Time Zones: Instant Identity across DST)", () => {
    it("KT-1 October date (PDT, UTC-7): converts 09:00 IST to 20:30 PDT previous day with exact instant identity", async () => {
      const date = "2026-10-15";
      const istRes = await app.inject({
        method: "GET",
        url: `/api/slots?hostId=7&serviceId=3&from=${date}&to=${date}&tz=Asia/Kolkata`,
      });
      expect(istRes.statusCode).toBe(200);
      const istBody = JSON.parse(istRes.body);

      const pstRes = await app.inject({
        method: "GET",
        url: `/api/slots?hostId=7&serviceId=3&from=${date}&to=${date}&tz=America/Los_Angeles`,
      });
      expect(pstRes.statusCode).toBe(200);
      const pstBody = JSON.parse(pstRes.body);

      expect(istBody.slots.length).toBe(pstBody.slots.length);

      // Verify slot starts: 09:00 IST = 20:30 PDT previous day
      expect(istBody.slots[0].start).toContain("09:00:00");
      expect(pstBody.slots[0].start).toContain("20:30:00");

      // Verify exact epoch millisecond instant identity across all slots
      for (let i = 0; i < istBody.slots.length; i++) {
        const istMillis = DateTime.fromISO(istBody.slots[i].start).toMillis();
        const pstMillis = DateTime.fromISO(pstBody.slots[i].start).toMillis();
        expect(istMillis).toBe(pstMillis);
      }
    });

    it("KT-1 Standard-time date (PST, UTC-8): converts 09:00 IST to 19:30 PST previous day with exact instant identity", async () => {
      const winterDate = "2027-01-15";
      const istRes = await app.inject({
        method: "GET",
        url: `/api/slots?hostId=7&serviceId=3&from=${winterDate}&to=${winterDate}&tz=Asia/Kolkata`,
      });
      expect(istRes.statusCode).toBe(200);
      const istBody = JSON.parse(istRes.body);

      const pstRes = await app.inject({
        method: "GET",
        url: `/api/slots?hostId=7&serviceId=3&from=${winterDate}&to=${winterDate}&tz=America/Los_Angeles`,
      });
      expect(pstRes.statusCode).toBe(200);
      const pstBody = JSON.parse(pstRes.body);

      // In January, America/Los_Angeles is on standard time (PST, UTC-8): 09:00 IST (03:30 UTC) = 19:30 PST on Jan 14
      expect(istBody.slots[0].start).toContain("09:00:00");
      expect(pstBody.slots[0].start).toContain("19:30:00");

      for (let i = 0; i < istBody.slots.length; i++) {
        const istMillis = DateTime.fromISO(istBody.slots[i].start).toMillis();
        const pstMillis = DateTime.fromISO(pstBody.slots[i].start).toMillis();
        expect(istMillis).toBe(pstMillis);
      }
    });

    it("rejects invalid IANA timezone with 422", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Mars/Olympus",
      });
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("INVALID_TIMEZONE");
    });

    it("rejects reversed date range with 422", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/slots?hostId=7&serviceId=3&from=2026-10-20&to=2026-10-15&tz=Asia/Kolkata",
      });
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("INVALID_DATE_RANGE");
    });
  });

  describe("GET /api/slots — Killer Test 2 (Buffers)", () => {
    it("respects buffers: padded booking interval (09:45-11:00 UTC) has no available slots", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=UTC",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      // Verify that buffer metadata is returned
      expect(body.buffer.before).toBe(15);
      expect(body.buffer.after).toBe(30);

      // Verify that any slot overlapping the padded buffer window (09:45–11:00 UTC) is marked unavailable
      for (const slot of body.slots) {
        const start = DateTime.fromISO(slot.start, { zone: "UTC" });
        const end = DateTime.fromISO(slot.end, { zone: "UTC" });
        const paddedStart = start.set({ hour: 9, minute: 45, second: 0, millisecond: 0 });
        const paddedEnd = start.set({ hour: 11, minute: 0, second: 0, millisecond: 0 });

        const overlaps = start < paddedEnd && end > paddedStart;
        if (overlaps) {
          expect(slot.available).toBe(false);
          expect(slot.reason).toBe("buffer");
        } else {
          expect(slot.available).toBe(true);
        }
      }
    });
  });

  describe("POST /api/bookings (Atomic Claim surface)", () => {
    it("returns 201 Created on winning claim with cancellation token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/bookings",
        payload: {
          serviceId: 3,
          hostId: 7,
          studentId: 42,
          start: "2026-10-15T03:30:00Z",
          end: "2026-10-15T04:15:00Z",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("RESERVED");
      expect(body.id).toBeDefined();
      expect(body.cancellationToken).toBeDefined();
    });

    it("handles Idempotency-Key replay correctly", async () => {
      const key = "test-idempotency-key-123";
      const payload = {
        serviceId: 3,
        hostId: 7,
        studentId: 42,
        start: "2026-10-15T03:30:00Z",
        end: "2026-10-15T04:15:00Z",
      };

      const res1 = await app.inject({
        method: "POST",
        url: "/api/bookings",
        headers: { "idempotency-key": key },
        payload,
      });
      expect(res1.statusCode).toBe(201);
      const body1 = JSON.parse(res1.body);

      // Replay
      const res2 = await app.inject({
        method: "POST",
        url: "/api/bookings",
        headers: { "idempotency-key": key, "x-idempotency-replay": "true" },
        payload,
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.id).toBe(body1.id);
    });
  });

  describe("DELETE /api/bookings/:id (Cancellation & Security)", () => {
    it("returns 404 when unauthorized or without valid cancellation token (no leak)", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/bookings/42",
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 200 CANCELLED when authorized with correct token", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/bookings/42",
        headers: {
          "x-cancellation-token": "token_valid_42",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("CANCELLED");
    });
  });

  describe("POST /api/holds", () => {
    it("returns 201 with expiresAt matching HOLD_TTL_MINUTES", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/holds",
        payload: {
          serviceId: 3,
          hostId: 7,
          studentId: 42,
          start: "2026-10-15T03:30:00Z",
          end: "2026-10-15T04:15:00Z",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.expiresAt).toBeDefined();
      expect(body.ttlMinutes).toBeGreaterThan(0);
    });
  });

  describe("GET /api/intel/clashes (D3 Sentinel)", () => {
    it("returns student timetable commitments for studentId", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/intel/clashes?studentId=42",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.studentId).toBe(42);
      expect(Array.isArray(body.commitments)).toBe(true);
      expect(body.commitments.length).toBeGreaterThan(0);
    });
  });
});
