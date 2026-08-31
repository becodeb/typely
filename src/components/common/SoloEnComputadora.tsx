import { Monitor } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { getActivityById } from "../../data/activities";
import { useEsCelular } from "../../hooks/useEsCelular";

/**
 * Guarda de las pantallas de nivel para celulares (CLAUDE.md §6.2).
 *
 * Esconder el botón de jugar en la isla NO alcanza: `/gameplay/<id>` es una
 * URL, y un link compartido, un favorito o girar el teléfono meten al chico
 * igual en una pantalla que en un celular es inservible — el teclado se
 * desborda por el borde derecho y no hay forma de alcanzar las teclas que
 * faltan. Por eso la puerta está en la RUTA y no en un botón.
 *
 * Manda de vuelta a la isla en vez de mostrar un cartel sin salida: el chico
 * termina en un lugar donde sí puede seguir mirando el juego, que es lo que el
 * celular ofrece.
 */
export function SoloEnComputadora({ children }: { children: React.ReactNode }) {
  const celular = useEsCelular();
  const { activityId } = useParams();

  if (!celular) return <>{children}</>;

  /* De vuelta a la isla del nivel, no al mapa de mundos: se vuelve al lugar
     desde donde se tocó. Si el id no existe, al mapa. */
  const actividad = activityId ? getActivityById(activityId) : undefined;
  const destino = actividad ? `/worlds/${actividad.worldId}` : "/mundos";

  return (
    <Navigate
      to={destino}
      replace
      state={{ avisoSoloCompu: true }}
    />
  );
}

/** El cartel que reemplaza al botón de jugar en la ficha del nivel. */
export function AvisoSoloEnComputadora() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-accent-sky/15 border border-accent-sky/35 px-3 py-2 text-[13px] font-semibold text-text/85">
      <Monitor size={16} className="shrink-0 mt-0.5 text-accent-strong" />
      <span>Este nivel se juega en la computadora. Desde el celular podés recorrer las islas y ver tus estrellas.</span>
    </p>
  );
}
