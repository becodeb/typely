import type { CSSProperties } from "react";

interface Props {
  cuentaMs: number;
  tiempoMs: number;
  preparada: boolean;
  pausada: boolean;
}

/** La animación lee el reloj del motor: el verde, el sonido y la primera
 * tecla habilitada ocurren juntos. No hay un segundo temporizador. */
export function LargadaCarrera({cuentaMs, tiempoMs, preparada, pausada}: Props) {
  const fase = Math.min(3, Math.floor(cuentaMs / 800));
  const color = fase < 2 ? "rojo" : fase === 2 ? "amarillo" : "verde";
  return <div className="car-largada" data-lista={fase === 3 && tiempoMs >= 650}
    data-fase={fase} data-pausada={pausada}>
    <div className="car-largada__contenido">
      <p className="car-largada__rotulo">Carrera de cohetes · Largada</p>
      <div className="car-semaforo" aria-hidden="true" style={{"--car-cuenta":Math.min(1,cuentaMs/2400)} as CSSProperties}>
        {["rojo", "amarillo", "verde"].map((luz,i) =>
          <div className="car-senal" key={luz}><span className={`car-foco car-foco--${luz}`} data-encendido={preparada && luz === color}><i/></span><span>{["PREPARATE","ATENCIÓN","¡SALÍ!"][i]}</span></div>
        )}
        <span className="car-semaforo__carga"><i/></span>
      </div>
      <div className="car-largada__mensaje" role="status" aria-live="polite" aria-atomic="true">
        <strong key={`${preparada}-${fase}`} className="car-largada__numero">{!preparada ? "Un momento…" : fase === 3 ? "¡Ya!" : 3-fase}</strong>
        <p>{!preparada ? "Estamos preparando la pista." : fase === 3 ? "¡Empezá a escribir!" : "Prepará las manos. Esperá el verde."}</p>
      </div>
    </div>
  </div>;
}
