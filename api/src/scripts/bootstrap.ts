/* Crea el superadmin inicial.
 *
 * Reemplaza al `admin`/`admin` que vivía hardcodeado en `src/data/seed.ts`
 * y viajaba dentro del bundle público. Ahora la única cuenta con acceso
 * total se crea a mano, una vez, contra la base.
 *
 * Uso:
 *   SUPERADMIN_USERNAME=ezequiel \
 *   SUPERADMIN_PASSWORD='...' \
 *   SUPERADMIN_EMAIL=ezequiel@… \
 *   SUPERADMIN_NAME='Ezequiel Fernández Cruz' \
 *   npm run bootstrap
 *
 * Es idempotente: si ya existe un superadmin no crea otro ni pisa nada.
 * Si no se pasa contraseña, genera una y la imprime UNA vez.
 * El email es opcional; sirve para contacto y recuperación de cuenta.
 */

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema, sql } from "../db/index.js";
import { hashPassword } from "../auth.js";
import { runMigrations } from "../db/migrate.js";

function generatePassword(): string {
  /* base64url sobre 12 bytes = 16 caracteres sin ambigüedad de encoding. */
  return randomBytes(12).toString("base64url");
}

async function main() {
  await runMigrations(sql, (m) => console.log(`  ${m}`));

  const existing = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.role, "superadmin"))
    .limit(1);

  if (existing[0]) {
    console.log(`Ya existe un superadmin: "${existing[0].username}". No se crea otro.`);
    console.log("Para reiniciar su contraseña usá el endpoint de reseteo o borralo antes.");
    return;
  }

  const username = (process.env.SUPERADMIN_USERNAME ?? "").trim();
  if (!username) {
    throw new Error("Falta SUPERADMIN_USERNAME.");
  }
  const fullName = (process.env.SUPERADMIN_NAME ?? "").trim() || username;
  const email = (process.env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase() || null;

  const provided = process.env.SUPERADMIN_PASSWORD ?? "";
  const generated = provided ? null : generatePassword();
  const password = provided || generated!;
  if (password.length < 8) {
    throw new Error("La contraseña del superadmin debe tener al menos 8 caracteres.");
  }

  await db.insert(schema.users).values({
    role: "superadmin",
    username,
    email,
    fullName,
    passwordHash: await hashPassword(password),
    /* Si la contraseña la generamos nosotros, se cambia en el primer
       ingreso. Si la eligió la persona, no hay nada que forzar. */
    mustChangePassword: Boolean(generated),
    sedeId: null,
    groupId: null,
  });

  console.log(`\nSuperadmin creado: ${username}`);
  if (generated) {
    console.log(`Contraseña temporal (se muestra una sola vez): ${generated}`);
    console.log("Te la va a pedir cambiar al entrar.");
  }
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("bootstrap falló:", err instanceof Error ? err.message : err);
    await sql.end();
    process.exit(1);
  });
