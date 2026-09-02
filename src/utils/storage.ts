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

/** A dónde va cada rol después de entrar. */
export function routeForRole(role: Role): string {
  switch (role) {
    case "alumno":
      /* La puerta del alumno es el selector de modos: ahí elige entre la
         aventura de las islas y el modo Órbita (arcade). */
      return "/modos";
    case "superadmin":
    case "admin":
    case "docente":
      /* Los tres roles de gestión caen en la misma pantalla: el tablero
         contesta "cómo viene mi gente", que es la primera pregunta de los
         tres. Lo que cambia es el alcance, y de eso se encarga la API. */
      return "/gestion/tablero";
  }
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
