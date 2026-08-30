/* Pool de conexiones a Postgres, compartido por todas las rutas.
   Drizzle envuelve el driver postgres-js para dar queries tipadas contra
   `schema.ts`. */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL es obligatoria (por secret de Docker o env).");
}

/* Los prepared statements son una mejora real de rendimiento contra un
   Postgres directo, pero NO sobreviven a un pooler en modo transacción
   (pgBouncer, el pooler de Supabase en el 6543). Con la base local y
   directa van activados; si algún día se vuelve a poner un pooler
   adelante, alcanza con DB_POOLED=true para desactivarlos — sin eso, el
   síntoma es un error confuso de "prepared statement already exists". */
const POOLED = process.env.DB_POOLED === "true";

const sql = postgres(DATABASE_URL, {
  max: Number(process.env.DB_POOL_MAX ?? 12),
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: !POOLED,
});

export const db = drizzle(sql, { schema });
export { schema, sql };
export type Db = typeof db;
