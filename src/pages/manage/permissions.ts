/* Qué puede hacer cada rol, del lado de la interfaz.
 *
 * **Esto NO es la defensa.** La autoridad es `api/src/rbac.ts` y la API
 * verifica cada operación de nuevo; acá solo se decide qué ofrecer, para
 * no mostrar botones que van a devolver 403. Si las dos alguna vez se
 * separan, gana la API y hay que corregir este archivo.
 *
 * Está escrito como matriz y no como un ranking numérico por la misma
 * razón que del lado del servidor: un ranking no puede expresar "un admin
 * nunca puede crear otro admin", porque dos admins tienen el mismo rango.
 *
 * Los cuatro roles se declaran completos aunque el `docente` todavía no
 * tenga panel: el día que lo tenga, hereda estas reglas sin tocar nada.
 */

import type { Role } from "../../types";

/** Sobre qué roles puede operar cada uno. Espejo de `GRANTABLE`. */
const REACHES: Record<Role, readonly Role[]> = {
  superadmin: ["superadmin", "admin", "docente", "alumno"],
  admin: ["docente", "alumno"],
  docente: ["alumno"],
  alumno: [],
};

/** Qué roles puede CREAR cada uno. Igual que arriba salvo el propio rol:
 *  nadie crea a un par suyo, y el superadmin sí porque es la plataforma. */
const CREATES: Record<Role, readonly Role[]> = {
  superadmin: ["admin", "docente", "alumno"],
  admin: ["docente", "alumno"],
  docente: [],
  alumno: [],
};

/** Permisos que no dependen del objetivo sino solo del rol del actor.
 *  Espejo de `PERMISSIONS` en la API, recortado a lo que usa esta pantalla. */
interface Abilities {
  edit: boolean;
  remove: boolean;
  create: boolean;
  resetPassword: boolean;
  /** Crear, renombrar y borrar grupos, y asignarles docentes. */
  writeGroups: boolean;
  /** Alta masiva por planilla. */
  importCsv: boolean;
}

const CAN: Record<Role, Abilities> = {
  superadmin: { edit: true, remove: true, create: true, resetPassword: true, writeGroups: true, importCsv: true },
  admin: { edit: true, remove: true, create: true, resetPassword: true, writeGroups: true, importCsv: true },
  /* El docente resuelve el "me olvidé la contraseña" de su curso sin
     depender del admin, y elige qué islas juega su grupo. Todo lo demás
     —crear cuentas, editarlas, borrarlas, armar grupos— es del admin: un
     docente que puede sacar alumnos de un curso puede romper el de otro. */
  docente: { edit: false, remove: false, create: false, resetPassword: true, writeGroups: false, importCsv: false },
  alumno: { edit: false, remove: false, create: false, resetPassword: false, writeGroups: false, importCsv: false },
};

export function reachableRoles(actor: Role): readonly Role[] {
  return REACHES[actor];
}

export function creatableRoles(actor: Role): readonly Role[] {
  return CREATES[actor];
}

/** ¿Aparece esta persona en la lista del actor? */
export function canSee(actor: Role, target: Role): boolean {
  return REACHES[actor].includes(target);
}

/* Las tres operaciones de una fila. `self` va aparte en cada una porque la
   regla cambia: editarte a vos mismo sí, resetearte o borrarte no. */

export function canResetPassword(actor: Role, target: Role, isSelf: boolean): boolean {
  /* Nadie se resetea a sí mismo desde acá: cambiar la propia exige la
     contraseña ACTUAL, y eso es lo que impide que un token robado alcance
     para quedarse con la cuenta. La API devuelve 400 si se intenta. */
  if (isSelf) return false;
  return CAN[actor].resetPassword && REACHES[actor].includes(target);
}

export function canEdit(actor: Role, target: Role, isSelf: boolean): boolean {
  if (isSelf) return CAN[actor].edit;
  return CAN[actor].edit && REACHES[actor].includes(target);
}

export function canDelete(actor: Role, target: Role, isSelf: boolean): boolean {
  /* Ni la propia cuenta ni un superadmin: las dos las rechaza la API. */
  if (isSelf || target === "superadmin") return false;
  return CAN[actor].remove && REACHES[actor].includes(target);
}

export function canCreate(actor: Role): boolean {
  return CAN[actor].create && CREATES[actor].length > 0;
}

/** Crear grupos, renombrarlos, y poner o sacar docentes de un curso. */
export function canWriteGroups(actor: Role): boolean {
  return CAN[actor].writeGroups;
}

/** Alta masiva por planilla CSV. */
export function canImport(actor: Role): boolean {
  return CAN[actor].importCsv;
}

/** ¿Puede mover gente entre escuelas? Solo quien no pertenece a ninguna. */
export function canMoveBetweenSedes(actor: Role): boolean {
  return actor === "superadmin";
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "superadmin",
  admin: "admin",
  docente: "docente",
  alumno: "alumno",
};

/** Colores por rol. Se repiten en toda la pantalla, así que viven acá y no
 *  duplicados en cada componente. */
export const ROLE_TAG: Record<Role, { bg: string; fg: string }> = {
  superadmin: { bg: "#efeaff", fg: "#6141c8" },
  admin: { bg: "#e7eeff", fg: "#3159e8" },
  docente: { bg: "#e0f6f1", fg: "#0f8f7c" },
  alumno: { bg: "#eef3f9", fg: "#5b708f" },
};
