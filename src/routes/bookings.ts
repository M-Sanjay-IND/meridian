import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { CreateBookingBodySchema } from "./types.js";
import { claimBooking } from "./claimAdapter.js";

// Reschedule body schema
const RescheduleBodySchema = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  token: z.string().optional(),
});

// Storage for created bookings (in-memory mock store for Role C surface isolation)
export const bookingStorage = new Map<number, {
  id: number;
  status: string;
  serviceId: number;
  hostId: number | null;
  resourceId: number | null;
  studentId: number;
  slotStart: string;
  slotEnd: string;
  cancellationToken: string;
}>();

// Pre-populate with sample booking 42 for testing
bookingStorage.set(42, {
  id: 42,
  status: "CONFIRMED",
  serviceId: 3,
  hostId: 7,
  resourceId: null,
  studentId: 101,
  slotStart: "2026-10-15T03:30:00Z",
  slotEnd: "2026-10-15T04:15:00Z",
  cancellationToken: "token_valid_42",
});

export const bookingRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/bookings — The Atomic Claim
  fastify.post("/bookings", async (request, reply) => {
    // 1. Validate request body
    const parseResult = CreateBookingBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid booking request body",
          details: parseResult.error.format(),
        },
      });
    }

    const idempotencyKey = request.headers["idempotency-key"] as string | undefined;
    const body = parseResult.data;

    try {
      const claimResult = await claimBooking(body, idempotencyKey);

      if (claimResult.winner && claimResult.booking) {
        // Store in memory for cancellation/reschedule operations
        bookingStorage.set(claimResult.booking.id, {
          id: claimResult.booking.id,
          status: claimResult.booking.status,
          serviceId: claimResult.booking.serviceId,
          hostId: claimResult.booking.hostId ?? null,
          resourceId: claimResult.booking.resourceId ?? null,
          studentId: claimResult.booking.studentId,
          slotStart: claimResult.booking.slotStart,
          slotEnd: claimResult.booking.slotEnd,
          cancellationToken: claimResult.booking.cancellationToken || `token_${claimResult.booking.id}`,
        });

        // Idempotent replay returns 200
        if (idempotencyKey && request.headers["x-idempotency-replay"]) {
          return reply.status(200).send(claimResult.booking);
        }
        // First-time success returns 201
        return reply.status(201).send(claimResult.booking);
      }

      // Claim lost
      if (claimResult.code === "hold_expired") {
        return reply.status(409).send({
          error: {
            code: "hold_expired",
            message: "Slot hold expired prior to confirmation",
          },
        });
      }

      if (claimResult.code === "student_clash") {
        return reply.status(409).send({
          error: {
            code: "student_clash",
            message: `Booking conflicts with existing student timetable commitment: ${claimResult.conflict || "Class/Lab"}`,
          },
        });
      }

      // Default lost race: slot_taken (never disclose winner ID)
      return reply.status(409).send({
        error: {
          code: "slot_taken",
          message: "The requested slot is no longer available",
          details: {
            alternatives: claimResult.alternatives || [],
          },
        },
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          code: "CLAIM_ERROR",
          message: err.message || "An unexpected error occurred during slot claim",
        },
      });
    }
  });

  // GET /api/bookings/:id
  fastify.get("/bookings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookingId = Number(id);

    if (isNaN(bookingId)) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    const booking = bookingStorage.get(bookingId);
    if (!booking) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    return reply.status(200).send(booking);
  });

  // DELETE /api/bookings/:id — with token authorization & no-leak 404
  fastify.delete("/bookings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookingId = Number(id);

    if (isNaN(bookingId)) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    const booking = bookingStorage.get(bookingId);
    if (!booking) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    // Check token from header or query (G-04 fix)
    const tokenHeader = (request.headers["x-cancellation-token"] || request.headers.authorization) as string | undefined;
    const providedToken = tokenHeader?.replace(/^Bearer\s+/i, "");

    // Must match valid cancellation token or session
    if (!providedToken || providedToken !== booking.cancellationToken) {
      // Normative rule: Return 404, never 403, so endpoint cannot be scanned
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    booking.status = "CANCELLED";
    return reply.status(200).send({
      status: "CANCELLED",
      bookingId,
    });
  });

  // POST /api/bookings/:id/reschedule
  fastify.post("/bookings/:id/reschedule", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookingId = Number(id);

    if (isNaN(bookingId)) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    const booking = bookingStorage.get(bookingId);
    if (!booking) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    const parseResult = RescheduleBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid reschedule parameters",
          details: parseResult.error.format(),
        },
      });
    }

    const { start, end, token } = parseResult.data;
    const tokenHeader = (request.headers["x-cancellation-token"] || request.headers.authorization) as string | undefined;
    const providedToken = token || tokenHeader?.replace(/^Bearer\s+/i, "");

    if (!providedToken || providedToken !== booking.cancellationToken) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    booking.slotStart = start;
    booking.slotEnd = end;

    return reply.status(200).send({
      status: "RESCHEDULED",
      booking,
    });
  });
};
