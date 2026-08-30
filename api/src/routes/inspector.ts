/* Inspector de API (panel /admin/api del frontend) — F7.
 *
 *   GET /api/admin/inspector   (superadmin / admin-general / admin-sede)
 *
 * Devuelve, en una sola llamada, el estado operativo del backend:
 *   - servicio: versión, uptime, NODE_ENV, versión de Node
 *   - db: conectividad + latencia de un SELECT 1
 *   - env: variables de entorno EN USO por el servidor, con los secretos
 *     SIEMPRE enmascarados (nunca se devuelve un valor sensible completo)
 *   - rutas: todos los endpoints registrados en Fastify (método + path),
 *     con una respuesta de ejemplo para los principales
 *   - erroresRecientes: ring-buffer en memoria de los últimos errores 5xx/4xx
 *     capturados por el error handler global
 *   - auditoría reciente (alcance por sede para admin-sede)
 *
 * RBAC duro: alumnos y profesores reciben 403. El modo demo es un alumno
 * client-side y nunca tiene token de staff, así que jamás llega acá. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { verifyAccessToken } from "../auth.js";
import type { AccessClaims } from "../auth.js";

/* ------------------------------------------------------------------ */
/* Registro de rutas (poblado por el hook onRoute en server.ts).        */
/* ------------------------------------------------------------------ */
export interface RouteEntry {
  method: string;
  url: string;
}
export const routeRegistry: RouteEntry[] = [];

export function registerRoute(method: string | string[], url: string) {
  const methods = Array.isArray(method) ? method : [method];
  for (const m of methods) {
    if (m === "HEAD" || m === "OPTIONS") continue;
    if (routeRegistry.some((r) => r.method === m && r.url === url)) continue;
    routeRegistry.push({ method: m, url });
  }
}

/* ------------------------------------------------------------------ */
/* Buffer de errores recientes (en memoria, máx. 50).                   */
/* ------------------------------------------------------------------ */
export interface ErrorEntry {
  at: string;
  status: number;
  method: string;
  url: string;
  message: string;
}
const MAX_ERRORS = 50;
const errorBuffer: ErrorEntry[] = [];

export function recordError(entry: ErrorEntry) {
  errorBuffer.unshift(entry);
  if (errorBuffer.length > MAX_ERRORS) errorBuffer.length = MAX_ERRORS;
}

const startedAt = new Date();

/* ------------------------------------------------------------------ */
/* Enmascarado de valores sensibles. Nunca devolvemos un secreto.       */
/* ------------------------------------------------------------------ */
function maskDatabaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  // postgres://user:PASSWORD@host:port/db → oculta solo la contraseña.
  return value.replace(/(:\/\/[^:@/]+):[^@]*@/, "$1:••••@");
}

interface EnvVar {
  name: string;
  scope: "server" | "client";
  /** true = se publica en el bundle del navegador (VITE_*). */
  public: boolean;
  set: boolean;
  /** Valor mostrado (enmascarado si es secreto). */
  value: string | null;
  note: string;
}

function collectEnv(): EnvVar[] {
  const e = process.env;
  return [
    { name: "NODE_ENV", scope: "server", public: false, set: !!e.NODE_ENV, value: e.NODE_ENV ?? null, note: "Modo de ejecución." },
    { name: "PORT", scope: "server", public: false, set: !!e.PORT, value: e.PORT ?? "3000 (default)", note: "Puerto interno del contenedor api." },
    { name: "LOG_LEVEL", scope: "server", public: false, set: !!e.LOG_LEVEL, value: e.LOG_LEVEL ?? "info (default)", note: "Nivel de log de Fastify." },
    { name: "CORS_ORIGIN", scope: "server", public: false, set: !!e.CORS_ORIGIN, value: e.CORS_ORIGIN ?? "https://typely.bauhub.online (default)", note: "Origen permitido por CORS." },
    { name: "DATABASE_URL", scope: "server", public: false, set: !!e.DATABASE_URL, value: maskDatabaseUrl(e.DATABASE_URL), note: "Conexión Postgres (secreto Docker; contraseña oculta)." },
    { name: "JWT_SECRET", scope: "server", public: false, set: !!e.JWT_SECRET, value: e.JWT_SECRET ? "•••• (configurado)" : null, note: "Firma de los access tokens. Nunca se muestra." },
    { name: "PUBLIC_ORIGIN", scope: "server", public: false, set: !!e.PUBLIC_ORIGIN, value: e.PUBLIC_ORIGIN ?? null, note: "Origen absoluto para armar links de invitación." },
    { name: "SUPERADMIN_EMAIL", scope: "server", public: false, set: !!e.SUPERADMIN_EMAIL, value: e.SUPERADMIN_EMAIL ?? "(solo lo usa el seed)", note: "Usado por dist/seed.js, no por el server." },
  ];
}

/* ------------------------------------------------------------------ */
/* Respuestas de ejemplo para los endpoints principales.                */
/* ------------------------------------------------------------------ */
const SAMPLES: Record<string, unknown> = {
  "GET /health": { ok: true, service: "typely-api", ts: "2026-06-09T12:00:00.000Z" },
  "POST /api/auth/login": { access: "<jwt>", refreshExpiresAt: "<iso>", user: { id: "<uuid>", email: "a@b.c", name: "Nombre", role: "admin-sede", sedeId: "<uuid>", mustChangePassword: false } },
  "POST /api/auth/refresh": { access: "<jwt>", refreshExpiresAt: "<iso>" },
  "GET /api/auth/me": { user: { id: "<uuid>", email: "a@b.c", name: "Nombre", role: "superadmin", sedeId: "<uuid>" } },
  "GET /api/users": [{ id: "<uuid>", email: "a@b.c", fullName: "Nombre", role: "alumno", sedeId: "<uuid>", active: true }],
  "GET /api/sedes": [{ id: "<uuid>", name: "Sede Principal", city: "Buenos Aires", active: true }],
  "GET /api/sedes/mine": { id: "<uuid>", name: "Sede Principal", city: "Buenos Aires" },
  "GET /api/classes": [{ id: "<uuid>", name: "4ºA", grade: "4ep", sedeId: "<uuid>", studentCount: 24, teacherCount: 1, status: "active" }],
  "GET /api/progress/me": [{ worldId: "island1", levelNumber: 1, completed: true, bestAccuracy: 96, attempts: 2 }],
  "POST /api/progress/complete": { ok: true, unlockedAchievements: ["primera-letra"] },
  "GET /api/me/stats": { stats: { levelsCompleted: 12, stars: 30, xp: 144, streakDays: 3 }, achievements: [{ id: "diez-niveles", unlockedAt: "<iso>" }] },
  "GET /api/teacher/students": [{ id: "<uuid>", fullName: "Alumno", classId: "<uuid>", progress: [] }],
  "GET /api/admin/overview": { counts: { courses: 3, teachers: 4, students: 60 }, activeToday: 12, avgProgress: 81, weekly: [], alerts: {}, attentionCourses: [], recent: [] },
  "GET /api/audit": [{ id: 1, action: "create_user", entityType: "user", at: "<iso>", actorName: "Admin" }],
  "GET /api/academic-years": [{ id: "<uuid>", label: "2026", isActive: true, closedAt: null }],
  "GET /api/admin/inspector": { service: "…", db: "…", env: "…", routes: "…", recentErrors: "…" },
};

async function requireInspectorAccess(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  const claims = await verifyAccessToken(auth.slice("Bearer ".length));
  if (claims.role !== "superadmin" && claims.role !== "admin") {
    throw Object.assign(new Error("No autorizado."), { status: 403 });
  }
  return claims;
}

export async function inspectorRoutes(app: FastifyInstance) {
  app.get("/api/admin/inspector", async (req, reply) => {
    const actor = await requireInspectorAccess(req);

    /* Salud de la DB: SELECT 1 cronometrado. */
    let dbOk = false;
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    const t0 = Date.now();
    try {
      await db.execute(sql`select 1`);
      dbOk = true;
      dbLatencyMs = Date.now() - t0;
    } catch {
      dbError = "No se pudo conectar a la base de datos.";
    }

    /* Auditoría reciente (alcance por sede para admin-sede). */
    let recentAudit: unknown[] = [];
    if (dbOk) {
      try {
        const where = actor.role === "admin" && actor.sede ? eq(schema.auditLog.sedeId, actor.sede) : undefined;
        recentAudit = await db
          .select({
            action: schema.auditLog.action,
            entityType: schema.auditLog.entityType,
            entityId: schema.auditLog.entityId,
            at: schema.auditLog.at,
            actorName: schema.users.fullName,
          })
          .from(schema.auditLog)
          .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
          .where(where)
          .orderBy(desc(schema.auditLog.at))
          .limit(15);
      } catch { /* tabla aún no creada — se muestra vacío */ }
    }

    const routes = [...routeRegistry]
      .sort((a, b) => (a.url === b.url ? a.method.localeCompare(b.method) : a.url.localeCompare(b.url)))
      .map((r) => ({ ...r, sample: SAMPLES[`${r.method} ${r.url}`] ?? null }));

    return reply.send({
      service: {
        name: "typely-api",
        version: "0.1.0",
        node: process.version,
        env: process.env.NODE_ENV ?? "development",
        startedAt: startedAt.toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      },
      db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
      env: collectEnv(),
      config: {
        accessTokenTtlMinutes: 15,
        refreshTokenTtlDays: 30,
        bodyLimitBytes: 1024 * 1024,
        bcryptCost: 12,
        corsOrigin: process.env.CORS_ORIGIN ?? "https://typely.bauhub.online",
      },
      routes,
      recentErrors: errorBuffer,
      recentAudit,
    });
  });
}
