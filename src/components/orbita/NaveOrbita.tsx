import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import { NAVE_ORBITA_BASE, geometriaVista, type NaveOrbitaDef, type PoseNave } from "../../data/orbitaNaves";
import type { EfectoCosmetico } from "../../data/orbitaCosmeticos";
import { ParticulasMotor } from "./EfectosCosmeticos";

export interface NaveOrbitaHandle {
  atacar: (objetivo: { x: number; y: number }, alDisparar: () => void) => void;
  apuntar: (objetivo: { x: number; y: number } | null, dtMs: number) => void;
  disparar: (intenso?: boolean) => void;
  impacto: () => void;
  origenDisparo: () => { x: number; y: number } | null;
  reiniciar: () => void;
}
interface Props {
  nave?: NaveOrbitaDef;
  pausada?: boolean;
  animada?: boolean;
  colorMotor?: string | null;
  colorDisparo?: string;
  efectoEstela?: EfectoCosmetico;
  className?: string;
}
const poses: PoseNave[] = ["neutra", "izquierda", "derecha"];

/** El rAF del juego mueve esta nave: no monta un segundo reloj ni hace
 * renders de React por frame. Las poses 3D aportan el banco, el rotor
 * sigue al objetivo y los motores/emisor conservan sus anclajes reales. */
export const NaveOrbita = forwardRef<NaveOrbitaHandle, Props>(function NaveOrbita({
  nave = NAVE_ORBITA_BASE, pausada = false, animada = true,
  colorMotor, colorDisparo = "#25c8df", efectoEstela = "color", className = "",
}, ref) {
  const raiz = useRef<HTMLDivElement>(null);
  const rotor = useRef<HTMLDivElement>(null);
  const alabeo = useRef<HTMLDivElement>(null);
  const inclinacion = useRef(0);
  const casco = useRef<HTMLDivElement>(null);
  const emisor = useRef<HTMLSpanElement>(null);
  const flash = useRef<HTMLSpanElement>(null);
  const angulo = useRef(0);
  const tiempo = useRef(0);
  const ataque = useRef<{ objetivo: { x: number; y: number }; restante: number; disparar: (() => void) | null } | null>(null);
  const poseActual = useRef<PoseNave>("neutra");
  const reducido = useRef(false);
  const efectos = useRef(new Map<string, Animation>());

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cambiar = () => { reducido.current = media.matches; };
    cambiar();
    media.addEventListener("change", cambiar);
    const activos = efectos.current;
    return () => {
      media.removeEventListener("change", cambiar);
      activos.forEach(a => a.cancel());
      activos.clear();
    };
  }, []);

  useEffect(() => {
    const sincronizar = () => {
      if (raiz.current) raiz.current.dataset.oculta = String(document.hidden);
      efectos.current.forEach(a => pausada || document.hidden ? a.pause() : a.play());
    };
    sincronizar();
    document.addEventListener("visibilitychange", sincronizar);
    return () => document.removeEventListener("visibilitychange", sincronizar);
  }, [pausada]);

  useImperativeHandle(ref, () => {
    const animar = (clave: string, el: HTMLElement | null, frames: Keyframe[], duracion: number) => {
      efectos.current.get(clave)?.cancel();
      if (!el) return;
      const animacion = el.animate(frames, { duration: duracion, easing: "ease-out" });
      efectos.current.set(clave, animacion);
      animacion.onfinish = () => {
        if (efectos.current.get(clave) === animacion) efectos.current.delete(clave);
      };
    };
    return {
      atacar(objetivo, alDisparar) {
        if (pausada) return;
        // Una nueva tecla completa el tiro pendiente antes de tomar el relevo.
        // No hay timers de giro que puedan devolver al centro un ataque nuevo.
        if (ataque.current?.disparar) this.apuntar(null, 45);
        ataque.current = { objetivo, restante: 45, disparar: alDisparar };
      },
      apuntar(objetivo, dtMs) {
        if (!raiz.current || !rotor.current || pausada) return;
        const dt = Math.min(Math.max(dtMs, 0), 100);
        const activo = ataque.current;
        const seguimiento = objetivo;
        let emitir: (() => void) | null = null;
        let factor = 1 - Math.exp(-dt / 60);
        if (activo) {
          objetivo = activo.objetivo;
          if (activo.disparar) {
            factor = reducido.current ? 1 : Math.min(1, dt / Math.max(1, activo.restante));
            activo.restante -= dt;
            if (activo.restante <= 0 || reducido.current) {
              emitir = activo.disparar;
              activo.disparar = null;
              activo.restante = 60;
            }
          } else {
            activo.restante -= dt;
            if (activo.restante <= 0) { ataque.current = null; objetivo = seguimiento; }
          }
        }
        const rect = raiz.current.getBoundingClientRect();
        const centro = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.54 };
        const deseado = objetivo
          ? Math.max(-65, Math.min(65, Math.atan2(objetivo.x - centro.x, centro.y - objetivo.y) * 180 / Math.PI))
          : 0;
        const giroPendiente = deseado - angulo.current;
        angulo.current += giroPendiente * factor;
        tiempo.current += dt;
        const balanceo = reducido.current ? 0 : Math.sin(tiempo.current / 620) * 0.6;
        rotor.current.style.transform = `rotate(${angulo.current.toFixed(2)}deg) translateY(${balanceo.toFixed(2)}%)`;
        // El movimiento lo hacen el giro y el alabeo, nunca un fundido de
        // siluetas. El eje longitudinal queda fijo para conservar el emisor.
        const banco = reducido.current ? 0 : Math.max(-24, Math.min(24, giroPendiente * 0.8 + angulo.current * 0.15));
        inclinacion.current = reducido.current ? 0
          : inclinacion.current + (banco - inclinacion.current) * (1 - Math.exp(-dt / 55));
        if (alabeo.current) alabeo.current.style.transform = `rotateY(${inclinacion.current.toFixed(2)}deg)`;
        // La histéresis evita alternar poses ante pequeñas variaciones.
        const a = angulo.current;
        if (a < -16) poseActual.current = "izquierda";
        else if (a > 16) poseActual.current = "derecha";
        else if (Math.abs(a) < 10) poseActual.current = "neutra";
        for (const pose of poses) {
          raiz.current.style.setProperty(`--nave-${pose}`, pose === poseActual.current ? "1" : "0");
        }
        emitir?.();
      },
      disparar(intenso = false) {
        if (pausada) return;
        if (!reducido.current) {
          animar("retroceso", casco.current, [
            { transform: "translateY(0)" }, { transform: `translateY(${intenso ? 2.8 : 1.5}%)`, offset: 0.2 },
            { transform: "translateY(0)" },
          ], intenso ? 190 : 130);
        }
        animar("disparo", flash.current, [
          { opacity: 1, transform: "translate(-50%, -50%) scale(0.55)" },
          { opacity: 0, transform: `translate(-50%, -50%) scale(${reducido.current ? 1 : intenso ? 1.9 : 1.3})` },
        ], intenso ? 210 : 140);
      },
      impacto() {
        animar("golpe", casco.current, reducido.current ? [
          { filter: "brightness(1.65)" }, { filter: "brightness(1)" },
        ] : [
          { transform: "translateX(0)", filter: "brightness(1.7)" },
          { transform: "translateX(-2%)", offset: 0.2 },
          { transform: "translateX(2%)", offset: 0.5 },
          { transform: "translateX(0)", filter: "brightness(1)" },
        ], 240);
      },
      origenDisparo() {
        if (!emisor.current) return null;
        const r = emisor.current.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
      reiniciar() {
        efectos.current.forEach(a => a.cancel());
        efectos.current.clear();
        angulo.current = 0;
        tiempo.current = 0;
        ataque.current = null;
        poseActual.current = "neutra";
        inclinacion.current = 0;
        if (alabeo.current) alabeo.current.style.transform = "rotateY(0deg)";
        if (rotor.current) rotor.current.style.transform = "rotate(0deg)";
        raiz.current?.style.setProperty("--nave-neutra", "1");
        raiz.current?.style.setProperty("--nave-izquierda", "0");
        raiz.current?.style.setProperty("--nave-derecha", "0");
      },
    };
  }, [pausada]);

  return (
    <div ref={raiz} className={`orb-nave-sprite ${className}`} data-pausada={pausada || !animada}
      role="img" aria-label={nave.nombre}
      style={{ "--nave-motor-color": colorMotor ?? nave.colorMotor ?? "#55dfff", "--nave-disparo-color": colorDisparo } as CSSProperties}>
      <div ref={rotor} className="orb-nave-sprite__rotor">
        <div ref={alabeo} className="orb-nave-sprite__alabeo">
        <div ref={casco} className="orb-nave-sprite__casco">
          {poses.map(pose => {
            const vista = nave.vistas[pose];
            const g = geometriaVista(vista);
            return <div key={pose} className="orb-nave-sprite__pose" data-pose={pose}
              style={{
                opacity: `var(--nave-${pose}, ${pose === "neutra" ? 1 : 0})`,
                transformOrigin: `${g.pivote.x}% ${g.pivote.y}%`,
                transform: `translate(${50 - g.pivote.x}%, ${54 - g.pivote.y}%) rotate(${-g.angulo}deg) scale(${g.escala})`,
              }}>
              {animada && vista.motores.map((motor, i) => <span key={i} className="orb-nave-sprite__motor"
                style={{ left: `${motor.x}%`, top: `${motor.y}%`, transform: `translate(-50%, -8%) rotate(${g.angulo}deg)`, "--motor-retardo": `${i * -0.29}s` } as CSSProperties}>
                <i />
                <ParticulasMotor efecto={efectoEstela} />
              </span>)}
              <img className="orb-nave-sprite__imagen" src={vista.imagen} alt="" draggable={false} decoding="async" />
            </div>;
          })}
          <span ref={emisor} className="orb-nave-sprite__emisor" aria-hidden="true" />
          <span ref={flash} className="orb-nave-sprite__disparo" aria-hidden="true" />
        </div>
        </div>
      </div>
    </div>
  );
});
