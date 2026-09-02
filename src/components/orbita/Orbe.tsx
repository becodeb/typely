/* Un orbe de cristal del selector de modos.
 *
 * Tres capas apiladas: el MUNDO de adentro (lo único propio de cada
 * modo), el CRISTAL y el BRILLO — estos dos compartidos por todos los
 * orbes, que es lo que hace que un modo nuevo cueste UNA imagen y no un
 * set (Images/orbita/ORBITA.md §0). El movimiento es sutil y por CSS:
 * el mundo respira, el brillo barre el vidrio.
 *
 * Un orbe dormido no es un botón muerto (CLAUDE.md §15): igual responde
 * al click contando POR QUÉ duerme — "muy pronto" o "tu docente pausó
 * este modo" — vía onDormido.
 */

const ARTE = "/assets/orbita/orbes";

export function Orbe({
  mundo,
  titulo,
  subtitulo,
  dormido = false,
  motivoDormido,
  onEntrar,
  onDormido,
  flota = "orb-flota-a",
}: {
  /** Nombre del archivo de mundo: "aventura" | "orbita" | "dormido". */
  mundo: "aventura" | "orbita" | "dormido";
  titulo: string;
  subtitulo: string;
  dormido?: boolean;
  motivoDormido?: string;
  onEntrar?: () => void;
  onDormido?: () => void;
  flota?: string;
}) {
  const archivoMundo = dormido ? "dormido" : mundo;
  return (
    <div className={`grid gap-3 justify-items-center ${flota}`}>
      <button
        type="button"
        className={`orb-orbe w-[min(38vh,17rem,72vw)] ${dormido ? "orb-orbe--dormido" : ""}`}
        onClick={dormido ? onDormido : onEntrar}
        aria-label={dormido ? `${titulo} (todavía no disponible)` : `Entrar a ${titulo}`}
      >
        <img className="orb-orbe__mundo" src={`${ARTE}/mundo-${archivoMundo}.webp`} alt="" />
        <img src={`${ARTE}/cristal.webp`} alt="" />
        <img className="orb-orbe__brillo" src={`${ARTE}/brillo.webp`} alt="" />
      </button>
      <div className="text-center">
        <h2 className="m-0 font-extrabold text-2xl" style={{ fontFamily: "var(--font-display)", color: "#17355f" }}>
          {titulo}
        </h2>
        <p className="m-0 text-sm font-semibold" style={{ color: "#52658f" }}>
          {dormido ? (motivoDormido ?? "Muy pronto") : subtitulo}
        </p>
      </div>
    </div>
  );
}
