/* Cuentas de prueba para desarrollo local — una por rol.
 *
 * Existe para poder probar el RBAC sin desplegar: hasta ahora, ver qué
 * pasaba con los ojos de un docente exigía crear la cuenta a mano cada
 * vez, y por eso casi nunca se probaba.
 *
 * **Es idempotente.** Correlo las veces que quieras: si la cuenta existe,
 * le repone la contraseña y sus vínculos en vez de fallar por username
 * duplicado. Eso lo hace seguro de encadenar a `npm run db:local`, que es
 * de donde se llama.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ NUNCA CONTRA PRODUCCIÓN.                                         │
 * │                                                                  │
 * │ Sembrar ocho cuentas con una contraseña conocida y publicada en  │
 * │ el repositorio es, contra una base real, entregarle la           │
 * │ plataforma a cualquiera que lea este archivo. Por eso el guardia │
 * │ de abajo no es un aviso: aborta si `DATABASE_URL` no apunta a    │
 * │ esta máquina, y no hay bandera para saltearlo.                   │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * La forma de los datos importa tanto como las cuentas: los alumnos van
 * repartidos en DOS grupos y cada docente tiene UNO solo a cargo. Con un
 * solo grupo, "el docente ve únicamente a sus alumnos" da verdadero por
 * accidente y la prueba no prueba nada.
 */

import { and, eq } from "drizzle-orm";
import { db, schema, sql } from "../db/index.js";
import { hashPassword } from "../auth.js";
import { runMigrations } from "../db/migrate.js";

const PASSWORD = "Becode2026##";

/** Solo loopback. Un host remoto —o un socket -h que no sepamos leer—
 *  no se siembra: ante la duda, no. */
function assertLocal(): void {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"];
  if (!local.includes(host)) {
    console.error("\n✖ seed-local solo corre contra una base de tu máquina.");
    console.error(`  DATABASE_URL apunta a "${host || "un host que no pude leer"}".`);
    console.error("  Estas cuentas tienen una contraseña conocida y pública: en");
    console.error("  una base real serían una puerta abierta.\n");
    process.exit(1);
  }
}

/** `noUncheckedIndexedAccess` obliga a mirar cada índice y cada `returning`.
 *  Explota acá, con nombre, en vez de propagar un `undefined` que reaparece
 *  como un NOT NULL violado tres funciones más abajo. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Faltó ${what}.`);
  return value;
}

interface Person {
  username: string;
  fullName: string;
  role: schema.Role;
  /** Índice del grupo al que va (solo alumnos). */
  group?: number;
  /** Índice del grupo que tiene a cargo (solo docentes). */
  teaches?: number;
}

const SEDE = "Escuela de Prueba";
const GROUPS = [
  { name: "4.º A", grade: "4ep" as const },
  { name: "5.º B", grade: "5ep" as const },
];

const PEOPLE: Person[] = [
  { username: "superadmin", fullName: "Superadmin de Prueba", role: "superadmin" },
  { username: "admin1", fullName: "Admin Uno", role: "admin" },
  { username: "admin2", fullName: "Admin Dos", role: "admin" },
  { username: "docente1", fullName: "Docente Uno", role: "docente", teaches: 0 },
  { username: "docente2", fullName: "Docente Dos", role: "docente", teaches: 1 },
  { username: "alumno1", fullName: "Alumno Uno", role: "alumno", group: 0 },
  { username: "alumno2", fullName: "Alumno Dos", role: "alumno", group: 0 },
  { username: "alumno3", fullName: "Alumno Tres", role: "alumno", group: 1 },
];

async function ensureSede(): Promise<string> {
  const [found] = await db
    .select({ id: schema.sedes.id })
    .from(schema.sedes)
    .where(eq(schema.sedes.name, SEDE))
    .limit(1);
  if (found) return found.id;

  const [created] = await db
    .insert(schema.sedes)
    .values({ name: SEDE, city: "Rosario" })
    .returning({ id: schema.sedes.id });
  return must(created, "la sede creada").id;
}

async function ensureGroup(sedeId: string, g: (typeof GROUPS)[number]): Promise<string> {
  const [found] = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(and(eq(schema.groups.sedeId, sedeId), eq(schema.groups.name, g.name)))
    .limit(1);
  if (found) return found.id;

  const [created] = await db
    .insert(schema.groups)
    .values({ sedeId, name: g.name, grade: g.grade })
    .returning({ id: schema.groups.id });
  return must(created, "el grupo creado").id;
}

async function ensurePerson(p: Person, sedeId: string, groupIds: string[]): Promise<string> {
  /* Los CHECK de la base son estrictos y vale respetarlos acá en vez de
     descubrirlos como un error de constraint: el superadmin no lleva sede,
     y solo un alumno lleva grupo. */
  const values = {
    role: p.role,
    sedeId: p.role === "superadmin" ? null : sedeId,
    groupId: p.group === undefined ? null : must(groupIds[p.group], "el grupo del alumno"),
    fullName: p.fullName,
    passwordHash: await hashPassword(PASSWORD),
    /* Sin esto, cada cuenta manda a la pantalla de cambiar contraseña en
       el primer ingreso — que es lo correcto en producción y una molestia
       ocho veces seguidas acá. */
    mustChangePassword: false,
    active: true,
    deletedAt: null,
  };

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, p.username))
    .limit(1);

  if (existing) {
    /* Repone la contraseña y los vínculos: si la cambiaste probando, la
       siguiente corrida te la deja de nuevo como dice este archivo. */
    await db
      .update(schema.users)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.users.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(schema.users)
    .values({ ...values, username: p.username })
    .returning({ id: schema.users.id });
  return must(created, `la cuenta ${p.username}`).id;
}

async function main() {
  assertLocal();
  await runMigrations(sql, (m) => console.log(`  ${m}`));

  const sedeId = await ensureSede();
  const groupIds: string[] = [];
  for (const g of GROUPS) groupIds.push(await ensureGroup(sedeId, g));

  const ids = new Map<string, string>();
  for (const p of PEOPLE) ids.set(p.username, await ensurePerson(p, sedeId, groupIds));

  /* Los docentes se vinculan por `group_teachers`, no por una columna:
     un docente puede tener varios grupos y un grupo varios docentes. */
  for (const p of PEOPLE) {
    if (p.teaches === undefined) continue;
    const userId = must(ids.get(p.username), `el id de ${p.username}`);
    const groupId = must(groupIds[p.teaches], "el grupo a cargo");
    await db.insert(schema.groupTeachers).values({ groupId, userId }).onConflictDoNothing();
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`\nCuentas de prueba en "${SEDE}" — todas con la contraseña ${PASSWORD}\n`);
  console.log(`  ${pad("usuario", 12)}${pad("rol", 12)}dónde`);
  console.log(`  ${"─".repeat(46)}`);
  for (const p of PEOPLE) {
    const where =
      p.role === "superadmin" ? "toda la plataforma"
      : p.group !== undefined ? `alumno de ${must(GROUPS[p.group], "grupo").name}`
      : p.teaches !== undefined ? `a cargo de ${must(GROUPS[p.teaches], "grupo").name}`
      : SEDE;
    console.log(`  ${pad(p.username, 12)}${pad(p.role, 12)}${where}`);
  }
  console.log("");
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("seed-local falló:", err instanceof Error ? err.message : err);
    await sql.end();
    process.exit(1);
  });
