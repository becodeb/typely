import type { CSSProperties } from "react";
import type { EfectoCosmetico, TipoCosmetico } from "../../data/orbitaCosmeticos";

// Superan la animación CSS más larga; partida y probador retiran al terminar.
export const DURACION_RAYO_MS = 220;
export const DURACION_IMPACTO_MS = 600;

const COLORES_FIESTA = ["#ff86bb", "#ffd65a", "#6df3df", "#a694ff", "#83dbff", "#b6ff7c"];
const particula = (i: number, total = 6): CSSProperties => ({
  "--particula": i, "--fiesta-color": COLORES_FIESTA[i % COLORES_FIESTA.length],
  "--fiesta-x": `${Math.cos(i / total * Math.PI * 2) * 48}px`,
  "--fiesta-y": `${Math.sin(i / total * Math.PI * 2) * 38}px`,
} as CSSProperties);

function Caramelo() {
  return <svg viewBox="0 0 40 24" aria-hidden="true"><path d="M12 8 2 3 4 12 2 21 12 16M28 8 38 3 36 12 38 21 28 16" fill="#ff8ecb" stroke="#fff0fa" strokeWidth="1.5" /><rect x="10" y="3" width="20" height="18" rx="8" fill="#fff5fa" stroke="#ff83bd" strokeWidth="2" /><path d="m16 4-3 14m10-15-4 18m9-16-4 15" stroke="#ff70af" strokeWidth="4" /><path d="m15 7 10-1" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function Pochoclo() {
  return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 24C1 23 0 15 5 12 1 6 9 1 13 6 16-1 25 2 24 9 31 12 27 21 23 21 23 28 13 29 11 24Z" fill="#fff4ce" stroke="#e8b15c" strokeWidth="1.4" /><path d="M8 12q5-2 5 4m1-8q-2 6 4 6m-9 5q4 5 10 0" fill="none" stroke="#ffda8a" strokeWidth="3" strokeLinecap="round" /></svg>;
}

/** Los mismos efectos se usan en partida y en la vista previa de la tienda. */
export function ParticulasMotor({ efecto }: { efecto: EfectoCosmetico }) {
  if (efecto === "estrellas") return <span className="orb-motor-estrellas" aria-hidden="true">
    {Array.from({ length: 5 }, (_, i) => <b key={i} style={{ "--particula": i } as CSSProperties}>✦</b>)}
  </span>;
  if (efecto === "aurora") return <span className="orb-motor-aurora" aria-hidden="true"><b /><b /><b /></span>;
  if (efecto === "arcoiris") return <span className="orb-motor-arcoiris" aria-hidden="true">
    {COLORES_FIESTA.map((_, i) => <b key={i} style={particula(i)} />)}
  </span>;
  if (efecto === "burbujas" || efecto === "pixeles") return <span className="orb-motor-fiesta" data-efecto={efecto} aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => <b key={i} style={particula(i)} />)}
  </span>;
  return null;
}

export function RayoCosmetico({ efecto = "color", color, style }: { efecto?: EfectoCosmetico; color: string; style?: CSSProperties }) {
  const largo = typeof style?.width === "number" ? style.width
    : typeof style?.width === "string" && style.width.endsWith("px") ? parseFloat(style.width) : 160;
  const pompas = Math.min(24, Math.max(5, Math.round(largo / 24)));
  return <span className="orb-rayo" data-efecto={efecto} style={{ ...style, "--orb-rayo-color": color } as CSSProperties} aria-hidden="true">
    {efecto === "pulso" && <i className="orb-rayo-pulso" />}
    {efecto === "espiral" && <svg className="orb-rayo-espiral" viewBox="0 0 120 20" preserveAspectRatio="none">
      <path d="M0 10 Q5 0 10 10 T30 10 T50 10 T70 10 T90 10 T110 10 T130 10" />
      <path d="M0 10 Q5 20 10 10 T30 10 T50 10 T70 10 T90 10 T110 10 T130 10" />
    </svg>}
    {efecto === "relampago" && <svg className="orb-rayo-relampago" viewBox="0 0 160 24" preserveAspectRatio="none">
      <path d="M0 12 22 12 35 3 47 20 61 6 78 18 93 3 109 20 122 9 139 14 160 12" />
      <path d="m61 6 9 1 5 6m34 7 9 2 7-8" />
    </svg>}
    {efecto === "caramelo" && <i className="orb-rayo-caramelo"><Caramelo /></i>}
    {efecto === "burbujas" && <i className="orb-rayo-burbujas">
      {Array.from({ length: pompas }, (_, i) => <b key={i} style={{ ...particula(i), left: `${i / (pompas - 1) * 94}%`, top: `${3 + i % 3 * 2}px` }} />)}
    </i>}
  </span>;
}

export function ImpactoCosmetico({ efecto = "color", color, style }: { efecto?: EfectoCosmetico; color: string; style?: CSSProperties }) {
  return <span className={efecto === "color" ? "orb-explosion" : "orb-impacto"} data-efecto={efecto}
    style={{ ...style, "--orb-boom-color": color } as CSSProperties} aria-hidden="true">
    {Array.from({ length: efecto === "anillos" ? 2 : efecto === "color" ? 4 : efecto === "confeti" ? 12 : 8 }, (_, i) =>
      <i key={i} style={particula(i, efecto === "confeti" ? 12 : 8)}>{efecto === "palomitas" && <Pochoclo />}</i>)}
  </span>;
}

/** Miniaturas quietas del mismo dibujo que se anima en el probador.
 * Evita tener decenas de efectos animándose a la vez en el catálogo. */
export function MuestraEfecto({ tipo, efecto, color }: { tipo: Exclude<TipoCosmetico, "nave" | "mascota">; efecto: EfectoCosmetico; color: string }) {
  return <span className="orb-muestra-efecto" data-tipo={tipo} data-efecto={efecto}
    style={{ "--nave-motor-color": color } as CSSProperties} aria-hidden="true">
    {tipo === "estela" && <><span className="orb-muestra-efecto__motor"><i /><ParticulasMotor efecto={efecto} /></span><span className="orb-muestra-efecto__motor"><i /><ParticulasMotor efecto={efecto} /></span></>}
    {tipo === "rayo" && <RayoCosmetico efecto={efecto} color={color} style={{ left: "12%", top: "57%", width: "76%", transform: "rotate(-16deg)" }} />}
    {tipo === "impacto" && <ImpactoCosmetico efecto={efecto} color={color} style={{ left: "50%", top: "50%" }} />}
  </span>;
}
