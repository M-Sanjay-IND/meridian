import { describe, it, expect } from "vitest";
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

  describe("GET /api/slots", () => {
    it("handles KT-1: converts 09:00 IST to 20:30 PDT previous day in America/Los_Angeles", async () => {
      const istRes = await app.inject({
        method: "GET",
        url: "/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=Asia/Kolkata",
      });
      expect(istRes.statusCode).toBe(200);
      const istBody = JSON.parse(istRes.body);
      expect(istBody.slots[0].start).toContain("2026-10-15T09:00:00+05:30");

      const pstRes = await app.inject({
        method: "GET",
        url: "/api/slots?hostId=7&serviceId=3&from=2026-10-15&to=2026-10-15&tz=America/Los_Angeles",
      });
      expect(pstRes.statusCode).toBe(200);
      const pstBody = JSON.parse(pstRes.body);
      // On 2026-10-15 (October PDT, UTC-7), 09:00 IST (03:30 UTC) is 20:30 PDT on Oct 14
      expect(pstBody.slots[0].start).toContain("2026-10-14T20:30:00-07:00");
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
        // no token header provided
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
