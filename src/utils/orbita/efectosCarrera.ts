import type { camaraCarrera } from "./pistaCarrera";

type Camara = ReturnType<typeof camaraCarrera>;
export interface VueloCarrera { x: number; y: number; escala: number; giro: number; color: string; alumno: boolean }

/** Capa decorativa acotada, dibujada por el único rAF de Carrera.
 * No crea relojes, elementos por tecla ni partículas sin límite. */
export function crearEfectosCarrera(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  let ancho = 0, alto = 0, recorrido = 0;
  return {
    ajustar(w: number, h: number) {
      ancho=w; alto=h;
      const dpr=Math.min(devicePixelRatio || 1,1.5);
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
      ctx?.setTransform(dpr,0,0,dpr,0,0);
    },
    dibujar(camara: Camara, vuelos: VueloCarrera[], dt: number, impulso: number, corriendo: boolean, finalMs: number, reducido: boolean) {
      if (!ctx) return;
      ctx.clearRect(0,0,ancho,alto);
      if (reducido) return;
      if (corriendo) recorrido+=dt*(.1+impulso*.9)/1600;
      ctx.lineCap="round";
      // Luces de guía: corren por las banquinas, nunca sobre las letras.
      if (corriendo) for (const lado of [-1.05,5.05]) for(let i=0;i<6;i++) {
        const p=1-(recorrido+i/6)%1;
        const a=camara.corredor(p,lado), b=camara.corredor(Math.max(0,p-.025),lado);
        ctx.globalAlpha=.14+impulso*.18;ctx.strokeStyle=lado<0 ? "#a9fff0" : "#d7c9ff";ctx.lineWidth=1.5+a.escala;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
      for (const v of vuelos) {
        const tam=Math.min(130,Math.max(90,ancho*.09))*v.escala;
        const fuerza=v.alumno ? impulso : .55;
        const largo=(24+fuerza*55)*v.escala;
        ctx.save();ctx.translate(v.x,v.y+tam*.18);ctx.rotate(v.giro*Math.PI/180);
        const estela=ctx.createLinearGradient(0,0,0,largo);
        estela.addColorStop(0,v.color);estela.addColorStop(1,"transparent");
        ctx.globalAlpha=v.alumno ? .55 : .22;ctx.fillStyle=estela;
        ctx.beginPath();ctx.moveTo(-tam*.12,0);ctx.quadraticCurveTo(-tam*.08,largo*.65,0,largo);ctx.quadraticCurveTo(tam*.08,largo*.65,tam*.12,0);ctx.fill();
        if (corriendo && fuerza>.15) for(let i=0;i<4;i++) {
          const fase=(recorrido*3+i/4)%1;
          ctx.globalAlpha=(1-fase)*(v.alumno ? .7 : .25);ctx.fillStyle=v.color;
          const x=Math.sin(i*2.4)*tam*.12, y=8+fase*largo;
          ctx.fillRect(x,y,Math.max(1,2*v.escala),Math.max(1,3*v.escala));
        }
        ctx.restore();
      }
      // Una sola celebración de 900 ms, sin tapar la consigna.
      if (finalMs>0) {
        const t=Math.min(1,finalMs/900);
        ctx.globalAlpha=(1-t)*.7;ctx.strokeStyle="#9ffff0";ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(ancho/2,camara.llegada,camara.arco*(.2+t*.7),camara.arco*(.07+t*.2),0,0,Math.PI*2);ctx.stroke();
        const colores=["#9affdf","#ffe69e","#cfb8ff","#bcecff"];
        for(let i=0;i<32;i++) {
          const a=i*2.39996, distancia=(28+i%7*12)*t;
          const x=ancho/2+Math.cos(a)*distancia*2.3,y=camara.llegada+Math.sin(a)*distancia-t*65+t*t*100;
          ctx.save();ctx.translate(x,y);ctx.rotate(a+t*2);ctx.globalAlpha=(1-t)*.9;ctx.fillStyle=colores[i%4]!;ctx.fillRect(-2,-4,4,8);ctx.restore();
        }
      }
      ctx.globalAlpha=1;
    },
    limpiar() { ctx?.clearRect(0,0,ancho,alto); },
  };
}
