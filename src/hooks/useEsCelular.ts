import { useEffect, useState } from "react";

/**
 * ¿Estamos en un celular?
 * ---------------------------------------------------------------------
 * En el celular se explora todo el juego y no se juega ningún nivel
 * (CLAUDE.md §6.2). Este hook es el único lugar donde se decide qué cuenta
 * como celular, así que la regla no se puede desincronizar entre pantallas.
 *
 * SE MIDE EL ANCHO, NUNCA SI LA PANTALLA ES TÁCTIL. Las Chromebook del aula
 * son táctiles y son el dispositivo principal: una consulta de `pointer` o
 * `hover` las dejaría afuera del juego, que es exactamente lo contrario de lo
 * que se quiere. Las tablets (768–1024) cuentan como computadora y juegan
 * normal.
 *
 * La segunda condición es por el TELÉFONO ACOSTADO: mide ~812 de ancho y se
 * escaparía de un corte por ancho solo, dejando 375 px de alto para el
 * teclado. Va acotada en ancho a 950 para que una ventana de escritorio corta
 * —angosta de alto pero ancha— no quede bloqueada por error.
 */
export const CONSULTA_CELULAR =
  "(max-width: 768px), (max-height: 480px) and (max-width: 950px)";

/** Sin hooks, para guardas que corren fuera de un componente. */
export function esCelular(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(CONSULTA_CELULAR).matches;
}

export function useEsCelular(): boolean {
  const [celular, setCelular] = useState(esCelular);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(CONSULTA_CELULAR);
    const alCambiar = (e: MediaQueryListEvent) => setCelular(e.matches);
    /* Se escucha el cambio y no un `resize`: girar el teléfono dispara esto
       una sola vez, en vez de cincuenta veces mientras se redimensiona. */
    mq.addEventListener("change", alCambiar);
    setCelular(mq.matches);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  return celular;
}
