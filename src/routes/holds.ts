import type { FastifyPluginAsync } from "fastify";
import { DateTime } from "luxon";
import { CreateHoldBodySchema, type HoldResponse } from "./types.js";

export const holdRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/holds", async (request, reply) => {
    const parseResult = CreateHoldBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid hold request body",
          details: parseResult.error.format(),
        },
      });
    }

    const body = parseResult.data;

    // Read TTL from environment variable as mandated by Rule X2
    const ttlMinutes = Number(process.env.HOLD_TTL_MINUTES) || 10;
    const expiresAt = DateTime.now().plus({ minutes: ttlMinutes }).toISO({ suppressMilliseconds: true, includeOffset: true })!;

    const response: HoldResponse = {
      id: Math.floor(Math.random() * 10000) + 1,
      expiresAt,
      ttlMinutes,
      slotStart: body.start,
      slotEnd: body.end,
    };

    return reply.status(201).send(response);
  });
};
