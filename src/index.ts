import Elysia from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "~modules/auth/route";
import { taskRoutes } from "~modules/tasks/route";

const app = new Elysia()
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "REST API Showcase",
          version: "1.0.0",
          description:
            "A clean REST API demonstrating routing, middleware, JWT auth, PostgreSQL (Prisma), Redis caching, and Kafka event streaming.",
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
      provider: "scalar",
      autoDarkMode: true,
      scalarConfig: { isEditable: true },
    })
  )
  .group("/api", (app) =>
    app
      .use(authRoutes)
      .use(taskRoutes)
  )
  .onError(({ code, error }) => {
    if (code === "NOT_FOUND") return { success: false, message: "Route not found", data: null };
    if (code === "VALIDATION") return { success: false, message: error.message, data: null };
    return { success: false, message: "Internal server error", data: null };
  })
  .listen(process.env.PORT ?? 3000);

export type App = typeof app;

console.log(`Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`Swagger docs at http://${app.server?.hostname}:${app.server?.port}/docs`);
