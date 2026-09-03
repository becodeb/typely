/* Iconos del modo Órbita — los 20 SVG dibujados a mano, inlineados.
 *
 * Los archivos de `svg/` son COPIAS de `Images/orbita/{iconos,rangos}/`
 * (la fuente de verdad, que no se publica: `.dockerignore` deja `Images`
 * afuera del contenedor). Si un icono se redibuja allá, copiarlo acá.
 * Se inlinean con `?raw` en vez de servirse como archivos por dos motivos:
 * se tiñen por CSS (`currentColor`) y son chicos — 20 requests por 20
 * íconos de 1 KB sería puro overhead.
 *
 * Uso: <IconoOrbita nombre="corazon-lleno" className="w-6 h-6 text-red-400" />
 * El color lo pone `currentColor`; el tamaño, el contenedor.
 *
 * Lo que se ve GRANDE (la insignia del resultado y del podio, la gema del
 * poder que llega a la nave, el cristal del saldo) no es SVG: son objetos
 * 3D generados (`public/assets/orbita/{insignias,gemas}/`, ver ORBITA.md
 * §7). `InsigniaRango tamano="grande"` y `Gema` los cargan, y si el WebP
 * todavía no existe caen al SVG sin ruido: así el rediseño entra por
 * tandas y nada queda roto entre una y otra.
 */
import { useEffect, useState, type CSSProperties } from "react";

import corazonLleno from "./svg/corazon-lleno.svg?raw";
import corazonVacio from "./svg/corazon-vacio.svg?raw";
import escudoEntero from "./svg/escudo-entero.svg?raw";
import escudoAgrietado from "./svg/escudo-agrietado.svg?raw";
import cristal from "./svg/cristal.svg?raw";
import nubeCalma from "./svg/nube-calma.svg?raw";
import nubeTormenta from "./svg/nube-tormenta.svg?raw";
import pwReparacion from "./svg/pw-reparacion.svg?raw";
import pwEscudo from "./svg/pw-escudo.svg?raw";
import pwPulso from "./svg/pw-pulso.svg?raw";
import pwTiempo from "./svg/pw-tiempo.svg?raw";
import pwRayo from "./svg/pw-rayo.svg?raw";
import pwCosecha from "./svg/pw-cosecha.svg?raw";
import pwMira from "./svg/pw-mira.svg?raw";
import rCadete from "./svg/cadete.svg?raw";
import rPiloto from "./svg/piloto.svg?raw";
import rExplorador from "./svg/explorador.svg?raw";
import rAs from "./svg/as.svg?raw";
import rCapitan from "./svg/capitan.svg?raw";
import rLeyenda from "./svg/leyenda.svg?raw";

import type { PowerupId, RangoId } from "../../utils/orbita/motor";

const ICONOS = {
  "corazon-lleno": corazonLleno,
  "corazon-vacio": corazonVacio,
  "escudo-entero": escudoEntero,
  "escudo-agrietado": escudoAgrietado,
  cristal,
  "nube-calma": nubeCalma,
  "nube-tormenta": nubeTormenta,
  "pw-reparacion": pwReparacion,
  "pw-escudo": pwEscudo,
  "pw-pulso": pwPulso,
  "pw-tiempo": pwTiempo,
  "pw-rayo": pwRayo,
  "pw-cosecha": pwCosecha,
  "pw-mira": pwMira,
} as const;

export type NombreIcono = keyof typeof ICONOS;

/* El powerup "lento" se dibuja con el reloj de arena (pw-tiempo): el id del
   motor nombra el efecto, el archivo nombra el dibujo. */
export const ICONO_DE_POWERUP: Record<PowerupId, NombreIcono> = {
  reparacion: "pw-reparacion",
  escudo: "pw-escudo",
  pulso: "pw-pulso",
  lento: "pw-tiempo",
  rayo: "pw-rayo",
  cosecha: "pw-cosecha",
  mira: "pw-mira",
};

/* Color de la cápsula (y del destello al agarrarla) por powerup. */
export const COLOR_DE_POWERUP: Record<PowerupId, string> = {
  reparacion: "#ff7d94",
  escudo: "#54e8c6",
  pulso: "#25c8df",
  lento: "#7c93ff",
  rayo: "#ffd552",
  cosecha: "#9b7cff",
  mira: "#ff9fca",
};

const RANGOS_SVG: Record<RangoId, string> = {
  cadete: rCadete,
  piloto: rPiloto,
  explorador: rExplorador,
  as: rAs,
  capitan: rCapitan,
  leyenda: rLeyenda,
};

export function IconoOrbita({
  nombre,
  className,
  style,
  titulo,
}: {
  nombre: NombreIcono;
  className?: string;
  style?: CSSProperties;
  titulo?: string;
}) {
  return (
    <span
      className={`orb-ico ${className ?? ""}`}
      style={style}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      dangerouslySetInnerHTML={{ __html: ICONOS[nombre] }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Objetos 3D con respaldo SVG                                         */
/* ------------------------------------------------------------------ */

const ARTE_INSIGNIAS = "/assets/orbita/insignias";
const ARTE_GEMAS = "/assets/orbita/gemas";

/** Los WebP que ya fallaron una vez en esta sesión: no se vuelven a pedir
 *  en cada render (un 404 por insignia por pantalla es ruido de consola
 *  y de red mientras el arte se genera por tandas). */
const faltantes = new Set<string>();

function useImagenConRespaldo(src: string) {
  const [disponible, setDisponible] = useState(() => !faltantes.has(src));
  useEffect(() => setDisponible(!faltantes.has(src)), [src]);
  const alFallar = () => {
    faltantes.add(src);
    setDisponible(false);
  };
  return { disponible, alFallar };
}

/** Insignia de rango — lleva su color propio (no se tiñe): color y forma
 *  suben juntas, y se distinguen contando galones sin depender del color.
 *  `chica` es el SVG (HUD, listas, ≤ 32 px); `grande` carga la medalla 3D
 *  y cae al SVG si todavía no está generada. */
export function InsigniaRango({
  rango,
  className,
  tamano = "chica",
}: {
  rango: RangoId;
  className?: string;
  tamano?: "chica" | "grande";
}) {
  const src = `${ARTE_INSIGNIAS}/${rango}.webp`;
  const { disponible, alFallar } = useImagenConRespaldo(src);
  if (tamano === "grande" && disponible) {
    return (
      <span className={`orb-ico orb-insignia-grande ${className ?? ""}`}>
        <img src={src} alt="" decoding="async" onError={alFallar} />
      </span>
    );
  }
  return (
    <span
      className={`orb-ico ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: RANGOS_SVG[rango] }}
    />
  );
}

/** Gema 3D de un poder (o el cristal, la moneda del modo), con el SVG de
 *  respaldo. Se usa donde se ve grande: la revelación sobre la nave, el
 *  saldo, el resultado. En el HUD y en la palabra que vuela siguen los SVG. */
export function Gema({
  nombre,
  className,
  style,
}: {
  nombre: PowerupId | "cristal";
  className?: string;
  style?: CSSProperties;
}) {
  const src = `${ARTE_GEMAS}/${nombre}.webp`;
  const { disponible, alFallar } = useImagenConRespaldo(src);
  const respaldo = nombre === "cristal" ? ICONOS.cristal : ICONOS[ICONO_DE_POWERUP[nombre]];
  const colorRespaldo = nombre === "cristal" ? "#9b7cff" : COLOR_DE_POWERUP[nombre];
  if (disponible) {
    return (
      <span className={`orb-ico orb-gema ${className ?? ""}`} style={style} aria-hidden="true">
        <img src={src} alt="" decoding="async" onError={alFallar} />
      </span>
    );
  }
  return (
    <span
      className={`orb-ico ${className ?? ""}`}
      style={{ color: colorRespaldo, ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: respaldo }}
    />
  );
}
