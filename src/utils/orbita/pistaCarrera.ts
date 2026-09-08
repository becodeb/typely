/* La perspectiva está dibujada en recta-frontal.webp. Solo se escala de
 * manera uniforme y se traslada: ningún panel de cristal se deforma. */
export function camaraCarrera(ancho: number, alto: number) {
  const arco = Math.min(alto * .43, ancho * .27);
  const llegada = alto * .4;
  const salida = alto * .82;
  // Anclajes de la ilustración original, en píxeles sobre 1536 × 1024.
  const anchoFinal = 72, yFinal = 410;
  const pendiente = (1900-anchoFinal)/(1024-yFinal);
  const escalaImagen = arco*.34/anchoFinal;
  const lejos = anchoFinal*escalaImagen;
  const cerca = lejos+pendiente*(salida-llegada);
  return {
    arco, llegada, salida,
    imagen: { ancho:1536*escalaImagen, alto:1024*escalaImagen,
      x:(ancho-1536*escalaImagen)/2, y:llegada-yFinal*escalaImagen },
    corredor(progreso:number,carril:number) {
      const anchoPista=cerca+(lejos-cerca)*progreso;
      return {x:ancho/2+(carril-2)*anchoPista/5,y:salida+(llegada-salida)*progreso,escala:anchoPista/cerca};
    },
  };
}
