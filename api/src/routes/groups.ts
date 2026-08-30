/* Grupos (los "cursos" de la escuela) — listar, crear, editar, borrar,
 * administrar docentes y alumnos, y elegir qué islas ve el grupo.
 *
 * Reemplaza a `routes/classes.ts`. Qué cambió y por qué:
 *
 *  - `classes` pasa a llamarse `groups`, que es la palabra que usa el
 *    producto.
 *  - Se fue todo el aparato de año lectivo (`academic_year_id`, `status`
 *    archivado, `class_enrollments`). Un alumno pertenece a un grupo y
 *    listo; el historial de progreso se conserva igual porque cuelga del
 *    alumno, no del grupo.
 *  - La matrícula del alumno vive en `users.group_id` (uno por alumno) y
 *    la del docente en `group_teachers` (varios grupos). Antes había TRES
 *    representaciones en paralelo — `users.class_id`, `class_students` y
 *    `class_enrollments` — que se desincronizaban entre sí.
 *  - Los conteos del listado se resuelven en la MISMA consulta. El código
 *    anterior traía los cursos y después contaba alumnos y docentes de
 *    TODOS los cursos de la base, sin filtrar por los que iba a devolver.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireActor, requirePermission } from "../authContext.js";
import { ForbiddenError, canActOnSede, type Actor } from "../rbac.js";
import { audit } from "../audit.js";

const GRADES = ["inicial", "1ep", "2ep", "3ep", "4ep", "5ep", "6ep", "sec", "libre"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "El grupo necesita un nombre."),
  sedeId: z.string().uuid().optional(),
  grade: z.enum(GRADES).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  grade: z.enum(GRADES).optional(),
  active: z.boolean().optional(),
});

/** Los grupos que un docente tiene a cargo. */
async function teacherGroupIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: schema.groupTeachers.groupId })
    .from(schema.groupTeachers)
    .where(eq(schema.groupTeachers.userId, userId));
  return rows.map((r) => r.groupId);
}

/** Carga un grupo exigiendo permiso de ESCRITURA (admin de la sede o
 *  superadmin). Un docente nunca edita el grupo en sí. */
async function loadGroupForWrite(actor: Actor, id: string, reply: FastifyReply) {
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, id)).limit(1);
  if (!group) {
    reply.code(404).send({ error: "Grupo no encontrado." });
    return null;
  }
  if (!canActOnSede(actor, group.sedeId)) {
    reply.code(403).send({ error: "Ese grupo pertenece a otra sede." });
    return null;
  }
  return group;
}

/** Carga un grupo para LECTURA. Además del admin de la sede, lo puede ver
 *  el docente que lo tiene asignado — aunque su sede no coincida, que pasa
 *  cuando alguien da clase en más de una. */
async function loadGroupForRead(actor: Actor, id: string, reply: FastifyReply) {
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, id)).limit(1);
  if (!group) {
    reply.code(404).send({ error: "Grupo no encontrado." });
    return null;
  }
  if (canActOnSede(actor, group.sedeId)) return group;
  if (actor.role === "docente") {
    const [assigned] = await db
      .select({ groupId: schema.groupTeachers.groupId })
      .from(schema.groupTeachers)
      .where(
        and(eq(schema.groupTeachers.groupId, id), eq(schema.groupTeachers.userId, actor.id)),
      )
      .limit(1);
    if (assigned) return group;
  }
  /* Un alumno puede leer SU propio grupo — lo necesita para saber qué
     islas tiene habilitadas. */
  if (actor.role === "alumno") {
    const [me] = await db
      .select({ groupId: schema.users.groupId })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id))
      .limit(1);
    if (me?.groupId === id) return group;
  }
  reply.code(403).send({ error: "No tenés acceso a ese grupo." });
  return null;
}

export async function groupRoutes(app: FastifyInstance) {
  /* ----- GET /api/groups?sedeId= ----- */
  app.get("/api/groups", async (req, reply) => {
    const actor = requirePermission(req, "group:read");
    const { sedeId } = req.query as { sedeId?: string };

    const conditions = [];
    if (actor.role === "admin") {
      if (!actor.sedeId) return reply.send([]);
      conditions.push(eq(schema.groups.sedeId, actor.sedeId));
    } else if (actor.role === "docente") {
      const ids = await teacherGroupIds(actor.id);
      if (!ids.length) return reply.send([]);
      conditions.push(inArray(schema.groups.id, ids));
    } else if (sedeId) {
      conditions.push(eq(schema.groups.sedeId, sedeId));
    }

    /* Los conteos van como subconsultas correlacionadas: una sola ida a la
       base, y cuentan solo los grupos que realmente devolvemos. */
    const rows = await db
      .select({
        id: schema.groups.id,
        name: schema.groups.name,
        grade: schema.groups.grade,
        sedeId: schema.groups.sedeId,
        active: schema.groups.active,
        studentCount: sql<number>`(
          SELECT count(*)::int FROM users u
          WHERE u.group_id = ${schema.groups.id}
            AND u.role = 'alumno'
            AND u.deleted_at IS NULL
        )`,
        teacherCount: sql<number>`(
          SELECT count(*)::int FROM group_teachers gt
          WHERE gt.group_id = ${schema.groups.id}
        )`,
      })
      .from(schema.groups)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(schema.groups.name);

    return reply.send(rows);
  });

  /* ----- POST /api/groups ----- */
  app.post("/api/groups", async (req, reply) => {
    const actor = requirePermission(req, "group:write");
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    }
    /* Un admin siempre crea en SU sede: aunque mande otro sedeId, se
       ignora. El superadmin tiene que decir explícitamente cuál. */
    const sedeId = actor.role === "admin" ? actor.sedeId : (parsed.data.sedeId ?? null);
    if (!sedeId) {
      return reply.code(400).send({ error: "Falta indicar la sede del grupo." });
    }
    if (!canActOnSede(actor, sedeId)) {
      throw new ForbiddenError("No podés crear grupos en otra sede.");
    }

    try {
      const [group] = await db
        .insert(schema.groups)
        .values({ name: parsed.data.name, sedeId, grade: parsed.data.grade ?? "libre" })
        .returning();
      await audit({ actor, action: "create_group", entityType: "group", entityId: group!.id, meta: { name: group!.name } });
      return reply.code(201).send(group);
    } catch (err) {
      /* groups_sede_name_unique — el nombre del grupo es único por sede
         para que el import por CSV pueda resolver "4to B" sin ambigüedad. */
      if (String((err as { code?: string }).code) === "23505") {
        return reply.code(409).send({ error: "Ya existe un grupo con ese nombre en esta sede." });
      }
      throw err;
    }
  });

  /* ----- PATCH /api/groups/:id ----- */
  app.patch("/api/groups/:id", async (req, reply) => {
    const actor = requirePermission(req, "group:write");
    const { id } = req.params as { id: string };
    const group = await loadGroupForWrite(actor, id, reply);
    if (!group) return;

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    const [updated] = await db
      .update(schema.groups)
      .set(parsed.data)
      .where(eq(schema.groups.id, id))
      .returning();
    await audit({ actor, action: "update_group", entityType: "group", entityId: id, meta: parsed.data });
    return reply.send(updated);
  });

  /* ----- DELETE /api/groups/:id -----
     Solo si está vacío. Borrar un grupo con gente adentro dejaría a los
     alumnos sin grupo de forma silenciosa (la FK es ON DELETE SET NULL), y
     eso se descubre tarde y mal. */
  app.delete("/api/groups/:id", async (req, reply) => {
    const actor = requirePermission(req, "group:write");
    const { id } = req.params as { id: string };
    const group = await loadGroupForWrite(actor, id, reply);
    if (!group) return;

    const counted = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.groupId, id),
          eq(schema.users.role, "alumno"),
          isNull(schema.users.deletedAt),
        ),
      );
    const studentCount = Number(counted[0]?.n ?? 0);
    if (studentCount > 0) {
      return reply.code(409).send({
        error: `El grupo todavía tiene ${studentCount} alumno${studentCount === 1 ? "" : "s"}. Movelos o quitalos antes de borrarlo.`,
      });
    }

    await db.delete(schema.groups).where(eq(schema.groups.id, id));
    await audit({ actor, action: "delete_group", entityType: "group", entityId: id, meta: { name: group.name } });
    return reply.send({ ok: true });
  });

  /* ----- GET /api/groups/:id/members ----- */
  app.get("/api/groups/:id/members", async (req, reply) => {
    const actor = requirePermission(req, "group:read");
    const { id } = req.params as { id: string };
    const group = await loadGroupForRead(actor, id, reply);
    if (!group) return;

    const [students, teachers] = await Promise.all([
      db
        .select({
          id: schema.users.id,
          fullName: schema.users.fullName,
          username: schema.users.username,
          email: schema.users.email,
          active: schema.users.active,
          lastLoginAt: schema.users.lastLoginAt,
        })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.groupId, id),
            eq(schema.users.role, "alumno"),
            isNull(schema.users.deletedAt),
          ),
        )
        .orderBy(schema.users.fullName),
      db
        .select({
          id: schema.users.id,
          fullName: schema.users.fullName,
          username: schema.users.username,
          email: schema.users.email,
          active: schema.users.active,
          lastLoginAt: schema.users.lastLoginAt,
        })
        .from(schema.groupTeachers)
        .innerJoin(schema.users, eq(schema.users.id, schema.groupTeachers.userId))
        .where(and(eq(schema.groupTeachers.groupId, id), isNull(schema.users.deletedAt)))
        .orderBy(schema.users.fullName),
    ]);

    return reply.send({ group, students, teachers });
  });

  /* ----- POST /api/groups/:id/teachers  { userId } ----- */
  app.post("/api/groups/:id/teachers", async (req, reply) => {
    const actor = requirePermission(req, "group:write");
    const { id } = req.params as { id: string };
    const group = await loadGroupForWrite(actor, id, reply);
    if (!group) return;

    const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    const [teacher] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, parsed.data.userId), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!teacher || teacher.role !== "docente") {
      return reply.code(400).send({ error: "Ese usuario no es un docente." });
    }
    if (!canActOnSede(actor, teacher.sedeId)) {
      throw new ForbiddenError("Ese docente pertenece a otra sede.");
    }

    await db
      .insert(schema.groupTeachers)
      .values({ groupId: id, userId: teacher.id })
      .onConflictDoNothing();
    await audit({ actor, action: "assign_teacher", entityType: "group", entityId: id, meta: { userId: teacher.id } });
    return reply.send({ ok: true });
  });

  /* ----- DELETE /api/groups/:id/teachers/:userId ----- */
  app.delete("/api/groups/:id/teachers/:userId", async (req, reply) => {
    const actor = requirePermission(req, "group:write");
    const { id, userId } = req.params as { id: string; userId: string };
    const group = await loadGroupForWrite(actor, id, reply);
    if (!group) return;

    await db
      .delete(schema.groupTeachers)
      .where(and(eq(schema.groupTeachers.groupId, id), eq(schema.groupTeachers.userId, userId)));
    await audit({ actor, action: "unassign_teacher", entityType: "group", entityId: id, meta: { userId } });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/groups/:id/students  { userId } -----
     Mover a un alumno a este grupo. Como es UN grupo por alumno, esto
     también lo saca del anterior: es una asignación, no un agregado. */
  app.post("/api/groups/:id/students", async (req, reply) => {
    const actor = requirePermission(req, "group:write");
    const { id } = req.params as { id: string };
    const group = await loadGroupForWrite(actor, id, reply);
    if (!group) return;

    const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    const [student] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, parsed.data.userId), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!student || student.role !== "alumno") {
      return reply.code(400).send({ error: "Ese usuario no es un alumno." });
    }
    if (!canActOnSede(actor, student.sedeId)) {
      throw new ForbiddenError("Ese alumno pertenece a otra sede.");
    }

    await db
      .update(schema.users)
      .set({ groupId: id })
      .where(eq(schema.users.id, student.id));
    await audit({ actor, action: "assign_student", entityType: "group", entityId: id, meta: { userId: student.id } });
    return reply.send({ ok: true });
  });

  /* ----- DELETE /api/groups/:id/students/:userId -----
     Lo saca del grupo SIN borrar la cuenta ni su progreso. */
  app.delete("/api/groups/:id/students/:userId", async (req, reply) => {
    const actor = requirePermission(req, "group:write");
    const { id, userId } = req.params as { id: string; userId: string };
    const group = await loadGroupForWrite(actor, id, reply);
    if (!group) return;

    await db
      .update(schema.users)
      .set({ groupId: null })
      .where(and(eq(schema.users.id, userId), eq(schema.users.groupId, id)));
    await audit({ actor, action: "unassign_student", entityType: "group", entityId: id, meta: { userId } });
    return reply.send({ ok: true });
  });

  /* ----- GET /api/groups/:id/worlds -----
     Sin filas = sin restricción: el alumno ve todas las islas de su grado.
     Esta tabla es la ÚNICA fuente de verdad. Antes el docente guardaba la
     selección acá y el alumno la leía de localStorage, así que configurar
     un grupo no tenía ningún efecto visible. */
  app.get("/api/groups/:id/worlds", async (req, reply) => {
    const actor = requirePermission(req, "group:read");
    const { id } = req.params as { id: string };
    const group = await loadGroupForRead(actor, id, reply);
    if (!group) return;

    const rows = await db
      .select({ worldId: schema.groupWorlds.worldId, isEnabled: schema.groupWorlds.isEnabled })
      .from(schema.groupWorlds)
      .where(eq(schema.groupWorlds.groupId, id));

    return reply.send({
      worldIds: rows.length ? rows.filter((r) => r.isEnabled).map((r) => r.worldId) : null,
    });
  });

  /* ----- PUT /api/groups/:id/worlds  { worldIds: string[] | null } ----- */
  app.put("/api/groups/:id/worlds", async (req, reply) => {
    const actor = requirePermission(req, "group:worlds:write");
    const { id } = req.params as { id: string };
    /* El docente administra las islas de SU grupo, así que acá alcanza con
       permiso de lectura sobre el grupo (que ya distingue asignados). */
    const group = await loadGroupForRead(actor, id, reply);
    if (!group) return;
    if (actor.role === "alumno") throw new ForbiddenError("No autorizado.");

    const parsed = z
      .object({ worldIds: z.array(z.string().min(1)).nullable() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    await db.transaction(async (tx) => {
      await tx.delete(schema.groupWorlds).where(eq(schema.groupWorlds.groupId, id));
      const ids = parsed.data.worldIds;
      if (ids && ids.length) {
        await tx
          .insert(schema.groupWorlds)
          .values(ids.map((worldId) => ({ groupId: id, worldId, isEnabled: true })));
      }
    });

    await audit({ actor, action: "set_group_worlds", entityType: "group", entityId: id, meta: { count: parsed.data.worldIds?.length ?? null } });
    return reply.send({ ok: true });
  });

  /* ----- GET /api/groups/mine -----
     Atajo para el alumno: su grupo y las islas habilitadas, sin que tenga
     que conocer ningún id. */
  app.get("/api/groups/mine", async (req, reply) => {
    const actor = requireActor(req);
    const [me] = await db
      .select({ groupId: schema.users.groupId })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id))
      .limit(1);
    if (!me?.groupId) return reply.send({ group: null, worldIds: null });

    const [group] = await db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.id, me.groupId))
      .limit(1);
    const rows = await db
      .select({ worldId: schema.groupWorlds.worldId, isEnabled: schema.groupWorlds.isEnabled })
      .from(schema.groupWorlds)
      .where(eq(schema.groupWorlds.groupId, me.groupId));

    return reply.send({
      group: group ?? null,
      worldIds: rows.length ? rows.filter((r) => r.isEnabled).map((r) => r.worldId) : null,
    });
  });
}
