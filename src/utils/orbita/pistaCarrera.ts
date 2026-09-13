/* Anclajes del arte recta-lunar.webp, medidos sobre 1536 × 1024.
 * El suelo conserva su proporción y no se amplía en los tamaños de juego.
 * Las banquinas son piso de apoyo: nunca forman parte de los cinco carriles. */
export function camaraCarrera(ancho: number, alto: number) {
  const escalaImagen = Math.min(1, ancho/1536);
  const yFondo = 130, anchoFondo = 90, yMeta = 180;
  const pendiente = (2590-anchoFondo)/(1024-yFondo);
  const anchoLlegada = (anchoFondo+pendiente*(yMeta-yFondo))*escalaImagen;
  // El vano deja margen a las naves exteriores. Los pies ocupan las
  // banquinas lavanda, más allá de los dos bordes cian de la calzada.
  const arco = anchoLlegada/.62;
  const llegada = Math.max(alto*.43, arco/1.5*.89+18);
  const salida = Math.min(alto*.8, alto-90);
  const anchoSalida = anchoLlegada+pendiente*(salida-llegada);
  return {
    arco, llegada, salida, anchoLlegada, techoMeta: llegada-arco/1.5*.89,
    imagen: { ancho: 1536*escalaImagen, alto: 1024*escalaImagen,
      x: (ancho-1536*escalaImagen)/2, y: llegada-yMeta*escalaImagen },
    corredor(progreso: number, carril: number) {
      const anchoPista = anchoSalida+(anchoLlegada-anchoSalida)*progreso;
      const giro = Math.atan2((2-carril)*(anchoSalida-anchoLlegada)/5,salida-llegada)*180/Math.PI*.4;
      return { x: ancho/2+(carril-2)*anchoPista/5,
        y: salida+(llegada-salida)*progreso, escala: anchoPista/anchoSalida, giro };
    },
  };
}
