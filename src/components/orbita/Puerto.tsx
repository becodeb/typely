import { useState } from "react";
import { NaveOrbita } from "./NaveOrbita";
import { navePorId } from "../../data/orbitaNaves";

/** La estación del antiguo inicio ahora pertenece a la tienda. La nave
 * está posada en el puerto; el probador conserva sus efectos y controles. */
export function Puerto({ naveId }: { naveId?: string | null }) {
  const [disponible, setDisponible] = useState(true);
  if (!disponible) return null;
  return <div className="orb-puerto" aria-hidden="true">
    <img className="orb-puerto__estacion" src="/assets/orbita/hub/estacion.webp" alt="" onError={() => setDisponible(false)} />
    <div className="orb-puerto__nave"><NaveOrbita nave={navePorId(naveId)} animada={false} /></div>
  </div>;
}
