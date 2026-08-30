/* Estado local del navegador.
 *
 * Antes este archivo tenía 772 líneas y era una base de datos paralela:
 * usuarios con contraseñas en texto plano, sedes, cursos, invitaciones y
 * un superadmin fijo. Todo eso convivía con la base real y se
 * desincronizaba de ella. Se fue entero.
 *
 * Lo único que queda acá es lo que de verdad pertenece a ESTE navegador:
 * el modo demo y la ruta a la que va cada rol al entrar. El progreso del
 * juego vive en `progress.ts` (y se sincroniza con la API); los usuarios,
 * grupos y estadísticas viven en la API y en ningún otro lado.
 */

import type { Role } from "../types";

/** Modo demo: una partida suelta, sin cuenta ni token. */
const DEMO_MODE_KEY = "edutic_demo_mode";

export function setDemoMode(on: boolean) {
  if (on) localStorage.setItem(DEMO_MODE_KEY, "true");
  else localStorage.removeItem(DEMO_MODE_KEY);
}

export function clearDemoMode() {
  localStorage.removeItem(DEMO_MODE_KEY);
}

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === "true";
}

/** A dónde va cada rol después de entrar.
 *
 *  Hoy solo existe la superficie del alumno. Las pantallas de docente y
 *  administración se van a construir de cero: hasta que existan, quien no
 *  es alumno entra igual pero no tiene todavía a dónde ir, y lo decimos
 *  explícitamente en vez de mandarlo a una ruta rota. */
export function routeForRole(role: Role): string {
  return role === "alumno" ? "/mundos" : "/sin-pantalla";
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    superadmin: "Superadmin",
    admin: "Administrador",
    docente: "Docente",
    alumno: "Alumno",
  };
  return labels[role];
}
