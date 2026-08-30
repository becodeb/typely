/* Control de acceso — el ÚNICO lugar que autoriza.
 *
 * Los chequeos de rol del frontend son comodidad para la UI; este módulo
 * es el que decide. Toda ruta que muta algo pasa por acá.
 *
 * Por qué una matriz explícita y no un ranking numérico: el modelo viejo
 * ordenaba los roles con números (alumno=1 … superadmin=5) y preguntaba
 * "¿el rango del objetivo es <= al mío?". Eso no puede expresar la regla
 * que sí necesitamos — "un admin NUNCA crea otro admin" — porque un admin
 * siempre tiene el mismo rango que otro admin. Terminaba parcheado con
 * excepciones sueltas. Acá cada rol declara qué puede hacer y qué roles
 * puede otorgar, y punto.
 *
 * Los cuatro roles:
 *   superadmin — la plataforma. No pertenece a ninguna sede.
 *   admin      — UNA sede: crea alumnos y docentes, arma grupos, ve todo lo suyo.
 *   docente    — sus grupos.
 *   alumno     — él mismo.
 */

import type { Role } from "./db/schema.js";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Sin sesión.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/* -------------------------------------------------------------------- */
/* Permisos                                                              */
/* -------------------------------------------------------------------- */

export type Permission =
  /* Sedes — solo la plataforma las administra. */
  | "sede:read"
  | "sede:write"
  /* Usuarios. El alcance (qué usuarios) lo resuelve `scopeOf`, no esto. */
  | "user:read"
  | "user:create"
  | "user:update"
  | "user:delete"
  | "user:reset-password"
  | "user:import"
  /* Grupos. */
  | "group:read"
  | "group:write"
  /* Selección de islas habilitadas de un grupo — el docente la administra. */
  | "group:worlds:write"
  /* Progreso propio (jugar) y progreso de otros (dashboards). */
  | "progress:write-own"
  | "progress:read-scope"
  /* Superficies de diagnóstico. */
  | "audit:read"
  | "inspector:read";

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  superadmin: [
    "sede:read",
    "sede:write",
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "user:reset-password",
    "user:import",
    "group:read",
    "group:write",
    "group:worlds:write",
    "progress:read-scope",
    "audit:read",
    "inspector:read",
    /* El superadmin tambien juega para probar niveles. */
    "progress:write-own",
  ],
  admin: [
    /* Ve su sede, no la administra: crearlas y editarlas es de plataforma. */
    "sede:read",
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "user:reset-password",
    "user:import",
    "group:read",
    "group:write",
    "group:worlds:write",
    "progress:read-scope",
    "audit:read",
    "inspector:read",
  ],
  docente: [
    "user:read",
    /* Puede resetear la contraseña de un alumno suyo — es el caso real de
       "me la olvidé" en el aula, y no requiere molestar al admin. No puede
       crear ni borrar cuentas. */
    "user:reset-password",
    "group:read",
    "group:worlds:write",
    "progress:read-scope",
  ],
  alumno: ["progress:write-own"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError("No tenés permiso para hacer esto.");
  }
}

/* -------------------------------------------------------------------- */
/* Qué roles puede crear cada quien                                      */
/* -------------------------------------------------------------------- */

/* Regla dura: un `admin` NUNCA puede crear ni convertir a nadie en `admin`
   ni en `superadmin`. Solo la plataforma reparte privilegio de sede. */
const GRANTABLE: Record<Role, readonly Role[]> = {
  superadmin: ["superadmin", "admin", "docente", "alumno"],
  admin: ["docente", "alumno"],
  docente: [],
  alumno: [],
};

export function canGrantRole(actor: Role, target: Role): boolean {
  return GRANTABLE[actor].includes(target);
}

export function assertCanGrant(actor: Role, target: Role): void {
  if (!canGrantRole(actor, target)) {
    throw new ForbiddenError(
      `Tu rol (${roleLabel(actor)}) no puede crear ni modificar cuentas con rol ${roleLabel(target)}.`,
    );
  }
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    superadmin: "superadmin",
    admin: "administrador",
    docente: "docente",
    alumno: "alumno",
  };
  return labels[role];
}

/* -------------------------------------------------------------------- */
/* Alcance — sobre QUÉ datos puede operar                                */
/* -------------------------------------------------------------------- */

export interface Actor {
  id: string;
  role: Role;
  /** Sede a la que pertenece. `null` solo para el superadmin. */
  sedeId: string | null;
  email: string | null;
  username: string;
  name: string;
}

export type Scope =
  /* Toda la plataforma. */
  | { kind: "all" }
  /* Una sede entera. */
  | { kind: "sede"; sedeId: string }
  /* Solo los grupos que tiene a cargo — la ruta los resuelve por consulta. */
  | { kind: "own-groups"; userId: string }
  /* Solo su propia cuenta. */
  | { kind: "self"; userId: string };

export function scopeOf(actor: Actor): Scope {
  switch (actor.role) {
    case "superadmin":
      return { kind: "all" };
    case "admin":
      /* Un admin sin sede no puede ver nada: es un estado inválido que la
         base impide con un CHECK, pero si aparece preferimos "no ve nada"
         antes que "ve todo". */
      return actor.sedeId
        ? { kind: "sede", sedeId: actor.sedeId }
        : { kind: "self", userId: actor.id };
    case "docente":
      return { kind: "own-groups", userId: actor.id };
    case "alumno":
      return { kind: "self", userId: actor.id };
  }
}

/** ¿Puede el actor operar sobre algo que vive en `targetSedeId`? */
export function canActOnSede(actor: Actor, targetSedeId: string | null): boolean {
  if (actor.role === "superadmin") return true;
  if (!targetSedeId || !actor.sedeId) return false;
  return actor.sedeId === targetSedeId;
}

export function assertCanActOnSede(actor: Actor, targetSedeId: string | null): void {
  if (!canActOnSede(actor, targetSedeId)) {
    throw new ForbiddenError("Ese recurso pertenece a otra sede.");
  }
}
