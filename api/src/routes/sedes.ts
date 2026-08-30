/* Sedes — las escuelas. Solo la plataforma (superadmin) las crea, edita y
 * borra; el admin de una sede puede leer la suya para el encabezado de su
 * panel, y nada más. */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, sql } from "drizzle-orm";
import { requireActor, requirePermission, requireRole } from "../authContext.js";
import { audit } from "../audit.js";

const sedeSchema = z.object({
  name: z.string().trim().min(1, "La sede necesita un nombre."),
  city: z.string().trim().optional(),
  photo: z.string().optional(),
  active: z.boolean().optional(),
});

export async function sedeRoutes(app: FastifyInstance) {
  /* ----- GET /api/sedes — el listado completo es solo de plataforma ----- */
  app.get("/api/sedes", async (req, reply) => {
    requireRole(req, "superadmin");
    const rows = await db
      .select({
        id: schema.sedes.id,
        name: schema.sedes.name,
        city: schema.sedes.city,
        photo: schema.sedes.photo,
        active: schema.sedes.active,
        /* Conteos en la misma consulta, para no hacer una vuelta por sede. */
        groupCount: sql<number>`(
          SELECT count(*)::int FROM groups g WHERE g.sede_id = ${schema.sedes.id}
        )`,
        studentCount: sql<number>`(
          SELECT count(*)::int FROM users u
          WHERE u.sede_id = ${schema.sedes.id} AND u.role = 'alumno' AND u.deleted_at IS NULL
        )`,
      })
      .from(schema.sedes)
      .orderBy(schema.sedes.name);
    return reply.send(rows);
  });

  /* ----- GET /api/sedes/mine — la propia, para cualquier rol con sede ----- */
  app.get("/api/sedes/mine", async (req, reply) => {
    const actor = requireActor(req);
    if (!actor.sedeId) return reply.code(404).send({ error: "No tenés una sede asignada." });
    const [row] = await db
      .select()
      .from(schema.sedes)
      .where(eq(schema.sedes.id, actor.sedeId))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "Sede no encontrada." });
    return reply.send(row);
  });

  /* ----- POST /api/sedes ----- */
  app.post("/api/sedes", async (req, reply) => {
    const actor = requirePermission(req, "sede:write");
    const parsed = sedeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    }
    const [row] = await db.insert(schema.sedes).values(parsed.data).returning();
    await audit({ actor, action: "create_sede", entityType: "sede", entityId: row!.id, meta: { name: row!.name } });
    return reply.code(201).send(row);
  });

  /* ----- PATCH /api/sedes/:id ----- */
  app.patch("/api/sedes/:id", async (req, reply) => {
    const actor = requirePermission(req, "sede:write");
    const { id } = req.params as { id: string };
    const parsed = sedeSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const [row] = await db
      .update(schema.sedes)
      .set(parsed.data)
      .where(eq(schema.sedes.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "Sede no encontrada." });
    await audit({ actor, action: "update_sede", entityType: "sede", entityId: id, meta: parsed.data });
    return reply.send(row);
  });

  /* ----- DELETE /api/sedes/:id -----
     Solo si está vacía. Borrar una sede con gente adentro haría cascada
     sobre sus grupos y dejaría a alumnos y docentes huérfanos — un click
     de más y se pierde una escuela entera. */
  app.delete("/api/sedes/:id", async (req, reply) => {
    const actor = requirePermission(req, "sede:write");
    const { id } = req.params as { id: string };

    const counted = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(sql`${schema.users.sedeId} = ${id} AND ${schema.users.deletedAt} IS NULL`);
    const people = Number(counted[0]?.n ?? 0);
    if (people > 0) {
      return reply.code(409).send({
        error: `Esa sede todavía tiene ${people} cuenta${people === 1 ? "" : "s"} activa${people === 1 ? "" : "s"}. Movelas o borralas antes.`,
      });
    }

    const [row] = await db.delete(schema.sedes).where(eq(schema.sedes.id, id)).returning();
    if (!row) return reply.code(404).send({ error: "Sede no encontrada." });
    await audit({ actor, action: "delete_sede", entityType: "sede", entityId: id, meta: { name: row.name } });
    return reply.send({ ok: true });
  });
}
