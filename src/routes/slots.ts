import type { FastifyPluginAsync } from "fastify";
import { IANAZone, DateTime } from "luxon";
import { GetSlotsQuerySchema } from "./types.js";
import { getSlotsFromEngine } from "./engineAdapter.js";

export const slotRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/slots", async (request, reply) => {
    // 1. Validate query parameters
    const parseResult = GetSlotsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters for slots endpoint",
          details: parseResult.error.format(),
        },
      });
    }

    const query = parseResult.data;

    // 2. Validate IANA timezone
    if (!IANAZone.isValidZone(query.tz)) {
      return reply.status(422).send({
        error: {
          code: "INVALID_TIMEZONE",
          message: `Timezone '${query.tz}' is not a valid IANA timezone identifier`,
        },
      });
    }

    // 3. Validate date ranges (to >= from, max 31 days)
    const fromDt = DateTime.fromISO(query.from);
    const toDt = DateTime.fromISO(query.to);

    if (toDt < fromDt) {
      return reply.status(422).send({
        error: {
          code: "INVALID_DATE_RANGE",
          message: "'to' date cannot be before 'from' date",
        },
      });
    }

    const maxDays = Number(process.env.SLOT_RANGE_MAX_DAYS) || 31;
    const diffDays = toDt.diff(fromDt, "days").days;
    if (diffDays > maxDays) {
      return reply.status(422).send({
        error: {
          code: "RANGE_TOO_LARGE",
          message: `Requested date range exceeds maximum allowed of ${maxDays} days`,
        },
      });
    }

    try {
      const response = await getSlotsFromEngine(query);
      return reply.status(200).send(response);
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          code: "ENGINE_ERROR",
          message: err.message || "Failed to compute slots",
        },
      });
    }
  });
};
