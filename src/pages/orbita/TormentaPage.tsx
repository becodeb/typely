/* Tormenta de palabras — la pantalla del minijuego de Órbita.
 *
 * Este archivo es solo el CUERPO: toda la regla de juego vive en
 * `utils/orbita/motor.ts` (puro, simulable) y acá se lo alimenta con
 * rAF + entrada de teclado y se dibuja lo que devuelve.
 *
 * Decisiones de dibujo que importan:
 *
 *  - Las ≤8 palabras vivas se mueven con estilos IMPERATIVOS desde el
 *    rAF (transform sobre refs), nunca con setState por frame: React
 *    monta y desmonta palabras (eventos discretos), el frame solo las
 *    empuja. En una Chromebook de aula esa diferencia es jugable/no.
 *
 *  - NO hay teclado en pantalla, ni tenue. Mirar hacia abajo es perder,
 *    y sacar la vista del teclado físico es LO QUE este modo entrena.
 *
 *  - El fondo se tiñe con la amenaza (azul → violeta → rojo) vía la
 *    nebulosa-máscara. Es el termómetro que se lee sin leer números.
 *
 *  - El sonido arranca APAGADO: veinticinco Chromebooks disparando
 *    láseres a la vez es un problema real de aula (CLAUDE.md §6.5).
 *
 *  - rAF se frena solo con la pestaña oculta y el motor recorta dt: una
 *    interrupción de aula PAUSA la partida en vez de regalarle impactos.
 */
import { ArrowLeft, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CharacterSkin } from "../../components/common/CharacterSkin";
import {
  COLOR_DE_MEJORA,
  Gema,
  IconoOrbita,
  InsigniaRango,
} from "../../components/orbita/OrbitaIconos";
import { bandaMaxDesbloqueada } from "../../data/orbitaCorpus";
import { colorEstela, colorRayo } from "../../data/orbitaCosmeticos";
import { getWorldStarRequirements, WORLD_PEDAGOGY_ORDER } from "../../data/worlds";
import { useAuth } from "../../hooks/useAuth";
import type { ArcadeRunResponse } from "../../utils/api";
import {
  perfilLocal,
  recordLocal,
  registrarPartida,
  sincronizaArcade,
} from "../../utils/orbita/arcade";
import {
  MotorTormenta,
  RANGOS,
  type CartaMejora,
  type EventoMotor,
  type MejoraId,
  type ResultadoPartida,
} from "../../utils/orbita/motor";
import { getTotalStars } from "../../utils/progress";

/* ------------------------------------------------------------------ */
/* Geometría de la escena                                              */
/* ------------------------------------------------------------------ */
/* Las palabras nacen cerca del punto de fuga (50 %, 24 %) y convergen
   hacia la nave (50 %, 84 %), creciendo. Todo en % del viewport: la misma
   regla de siempre — nada de píxeles que solo funcionan en una pantalla. */
const FUGA_Y = 24;
const NAVE_Y = 84;
const ABANICO_X = 34;

/* La palabra nace chica en el punto de fuga y llega GRANDE a la nave: con
   la base de 2rem, la escala 0,6 → 2,0 da 19 px al nacer y 64 px al
   impactar. Antes era 14 → 35 y un chico recién la leía encima de la nave.
   El abanico se cierra menos al final (0,72 en vez de 0,82) porque dos
   palabras de 64 px que converjan al mismo centro se pisan. */
function posicionDe(carril: number, progreso: number) {
  return {
    x: 50 + carril * ABANICO_X * (1 - progreso * 0.72),
    y: FUGA_Y + (NAVE_Y - 6 - FUGA_Y) * progreso,
    escala: 0.6 + progreso * 1.4,
  };
}

/* Una palabra muerta, desarmándose letra por letra. Vive 900 ms. */
interface Cadaver {
  id: number;
  x: number;
  y: number;
  escala: number;
  color: string;
  impacto: boolean;
  letras: { ch: string; dx: number; dy: number; rot: number; d: number; mayus: boolean }[];
}

/* Rumbo de cada letra al morir. Destruida por el jugador: estalla en todas
   direcciones. Impactó en la nave: cae hacia abajo, más lejos. */
function letrasQueVuelan(texto: string, impacto: boolean): Cadaver["letras"] {
  return [...texto].map((ch, i) => {
    const ang = impacto ? Math.PI / 2 + (Math.random() - 0.5) * 1.2 : Math.random() * Math.PI * 2;
    const dist = impacto ? 40 + Math.random() * 70 : 30 + Math.random() * 60;
    return {
      ch,
      dx: Math.round(Math.cos(ang) * dist),
      dy: Math.round(Math.sin(ang) * dist),
      rot: Math.round((Math.random() - 0.5) * 160),
      d: i * 18,
      mayus: /[A-ZÁÉÍÓÚÜÑ]/.test(ch),
    };
  });
}

/* Pervinca calmo → violeta → coral. El termómetro ambiental de la amenaza.
   Coral y no rojo sangre: la tensión es color de tormenta, dentro de la
   paleta de marca; el rojo queda para la viñeta del último corazón.
   (scripts/preview-orbita-fondo.mjs tiene los mismos tres: cambiar juntos.) */
const TINTE_PARADAS: [number, [number, number, number]][] = [
  [0, [84, 112, 224]],
  [50, [146, 92, 236]],
  [100, [236, 84, 124]],
];

/* Lluvia de destellos sobre la tarjeta cuando hay récord nuevo. */
const CONFETI = [
  { x: "8%", c: "#ffd552", d: "0ms", s: "18px" },
  { x: "20%", c: "#5be8ba", d: "160ms", s: "14px" },
  { x: "33%", c: "#ff9fca", d: "60ms", s: "16px" },
  { x: "45%", c: "#ffffff", d: "260ms", s: "12px" },
  { x: "56%", c: "#ffd552", d: "120ms", s: "20px" },
  { x: "68%", c: "#9b7cff", d: "320ms", s: "15px" },
  { x: "79%", c: "#5be8ba", d: "40ms", s: "13px" },
  { x: "90%", c: "#ff9fca", d: "220ms", s: "17px" },
  { x: "14%", c: "#ffffff", d: "420ms", s: "11px" },
  { x: "62%", c: "#ffd552", d: "480ms", s: "14px" },
] as const;
function tinteDeAmenaza(amenaza: number): string {
  let [a0, c0] = TINTE_PARADAS[0]!;
  let [a1, c1] = TINTE_PARADAS[TINTE_PARADAS.length - 1]!;
  for (let i = 0; i < TINTE_PARADAS.length - 1; i++) {
    if (amenaza >= TINTE_PARADAS[i]![0] && amenaza <= TINTE_PARADAS[i + 1]![0]) {
      [a0, c0] = TINTE_PARADAS[i]!;
      [a1, c1] = TINTE_PARADAS[i + 1]!;
      break;
    }
  }
  const t = a1 === a0 ? 0 : (amenaza - a0) / (a1 - a0);
  const mez = c0.map((v, i) => Math.round(v + (c1[i]! - v) * t));
  return `rgb(${mez[0]}, ${mez[1]}, ${mez[2]})`;
}

/* ------------------------------------------------------------------ */
/* Sonido — dos blips de WebAudio, apagados por defecto                 */
/* ------------------------------------------------------------------ */
const SONIDO_KEY = "typely_orbita_sonido";

function blip(freq: number, hasta: number, ganancia = 0.05) {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(hasta, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(ganancia, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
  window.setTimeout(() => void ctx.close(), 260);
}

/* ------------------------------------------------------------------ */

interface PalabraRender {
  id: number;
  texto: string;
}
/** El poder volando desde donde murió la palabra hasta la nave. */
interface Viaje {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ms: number;
}
/* La mejora recién elegida se revela un instante sobre la nave — la carta
   "vuela" a la nave antes de quedar en la fila del HUD. */
interface Revelado {
  id: number;
  powerup: MejoraId;
}
interface Chispa {
  id: number;
  x: number;
  y: number;
  color: string;
}
interface Rayo {
  id: number;
  x: number;
  y: number;
  largo: number;
  angulo: number;
}
interface Aviso {
  id: number;
  texto: string;
  color: string;
}

type FasePantalla = "cuenta" | "jugando" | "resultado";

/* Lo que falta escribir se dibuja como HTML para poder PINTAR las
   mayúsculas: cada letra que necesita Shift va en <em>, que el CSS pinta
   dorada. Se escapa antes — la banda de símbolos trae < > &. */
function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function marcarMayusculas(s: string): string {
  return escaparHtml(s).replace(/[A-ZÁÉÍÓÚÜÑ]/g, (c) => `<em>${c}</em>`);
}

/* Las mejoras, como las lee un chico: nombre corto y qué cambia en UNA
   frase, para el nivel al que pasarías. */
const NOMBRE_MEJORA: Record<MejoraId, string> = {
  bala: "Bala extra",
  segunda: "Segunda oportunidad",
  vida: "+1 vida",
  regeneracion: "Regeneración",
  escudo: "Escudo latente",
  critico: "Golpe crítico",
  viento: "Viento a favor",
  foco: "Foco",
  onda: "Onda de choque",
  congelar: "Congelar al errar",
  iman: "Imán",
  racha: "Racha blindada",
  teclas: "Teclas difíciles",
};
const DESCRIPCION_MEJORA: Record<MejoraId, (nivel: number) => string> = {
  bala: (n) => `Al destruir una palabra caen también ${n === 1 ? "la más urgente" : `las ${n} más urgentes`}.`,
  segunda: () => "Una vez: al perder el último corazón, seguís con uno.",
  vida: () => "Un corazón más, ahora y en el máximo.",
  regeneracion: (n) => `Si te falta un corazón, vuelve cada ${[30, 20, 12][n - 1] ?? 12} segundos.`,
  escudo: (n) => `Tras ${[20, 12, 8][n - 1] ?? 8} segundos sin daño se te forma un escudo.`,
  critico: (n) => `Una palabra sin errores tiene ${[15, 30, 45][n - 1] ?? 45} % de tirar otra.`,
  viento: (n) => `Las palabras viajan un ${[8, 15, 20][n - 1] ?? 20} % más lento.`,
  foco: (n) => (n === 1 ? "La más urgente siempre marcada y apuntada sola." : "También se marca la segunda."),
  onda: (n) =>
    n === 1 ? "Al subir de nivel, todo retrocede." : `Además, todo retrocede cada ${n === 2 ? 12 : 8} palabras.`,
  congelar: (n) => `Un error congela todo ${[0.5, 0.8, 1.2][n - 1] ?? 1.2} s (cada 12 s).`,
  iman: (n) => `Al destruir, las cercanas retroceden ${[5, 10, 15][n - 1] ?? 15} %.`,
  racha: (n) => `${n} error${n > 1 ? "es" : ""} por nivel sin perder la racha.`,
  teclas: (n) => `Puntos ×${[1.5, 2, 2.5][n - 1] ?? 2.5} por mayúsculas, tildes y símbolos.`,
};

export function TormentaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* Banda máxima desbloqueada por el modo historia: el corpus del arcade
     es "lo aprendido y un poco más allá", nunca símbolos jamás vistos. */
  /* Atajo de desarrollo: ?banda=8 fuerza la banda máxima (0-10) para
     probar símbolos, correos o mensajes sin pasarse cinco islas antes.
     Solo en dev: en producción la condición es constante false. */
  const bandaForzada = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    const q = new URLSearchParams(window.location.search);
    if (!q.has("banda")) return null;
    const n = Number(q.get("banda"));
    return Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : null;
  }, []);

  const bandaMax = useMemo(() => {
    if (bandaForzada !== null) return bandaForzada;
    const total = getTotalStars();
    const requisitos = getWorldStarRequirements();
    const abiertos = new Set(WORLD_PEDAGOGY_ORDER.filter((id) => total >= (requisitos[id] ?? 0)));
    return bandaMaxDesbloqueada(abiertos);
  }, [bandaForzada]);

  const perfil = useMemo(() => perfilLocal(), []);
  const estela = colorEstela(perfil?.equipped.trail);
  const rayoColor = colorRayo(perfil?.equipped.beam);

  const [fase, setFase] = useState<FasePantalla>("cuenta");
  const [cuenta, setCuenta] = useState(3);
  const [palabras, setPalabras] = useState<PalabraRender[]>([]);
  const [corazones, setCorazones] = useState(3);
  const [escudo, setEscudo] = useState(0);
  const [puntaje, setPuntaje] = useState(0);
  const [hud, setHud] = useState<{
    ppm: number;
    racha: number;
    amenaza: number;
    cristales: number;
    prueba: boolean;
    nivel: number;
    /** Puntaje / umbral del próximo nivel, 0..1. */
    progresoNivel: number;
    mejoras: { id: MejoraId; nivel: number }[];
    /** Segundos hasta que Congelar vuelva a estar listo (0 = listo). */
    congelarRestante: number;
  }>({
    ppm: 0,
    racha: 0,
    amenaza: 2,
    cristales: 0,
    prueba: false,
    nivel: 0,
    progresoNivel: 0,
    mejoras: [],
    congelarRestante: 0,
  });
  const [chispas, setChispas] = useState<Chispa[]>([]);
  const [rayos, setRayos] = useState<Rayo[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cadaveres, setCadaveres] = useState<Cadaver[]>([]);
  /* Las tres cartas ofrecidas al subir de nivel (el motor está en pausa
     mientras existan). El ref las espeja para el atajo de teclado 1-2-3. */
  const [cartas, setCartas] = useState<CartaMejora[] | null>(null);
  const cartasRef = useRef<CartaMejora[] | null>(null);
  const [nivelActual, setNivelActual] = useState(0);
  const [revelado, setRevelado] = useState<Revelado | null>(null);
  const [erroneaId, setErroneaId] = useState<number | null>(null);
  const [resultado, setResultado] = useState<ResultadoPartida | null>(null);
  const [respuestaServidor, setRespuestaServidor] = useState<ArcadeRunResponse | null>(null);
  const [sonido, setSonido] = useState(() => localStorage.getItem(SONIDO_KEY) === "1");

  const motorRef = useRef<MotorTormenta | null>(null);
  const escenaRef = useRef<HTMLDivElement | null>(null);
  const fondoRef = useRef<HTMLDivElement | null>(null);
  const palabraEls = useRef(new Map<number, HTMLElement>());
  /* Dónde murió cada palabra (en % de la escena): el poder despega de ahí. */
  const ultimaPos = useRef(new Map<number, { x: number; y: number }>());
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;
  const efectoIds = useRef(1);

  /* ---------------------------------------------------------------- */
  /* Cuenta regresiva → motor nuevo                                    */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (fase !== "cuenta") return;
    if (cuenta === 0) {
      motorRef.current = new MotorTormenta({ bandaMax });
      setFase("jugando");
      return;
    }
    const t = window.setTimeout(() => setCuenta((c) => c - 1), 900);
    return () => window.clearTimeout(t);
  }, [fase, cuenta, bandaMax]);

  function otraVez() {
    motorRef.current = null;
    palabraEls.current.clear();
    setPalabras([]);
    setCorazones(3);
    setEscudo(0);
    setPuntaje(0);
    setHud({
      ppm: 0,
      racha: 0,
      amenaza: 2,
      cristales: 0,
      prueba: false,
      nivel: 0,
      progresoNivel: 0,
      mejoras: [],
      congelarRestante: 0,
    });
    setChispas([]);
    setRayos([]);
    setCadaveres([]);
    setCartas(null);
    cartasRef.current = null;
    setNivelActual(0);
    setAvisos([]);
    setRevelado(null);
    ultimaPos.current.clear();
    setResultado(null);
    setRespuestaServidor(null);
    setCuenta(3);
    setFase("cuenta");
  }

  /* ---------------------------------------------------------------- */
  /* Eventos del motor → React (solo lo discreto)                      */
  /* ---------------------------------------------------------------- */
  const procesarEventos = useCallback(
    (eventos: EventoMotor[]) => {
      if (!eventos.length) return;
      const motor = motorRef.current;
      if (!motor) return;

      /* Deja un cadáver donde estaba la palabra: mismo lugar, misma
         escala, mismo texto, y las letras salen volando. Hay que llamarlo
         ANTES de borrar el elemento del mapa, que es de donde sale todo. */
      /* Un aviso corto sobre la nave, como los de antes: se apila hasta
         tres y se va solo. */
      const avisar = (texto: string, color: string) => {
        const idAviso = efectoIds.current++;
        setAvisos((prev) => [...prev.slice(-2), { id: idAviso, texto, color }]);
        window.setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== idAviso)), 1500);
      };

      const enterrar = (id: number, color: string, impacto: boolean) => {
        const el = palabraEls.current.get(id);
        const escena = escenaRef.current;
        if (!el || !escena) return;
        const r = el.getBoundingClientRect();
        const e = escena.getBoundingClientRect();
        const x = ((r.left + r.width / 2 - e.left) / e.width) * 100;
        const y = ((r.top + r.height / 2 - e.top) / e.height) * 100;
        const escala = Number(/scale\(([\d.]+)\)/.exec(el.style.transform)?.[1] ?? 1);
        const idCad = efectoIds.current++;
        setCadaveres((prev) => [
          ...prev,
          { id: idCad, x, y, escala, color, impacto, letras: letrasQueVuelan(el.textContent ?? "", impacto) },
        ]);
        window.setTimeout(() => setCadaveres((prev) => prev.filter((c) => c.id !== idCad)), 900);
      };

      for (const ev of eventos) {
        switch (ev.tipo) {
          case "nace":
            setPalabras((prev) => [
              ...prev,
              { id: ev.palabra.id, texto: ev.palabra.texto },
            ]);
            break;
          case "destruida": {
            /* Lo que cayó por bala se desarma en dorado, por crítico en
               violeta: se ve de qué murió sin leer nada. */
            const colorVia =
              ev.via === "bala" ? "#ffd552" : ev.via === "critico" ? "#9b7cff" : "#5be8ba";
            enterrar(ev.id, colorVia, false);
            const el = palabraEls.current.get(ev.id);
            const escena = escenaRef.current;
            if (el && escena) {
              const r = el.getBoundingClientRect();
              const e = escena.getBoundingClientRect();
              const x = ((r.left + r.width / 2 - e.left) / e.width) * 100;
              const y = ((r.top + r.height / 2 - e.top) / e.height) * 100;
              ultimaPos.current.set(ev.id, { x, y });
              const idBoom = efectoIds.current++;
              setChispas((prev) => [
                ...prev,
                { id: idBoom, x, y, color: ev.via === "tipeo" ? rayoColor : colorVia },
              ]);
              window.setTimeout(
                () => setChispas((prev) => prev.filter((c) => c.id !== idBoom)),
                460,
              );
              /* El rayo sale de la nave hacia la palabra. */
              const nx = 50;
              const ny = NAVE_Y - 4;
              const dx = ((x - nx) / 100) * e.width;
              const dy = ((y - ny) / 100) * e.height;
              const idRayo = efectoIds.current++;
              setRayos((prev) => [
                ...prev,
                {
                  id: idRayo,
                  x: nx,
                  y: ny,
                  largo: Math.hypot(dx, dy),
                  angulo: (Math.atan2(dy, dx) * 180) / Math.PI,
                },
              ]);
              window.setTimeout(() => setRayos((prev) => prev.filter((l) => l.id !== idRayo)), 200);
            }
            palabraEls.current.delete(ev.id);
            setPalabras((prev) => prev.filter((p) => p.id !== ev.id));
            setPuntaje(motor.puntaje);
            if (sonidoRef.current) blip(620, 980);
            break;
          }
          case "subeNivel": {
            /* El motor ya está en pausa: las cartas quedan hasta elegir. */
            ultimaPos.current.clear();
            cartasRef.current = ev.cartas;
            setCartas(ev.cartas);
            setNivelActual(ev.nivel);
            if (sonidoRef.current) blip(740, 1180, 0.06);
            break;
          }
          case "mejoraElegida": {
            cartasRef.current = null;
            setCartas(null);
            /* La gema elegida se revela sobre la nave y después vive en la
               fila de la build del HUD. */
            const idRev = efectoIds.current++;
            setRevelado({ id: idRev, powerup: ev.id });
            window.setTimeout(
              () => setRevelado((prev) => (prev?.id === idRev ? null : prev)),
              1000,
            );
            avisar(`${NOMBRE_MEJORA[ev.id]}${ev.nivel > 1 ? ` · nivel ${ev.nivel}` : ""}`, COLOR_DE_MEJORA[ev.id]);
            setCorazones(motor.corazones);
            setEscudo(motor.escudo);
            if (sonidoRef.current) blip(620, 980);
            break;
          }
          case "regenera":
            setCorazones(ev.corazones);
            avisar("¡Corazón recuperado!", "#ff9fca");
            break;
          case "escudoFormado":
            setEscudo(ev.escudo);
            avisar("¡Escudo!", "#54e8c6");
            break;
          case "segundaOportunidad":
            setCorazones(motor.corazones);
            avisar("¡Segunda oportunidad!", "#ffd552");
            if (sonidoRef.current) blip(740, 1180, 0.06);
            break;
          case "onda": {
            /* Un anillo que sale de la nave y empuja todo: la escena lo
               lleva como clase un instante. */
            const escena = escenaRef.current;
            if (escena) {
              escena.classList.remove("orb-escena--onda");
              void escena.offsetWidth;
              escena.classList.add("orb-escena--onda");
              window.setTimeout(() => escena.classList.remove("orb-escena--onda"), 900);
            }
            avisar("¡Onda de choque!", "#25c8df");
            break;
          }
          case "congela":
            avisar("¡Congelado!", "#cfeeff");
            break;
          case "roce": {
            /* Vuelo de prueba: la palabra llegó pero no lastima. Se disuelve
               en gris, sin sonido de golpe — la medición terminó, nada más. */
            const el = palabraEls.current.get(ev.id);
            const escena = escenaRef.current;
            if (el && escena) {
              const r = el.getBoundingClientRect();
              const e = escena.getBoundingClientRect();
              const idBoom = efectoIds.current++;
              setChispas((prev) => [
                ...prev,
                {
                  id: idBoom,
                  x: ((r.left + r.width / 2 - e.left) / e.width) * 100,
                  y: ((r.top + r.height / 2 - e.top) / e.height) * 100,
                  color: "#8fa4cc",
                },
              ]);
              window.setTimeout(
                () => setChispas((prev) => prev.filter((c) => c.id !== idBoom)),
                460,
              );
            }
            palabraEls.current.delete(ev.id);
            setPalabras((prev) => prev.filter((p) => p.id !== ev.id));
            break;
          }
          case "rebote":
            /* Llegó en plena invulnerabilidad: no lastima, pero se va. Se
               desarma en gris, sin sonido de golpe. */
            enterrar(ev.id, "#8fa4cc", true);
            palabraEls.current.delete(ev.id);
            setPalabras((prev) => prev.filter((p) => p.id !== ev.id));
            break;
          case "impacto":
            enterrar(ev.id, "#ff8fa8", true);
            palabraEls.current.delete(ev.id);
            setPalabras((prev) => prev.filter((p) => p.id !== ev.id));
            setCorazones(motor.corazones);
            setEscudo(motor.escudo);
            if (sonidoRef.current) blip(170, 90, 0.07);
            break;
          case "error":
            setErroneaId(ev.id);
            window.setTimeout(() => setErroneaId(null), 240);
            if (sonidoRef.current) blip(200, 140, 0.04);
            break;
          case "fin": {
            setResultado(ev.resultado);
            setFase("resultado");
            /* Guardado local instantáneo + cola al servidor (si aplica). */
            void registrarPartida(ev.resultado, user?.role).then((res) => {
              if (res) setRespuestaServidor(res);
            });
            break;
          }
          default:
            break;
        }
      }
    },
    [rayoColor, user?.role],
  );

  /* ---------------------------------------------------------------- */
  /* Bucle rAF: tick del motor + estilos imperativos                   */
  /* ---------------------------------------------------------------- */
  /* Gancho de verificación, SOLO en desarrollo: con ?bot=1 el bucle corre
     por setInterval en vez de rAF, así una pestaña oculta (el panel de
     preview del agente, una ventana de test) puede jugar la partida. En
     producción la condición es constante false y el bundler la elimina —
     y la pausa real de aula (rAF se frena con la pestaña oculta) queda
     intacta para todo el mundo. */
  const modoBot =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("bot");
  /* ?bot=4 corre el reloj del juego a 4x: una partida entera entra en ~30 s
     de pared, antes de que el cliente de Vite (con la pestaña estrangulada)
     pierda el websocket y recargue la página a mitad de la prueba. */
  const botVelocidad = modoBot
    ? Math.max(1, Number(new URLSearchParams(window.location.search).get("bot")) || 1)
    : 1;

  useEffect(() => {
    if (fase !== "jugando") return;
    let raf = 0;
    let intervalo: number | null = null;
    let antes = performance.now();
    let acumuladorHud = 0;

    /* Un paso de simulación con dt explícito. El camino normal (rAF) le
       pasa el dt del frame; el modo bot lo llama en pasos fijos. */
    const paso = (dt: number) => {
      const motor = motorRef.current;
      if (!motor) return;

      procesarEventos(motor.tick(dt));
      if (motor.terminada) {
        if (intervalo !== null) window.clearInterval(intervalo);
        return;
      }

      /* Palabras: transform imperativo, prefijo escrito, estados. */
      const enganche = motor.engancheId;
      /* Foco: la más urgente siempre marcada. */
      const masUrgente =
        motor.nivelDe("foco") > 0
          ? [...motor.vivas].sort((a, b) => b.progreso - a.progreso)[0]?.id ?? null
          : null;
      /* El rectángulo de la escena se lee UNA vez, antes de escribir
         estilos: leerlo dentro del bucle forzaría un layout por palabra. */
      const escenaRect = escenaRef.current?.getBoundingClientRect();
      let hayPeligro = false;
      for (const p of motor.vivas) {
        const el = palabraEls.current.get(p.id);
        if (!el) continue;
        const pos = posicionDe(p.carril, p.progreso);
        el.style.left = `${pos.x}%`;
        el.style.top = `${pos.y}%`;
        el.style.transform = `translate(-50%, -50%) scale(${pos.escala.toFixed(3)})`;
        /* Cercanía al cuadrado: las lejanas vienen quietas y el tambaleo
           arranca en el último tramo, cuando ya es una amenaza. */
        el.style.setProperty("--orb-cerca", (p.progreso * p.progreso).toFixed(3));
        if (escenaRect) {
          /* La estela apunta CONTRA LA VELOCIDAD, no hacia el punto de fuga
             como lugar: las palabras nacen ya desplegadas a lo ancho a la
             altura de la fuga, así que "hacia la fuga" al nacer sería una
             cola horizontal. La velocidad sale de derivar posicionDe():
             en x se cierra hacia el centro, en y baja de FUGA_Y a la nave.
             El elemento "mira" hacia abajo (+y); rotarlo θ lo deja
             apuntando a (−sin θ, cos θ), que tiene que ser ese versor. */
          const bx = (escenaRect.width * (p.carril * ABANICO_X * 0.72)) / 100;
          const by = (escenaRect.height * -(NAVE_Y - 6 - FUGA_Y)) / 100;
          const ang = (Math.atan2(-bx, by) * 180) / Math.PI;
          el.style.setProperty("--orb-cola-ang", `${ang.toFixed(1)}deg`);
        }
        const hecho = el.querySelector(".orb-palabra__hecho");
        const resto = el.querySelector(".orb-palabra__resto");
        if (hecho && resto) {
          /* Se compara contra el DOM real, no contra una marca propia: si
             React vuelve a escribir el span (re-render por otra prop), la
             marca mentiría y quedaría el prefijo con el resto entero —
             "¿C¿Cómo estás?". Son ≤8 palabras: comparar es gratis.
             El prefijo también marca mayúsculas: si no, la M grande de
             "Mundo" se achicaría en el instante de tipearla. */
          const hechoHtml = marcarMayusculas(p.texto.slice(0, p.escrito));
          const restoHtml = marcarMayusculas(p.texto.slice(p.escrito));
          if (hecho.innerHTML !== hechoHtml) hecho.innerHTML = hechoHtml;
          if (resto.innerHTML !== restoHtml) resto.innerHTML = restoHtml;
        }
        const peligro = p.progreso > 0.72;
        if (peligro) hayPeligro = true;
        el.classList.toggle("orb-palabra--enganchada", p.id === enganche);
        el.classList.toggle("orb-palabra--peligro", peligro);
        el.classList.toggle("orb-palabra--mira", p.id === masUrgente);
      }
      escenaRef.current?.classList.toggle("orb-escena--peligro", hayPeligro);
      /* Congelar al errar: escarcha sobre la escena mientras nada avanza. */
      escenaRef.current?.classList.toggle("orb-escena--congelada", motor.congelado);

      /* HUD y tinte, a ~3 Hz — no hace falta más y ahorra renders. */
      acumuladorHud += dt;
      if (acumuladorHud > 350) {
        acumuladorHud = 0;
        const { puntaje: pts, umbral } = motor.progresoNivel;
        setHud({
          ppm: Math.round(motor.ppmInstantaneo),
          racha: motor.racha,
          amenaza: Math.round(motor.amenaza),
          cristales: motor.cristalesVivos,
          prueba: motor.fase === "calibracion",
          nivel: motor.nivel,
          progresoNivel: umbral > 0 ? Math.min(1, pts / umbral) : 0,
          mejoras: motor.mejorasLista,
          congelarRestante: motor.congelarRestante,
        });
        const fondo = fondoRef.current;
        if (fondo) {
          fondo.style.setProperty("--orb-tinte", tinteDeAmenaza(motor.amenaza));
          fondo.style.setProperty(
            "--orb-tinte-fuerza",
            (0.5 + (motor.amenaza / 100) * 0.5).toFixed(2),
          );
        }
      }

    };

    const cuadro = (ahora: number) => {
      const dt = ahora - antes;
      antes = ahora;
      paso(dt);
      const m = motorRef.current;
      if (m && !m.terminada) raf = requestAnimationFrame(cuadro);
    };

    if (modoBot) {
      /* En pestaña oculta el navegador estrangula los timers a ~1 disparo
         por segundo. Para que el juego avance a velocidad real igual, cada
         disparo PAGA la deuda de tiempo acumulada en pasos fijos de 50 ms
         (con tope de 2 s por si la pestaña durmió de más). */
      intervalo = window.setInterval(() => {
        const ahora = performance.now();
        let deuda = Math.min((ahora - antes) * botVelocidad, 4000);
        antes = ahora;
        while (deuda > 0) {
          paso(Math.min(deuda, 50));
          deuda -= 50;
          const m = motorRef.current;
          if (!m || m.terminada) break;
        }
      }, 100);
    } else {
      raf = requestAnimationFrame(cuadro);
    }
    /* Al volver de un fondo largo, el reloj arranca de cero: el clamp del
       motor ya recorta, esto evita hasta el primer frame gigante. */
    const alVolver = () => {
      antes = performance.now();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelAnimationFrame(raf);
      if (intervalo !== null) window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [fase, procesarEventos]);

  /* ---------------------------------------------------------------- */
  /* Entrada — la misma tubería que GameplayPage: input oculto +        */
  /* beforeinput/composición para que á, ñ y ¿ lleguen COMPUESTOS.      */
  /* ---------------------------------------------------------------- */
  const procesarCaracter = useCallback(
    (ch: string) => {
      const motor = motorRef.current;
      if (!motor || fase !== "jugando") return;
      procesarEventos(motor.tecla(ch));
    },
    [fase, procesarEventos],
  );

  /** Elegir una carta: por tecla 1-2-3 o tocándola. El motor rechaza lo
   *  que no ofreció, así que acá no hace falta validar. */
  const elegirMejora = useCallback(
    (id: MejoraId) => {
      const motor = motorRef.current;
      if (!motor) return;
      procesarEventos(motor.elegir(id));
    },
    [procesarEventos],
  );

  /* Compañero del ?bot=1: en desarrollo la entrada queda expuesta para que
     una prueba automatizada tipee por el MISMO camino que el teclado (el
     panel de preview corre oculto y ahí los eventos de teclado reales no
     llegan). No existe en producción. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as {
      __tormentaTecla?: (ch: string) => void;
      __tormentaVivas?: () => { texto: string; escrito: number; progreso: number }[];
    };
    w.__tormentaTecla = procesarCaracter;
    /* La lista viva del MOTOR, no del DOM: un bot que lee el DOM entre dos
       pintadas de React tipea letras de palabras que ya murieron. */
    w.__tormentaVivas = () =>
      (motorRef.current?.vivas ?? []).map((p) => ({
        texto: p.texto,
        escrito: p.escrito,
        progreso: p.progreso,
      }));
    return () => {
      delete w.__tormentaTecla;
      delete w.__tormentaVivas;
    };
  }, [procesarCaracter]);

  useEffect(() => {
    const input = captureInputRef.current;
    if (!input || fase !== "jugando") return;

    function onBeforeInput(this: HTMLInputElement, ev: Event) {
      const native = ev as InputEvent;
      const type = native.inputType;
      if (type === "deleteContentBackward" || type === "deleteContentForward") {
        /* Backspace no hace nada en Órbita: no hay buffer que corregir. */
        ev.preventDefault();
        input!.value = "";
        return;
      }
      if (type && type.startsWith("insert")) {
        const data = native.data ?? "";
        if (data && data !== "´" && data !== "`" && data !== "^" && data !== "~" && data !== "¨") {
          for (const ch of data) procesarCaracter(ch);
        }
        window.setTimeout(() => {
          if (input) input.value = "";
        }, 0);
        ev.preventDefault();
      }
    }
    function onCompositionEnd(this: HTMLInputElement, ev: CompositionEvent) {
      const data = ev.data ?? "";
      if (data) for (const ch of data) procesarCaracter(ch);
      window.setTimeout(() => {
        if (input) input.value = "";
      }, 0);
    }
    function refocus() {
      window.setTimeout(() => {
        const a = document.activeElement;
        if (a && a.tagName === "BUTTON") return;
        input?.focus({ preventScroll: true });
      }, 0);
    }

    input.addEventListener("beforeinput", onBeforeInput as EventListener);
    input.addEventListener("compositionend", onCompositionEnd as EventListener);
    input.focus({ preventScroll: true });
    window.addEventListener("pointerdown", refocus);
    return () => {
      input.removeEventListener("beforeinput", onBeforeInput as EventListener);
      input.removeEventListener("compositionend", onCompositionEnd as EventListener);
      window.removeEventListener("pointerdown", refocus);
    };
  }, [fase, procesarCaracter]);

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (fase !== "jugando") return;
      /* Con cartas en pantalla, 1-2-3 eligen y nada más se procesa. */
      if (cartasRef.current) {
        if (/^[123]$/.test(ev.key)) {
          ev.preventDefault();
          const carta = cartasRef.current[Number(ev.key) - 1];
          if (carta) elegirMejora(carta.id);
        }
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        const motor = motorRef.current;
        if (motor) procesarEventos(motor.escape());
        return;
      }
      if (ev.key === "Backspace") {
        ev.preventDefault();
        return;
      }
      /* Respaldo si el input oculto perdió el foco (mismo caso que en
         GameplayPage): el carácter simple se procesa igual. */
      const active = document.activeElement;
      if (active !== captureInputRef.current && !ev.isComposing && ev.key.length === 1) {
        const esAltGr = ev.ctrlKey && ev.altKey;
        if (!esAltGr && (ev.ctrlKey || ev.metaKey)) return;
        ev.preventDefault();
        procesarCaracter(ev.key);
        captureInputRef.current?.focus({ preventScroll: true });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fase, procesarCaracter, procesarEventos, elegirMejora]);

  /* ---------------------------------------------------------------- */

  const rango = RANGOS.find((r) => r.id === (resultado?.rango ?? "cadete"))!;
  const record = recordLocal();
  const sincroniza = sincronizaArcade(user?.role);

  return (
    <main className="relative h-dvh overflow-hidden select-none" aria-label="Tormenta de palabras">
      {/* Fondo por capas — el tinte lo maneja el rAF con la amenaza. */}
      <div
        ref={fondoRef}
        className="orb-fondo"
        style={
          {
            "--orb-nebulosa": "url(/assets/orbita/fondo/nebulosa.webp)",
            "--orb-horizonte": "url(/assets/orbita/fondo/horizonte.webp)",
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <img className="orb-estrellas" src="/assets/orbita/fondo/estrellas.webp" alt="" />
        <div className="orb-tinte" />
        {/* El mundo de las islas, abajo de la nave. Hasta que el WebP exista
            (se genera aparte, ORBITA.md §7.1) se oculta solo. */}
        <img
          className="orb-horizonte"
          src="/assets/orbita/fondo/horizonte.webp"
          alt=""
          onError={(e) => {
            /* Si la imagen no está, se van las DOS capas: la de tinte sin
               máscara sería un rectángulo de color tapando la escena. */
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.setAttribute("style", "display:none");
          }}
        />
        <div className="orb-horizonte-tinte" />
        <img className="orb-polvo" src="/assets/orbita/fondo/polvo.webp" alt="" />
      </div>

      {/* Input oculto: el mismo truco de GameplayPage para teclas muertas. */}
      <input
        ref={captureInputRef}
        className="absolute opacity-0 w-px h-px -z-10"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Escena */}
      <div ref={escenaRef} className="absolute inset-0">
        {palabras.map((p) => (
          <span
            key={p.id}
            ref={(el) => {
              if (el) {
                palabraEls.current.set(p.id, el);
                /* El texto lo escribe el bucle, no React: si React fuera el
                   dueño del span (dangerouslySetInnerHTML), lo volvería a
                   pisar en cada re-render y el resto de la palabra
                   parpadearía entero hasta el frame siguiente. Se llena
                   acá, al montar, para que no haya un frame en blanco. */
                const resto = el.querySelector(".orb-palabra__resto");
                if (resto && !resto.innerHTML) resto.innerHTML = marcarMayusculas(p.texto);
              } else {
                palabraEls.current.delete(p.id);
              }
            }}
            className={[
              "orb-palabra",
              erroneaId === p.id ? "orb-palabra--error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ fontSize: "2rem" }}
          >
            <i className="orb-palabra__cola" aria-hidden="true" />
            <span className="orb-palabra__cuerpo">
              <b className="orb-palabra__hecho" />
              <span className="orb-palabra__resto" />
            </span>
          </span>
        ))}

        {/* Las que acaban de morir, desarmándose letra por letra. */}
        {cadaveres.map((c) => (
          <span
            key={c.id}
            className="orb-cadaver"
            aria-hidden="true"
            style={
              {
                left: `${c.x}%`,
                top: `${c.y}%`,
                fontSize: "2rem",
                "--orb-esc": c.escala,
                "--orb-cad-color": c.color,
              } as React.CSSProperties
            }
          >
            {c.letras.map((l, i) => (
              <i
                key={i}
                className={l.mayus ? "orb-cadaver__mayus" : undefined}
                style={
                  {
                    "--orb-dx": `${l.dx}px`,
                    "--orb-dy": `${l.dy}px`,
                    "--orb-rot": `${l.rot}deg`,
                    "--orb-d": `${l.d}ms`,
                  } as React.CSSProperties
                }
              >
                {l.ch === " " ? " " : l.ch}
              </i>
            ))}
          </span>
        ))}


        {/* Fogonazo + cuatro chispas de cuatro puntas (los <i> son las chispas). */}
        {chispas.map((c) => (
          <span
            key={c.id}
            className="orb-explosion"
            style={{ left: `${c.x}%`, top: `${c.y}%`, "--orb-boom-color": c.color } as React.CSSProperties}
          >
            <i />
            <i />
            <i />
            <i />
          </span>
        ))}
        {rayos.map((l) => (
          <span
            key={l.id}
            className="orb-rayo"
            style={
              {
                left: `${l.x}%`,
                top: `${l.y}%`,
                width: `${l.largo}px`,
                transform: `rotate(${l.angulo}deg)`,
                "--orb-rayo-color": rayoColor,
              } as React.CSSProperties
            }
          />
        ))}

        {/* La nave del chico — la que se ganó con estrellas. */}
        <div className="orb-nave">
          {estela && (
            <span
              className="orb-estela"
              style={{ "--orb-estela-color": estela } as React.CSSProperties}
            />
          )}
          {escudo > 0 && (
            <span className={`orb-escudo-aro ${escudo > 1 ? "orb-escudo-aro--doble" : ""}`} />
          )}
          <CharacterSkin kind="ship" alt="Tu nave" />
          {/* Recién acá se sabe qué era: la gema explota sobre la nave. */}
          {revelado && (
            <span
              key={revelado.id}
              className="orb-revelado"
              style={{ color: COLOR_DE_MEJORA[revelado.powerup] }}
            >
              <Gema nombre={revelado.powerup} className="w-full h-full" />
            </span>
          )}
          <div className="absolute left-1/2 -translate-x-1/2 -top-10 grid gap-1 justify-items-center">
            {avisos.map((a) => (
              <span
                key={a.id}
                className="orb-aviso font-bold text-base"
                style={
                  {
                    "--orb-aviso-color": a.color,
                    fontFamily: "var(--font-display)",
                  } as React.CSSProperties
                }
              >
                {a.texto}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* HUD — texto suelto con halo, nunca tarjetas. */}
      <div className="orb-hud">
        <div className="left-4 top-3 flex items-center gap-1.5" style={{ pointerEvents: "auto" }}>
          <button
            type="button"
            onClick={() => navigate("/orbita")}
            className="orb-dato mr-2 grid place-items-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-0 text-inherit"
            aria-label="Salir de la partida"
          >
            <ArrowLeft size={20} />
          </button>
          {[1, 2, 3].map((n) => (
            <IconoOrbita
              key={n}
              nombre={n <= corazones ? "corazon-lleno" : "corazon-vacio"}
              className="w-7 h-7"
              style={{ color: n <= corazones ? "#ff7d94" : "rgba(184, 192, 232, 0.8)" }}
              titulo={n <= corazones ? "Vida" : "Vida perdida"}
            />
          ))}
          {Array.from({ length: escudo }, (_, i) => (
            <IconoOrbita
              key={`e${i}`}
              nombre="escudo-entero"
              className="w-6 h-6 ml-1"
              style={{ color: "#54e8c6" }}
              titulo="Escudo"
            />
          ))}
        </div>

        <div className="left-1/2 top-3 -translate-x-1/2 text-center">
          <div className="orb-dato font-extrabold text-4xl leading-none tabular-nums">
            {puntaje.toLocaleString("es-AR")}
          </div>
          {hud.racha >= 3 && (
            <div className="orb-dato text-sm font-bold mt-0.5" style={{ color: "#ffd552" }}>
              racha ×{Math.min(4, 1 + 0.5 * Math.floor(hud.racha / 3)).toFixed(1).replace(".0", "")}
            </div>
          )}
          {/* Cuánto falta para la próxima carta: una barrita bajo el puntaje. */}
          {!hud.prueba && (
            <div className="orb-nivel" aria-label={`Nivel ${hud.nivel}`}>
              <span className="orb-dato orb-nivel__rotulo">nivel {hud.nivel}</span>
              <span className="orb-nivel__riel">
                <i style={{ width: `${Math.round(hud.progresoNivel * 100)}%` }} />
              </span>
            </div>
          )}
        </div>

        {/* La build: las gemas que llevás, con su nivel. Congelar muestra
            además su cooldown como un anillo que se va llenando. */}
        {hud.mejoras.length > 0 && (
          <div className="left-4 bottom-4 orb-build" aria-label="Tus mejoras">
            {hud.mejoras.map((m) => {
              const enCooldown = m.id === "congelar" && hud.congelarRestante > 0;
              const fraccion = enCooldown ? 1 - hud.congelarRestante / 12 : 1;
              return (
                <span
                  key={m.id}
                  className={`orb-build__gema ${enCooldown ? "orb-build__gema--cooldown" : ""}`}
                  style={{ "--orb-cd": `${Math.round(fraccion * 360)}deg` } as React.CSSProperties}
                  title={`${NOMBRE_MEJORA[m.id]} · nivel ${m.nivel}`}
                >
                  <Gema nombre={m.id} className="w-9 h-9" />
                  <span className="orb-build__puntos" aria-hidden="true">
                    {Array.from({ length: m.nivel }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        <div className="right-8 top-3 text-right grid gap-0.5 justify-items-end">
          <div className="orb-dato font-bold text-xl flex items-center gap-1.5">
            <IconoOrbita nombre="cristal" className="w-5 h-5" style={{ color: "#9b7cff" }} />
            <span className="tabular-nums">{hud.cristales}</span>
          </div>
          <div className="orb-dato font-bold text-xl tabular-nums" style={{ color: "#5be8ba" }}>
            {hud.ppm} PPM
          </div>
          <button
            type="button"
            onClick={() => {
              const nuevo = !sonido;
              setSonido(nuevo);
              localStorage.setItem(SONIDO_KEY, nuevo ? "1" : "0");
            }}
            className="orb-dato mt-1 grid place-items-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-0 text-inherit"
            style={{ pointerEvents: "auto" }}
            aria-label={sonido ? "Apagar sonido" : "Prender sonido"}
          >
            {sonido ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>

        {/* El termómetro de tormenta: tubo + nube de tapa que despierta con la amenaza. */}
        <div className="orb-amenaza" aria-hidden="true">
          <i style={{ height: `${hud.amenaza}%` }} />
        </div>
        <div
          className={`orb-amenaza-nube ${
            hud.amenaza >= 70
              ? "orb-amenaza-nube--tormenta"
              : hud.amenaza >= 30
                ? "orb-amenaza-nube--media"
                : ""
          }`}
          aria-hidden="true"
        >
          <IconoOrbita
            nombre={hud.amenaza >= 70 ? "nube-tormenta" : "nube-calma"}
            className="w-full h-full"
          />
        </div>
        <div
          className="orb-dato right-7 bottom-[16%] text-xs font-bold tracking-widest uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          amenaza {hud.amenaza}
        </div>
        {bandaForzada !== null && (
          <div className="orb-dato left-4 bottom-3 text-[11px] font-bold tracking-widest uppercase opacity-70">
            dev · banda forzada {bandaForzada}
          </div>
        )}
        {/* El vuelo de prueba se anuncia: el chico tiene que saber que los
            primeros segundos son para medir y que nada lastima todavía. */}
        {hud.prueba && fase === "jugando" && (
          <div className="orb-dato left-1/2 -translate-x-1/2 bottom-[12%] text-xs font-bold tracking-widest uppercase opacity-90">
            vuelo de prueba · nada lastima todavía
          </div>
        )}
      </div>

      {corazones === 1 && fase === "jugando" && <div className="orb-vineta" aria-hidden="true" />}

      {/* Subiste de nivel: el juego está en pausa hasta que elijas. */}
      {cartas && fase === "jugando" && (
        <div className="orb-eleccion" role="dialog" aria-modal="true" aria-label="Elegí una mejora">
          <div className="orb-vidrio orb-eleccion__tarjeta">
            <p className="orb-eleccion__nivel">¡Nivel {nivelActual}!</p>
            <h2 className="orb-eleccion__titulo">Elegí una mejora</h2>
            <p className="orb-suave orb-eleccion__ayuda">Teclas 1, 2 y 3 — o tocá la carta</p>
            <div className="orb-cartas">
              {cartas.map((c, i) => {
                const proximo = c.nivelActual + 1;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`orb-carta orb-carta--${c.rareza}`}
                    onClick={() => elegirMejora(c.id)}
                  >
                    <span className="orb-carta__tecla">{i + 1}</span>
                    <span className="orb-carta__rareza">
                      {c.rareza === "comun" ? "común" : c.rareza === "rara" ? "rara" : "épica"}
                    </span>
                    <b className="orb-carta__nombre">{NOMBRE_MEJORA[c.id]}</b>
                    <span className="orb-carta__efecto">{DESCRIPCION_MEJORA[c.id](proximo)}</span>
                    <span className="orb-carta__puntos" aria-label={`nivel ${proximo}`}>
                      {[1, 2, 3].map((n) => (
                        <i key={n} className={n <= c.nivelActual ? "on" : n === proximo ? "prox" : ""} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cuenta regresiva */}
      {fase === "cuenta" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div
              key={cuenta}
              className="orb-cuenta-halo font-extrabold"
              style={{ fontSize: "clamp(5rem, 18vh, 9rem)", fontFamily: "var(--font-display)" }}
            >
              <span className={`orb-cuenta ${cuenta === 0 ? "orb-cuenta--ya" : ""}`}>
                {cuenta === 0 ? "¡YA!" : cuenta}
              </span>
            </div>
            <p className="orb-dato text-lg font-semibold mt-2">
              Escribí las palabras antes de que lleguen a tu nave
            </p>
          </div>
        </div>
      )}

      {/* Resultado — la derrota es el cronómetro, no el veredicto. La tarjeta
          es el vidrio de marca (el mismo de la pantalla de login) sobre el
          juego teñido de índigo: un ventanal, no un cartel oscuro. */}
      {fase === "resultado" && resultado && (
        <div
          className="absolute inset-0 grid place-items-center p-4"
          style={{ background: "rgba(20, 27, 77, 0.55)" }}
        >
          <section
            className="orb-vidrio w-[min(30rem,94vw)] max-h-[88vh] overflow-y-auto p-6 text-center grid gap-4"
            aria-label="Resultado de la partida"
          >
            {!(record && record.puntaje > resultado.puntaje) && (
              <div className="orb-confeti" aria-hidden="true">
                {CONFETI.map((c, i) => (
                  <i
                    key={i}
                    style={{ "--x": c.x, "--c": c.c, "--d": c.d, "--s": c.s } as React.CSSProperties}
                  />
                ))}
              </div>
            )}

            <header className="grid gap-1 justify-items-center relative">
              <InsigniaRango rango={resultado.rango} tamano="grande" className="w-28 h-28" />
              <h1
                className="font-extrabold text-2xl m-0"
                style={{ fontFamily: "var(--font-display)", color: "#17355f" }}
              >
                ¡Llegaste a {rango.nombre}!
              </h1>
              <p className="orb-suave m-0 text-sm font-semibold">
                Aguantaste {Math.round(resultado.duracionMs / 1000)} segundos · amenaza máxima{" "}
                {resultado.amenazaMax}
              </p>
            </header>

            <div
              className="font-extrabold text-5xl tabular-nums"
              style={{
                fontFamily: "var(--font-display)",
                color: "#c98a00",
                textShadow: "0 0 18px rgba(255, 213, 82, 0.45)",
              }}
            >
              {resultado.puntaje.toLocaleString("es-AR")}
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              {[
                { valor: String(resultado.ppmPico), rotulo: "PPM pico", color: "#1fb5a6" },
                { valor: `${resultado.precision}%`, rotulo: "precisión", color: "#2b9fd6" },
                { valor: String(resultado.palabras), rotulo: "palabras", color: "#d64a8a" },
              ].map((dato) => (
                <div
                  key={dato.rotulo}
                  className="rounded-2xl p-2 font-semibold"
                  style={{
                    background: "rgba(255, 255, 255, 0.72)",
                    border: "1px solid rgba(255, 255, 255, 0.92)",
                    color: "#52658f",
                  }}
                >
                  <b
                    className="block text-lg tabular-nums"
                    style={{ color: dato.color, fontFamily: "var(--font-display)" }}
                  >
                    {dato.valor}
                  </b>
                  {dato.rotulo}
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <Gema nombre="cristal" className="w-8 h-8" />
              <span>+{resultado.cristales} cristales</span>
              {respuestaServidor && !respuestaServidor.ranked && (
                <span className="orb-suave text-xs font-semibold">(partida sin ranking)</span>
              )}
            </div>

            {/* La build con la que terminaste. */}
            {resultado.mejoras.length > 0 && (
              <div className="orb-build orb-build--resultado" aria-label={`Nivel ${resultado.nivel}, tu build`}>
                <span className="orb-build__nivel">nivel {resultado.nivel}</span>
                {resultado.mejoras.map((m) => (
                  <span key={m.id} className="orb-build__gema" title={`${NOMBRE_MEJORA[m.id]} · nivel ${m.nivel}`}>
                    <Gema nombre={m.id} className="w-9 h-9" />
                    <span className="orb-build__puntos" aria-hidden="true">
                      {Array.from({ length: m.nivel }, (_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {record && record.puntaje > resultado.puntaje ? (
              <p className="orb-suave m-0 text-sm font-semibold">
                Tu récord sigue en {record.puntaje.toLocaleString("es-AR")}. ¡Cerca!
              </p>
            ) : (
              <p
                className="m-0 text-base font-extrabold"
                style={{ color: "#c98a00", fontFamily: "var(--font-display)" }}
              >
                ¡Nuevo récord personal!
              </p>
            )}

            {respuestaServidor?.positions && (
              <div className="flex justify-center gap-3 text-xs font-bold flex-wrap">
                {respuestaServidor.positions.global && (
                  <span className="orb-pildora text-xs">
                    Global #{respuestaServidor.positions.global.pos}
                  </span>
                )}
                {respuestaServidor.positions.sede && (
                  <span className="orb-pildora text-xs">
                    Tu escuela #{respuestaServidor.positions.sede.pos}
                  </span>
                )}
                {respuestaServidor.positions.grado && (
                  <span className="orb-pildora text-xs">
                    Tu grado #{respuestaServidor.positions.grado.pos}
                  </span>
                )}
              </div>
            )}
            {!sincroniza && (
              <p className="orb-suave m-0 text-xs font-semibold">
                Jugando de prueba: el puntaje no entra al ranking.
              </p>
            )}

            <div className="grid gap-2">
              <button type="button" onClick={otraVez} className="orb-boton-primario">
                <RotateCcw size={19} /> Otra vez
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/orbita/hangar" className="orb-boton-vidrio text-sm">
                  Hangar
                </Link>
                <Link to="/orbita" className="orb-boton-vidrio text-sm">
                  Volver a Órbita
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default TormentaPage;
