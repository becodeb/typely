/* Una sola cámara para pista, corredores y arco. Las coordenadas de origen
 * son los cuatro bordes pintados en recta.webp; los PNG no se modifican. */
type Punto = [number, number];
function proyectarRecta(ancho:number,alto:number,destino:Punto[]) {
  const origen: Punto[] = [[.054,.609],[.054,.938],[.944,.535],[.944,.718]];
  // Homografía: cuatro correspondencias, ocho coeficientes. Se calcula
  // solo al cambiar el tamaño; durante la carrera se animan transforms.
  const filas = origen.flatMap(([x,y],i)=>{
    const [u,v]=destino[i]!;
    return [[x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]];
  });
  for(let c=0;c<8;c++) {
    let pivote=c;
    for(let f=c+1;f<8;f++)if(Math.abs(filas[f]![c]!)>Math.abs(filas[pivote]![c]!))pivote=f;
    [filas[c],filas[pivote]]=[filas[pivote]!,filas[c]!];
    const divisor=filas[c]![c]!;
    filas[c]=filas[c]!.map(v=>v/divisor);
    for(let f=0;f<8;f++)if(f!==c){const factor=filas[f]![c]!;filas[f]=filas[f]!.map((v,j)=>v-factor*filas[c]![j]!);}
  }
  const [a,b,c,d,e,f,g,h]=filas.map(f=>f[8]!);
  return `matrix3d(${a!/ancho},${d!/ancho},0,${g!/ancho},${b!/alto},${e!/alto},0,${h!/alto},0,0,1,0,${c},${f},0,1)`;
}
export function camaraCarrera(ancho: number, alto: number) {
  const arco = Math.min(alto * .43, ancho * .27);
  const llegada = alto * .4;
  const salida = alto * .82;
  const cerca = ancho * .84;
  const lejos = arco * .34;
  // La pista continúa debajo de la cámara: ninguna nave sale de un borde.
  const borde = alto * 1.12;
  const anchoBorde = lejos + (cerca-lejos)*(borde-llegada)/(salida-llegada);
  return {
    arco, llegada, salida,
    matriz: proyectarRecta(ancho,alto,[[(ancho-anchoBorde)/2,borde],[(ancho+anchoBorde)/2,borde],[(ancho-lejos)/2,llegada],[(ancho+lejos)/2,llegada]]),
    base: proyectarRecta(ancho,alto,[[ancho/2-arco*.5,llegada+arco*.055],[ancho/2+arco*.5,llegada+arco*.055],[ancho/2-arco*.43,llegada-arco*.035],[ancho/2+arco*.43,llegada-arco*.035]]),
    corredor(progreso:number,carril:number) {
      const anchoPista=cerca+(lejos-cerca)*progreso;
      return {x:ancho/2+(carril-2)*anchoPista/5,y:salida+(llegada-salida)*progreso,escala:anchoPista/cerca};
    },
  };
}
