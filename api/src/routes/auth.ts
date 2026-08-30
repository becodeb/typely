/* Rutas de autenticación — login, refresh, logout, me.
 *
 * EL CAMBIO CENTRAL DE ESTA VERSIÓN: hay UN solo login para los cuatro
 * roles. El código anterior devolvía 403 si `role === "alumno"`, así que un
 * alumno literalmente no podía entrar: su única puerta era el modo demo
 * (anónimo, sin token). Como el demo tampoco manda progreso a la API, las
 * tablas de progreso quedaban vacías y los dashboards mostraban ceros.
 *
 * Identidad: se entra con `identifier`, que puede ser el usuario o el
 * email. El alumno de primaria no tiene email y entra con usuario; el
 * staff suele usar el email. Las dos columnas son citext, así que la
 * comparación ya es insensible a mayúsculas.
 *
 * NO hay proveedores externos de identidad. La única forma de entrar es con
 * una cuenta que creó un administrador — es lo que quiere una escuela, que
 * reparte credenciales y no deja que cualquiera con un correo entre solo.
 *
 * Las cookies son HTTP-only, SameSite=Lax y Secure en producción.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, isNull, or } from "drizzle-orm";
import {
  comparePassword,
  consumeRefreshToken,
  hashToken,
  issueRefreshToken,
  signAccessToken,
} from "../auth.js";
import { requireActor } from "../authContext.js";

const REFRESH_COOKIE = "typely_refresh";

/* Mensaje único para credenciales malas: no revela si el usuario existe. */
const BAD_CREDENTIALS = "Usuario o contraseña incorrectos.";

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge: 30 * 24 * 60 * 60,
  });
}

type SessionUser = Pick<
  schema.DbUser,
  "id" | "role" | "sedeId" | "groupId" | "username" | "email" | "fullName" | "mustChangePassword"
>;

async function buildSession(user: SessionUser) {
  const access = await signAccessToken({
    sub: user.id,
    role: user.role,
    sede: user.sedeId,
    username: user.username,
    email: user.email,
    name: user.fullName,
  });
  const { token: refresh, expiresAt } = await issueRefreshToken(user.id);
  return { access, refresh, refreshExpiresAt: expiresAt };
}

/** Forma pública de la sesión. `groupId` viaja para que el alumno sepa a
 *  qué grupo pertenece sin una consulta extra. */
function publicUser(user: SessionUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.fullName,
    role: user.role,
    sedeId: user.sedeId,
    groupId: user.groupId,
    mustChangePassword: user.mustChangePassword,
  };
}

/* -------------------------------------------------------------------- */
/* Freno de fuerza bruta                                                 */
/* -------------------------------------------------------------------- */
/* Los alumnos tienen contraseñas cortas generadas por el admin, así que
   un login sin freno es adivinable. Esto es deliberadamente simple: un
   contador en memoria por identificador. Se pierde al reiniciar y no se
   comparte entre réplicas — alcanza para frenar un script casero, no para
   un atacante distribuido. Si algún día hay más de una réplica, esto pasa
   a Redis o a @fastify/rate-limit. */
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 10 * 60 * 1000;
const failures = new Map<string, { count: number; until: number }>();

function throttleKey(identifier: string, ip: string): string {
  return `${identifier.toLowerCase()}|${ip}`;
}

function isLockedOut(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = failures.get(key);
  const count = entry && Date.now() <= entry.until ? entry.count + 1 : 1;
  failures.set(key, { count, until: Date.now() + LOCKOUT_MS });
}

function clearFailures(key: string): void {
  failures.delete(key);
}

/* -------------------------------------------------------------------- */

const loginSchema = z.object({
  /* Usuario o email — el mismo campo para los dos, como en el formulario. */
  identifier: z.string().trim().min(1, "Falta el usuario."),
  password: z.string().min(1, "Falta la contraseña."),
});

export async function authRoutes(app: FastifyInstance) {
  /* ----- POST /api/auth/login ----- */
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const { identifier, password } = parsed.data;

    const key = throttleKey(identifier, req.ip);
    if (isLockedOut(key)) {
      return reply
        .code(429)
        .send({ error: "Demasiados intentos fallidos. Probá de nuevo en unos minutos." });
    }

    /* Un solo lookup por usuario O email. Ambas columnas son citext. */
    const [user] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          or(eq(schema.users.username, identifier), eq(schema.users.email, identifier)),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    /* Se compara siempre contra algo, exista el usuario o no, para que el
       tiempo de respuesta no delate qué cuentas existen. */
    const hash = user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const passwordOk = await comparePassword(password, hash);

    if (!user || !user.passwordHash || !passwordOk) {
      recordFailure(key);
      return reply.code(401).send({ error: BAD_CREDENTIALS });
    }
    if (!user.active) {
      recordFailure(key);
      return reply
        .code(403)
        .send({ error: "Tu cuenta está desactivada. Hablá con tu administrador." });
    }

    clearFailures(key);
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    const { access, refresh, refreshExpiresAt } = await buildSession(user);
    setRefreshCookie(reply, refresh);
    return reply.send({ access, refreshExpiresAt, user: publicUser(user) });
  });

  /* ----- POST /api/auth/refresh ----- */
  app.post("/api/auth/refresh", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) return reply.code(401).send({ error: "Sin sesión activa." });

    const row = await consumeRefreshToken(token);
    if (!row) {
      reply.clearCookie(REFRESH_COOKIE, { path: "/api" });
      return reply.code(401).send({ error: "Sesión expirada." });
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, row.userId), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!user || !user.active) {
      reply.clearCookie(REFRESH_COOKIE, { path: "/api" });
      return reply.code(401).send({ error: "Cuenta desactivada." });
    }

    const { access, refresh, refreshExpiresAt } = await buildSession(user);
    setRefreshCookie(reply, refresh);
    return reply.send({ access, refreshExpiresAt, user: publicUser(user) });
  });

  /* ----- POST /api/auth/logout ----- */
  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) {
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.tokenHash, hashToken(token)));
    }
    reply.clearCookie(REFRESH_COOKIE, { path: "/api" });
    return reply.send({ ok: true });
  });

  /* ----- GET /api/auth/me -----
     Lee de la base y no solo del token, para que un cambio de grupo o de
     nombre se vea sin esperar a que venza el access token. */
  app.get("/api/auth/me", async (req, reply) => {
    const actor = requireActor(req);
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, actor.id), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Sesión inválida." });
    }
    return reply.send({ user: publicUser(user) });
  });
}
