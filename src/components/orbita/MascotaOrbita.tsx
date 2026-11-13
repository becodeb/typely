import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { mascotaPorId, type MascotaOrbitaDef } from "../../data/orbitaMascotas";
import { cosmeticoPorId } from "../../data/orbitaCosmeticos";
import { DETALLE_MASCOTA, PERSONALIDADES_MASCOTA, type MomentoMascota } from "../../data/orbitaPersonalidades";

interface Props {
  id?: string | null;
  pausada?: boolean;
  contexto?: "inicio" | "tienda" | "partida";
  racha?: number;
  corazones?: number;
  destinoMensaje?: RefObject<HTMLDivElement | null>;
}

/** Solo observa el HUD: nunca elige objetivos ni modifica el juego. */
export function MascotaOrbita({ id, ...props }: Props) {
  const mascota = mascotaPorId(id);
  return mascota ? <Companera key={mascota.id} mascota={mascota} {...props} /> : null;
}

function Companera({ mascota, pausada = false, contexto = "inicio", racha = 0, corazones = 3, destinoMensaje }: Omit<Props, "id"> & { mascota: MascotaOrbitaDef }) {
  const personalidad = PERSONALIDADES_MASCOTA[mascota.id];
  const rareza = cosmeticoPorId(mascota.id)?.rareza ?? "comun";
  const detalle = DETALLE_MASCOTA[rareza];
  const [oculta, setOculta] = useState(() => document.hidden);
  const [mensaje, setMensaje] = useState<{ texto: string; momento: MomentoMascota; numero: number } | null>(null);
  const anterior = useRef({ racha, corazones });
  const pendiente = useRef<MomentoMascota | null>(null);
  const repertorio = useRef<Record<MomentoMascota, number>>({ saludo: 0, animo: 0, celebrar: 0, reintentar: 0 });
  const numero = useRef(0);
  const saludo = useRef(false);
  const [destino, setDestino] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setDestino(destinoMensaje?.current ?? null);
  }, [destinoMensaje]);

  useEffect(() => {
    const sincronizar = () => setOculta(document.hidden);
    document.addEventListener("visibilitychange", sincronizar);
    return () => document.removeEventListener("visibilitychange", sincronizar);
  }, []);

  useEffect(() => {
    const antes = anterior.current;
    anterior.current = { racha, corazones };
    if (pausada || oculta || contexto !== "partida") return;
    if (corazones < antes.corazones || (antes.racha >= 3 && racha === 0)) {
      pendiente.current = "reintentar";
    } else if (Math.floor(racha / 5) > Math.floor(antes.racha / 5)) {
      pendiente.current = "celebrar";
    }
  }, [racha, corazones, pausada, oculta, contexto]);

  useEffect(() => {
    setMensaje(null);
    pendiente.current = null;
    if (pausada || oculta || !personalidad) return;
    // Un único reloj de baja frecuencia; React solo renderiza al mostrar/ocultar.
    let proximo = Date.now() + (saludo.current ? 10000 : 1200);
    let ultimo = 0;
    let ocultar = 0;
    let timer: ReturnType<typeof setTimeout>;
    const avanzar = () => {
      const ahora = Date.now();
      if (ocultar && ahora >= ocultar) { setMensaje(null); ocultar = 0; }
      const reaccion = pendiente.current && ahora - ultimo >= 11000;
      if (ahora >= proximo || reaccion) {
        const momento = pendiente.current ?? (saludo.current ? "animo" : "saludo");
        const frases = personalidad.frases[momento];
        const texto = frases[repertorio.current[momento]++ % frases.length]!;
        setMensaje({ texto, momento, numero: ++numero.current });
        saludo.current = true;
        pendiente.current = null;
        ultimo = ahora;
        ocultar = ahora + 6500;
        proximo = ahora + (contexto === "partida" ? 26000 : 20000);
      }
      timer = setTimeout(avanzar, 1000);
    };
    timer = setTimeout(avanzar, 1200);
    return () => clearTimeout(timer);
  }, [pausada, oculta, contexto, personalidad]);

  const visible = !pausada && !oculta ? mensaje : null;
  const voz = (
    <span className="orb-mascota__voz" data-en-linea={!!destinoMensaje}
      role="status" aria-live="polite" aria-atomic="true">
      {visible && <span key={visible.numero} className="orb-mascota__mensaje">
        <strong className="sr-only">{mascota.nombre}: </strong>
        <span>{visible.texto}</span>
      </span>}
    </span>
  );
  return (
    <span className="orb-mascota" data-pausada={pausada} data-oculta={oculta}
      data-contexto={contexto} data-movimiento={mascota.movimiento} data-gesto={personalidad?.gesto}
      data-rareza={rareza} style={{ "--mascota-acento": detalle.color } as CSSProperties}>
      <span className="orb-mascota__viaje">
        <span key={visible?.numero ?? "reposo"} className="orb-mascota__gesto" data-reaccion={visible?.momento}>
          <img src={mascota.imagen} alt={mascota.nombre} draggable={false} decoding="async" />
        </span>
        <span className="orb-mascota__chispas" aria-hidden="true">
          {Array.from({ length: detalle.particulas }, (_, i) => (
            <i key={i} style={{ "--i": i } as CSSProperties}>{personalidad?.simbolo}</i>
          ))}
        </span>
      </span>
      {destinoMensaje ? destino && createPortal(voz, destino) : voz}
    </span>
  );
}
