/* Dashboards — la vista del docente y la del admin.
 *
 * Una sola llamada arma la pantalla de inicio: contadores, actividad de la
 * semana, alertas, grupos que necesitan atención y últimos movimientos.
 *
 * El cambio importante respecto de la versión anterior: **el docente ahora
 * entra acá**. Antes `requireStaff` lo rechazaba junto con el alumno, así
 * que el "dashboard del docente" no existía — tenía que armarse a mano con
 * llamadas sueltas. Ahora es el mismo endpoint, con el alcance recortado a
 * sus grupos.
 *
 * Alcance por rol:
 *   superadmin → la sede que pida por ?sedeId
 *   admin      → su sede
 *   docente    → solo sus grupos
 */

import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { requirePermission } from "../authContext.js";
import { canActOnSede, type Actor } from "../rbac.js";
import { getAchievements } from "../stats.js";

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const worldNum = (w: string) => Number(w.replace("island", "")) || 0;

interface Scope {
  groups: { id: string; name: string }[];
  studentIds: string[];
  studentNames: Map<string, string>;
  teachers: { id: string; lastLoginAt: Date | null }[];
}

/** Resuelve qué grupos y qué alumnos puede ver este actor. */
async function resolveScope(actor: Actor, querySedeId?: string): Promise<Scope | null> {
  let groupIds: string[] | null = null;
  let sedeId: string | null = null;

  if (actor.role === "docente") {
    const rows = await db
      .select({ groupId: schema.groupTeachers.groupId })
      .from(schema.groupTeachers)
      .where(eq(schema.groupTeachers.userId, actor.id));
    groupIds = rows.map((r) => r.groupId);
    if (!groupIds.length) return null;
  } else {
    sedeId = actor.role === "admin" ? actor.sedeId : (querySedeId ?? actor.sedeId);
    if (!sedeId) return null;
    if (!canActOnSede(actor, sedeId)) return null;
  }

  const groups = await db
    .select({ id: schema.groups.id, name: schema.groups.name })
    .from(schema.groups)
    .where(groupIds ? inArray(schema.groups.id, groupIds) : eq(schema.groups.sedeId, sedeId!))
    .orderBy(schema.groups.name);

  const students = await db
    .select({ id: schema.users.id, fullName: schema.users.fullName })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.role, "alumno"),
        isNull(schema.users.deletedAt),
        groupIds
          ? inArray(schema.users.groupId, groupIds)
          : eq(schema.users.sedeId, sedeId!),
      ),
    );

  /* Un docente no "tiene" docentes a cargo: para él la lista es vacía y las
     alertas de staff no aplican. */
  const teachers =
    actor.role === "docente"
      ? []
      : await db
          .select({ id: schema.users.id, lastLoginAt: schema.users.lastLoginAt })
          .from(schema.users)
          .where(
            and(
              eq(schema.users.role, "docente"),
              eq(schema.users.sedeId, sedeId!),
              isNull(schema.users.deletedAt),
            ),
          );

  return {
    groups,
    studentIds: students.map((s) => s.id),
    studentNames: new Map(students.map((s) => [s.id, s.fullName])),
    teachers,
  };
}

const EMPTY_OVERVIEW = {
  counts: { groups: 0, teachers: 0, students: 0 },
  activeToday: 0,
  avgProgress: 0,
  weekly: [] as { date: string; label: string; count: number }[],
  alerts: { inactiveStudents: 0, lowPrecisionStudents: 0, inactiveTeachers: 0, groupsNoTeacher: 0 },
  attentionGroups: [] as { id: string; name: string; reason: string }[],
  recent: [] as unknown[],
};

export async function adminRoutes(app: FastifyInstance) {
  /* ----- GET /api/admin/overview?sedeId= ----- */
  app.get("/api/admin/overview", async (req, reply) => {
    const actor = requirePermission(req, "progress:read-scope");
    const { sedeId } = req.query as { sedeId?: string };

    const scope = await resolveScope(actor, sedeId);
    if (!scope) return reply.send(EMPTY_OVERVIEW);
    const { groups, studentIds, studentNames, teachers } = scope;

    const now = Date.now();
    const since7 = new Date(now - 7 * DAY);
    const since14 = new Date(now - 14 * DAY);
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const groupIds = groups.map((g) => g.id);
    const hasStudents = studentIds.length > 0;

    const [lastAttempts, perUser, recent, weeklyRows, teacherCounts, roster] = await Promise.all([
      hasStudents
        ? db
            .select({ userId: schema.attempts.userId, last: sql<string>`max(${schema.attempts.endedAt})` })
            .from(schema.attempts)
            .where(inArray(schema.attempts.userId, studentIds))
            .groupBy(schema.attempts.userId)
        : Promise.resolve([] as { userId: string; last: string }[]),
      hasStudents
        ? db
            .select({
              userId: schema.levelProgress.userId,
              avg: sql<number>`round(avg(${schema.levelProgress.bestAccuracy}))::int`,
              done: sql<number>`count(*) filter (where ${schema.levelProgress.completed})::int`,
              stars: sql<number>`sum(case when ${schema.levelProgress.completed} then case when ${schema.levelProgress.bestAccuracy} >= 90 then 3 when ${schema.levelProgress.bestAccuracy} >= 75 then 2 else 1 end else 0 end)::int`,
            })
            .from(schema.levelProgress)
            .where(inArray(schema.levelProgress.userId, studentIds))
            .groupBy(schema.levelProgress.userId)
        : Promise.resolve([] as { userId: string; avg: number; done: number; stars: number }[]),
      hasStudents
        ? db
            .select({
              userId: schema.attempts.userId,
              worldId: schema.attempts.worldId,
              endedAt: schema.attempts.endedAt,
              completed: schema.attempts.completed,
            })
            .from(schema.attempts)
            .where(inArray(schema.attempts.userId, studentIds))
            .orderBy(desc(schema.attempts.endedAt))
            .limit(8)
        : Promise.resolve([] as { userId: string; worldId: string; endedAt: Date; completed: boolean }[]),
      hasStudents
        ? db
            .select({
              day: sql<string>`to_char(date_trunc('day', ${schema.attempts.endedAt}), 'YYYY-MM-DD')`,
              c: sql<number>`count(*)::int`,
            })
            .from(schema.attempts)
            .where(and(inArray(schema.attempts.userId, studentIds), gte(schema.attempts.endedAt, since7)))
            .groupBy(sql`date_trunc('day', ${schema.attempts.endedAt})`)
        : Promise.resolve([] as { day: string; c: number }[]),
      groupIds.length
        ? db
            .select({ groupId: schema.groupTeachers.groupId, n: sql<number>`count(*)::int` })
            .from(schema.groupTeachers)
            .where(inArray(schema.groupTeachers.groupId, groupIds))
            .groupBy(schema.groupTeachers.groupId)
        : Promise.resolve([] as { groupId: string; n: number }[]),
      groupIds.length
        ? db
            .select({ groupId: schema.users.groupId, userId: schema.users.id })
            .from(schema.users)
            .where(
              and(
                inArray(schema.users.groupId, groupIds),
                eq(schema.users.role, "alumno"),
                isNull(schema.users.deletedAt),
              ),
            )
        : Promise.resolve([] as { groupId: string | null; userId: string }[]),
    ]);

    const lastById = new Map(lastAttempts.map((r) => [r.userId, new Date(r.last).getTime()]));
    const accById = new Map(perUser.map((r) => [r.userId, r.avg]));
    const teacherCountById = new Map(teacherCounts.map((r) => [r.groupId, r.n]));

    const avgProgress = perUser.length
      ? Math.round(perUser.reduce((a, r) => a + r.avg, 0) / perUser.length)
      : 0;
    const activeToday = [...lastById.values()].filter((t) => t >= startToday.getTime()).length;
    const totalStars = perUser.reduce((a, r) => a + (r.stars ?? 0), 0);

    /* Semana: se rellenan los 7 días con ceros para que el gráfico no
       "salte" los días sin actividad. */
    const weeklyMap = new Map(weeklyRows.map((r) => [r.day, r.c]));
    const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const weekly = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      weekly.push({ date: dayKey(d), label: DOW[d.getDay()] ?? "", count: weeklyMap.get(dayKey(d)) ?? 0 });
    }

    const studentsByGroup = new Map<string, string[]>();
    for (const r of roster) {
      if (!r.groupId) continue;
      const arr = studentsByGroup.get(r.groupId) ?? [];
      arr.push(r.userId);
      studentsByGroup.set(r.groupId, arr);
    }

    const inactiveStudents = studentIds.filter((id) => (lastById.get(id) ?? 0) < since7.getTime()).length;
    const lowPrecisionStudents = perUser.filter((r) => r.avg < 60).length;
    const inactiveTeachers = teachers.filter(
      (t) => !t.lastLoginAt || new Date(t.lastLoginAt).getTime() < since14.getTime(),
    ).length;

    const attentionGroups: { id: string; name: string; reason: string }[] = [];
    for (const g of groups) {
      const rosterIds = studentsByGroup.get(g.id) ?? [];
      const hasTeacher = (teacherCountById.get(g.id) ?? 0) > 0;
      const anyActive = rosterIds.some((uid) => (lastById.get(uid) ?? 0) >= since7.getTime());
      const atRisk = rosterIds.filter((uid) => (accById.get(uid) ?? 100) < 60).length;
      if (!hasTeacher) attentionGroups.push({ id: g.id, name: g.name, reason: "Sin docente asignado" });
      else if (rosterIds.length && !anyActive)
        attentionGroups.push({ id: g.id, name: g.name, reason: "Sin actividad hace 7 días" });
      else if (atRisk >= 3)
        attentionGroups.push({ id: g.id, name: g.name, reason: `${atRisk} alumnos en riesgo` });
    }

    return reply.send({
      counts: { groups: groups.length, teachers: teachers.length, students: studentIds.length },
      activeToday,
      avgProgress,
      totalStars,
      weekly,
      alerts: {
        inactiveStudents,
        lowPrecisionStudents,
        inactiveTeachers,
        groupsNoTeacher: groups.filter((g) => (teacherCountById.get(g.id) ?? 0) === 0).length,
      },
      attentionGroups: attentionGroups.slice(0, 6),
      recent: recent.map((r) => ({
        studentName: studentNames.get(r.userId) ?? "Alumno",
        worldId: r.worldId,
        completed: r.completed,
        at: new Date(r.endedAt).toISOString(),
      })),
    });
  });

  /* ----- GET /api/students/:id — la ficha del alumno ----- */
  app.get("/api/students/:id", async (req, reply) => {
    const actor = requirePermission(req, "progress:read-scope");
    const { id } = req.params as { id: string };

    const [s] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!s || s.role !== "alumno") return reply.code(404).send({ error: "Alumno no encontrado." });

    if (actor.role === "docente") {
      if (!s.groupId) {
        return reply.code(403).send({ error: "Ese alumno no pertenece a ninguno de tus grupos." });
      }
      const [ok] = await db
        .select({ groupId: schema.groupTeachers.groupId })
        .from(schema.groupTeachers)
        .where(
          and(
            eq(schema.groupTeachers.groupId, s.groupId),
            eq(schema.groupTeachers.userId, actor.id),
          ),
        )
        .limit(1);
      if (!ok) return reply.code(403).send({ error: "Ese alumno no pertenece a ninguno de tus grupos." });
    } else if (!canActOnSede(actor, s.sedeId)) {
      return reply.code(403).send({ error: "Ese alumno es de otra sede." });
    }

    let groupName: string | null = null;
    if (s.groupId) {
      const [g] = await db
        .select({ name: schema.groups.name })
        .from(schema.groups)
        .where(eq(schema.groups.id, s.groupId))
        .limit(1);
      groupName = g?.name ?? null;
    }

    const [lp, att] = await Promise.all([
      db
        .select({
          worldId: schema.levelProgress.worldId,
          levelNumber: schema.levelProgress.levelNumber,
          completed: schema.levelProgress.completed,
          bestAccuracy: schema.levelProgress.bestAccuracy,
          attempts: schema.levelProgress.attempts,
        })
        .from(schema.levelProgress)
        .where(eq(schema.levelProgress.userId, id)),
      db
        .select({
          worldId: schema.attempts.worldId,
          levelNumber: schema.attempts.levelNumber,
          accuracy: schema.attempts.accuracy,
          completed: schema.attempts.completed,
          errorCount: schema.attempts.errorCount,
          startedAt: schema.attempts.startedAt,
          endedAt: schema.attempts.endedAt,
        })
        .from(schema.attempts)
        .where(eq(schema.attempts.userId, id))
        .orderBy(desc(schema.attempts.endedAt))
        .limit(200),
    ]);

    const wMap = new Map<string, { completed: number; accSum: number; n: number }>();
    let accSum = 0;
    let completedLevels = 0;
    let stars = 0;
    for (const r of lp) {
      const w = wMap.get(r.worldId) ?? { completed: 0, accSum: 0, n: 0 };
      if (r.completed) {
        w.completed++;
        completedLevels++;
        stars += r.bestAccuracy >= 90 ? 3 : r.bestAccuracy >= 75 ? 2 : 1;
      }
      w.accSum += r.bestAccuracy;
      w.n++;
      accSum += r.bestAccuracy;
      wMap.set(r.worldId, w);
    }
    const byWorld = [...wMap.entries()].map(([worldId, v]) => ({
      worldId,
      completed: v.completed,
      avgAccuracy: Math.round(v.accSum / v.n),
    }));
    const avgAccuracy = lp.length ? Math.round(accSum / lp.length) : 0;
    const currentWorld = byWorld.reduce((a, b) => Math.max(a, worldNum(b.worldId)), 0);
    const currentLevel = lp
      .filter((r) => worldNum(r.worldId) === currentWorld)
      .reduce((a, r) => Math.max(a, r.levelNumber), 0);

    /* Cada intento se topea en 10 minutos: un chico que deja la pestaña
       abierta durante el recreo no puede sumar dos horas de "práctica". */
    let totalSeconds = 0;
    const dayset = new Set<string>();
    for (const a of att) {
      const dur = Math.min(600, Math.max(0, (new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime()) / 1000));
      totalSeconds += dur;
      dayset.add(new Date(a.endedAt).toISOString().slice(0, 10));
    }
    let streakDays = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (!dayset.has(dayKey(d))) d.setDate(d.getDate() - 1); // hoy o ayer sirven de ancla
    while (dayset.has(dayKey(d))) {
      streakDays++;
      d.setDate(d.getDate() - 1);
    }

    const xp = completedLevels * 10 + (avgAccuracy >= 90 ? completedLevels * 2 : 0);

    return reply.send({
      student: {
        id: s.id,
        fullName: s.fullName,
        username: s.username,
        email: s.email,
        groupId: s.groupId,
        groupName,
        lastLoginAt: s.lastLoginAt,
      },
      stats: {
        completedLevels,
        avgAccuracy,
        currentWorld: currentWorld ? `island${currentWorld}` : null,
        currentLevel,
        totalSeconds: Math.round(totalSeconds),
        streakDays,
        totalAttempts: att.length,
        xp,
        stars,
      },
      byWorld,
      achievements: await getAchievements(id),
      timeline: att.slice(0, 20).map((a) => ({
        worldId: a.worldId,
        levelNumber: a.levelNumber,
        accuracy: a.accuracy,
        completed: a.completed,
        errorCount: a.errorCount,
        at: new Date(a.endedAt).toISOString(),
      })),
    });
  });

  /* ----- GET /api/teachers/:id — la ficha del docente ----- */
  app.get("/api/teachers/:id", async (req, reply) => {
    const actor = requirePermission(req, "user:read");
    if (actor.role === "docente") return reply.code(403).send({ error: "No autorizado." });
    const { id } = req.params as { id: string };

    const [t] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!t || t.role !== "docente") return reply.code(404).send({ error: "Docente no encontrado." });
    if (!canActOnSede(actor, t.sedeId)) {
      return reply.code(403).send({ error: "Ese docente es de otra sede." });
    }

    const groupRows = await db
      .select({
        id: schema.groups.id,
        name: schema.groups.name,
        grade: schema.groups.grade,
        studentCount: sql<number>`(
          SELECT count(*)::int FROM users u
          WHERE u.group_id = ${schema.groups.id} AND u.role = 'alumno' AND u.deleted_at IS NULL
        )`,
      })
      .from(schema.groupTeachers)
      .innerJoin(schema.groups, eq(schema.groups.id, schema.groupTeachers.groupId))
      .where(eq(schema.groupTeachers.userId, id))
      .orderBy(schema.groups.name);

    const groupIds = groupRows.map((g) => g.id);
    const students = groupIds.length
      ? await db
          .select({ id: schema.users.id, fullName: schema.users.fullName })
          .from(schema.users)
          .where(
            and(
              inArray(schema.users.groupId, groupIds),
              eq(schema.users.role, "alumno"),
              isNull(schema.users.deletedAt),
            ),
          )
      : [];
    const nameById = new Map(students.map((s) => [s.id, s.fullName]));

    const recent = students.length
      ? await db
          .select({
            userId: schema.attempts.userId,
            worldId: schema.attempts.worldId,
            completed: schema.attempts.completed,
            endedAt: schema.attempts.endedAt,
          })
          .from(schema.attempts)
          .where(inArray(schema.attempts.userId, students.map((s) => s.id)))
          .orderBy(desc(schema.attempts.endedAt))
          .limit(8)
      : [];

    return reply.send({
      teacher: {
        id: t.id,
        fullName: t.fullName,
        username: t.username,
        email: t.email,
        lastLoginAt: t.lastLoginAt,
      },
      groups: groupRows,
      stats: {
        groupCount: groupRows.length,
        studentCount: groupRows.reduce((a, g) => a + Number(g.studentCount), 0),
      },
      recent: recent.map((r) => ({
        studentName: nameById.get(r.userId) ?? "Alumno",
        worldId: r.worldId,
        completed: r.completed,
        at: new Date(r.endedAt).toISOString(),
      })),
    });
  });

  /* ----- GET /api/audit?sedeId=&limit= ----- */
  app.get("/api/audit", async (req, reply) => {
    const actor = requirePermission(req, "audit:read");
    const { sedeId, limit } = req.query as { sedeId?: string; limit?: string };

    const conditions = [];
    if (actor.role === "admin") {
      if (!actor.sedeId) return reply.send([]);
      conditions.push(eq(schema.auditLog.sedeId, actor.sedeId));
    } else if (sedeId) {
      conditions.push(eq(schema.auditLog.sedeId, sedeId));
    }

    const rows = await db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        entityType: schema.auditLog.entityType,
        entityId: schema.auditLog.entityId,
        meta: schema.auditLog.meta,
        at: schema.auditLog.at,
        actorId: schema.auditLog.actorId,
        actorName: schema.users.fullName,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.auditLog.at))
      .limit(Math.min(500, Math.max(10, Number(limit) || 100)));
    return reply.send(rows);
  });
}
