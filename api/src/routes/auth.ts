/* Auth routes — login (manual + Google), refresh, logout, me.
 *
 * Manual: POST /api/auth/login { email|username, password } → access cookie
 *   + refresh cookie. Students are blocked here — the staff form is for
 *   staff. (Demo mode stays client-side and never reaches the API.)
 * Google: POST /api/auth/google { credential } → looks up by google_sub,
 *   falls back to matching email, attaches google_sub on first success.
 *   Unknown email is a friendly Spanish 404 (never auto-creates a
 *   privileged account).
 *
 * Cookies are HTTP-only, SameSite=Lax, Secure in production. The proxy
 * terminates TLS so `secure: true` is safe in prod. */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, or, and, sql } from "drizzle-orm";
import {
  comparePassword,
  consumeRefreshToken,
  hashToken,
  issueRefreshToken,
  signAccessToken,
  verifyAccessToken,
  verifyGoogleIdToken,
} from "../auth.js";
import type { AccessClaims } from "../auth.js";

const REFRESH_COOKIE = "typely_refresh";
const ACCESS_HEADER = "x-typely-access"; // short-lived, sent to the SPA via header

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge: 30 * 24 * 60 * 60,
  });
}

async function buildAccessAndRefresh(user: { id: string; role: schema.Role; sedeId: string | null; email: string; fullName: string }) {
  const access = await signAccessToken({
    sub: user.id,
    role: user.role,
    sede: user.sedeId,
    email: user.email,
    name: user.fullName,
  });
  const { token: refresh, expiresAt } = await issueRefreshToken(user.id);
  return { access, refresh, refreshExpiresAt: expiresAt };
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  username: z.string().trim().min(1).optional(),
  password: z.string().min(1),
});

const googleSchema = z.object({
  credential: z.string().min(10),
});

export async function authRoutes(app: FastifyInstance) {
  /* ----- POST /api/auth/login ----- */
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const { email, username, password } = parsed.data;
    if (!email && !username) return reply.code(400).send({ error: "Falta email o usuario." });

    const rows = await db
      .select()
      .from(schema.users)
      .where(
        email
          ? sql`lower(${schema.users.email}) = ${email}`
          : eq(schema.users.username, username!),
      )
      .limit(1);
    const user = rows[0];
    if (!user || !user.passwordHash || !user.active) {
      return reply.code(401).send({ error: "Email o contraseña incorrectos." });
    }
    // Students never sign in through the staff form.
    if (user.role === "alumno") {
      return reply.code(403).send({ error: "Los estudiantes no inician sesión desde este formulario." });
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Email o contraseña incorrectos." });

    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    const { access, refresh, refreshExpiresAt } = await buildAccessAndRefresh(user);
    setRefreshCookie(reply, refresh);
    return reply.send({
      access,
      refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        username: user.username,
        role: user.role,
        sedeId: user.sedeId,
        classId: user.classId,
        mustChangePassword: user.mustChangePassword,
      },
    });
  });

  /* ----- POST /api/auth/google ----- */
  app.post("/api/auth/google", async (req, reply) => {
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Credencial inválida." });
    const claims = await verifyGoogleIdToken(parsed.data.credential);
    if (!claims) return reply.code(401).send({ error: "No pudimos verificar tu cuenta de Google." });
    if (!claims.emailVerified) {
      return reply.code(403).send({ error: "Tu email de Google todavía no está verificado." });
    }
    const rows = await db
      .select()
      .from(schema.users)
      .where(
        or(
          eq(schema.users.googleSub, claims.sub),
          sql`lower(${schema.users.email}) = ${claims.email}`,
        ),
      )
      .limit(1);
    const user = rows[0];
    if (!user || !user.active) {
      return reply.code(404).send({ error: "No encontramos una cuenta con ese email. Pedile a tu administrador que te cree una." });
    }
    if (user.role === "alumno") {
      return reply.code(403).send({ error: "Los estudiantes no inician sesión desde este formulario." });
    }
    // Attach google_sub on first successful Google login.
    if (!user.googleSub) {
      await db.update(schema.users).set({ googleSub: claims.sub }).where(eq(schema.users.id, user.id));
    }
    await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
    const { access, refresh, refreshExpiresAt } = await buildAccessAndRefresh(user);
    setRefreshCookie(reply, refresh);
    return reply.send({
      access,
      refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        username: user.username,
        role: user.role,
        sedeId: user.sedeId,
        classId: user.classId,
        mustChangePassword: false, // Google proves identity → no forced change
      },
    });
  });

  /* ----- POST /api/auth/refresh ----- */
  app.post("/api/auth/refresh", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) return reply.code(401).send({ error: "Sin sesión activa." });
    const row = await consumeRefreshToken(token);
    if (!row) return reply.code(401).send({ error: "Sesión expirada." });
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, row.userId)).limit(1);
    if (!user || !user.active) return reply.code(401).send({ error: "Cuenta desactivada." });
    const { access, refresh, refreshExpiresAt } = await buildAccessAndRefresh(user);
    setRefreshCookie(reply, refresh);
    return reply.send({ access, refreshExpiresAt });
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

  /* ----- GET /api/auth/me ----- */
  app.get("/api/auth/me", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Sin sesión activa." });
    }
    try {
      const claims = await verifyAccessToken(auth.slice("Bearer ".length));
      return reply.send({
        user: {
          id: claims.sub,
          email: claims.email,
          name: claims.name,
          role: claims.role,
          sedeId: claims.sede,
        },
      });
    } catch {
      return reply.code(401).send({ error: "Sesión inválida." });
    }
  });
}
