/* TYPELY API — Fastify server entry.
 *
 * Responsibilities:
 *   - Boot Fastify with cookie + CORS support
 *   - Register all route modules
 *   - Health check at /health
 *   - Top-level error handler that translates to friendly Spanish JSON
 *   - Graceful shutdown so the container can roll without dropping requests
 */

import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { sql } from "./db/index.js";
import { runMigrations } from "./db/migrate.js";
import { authRoutes } from "./routes/auth.js";

import { sedeRoutes } from "./routes/sedes.js";
import { userRoutes } from "./routes/users.js";
import { progressRoutes } from "./routes/progress.js";
import { importRoutes } from "./routes/import.js";
import { groupRoutes } from "./routes/groups.js";
import { adminRoutes } from "./routes/admin.js";
import { inspectorRoutes, registerRoute, recordError } from "./routes/inspector.js";
import { registerAuthContext } from "./authContext.js";

const PORT = Number(process.env.PORT ?? 3000);
/* Acepta una lista separada por comas: Coolify le asignó al sitio tanto el
   dominio pelado como el www, y los dos tienen que poder llamar a la API. */
const ORIGIN = (process.env.CORS_ORIGIN ?? "https://typely.becode.com.ar,https://www.typely.becode.com.ar")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

async function main() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    trustProxy: true, // behind Caddy
    bodyLimit: 1 * 1024 * 1024, // 1 MB — enough for CSV imports later
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: ORIGIN,
    credentials: true,
  });

  /* Inventario de rutas para el inspector de API (/api/admin/inspector).
     El hook tiene que registrarse ANTES de las rutas para verlas todas. */
  app.addHook("onRoute", (route) => {
    registerRoute(route.method as string | string[], route.url);
  });

  /* Migraciones pendientes + ventana de particiones de `attempts`.
     Si esto falla NO se levanta: servir la API contra un esquema a medias
     hace mucho más daño que no arrancar. Coolify reintenta el contenedor. */
  const migrations = await runMigrations(sql, (m) => app.log.info(m));
  if (migrations.applied.length) {
    app.log.info({ applied: migrations.applied }, "migraciones aplicadas");
  }

  /* Top-level error handler: never leak stack traces, always Spanish.
     IMPORTANT: must be set BEFORE registering the route plugins — Fastify
     only propagates a custom error handler to child contexts created
     after it is set. (Set after the routes, every thrown 401/403 fell
     through to Fastify's default English `{statusCode,error,message}`.) */
  app.setErrorHandler((err, req, reply) => {
    const status = (err as any).status ?? (err as any).statusCode ?? 500;
    if (status >= 500) app.log.error({ err }, "unhandled error");
    recordError({
      at: new Date().toISOString(),
      status,
      method: req.method,
      url: req.url,
      message: status >= 500 ? "Error interno del servidor." : err.message,
    });
    reply.code(status).send({
      error: status >= 500 ? "Error interno del servidor." : err.message,
    });
  });

  /* Resolución de identidad: el token se verifica UNA vez acá y queda en
     `req.actor`. Va ANTES de las rutas para que ninguna quede sin cubrir. */
  registerAuthContext(app);

  /* Health check — used by the Caddy reverse-proxy to know we're up.
     Also exposed as /api/health so the PUBLIC https://…/api/health probe
     works through Caddy (which proxies /api/* preserving the path). */
  const health = async () => ({ ok: true, service: "typely-api", ts: new Date().toISOString() });
  app.get("/health", health);
  app.get("/api/health", health);

  /* Domain routes */
  await app.register(authRoutes);
  await app.register(sedeRoutes);
  await app.register(userRoutes);
  await app.register(progressRoutes);
  await app.register(importRoutes);
  await app.register(groupRoutes);
  await app.register(adminRoutes);
  await app.register(inspectorRoutes);

  /* Graceful shutdown. */
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    try { await app.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`typely-api listening on :${PORT}`);
}

main().catch((err) => {
  console.error("fatal startup error", err);
  process.exit(1);
});
