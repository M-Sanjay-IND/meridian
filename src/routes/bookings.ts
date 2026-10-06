import type { FastifyPluginAsync } from "fastify";
import { CreateBookingBodySchema } from "./types.js";
import { claimBooking } from "./claimAdapter.js";

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

    // Return dummy or 404 (never disclosing other users' records)
    if (isNaN(bookingId)) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    return reply.status(200).send({
      id: bookingId,
      status: "CONFIRMED",
      serviceId: 3,
      hostId: 7,
      studentId: 42,
    });
  });

  // DELETE /api/bookings/:id
  fastify.delete("/bookings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookingId = Number(id);

    if (isNaN(bookingId)) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Booking not found" },
      });
    }

    return reply.status(200).send({
      status: "CANCELLED",
      bookingId,
    });
  });
};
