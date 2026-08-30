/* Auth — JWT access tokens (15 min) + opaque refresh tokens (30 days,
   stored hashed in the DB so a stolen DB row can't be replayed).

   Las contraseñas se hashean con bcrypt coste 12. La única forma de entrar
   es con una cuenta creada por un administrador: no hay proveedores
   externos de identidad. */

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { db, schema } from "./db/index.js";
import { eq, and, isNull, gt } from "drizzle-orm";
import type { Role } from "./db/schema.js";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const BCRYPT_COST = 12;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required.");
const secret = new TextEncoder().encode(JWT_SECRET);


export interface AccessClaims {
  sub: string;        // user id
  role: Role;
  /** Sede a la que pertenece. `null` solo para el superadmin. */
  sede: string | null;
  /** Identidad primaria — la tienen todos, incluido el alumno sin email. */
  username: string;
  /** Opcional: para contacto y recuperación de cuenta. */
  email: string | null;
  name: string;
}

export async function signAccessToken(claims: AccessClaims, ttlSeconds = ACCESS_TTL_SECONDS): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: String(payload.sub),
    role: payload.role as Role,
    sede: (payload.sede as string | null) ?? null,
    username: String(payload.username),
    email: (payload.email as string | null) ?? null,
    name: String(payload.name),
  };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

export async function issueRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
  await db.insert(schema.refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function consumeRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(schema.refreshTokens)
    .where(
      and(
        eq(schema.refreshTokens.tokenHash, tokenHash),
        isNull(schema.refreshTokens.revokedAt),
        gt(schema.refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(schema.refreshTokens.id, row.id));
  return row;
}

/* Corta TODAS las sesiones de una cuenta. Se llama al desactivarla,
   borrarla o cambiarle la contraseña: sin esto, el usuario seguiría
   renovando su access token con un refresh viejo y la desactivación no
   tendría efecto real. */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)),
    );
}

