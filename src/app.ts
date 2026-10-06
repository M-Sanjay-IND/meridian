import fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";

export function buildApp() {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Enable CORS
  app.register(cors, {
    origin: true,
  });

  // Custom standard error handler matching docs/API.md
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "An unexpected error occurred",
        details: (error as any).details || undefined,
      },
    });
  });

  // Register route groups under /api
  app.register(healthRoutes, { prefix: "/api" });

  return app;
}
