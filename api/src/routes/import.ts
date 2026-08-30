/* Alta masiva por CSV — el admin sube la lista de un curso y el sistema
 * crea las cuentas con usuario y contraseña temporal para imprimir.
 *
 * Formato (con o sin fila de encabezado):
 *
 *     nombre,rol,grupo,email
 *     Sofía Gómez,alumno,4to B,
 *     Marcela Ruiz,docente,4to B,mruiz@escuela.edu.ar
 *
 *  - `rol`: "alumno" o "docente". Vacío = alumno.
 *  - `grupo`: opcional; se crea si no existe en la sede.
 *  - `email`: OPCIONAL. Un alumno de primaria no tiene, y no lo necesita.
 *
 * Dos endpoints:
 *   POST /api/import/preview  → qué se crearía, qué choca. No escribe nada.
 *   POST /api/import          → lo hace, en UNA transacción.
 *
 * Por qué transaccional: la versión anterior insertaba fila por fila en un
 * `for`. Si fallaba en la mitad de un curso de 300, quedaban 150 cuentas
 * creadas, sin forma de saber cuáles, y reintentar duplicaba. Ahora entra
 * todo o no entra nada.
 *
 * Y por qué preview: el admin ve la planilla resultante ANTES de escribir.
 * Un CSV con una columna corrida creaba 300 usuarios basura que había que
 * borrar a mano.
 */

import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { hashPassword } from "../auth.js";
import { requirePermission } from "../authContext.js";
import { assertCanGrant, canActOnSede, ForbiddenError, type Actor } from "../rbac.js";
import { assignUsernames, makeTempPassword } from "../userIdentity.js";
import { audit } from "../audit.js";

interface ParsedRow {
  line: number;
  fullName: string;
  role: "alumno" | "docente";
  groupName: string | null;
  email: string | null;
}

interface RowError {
  line: number;
  message: string;
}

/* Parser mínimo pero correcto: soporta comillas, comas dentro de comillas y
   comillas escapadas (""). No usamos una librería porque el formato es
   nuestro y son 40 líneas. */
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (field.length || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
      if (ch === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseCsv(text: string): { rows: ParsedRow[]; errors: RowError[] } {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const lines = splitCsv(text);
  if (!lines.length) return { rows, errors };

  /* Encabezado opcional: si la primera fila menciona "nombre" o "email",
     la salteamos. */
  const first = lines[0]!.map((c) => c.trim().toLowerCase());
  const hasHeader = first.includes("nombre") || first.includes("email") || first.includes("name");
  const data = hasHeader ? lines.slice(1) : lines;
  const offset = hasHeader ? 2 : 1; // número de línea real, para el mensaje

  const seenNames = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const cells = data[i]!;
    const line = i + offset;
    if (!cells.some((c) => c.trim())) continue; // fila vacía

    const [rawName, rawRole, rawGroup, rawEmail] = cells.map((c) => (c ?? "").trim());

    if (!rawName) { errors.push({ line, message: "Falta el nombre." }); continue; }
    if (rawName.length > 120) { errors.push({ line, message: "El nombre es demasiado largo." }); continue; }

    const role = (rawRole || "alumno").toLowerCase();
    if (role !== "alumno" && role !== "docente") {
      errors.push({ line, message: `Rol no válido: "${rawRole}". Usá "alumno" o "docente".` });
      continue;
    }

    let email: string | null = null;
    if (rawEmail) {
      const e = rawEmail.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        errors.push({ line, message: `Email inválido: "${rawEmail}".` });
        continue;
      }
      email = e;
    }

    /* Un docente sin email no puede usar Google, pero sí entrar con usuario
       y contraseña. No es un error: se avisa en el preview. */

    const key = rawName.toLowerCase();
    if (seenNames.has(key)) {
      errors.push({ line, message: `"${rawName}" aparece más de una vez en el archivo.` });
      continue;
    }
    seenNames.add(key);

    rows.push({ line, fullName: rawName, role, groupName: rawGroup || null, email });
  }

  return { rows, errors };
}

/** Trabajo común a preview e import: valida contra la base y arma el plan.
 *  No escribe nada. */
async function buildPlan(actor: Actor, csv: string) {
  const { rows, errors } = parseCsv(csv);

  const sedeId = actor.role === "admin" ? actor.sedeId : null;
  if (actor.role === "admin" && !sedeId) {
    throw new ForbiddenError("Tu cuenta no tiene una sede asignada.");
  }
  /* El superadmin tiene que importar dentro de una sede concreta: sin eso
     las cuentas quedarían colgadas sin institución. */
  if (!sedeId) {
    throw new ForbiddenError("Elegí una sede antes de importar. El superadmin no puede importar sin sede.");
  }

  for (const r of rows) assertCanGrant(actor.role, r.role);

  /* --- Choques con cuentas que ya existen. Una consulta, no una por fila. --- */
  const emails = rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  const existingEmails = emails.length
    ? await db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(and(inArray(schema.users.email, emails), isNull(schema.users.deletedAt)))
    : [];
  const takenEmails = new Set(existingEmails.map((r) => (r.email ?? "").toLowerCase()));

  /* --- Grupos: los que existen y los que habría que crear. --- */
  const groupNames = [...new Set(rows.map((r) => r.groupName).filter((g): g is string => Boolean(g)))];
  const existingGroups = groupNames.length
    ? await db
        .select({ id: schema.groups.id, name: schema.groups.name })
        .from(schema.groups)
        .where(eq(schema.groups.sedeId, sedeId))
    : [];
  const groupByName = new Map(existingGroups.map((g) => [g.name.toLowerCase(), g]));
  const groupsToCreate = groupNames.filter((n) => !groupByName.has(n.toLowerCase()));

  /* --- Filas que se pueden crear vs. las que se saltean. --- */
  const skipped: RowError[] = [];
  const creatable = rows.filter((r) => {
    if (r.email && takenEmails.has(r.email)) {
      skipped.push({ line: r.line, message: `Ya existe una cuenta con el email ${r.email}.` });
      return false;
    }
    return true;
  });

  const usernames = creatable.length ? await assignUsernames(creatable.map((r) => r.fullName)) : [];

  return {
    sedeId,
    errors,
    skipped,
    groupsToCreate,
    groupByName,
    items: creatable.map((r, i) => ({ ...r, username: usernames[i]! })),
  };
}

export async function importRoutes(app: FastifyInstance) {
  /* ----- POST /api/import/preview -----
     Cuerpo: el CSV como texto plano. No escribe nada. */
  app.post("/api/import/preview", async (req, reply) => {
    const actor = requirePermission(req, "user:import");
    const csv = String(req.body ?? "");
    if (!csv.trim()) return reply.code(400).send({ error: "El archivo está vacío." });

    const plan = await buildPlan(actor, csv);
    return reply.send({
      willCreate: plan.items.length,
      willSkip: plan.skipped.length,
      groupsToCreate: plan.groupsToCreate,
      errors: plan.errors,
      skipped: plan.skipped,
      /* Sin contraseñas: todavía no existen. Solo el plan. */
      preview: plan.items.map((it) => ({
        line: it.line,
        fullName: it.fullName,
        username: it.username,
        role: it.role,
        group: it.groupName,
        email: it.email,
      })),
    });
  });

  /* ----- POST /api/import ----- */
  app.post("/api/import", async (req, reply) => {
    const actor = requirePermission(req, "user:import");
    const csv = String(req.body ?? "");
    if (!csv.trim()) return reply.code(400).send({ error: "El archivo está vacío." });

    const plan = await buildPlan(actor, csv);
    if (!plan.items.length) {
      return reply.code(400).send({
        error: "No hay ninguna fila que se pueda crear.",
        errors: plan.errors,
        skipped: plan.skipped,
      });
    }

    /* Los hashes de bcrypt son caros (coste 12) y NO van dentro de la
       transacción: hacerlos adentro tendría la transacción abierta varios
       segundos en un curso grande, bloqueando escrituras. */
    const withSecrets = await Promise.all(
      plan.items.map(async (it) => {
        const temporaryPassword = makeTempPassword();
        return { ...it, temporaryPassword, passwordHash: await hashPassword(temporaryPassword) };
      }),
    );

    const created = await db.transaction(async (tx) => {
      /* 1. Los grupos que falten. */
      const groupByName = new Map(plan.groupByName);
      if (plan.groupsToCreate.length) {
        const rows = await tx
          .insert(schema.groups)
          .values(plan.groupsToCreate.map((name) => ({ sedeId: plan.sedeId, name })))
          .returning({ id: schema.groups.id, name: schema.groups.name });
        for (const g of rows) groupByName.set(g.name.toLowerCase(), g);
      }

      /* 2. Las cuentas, en un solo INSERT. */
      const inserted = await tx
        .insert(schema.users)
        .values(
          withSecrets.map((it) => ({
            role: it.role,
            sedeId: plan.sedeId,
            groupId:
              it.role === "alumno" && it.groupName
                ? (groupByName.get(it.groupName.toLowerCase())?.id ?? null)
                : null,
            username: it.username,
            email: it.email,
            fullName: it.fullName,
            passwordHash: it.passwordHash,
            mustChangePassword: true,
          })),
        )
        .returning({ id: schema.users.id, username: schema.users.username });

      /* 3. Los docentes, a cargo de su grupo. */
      const teacherLinks = withSecrets
        .map((it, i) => {
          if (it.role !== "docente" || !it.groupName) return null;
          const g = groupByName.get(it.groupName.toLowerCase());
          const u = inserted[i];
          return g && u ? { groupId: g.id, userId: u.id } : null;
        })
        .filter((x): x is { groupId: string; userId: string } => x !== null);
      if (teacherLinks.length) {
        await tx.insert(schema.groupTeachers).values(teacherLinks).onConflictDoNothing();
      }

      return inserted;
    });

    await audit({
      actor,
      action: "import_users",
      entityType: "user",
      meta: { created: created.length, groupsCreated: plan.groupsToCreate.length },
    });

    return reply.send({
      created: created.length,
      skipped: plan.skipped.length,
      errors: plan.errors,
      /* La planilla para imprimir y repartir. Las contraseñas se muestran
         UNA vez: no se guardan en claro en ningún lado. */
      credentials: withSecrets.map((it) => ({
        fullName: it.fullName,
        username: it.username,
        temporaryPassword: it.temporaryPassword,
        role: it.role,
        group: it.groupName,
      })),
    });
  });
}
