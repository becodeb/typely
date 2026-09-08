import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../utils/api";
import { hidratarPerfil, perfilLocal, registrarPartida, sincronizaArcade } from "../../utils/orbita/arcade";
import { elegirTextoCarrera } from "../../data/carreraTextos";
import { camaraCarrera } from "../../utils/orbita/pistaCarrera";
import { JUEGOS_ORBITA, recordarJuego } from "../../data/orbitaJuegos";
import { MotorCarrera, type EventoCarrera, type FantasmaCarrera, type ResultadoCarrera } from "../../utils/orbita/carrera";
import { NaveOrbita } from "../../components/orbita/NaveOrbita";
import { MascotaOrbita } from "../../components/orbita/MascotaOrbita";
import { navePorId } from "../../data/orbitaNaves";
import { colorEstela, efectoCosmetico } from "../../data/orbitaCosmeticos";
import { blip, SONIDO_KEY, sonidoActivado } from "../../utils/orbita/sonido";

interface Rival extends FantasmaCarrera { ship?: string | null; trail?: string | null; pet?: string | null }
const mediana = (ppm = 25): Rival[] => [{ id: "mediana", alias: "el ritmo de tu grado", ppm }];
const reloj = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2,"0")}`;

export default function CarreraPage() {
  const navigate = useNavigate(), { user } = useAuth();
  const [perfil,setPerfil] = useState(perfilLocal);
  const [texto,setTexto] = useState(() => elegirTextoCarrera());
  const [rivales,setRivales] = useState<Rival[] | null>(null);
  const [resultado,setResultado] = useState<ResultadoCarrera | null>(null);
  const [sonido,setSonido] = useState(sonidoActivado);
  const [,refrescar] = useState(0);
  const [guardado,setGuardado] = useState("");
  const entrada = useRef<HTMLInputElement>(null), escena = useRef<HTMLDivElement>(null);
  const voz = useRef<HTMLDivElement>(null), naveAlumno = useRef<HTMLDivElement>(null);
  const naves = useRef(new Map<string,HTMLDivElement>());
  const recta = useRef<HTMLImageElement>(null), baseMeta = useRef<HTMLImageElement>(null), meta = useRef<HTMLImageElement>(null), motor = useRef<MotorCarrera | null>(null);
  const sonidoRef = useRef(sonido); sonidoRef.current = sonido;
  const efectos = useRef(new Set<Animation>());
  const generacion = useRef(0);
  const bot = import.meta.env.DEV && new URLSearchParams(location.search).has("bot");
  useEffect(()=>{recordarJuego(JUEGOS_ORBITA.find(j=>j.id==="carrera")!);},[]);

  useEffect(() => {
    let cancelado = false;
    void hidratarPerfil(user?.role).then(p=>{if(!cancelado)setPerfil(p);});
    if (!sincronizaArcade(user?.role)) { setRivales(mediana()); return; }
    void api.arcadeGhosts("carrera").then(r => {
      if (cancelado) return;
      const otros: Rival[] = r.grade.map((g,i)=>({id:`grado-${i}`,alias:g.alias,ppm:g.wpm,ship:g.ship,trail:g.trail,pet:g.pet}));
      if (r.mine) otros.unshift({id:"propio",alias:"tu mejor carrera",ppm:r.mine.wpm});
      setRivales(otros.length ? otros : mediana(r.median));
    }).catch(()=>{if(!cancelado)setRivales(mediana());});
    return ()=>{cancelado=true;};
  },[user?.role]);

  function animar(el: Element | null | undefined, cuadros: Keyframe[], tiempo = 350) {
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = el.animate(cuadros,{duration:tiempo,easing:"ease-out"});
    efectos.current.add(a); a.onfinish = ()=>efectos.current.delete(a);
  }
  function procesar(eventos: EventoCarrera[]) {
    for (const e of eventos) {
      if (e.tipo === "acierto") {
        const chispa = naveAlumno.current?.querySelector(".car-chispa");
        if (chispa) { (chispa as HTMLImageElement).src = `/assets/orbita/carrera/chispa-${e.indice % 3 + 1}.webp`; animar(chispa,[{opacity:1,transform:"translateX(0) scale(1)"},{opacity:0,transform:"translateY(55px) scale(.2)"}]); }
      }
      if (e.tipo === "error") {
        animar(naveAlumno.current?.querySelector(".car-casco"),[{translate:"0 0"},{translate:"-5px 0"},{translate:"0 0"}]);
        if (sonidoRef.current) blip(100,65,.018);
      }
      if (e.tipo === "pasa") {
        animar(naves.current.get(e.fantasmaId)?.querySelector(".car-casco"),[{opacity:.4},{opacity:.15},{opacity:.4}]);
        animar(naveAlumno.current?.querySelector(".car-destello"),[{opacity:0},{opacity:1},{opacity:0}]);
      }
      if (e.tipo === "fin") {
        setResultado(e.resultado);
        const turno = generacion.current;
        setGuardado(sincronizaArcade(user?.role) ? "Guardando tu carrera…" : "Carrera de prueba guardada en esta compu.");
        void registrarPartida(e.resultado,user?.role,"carrera").then(res=>{
          if (turno !== generacion.current) return;
          if (sincronizaArcade(user?.role)) setGuardado(res ? res.ranked ? "Carrera guardada." : "Carrera guardada fuera del ranking." : "Quedó en esta compu. Se enviará cuando vuelva la conexión.");
        });
      }
    }
    refrescar(n=>n+1);
  }
  const procesarRef = useRef(procesar); procesarRef.current = procesar;

  useEffect(() => {
    if (!rivales) return;
    generacion.current++;
    const m = new MotorCarrera({texto:texto.texto,textId:texto.id,fantasmas:rivales});
    motor.current = m;
    let raf = 0, anterior = performance.now(), ultimoHud = 0, ultimaLuz = -1, esperaBot = 0;
    let ancho = escena.current?.clientWidth ?? 1366, alto = escena.current?.clientHeight ?? 768;
    let camara = camaraCarrera(ancho,alto);
    const ajustarCamara = () => {
      camara=camaraCarrera(ancho,alto);
      if(recta.current)recta.current.style.transform=camara.matriz;
      if(baseMeta.current)baseMeta.current.style.transform=camara.base;
      if(meta.current){meta.current.style.width=camara.arco+"px";meta.current.style.left=ancho/2+"px";meta.current.style.top=(camara.llegada-camara.arco*.91)+"px";}
    };
    const observar = new ResizeObserver(([r])=>{if(r){ancho=r.contentRect.width;alto=r.contentRect.height;ajustarCamara();}});
    if (escena.current) observar.observe(escena.current);
    ajustarCamara();
    const posicionar = (el: HTMLElement | null | undefined, progreso: number, carril: number) => {
      if (!el) return;
      const p=camara.corredor(progreso,carril);
      el.style.transform = `translate3d(${p.x}px,${p.y}px,0) scale(${p.escala})`;
      el.style.zIndex=String(10+Math.round((1-progreso)*100));
      el.style.setProperty("--car-alias-opacidad",String(Math.max(0,1-progreso*1.5)));
    };
    const cuadro = (ahora: number) => {
      const dt = Math.min(80,Math.max(0,ahora-anterior)); anterior = ahora;
      const eventos = m.tick(dt);
      if (eventos.length) procesarRef.current(eventos);
      if (bot && m.largada && !m.pausa && !m.resultado) {
        esperaBot += dt;
        if (esperaBot >= 180) { esperaBot = 0; procesarRef.current(m.tecla(m.texto[m.indice]!)); }
      }
      posicionar(naveAlumno.current,m.progreso,2);
      m.fantasmas.forEach((f,i)=>posicionar(naves.current.get(f.id),f.progreso,[0,1,3,4][i]!));
      const luz = Math.min(2,Math.floor(m.cuentaMs/800)-1);
      if (luz !== ultimaLuz) { ultimaLuz=luz; if(sonidoRef.current)blip(220+luz*180,330+luz*180,.03); }
      if (ahora-ultimoHud >= 100) {ultimoHud=ahora;refrescar(n=>n+1);}
      if (!m.resultado && !document.hidden) raf=requestAnimationFrame(cuadro);
    };
    const visibilidad = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) {m.pausar();efectos.current.forEach(a=>a.pause());}
      else {if(!m.inactivo)m.reanudar();anterior=performance.now();efectos.current.forEach(a=>a.play());raf=requestAnimationFrame(cuadro);}
      refrescar(n=>n+1);
    };
    if(document.hidden)m.pausar();else raf=requestAnimationFrame(cuadro);
    document.addEventListener("visibilitychange",visibilidad);
    entrada.current?.focus({preventScroll:true});
    return ()=>{ generacion.current++;cancelAnimationFrame(raf);observar.disconnect();document.removeEventListener("visibilitychange",visibilidad);efectos.current.forEach(a=>a.cancel());efectos.current.clear(); };
  },[texto,rivales,bot]);

  useEffect(() => {
    const input=entrada.current;
    if (!input || !rivales || resultado) return;
    let componiendo=false,ultimoCompuesto="",compuestoHasta=0;
    const enviar = (data:string) => { for(const ch of data.normalize("NFC")) procesarRef.current(motor.current?.tecla(ch) ?? []);input.value=""; };
    const antes = (ev:Event) => {
      const e=ev as InputEvent;
      if (e.isComposing || componiendo || e.inputType === "insertCompositionText") return;
      if (e.inputType === "deleteContentBackward") {e.preventDefault();procesarRef.current(motor.current?.borrar() ?? []);return;}
      if (!e.inputType.startsWith("insert")) return;
      e.preventDefault();
      // No pegar párrafos ni completar texto automáticamente. Las teclas
      // muertas se resuelven por composición, igual que en Tormenta.
      if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") return;
      const data=(e.data ?? "").normalize("NFC");
      if (data === ultimoCompuesto && performance.now() < compuestoHasta) {ultimoCompuesto="";return;}
      if ([...data].length === 1 && !["´","`","^","~","¨"].includes(data)) enviar(data);
    };
    const inicio = () => {componiendo=true;};
    const fin = (e:CompositionEvent) => {componiendo=false;ultimoCompuesto=e.data.normalize("NFC");compuestoHasta=performance.now()+80;enviar(ultimoCompuesto);};
    const tecla = (e:KeyboardEvent) => {
      const a=document.activeElement;
      if (motor.current?.inactivo) {e.preventDefault();procesarRef.current(motor.current.reanudar());input.focus({preventScroll:true});return;}
      if (a instanceof HTMLElement && a.closest("button,a")) return;
      if (e.key === "Backspace" && !e.isComposing) {e.preventDefault();procesarRef.current(motor.current?.borrar() ?? []);return;}
      if(a!==input && !e.isComposing && e.key.length === 1 && !(e.metaKey || (e.ctrlKey && !e.altKey))) {e.preventDefault();enviar(e.key);input.focus({preventScroll:true});}
    };
    const enfocar = (e:PointerEvent) => {if (!(e.target as HTMLElement).closest("button,a"))input.focus({preventScroll:true});};
    input.addEventListener("beforeinput",antes);input.addEventListener("compositionstart",inicio);input.addEventListener("compositionend",fin);
    window.addEventListener("keydown",tecla);window.addEventListener("pointerup",enfocar);input.focus({preventScroll:true});
    return ()=>{input.removeEventListener("beforeinput",antes);input.removeEventListener("compositionstart",inicio);input.removeEventListener("compositionend",fin);window.removeEventListener("keydown",tecla);window.removeEventListener("pointerup",enfocar);};
  },[rivales,resultado]);

  useEffect(()=>{
    if (!import.meta.env.DEV) return;
    const w=window as unknown as {__carrera?:{motor:()=>MotorCarrera|null;tecla:(ch:string)=>void;borrar:()=>void}};
    w.__carrera={motor:()=>motor.current,tecla:ch=>procesarRef.current(motor.current?.tecla(ch) ?? []),borrar:()=>procesarRef.current(motor.current?.borrar() ?? [])};
    return ()=>{delete w.__carrera;};
  },[]);
  useEffect(()=>{if(resultado)document.querySelector<HTMLButtonElement>(".car-resultado button")?.focus();},[resultado]);

  const m=motor.current, pausada=!!m?.pausa || !!resultado;
  let letra=0;
  const casco=(r:Rival | null)=>{
    const equipo=r?.id === "propio" || !r ? perfil?.equipped : r;
    return <><div className="car-casco"><NaveOrbita nave={navePorId(equipo?.ship)} pausada={pausada} colorMotor={colorEstela(equipo?.trail)} efectoEstela={efectoCosmetico(equipo?.trail)} /></div><MascotaOrbita id={equipo?.pet} pausada={pausada} contexto={r ? "tienda" : "partida"} destinoMensaje={r ? undefined : voz} /></>;
  };
  return <main className="car-pagina" data-resultado={!!resultado} aria-label="Carrera de cohetes">
    <div className="orb-fondo car-cielo" style={{"--orb-nebulosa":"url(/assets/orbita/fondo/nebulosa.webp)","--orb-horizonte":"url(/assets/orbita/fondo/horizonte.webp)","--orb-tinte":"rgb(112, 96, 230)"} as CSSProperties} aria-hidden="true">
      <img className="orb-estrellas" src="/assets/orbita/fondo/estrellas.webp" alt=""/><div className="orb-tinte"/><img className="orb-horizonte" src="/assets/orbita/fondo/horizonte.webp" alt=""/>
    </div>
    <div className="car-barra"><button className="orb-pildora orb-pildora--boton" onClick={()=>navigate("/orbita")}><ArrowLeft size={17}/> Órbita</button><h1 className="orb-dato">Carrera de cohetes</h1><div className="car-instrumentos"><div className="car-instrumento"><span>TIEMPO</span><b>{reloj(m?.tiempoMs ?? 0)}</b></div><div className="car-instrumento"><span>RITMO</span><b>{m?.ppm ?? 0}<small> PPM</small></b></div><button className="orb-pildora orb-pildora--boton" aria-label={sonido ? "Apagar sonido" : "Prender sonido"} onClick={()=>setSonido(v=>{try{localStorage.setItem(SONIDO_KEY,v ? "0":"1");}catch{/* Sin almacenamiento. */}return !v;})}>{sonido ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button></div></div>
    <input ref={entrada} className="car-entrada" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} aria-label="Escribí el texto de la carrera" tabIndex={-1}/>
    <section className="car-lectura" aria-label="Texto para escribir">
      <p className="car-consigna">Escribí para impulsar tu nave</p><p className="car-texto">{texto.texto.split(/( )/).map((palabra,i)=><span className={palabra === " " ? undefined : "car-palabra"} key={i}>{[...palabra].map(ch=>{
        const indice=letra++, roja=m && indice>=m.indice && indice<m.indice+m.rojas.length;
        return <span key={indice} className={roja ? "car-letra--error" : indice<(m?.indice ?? 0) ? "car-letra--bien" : indice===(m?.indice ?? 0) ? "car-letra--actual" : ""}>{roja ? m.rojas[indice-m.indice] === " " ? "␣" : m.rojas[indice-m.indice] : ch}</span>;
      })}</span>)}{m && m.rojas.slice(Math.max(0,m.texto.length-m.indice)).map((ch,i)=><span className="car-letra--error" key={`extra-${i}`}>{ch === " " ? "␣" : ch}</span>)}</p>
      <div className="car-pie-lectura"><p className="car-ayuda orb-dato" aria-live="polite">{m?.rojas.length ? "Borrá las letras rojas con Backspace para seguir." : !m?.largada ? "Leé el texto y preparate para salir." : "Seguí el texto. Cada letra te acerca a la meta."}</p><span className="car-avance">{Math.round((m?.progreso ?? 0)*100)} %</span></div><div className="car-progreso" aria-hidden="true"><i style={{transform:`scaleX(${m?.progreso ?? 0})`}}/></div>
    </section>
    <div className="car-escena" ref={escena} aria-hidden="true">
      <img ref={recta} className="car-recta" src="/assets/orbita/carrera/recta.webp" alt=""/>
      <img ref={baseMeta} className="car-recta car-base-meta" src="/assets/orbita/carrera/recta.webp" alt=""/>
      <img ref={meta} className="car-meta" src="/assets/orbita/carrera/meta.webp" alt=""/>
      {(rivales ?? []).map(r=><div className="car-corredor car-corredor--fantasma" key={r.id} ref={el=>{if(el)naves.current.set(r.id,el);else naves.current.delete(r.id);}}><span className="car-alias orb-dato">{r.alias}</span>{casco(r)}</div>)}
      <div className="car-corredor car-corredor--alumno" ref={naveAlumno}><span className="car-alias car-alias--vos orb-dato">VOS</span>{casco(null)}<img className="car-chispa" src="/assets/orbita/carrera/chispa-1.webp" alt=""/><img className="car-destello" src="/assets/orbita/hub/destello.webp" alt=""/></div>
    </div>
    {!resultado && <div data-lista={!!m?.largada && m.tiempoMs>=650} className="car-largada" role="status"><div>{["rojo","amarillo","verde"].map((color,i)=><img key={color} data-encendido={!!m && m.cuentaMs >= (i+1)*800} src={`/assets/orbita/carrera/banderin-${color}.webp`} alt={color}/>)}</div><strong className="orb-dato">{!rivales ? "Preparando la pista…" : m?.largada ? "¡Ya!" : "Preparate"}</strong></div>}
    <div ref={voz} className="car-voz"/>
    {m?.inactivo && !resultado && <div className="car-capa"><section className="orb-vidrio tarjeta-marca car-pausa" role="dialog" aria-modal="true" aria-labelledby="car-seguimos"><h2 id="car-seguimos">¿Seguimos?</h2><p>Tu nave y los fantasmas te esperan.</p><button autoFocus className="orb-boton-vidrio" onClick={()=>{procesar(m.reanudar());entrada.current?.focus();}}>Seguir corriendo</button><p>También podés apretar cualquier tecla.</p></section></div>}
    {resultado && <div className="car-capa"><section className="orb-vidrio tarjeta-marca car-resultado" role="dialog" aria-modal="true" aria-labelledby="car-fin" onKeyDown={e=>{
      if(e.key!=="Tab")return;const botones=e.currentTarget.querySelectorAll<HTMLButtonElement>("button");const primero=botones[0],ultimo=botones[botones.length-1];if(e.shiftKey && document.activeElement===primero){e.preventDefault();ultimo?.focus();}else if(!e.shiftKey && document.activeElement===ultimo){e.preventDefault();primero?.focus();}
    }}>
      {resultado.puesto<=3 && <img className="car-medalla" src={`/assets/orbita/carrera/medalla-${["oro","plata","bronce"][resultado.puesto-1]}.webp`} alt={`Medalla de ${["oro","plata","bronce"][resultado.puesto-1]}`}/>}
      <h2 id="car-fin">¡Llegaste a la meta!</h2><p className="car-puesto">{resultado.puesto}.º puesto de {resultado.rivales+1}</p>
      <strong className="car-puntaje">{resultado.puntaje} puntos</strong>
      <dl className="car-resumen"><div><dt>Tiempo</dt><dd>{reloj(resultado.durationMs)}</dd></div><div><dt>PPM</dt><dd>{resultado.ppmNeto}</dd></div><div><dt>Precisión</dt><dd>{resultado.precision}%</dd></div><div><dt>Cristales</dt><dd>+{resultado.cristales}</dd></div></dl>
      <p className="orb-suave car-guardado" role="status">{guardado}</p>
      <div className="car-acciones"><button className="orb-boton-vidrio" onClick={()=>{setResultado(null);setTexto(elegirTextoCarrera(texto.id));}}>Otra vez</button><button className="orb-boton-vidrio" onClick={()=>navigate("/orbita/ranking?game=carrera")}>Ranking</button><button className="orb-boton-vidrio" onClick={()=>navigate("/orbita")}>Volver a Órbita</button></div>
    </section></div>}
  </main>;
}
