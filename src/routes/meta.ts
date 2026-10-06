import type { FastifyPluginAsync } from "fastify";

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/hosts
  fastify.get("/hosts", async (_request, reply) => {
    return reply.status(200).send({
      hosts: [
        { id: 7, name: "Prof. Rao", email: "rao@campus.edu", timeZone: "Asia/Kolkata" },
        { id: 8, name: "Dr. Sharma", email: "sharma@campus.edu", timeZone: "Asia/Kolkata" },
      ],
    });
  });

  // GET /api/resources
  fastify.get("/resources", async (_request, reply) => {
    return reply.status(200).send({
      resources: [
        { id: 1, name: "Lab A", kind: "LAB", capacity: 20 },
        { id: 2, name: "Lab B", kind: "LAB", capacity: 24 },
        { id: 3, name: "Lab C", kind: "LAB", capacity: 24 },
        { id: 4, name: "Lab D", kind: "LAB", capacity: 30 },
        { id: 5, name: "Lab E", kind: "LAB", capacity: 12 },
      ],
    });
  });

  // GET /api/services
  fastify.get("/services", async (_request, reply) => {
    return reply.status(200).send({
      services: [
        { id: 1, name: "Quick Check-in", durationMins: 15, beforeBuffer: 5, afterBuffer: 5, seatsPerSlot: 1 },
        { id: 2, name: "General Consultation", durationMins: 30, beforeBuffer: 10, afterBuffer: 10, seatsPerSlot: 1 },
        { id: 3, name: "Office Hours", durationMins: 45, beforeBuffer: 15, afterBuffer: 30, seatsPerSlot: 1, hostId: 7 },
        { id: 4, name: "Lab Session B", durationMins: 60, beforeBuffer: 15, afterBuffer: 15, seatsPerSlot: 24, resourceId: 2 },
      ],
    });
  });
};
