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
      <div className="car-semaforo" aria-hidden="true">
        {["rojo", "amarillo", "verde"].map(luz =>
          <span className={`car-foco car-foco--${luz}`} key={luz} data-encendido={preparada && luz === color}><i/></span>
        )}
      </div>
      <div className="car-largada__mensaje" role="status" aria-live="polite" aria-atomic="true">
        <strong key={`${preparada}-${fase}`} className="car-largada__numero">{!preparada ? "Un momento…" : fase === 3 ? "¡Ya!" : 3-fase}</strong>
        <p>{!preparada ? "Estamos preparando la pista." : fase === 3 ? "¡Empezá a escribir!" : "Prepará las manos. Esperá el verde."}</p>
      </div>
    </div>
  </div>;
}
