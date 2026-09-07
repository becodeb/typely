/** Integración contra API/base LOCALES. Crea y elimina su propio alumno.
 * node --env-file=.env --import tsx src/scripts/verificar-tienda.ts */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { db, schema, sql } from "../db/index.js";
import { signAccessToken } from "../auth.js";

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  assert(["127.0.0.1", "localhost", "[::1]"].includes(host), "Solo se permite una base local");
  const base = `http://127.0.0.1:${Number(process.env.PORT ?? 3010)}`;
  const [modelo] = await db.select().from(schema.users).where(eq(schema.users.username, "alumno3")).limit(1);
  assert(modelo, "Primero ejecutar npm run db:local");
  const id = randomUUID();
  await db.insert(schema.users).values({ ...modelo, id, username: `qa_tienda_${id.slice(0,8)}`, email: null });
  try {
    const token = await signAccessToken({ sub: id, role: "alumno", sede: modelo.sedeId, username: `qa_tienda_${id.slice(0,8)}`, email: null, name: "Prueba tienda" });
    const request = async (path: string, body?: unknown, authenticated = true) => {
      const r = await fetch(`${base}/api/arcade/${path}`, { method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: await r.json() as any };
    };
    assert.equal((await request("buy", { id: "nave-prisma" }, false)).status, 401);
    const me = await request("me");
    assert.equal(me.status, 200);
    const infinitos = me.body.profile.crystalsInfinite === true;
    await db.update(schema.arcadeProfile).set({ crystalsBalance: infinitos ? 0 : 100000, ownedCosmetics: '["estela-menta"]', equippedTrail: "estela-menta" }).where(eq(schema.arcadeProfile.userId,id));
    assert.equal((await request("equip", { slot: "ship", id: "nave-prisma" })).status, 409);
    const purchases = [["estela-aurora",1400],["rayo-espiral",1500],["impacto-cristales",1200],["nave-prisma",3600],["nave-fenix",4800],["nave-eclipse",6000],
      ["nave-zapatilla-cohete",7200],["nave-tiburon-galactico",8400],["nave-dragon-caramelo",9600],["nave-ovni-gelatina",10800],["nave-ajolote-espacial",12000],
      ["estela-burbujas",850],["estela-pixeles",1600],["estela-arcoiris",1800],
      ["rayo-relampago",900],["rayo-caramelo",1600],["rayo-burbujas",1800],
      ["impacto-rosa",300],["impacto-burbujas",850],["impacto-confeti",1500],["impacto-palomitas",1800]] as const;
    let saldo = infinitos ? 0 : 100000;
    for (const [item, precio] of purchases) {
      const res = await request("buy", { id: item, precio: 1 });
      assert.equal(res.status,200); saldo -= infinitos ? 0 : precio; assert.equal(res.body.balance,saldo);
    }
    assert.equal((await request("buy", { id: "nave-prisma" })).status,409);
    assert.equal((await request("equip", { slot: "trail", id: "nave-prisma" })).status,400);
    for (const [slot,item] of [["trail","estela-aurora"],["beam","rayo-espiral"],["impact","impacto-cristales"],["ship","nave-prisma"]]) {
      assert.equal((await request("equip", { slot,id:item })).status,200);
    }
    const duplicates = await Promise.all([request("buy", { id:"nave-aurora" }),request("buy", { id:"nave-aurora" })]);
    assert.equal(duplicates.filter(r=>r.status===200).length,1); saldo -= infinitos ? 0 : 2400;
    // Compras simultáneas de artículos distintos: o se conservan ambas,
    // o la segunda pide reintentar, sin cobrar ni perder la primera.
    const concurrent = await Promise.all([request("buy", {id:"rayo-pulso"}),request("buy", {id:"impacto-anillos"})]);
    for (let i=0;i<concurrent.length;i++) {
      assert([200,409].includes(concurrent[i]!.status));
      if(concurrent[i]!.status===200) saldo -= infinitos ? 0 : [700,600][i]!;
    }
    let perfil = (await request("me")).body.profile;
    assert.equal(perfil.crystals,saldo);
    assert(perfil.owned.includes("estela-menta"));
    assert.equal(new Set(perfil.owned).size,perfil.owned.length);
    for(let i=0;i<concurrent.length;i++) assert.equal(perfil.owned.includes(["rayo-pulso","impacto-anillos"][i]),concurrent[i]!.status===200);
    assert.deepEqual(perfil.equipped,{ trail:"estela-aurora",beam:"rayo-espiral",impact:"impacto-cristales",ship:"nave-prisma",pet:null });
    assert.equal((await request("equip", {slot:"pet", id:"nave-prisma"})).status, 400);
    assert.equal((await request("equip", {slot:"pet", id:null})).status, 200);
    assert.equal((await request("equip", {slot:"pet", id:"mascota-botito"})).status, 409);
    for (const [pet,precio] of [["botito",400],["lunita",600],["gatito-cometa",1000],["medusa-burbuja",1400],["pulpito-dj",2000],["dino-patinador",2600],["capibara-astronauta",3400],["dragon-gelatina",4200]] as const) {
      const id = `mascota-${pet}`;
      const res = await request("buy", {id, precio:1});
      assert.equal(res.status,200); saldo -= infinitos ? 0 : precio;
      assert.equal(res.body.balance,saldo);
      assert.equal((await request("equip", {slot:"pet",id})).status,200);
      const actual = (await request("me")).body.profile;
      assert.deepEqual(actual.equipped,{...perfil.equipped,pet:id});
      assert.equal(actual.bestScore,me.body.profile.bestScore);
      assert.equal((await request("equip", {slot:"ship",id})).status,400);
      assert.equal((await request("buy", {id})).status,409);
    }
    assert.equal((await request("equip", {slot:"pet",id:null})).status,200);
    assert.equal((await request("me")).body.profile.equipped.pet,null);
    for (const ship of purchases.map(([id]) => id).filter(id => id.startsWith("nave-"))) {
      assert.equal((await request("equip", { slot: "ship", id: ship })).status, 200);
      assert.equal((await request("me")).body.profile.equipped.ship, ship);
      assert.equal((await request("equip", { slot: "beam", id: ship })).status, 400);
    }
    assert.equal((await request("equip",{slot:"ship",id:null})).status,200);
    perfil = (await request("me")).body.profile;
    assert.equal(perfil.equipped.ship,null); assert.equal(perfil.equipped.impact,"impacto-cristales");
    for (const [item] of purchases.filter(([id]) => !id.startsWith("nave-"))) {
      const slot = item.startsWith("estela-") ? "trail" : item.startsWith("rayo-") ? "beam" : "impact";
      assert.equal((await request("equip", {slot, id:item})).status, 200);
      assert.equal((await request("me")).body.profile.equipped[slot], item);
      assert.equal((await request("equip", {slot:"ship", id:item})).status, 400);
      assert.equal((await request("buy", {id:item})).status, 409);
    }
    if (process.argv[2]) execFileSync(process.execPath, [process.argv[2], `qa_tienda_${id.slice(0,8)}`], { stdio: "inherit" });
    await db.update(schema.arcadeProfile).set({crystalsBalance:0}).where(eq(schema.arcadeProfile.userId,id));
    assert.equal((await request("buy",{id:"estela-dorada"})).status,infinitos ? 200 : 409);
    if (infinitos) assert.equal((await request("me")).body.profile.crystals, 0);
    console.log(infinitos ? "PASS: cristales infinitos compran con saldo cero sin modificarlo." : "PASS: modo normal descuenta precios y rechaza saldo insuficiente.");
    console.log("PASS: cinco secciones, ocho mascotas, precios del servidor, propiedad, slots, saldo, duplicados, concurrencia, persistencia y equipo original.");
  } finally { await db.delete(schema.users).where(eq(schema.users.id,id)); }
}
main().catch(e => { console.error(e); process.exitCode=1; }).finally(()=>sql.end());
