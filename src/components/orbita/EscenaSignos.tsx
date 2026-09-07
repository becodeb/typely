import type { EstadoSignos } from "../../utils/orbita/tormentaSignos";

/** El bonus cambia solo el tinte del fondo y deja libre el campo de juego. */
export function EscenaSignos({ estado }: { estado: EstadoSignos | null }) {
  return <div className="orb-signos" data-activa={estado?.fase === "activa"} aria-hidden="true" />;
}
