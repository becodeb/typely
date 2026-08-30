/* Registro de auditoría centralizado. Toda mutación privilegiada llama a
 * `audit()`, así el rastro es consistente y no depende de que alguien se
 * acuerde de loguear en el camino feliz.
 *
 * `meta` se guarda como texto JSON a propósito: barato, y evita migrar la
 * columna a jsonb para algo que solo se lee en un panel. */

import { db, schema } from "./db/index.js";
import type { Actor } from "./rbac.js";

export interface AuditInput {
  actor: Pick<Actor, "id" | "role" | "sedeId"> | null;
  /** Verbo en snake_case: "create_user", "delete_group", "import_users". */
  action: string;
  entityType: "user" | "group" | "sede";
  entityId?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      actorId: input.actor?.id ?? null,
      sedeId: input.actor?.sedeId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
  } catch {
    /* Nunca hacemos fallar al llamador por una escritura de auditoría. */
  }
}
