/* Punto único donde se resuelve "quién está haciendo esta petición".
 *
 * Antes cada archivo de rutas definía su propia `requireUser` /
 * `requireStaff` / `requireAdminOrAbove` — ocho copias casi iguales, y
 * ninguna forma de saber si una ruta nueva se había olvidado de llamar a
 * la suya. Ahora el token se verifica UNA vez en un hook global y queda
 * en `req.actor`; las rutas solo declaran qué necesitan.
 *
 * Nota sobre desactivación de cuentas: el access token dura 15 minutos y
 * no se consulta la base en cada petición. Desactivar o borrar a alguien
 * corta su sesión al vencer el token, no en el instante — por eso el
 * endpoint que desactiva TAMBIÉN revoca sus refresh tokens, que es lo que
 * impide que la renueve.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifyAccessToken } from "./auth.js";
import {
  ForbiddenError,
  UnauthorizedError,
  assertCan,
  type Actor,
  type Permission,
} from "./rbac.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Quién hace la petición, o null si no mandó un token válido. */
    actor: Actor | null;
  }
}

/** Registra el hook global. Va ANTES de las rutas en `server.ts`. */
export function registerAuthContext(app: FastifyInstance): void {
  app.decorateRequest("actor", null);

  app.addHook("onRequest", async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      const claims = await verifyAccessToken(header.slice("Bearer ".length));
      req.actor = {
        id: claims.sub,
        role: claims.role,
        sedeId: claims.sede,
        email: claims.email,
        username: claims.username,
        name: claims.name,
      };
    } catch {
      /* Token vencido o inválido → se queda en null y la ruta responde 401
         cuando pida un actor. No cortamos acá porque hay rutas públicas
         (login, aceptar invitación, health). */
    }
  });
}

/** El actor autenticado, o 401. */
export function requireActor(req: FastifyRequest): Actor {
  if (!req.actor) throw new UnauthorizedError();
  return req.actor;
}

/** El actor, siempre que tenga el permiso pedido. 401 si no hay sesión,
 *  403 si la hay pero no alcanza. */
export function requirePermission(req: FastifyRequest, permission: Permission): Actor {
  const actor = requireActor(req);
  assertCan(actor.role, permission);
  return actor;
}

/** Para las pocas rutas donde la regla es "este rol y ningún otro". */
export function requireRole(req: FastifyRequest, ...roles: Actor["role"][]): Actor {
  const actor = requireActor(req);
  if (!roles.includes(actor.role)) {
    throw new ForbiddenError("No tenés permiso para hacer esto.");
  }
  return actor;
}
