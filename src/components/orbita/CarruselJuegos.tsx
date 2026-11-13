import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ChevronLeft, ChevronRight, CloudRain, Rocket, Sparkles } from "lucide-react";
import { JUEGOS_ORBITA, indiceJuego, recordarJuego, ultimoJuego, type JuegoOrbitaDef } from "../../data/orbitaJuegos";
import { navePorId } from "../../data/orbitaNaves";
import { colorEstela, efectoCosmetico } from "../../data/orbitaCosmeticos";
import { useEsCelular } from "../../hooks/useEsCelular";
import type { ArcadePerfil } from "../../utils/api";
import { blip, sonidoActivado } from "../../utils/orbita/sonido";
import { NaveOrbita } from "./NaveOrbita";
import { MascotaOrbita } from "./MascotaOrbita";

interface Props {
  perfil: ArcadePerfil | null;
  records: Partial<Record<"tormenta" | "carrera", number>>;
  destinoMensaje: RefObject<HTMLDivElement | null>;
  bloqueado?: boolean;
  alElegir: (juego: JuegoOrbitaDef) => void;
  alEntrar: (juego: JuegoOrbitaDef) => void;
}

const RASTROS = [
  [12, 22, -24], [20, 72, 16], [88, 25, 24], [82, 75, -16],
];

/** El destino nunca se reduce al rango 0–4: después de dar una vuelta el
 * anillo continúa, sin rebobinar 360°. React cambia solo en cada gesto;
 * la interpolación entre puestos la hace el compositor del navegador. */
export function CarruselJuegos({ perfil, records, destinoMensaje, bloqueado = false, alElegir, alEntrar }: Props) {
  const [destino, setDestino] = useState(ultimoJuego);
  const [girando, setGirando] = useState(false);
  const [duracion, setDuracion] = useState(700);
  const [direccion, setDireccion] = useState(0);
  const [inclinacion, setInclinacion] = useState(0);
  const [destello, setDestello] = useState(0);
  const [negacion, setNegacion] = useState(0);
  const [reducido, setReducido] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [oculta, setOculta] = useState(document.hidden);
  const [faltantes, setFaltantes] = useState<ReadonlySet<string>>(new Set());
  const lista = useRef<HTMLDivElement>(null);
  const destinoRef = useRef(destino);
  const asentadoRef = useRef(destino);
  const gesto = useRef<{ id: number; x: number; y: number } | null>(null);
  const omitirClick = useRef(false);
  const celular = useEsCelular();
  const seleccion = indiceJuego(destino);
  const elegida = JUEGOS_ORBITA[seleccion]!;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cambiar = () => setReducido(media.matches);
    const visibilidad = () => setOculta(document.hidden);
    media.addEventListener("change", cambiar);
    document.addEventListener("visibilitychange", visibilidad);
    return () => {
      media.removeEventListener("change", cambiar);
      document.removeEventListener("visibilitychange", visibilidad);
    };
  }, []);

  useEffect(() => {
    recordarJuego(elegida);
    alElegir(elegida);
  }, [elegida, alElegir]);

  useEffect(() => {
    if (!bloqueado) lista.current?.focus({ preventScroll: true });
  }, [bloqueado]);

  useEffect(() => {
    if (!girando) return;
    // Al encadenar un gesto se cancelan los dos vencimientos anteriores.
    const inclinar = window.setTimeout(() => setInclinacion(reducido ? 0 : direccion), 120);
    const terminar = window.setTimeout(() => {
      asentadoRef.current = destino;
      setGirando(false);
      setInclinacion(0);
      setDestello(n => n + 1);
    }, reducido ? 200 : duracion);
    return () => { window.clearTimeout(inclinar); window.clearTimeout(terminar); };
  }, [destino, duracion, direccion, reducido, girando]);

  function girar(pasos: number) {
    if (bloqueado) return;
    const siguiente = destinoRef.current + pasos;
    const distancia = Math.abs(siguiente - asentadoRef.current);
    destinoRef.current = siguiente;
    setDuracion(distancia <= 1 ? 700 : distancia === 2 ? 1000 : 1200);
    setDireccion(Math.sign(pasos));
    setGirando(true);
    setDestino(siguiente);
    if (sonidoActivado()) blip(260, 650, 0.025);
    lista.current?.focus({ preventScroll: true });
  }

  function entrar() {
    if (bloqueado || girando) return;
    if (elegida.estado === "dormida") { setNegacion(n => n + 1); return; }
    if (!celular) alEntrar(elegida);
  }

  const estilo = {
    "--orb-giro": `${-destino * 72}deg`,
    "--orb-duracion": `${reducido ? 200 : duracion}ms`,
    // Cada impulso desplaza el cielo al revés del anillo y después lo
    // devuelve al centro, como la nave: nunca se llega al borde del fondo.
    "--orb-parallax": girando ? direccion : 0,
    "--orb-rumbo": direccion || 1,
    "--orb-inclinacion": `${reducido ? 0 : inclinacion * 8}deg`,
    "--nave-neutra": reducido || !inclinacion ? 1 : 0,
    "--nave-izquierda": !reducido && inclinacion < 0 ? 1 : 0,
    "--nave-derecha": !reducido && inclinacion > 0 ? 1 : 0,
  } as CSSProperties;

  function falta(imagen: string) { setFaltantes(prev => new Set(prev).add(imagen)); }
  return <div className="orb-juegos-escena" style={estilo} data-reducido={reducido} data-oculta={oculta || bloqueado}>
    <div className="orb-cielo-profundo" aria-hidden="true">
      <div className="orb-cielo-profundo__estrellas" />
      <div className="orb-cielo-profundo__nebulosa" />
    </div>
    <div className="orb-carrusel" data-girando={girando}
      onPointerDown={e => {
        omitirClick.current = false;
        if (!e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
        gesto.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={e => {
        const inicio = gesto.current;
        gesto.current = null;
        if (!inicio || inicio.id !== e.pointerId) return;
        const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) {
          omitirClick.current = true;
          girar(dx < 0 ? 1 : -1);
        }
      }}
      onPointerMove={e => {
        const inicio = gesto.current;
        if (inicio?.id === e.pointerId && Math.abs(e.clientX - inicio.x) > 8 && Math.abs(e.clientX - inicio.x) > Math.abs(e.clientY - inicio.y)) {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={() => { gesto.current = null; }}
      onClickCapture={e => { if (omitirClick.current) { e.preventDefault(); e.stopPropagation(); omitirClick.current = false; } }}>
      <div ref={lista} className="orb-lista-juegos" role="listbox" tabIndex={bloqueado ? -1 : 0}
        aria-label="Juegos de Órbita" aria-orientation="horizontal"
        aria-activedescendant={`juego-${elegida.id}`} aria-describedby="orb-carrusel-ayuda"
        onKeyDown={e => {
          if (e.altKey || e.ctrlKey || e.metaKey) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault(); girar(e.key === "ArrowRight" ? 1 : -1);
          } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!e.repeat) entrar(); }
        }}>
        <div className="orb-anillo">{JUEGOS_ORBITA.map((juego, i) => {
          const distancia = indiceJuego(i - seleccion + 2) - 2;
          const frente = distancia === 0;
          const estado = frente ? "frente" : Math.abs(distancia) === 1 ? "lateral" : "fondo";
          const record = juego.gameId ? records[juego.gameId] : 0;
          return <div key={juego.id} id={`juego-${juego.id}`} role="option"
            aria-selected={frente} aria-label={juego.nombre || "Próximamente"}
            className={`orb-juego orb-juego--${estado}${juego.estado === "dormida" ? " orb-juego--dormida" : ""}`}
            data-id={juego.id} data-encendida={frente && !girando}
            style={{
              "--orb-puesto": `${i * 72}deg`,
              // El puesto viaja por el anillo, pero la ilustración compensa
              // ese giro. Solo queda una inclinación suave, nunca de canto.
              "--orb-orientacion": `${-distancia * 13}deg`,
              "--orb-escala": frente ? 1 : Math.abs(distancia) === 1 ? .66 : .43,
              "--orb-elevacion": frente ? "0px" : Math.abs(distancia) === 1 ? "-28px" : "-135px",
              "--orb-fase-flota": `${-i * 1.7}s`,
              "--orb-mascara-ilustracion": faltantes.has(juego.imagen) ? "radial-gradient(ellipse, #000, transparent 72%)" : `url(${juego.imagen})`,
            } as CSSProperties}
            onClick={() => { if (frente) entrar(); else if (Math.abs(distancia) === 1) girar(distancia); }}>
            <div className="orb-juego__plano">
              <div className="orb-juego__contenido">
                <div className="orb-juego__flotacion">
                  <div key={frente ? negacion : 0} className="orb-juego__gesto" data-no={frente && negacion > 0}>
                    <div className="orb-juego__arte">
                      {faltantes.has(juego.imagen)
                        ? <span className="orb-juego__respaldo" aria-hidden="true">{juego.id === "tormenta" ? <CloudRain /> : juego.id === "carrera" ? <Rocket /> : <Sparkles />}</span>
                        : <img src={juego.imagen} alt="" draggable={false} onError={() => falta(juego.imagen)} />}
                    </div>
                    {frente && !girando && destello > 0 && juego.estado === "activa" && <span key={destello} className="orb-juego__destello" aria-hidden="true">
                      {!faltantes.has("destello") ? <img src="/assets/orbita/hub/destello.webp" alt="" onError={() => falta("destello")} /> : "✦"}
                    </span>}
                  </div>
                </div>
              </div>
              <div className="orb-juego__rotulo">
                <span className="orb-juego__nombre">{juego.nombre || "pronto"}</span>
                {!!record && <span className="orb-pildora orb-juego__record">récord {record.toLocaleString("es-AR")}</span>}
                <span className="orb-dato orb-juego__invitacion">
                  {juego.estado === "activa" ? celular ? "Jugá desde una computadora" : "Enter para jugar" : ""}
                </span>
              </div>
            </div>
          </div>;
        })}</div>
      </div>
      <div className="orb-carrusel__rastros" aria-hidden="true">{RASTROS.map(([x, y, angulo], i) =>
        <span key={i} className="orb-carrusel__rastro" style={{
          left: `${x}%`, top: `${y}%`, "--orb-angulo-rastro": `${angulo}deg`, "--orb-espera-rastro": `${i * -95}ms`,
        } as CSSProperties} />
      )}</div>
      {([-1, 1] as const).map(lado => {
        const nombre = lado < 0 ? "izquierda" : "derecha";
        return <button type="button" key={lado} className={`orb-carrusel__flecha orb-carrusel__flecha--${nombre}`}
          aria-label={lado < 0 ? "Juego anterior" : "Juego siguiente"} disabled={bloqueado} onClick={() => girar(lado)}>
          {faltantes.has(nombre) ? lado < 0 ? <ChevronLeft /> : <ChevronRight />
            : <img src={`/assets/orbita/hub/flecha-${nombre}.webp`} alt="" draggable={false} onError={() => falta(nombre)} />}
        </button>;
      })}
      <div className="orb-carrusel__escuadra" aria-hidden="true">
        <div className="orb-carrusel__nave">
          <NaveOrbita nave={navePorId(perfil?.equipped.ship)} pausada={oculta || bloqueado}
            colorMotor={colorEstela(perfil?.equipped.trail)} efectoEstela={efectoCosmetico(perfil?.equipped.trail)} />
          <MascotaOrbita id={perfil?.equipped.pet} destinoMensaje={destinoMensaje} pausada={oculta || bloqueado} />
        </div>
      </div>
    </div>
    <p id="orb-carrusel-ayuda" className="sr-only">Usá las flechas izquierda y derecha para elegir un juego. Enter o Espacio para jugar. También podés deslizar o tocar un juego lateral.</p>
    <span className="sr-only" role="status" aria-live="polite">{!girando ? `${elegida.nombre || "Próximamente"}, ${seleccion + 1} de ${JUEGOS_ORBITA.length}` : ""}</span>
  </div>;
}
