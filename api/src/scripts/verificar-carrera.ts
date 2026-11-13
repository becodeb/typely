/* Integración contra API y base locales. Crea pilotos propios y los borra
 * al terminar; jamás usa ni modifica partidas de personas reales. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { db,schema,sql } from "../db/index.js";
import { signAccessToken } from "../auth.js";
import largos from "../carreraTextos.json" with { type: "json" };

async function main() {
  assert(["localhost","127.0.0.1","[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname));
  const [modelo]=await db.select().from(schema.users).where(eq(schema.users.username,"alumno3")).limit(1);
  assert(modelo,"Se necesita la base de desarrollo local sembrada.");
  const ids:string[]=[];
  const url=`http://127.0.0.1:${Number(process.env.PORT ?? 3010)}/api/arcade`;
  try {
    const pilotos=[];
    for(let i=0;i<5;i++) {
      const id=randomUUID(),username=`qa_carrera_${id.slice(0,8)}`;ids.push(id);
      await db.insert(schema.users).values({...modelo,id,username,email:null,fullName:`Nombre privado ${i}`});
      await db.insert(schema.arcadeProfile).values({userId:id,alias:`Cohete ${i}`,equippedShip:"nave-aurora",equippedTrail:"estela-rosa"});
      const token=await signAccessToken({sub:id,role:"alumno",sede:modelo.sedeId,username,email:null,name:`Nombre privado ${i}`});
      pilotos.push({id,token,username});
    }
    const llamar=async (token:string,ruta:string,body?:unknown) => {
      const respuesta=await fetch(url+ruta,{method:body ? "POST":"GET",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:body ? JSON.stringify(body):undefined});
      assert.equal(respuesta.status,200,await respuesta.clone().text());return respuesta.json() as Promise<any>;
    };
    const carga=(durationMs:number) => {
      const charsTyped=largos["carrera-001"],wpmAvg=Math.round(charsTyped*12000/durationMs),endedAt=new Date();
      return {gameId:"carrera",textId:"carrera-001",puesto:1,durationMs,charsTyped,wpmAvg,wpmPeak:wpmAvg,accuracy:100,score:wpmAvg*10,
        startedAt:new Date(endedAt.getTime()-durationMs).toISOString(),endedAt:endedAt.toISOString(),peakThreat:0,rankId:"carrera",wordsDestroyed:0,wordsTyped:0,errors:0,level:0,upgrades:[],crystalsClaimed:Math.round(charsTyped/5)+12};
    };
    const propio=pilotos[0]!;
    for(const duration of [200000,40000,12000]) assert((await llamar(propio.token,"/run",carga(duration))).ranked);
    const antes=await llamar(propio.token,"/me");
    assert(antes.profile.bests.carrera.score>0);assert.equal(antes.profile.bestScore,0);assert.equal(antes.profile.bests.tormenta,undefined);
    for(const parche of [{score:99999},{textId:"inexistente"},{level:1},{upgrades:[{id:"bala",level:1}]}]) {
      const res=await llamar(propio.token,"/run",{...carga(40000),...parche});assert.equal(res.ranked,false);assert.equal(res.crystalsEarned,0);
    }
    assert.equal((await llamar(propio.token,"/me")).profile.crystals,antes.profile.crystals);
    for(let i=1;i<pilotos.length;i++) await llamar(pilotos[i]!.token,"/run",carga(25000+i*3000));
    const fantasmas=await llamar(propio.token,"/ghosts?game=carrera");
    assert(fantasmas.mine);assert.equal(fantasmas.grade.length,3);assert(fantasmas.median>0);
    assert(!JSON.stringify(fantasmas).includes("Nombre privado"));assert(!JSON.stringify(fantasmas).includes(propio.id));
    assert(fantasmas.grade.every((r:any)=>r.alias!=="Cohete 0"));
    const tablero=await llamar(propio.token,"/leaderboard?game=carrera&scope=grade&period=week");
    assert(tablero.rows.some((r:any)=>r.mine));assert(tablero.rows.every((r:any)=>r.realName===null));
    const tormenta=await llamar(propio.token,"/leaderboard?game=tormenta");assert(!tormenta.rows.some((r:any)=>r.mine));
    if(process.argv[2])execFileSync(process.execPath,[process.argv[2],propio.username],{stdio:"inherit"});
    console.log("OK: carreras lentas y rápidas, validación, cristales, récords separados, tres fantasmas del grado, privacidad y ranking por juego.");
  } finally {for(const id of ids)await db.delete(schema.users).where(eq(schema.users.id,id));}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>sql.end());
