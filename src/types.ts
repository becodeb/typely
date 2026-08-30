/* Tipos del frontend.
 *
 * Estos espejan lo que devuelve la API. El modelo viejo mantenía acá una
 * base de usuarios paralela (`EduTicUser`, `DemoData`, contraseñas en
 * texto plano en localStorage) que convivía con la real y se desincronizaba
 * de ella. Eso se fue: la API es la única fuente de verdad sobre usuarios,
 * grupos y progreso.
 */

/** Los cuatro roles. `admin` administra UNA sede; `superadmin`, la plataforma. */
export type Role = "superadmin" | "admin" | "docente" | "alumno";

/** El usuario de la sesión activa. */
export interface ActiveUser {
  id: string;
  name: string;
  /** Identidad primaria: la tienen todos, incluido el alumno sin email. */
  username: string;
  /** Opcional — solo quien usa Google o puede recuperar la cuenta. */
  email?: string | null;
  role: Role;
  /** Sede a la que pertenece. `null` para el superadmin. */
  sedeId?: string | null;
  /** Grupo del alumno. `null` para el resto de los roles. */
  groupId?: string | null;
  /** Entró con una contraseña temporal y tiene que cambiarla antes de seguir. */
  mustChangePassword?: boolean;
}

export type GradeId =
  | "inicial"
  | "1ep"
  | "2ep"
  | "3ep"
  | "4ep"
  | "5ep"
  | "6ep"
  | "sec"
  | "libre";

export interface Sede {
  id: string;
  name: string;
  city: string;
  photo?: string | null;
  active: boolean;
}

/** El "curso" de la escuela. */
export interface Group {
  id: string;
  name: string;
  sedeId: string;
  grade: GradeId;
  active: boolean;
  studentCount?: number;
  teacherCount?: number;
}

export interface GroupMember {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  active: boolean;
  lastLoginAt: string | null;
}

export interface ApiUser {
  id: string;
  role: Role;
  sedeId: string | null;
  groupId: string | null;
  username: string;
  email: string | null;
  fullName: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

/** Lo que devuelve crear un usuario o importar un CSV: la contraseña
 *  temporal se muestra UNA vez y no se guarda en claro en ningún lado. */
export interface IssuedCredentials {
  fullName: string;
  username: string;
  temporaryPassword: string;
  role: Role;
  group?: string | null;
}

export interface StudentProgressRow {
  worldId: string;
  levelNumber: number;
  completed: boolean;
  bestAccuracy: number;
  bestWpm: number | null;
  attempts: number;
  lastAttemptAt: string;
}
