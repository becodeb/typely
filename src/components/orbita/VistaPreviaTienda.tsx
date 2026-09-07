import { useEffect, useRef, useState } from "react";
import { NaveOrbita, type NaveOrbitaHandle } from "./NaveOrbita";
import { MascotaOrbita } from "./MascotaOrbita";
import { DURACION_RAYO_MS, ImpactoCosmetico, RayoCosmetico } from "./EfectosCosmeticos";
import { colorEstela, colorRayo, cosmeticoPorId, efectoCosmetico } from "../../data/orbitaCosmeticos";
import { navePorId } from "../../data/orbitaNaves";
import type { ArcadePerfil } from "../../utils/api";

export function VistaPreviaTienda({ equipo }: { equipo: ArcadePerfil["equipped"] }) {
  const vozMascota = useRef<HTMLDivElement>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const objetivo = useRef<HTMLSpanElement>(null);
  const nave = useRef<NaveOrbitaHandle>(null);
  const [repeticion, setRepeticion] = useState(0);
  const [hechas, setHechas] = useState(0);
  const [rayo, setRayo] = useState<{ id: number; x: number; y: number; largo: number; angulo: number } | null>(null);
  const [impacto, setImpacto] = useState(0);

  useEffect(() => {
    let raf = 0, anterior = 0, tiempo = 0, letra = 0, ultimoTiro = -1000;
    let activa = true;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Con movimiento reducido se reproduce solo al pulsar el botón.
    if (reducido && repeticion === 0) return;
    nave.current?.reiniciar();
    setHechas(0); setRayo(null); setImpacto(0);
    const frame = (ahora: number) => {
      const dt = anterior ? Math.min(ahora - anterior, 50) : 0;
      anterior = ahora;
      if (!document.hidden) {
        tiempo += dt;
        const r = objetivo.current?.getBoundingClientRect();
        const destino = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
        if (destino && letra < 4 && tiempo >= 450 + letra * 220) {
          letra++;
          const numero = letra;
          nave.current?.atacar(destino, () => {
            if (!activa) return;
            nave.current?.disparar(numero === 4);
            const origen = nave.current?.origenDisparo();
            const e = escenario.current?.getBoundingClientRect();
            if (origen && e) setRayo({ id: tiempo, x: origen.x - e.left, y: origen.y - e.top,
              largo: Math.hypot(destino.x - origen.x, destino.y - origen.y),
              angulo: Math.atan2(destino.y - origen.y, destino.x - origen.x) * 180 / Math.PI });
            ultimoTiro = tiempo;
            setHechas(numero);
            if (numero === 4) setImpacto(tiempo);
          });
        }
        nave.current?.apuntar(letra > 0 && letra < 4 ? destino : null, dt);
        if (tiempo - ultimoTiro > DURACION_RAYO_MS) setRayo(prev => prev ? null : prev);
        if (tiempo > 3000 && !reducido) {
          tiempo = 0; letra = 0; ultimoTiro = -1000; setHechas(0); setImpacto(0);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { activa = false; cancelAnimationFrame(raf); nave.current?.reiniciar(); };
  }, [equipo.trail, equipo.beam, equipo.impact, equipo.ship, repeticion]);

  return <>
    <div ref={escenario} className="orb-tienda-prueba" aria-label="Vista previa de tu combinación">
      <img className="orb-tienda-prueba__horizonte" src="/assets/orbita/fondo/horizonte.webp" alt="" />
      <span className="orb-tienda-prueba__etiqueta">VUELO DE PRUEBA</span>
      <span ref={objetivo} className="orb-tienda-prueba__palabra" aria-hidden="true">
        <b>{"LUNA".slice(0, hechas)}</b>{"LUNA".slice(hechas)}
        {impacto > 0 && <ImpactoCosmetico key={impacto} efecto={efectoCosmetico(equipo.impact)} color={cosmeticoPorId(equipo.impact)?.color ?? "#54e8c6"} style={{ left: "50%", top: "50%" }} />}
      </span>
      <div className="orb-tienda-prueba__nave">
        <NaveOrbita ref={nave} nave={navePorId(equipo.ship)} colorMotor={colorEstela(equipo.trail)} colorDisparo={colorRayo(equipo.beam)} efectoEstela={efectoCosmetico(equipo.trail)} />
        <MascotaOrbita id={equipo.pet} contexto="tienda" destinoMensaje={vozMascota} />
      </div>
      {rayo && <RayoCosmetico key={rayo.id} efecto={efectoCosmetico(equipo.beam)} color={colorRayo(equipo.beam)}
        style={{ left: rayo.x, top: rayo.y, width: rayo.largo, transform: `rotate(${rayo.angulo}deg)` }} />}
    </div>
    <div ref={vozMascota} className="orb-tienda__voz" data-con-mascota={!!equipo.pet} />
    <button type="button" className="orb-boton-vidrio orb-boton--chico" onClick={() => setRepeticion(n => n + 1)}>Probar disparo</button>
  </>;
}
