/* Usuarios — listar, crear, editar, borrar (lógico), restaurar y resetear
 * contraseñas.
 *
 * Qué cambió respecto de la versión anterior:
 *
 *  - Cuatro roles. `assertCanGrant` ahora sale de una matriz explícita, así
 *    que "un admin no puede crear otro admin" es una regla escrita y no un
 *    efecto colateral de comparar números.
 *  - El email es OPCIONAL. Un alumno de primaria se crea solo con nombre;
 *    el usuario y la contraseña temporal se los entrega el admin impresos.
 *  - `groupId` reemplaza a `classId`, y es la ÚNICA representación de la
 *    matrícula del alumno. Antes había que mantener `users.class_id` y la
 *    tabla `class_students` en sincronía a mano, y se desincronizaban.
 *  - Desactivar, borrar o resetear la contraseña ahora REVOCA los refresh
 *    tokens. Sin eso, la sesión seguía viva hasta 30 días: el usuario
 *    renovaba su token y la desactivación no tenía ningún efecto real.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { comparePassword, hashPassword, revokeAllRefreshTokens } from "../auth.js";
import { requireActor, requirePermission } from "../authContext.js";
import { assertCanGrant, canActOnSede, ForbiddenError, type Actor } from "../rbac.js";
import { assignUsername, makeTempPassword } from "../userIdentity.js";
import { audit } from "../audit.js";

const ROLES = ["superadmin", "admin", "docente", "alumno"] as const;

const createUserSchema = z.object({
  fullName: z.string().trim().min(1, "Falta el nombre."),
  role: z.enum(ROLES),
  /* Opcional a propósito: el alumno curricular no tiene email. */
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  username: z.string().trim().min(3).max(32).regex(/^[a-z0-9._-]+$/i, "El usuario solo admite letras, números, punto, guion y guion bajo.").optional(),
  /* Si viene, la cuenta queda con esa contraseña y sin cambio forzado.
     Si no, generamos una temporal y la devolvemos UNA vez. */
  password: z.string().min(6).optional(),
  sedeId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  username: z.string().trim().min(3).max(32).optional(),
  sedeId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional(),
});

/** Forma pública de un usuario. Nunca incluye el hash de la contraseña. */
const publicColumns = {
  id: schema.users.id,
  role: schema.users.role,
  sedeId: schema.users.sedeId,
  groupId: schema.users.groupId,
  username: schema.users.username,
  email: schema.users.email,
  fullName: schema.users.fullName,
  active: schema.users.active,
  mustChangePassword: schema.users.mustChangePassword,
  lastLoginAt: schema.users.lastLoginAt,
  deletedAt: schema.users.deletedAt,
  createdAt: schema.users.createdAt,
};

async function teacherGroupIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: schema.groupTeachers.groupId })
    .from(schema.groupTeachers)
    .where(eq(schema.groupTeachers.userId, userId));
  return rows.map((r) => r.groupId);
}

/** Carga el usuario objetivo y verifica que el actor pueda tocarlo.
 *  Responde 404/403 y devuelve null cuando no corresponde. */
async function loadTarget(actor: Actor, id: string, reply: FastifyReply) {
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!target) {
    reply.code(404).send({ error: "Usuario no encontrado." });
    return null;
  }
  /* El superadmin solo se toca a sí mismo o lo toca otro superadmin. */
  if (target.role === "superadmin" && actor.role !== "superadmin") {
    reply.code(403).send({ error: "No podés modificar una cuenta de superadmin." });
    return null;
  }
  if (!canActOnSede(actor, target.sedeId)) {
    reply.code(403).send({ error: "Ese usuario pertenece a otra sede." });
    return null;
  }
  return target;
}

/** Un docente solo puede tocar alumnos de SUS grupos. */
async function assertTeacherOwnsStudent(actor: Actor, target: schema.DbUser): Promise<void> {
  if (actor.role !== "docente") return;
  if (target.role !== "alumno" || !target.groupId) {
    throw new ForbiddenError("Solo podés gestionar alumnos de tus grupos.");
  }
  const ids = await teacherGroupIds(actor.id);
  if (!ids.includes(target.groupId)) {
    throw new ForbiddenError("Ese alumno no pertenece a ninguno de tus grupos.");
  }
}

export async function userRoutes(app: FastifyInstance) {
  /* ----- GET /api/users?role=&sedeId=&groupId=&includeDeleted= ----- */
  app.get("/api/users", async (req, reply) => {
    const actor = requirePermission(req, "user:read");
    const { role, sedeId, groupId, includeDeleted } = req.query as {
      role?: string; sedeId?: string; groupId?: string; includeDeleted?: string;
    };

    const conditions = [];
    if (actor.role === "admin") {
      if (!actor.sedeId) return reply.send([]);
      conditions.push(eq(schema.users.sedeId, actor.sedeId));
    } else if (actor.role === "docente") {
      /* Un docente ve los alumnos de sus grupos y nada más. Nunca la lista
         completa de la sede ni los emails del resto del staff. */
      const ids = await teacherGroupIds(actor.id);
      if (!ids.length) return reply.send([]);
      conditions.push(inArray(schema.users.groupId, ids));
      conditions.push(eq(schema.users.role, "alumno"));
    } else if (sedeId) {
      conditions.push(eq(schema.users.sedeId, sedeId));
    }

    if (role && (ROLES as readonly string[]).includes(role)) {
      conditions.push(eq(schema.users.role, role as schema.Role));
    }
    if (groupId) conditions.push(eq(schema.users.groupId, groupId));
    /* Las cuentas borradas se ocultan salvo pedido explícito del superadmin. */
    if (!includeDeleted || actor.role !== "superadmin") {
      conditions.push(isNull(schema.users.deletedAt));
    }

    const rows = await db
      .select(publicColumns)
      .from(schema.users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(schema.users.fullName);
    return reply.send(rows);
  });

  /* ----- POST /api/users ----- */
  app.post("/api/users", async (req, reply) => {
    const actor = requirePermission(req, "user:create");
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    }
    const data = parsed.data;

    assertCanGrant(actor.role, data.role);

    /* Un admin siempre crea dentro de SU sede: si manda otra, se ignora.
       El superadmin tiene que indicarla, salvo que cree otro superadmin. */
    const targetSede =
      data.role === "superadmin" ? null : actor.role === "admin" ? actor.sedeId : (data.sedeId ?? null);
    if (data.role !== "superadmin" && !targetSede) {
      return reply.code(400).send({ error: "Falta indicar la sede." });
    }
    if (!canActOnSede(actor, targetSede)) {
      throw new ForbiddenError("No podés crear usuarios en otra sede.");
    }

    /* Solo un alumno puede pertenecer a un grupo, y el grupo tiene que ser
       de la misma sede (la base lo exige con un CHECK; acá damos el error
       claro en vez de un 500). */
    let groupId: string | null = null;
    if (data.groupId) {
      if (data.role !== "alumno") {
        return reply.code(400).send({ error: "Solo un alumno puede pertenecer a un grupo." });
      }
      const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, data.groupId)).limit(1);
      if (!group) return reply.code(400).send({ error: "El grupo no existe." });
      if (group.sedeId !== targetSede) {
        return reply.code(400).send({ error: "Ese grupo es de otra sede." });
      }
      groupId = group.id;
    }

    const chosePassword = Boolean(data.password);
    const password = data.password ?? makeTempPassword();
    const username = data.username ?? (await assignUsername(data.fullName));

    let row;
    try {
      [row] = await db
        .insert(schema.users)
        .values({
          role: data.role,
          sedeId: targetSede,
          groupId,
          username,
          email: data.email ?? null,
          fullName: data.fullName,
          passwordHash: await hashPassword(password),
          mustChangePassword: !chosePassword,
        })
        .returning(publicColumns);
    } catch (err) {
      if (String((err as { code?: string }).code) === "23505") {
        return reply.code(409).send({ error: "Ya existe una cuenta con ese usuario o email." });
      }
      throw err;
    }

    await audit({
      actor,
      action: "create_user",
      entityType: "user",
      entityId: row!.id,
      meta: { role: data.role, username, sedeId: targetSede, groupId },
    });

    return reply.code(201).send({
      user: row,
      /* La contraseña solo se devuelve si la generamos nosotros, y una vez.
         Una elegida por el admin no se hace eco. */
      temporaryPassword: chosePassword ? null : password,
    });
  });

  /* ----- PATCH /api/users/:id ----- */
  app.patch("/api/users/:id", async (req, reply) => {
    const actor = requirePermission(req, "user:update");
    const { id } = req.params as { id: string };
    const target = await loadTarget(actor, id, reply);
    if (!target) return;

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const data = parsed.data;

    /* Mover a otra sede exige alcance sobre el DESTINO, no solo el origen. */
    if (data.sedeId !== undefined && !canActOnSede(actor, data.sedeId ?? null)) {
      throw new ForbiddenError("No podés mover usuarios a otra sede.");
    }
    if (data.groupId) {
      if (target.role !== "alumno") {
        return reply.code(400).send({ error: "Solo un alumno puede pertenecer a un grupo." });
      }
      const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, data.groupId)).limit(1);
      if (!group) return reply.code(400).send({ error: "El grupo no existe." });
      if (!canActOnSede(actor, group.sedeId)) {
        throw new ForbiddenError("Ese grupo es de otra sede.");
      }
    }

    let row;
    try {
      [row] = await db
        .update(schema.users)
        .set({
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.username !== undefined ? { username: data.username } : {}),
          ...(data.sedeId !== undefined ? { sedeId: data.sedeId } : {}),
          ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        })
        .where(eq(schema.users.id, id))
        .returning(publicColumns);
    } catch (err) {
      if (String((err as { code?: string }).code) === "23505") {
        return reply.code(409).send({ error: "Ya existe una cuenta con ese usuario o email." });
      }
      throw err;
    }

    /* Desactivar tiene que cortar la sesión ya. Sin revocar los refresh
       tokens, la persona seguiría renovando su acceso durante 30 días. */
    if (data.active === false) await revokeAllRefreshTokens(id);

    await audit({ actor, action: "update_user", entityType: "user", entityId: id, meta: data });
    return reply.send(row);
  });

  /* ----- DELETE /api/users/:id — borrado lógico -----
     Conserva progreso, intentos y auditoría. La cuenta deja de poder
     entrar y desaparece de los listados. */
  app.delete("/api/users/:id", async (req, reply) => {
    const actor = requirePermission(req, "user:delete");
    const { id } = req.params as { id: string };
    if (id === actor.id) {
      return reply.code(400).send({ error: "No podés borrar tu propia cuenta." });
    }
    const target = await loadTarget(actor, id, reply);
    if (!target) return;
    if (target.role === "superadmin") {
      return reply.code(403).send({ error: "El superadmin no se puede eliminar." });
    }
    assertCanGrant(actor.role, target.role);

    await db
      .update(schema.users)
      .set({ deletedAt: new Date(), active: false })
      .where(eq(schema.users.id, id));
    await revokeAllRefreshTokens(id);

    await audit({
      actor, action: "delete_user", entityType: "user", entityId: id,
      meta: { username: target.username, role: target.role },
    });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/users/:id/restore ----- */
  app.post("/api/users/:id/restore", async (req, reply) => {
    const actor = requirePermission(req, "user:delete");
    const { id } = req.params as { id: string };
    const target = await loadTarget(actor, id, reply);
    if (!target) return;
    assertCanGrant(actor.role, target.role);

    await db
      .update(schema.users)
      .set({ deletedAt: null, active: true })
      .where(eq(schema.users.id, id));
    await audit({
      actor, action: "restore_user", entityType: "user", entityId: id,
      meta: { username: target.username, role: target.role },
    });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/users/:id/reset-password -----
     Genera una temporal y la devuelve UNA vez. La contraseña anterior no
     se lee, ni se devuelve, ni se muestra nunca. */
  app.post("/api/users/:id/reset-password", async (req, reply) => {
    const actor = requirePermission(req, "user:reset-password");
    const { id } = req.params as { id: string };
    const target = await loadTarget(actor, id, reply);
    if (!target) return;

    if (actor.role === "docente") {
      /* El docente resuelve el "me olvidé la contraseña" de su propio
         curso, sin depender del admin — pero solo el de sus alumnos. */
      await assertTeacherOwnsStudent(actor, target);
    } else {
      assertCanGrant(actor.role, target.role);
    }

    const temporaryPassword = makeTempPassword();
    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true })
      .where(eq(schema.users.id, id));
    await revokeAllRefreshTokens(id);

    await audit({
      actor, action: "reset_password", entityType: "user", entityId: id,
      meta: { username: target.username, role: target.role },
    });
    return reply.send({ temporaryPassword });
  });

  /* ----- POST /api/auth/change-password — la propia -----
     Pide la contraseña actual. El endpoint anterior no lo hacía: con un
     access token robado alcanzaba para quedarse con la cuenta sin conocer
     la contraseña. La excepción es quien solo entra con Google y por lo
     tanto nunca tuvo una. */
  app.post("/api/auth/change-password", async (req, reply) => {
    const actor = requireActor(req);
    const parsed = z
      .object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(6, "La contraseña nueva debe tener al menos 6 caracteres."),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    }

    const [me] = await db.select().from(schema.users).where(eq(schema.users.id, actor.id)).limit(1);
    if (!me) return reply.code(401).send({ error: "Sesión inválida." });

    /* Se pide la contraseña actual, con dos excepciones:
       - quien solo entra con Google nunca tuvo una;
       - quien está en el cambio OBLIGATORIO acaba de autenticarse con la
         temporal hace segundos. Pedírsela de nuevo es fricción pura, y el
         público de esta pantalla son chicos de primaria copiando una clave
         de una tarjeta impresa. */
    const mustVerify = Boolean(me.passwordHash) && !me.mustChangePassword;
    if (mustVerify) {
      const ok =
        parsed.data.currentPassword &&
        (await comparePassword(parsed.data.currentPassword, me.passwordHash!));
      if (!ok) return reply.code(401).send({ error: "La contraseña actual no coincide." });
    }

    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false })
      .where(eq(schema.users.id, actor.id));

    await audit({ actor, action: "change_own_password", entityType: "user", entityId: actor.id });
    return reply.send({ ok: true });
  });

  /* ----- GET /api/users/:id/credentials-sheet -----
     Lo que el admin imprime y reparte: nombre y usuario de cada alumno de
     un grupo. NUNCA contraseñas — solo se ven en el momento de crearlas o
     resetearlas. */
  app.get("/api/groups/:id/credentials-sheet", async (req, reply) => {
    const actor = requirePermission(req, "user:read");
    const { id } = req.params as { id: string };
    const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, id)).limit(1);
    if (!group) return reply.code(404).send({ error: "Grupo no encontrado." });
    if (!canActOnSede(actor, group.sedeId)) {
      throw new ForbiddenError("Ese grupo pertenece a otra sede.");
    }
    const rows = await db
      .select({
        fullName: schema.users.fullName,
        username: schema.users.username,
        mustChangePassword: schema.users.mustChangePassword,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.groupId, id),
          eq(schema.users.role, "alumno"),
          isNull(schema.users.deletedAt),
        ),
      )
      .orderBy(schema.users.fullName);
    return reply.send({ group: { id: group.id, name: group.name }, students: rows });
  });
}
