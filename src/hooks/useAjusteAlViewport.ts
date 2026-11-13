import { useLayoutEffect, type RefObject } from "react";

/* =====================================================================
   Encoge un bloque para que entre ENTERO en la ventana, sin scroll.

   Pensado para la tarjeta de login: es una pantalla que no puede
   desplazarse, y el aula tiene de todo — Chromebooks 16:9 y 3:2, la misma
   Chromebook con la barra del navegador robando 120 px, tablets, monitores
   y celulares. En vez de un breakpoint por cada caso, se mide el bloque a
   escala 1 y se le aplica un `zoom` = el mayor factor ≤ 1 con el que el
   bloque (con sus márgenes) entra en alto y en ancho.

   Por qué `zoom` y no `transform: scale()`: el zoom es de LAYOUT — la
   tarjeta ocupa de verdad el lugar que se ve, los márgenes en px y en vh se
   escalan con ella y el centrado del flex sigue siendo exacto. Un transform
   deja el tamaño original en el flujo (la página seguiría "midiendo" de
   más) y en Chrome un ancestro con transform puede apagar el
   backdrop-filter de lo que tiene adentro, que es justo el vidrio de la
   tarjeta. `zoom` es estándar desde Chrome 128 / Firefox 126 / Safari.

   Nunca agranda: a escala 1 el diseño es el de siempre, y sólo cede cuando
   la ventana no da.
===================================================================== */
export function useAjusteAlViewport(
  ref: RefObject<HTMLElement | null>,
  opciones: {
    /** Ancho extra que asoma por fuera del bloque, en px. */
    margenAncho?: number;
    /** Lo mismo, como fracción del ancho del bloque (0.12 = 12 % más). */
    anchoExtraRelativo?: number;
  } = {},
) {
  const margenAncho = opciones.margenAncho ?? 0;
  const anchoExtraRelativo = opciones.anchoExtraRelativo ?? 0;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ultimo = 1;
    const ajustar = () => {
      /* Medir a escala 1: getBoundingClientRect devuelve píxeles ya
         zoomeados, así que se resetea antes de medir. Sólo pasa al
         redimensionar, no en cada frame. */
      el.style.zoom = "1";
      const rect = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      const alto = rect.height + parseFloat(estilo.marginTop) + parseFloat(estilo.marginBottom);
      const ancho = rect.width * (1 + anchoExtraRelativo) + margenAncho;
      const vp = window.visualViewport;
      const altoVentana = (vp && vp.height) || window.innerHeight;
      const anchoVentana = (vp && vp.width) || window.innerWidth;
      /* En medio de un cambio de tamaño el viewport puede medir 0 un
         instante; una escala 0 haría desaparecer la tarjeta. Se ignora esa
         medición (llega otro `resize` enseguida) y, por las dudas, la
         escala nunca baja de 0,35. */
      if (!altoVentana || !anchoVentana || !alto || !ancho) return;
      const escala = Math.max(0.35, Math.min(1, altoVentana / alto, anchoVentana / ancho));
      const redondeada = Math.floor(escala * 1000) / 1000;
      ultimo = redondeada;
      el.style.zoom = String(redondeada);
    };

    /* El `resize` puede llegar antes de que las media queries y el reflow
       se apliquen (y al girar un teléfono llega en dos tiempos): se mide en
       el próximo frame, y una vez más después, cuando la nueva geometría
       ya está asentada. */
    let pendiente = 0;
    let tardios: number[] = [];
    const programar = () => {
      cancelAnimationFrame(pendiente);
      tardios.forEach(clearTimeout);
      pendiente = requestAnimationFrame(() => {
        ajustar();
        pendiente = requestAnimationFrame(ajustar);
      });
      /* Y dos repasos tardíos: el giro del teléfono y la barra del
         navegador terminan de asentar el viewport bastante después del
         primer evento. Medir de más es barato; quedar con la escala vieja
         es scroll. */
      tardios = [200, 600].map((ms) => window.setTimeout(ajustar, ms));
    };

    ajustar();
    /* Las fuentes y el logo cambian el alto natural al cargar: se vuelve a
       medir cuando terminan. */
    document.fonts?.ready.then(programar).catch(() => {});
    window.addEventListener("resize", programar);
    window.visualViewport?.addEventListener("resize", programar);
    /* Red de seguridad: si el viewport cambia sin `resize` (emulación,
       barra del navegador que aparece o se esconde), el observador lo ve. */
    const observador = new ResizeObserver(programar);
    observador.observe(document.documentElement);
    return () => {
      cancelAnimationFrame(pendiente);
      tardios.forEach(clearTimeout);
      observador.disconnect();
      window.removeEventListener("resize", programar);
      window.visualViewport?.removeEventListener("resize", programar);
      if (ultimo !== 1) el.style.zoom = "";
    };
  }, [ref, margenAncho, anchoExtraRelativo]);
}
