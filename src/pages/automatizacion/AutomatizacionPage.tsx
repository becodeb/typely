/* Modo Automatización — la pantalla.
 *
 * Acá viven los CUATRO RELOJES que IMPLEMENTACION.md §5 pide separar, y
 * la separación no es prolijidad: con un solo intervalo mutando React,
 * la animación de la nave y el crecimiento de las vetas se pisan y el
 * campo empieza a saltar.
 *
 *   1. RELOJ DEL MUNDO   — rAF. Hace crecer las vetas, corra o no el
 *                          programa. Se pausa con la pestaña oculta.
 *   2. EJECUTOR          — una instrucción por vez, con su propio
 *                          temporizador y un token de corrida que
 *                          invalida los callbacks viejos.
 *   3. ANIMADOR          — no existe como reloj: son transiciones CSS.
 *                          La UI sólo dibuja el evento que el motor ya
 *                          resolvió; nunca decide una cosecha.
 *   4. PERSISTENCIA      — con freno, más un guardado inmediato en los
 *                          momentos que importan (compra, edición, fin).
 *
 * El estado vive en un `useRef` mutable y React se entera por un
 * contador de versión. Clonar el campo entero sesenta veces por segundo
 * sólo para que React note un cambio es basura pura para el recolector.
 */
import { ArrowLeft } from "lucide-react";
import "../../styles/vivero.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarraMejoras, type ClaveTienda } from "../../components/automatizacion/BarraMejoras";
import { CampoCristales, type EventoCampo } from "../../components/automatizacion/CampoCristales";
import { EditorBloques, crearNodo, type Pieza, type RefPila } from "../../components/automatizacion/EditorBloques";
import { crearInterprete, type Interprete } from "../../utils/automatizacion/interprete";
import { proximoObjetivo, textoCosto } from "../../data/automatizacion/descubrimientos";
import { IcoContadorMas, IcoMineral, IcoProduccion } from "../../components/automatizacion/IconosAuto";
import {
  AJUSTES,
  MINERALES,
  ORDEN_MINERALES,
  type ClaveMejora,
  type Mineral,
} from "../../data/automatizacion/balance";
import { useAuth } from "../../hooks/useAuth";
import { assets } from "../../utils/assets";
import {
  guardadorConFreno,
  repositorioLocal,
  validarCampo,
  leerAvisoGuardado,
} from "../../utils/automatizacion/almacenamiento";
import {
  actualizarRecord,
  avanzarMundo,
  capacidad,
  capacidadUsadaCampo,
  comprar,
  ejecutarPaso,
  estadoInicial,
  evolucionar,
  indice,
  mineralDisponible,
  msPorAccion,
  piezasCompradas,
  plantables,
  puntoRutinaPorDefecto,
  tasaReciente,
  tieneRepetir,
  type EstadoCampo,
  crecimientoDe,
  msPorEtapaDe,
  valorDe,
} from "../../utils/automatizacion/motor";
import {
  buscarNodo,
  cabeA,
  cierraLaCadena,
  colocar,
  colocarCadena,
  conSensor,
  cortarEn,
  costoDeNodo,
  desplazarNodo,
  esContenedor,
  esDefinicion,
  nuevoId,
  quitarNodo,
  type Destino,
  type NodoDef,
  type NodoPrograma,
  type Programa,
  type Sensor,
  type Veces,
} from "../../utils/automatizacion/programa";

/** Los sensores que se pueden elegir en una pastilla, en el orden en que
 *  se ciclan al tocarla. `es [mineral]` sólo para los minerales que ya
 *  existen en esta isla. */
function sensoresDisponibles(e: EstadoCampo): Sensor[] {
  const lista: Sensor[] = [
    { tipo: "listo" },
    { tipo: "listo", no: true },
    { tipo: "vacia" },
    { tipo: "vacia", no: true },
  ];
  for (const m of ORDEN_MINERALES) if (mineralDisponible(e, m)) lista.push({ tipo: "es", mineral: m });
  lista.push({ tipo: "borde" }, { tipo: "borde", no: true });
  /* `contador es N` es también la forma booleana de `tamaño del campo`
     (design.md): el valor por defecto es 0 y se cicla después con la
     ranura numérica del bloque, nunca con esta pastilla. */
  if (piezasCompradas(e).contador) {
    lista.push(
      { tipo: "contador", valor: AJUSTES.opcionesContador[0] },
      { tipo: "contador", valor: AJUSTES.opcionesContador[0], no: true },
    );
  }
  return lista;
}

/** Las dos listas de valores que puede ciclar una ranura numérica:
 *  `[...opciones, "lado"]`. `tamaño del campo` se agrega siempre al
 *  final, nunca un tercer mecanismo de ciclado (design.md). */
const OPCIONES_VECES_REPETIR: readonly Veces[] = [...AJUSTES.opcionesRepetir, "lado"];
const OPCIONES_VECES_CONTADOR: readonly Veces[] = [...AJUSTES.opcionesContador, "lado"];

function siguienteVeces(actual: Veces, opciones: readonly Veces[]): Veces {
  const i = opciones.findIndex((o) => o === actual);
  return opciones[(i + 1) % opciones.length];
}

const mismoSensor = (a: Sensor, b: Sensor) =>
  a.tipo === b.tipo && (a.mineral ?? null) === (b.mineral ?? null) && !!a.no === !!b.no;

const copiarEditor = (e: EstadoCampo) => JSON.stringify({ programa: e.programa, rutinas: e.rutinas, pilasSueltas: e.pilasSueltas, lienzo: e.lienzo });
const nuevaMuestra = (e: EstadoCampo) => ({ inicio: e.relojMs, valor: 0, pasos: 0, vacias: 0, rotos: 0, plantas: 0 });

export function AutomatizacionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const usuario = user?.id ? String(user.id) : null;

  const estadoRef = useRef<EstadoCampo | null>(null);
  if (estadoRef.current === null) {
    estadoRef.current = repositorioLocal.cargar(usuario) ?? estadoInicial();
  }
  const e = estadoRef.current;
  const [anuncio, setAnuncio] = useState<{ titulo: string; texto: string; mineral: Mineral } | null>(null);
  useEffect(() => {
    if (!anuncio) return;
    const timer = window.setTimeout(() => setAnuncio(null), 5000);
    return () => window.clearTimeout(timer);
  }, [anuncio]);

  const [reinicios, setReinicios] = useState(0);
  const reiniciar = () => {
    detener();
    guardador.current.cerrar();
    repositorioLocal.borrar(usuario);
    Object.assign(e, estadoInicial());
    historial.current = { atras: [], adelante: [], actual: copiarEditor(e) };
    muestra.current = nuevaMuestra(e);
    setAnteriorMuestra(null); setEvento(null);
    setMensaje("Toca Cosechar y después Empezar.");
    guardador.current.pedir(usuario, e, true);
    setReinicios(n => n + 1); repintar();
  };

  const [version, setVersion] = useState(0);
  const repintar = useCallback(() => setVersion((v) => v + 1), []);

  const [corriendo, setCorriendo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausaRef = useRef(false);
  const interpreteRef = useRef<Interprete | null>(null);
  const [velocidad, setVelocidad] = useState(1);
  const velocidadRef = useRef(1);
  velocidadRef.current = velocidad;
  const [mensaje, setMensaje] = useState("La Chispa del muelle ya está lista para cosechar.");
  const [ayuda, setAyuda] = useState(false);
  const guiaRef = useRef<HTMLDialogElement>(null);
  const [anteriorMuestra, setAnteriorMuestra] = useState<ReturnType<typeof nuevaMuestra> | null>(null);
  const muestra = useRef(nuevaMuestra(e));
  const historial = useRef({ atras: [] as string[], adelante: [] as string[], actual: copiarEditor(e) });
  const archivoRef = useRef<HTMLInputElement>(null);
  const [nodoActivo, setNodoActivo] = useState<string | null>(null);
  /* El contador de la corrida, sólo para el HUD: vive en el intérprete
     (interprete.ts), nunca en `EstadoCampo` — arranca en null porque
     fuera de una corrida no hay contador que mostrar. */
  const [contadorActivo, setContadorActivo] = useState<number | null>(null);
  /* El último evento que vale la pena ANIMAR en el campo: una cosecha,
     una cosecha en vacío o un choque. Lleva un número de orden para que
     dos cosechas seguidas se dibujen las dos y no una sola. */
  const [evento, setEvento] = useState<EventoCampo | null>(null);
  const contadorEventos = useRef(0);
  const corridaRef = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardador = useRef(guardadorConFreno(repositorioLocal));

  useEffect(() => {
    if (ayuda) guiaRef.current?.showModal();
    else guiaRef.current?.close();
  }, [ayuda]);

  /* ---------------- 1 · el reloj del mundo ---------------- */
  useEffect(() => {
    let anterior = performance.now();
    let cuadro = 0;
    let acumulado = 0;

    const paso = (ahora: number) => {
      const dt = ahora - anterior;
      anterior = ahora;

      // Con la pestaña oculta rAF no corre, así que el mundo se congela
      // solo. El recorte de `avanzarMundo` cubre el salto del regreso.
      if (!document.hidden && !pausaRef.current) {
        const cambio = avanzarMundo(e, dt);
        acumulado += dt;
        // Repintar en cada cuadro sería tirar trabajo: el campo sólo
        // cambia cuando una veta sube de etapa. Cada 400 ms se repinta
        // igual para que la tasa por minuto no quede congelada.
        if (cambio || acumulado > 400) {
          acumulado = 0;
          guardador.current.pedir(usuario, e);
          repintar();
        }
      }
      cuadro = requestAnimationFrame(paso);
    };

    cuadro = requestAnimationFrame(paso);
    const alVolver = () => {
      anterior = performance.now();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      cancelAnimationFrame(cuadro);
      document.removeEventListener("visibilitychange", alVolver);
      guardador.current.cerrar();
    };
  }, [e, repintar, usuario]);

  /* ---------------- 2 · el ejecutor ---------------- */
  const detener = useCallback(() => {
    corridaRef.current += 1; // invalida cualquier callback en vuelo
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setCorriendo(false);
    setPausado(false);
    pausaRef.current = false;
    interpreteRef.current = null;
    setNodoActivo(null);
    setContadorActivo(null);
    /* La nave NO vuelve al muelle al detener: queda donde la dejó el
       programa. Es la única forma de ver dónde terminó de verdad, que es
       justo lo que hay que mirar cuando algo salió distinto de lo
       esperado. Empezar tampoco la devuelve: la corrida siguiente
       arranca desde ahí mismo. */
    actualizarRecord(e);
    guardador.current.pedir(usuario, e, true);
    repintar();
  }, [e, repintar, usuario]);

  const pausar = useCallback(() => {
    corridaRef.current += 1;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    pausaRef.current = true;
    setPausado(true);
    setCorriendo(false);
    guardador.current.pedir(usuario, e, true);
  }, [e, usuario]);

  const empezar = useCallback((unPaso = false) => {
    if (corriendo || (!interpreteRef.current && e.programa.length === 0)) return;

    corridaRef.current += 1;
    const token = corridaRef.current;
    setCorriendo(true);
    pausaRef.current = false;
    setPausado(false);
    setContadorActivo(0);
    /* La nave NO vuelve al muelle al empezar: la corrida arranca desde
       donde quedó parada. Es una decisión explícita del usuario —
       encadenar una corrida con la anterior, o retomar desde donde la
       dejó una corrida detenida, sin tener que reacomodar el campo. */
    repintar();

    /* El intérprete mira el campo en cada paso: un `Si` decide con la
       baldosa que hay debajo en ese momento, no con la de cuando se
       apretó Empezar. Los tics (vueltas vacías de un bucle) duran un
       cuarto de turno y sólo hacen latir al contenedor. */
    if (!interpreteRef.current) {
      if (muestra.current.pasos) setAnteriorMuestra({ ...muestra.current });
      muestra.current = nuevaMuestra(e);
      interpreteRef.current = crearInterprete(e.programa, e);
    }
    const interprete = interpreteRef.current;
    const programar = (ms: number) => {
      if (unPaso) {
        // En depuración el mundo sólo avanza el tiempo de esta instrucción.
        for (let pendiente = ms; pendiente > 0; pendiente -= AJUSTES.dtMaximoMs) avanzarMundo(e, Math.min(pendiente, AJUSTES.dtMaximoMs));
        pausar();
        repintar();
      } else temporizador.current = setTimeout(siguiente, ms / velocidadRef.current);
    };
    const siguiente = () => {
      if (token !== corridaRef.current) return; // corrida vieja: se ignora
      if (document.hidden) { pausar(); return; }
      const p = interprete.siguiente();
      if (!p) {
        setMensaje(`Programa terminado · ${muestra.current.valor} de valor recogido. La nave se queda en su última baldosa.`);
        detener();
        return;
      }
      setNodoActivo(p.nodoId);
      setContadorActivo(interprete.contador);
      muestra.current.pasos += 1;
      if (p.tipo === "tick") {
        setMensaje("El bucle está esperando: todavía no ejecutó una acción útil.");
        programar(Math.max(80, Math.round(msPorAccion(e) / 4)));
        return;
      }
      if (p.tipo === "counter") {
        // `Contador +1` / `Contador = 0`: un turno entero, sin evento de
        // campo — nunca llega a `ejecutarPaso` (PROGRESION.md §6).
        repintar();
        programar(msPorAccion(e));
        return;
      }
      // La variedad se lee ANTES del paso: al cosechar, la veta vuelve a
      // cero y cambia de mineral, y lo que se ve subir hacia la nave
      // tiene que ser el cristal que había, no el que va a brotar.
      const aqui = indice(e, e.nave.fila, e.nave.col);
      const antes = e.celdas[aqui];
      const variante = antes?.variante ?? p.mineral ?? "punta";
      const etapaPrevia = antes?.etapa ?? 0;
      const ev = ejecutarPaso(e, p.nodoId, p.tipo, Math.random, p.mineral);
      if (ev.tipo === "harvest") { muestra.current.valor += ev.premio; setMensaje(`+${ev.premio} de ${MINERALES[variante].nombre}. ${MINERALES[variante].rebrotaSolo ? "Ya está rebrotando." : "La tierra está vacía: vuelve a plantar."}`); }
      else if (ev.tipo === "empty_harvest") { muestra.current.vacias++; setMensaje(ev.motivo === "creciendo" ? "Todavía está creciendo. Espera a «Lista» o usa un sensor." : "Aquí no hay nada plantado. Prepara tu bloque Plantar."); }
      else if (ev.tipo === "break") { muestra.current.rotos++; setMensaje(`${MINERALES[variante].nombre} se rompió por cosecharlo verde. Usa «Si está listo».`); }
      else if (ev.tipo === "plant_fail") { muestra.current.vacias++; setMensaje(ev.motivo === "ocupada" ? "La baldosa está ocupada. Usa Preparar tierra antes de plantar." : ev.motivo === "semillas" ? "No alcanza para las semillas. Cosecha recursos o replanta Chispa/Cuarzo gratis." : ev.motivo === "espacio" ? "Hay otra Estrella al lado: deja una baldosa de separación." : "Esta siembra aún no está disponible."); }
      else if (ev.tipo === "plant") { muestra.current.plantas++; setMensaje(`${MINERALES[variante].nombre} plantado. Mira la cuenta atrás de la baldosa.`); }
      else if (ev.tipo === "clear") setMensaje("Tierra preparada. Plantar Chispa y Cuarzo es gratis; los otros minerales necesitan semillas.");
      else if (ev.tipo === "wrap") setMensaje("Cruzaste el borde: la nave reaparece en el lado opuesto de la misma fila o columna.");
      else if (ev.tipo === "wait") setMensaje("Esperando un turno: los cristales siguen creciendo.");
      else setMensaje(`Nave en fila ${e.nave.fila + 1}, columna ${e.nave.col + 1}.`);
      /* `move`, `turn` y `wait` no dejan nada que dibujar en el campo: la
         posición y el rumbo ya viajan en el estado. `wrap` sí PASA, y
         tiene que pasar: es el único aviso que recibe el campo de que
         este traslado cruza la isla entera y va con la transición corta.
         El paso dura lo mismo que cualquier otro (`msPorAccion`). */
      if (ev.tipo !== "move" && ev.tipo !== "turn" && ev.tipo !== "wait") {
        contadorEventos.current += 1;
        setEvento({
          n: contadorEventos.current,
          tipo: ev.tipo,
          celda: ev.celda ?? aqui,
          variante: ev.mineral ?? variante,
          etapaPrevia,
          premio: ev.premio,
        });
      }
      repintar();
      programar(msPorAccion(e));
    };
    // Un respiro antes del primer paso: el chico tiene que ver salir la
    // nave del muelle, no encontrarla ya en movimiento.
    if (unPaso) siguiente();
    else temporizador.current = setTimeout(siguiente, 260);
  }, [corriendo, detener, e, repintar, pausar]);

  useEffect(() => {
    const alOcultarse = () => { if (document.hidden && corriendo) { pausar(); setMensaje("Pausa al cambiar de pestaña. Pulsa Continuar para retomar."); } };
    document.addEventListener("visibilitychange", alOcultarse);
    return () => document.removeEventListener("visibilitychange", alOcultarse);
  }, [corriendo, pausar]);

  useEffect(() => {
    // Al desmontar no puede quedar ni un temporizador ni una corrida.
    return () => {
      corridaRef.current += 1;
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  /* ---------------- edición del campo ---------------- */
  /* Nativo desde la tarea 2b.5: el puente temporal de la tarea 1.9 —que
   * fusionaba `e.rutinas` y `e.programa` para dibujar y volvía a
   * separarlos en cada edición— se borró. `EditorBloques` recibe las tres
   * pilas del lienzo por separado y edita cualquiera de ellas por su
   * `RefPila` (verde / rutina / suelta): `guardarYRepintar` es el único
   * punto de guardado + repintado, común a las nueve operaciones de acá
   * abajo. */
  const guardarYRepintar = useCallback(() => {
    const nuevo = copiarEditor(e);
    if (nuevo !== historial.current.actual) {
      historial.current.atras.push(historial.current.actual);
      if (historial.current.atras.length > 50) historial.current.atras.shift();
      historial.current.actual = nuevo;
      historial.current.adelante = [];
      // The interpreter owns its snapshot until Detener or completion.
    }
    guardador.current.pedir(usuario, e, true);
    repintar();
  }, [e, repintar, usuario]);

  const viajarHistorial = (direccion: "atras" | "adelante") => {
    const h = historial.current;
    const destino = h[direccion].pop();
    if (!destino) return;
    h[direccion === "atras" ? "adelante" : "atras"].push(copiarEditor(e));
    Object.assign(e, JSON.parse(destino));
    h.actual = destino;
    guardador.current.pedir(usuario, e, true);
    repintar();
    setMensaje("Programa restaurado. Los recursos y el campo no se deshacen.");
  };

  /** La lista viva de una pila, por su referencia. `[]` si esa rutina o
   *  pila suelta ya no existe: nunca revienta, sólo no encuentra nada. */
  const listaDeRef = useCallback(
    (ref: RefPila): NodoPrograma[] => {
      if (ref.donde === "verde") return e.programa;
      if (ref.donde === "rutina") return e.rutinas.find((r) => r.id === ref.id)?.body ?? [];
      return e.pilasSueltas.find((p) => p.id === ref.id)?.nodos ?? [];
    },
    [e],
  );

  /** Reemplaza la lista de una pila por una nueva. Una pila suelta que
   *  queda vacía se descarta —una idea que se vació de todo su contenido
   *  no es una pila, es nada—; una `Mi rutina` NUNCA se descarta así,
   *  aunque su cuerpo quede vacío: sigue siendo una rutina definida. */
  const fijarListaDeRef = useCallback(
    (ref: RefPila, lista: NodoPrograma[]) => {
      if (ref.donde === "verde") {
        e.programa = lista;
      } else if (ref.donde === "rutina") {
        e.rutinas = e.rutinas.map((r) => (r.id === ref.id ? { ...r, body: lista } : r));
      } else if (lista.length === 0) {
        e.pilasSueltas = e.pilasSueltas.filter((p) => p.id !== ref.id);
      } else {
        e.pilasSueltas = e.pilasSueltas.map((p) => (p.id === ref.id ? { ...p, nodos: lista } : p));
      }
    },
    [e],
  );

  /** En qué pila vive `id`, mirando la cadena verde, cada cuerpo de
   *  `Mi rutina` y cada pila suelta, en ese orden. `null` si no está en
   *  ninguna (el bloque ya no existe: la llamada simplemente no hace
   *  nada, nunca revienta). */
  const ubicarPorId = useCallback(
    (id: string): RefPila | null => {
      if (buscarNodo(e.programa, id)) return { donde: "verde" };
      for (const r of e.rutinas) if (buscarNodo(r.body, id)) return { donde: "rutina", id: r.id };
      for (const p of e.pilasSueltas) if (buscarNodo(p.nodos, id)) return { donde: "suelta", id: p.id };
      return null;
    },
    [e],
  );

  /** Edita la lista que contiene a `id`, sea cual sea la pila. */
  const editarPorId = useCallback(
    (id: string, editor: (lista: NodoPrograma[]) => NodoPrograma[]) => {
      const ref = ubicarPorId(id);
      if (!ref) return;
      const lista = listaDeRef(ref);
      const nueva = editor(lista);
      if (nueva !== lista) fijarListaDeRef(ref, nueva);
    },
    [ubicarPorId, listaDeRef, fijarListaDeRef],
  );

  /** Una `Mi rutina` nueva SIEMPRE nace en `rutinas`, nunca en la cadena
   *  verde ni en una pila suelta (L14: una rutina jamás es pila suelta) —
   *  ni tocada en la caja, ni arrastrada y soltada sobre un conector, ni
   *  soltada en el vacío. Arrastrarla no elige DÓNDE cae, sólo QUE exista;
   *  nace en su fila por defecto (la misma que usa la migración v1/v2→v3,
   *  motor.ts). Devuelve `true` si el nodo era una definición (y ya quedó
   *  resuelto), para que el llamador no siga procesándolo. */
  const agregarRutinaSiCorresponde = useCallback(
    (nodo: NodoPrograma): boolean => {
      if (!esDefinicion(nodo)) return false;
      e.rutinas = [...e.rutinas, nodo];
      if (!e.lienzo.rutinas[nodo.id]) {
        e.lienzo = { ...e.lienzo, rutinas: { ...e.lienzo.rutinas, [nodo.id]: puntoRutinaPorDefecto(e.rutinas.length - 1) } };
      }
      return true;
    },
    [e],
  );

  const agregar = useCallback(
    (pieza: Pieza, pila?: RefPila, destino?: Destino) => {
      const nodo: NodoPrograma = crearNodo(pieza, nuevoId());
      // La memoria es de TODO el lienzo (PROGRESION.md §11): la cadena
      // verde, las rutinas y las pilas sueltas.
      if (capacidadUsadaCampo(e) + costoDeNodo(nodo) > capacidad(e)) return;
      if (agregarRutinaSiCorresponde(nodo)) {
        guardarYRepintar();
        return;
      }
      if (pila && destino) {
        // Arrastrada desde la caja hasta un conector: cae ahí mismo.
        const lista = listaDeRef(pila);
        const nueva = colocar(lista, nodo, destino);
        if (nueva === lista) return; // el anidamiento no lo permite
        fijarListaDeRef(pila, nueva);
        guardarYRepintar();
        return;
      }
      // Tocada: al final de la cadena verde. Si el último bloque de la
      // cadena verde es un contenedor y la pieza es una acción, entra
      // ADENTRO — es lo que uno espera después de poner un `Repetir` o
      // un `Si` vacío.
      const ultimo = e.programa[e.programa.length - 1];
      if (ultimo && esContenedor(ultimo) && !esContenedor(nodo)) {
        const adentro = colocar(e.programa, nodo, { tipo: "dentro", id: ultimo.id });
        if (adentro !== e.programa) {
          e.programa = adentro;
          guardarYRepintar();
          return;
        }
      }
      /* Debajo de un `Por siempre` no va nada (`destinoBloqueado`,
         programa.ts). Este encadenado al final es el ÚNICO camino que no
         pasa por `colocar`, así que la guarda se repite acá o el toque se
         escapa de la regla. El editor ya sacude la pieza para que el
         chico no quede tocando algo que no responde. */
      if (cierraLaCadena(ultimo)) return;
      e.programa = [...e.programa, nodo];
      guardarYRepintar();
    },
    [corriendo, e, agregarRutinaSiCorresponde, listaDeRef, fijarListaDeRef, guardarYRepintar],
  );

  /** Corta la cadena de `id` en `origen` y la encastra en `destino`,
   *  adentro de `destinoPila` (la misma pila también vale: reordenar). */
  const moverCadena = useCallback(
    (origen: RefPila, id: string, destinoPila: RefPila, destino: Destino) => {
      const corte = cortarEn(listaDeRef(origen), id);
      if (!corte) return;
      const mismaPila = origen.donde === destinoPila.donde && (origen.donde === "verde" || (origen as { id: string }).id === (destinoPila as { id: string }).id);
      const listaDestino = mismaPila ? corte.restante : listaDeRef(destinoPila);
      const nuevaDestino = colocarCadena(listaDestino, corte.agarrado, destino);
      if (nuevaDestino === listaDestino) return; // `cabeA` ya lo rechazó del lado del editor; defensivo acá también
      if (mismaPila) {
        fijarListaDeRef(origen, nuevaDestino);
      } else {
        fijarListaDeRef(origen, corte.restante);
        fijarListaDeRef(destinoPila, nuevaDestino);
      }
      guardarYRepintar();
    },
    [corriendo, listaDeRef, fijarListaDeRef, guardarYRepintar],
  );

  /** Corta la cadena de `id` en `origen` y la deja como pila suelta nueva
   *  en (x, y). Los NODOS conservan su id (L15); sólo la `Pila` que los
   *  envuelve es nueva. */
  const soltarCadena = useCallback(
    (origen: RefPila, id: string, x: number, y: number) => {
      const corte = cortarEn(listaDeRef(origen), id);
      if (!corte) return;
      if (!cabeA(corte.agarrado, 0)) return; // el lienzo es profundidad 0
      fijarListaDeRef(origen, corte.restante);
      e.pilasSueltas = [...e.pilasSueltas, { id: nuevoId(), x, y, nodos: corte.agarrado }];
      guardarYRepintar();
    },
    [corriendo, e, listaDeRef, fijarListaDeRef, guardarYRepintar],
  );

  /** Borra la cadena de `id` en `origen` ENTERA: el tachito y la paleta
   *  (tareas 3.1/3.2) son los dos únicos actos de borrado del lienzo.
   *  `cortarEn` ya se lleva el bloque y todo lo que cuelga debajo —la
   *  misma cadena que agarraría un arrastre— y acá simplemente se
   *  descarta ese pedazo en vez de volver a colocarlo en algún lado.
   *  `fijarListaDeRef` ya tira sola una pila suelta que quedó vacía, así
   *  que la memoria liberada es automática: `capacidadUsadaCampo` la lee
   *  de `e` en cada repintado, nunca de un contador aparte. */
  const borrarCadena = useCallback(
    (origen: RefPila, id: string) => {
      const corte = cortarEn(listaDeRef(origen), id);
      if (!corte) return;
      fijarListaDeRef(origen, corte.restante);
      guardarYRepintar();
    },
    [corriendo, listaDeRef, fijarListaDeRef, guardarYRepintar],
  );

  /** Una pieza nueva de la caja, soltada en el vacío del lienzo: nace
   *  como pila suelta de un solo bloque en (x, y) — salvo que sea una
   *  `Mi rutina`, que jamás es pila suelta (L14). */
  const soltarNueva = useCallback(
    (pieza: Pieza, x: number, y: number) => {
      const nodo = crearNodo(pieza, nuevoId());
      if (capacidadUsadaCampo(e) + costoDeNodo(nodo) > capacidad(e)) return;
      if (agregarRutinaSiCorresponde(nodo)) {
        guardarYRepintar();
        return;
      }
      e.pilasSueltas = [...e.pilasSueltas, { id: nuevoId(), x, y, nodos: [nodo] }];
      guardarYRepintar();
    },
    [corriendo, e, agregarRutinaSiCorresponde, guardarYRepintar],
  );

  /** Tocar la pastilla del sensor pasa al siguiente de la lista. */
  const cambiarSensor = useCallback(
    (id: string) => {
      const opciones = sensoresDisponibles(e);
      const reemplazar = (nodos: Programa): Programa =>
        nodos.map((n) => {
          if (!esContenedor(n)) return n;
          if (n.id === id && conSensor(n)) {
            const i = opciones.findIndex((s) => mismoSensor(s, n.sensor));
            return { ...n, sensor: opciones[(i + 1) % opciones.length] };
          }
          const copia = { ...n, body: reemplazar(n.body) };
          if (n.type === "if" && n.sino) return { ...copia, sino: reemplazar(n.sino) } as NodoPrograma;
          return copia as NodoPrograma;
        });
      editarPorId(id, reemplazar);
      guardarYRepintar();
    },
    [e, editarPorId, guardarYRepintar],
  );

  const quitar = useCallback(
    (id: string) => {
      if (e.rutinas.some(r => r.id === id)) {
        e.rutinas = e.rutinas.filter(r => r.id !== id);
        delete e.lienzo.rutinas[id];
      }
      editarPorId(id, (lista) => quitarNodo(lista, id));
      guardarYRepintar();
    },
    [corriendo, e, editarPorId, guardarYRepintar],
  );

  const desplazar = useCallback(
    (id: string, delta: -1 | 1) => {
      editarPorId(id, (lista) => desplazarNodo(lista, id, delta));
      guardarYRepintar();
    },
    [editarPorId, guardarYRepintar],
  );

  /** Cicla la ranura numérica del nodo tocado: `Repetir.times`,
   *  `call.veces` (sólo si `Hacer A con N` ya lo tiene) o
   *  `sensor.valor` del contador — la página elige el campo y la lista
   *  inspeccionando el nodo, así las tres ranuras comparten un solo
   *  disparador sin agregar un tercer mecanismo de ciclado. */
  const cambiarVeces = useCallback(
    (id: string) => {
      const reemplazar = (nodos: Programa): Programa =>
        nodos.map((n) => {
          if (n.id === id) {
            if (n.type === "repeat") return { ...n, times: siguienteVeces(n.times, OPCIONES_VECES_REPETIR) };
            if (n.type === "call" && n.veces !== undefined) {
              return { ...n, veces: siguienteVeces(n.veces, OPCIONES_VECES_REPETIR) };
            }
            if (conSensor(n) && n.sensor.tipo === "contador") {
              const valor = siguienteVeces(n.sensor.valor ?? AJUSTES.opcionesContador[0], OPCIONES_VECES_CONTADOR);
              return { ...n, sensor: { ...n.sensor, valor } };
            }
            return n;
          }
          if (!esContenedor(n)) return n;
          const copia = { ...n, body: reemplazar(n.body) };
          if (n.type === "if" && n.sino) return { ...copia, sino: reemplazar(n.sino) } as NodoPrograma;
          return copia as NodoPrograma;
        });
      editarPorId(id, reemplazar);
      guardarYRepintar();
    },
    [editarPorId, guardarYRepintar],
  );

  /* ---------------- compras ---------------- */
  const comprarMejora = useCallback(
    (clave: ClaveTienda) => {
      const ok = clave.startsWith("evo_")
        ? evolucionar(e, clave.slice(4) as Mineral)
        : comprar(e, clave as ClaveMejora);
      if (ok) {
        setAnuncio({
          titulo: clave === "campo" ? "¡Tu isla creció!" : "¡Nuevo descubrimiento!",
          texto: clave === "campo" ? (e.lado === 2 ? "Llegaron las flechas y el Cuarzo." : "Más tierra para tus ideas.") : "Ya puedes probar tu mejora.",
          mineral: e.lado >= 4 ? "estrella" : e.lado >= 3 ? "prisma" : e.lado >= 2 ? "racimo" : "punta",
        });
        setMensaje(clave === "campo" ? `Tu isla creció a ${e.lado} × ${e.lado}. Hay tierra nueva arriba y a la derecha. Revisa tu recorrido.` : "Descubrimiento disponible. Mira tu caja de bloques y el siguiente objetivo.");
        guardador.current.pedir(usuario, e, true);
        repintar();
      }
      return ok;
    },
    [corriendo, e, repintar, usuario],
  );

  /* ---------------- pintura ---------------- */
  void version; // el contador es la señal de repintado
  const tasa = tasaReciente(e);
  const objetivo = proximoObjetivo(e);
  const aqui = indice(e, e.nave.fila, e.nave.col);
  const lectura = crecimientoDe(e, aqui);
  const mineralAqui = e.celdas[aqui]?.variante;
  /* Un contador por mineral, y sólo los que ya existen en esta isla o
     que alguna vez se juntaron: la cabecera crece con el juego. */
  const minerales = ORDEN_MINERALES.filter((m) => mineralDisponible(e, m) || e.saldos[m] > 0);

  return (
    <main
      className="auto-pantalla animate-page-fade"
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
      aria-label="Modo Automatización"
    >
      <header className="auto-cabecera">
        <button
          type="button"
          onClick={() => navigate("/modos")}
          className="glass flex items-center gap-2 px-4 py-2 rounded-full border-0 cursor-pointer font-bold text-sm text-text shadow-md hover:scale-105 transition-transform"
        >
          <ArrowLeft size={17} /> Volver
        </button>
        <h1 className="auto-titulo">Vivero <small>Isla {e.lado} × {e.lado}</small></h1>

        <div className="auto-saldos">
          {minerales.map((m) => (
            <span
              key={m}
              className="auto-dato text-3xl"
              aria-label={`${e.saldos[m]} de ${MINERALES[m].nombre.toLowerCase()}`}
            >
              <IcoMineral mineral={m} className="w-8 h-8" />
              {e.saldos[m]}
              <small className="auto-nombre-recurso">{MINERALES[m].nombre}</small>
            </span>
          ))}
          {e.relojMs >= 15000 && <span className="auto-dato text-3xl" aria-label={`${tasa.toFixed(1)} de valor por minuto`}>
            <IcoProduccion className="w-6 h-6" />
            {tasa.toFixed(tasa < 10 ? 1 : 0)}
            <small className="text-sm font-bold" style={{ color: "#52658f" }}>
              /min
            </small>
          </span>
          }
          {piezasCompradas(e).contador && corriendo && contadorActivo !== null && (
            <span className="auto-dato text-3xl" aria-label={`Contador: ${contadorActivo}`}>
              <IcoContadorMas className="w-6 h-6" />
              {contadorActivo}
            </span>
          )}
        </div>
      </header>

      <nav className="auto-herramientas" aria-label="Herramientas del programa">
        <span>Tu programa</span>
        {import.meta.env.DEV && <button type="button" className="auto-control" onClick={reiniciar}>Reiniciar prueba</button>}
        <button type="button" className="auto-control" disabled={!historial.current.atras.length} onClick={() => viajarHistorial("atras")}>Deshacer</button>
        <button type="button" className="auto-control" disabled={!historial.current.adelante.length} onClick={() => viajarHistorial("adelante")}>Rehacer</button>
        <button type="button" className="auto-control" aria-expanded={ayuda} onClick={() => setAyuda(!ayuda)}>Guía y progreso</button>
        <button type="button" className="auto-control" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }));
          const a = document.createElement("a"); a.href = url; a.download = "typely-vivero.json"; a.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Guardar copia</button>
        <button type="button" className="auto-control" disabled={corriendo} onClick={() => archivoRef.current?.click()}>Abrir copia</button>
        <input ref={archivoRef} type="file" accept="application/json,.json" hidden onChange={async ev => {
          const file = ev.target.files?.[0]; ev.target.value = "";
          if (!file || corriendo) return;
          if (file.size > 1_000_000) { setMensaje("La copia es demasiado grande (máximo 1 MB)."); return; }
          try {
            const recuperado = validarCampo(JSON.parse(await file.text()));
            if (!recuperado) throw new Error("invalid");
            if (!window.confirm("¿Reemplazar la partida actual por esta copia? Guarda primero una copia de tu partida si quieres conservarla.")) return;
            detener(); Object.assign(e, recuperado);
            historial.current = { atras: [], adelante: [], actual: copiarEditor(e) };
            guardarYRepintar(); setMensaje("Copia recuperada. Revisa el programa antes de empezar.");
          } catch { setMensaje("No se pudo abrir: el archivo no contiene una partida válida de Vivero. Tu partida sigue intacta."); }
        }} />
      </nav>

      <EditorBloques
        key={reinicios}
        programa={e.programa}
        rutinas={e.rutinas}
        pilasSueltas={e.pilasSueltas}
        lienzo={e.lienzo}
        capacidad={capacidad(e)}
        tieneRepetir={tieneRepetir(e)}
        piezas={piezasCompradas(e)}
        plantables={plantables(e)}
        corriendo={false}
        lado={e.lado}
        guiarCosecha={e.acumulado === 0 && e.programa.length === 0}
        nodoActivo={nodoActivo}
        onAgregar={agregar}
        onQuitar={quitar}
        onDesplazar={desplazar}
        onCambiarVeces={cambiarVeces}
        onCambiarSensor={cambiarSensor}
        onMoverCadena={moverCadena}
        onSoltarCadena={soltarCadena}
        onSoltarNueva={soltarNueva}
        onBorrarCadena={borrarCadena}
      />

      <section className="auto-campo" aria-label="El campo">
        <aside className="auto-objetivo auto-vidrio" role={anuncio ? "status" : undefined}>
          {anuncio ? <div className="auto-celebracion"><IcoMineral mineral={anuncio.mineral} /><div><h2>{anuncio.titulo}</h2><p>{anuncio.texto}</p></div><button className="auto-control" onClick={() => setAnuncio(null)} aria-label="Cerrar descubrimiento">×</button></div>
            : <><small>Siguiente descubrimiento</small><h2>{objetivo.titulo}</h2><p>{objetivo.detalle}</p></>}
        </aside>
        <CampoCristales estado={e} evento={evento} corriendo={corriendo} />
        <div className="auto-inspector">
          <strong>{mineralAqui ? MINERALES[mineralAqui].nombre : "Tierra vacía"} · {lectura.estado}{lectura.estado === "creciendo" ? ` · ${lectura.segundos} s` : ""}</strong>
          <small>Debajo de la nave · fila {e.nave.fila + 1}, columna {e.nave.col + 1}</small>
          <p role="status" aria-live="polite">{mensaje}</p>
          {leerAvisoGuardado() && <p role="alert">{leerAvisoGuardado()}</p>}
        </div>
        <div className="auto-ejecucion">
        <button
          type="button"
          className={`auto-empezar${!corriendo && e.acumulado === 0 && e.programa.length ? " auto-guia-pulso" : ""}${corriendo ? " auto-empezar--detener" : ""}`}
          onClick={corriendo ? pausar : () => empezar()}
          disabled={!corriendo && !pausado && e.programa.length === 0}
          aria-describedby="auto-instruccion-empezar"
        >
          {corriendo ? (
            <>
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                <rect x="3" y="3" width="16" height="16" rx="3" fill="currentColor" />
              </svg>
              Pausar
            </>
          ) : (
            <>
              <svg width="24" height="26" viewBox="0 0 24 26" aria-hidden="true">
                <path d="M3 2l18 11L3 24z" fill="currentColor" />
              </svg>
              {pausado ? "Continuar" : "Empezar"}
            </>
          )}
        </button>
        <button type="button" className="auto-control" disabled={corriendo || !e.programa.length} onClick={() => empezar(true)}>Un paso</button>
        <button type="button" className="auto-control" disabled={!corriendo && !pausado} onClick={detener}>Detener</button>
        <select aria-label="Ritmo de ejecución" className="auto-control" value={velocidad} onChange={ev => setVelocidad(Number(ev.target.value))}><option value={1}>Normal</option><option value={0.5}>Lento · ½</option></select>
        </div>
        <div className="auto-metricas" id="auto-instruccion-empezar">{!e.programa.length && !pausado ? "Añade Cosechar debajo de Inicio para empezar. " : corriendo || pausado ? "Puedes editar; los cambios se usarán en la próxima corrida. " : ""}{muestra.current.pasos} pasos · {muestra.current.valor} recogido · {muestra.current.vacias} sin efecto · {muestra.current.rotos} rotos{anteriorMuestra ? ` | Anterior: ${anteriorMuestra.valor} recogido / ${anteriorMuestra.pasos} pasos` : ""}</div>
      </section>

      <BarraMejoras estado={e} onComprar={comprarMejora} bloqueada={false} />
      <dialog ref={guiaRef} className="auto-guia auto-vidrio" aria-label="Guía y progreso" onClose={() => setAyuda(false)}>
        <header><h2>Tu cuaderno de Vivero</h2><button type="button" className="auto-control" onClick={() => setAyuda(false)}>Cerrar</button></header>
        <div className="auto-guia__pasos">
          <article><img src="/assets/automatizacion/ui/inicio.webp" alt="" /><h3>1. Arma</h3><p>Toca Cosechar. Va debajo de Inicio.</p></article>
          <article><img src="/assets/automatizacion/ui/velocidad.webp" alt="" /><h3>2. Prueba</h3><p>Pulsa Empezar y mira tu nave.</p></article>
          <article><img src="/assets/automatizacion/ui/crecimiento.webp" alt="" /><h3>3. Descubre</h3><p>Usa tus cristales para mejorar la isla.</p></article>
        </div>
        <h3>Tus minerales</h3><div className="auto-guia__minerales">{minerales.map(m => <article key={m}><img src={`/assets/automatizacion/cristales/${m}-maduro.webp`} alt="" /><h4>{MINERALES[m].nombre}</h4><p>{MINERALES[m].rebrotaSolo ? "Vuelve a crecer solo." : "Plántalo otra vez."} {MINERALES[m].seRompeVerde ? "Espera a que esté listo." : "No se rompe."}</p><details><summary>Ver números</summary><p>{valorDe(e, m)} por cosecha · {(msPorEtapaDe(e, m) * 3 / 1000).toFixed(1)} s · semillas: {textoCosto(MINERALES[m].semilla ?? {})}.</p></details></article>)}</div>
        <details><summary>Mover, pausar y guardar</summary><p>Arrastra con un dedo; acerca con dos. Deshacer recupera bloques, no cristales. Puedes editar mientras la nave trabaja: usará los cambios al empezar otra corrida.</p><p>Pausar congela el mundo. Detener termina la corrida. La nave sigue desde donde quedó.</p><p>Tu partida se guarda en este navegador. Usa Guardar copia para llevarla a otra computadora.</p></details>
      </dialog>
    </main>
  );
}

export default AutomatizacionPage;
