import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const ClashesQuerySchema = z.object({
  studentId: z.coerce.number().int().positive(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const intelRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/intel/clashes?studentId=&from=&to= (D3)
  fastify.get("/intel/clashes", async (request, reply) => {
    const parseResult = ClashesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters for clashes",
          details: parseResult.error.format(),
        },
      });
    }

    const { studentId } = parseResult.data;

    // Student timetable commitments (e.g., student 42 has CS3011 lecture on 2026-10-15 10:00-11:30 IST)
    const mockCommitments = [
      {
        id: 1,
        studentId,
        label: "CS3011 Operating Systems Lecture",
        slotStart: "2026-10-15T04:30:00Z", // 10:00 IST
        slotEnd: "2026-10-15T06:00:00Z",   // 11:30 IST
        source: "timetable",
      },
      {
        id: 2,
        studentId,
        label: "EE2014 Signals Laboratory",
        slotStart: "2026-10-15T08:30:00Z", // 14:00 IST
        slotEnd: "2026-10-15T10:30:00Z",   // 16:00 IST
        source: "timetable",
      },
    ];

    return reply.status(200).send({
      studentId,
      commitments: mockCommitments,
      hasClash: false,
    });
  });
};
