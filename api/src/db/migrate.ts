/* Runner de migraciones.
 *
 * Reemplaza al viejo par `db/init/*.sql` + `ensureSchema()`:
 *   - `db/init/*.sql` SOLO corría con el volumen vacío, así que cualquier
 *     cambio posterior nunca se aplicaba a una base existente.
 *   - `ensureSchema()` eran 110 líneas de ALTER/CREATE IF NOT EXISTS que
 *     se ejecutaban en cada arranque, sin registro de qué se había
 *     aplicado ni forma de revisar el historial.
 *
 * Acá cada archivo de `api/migrations/*.sql` se aplica UNA vez, en orden
 * alfabético, y queda registrado en `schema_migrations`.
 *
 * Detalles que importan:
 *   - Un advisory lock de Postgres serializa el arranque: si mañana hay
 *     dos réplicas de la API levantando a la vez, solo una migra.
 *   - Cada archivo se ejecuta con el protocolo simple, que Postgres
 *     envuelve en una transacción implícita: o entra entero o no entra
 *     nada. El INSERT en `schema_migrations` viaja en el mismo lote, así
 *     que no existe el estado "migró pero no quedó registrado".
 */

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Sql } from "postgres";

/* src/db/migrate.ts → api/migrations   (en dev, vía tsx)
   dist/db/migrate.js → api/migrations  (en prod, compilado)
   Los dos quedan a dos niveles del directorio, así que la misma URL sirve. */
const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations/", import.meta.url));

/* Entero arbitrario pero estable: identifica ESTE lock entre todos los
   advisory locks de la base. */
const MIGRATION_LOCK_ID = 4820_1993;

export interface MigrationResult {
  applied: string[];
  alreadyApplied: number;
}

export async function runMigrations(sql: Sql, log: (msg: string) => void): Promise<MigrationResult> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;

  /* Bloqueo a nivel sesión: se libera explícitamente en el finally. */
  await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
  try {
    const done = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
    const alreadyApplied = new Set(done.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const applied: string[] = [];
    for (const file of files) {
      if (alreadyApplied.has(file)) continue;
      const body = await readFile(new URL(file, `file://${MIGRATIONS_DIR}`), "utf8");
      log(`aplicando migración ${file}`);
      /* El INSERT va en el MISMO lote que la migración: el protocolo
         simple lo corre todo en una transacción implícita. */
      await sql
        .unsafe(
          `${body}\n;INSERT INTO schema_migrations (name) VALUES ('${file.replace(/'/g, "''")}');`,
        )
        .simple();
      applied.push(file);
    }

    /* Rueda la ventana de particiones mensuales de `attempts`. Idempotente,
       y al vivir acá no depende de ningún cron externo. */
    await sql`SELECT ensure_attempts_partitions(6)`;

    return { applied, alreadyApplied: alreadyApplied.size };
  } finally {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
  }
}
