/* Modo Órbita (arcade) — partidas, ranking, alias, cristales y hangar.
 *
 * Decisiones que dan forma a este archivo (especificación §7 y §9):
 *
 *  - EL SERVIDOR ES ESCÉPTICO. Un ranking global de primaria invita a la
 *    consola del navegador. Cada partida llega con su telemetría completa
 *    y `validarCoherencia` la revisa: un puntaje que implique 300 PPM
 *    sostenidos se guarda como partida (es dato) pero con `ranked=false` —
 *    no compite ni acuña cristales. Nunca se rechaza con error: al tramposo
 *    no se le enseña qué chequeo lo atrapó.
 *
 *  - LOS CRISTALES LOS ACUÑA EL SERVIDOR. El cliente informa lo que mostró
 *    (palabras TIPEADAS + bono de rango) y acá se recomputa el tope
 *    teórico; se acredita el menor de los dos. El HUD nunca puede prometer
 *    más de lo que el servidor va a pagar… salvo trampa, y en ese caso paga
 *    cero. Desde las mejoras permanentes (migración 0004) una partida trae
 *    además su nivel y su build: la bala extra y el golpe crítico destruyen
 *    palabras que nadie tipeó, y sin saberlo el escéptico las marcaría como
 *    imposibles.
 *
 *  - ALIAS, NUNCA NOMBRE REAL, hacia afuera. El top global cruza escuelas y
 *    son menores. El nombre real solo aparece para un actor cuyo alcance ya
 *    incluye a ese alumno (su docente, su admin, la plataforma) — la misma
 *    lógica de alcance del resto de la API.
 *
 *  - SEMANA ISO como temporada. `week_key` se calcula con el huso de
 *    Argentina (UTC-3 fijo, sin DST): el lunes del ranking es el lunes del
 *    aula, no el de Greenwich.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema, sql as pg } from "../db/index.js";
import { and, eq, sql } from "drizzle-orm";
import { requireActor, requireRole } from "../authContext.js";
import { audit } from "../audit.js";

const GAME_IDS = ["tormenta"] as const;

/* ------------------------------------------------------------------ */
/* Rangos y cristales — ESPEJO de src/utils/orbita/motor.ts.           */
/* Si el motor cambia estos números, cambiarlos acá en el mismo commit. */
/* ------------------------------------------------------------------ */
const BONO_RANGO: Record<string, number> = {
  cadete: 4,
  piloto: 8,
  explorador: 14,
  as: 22,
  capitan: 32,
  leyenda: 45,
};
const RANGOS_VALIDOS = Object.keys(BONO_RANGO);

/* Las trece mejoras — ESPEJO de `MejoraId` en src/utils/orbita/motor.ts. */
const MEJORAS_IDS = [
  "bala", "segunda", "vida", "regeneracion", "escudo", "critico",
  "viento", "foco", "onda", "congelar", "iman", "racha", "teclas",
] as const;

/* Catálogo del hangar — ESPEJO de src/data/orbitaCosmeticos.ts. El precio
   que vale es ESTE: el cliente muestra el suyo, el servidor cobra el suyo. */
const CATALOGO: Record<string, { tipo: "estela" | "rayo"; precio: number }> = {
  "estela-menta": { tipo: "estela", precio: 120 },
  "estela-violeta": { tipo: "estela", precio: 180 },
  "estela-rosa": { tipo: "estela", precio: 260 },
  "estela-dorada": { tipo: "estela", precio: 400 },
  "rayo-violeta": { tipo: "rayo", precio: 100 },
  "rayo-rosa": { tipo: "rayo", precio: 200 },
  "rayo-dorado": { tipo: "rayo", precio: 350 },
};

/* ------------------------------------------------------------------ */
/* Semana ISO con huso argentino (UTC-3 fijo, sin DST)                 */
/* ------------------------------------------------------------------ */
const HUSO_AR_MS = -3 * 3_600_000;

export function claveSemana(fecha: Date): string {
  const local = new Date(fecha.getTime() + HUSO_AR_MS);
  /* Algoritmo ISO-8601: la semana pertenece al año de su jueves. */
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const dia = d.getUTCDay() || 7; // lunes=1 … domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const enero1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - enero1.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Alias — límites y filtro                                            */
/* ------------------------------------------------------------------ */
const ALIAS_DIAS_ESPERA = 7;
const ALIAS_REGEX = /^[a-záéíóúüñ0-9 ]{3,16}$/i;
/* Corto a propósito: atrapa lo obvio. El docente ve alias→nombre y puede
   pedir el cambio de lo que se le escape a una lista. */
const ALIAS_PROHIBIDAS = [
  "puto", "puta", "mierda", "pija", "concha", "boludo", "pelotudo", "forro",
  "culo", "verga", "pene", "teta", "sexo", "nazi", "hitler", "idiota",
];

function aliasInvalido(alias: string, username: string, fullName: string): string | null {
  const limpio = alias.trim().replace(/\s+/g, " ");
  if (!ALIAS_REGEX.test(limpio)) {
    return "El alias lleva de 3 a 16 caracteres: letras, números y espacios.";
  }
  const bajo = limpio.toLowerCase();
  if (ALIAS_PROHIBIDAS.some((p) => bajo.includes(p))) {
    return "Ese alias no está permitido. Elegí otro.";
  }
  /* Un alias existe para NO exponer al menor: no puede ser su usuario ni
     cargar partes reconocibles de su nombre real. */
  if (bajo.includes(username.toLowerCase())) {
    return "El alias no puede ser tu nombre de usuario.";
  }
  for (const parte of fullName.toLowerCase().split(/\s+/)) {
    if (parte.length >= 4 && bajo.includes(parte)) {
      return "El alias no puede llevar tu nombre real: es tu nombre de piloto.";
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Coherencia de una partida                                           */
/* ------------------------------------------------------------------ */
const runItemSchema = z.object({
  gameId: z.enum(GAME_IDS),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().min(0),
  score: z.number().int().min(0),
  peakThreat: z.number().int().min(0).max(100),
  rankId: z.string(),
  wpmAvg: z.number().int().min(0),
  wpmPeak: z.number().int().min(0),
  accuracy: z.number().int().min(0).max(100),
  wordsDestroyed: z.number().int().min(0),
  charsTyped: z.number().int().min(0),
  errors: z.number().int().min(0),
  crystalsClaimed: z.number().int().min(0),
  /* Mejoras permanentes por nivel (2026-09-05, migración 0004). Las tres
     son OPCIONALES a propósito: una cola guardada en el navegador antes de
     este deploy llega sin ellas y tiene que seguir entrando. */
  wordsTyped: z.number().int().min(0).optional(),
  level: z.number().int().min(0).max(40).default(0),
  upgrades: z
    .array(z.object({ id: z.enum(MEJORAS_IDS), level: z.number().int().min(1).max(9) }))
    .max(40)
    .default([]),
});
type RunItem = z.infer<typeof runItemSchema>;

function nivelDe(it: RunItem, id: (typeof MEJORAS_IDS)[number]): number {
  return it.upgrades.find((u) => u.id === id)?.level ?? 0;
}

const runSchema = z.union([
  runItemSchema.transform((item) => ({ items: [item] })),
  z.object({ items: z.array(runItemSchema).min(1).max(5) }),
]);

/** ¿La telemetría cierra? Los topes son holgados a propósito: acá no se
 *  arbitra el récord mundial, se filtra al que abrió la consola. */
function validarCoherencia(it: RunItem): boolean {
  if (!RANGOS_VALIDOS.includes(it.rankId)) return false;
  /* El motor corta a los 225 s (el techo del híbrido de mejoras); 240 deja
     aire para el redondeo del cliente. */
  if (it.durationMs < 15_000 || it.durationMs > 240_000) return false;
  if (it.wpmPeak > 250 || it.wpmAvg > 200) return false;
  const segundos = it.durationMs / 1000;
  if (it.charsTyped > segundos * 25) return false; // 25 pulsaciones/s sostenidas: no
  /* Lo TIPEADO necesita teclas; lo destruido incluye lo tipeado. */
  const tipeadas = it.wordsTyped ?? it.wordsDestroyed;
  if (tipeadas > it.charsTyped) return false;
  if (tipeadas > it.wordsDestroyed) return false;
  /* Lo que cayó sin tipearse solo puede venir de la bala extra (cada
     palabra tipeada arrastra hasta tantas como balas extra tenga) o del
     golpe crítico (una más). Sin esas mejoras, destruido == tipeado. */
  const arrastre = nivelDe(it, "bala") + (nivelDe(it, "critico") > 0 ? 1 : 0);
  if (it.wordsDestroyed > tipeadas * (1 + arrastre)) return false;
  /* Cada nivel es una carta elegida: el nivel no puede superar la suma de
     los niveles de la build (más uno, si la partida terminó con las cartas
     todavía en pantalla). */
  const nivelesBuild = it.upgrades.reduce((a, u) => a + u.level, 0);
  if (it.level > nivelesBuild + 1) return false;
  /* Tope teórico de puntos por palabra: la más larga (22), banda 10, amenaza
     100, racha máxima y Teclas difíciles ×2,5 — 7.644, redondeado con aire. */
  if (it.score > it.wordsDestroyed * 8000 + 100) return false;
  return true;
}

function cristalesMaximos(it: RunItem): number {
  const bono = BONO_RANGO[it.rankId] ?? 0;
  /* Formato anterior a las mejoras (sin wordsTyped): palabras + extra de
     cosecha, como pagaba entonces. Con mejoras, solo lo tipeado + el bono. */
  if (it.wordsTyped === undefined) return it.wordsDestroyed * 2 + bono;
  return it.wordsTyped + bono;
}

/* ------------------------------------------------------------------ */
/* Perfil                                                              */
/* ------------------------------------------------------------------ */
async function asegurarPerfil(userId: string) {
  await db.insert(schema.arcadeProfile).values({ userId }).onConflictDoNothing();
  const [perfil] = await db
    .select()
    .from(schema.arcadeProfile)
    .where(eq(schema.arcadeProfile.userId, userId))
    .limit(1);
  return perfil!;
}

function perfilPublico(p: typeof schema.arcadeProfile.$inferSelect) {
  let owned: string[] = [];
  try {
    const parsed = JSON.parse(p.ownedCosmetics);
    if (Array.isArray(parsed)) owned = parsed.filter((x) => typeof x === "string");
  } catch {
    /* JSON roto → como si no tuviera nada; comprar lo regenera. */
  }
  return {
    alias: p.alias,
    crystals: p.crystalsBalance,
    bestScore: p.bestScore,
    bestThreat: p.bestThreat,
    bestRank: p.bestRank,
    owned,
    equipped: { trail: p.equippedTrail, beam: p.equippedBeam },
  };
}

/* ------------------------------------------------------------------ */
/* Posiciones en el ranking                                            */
/* ------------------------------------------------------------------ */
interface FiltroAlcance {
  sedeId?: string | null;
  grade?: string | null;
}

/** Mi mejor puntaje y mi puesto en un alcance dado. El puesto es 1 + la
 *  cantidad de usuarios con un mejor puntaje mayor al mío. */
async function posicionEn(
  userId: string,
  gameId: string,
  weekKey: string | null,
  filtro: FiltroAlcance,
): Promise<{ pos: number; score: number } | null> {
  const filas = await pg<{ score: number; pos: number }[]>`
    WITH mejores AS (
      SELECT DISTINCT ON (r.user_id) r.user_id, r.score
      FROM arcade_runs r
      JOIN users u ON u.id = r.user_id
      WHERE r.ranked
        AND r.game_id = ${gameId}
        AND u.deleted_at IS NULL
        ${weekKey ? pg`AND r.week_key = ${weekKey}` : pg``}
        ${filtro.sedeId ? pg`AND u.sede_id = ${filtro.sedeId}` : pg``}
        ${filtro.grade ? pg`AND u.group_id IN (SELECT id FROM groups WHERE grade = ${filtro.grade})` : pg``}
      ORDER BY r.user_id, r.score DESC
    )
    SELECT m.score,
           1 + (SELECT count(*) FROM mejores x WHERE x.score > m.score)::int AS pos
    FROM mejores m
    WHERE m.user_id = ${userId}`;
  const fila = filas[0];
  if (!fila) return null;
  return { pos: Number(fila.pos), score: Number(fila.score) };
}

/* ==================================================================== */

export async function arcadeRoutes(app: FastifyInstance) {
  /* ----- POST /api/arcade/run -----
     Acepta lote, como /progress/complete: el cliente encola y reintenta si
     el wifi del aula se cae. Reenviar es seguro: cada fila es una partida
     nueva y los récords/saldos se recomputan de forma acumulativa. */
  app.post("/api/arcade/run", async (req, reply) => {
    const actor = requireRole(req, "alumno");
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    const perfil = await asegurarPerfil(actor.id);
    let cristalesGanados = 0;
    let mejorPuntaje = perfil.bestScore;
    let mejorAmenaza = perfil.bestThreat;
    let mejorRango = perfil.bestRank;
    let algunaRankeada = false;

    for (const it of parsed.data.items) {
      const ok = validarCoherencia(it);
      const cristales = ok ? Math.min(it.crystalsClaimed, cristalesMaximos(it)) : 0;
      await db.insert(schema.arcadeRuns).values({
        userId: actor.id,
        gameId: it.gameId,
        startedAt: new Date(it.startedAt),
        endedAt: new Date(it.endedAt),
        durationMs: it.durationMs,
        score: it.score,
        peakThreat: it.peakThreat,
        rankId: it.rankId,
        wpmAvg: it.wpmAvg,
        wpmPeak: it.wpmPeak,
        accuracy: it.accuracy,
        wordsDestroyed: it.wordsDestroyed,
        charsTyped: it.charsTyped,
        errors: it.errors,
        crystalsEarned: cristales,
        weekKey: claveSemana(new Date(it.endedAt)),
        ranked: ok,
        wordsTyped: it.wordsTyped ?? it.wordsDestroyed,
        level: it.level,
        upgrades: JSON.stringify(it.upgrades),
      });
      if (ok) {
        algunaRankeada = true;
        cristalesGanados += cristales;
        if (it.score > mejorPuntaje) {
          mejorPuntaje = it.score;
          mejorAmenaza = it.peakThreat;
          mejorRango = it.rankId;
        }
      }
    }

    await db
      .update(schema.arcadeProfile)
      .set({
        crystalsBalance: sql`${schema.arcadeProfile.crystalsBalance} + ${cristalesGanados}`,
        bestScore: mejorPuntaje,
        bestThreat: mejorAmenaza,
        bestRank: mejorRango,
        updatedAt: new Date(),
      })
      .where(eq(schema.arcadeProfile.userId, actor.id));

    /* Posiciones para la pantalla de resultado — solo si compitió. */
    const gameId = parsed.data.items[0]?.gameId ?? "tormenta";
    const semana = claveSemana(new Date());
    const [alumno] = await db
      .select({ sedeId: schema.users.sedeId, groupId: schema.users.groupId })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id))
      .limit(1);
    let grade: string | null = null;
    if (alumno?.groupId) {
      const [g] = await db
        .select({ grade: schema.groups.grade })
        .from(schema.groups)
        .where(eq(schema.groups.id, alumno.groupId))
        .limit(1);
      grade = g?.grade ?? null;
    }

    const posiciones = algunaRankeada
      ? {
          global: await posicionEn(actor.id, gameId, semana, {}),
          sede: alumno?.sedeId
            ? await posicionEn(actor.id, gameId, semana, { sedeId: alumno.sedeId })
            : null,
          grado: grade ? await posicionEn(actor.id, gameId, semana, { grade }) : null,
        }
      : null;

    const [actualizado] = await db
      .select()
      .from(schema.arcadeProfile)
      .where(eq(schema.arcadeProfile.userId, actor.id))
      .limit(1);

    return reply.send({
      ok: true,
      saved: parsed.data.items.length,
      ranked: algunaRankeada,
      crystalsEarned: cristalesGanados,
      balance: actualizado?.crystalsBalance ?? 0,
      positions: posiciones,
    });
  });

  /* ----- GET /api/arcade/me — perfil + mi semana ----- */
  app.get("/api/arcade/me", async (req, reply) => {
    const actor = requireRole(req, "alumno");
    const perfil = await asegurarPerfil(actor.id);
    const semana = claveSemana(new Date());
    const semanal = await posicionEn(actor.id, "tormenta", semana, {});
    return reply.send({
      profile: perfilPublico(perfil),
      week: { key: semana, best: semanal?.score ?? null, pos: semanal?.pos ?? null },
    });
  });

  /* ----- GET /api/arcade/leaderboard?game=&scope=&period= -----
     scope: global | sede | grade · period: week | all.
     Cualquier rol autenticado lo lee (el docente también mira el ranking);
     el nombre real solo viaja para filas dentro del ALCANCE del actor. */
  app.get("/api/arcade/leaderboard", async (req, reply) => {
    const actor = requireActor(req);
    const q = req.query as { game?: string; scope?: string; period?: string };
    const gameId = GAME_IDS.includes(q.game as (typeof GAME_IDS)[number]) ? q.game! : "tormenta";
    const scope = ["global", "sede", "grade"].includes(q.scope ?? "") ? q.scope! : "global";
    const period = q.period === "all" ? "all" : "week";
    const semana = period === "week" ? claveSemana(new Date()) : null;

    /* Resolver el filtro del alcance pedido, relativo al ACTOR. */
    const filtro: FiltroAlcance = {};
    let grade: string | null = null;
    const [yo] = await db
      .select({ sedeId: schema.users.sedeId, groupId: schema.users.groupId })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id))
      .limit(1);
    if (scope === "sede") {
      if (!yo?.sedeId) return reply.send({ rows: [], me: null });
      filtro.sedeId = yo.sedeId;
    }
    if (scope === "grade") {
      if (yo?.groupId) {
        const [g] = await db
          .select({ grade: schema.groups.grade })
          .from(schema.groups)
          .where(eq(schema.groups.id, yo.groupId))
          .limit(1);
        grade = g?.grade ?? null;
      }
      if (!grade) return reply.send({ rows: [], me: null });
      filtro.grade = grade;
    }

    const filas = await pg<
      {
        user_id: string;
        score: number;
        rank_id: string;
        wpm_peak: number;
        alias: string | null;
        sede_id: string | null;
        full_name: string;
      }[]
    >`
      SELECT DISTINCT ON (r.user_id)
             r.user_id, r.score, r.rank_id, r.wpm_peak,
             p.alias, u.sede_id, u.full_name
      FROM arcade_runs r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN arcade_profile p ON p.user_id = r.user_id
      WHERE r.ranked
        AND r.game_id = ${gameId}
        AND u.deleted_at IS NULL
        ${semana ? pg`AND r.week_key = ${semana}` : pg``}
        ${filtro.sedeId ? pg`AND u.sede_id = ${filtro.sedeId}` : pg``}
        ${filtro.grade ? pg`AND u.group_id IN (SELECT id FROM groups WHERE grade = ${filtro.grade})` : pg``}
      ORDER BY r.user_id, r.score DESC`;

    filas.sort((a, b) => b.score - a.score);
    const top = filas.slice(0, 25);

    /* ¿Este actor puede ver el nombre real de esta fila? Su propio alcance
       ya se lo muestra en el panel; acá solo se replica esa frontera. */
    const veNombre = (sedeId: string | null) => {
      if (actor.role === "superadmin") return true;
      if (actor.role === "admin" || actor.role === "docente") {
        return !!actor.sedeId && actor.sedeId === sedeId;
      }
      return false;
    };

    const rows = top.map((f, i) => ({
      pos: i + 1,
      alias: f.alias ?? "Piloto sin nombre",
      realName: veNombre(f.sede_id) ? f.full_name : null,
      score: Number(f.score),
      rankId: f.rank_id,
      wpmPeak: Number(f.wpm_peak),
      mine: f.user_id === actor.id,
    }));

    const miFila = filas.findIndex((f) => f.user_id === actor.id);
    const me =
      miFila >= 0 ? { pos: miFila + 1, score: Number(filas[miFila]!.score) } : null;

    return reply.send({ rows, me, week: semana });
  });

  /* ----- POST /api/arcade/alias ----- */
  app.post("/api/arcade/alias", async (req, reply) => {
    const actor = requireRole(req, "alumno");
    const parsed = z.object({ alias: z.string() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    const alias = parsed.data.alias.trim().replace(/\s+/g, " ");
    const [yo] = await db
      .select({ fullName: schema.users.fullName, username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id))
      .limit(1);
    const problema = aliasInvalido(alias, yo?.username ?? actor.username, yo?.fullName ?? "");
    if (problema) return reply.code(400).send({ error: problema });

    const perfil = await asegurarPerfil(actor.id);
    /* Cambiable una vez por semana — si no, el ranking se vuelve ilegible
       de un lunes al otro. El primer alias es gratis. */
    if (perfil.alias && perfil.aliasChangedAt) {
      const dias = (Date.now() - perfil.aliasChangedAt.getTime()) / 86_400_000;
      if (dias < ALIAS_DIAS_ESPERA) {
        const faltan = Math.ceil(ALIAS_DIAS_ESPERA - dias);
        return reply.code(429).send({
          error: `El alias se cambia una vez por semana. Podés volver a cambiarlo en ${faltan} día${faltan === 1 ? "" : "s"}.`,
        });
      }
    }

    await db
      .update(schema.arcadeProfile)
      .set({ alias, aliasChangedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.arcadeProfile.userId, actor.id));
    await audit({ actor, action: "arcade_alias", entityType: "user", entityId: actor.id, meta: { alias } });
    return reply.send({ ok: true, alias });
  });

  /* ----- POST /api/arcade/buy { id } ----- */
  app.post("/api/arcade/buy", async (req, reply) => {
    const actor = requireRole(req, "alumno");
    const parsed = z.object({ id: z.string() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    const item = CATALOGO[parsed.data.id];
    if (!item) return reply.code(404).send({ error: "Ese artículo no existe." });

    const perfil = await asegurarPerfil(actor.id);
    const publico = perfilPublico(perfil);
    if (publico.owned.includes(parsed.data.id)) {
      return reply.code(409).send({ error: "Ya lo tenés." });
    }
    if (perfil.crystalsBalance < item.precio) {
      return reply.code(409).send({ error: "No te alcanzan los cristales todavía." });
    }

    /* Descuento condicionado al saldo EN la misma sentencia: dos compras
       simultáneas no pueden gastar el mismo cristal dos veces. */
    const owned = JSON.stringify([...publico.owned, parsed.data.id]);
    const actualizadas = await db
      .update(schema.arcadeProfile)
      .set({
        crystalsBalance: sql`${schema.arcadeProfile.crystalsBalance} - ${item.precio}`,
        ownedCosmetics: owned,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.arcadeProfile.userId, actor.id),
          sql`${schema.arcadeProfile.crystalsBalance} >= ${item.precio}`,
        ),
      )
      .returning({ balance: schema.arcadeProfile.crystalsBalance });
    const actualizada = actualizadas[0];
    if (!actualizada) {
      return reply.code(409).send({ error: "No te alcanzan los cristales todavía." });
    }

    await audit({ actor, action: "arcade_buy", entityType: "user", entityId: actor.id, meta: { id: parsed.data.id, precio: item.precio } });
    return reply.send({ ok: true, balance: actualizada.balance });
  });

  /* ----- POST /api/arcade/equip { slot, id|null } ----- */
  app.post("/api/arcade/equip", async (req, reply) => {
    const actor = requireRole(req, "alumno");
    const parsed = z
      .object({ slot: z.enum(["trail", "beam"]), id: z.string().nullable() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });

    const perfil = await asegurarPerfil(actor.id);
    const publico = perfilPublico(perfil);
    const { slot, id } = parsed.data;
    if (id !== null) {
      const item = CATALOGO[id];
      const tipoEsperado = slot === "trail" ? "estela" : "rayo";
      if (!item || item.tipo !== tipoEsperado) {
        return reply.code(400).send({ error: "Ese artículo no va en ese lugar." });
      }
      if (!publico.owned.includes(id)) {
        return reply.code(409).send({ error: "Primero hay que comprarlo." });
      }
    }

    await db
      .update(schema.arcadeProfile)
      .set(
        slot === "trail"
          ? { equippedTrail: id, updatedAt: new Date() }
          : { equippedBeam: id, updatedAt: new Date() },
      )
      .where(eq(schema.arcadeProfile.userId, actor.id));
    return reply.send({ ok: true });
  });
}
