/* Generación de usuario y contraseña temporal.
 *
 * Vive aparte porque lo usan tanto la creación de a uno (`routes/users.ts`)
 * como el import por CSV (`routes/import.ts`), y las dos tienen que producir
 * exactamente el mismo formato: si el admin crea a mano un alumno y después
 * importa el resto por planilla, los usuarios no pueden salir con dos
 * criterios distintos.
 */

import { randomInt } from "node:crypto";
import { db, schema } from "./db/index.js";
import { inArray } from "drizzle-orm";

/** Quita tildes y deja solo letras y números. "Sofía Gómez" → "sofiagomez". */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas
    .replace(/[^a-z0-9]+/g, "");
}

/** Base del usuario a partir del nombre completo: "nombre.apellido".
 *
 *  El generador anterior concatenaba todo y cortaba a 10 caracteres, así
 *  que "Sofía Gómez" quedaba como "sofiagome" — ilegible, y con choques
 *  garantizados en un curso con varios apellidos parecidos. Un alumno de
 *  primaria tiene que poder LEER su usuario de una tarjeta y tipearlo.  */
export function usernameBase(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean).map(fold).filter(Boolean);
  if (!parts.length) return "usuario";
  if (parts.length === 1) return parts[0]!.slice(0, 20);
  /* Primer nombre + primer apellido. Los nombres compuestos y los segundos
     apellidos se descartan: alargan sin distinguir. */
  return `${parts[0]!.slice(0, 12)}.${parts[1]!.slice(0, 12)}`;
}

/**
 * Asigna usuarios únicos a un lote de nombres, en UNA sola consulta.
 *
 * Resuelve los choques dentro del propio lote y contra lo que ya existe en
 * la base, agregando un sufijo numérico: `sofia.gomez`, `sofia.gomez2`, …
 *
 * Devuelve un array alineado con `fullNames`.
 */
export async function assignUsernames(fullNames: string[]): Promise<string[]> {
  const bases = fullNames.map(usernameBase);

  /* Traemos de una sola vez todo lo que pueda chocar. Con `citext` la
     comparación ya es insensible a mayúsculas. Hacer una consulta por fila
     sería un N+1 justo en el camino del import de un curso entero. */
  const candidates = new Set<string>();
  for (const b of bases) {
    candidates.add(b);
    for (let i = 2; i <= fullNames.length + 1; i++) candidates.add(`${b}${i}`);
  }
  const existing = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.username, [...candidates]));

  const taken = new Set(existing.map((r) => r.username.toLowerCase()));

  return bases.map((base) => {
    let candidate = base;
    let n = 2;
    while (taken.has(candidate.toLowerCase())) {
      candidate = `${base}${n}`;
      n++;
    }
    taken.add(candidate.toLowerCase()); // reserva dentro del lote
    return candidate;
  });
}

/** Usuario único para una sola alta. */
export async function assignUsername(fullName: string): Promise<string> {
  const [only] = await assignUsernames([fullName]);
  return only!;
}

/* Sin i/l/1/0/O: son las que un chico de segundo grado confunde al copiar
   la contraseña de una tarjeta impresa. */
const SAFE_LETTERS = "abcdefghjkmnpqrstuvwxyz";
const SAFE_DIGITS = "23456789";

/**
 * Contraseña temporal legible y dictable en voz alta.
 *
 * El formato anterior era `tmp-` más 6 caracteres de `Math.random()`, con
 * dos problemas: `Math.random()` no es un generador criptográfico, y el
 * prefijo fijo regalaba la mitad del valor a cualquiera que lo supiera.
 * Ahora son bytes del generador del sistema sobre un alfabeto sin
 * caracteres ambiguos.
 */
export function makeTempPassword(): string {
  const word = () =>
    Array.from({ length: 4 }, () => SAFE_LETTERS[randomInt(SAFE_LETTERS.length)]).join("");
  const digits = Array.from({ length: 3 }, () => SAFE_DIGITS[randomInt(SAFE_DIGITS.length)]).join("");
  return `${word()}-${word()}-${digits}`;
}
