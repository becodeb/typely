/* Progreso — lo que el alumno completa, y lo que leen los dashboards.
 *
 * Este archivo es el que cierra el circuito roto del sistema anterior:
 * el alumno no podía iniciar sesión, así que nunca tenía token, así que
 * su progreso nunca salía del navegador, así que estas tablas quedaban
 * vacías y los dashboards mostraban ceros. Arreglado el login, faltaba
 * que el envío fuera confiable.
 *
 * Dos cambios que importan:
 *
 *  1. `POST /api/progress/complete` acepta un LOTE. El cliente encola los
 *     niveles terminados y los manda juntos; si no hay red, reintenta.
 *     Antes era uno por uno con `.catch(() => [])`, así que un fallo de red
 *     se tragaba el nivel para siempre y nadie se enteraba.
 *
 *  2. `GET /api/progress/me` existía y NADIE la llamaba. Ahora es la que
 *     hidrata al alumno cuando entra, y es lo que hace que el progreso
 *     sobreviva a cambiar de computadora o borrar el caché.
 *
 * El camino caliente sigue siendo local: el juego escribe en localStorage
 * y nunca espera a la red para responder una tecla.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireActor, requirePermission } from "../authContext.js";
import { syncStats, getAchievements, computeStats } from "../stats.js";

const completeItemSchema = z.object({
  worldId: z.string().min(1),
  levelNumber: z.number().int().min(1).max(60),
  accuracy: z.number().int().min(0).max(100),
  wpm: z.number().int().min(0).max(400).optional(),
  errorCount: z.number().int().min(0).default(0),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});

/* Acepta un objeto suelto o un lote. El cliente viejo manda uno; el nuevo
   manda `{ items: [...] }`. */
const completeSchema = z.union([
  completeItemSchema.transform((item) => ({ items: [item] })),
  z.object({ items: z.array(completeItemSchema).min(1).max(50) }),
]);

export async function progressRoutes(app: FastifyInstance) {
  /* ----- GET /api/progress/me -----
     Hidratación al entrar al juego. */
  app.get("/api/progress/me", async (req, reply) => {
    const actor = requireActor(req);
    const rows = await db
      .select({
        worldId: schema.levelProgress.worldId,
        levelNumber: schema.levelProgress.levelNumber,
        completed: schema.levelProgress.completed,
        bestAccuracy: schema.levelProgress.bestAccuracy,
        bestWpm: schema.levelProgress.bestWpm,
        attempts: schema.levelProgress.attempts,
        lastAttemptAt: schema.levelProgress.lastAttemptAt,
      })
      .from(schema.levelProgress)
      .where(eq(schema.levelProgress.userId, actor.id));
    return reply.send(rows);
  });

  /* ----- POST /api/progress/complete -----
     Idempotente por naturaleza: `level_progress` guarda el MEJOR resultado,
     así que reenviar un nivel ya registrado no rompe nada. Eso es lo que
     hace seguro que el cliente reintente. */
  app.post("/api/progress/complete", async (req, reply) => {
    const actor = requirePermission(req, "progress:write-own");
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const { items } = parsed.data;

    /* Todo el lote en una transacción: o entra completo o no entra nada.
       Media tanda aplicada dejaría al cliente sin saber qué reintentar. */
    await db.transaction(async (tx) => {
      for (const it of items) {
        await tx
          .insert(schema.levelProgress)
          .values({
            userId: actor.id,
            worldId: it.worldId,
            levelNumber: it.levelNumber,
            completed: true,
            bestAccuracy: it.accuracy,
            bestWpm: it.wpm ?? null,
            attempts: 1,
            lastAttemptAt: new Date(it.endedAt),
          })
          .onConflictDoUpdate({
            target: [
              schema.levelProgress.userId,
              schema.levelProgress.worldId,
              schema.levelProgress.levelNumber,
            ],
            set: {
              bestAccuracy: sql`GREATEST(${schema.levelProgress.bestAccuracy}, EXCLUDED.best_accuracy)`,
              bestWpm: sql`GREATEST(COALESCE(${schema.levelProgress.bestWpm}, 0), COALESCE(EXCLUDED.best_wpm, 0))`,
              attempts: sql`${schema.levelProgress.attempts} + 1`,
              completed: sql`true`,
              lastAttemptAt: new Date(it.endedAt),
            },
          });
      }

      /* La bitácora de intentos es append-only: un INSERT con todas las
         filas del lote, no uno por vuelta. */
      await tx.insert(schema.attempts).values(
        items.map((it) => ({
          userId: actor.id,
          worldId: it.worldId,
          levelNumber: it.levelNumber,
          startedAt: new Date(it.startedAt),
          endedAt: new Date(it.endedAt),
          accuracy: it.accuracy,
          wpm: it.wpm ?? null,
          errorCount: it.errorCount,
          completed: true,
        })),
      );
    });

    /* Las estadísticas se recalculan después de confirmar la transacción.
       Si esto falla, el progreso YA está guardado — se recalcula solo en el
       próximo envío, así que no se pierde nada. */
    let unlockedAchievements: string[] = [];
    try {
      ({ newlyUnlocked: unlockedAchievements } = await syncStats(actor.id));
    } catch (err) {
      req.log.error({ err }, "syncStats falló tras guardar el progreso");
    }

    return reply.send({ ok: true, saved: items.length, unlockedAchievements });
  });

  /* ----- GET /api/me/stats — el estado de gamificación del alumno ----- */
  app.get("/api/me/stats", async (req, reply) => {
    const actor = requireActor(req);
    const [stats, achievements] = await Promise.all([
      computeStats(actor.id),
      getAchievements(actor.id),
    ]);
    return reply.send({ stats, achievements });
  });

  /* ----- GET /api/teacher/students -----
     Los alumnos que el docente tiene a cargo, con su progreso. Un admin ve
     los de su sede; el superadmin, todos. */
  app.get("/api/teacher/students", async (req, reply) => {
    const actor = requirePermission(req, "progress:read-scope");

    const conditions = [eq(schema.users.role, "alumno"), isNull(schema.users.deletedAt)];
    if (actor.role === "docente") {
      const groups = await db
        .select({ groupId: schema.groupTeachers.groupId })
        .from(schema.groupTeachers)
        .where(eq(schema.groupTeachers.userId, actor.id));
      const ids = groups.map((g) => g.groupId);
      if (!ids.length) return reply.send([]);
      conditions.push(inArray(schema.users.groupId, ids));
    } else if (actor.role === "admin") {
      if (!actor.sedeId) return reply.send([]);
      conditions.push(eq(schema.users.sedeId, actor.sedeId));
    }

    const students = await db
      .select({
        id: schema.users.id,
        fullName: schema.users.fullName,
        username: schema.users.username,
        email: schema.users.email,
        groupId: schema.users.groupId,
        lastLoginAt: schema.users.lastLoginAt,
      })
      .from(schema.users)
      .where(and(...conditions))
      .orderBy(schema.users.fullName);

    if (!students.length) return reply.send([]);

    /* Una sola consulta para el progreso de todos, no una por alumno. */
    const progress = await db
      .select()
      .from(schema.levelProgress)
      .where(inArray(schema.levelProgress.userId, students.map((s) => s.id)));

    const byUser = new Map<string, typeof progress>();
    for (const p of progress) {
      const list = byUser.get(p.userId) ?? [];
      list.push(p);
      byUser.set(p.userId, list);
    }

    return reply.send(students.map((s) => ({ ...s, progress: byUser.get(s.id) ?? [] })));
  });
}
