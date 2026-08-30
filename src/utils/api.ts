/* Cliente de la API.
 *
 * Notas de diseño:
 *  - Toda llamada autenticada manda `Authorization: Bearer <access>` desde
 *    el token en memoria. Ante un 401 se intenta UN refresh silencioso
 *    contra `/auth/refresh` (cookie HTTP-only) y se reintenta la original.
 *  - `BASE` es `/api` por defecto, así que funciona detrás del proxy sin
 *    configurar nada. `VITE_API_URL` permite apuntar a otro origen en dev.
 *  - Los errores llegan como `ApiError` con mensaje en español.
 *
 * Lo que ya NO hace: caer a una base de usuarios en localStorage cuando la
 * API no responde. Ese fallback mantenía una lista de cuentas paralela en
 * el navegador —con contraseñas en texto plano y un superadmin fijo— que
 * se desincronizaba de la real. Si la API está caída, ahora se dice que
 * está caída.
 */

import type { ApiUser, Group, GroupMember, IssuedCredentials, Role, Sede, StudentProgressRow } from "../types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOpts extends Omit<RequestInit, "body"> {
  json?: unknown;
  text?: string;
  retry?: boolean;
}

async function call<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { json, text, retry = true, headers, ...rest } = opts;
  const finalHeaders = new Headers(headers);
  if (json !== undefined) finalHeaders.set("content-type", "application/json");
  if (text !== undefined) finalHeaders.set("content-type", "text/csv");
  if (accessToken) finalHeaders.set("authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : text,
    credentials: "include", // manda la cookie de refresh
  });

  const isAuthPath = path === "/auth/refresh" || path === "/auth/login";
  if (res.status === 401 && retry && !isAuthPath) {
    if (await refresh()) return call<T>(path, { ...opts, retry: false });
  }

  if (!res.ok) {
    let message = "No pudimos completar la operación.";
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data?.error || data?.message || message;
    } catch {
      /* respuesta sin JSON — nos quedamos con el mensaje genérico */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function refresh(): Promise<boolean> {
  try {
    const res = await call<{ access: string }>("/auth/refresh", { method: "POST", retry: false });
    setAccessToken(res.access);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Formas de respuesta                                                 */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: Role;
  sedeId: string | null;
  groupId: string | null;
  mustChangePassword: boolean;
}

interface SessionResponse {
  access: string;
  refreshExpiresAt: string;
  user: SessionUser;
}

export interface Overview {
  counts: { groups: number; teachers: number; students: number };
  activeToday: number;
  avgProgress: number;
  totalStars: number;
  weekly: { date: string; label: string; count: number }[];
  alerts: {
    inactiveStudents: number;
    lowPrecisionStudents: number;
    inactiveTeachers: number;
    groupsNoTeacher: number;
  };
  attentionGroups: { id: string; name: string; reason: string }[];
  recent: { studentName: string; worldId: string; completed: boolean; at: string }[];
}

export interface StudentDetail {
  student: {
    id: string;
    fullName: string;
    username: string;
    email: string | null;
    groupId: string | null;
    groupName: string | null;
    lastLoginAt: string | null;
  };
  stats: {
    completedLevels: number;
    avgAccuracy: number;
    currentWorld: string | null;
    currentLevel: number;
    totalSeconds: number;
    streakDays: number;
    totalAttempts: number;
    xp: number;
    stars: number;
  };
  byWorld: { worldId: string; completed: number; avgAccuracy: number }[];
  achievements: { id: string; unlockedAt: string }[];
  timeline: {
    worldId: string;
    levelNumber: number;
    accuracy: number;
    completed: boolean;
    errorCount: number;
    at: string;
  }[];
}

export interface TeacherDetail {
  teacher: {
    id: string;
    fullName: string;
    username: string;
    email: string | null;
    lastLoginAt: string | null;
  };
  groups: { id: string; name: string; grade: string; studentCount: number }[];
  stats: { groupCount: number; studentCount: number };
  recent: { studentName: string; worldId: string; completed: boolean; at: string }[];
}

export interface ImportPreview {
  willCreate: number;
  willSkip: number;
  groupsToCreate: string[];
  errors: { line: number; message: string }[];
  skipped: { line: number; message: string }[];
  preview: {
    line: number;
    fullName: string;
    username: string;
    role: Role;
    group: string | null;
    email: string | null;
  }[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
  credentials: IssuedCredentials[];
}

export interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: string | null;
  at: string;
  actorId: string | null;
  actorName: string | null;
}

/** Un nivel terminado, listo para enviar. */
export interface ProgressItem {
  worldId: string;
  levelNumber: number;
  accuracy: number;
  wpm?: number;
  errorCount: number;
  startedAt: string;
  endedAt: string;
}

/** El admin importa siempre en su sede; el superadmin tiene que indicarla.
 *  `groupId` es el grupo por defecto de las filas sin columna `grupo`. */
function importQuery(q: { sedeId?: string; groupId?: string }): string {
  const p = new URLSearchParams();
  if (q.sedeId) p.set("sedeId", q.sedeId);
  if (q.groupId) p.set("groupId", q.groupId);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

/* ------------------------------------------------------------------ */
/* Superficie pública                                                  */
/* ------------------------------------------------------------------ */

export const api = {
  /* ---- Sesión ---- */

  /** `identifier` es el usuario O el email: el mismo campo del formulario. */
  async login(identifier: string, password: string): Promise<SessionUser> {
    const res = await call<SessionResponse>("/auth/login", {
      method: "POST",
      json: { identifier, password },
      retry: false,
    });
    setAccessToken(res.access);
    return res.user;
  },

  /** Intenta recuperar la sesión desde la cookie de refresh. `null` si no hay. */
  async bootstrap(): Promise<SessionUser | null> {
    try {
      const res = await call<SessionResponse>("/auth/refresh", { method: "POST", retry: false });
      setAccessToken(res.access);
      return res.user;
    } catch {
      setAccessToken(null);
      return null;
    }
  },

  me: () => call<{ user: SessionUser }>("/auth/me").then((r) => r.user),

  async logout(): Promise<void> {
    try {
      await call("/auth/logout", { method: "POST", retry: false });
    } finally {
      setAccessToken(null);
    }
  },

  /** La API exige la contraseña actual, salvo en el cambio obligatorio. */
  changePassword: (currentPassword: string | undefined, newPassword: string) =>
    call<{ ok: true }>("/auth/change-password", {
      method: "POST",
      json: { currentPassword, newPassword },
    }),

  /* ---- Sedes ---- */
  sedes: () => call<(Sede & { groupCount: number; studentCount: number })[]>("/sedes"),
  mySede: () => call<Sede>("/sedes/mine"),
  createSede: (body: { name: string; city?: string; photo?: string }) =>
    call<Sede>("/sedes", { method: "POST", json: body }),
  updateSede: (id: string, body: Partial<Sede>) =>
    call<Sede>(`/sedes/${id}`, { method: "PATCH", json: body }),
  deleteSede: (id: string) => call<{ ok: true }>(`/sedes/${id}`, { method: "DELETE" }),

  /* ---- Usuarios ---- */
  users: (q: { role?: Role; sedeId?: string; groupId?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.role) p.set("role", q.role);
    if (q.sedeId) p.set("sedeId", q.sedeId);
    if (q.groupId) p.set("groupId", q.groupId);
    const qs = p.toString();
    return call<ApiUser[]>(`/users${qs ? `?${qs}` : ""}`);
  },
  createUser: (body: {
    fullName: string;
    role: Role;
    email?: string | null;
    username?: string;
    password?: string;
    sedeId?: string | null;
    groupId?: string | null;
  }) =>
    call<{ user: ApiUser; temporaryPassword: string | null }>("/users", {
      method: "POST",
      json: body,
    }),
  updateUser: (id: string, body: Partial<Pick<ApiUser, "fullName" | "email" | "username" | "sedeId" | "groupId" | "active">>) =>
    call<ApiUser>(`/users/${id}`, { method: "PATCH", json: body }),
  deleteUser: (id: string) => call<{ ok: true }>(`/users/${id}`, { method: "DELETE" }),
  restoreUser: (id: string) => call<{ ok: true }>(`/users/${id}/restore`, { method: "POST" }),
  resetPassword: (id: string) =>
    call<{ temporaryPassword: string }>(`/users/${id}/reset-password`, { method: "POST" }),

  /* ---- Grupos ---- */
  groups: (sedeId?: string) => call<Group[]>(`/groups${sedeId ? `?sedeId=${sedeId}` : ""}`),
  createGroup: (body: { name: string; grade?: string; sedeId?: string }) =>
    call<Group>("/groups", { method: "POST", json: body }),
  updateGroup: (id: string, body: { name?: string; grade?: string; active?: boolean }) =>
    call<Group>(`/groups/${id}`, { method: "PATCH", json: body }),
  deleteGroup: (id: string) => call<{ ok: true }>(`/groups/${id}`, { method: "DELETE" }),
  groupMembers: (id: string) =>
    call<{ group: Group; students: GroupMember[]; teachers: GroupMember[] }>(`/groups/${id}/members`),
  addTeacher: (groupId: string, userId: string) =>
    call<{ ok: true }>(`/groups/${groupId}/teachers`, { method: "POST", json: { userId } }),
  removeTeacher: (groupId: string, userId: string) =>
    call<{ ok: true }>(`/groups/${groupId}/teachers/${userId}`, { method: "DELETE" }),
  addStudent: (groupId: string, userId: string) =>
    call<{ ok: true }>(`/groups/${groupId}/students`, { method: "POST", json: { userId } }),
  removeStudent: (groupId: string, userId: string) =>
    call<{ ok: true }>(`/groups/${groupId}/students/${userId}`, { method: "DELETE" }),
  groupWorlds: (id: string) => call<{ worldIds: string[] | null }>(`/groups/${id}/worlds`),
  setGroupWorlds: (id: string, worldIds: string[] | null) =>
    call<{ ok: true }>(`/groups/${id}/worlds`, { method: "PUT", json: { worldIds } }),
  credentialsSheet: (id: string) =>
    call<{ group: { id: string; name: string }; students: { fullName: string; username: string; mustChangePassword: boolean }[] }>(
      `/groups/${id}/credentials-sheet`,
    ),
  /** El grupo del alumno y sus islas habilitadas, sin conocer ningún id. */
  myGroup: () => call<{ group: Group | null; worldIds: string[] | null }>("/groups/mine"),

  /* ---- Alta masiva por CSV ---- */
  importPreview: (csv: string, q: { sedeId?: string; groupId?: string } = {}) =>
    call<ImportPreview>(`/import/preview${importQuery(q)}`, { method: "POST", text: csv }),
  importUsers: (csv: string, q: { sedeId?: string; groupId?: string } = {}) =>
    call<ImportResult>(`/import${importQuery(q)}`, { method: "POST", text: csv }),

  /* ---- Progreso ---- */
  myProgress: () => call<StudentProgressRow[]>("/progress/me"),
  /** Acepta un lote: el cliente encola y reintenta si no hay red. */
  postProgress: (items: ProgressItem[]) =>
    call<{ ok: true; saved: number; unlockedAchievements: string[] }>("/progress/complete", {
      method: "POST",
      json: { items },
    }),
  myStats: () =>
    call<{ stats: Record<string, number>; achievements: { id: string; unlockedAt: string }[] }>("/me/stats"),

  /* ---- Dashboards ---- */
  overview: (sedeId?: string) => call<Overview>(`/admin/overview${sedeId ? `?sedeId=${sedeId}` : ""}`),
  student: (id: string) => call<StudentDetail>(`/students/${id}`),
  teacher: (id: string) => call<TeacherDetail>(`/teachers/${id}`),
  teacherStudents: () =>
    call<
      (GroupMember & { groupId: string | null; progress: StudentProgressRow[] })[]
    >("/teacher/students"),
  audit: (q: { sedeId?: string; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (q.sedeId) p.set("sedeId", q.sedeId);
    if (q.limit) p.set("limit", String(q.limit));
    const qs = p.toString();
    return call<AuditEntry[]>(`/audit${qs ? `?${qs}` : ""}`);
  },

  health: () => call<{ ok: boolean; service: string; ts: string }>("/health", { retry: false }),
};

export type Api = typeof api;
