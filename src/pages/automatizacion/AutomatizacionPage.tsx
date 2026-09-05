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
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarraMejoras, type ClaveTienda } from "../../components/automatizacion/BarraMejoras";
import { CampoCristales, type EventoCampo } from "../../components/automatizacion/CampoCristales";
import { EditorBloques, crearNodo, type Pieza, type RefPila } from "../../components/automatizacion/EditorBloques";
import { crearInterprete } from "../../utils/automatizacion/interprete";
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
  volverAlOrigen,
  type EstadoCampo,
} from "../../utils/automatizacion/motor";
import {
  buscarNodo,
  cabeA,
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

export function AutomatizacionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const usuario = user?.id ? String(user.id) : null;

  const estadoRef = useRef<EstadoCampo | null>(null);
  if (estadoRef.current === null) {
    estadoRef.current = repositorioLocal.cargar(usuario) ?? estadoInicial();
  }
  const e = estadoRef.current;

  const [version, setVersion] = useState(0);
  const repintar = useCallback(() => setVersion((v) => v + 1), []);

  const [corriendo, setCorriendo] = useState(false);
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
      if (!document.hidden) {
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
    setNodoActivo(null);
    setContadorActivo(null);
    setEvento(null);
    volverAlOrigen(e);
    actualizarRecord(e);
    guardador.current.pedir(usuario, e, true);
    repintar();
  }, [e, repintar, usuario]);

  const empezar = useCallback(() => {
    if (corriendo || e.programa.length === 0) return;

    corridaRef.current += 1;
    const token = corridaRef.current;
    setCorriendo(true);
    setContadorActivo(0);
    volverAlOrigen(e);
    repintar();

    /* El intérprete mira el campo en cada paso: un `Si` decide con la
       baldosa que hay debajo en ese momento, no con la de cuando se
       apretó Empezar. Los tics (vueltas vacías de un bucle) duran un
       cuarto de turno y sólo hacen latir al contenedor. */
    const interprete = crearInterprete(e.programa, e);
    const siguiente = () => {
      if (token !== corridaRef.current) return; // corrida vieja: se ignora
      const p = interprete.siguiente();
      if (!p) {
        detener();
        return;
      }
      setNodoActivo(p.nodoId);
      setContadorActivo(interprete.contador);
      if (p.tipo === "tick") {
        temporizador.current = setTimeout(siguiente, Math.max(80, Math.round(msPorAccion(e) / 4)));
        return;
      }
      if (p.tipo === "counter") {
        // `Contador +1` / `Contador = 0`: un turno entero, sin evento de
        // campo — nunca llega a `ejecutarPaso` (PROGRESION.md §6).
        repintar();
        temporizador.current = setTimeout(siguiente, msPorAccion(e));
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
      temporizador.current = setTimeout(siguiente, msPorAccion(e));
    };
    // Un respiro antes del primer paso: el chico tiene que ver salir la
    // nave del muelle, no encontrarla ya en movimiento.
    temporizador.current = setTimeout(siguiente, 260);
  }, [corriendo, detener, e, repintar]);

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
    guardador.current.pedir(usuario, e, true);
    repintar();
  }, [e, repintar, usuario]);

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
      if (corriendo) return;
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
      e.programa = [...e.programa, nodo];
      guardarYRepintar();
    },
    [corriendo, e, agregarRutinaSiCorresponde, listaDeRef, fijarListaDeRef, guardarYRepintar],
  );

  /** Corta la cadena de `id` en `origen` y la encastra en `destino`,
   *  adentro de `destinoPila` (la misma pila también vale: reordenar). */
  const moverCadena = useCallback(
    (origen: RefPila, id: string, destinoPila: RefPila, destino: Destino) => {
      if (corriendo) return;
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
      if (corriendo) return;
      const corte = cortarEn(listaDeRef(origen), id);
      if (!corte) return;
      if (!cabeA(corte.agarrado, 0)) return; // el lienzo es profundidad 0
      fijarListaDeRef(origen, corte.restante);
      e.pilasSueltas = [...e.pilasSueltas, { id: nuevoId(), x, y, nodos: corte.agarrado }];
      guardarYRepintar();
    },
    [corriendo, e, listaDeRef, fijarListaDeRef, guardarYRepintar],
  );

  /** Una pieza nueva de la caja, soltada en el vacío del lienzo: nace
   *  como pila suelta de un solo bloque en (x, y) — salvo que sea una
   *  `Mi rutina`, que jamás es pila suelta (L14). */
  const soltarNueva = useCallback(
    (pieza: Pieza, x: number, y: number) => {
      if (corriendo) return;
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
      editarPorId(id, (lista) => quitarNodo(lista, id));
      guardarYRepintar();
    },
    [editarPorId, guardarYRepintar],
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
      if (corriendo) return false;
      const ok = clave.startsWith("evo_")
        ? evolucionar(e, clave.slice(4) as Mineral)
        : comprar(e, clave as ClaveMejora);
      if (ok) {
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

        <div className="auto-saldos">
          {minerales.map((m) => (
            <span
              key={m}
              className="auto-dato text-3xl"
              aria-label={`${e.saldos[m]} de ${MINERALES[m].nombre.toLowerCase()}`}
            >
              <IcoMineral mineral={m} className="w-8 h-8" />
              {e.saldos[m]}
            </span>
          ))}
          <span className="auto-dato text-3xl" aria-label={`${tasa.toFixed(1)} de valor por minuto`}>
            <IcoProduccion className="w-6 h-6" />
            {tasa.toFixed(tasa < 10 ? 1 : 0)}
            <small className="text-sm font-bold" style={{ color: "#52658f" }}>
              /min
            </small>
          </span>
          {corriendo && contadorActivo !== null && (
            <span className="auto-dato text-3xl" aria-label={`Contador: ${contadorActivo}`}>
              <IcoContadorMas className="w-6 h-6" />
              {contadorActivo}
            </span>
          )}
        </div>
      </header>

      <EditorBloques
        programa={e.programa}
        rutinas={e.rutinas}
        pilasSueltas={e.pilasSueltas}
        lienzo={e.lienzo}
        capacidad={capacidad(e)}
        tieneRepetir={tieneRepetir(e)}
        piezas={piezasCompradas(e)}
        plantables={plantables(e)}
        corriendo={corriendo}
        nodoActivo={nodoActivo}
        onAgregar={agregar}
        onQuitar={quitar}
        onDesplazar={desplazar}
        onCambiarVeces={cambiarVeces}
        onCambiarSensor={cambiarSensor}
        onMoverCadena={moverCadena}
        onSoltarCadena={soltarCadena}
        onSoltarNueva={soltarNueva}
      />

      <section className="auto-campo" aria-label="El campo">
        <CampoCristales estado={e} evento={evento} corriendo={corriendo} />
        <button
          type="button"
          className={`auto-empezar${corriendo ? " auto-empezar--detener" : ""}`}
          onClick={corriendo ? detener : empezar}
          disabled={!corriendo && e.programa.length === 0}
        >
          {corriendo ? (
            <>
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                <rect x="3" y="3" width="16" height="16" rx="3" fill="currentColor" />
              </svg>
              Detener
            </>
          ) : (
            <>
              <svg width="24" height="26" viewBox="0 0 24 26" aria-hidden="true">
                <path d="M3 2l18 11L3 24z" fill="currentColor" />
              </svg>
              Empezar
            </>
          )}
        </button>
      </section>

      <BarraMejoras estado={e} onComprar={comprarMejora} />
    </main>
  );
}

export default AutomatizacionPage;
