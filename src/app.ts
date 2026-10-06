import fastify from "fastify";
import cors from "@fastify/cors";
import path from "node:path";
import fs from "node:fs";
import { healthRoutes } from "./routes/health.js";
import { slotRoutes } from "./routes/slots.js";
import { bookingRoutes } from "./routes/bookings.js";
import { holdRoutes } from "./routes/holds.js";
import { metaRoutes } from "./routes/meta.js";
import { intelRoutes } from "./routes/intel.js";

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
  app.register(slotRoutes, { prefix: "/api" });
  app.register(bookingRoutes, { prefix: "/api" });
  app.register(holdRoutes, { prefix: "/api" });
  app.register(metaRoutes, { prefix: "/api" });
  app.register(intelRoutes, { prefix: "/api" });

  // Serve compiled React frontend if web/dist exists and static plugin is available
  const webDistPath = path.resolve(process.cwd(), "web/dist");
  if (fs.existsSync(webDistPath)) {
    const staticPluginPkg = "@fastify/static";
    import(staticPluginPkg)
      .then((fastifyStatic: any) => {
        app.register(fastifyStatic.default || fastifyStatic, {
          root: webDistPath,
          prefix: "/",
        });
      })
      .catch(() => {});
  }

  return app;
}
