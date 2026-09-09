/* La perspectiva está dibujada en recta-frontal.webp. Solo se escala de
 * manera uniforme y se traslada: ningún panel de cristal se deforma. */
export function camaraCarrera(ancho: number, alto: number) {
  const arco = Math.min(alto * .62, ancho * .29);
  const llegada = alto * .43;
  const salida = alto * .82;
  // Anclajes de la ilustración original, en píxeles sobre 1536 × 1024.
  const anchoFinal = 72, yFinal = 410;
  const pendiente = (1900-anchoFinal)/(1024-yFinal);
  const escalaImagen = arco*.34/anchoFinal;
  // La recta continúa detrás del pórtico. Sus apoyos descansan sobre
  // el cristal, y los corredores atraviesan el espacio entre columnas.
  const finImagen = llegada-arco*.71/pendiente;
  const lejos = arco*.78;
  const cerca = anchoFinal*escalaImagen+pendiente*(salida-finImagen);
  return {
    arco, llegada, salida, techoMeta: llegada-arco/1.5*.89,
    imagen: { ancho:1536*escalaImagen, alto:1024*escalaImagen,
      x:(ancho-1536*escalaImagen)/2, y:finImagen-yFinal*escalaImagen },
    corredor(progreso:number,carril:number) {
      const anchoPista=cerca+(lejos-cerca)*progreso;
      // Un giro suave acompaña la dirección del carril sin aplastar el
      // dibujo ni girarlo de canto. La nave central conserva su eje.
      const giro = Math.atan2((2-carril)*(cerca-lejos)/5,salida-llegada)*180/Math.PI*.4;
      return {x:ancho/2+(carril-2)*anchoPista/5,y:salida+(llegada-salida)*progreso,escala:anchoPista/cerca,giro};
    },
  };
}
