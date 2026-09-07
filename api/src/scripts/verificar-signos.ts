/** Prueba de persistencia del bonus contra API y base exclusivamente locales. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema, sql } from "../db/index.js";
import { signAccessToken } from "../auth.js";

async function main() {
  assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname));
  const [modelo] = await db.select().from(schema.users).where(eq(schema.users.username, "alumno3")).limit(1);
  assert(modelo, "Requiere la base de desarrollo local");
  const id = randomUUID(), username = `qa_signos_${id.slice(0, 8)}`;
  await db.insert(schema.users).values({ ...modelo, id, username, email: null });
  try {
    const token = await signAccessToken({ sub: id, role: "alumno", sede: modelo.sedeId, username, email: null, name: "Prueba signos" });
    const fin = Date.now();
    for (const durationMs of [275000, 361000, 1800000]) {
      const response = await fetch(`http://127.0.0.1:${Number(process.env.PORT ?? 3010)}/api/arcade/run`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: [{ gameId: "tormenta", startedAt: new Date(fin-durationMs).toISOString(), endedAt: new Date(fin).toISOString(),
          durationMs, score: 9000, peakThreat: 30, rankId: "piloto", wpmAvg: 20, wpmPeak: 30, accuracy: 90,
          wordsDestroyed: 100, wordsTyped: 100, charsTyped: 300, errors: 30, crystalsClaimed: 50, level: 0, upgrades: [] }] }),
      });
      assert.equal(response.status, 200, await response.text());
    }
    const runs = await db.select().from(schema.arcadeRuns).where(eq(schema.arcadeRuns.userId, id));
    assert.equal(runs.length, 3);
    assert.equal(runs.find(r => r.durationMs === 275000)?.ranked, true, "la partida extendida se guarda en ranking");
    assert.ok(runs.every(r => r.ranked), "las partidas largas también entran al ranking");
    console.log("PASS: el servidor acepta partidas con bonus y partidas largas de hasta 30 minutos en esta prueba.");
  } finally { await db.delete(schema.users).where(eq(schema.users.id, id)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => sql.end());
