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
import { EditorBloques, crearNodo, type Pieza } from "../../components/automatizacion/EditorBloques";
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
  colocar,
  conSensor,
  costoDeNodo,
  desplazarNodo,
  esContenedor,
  esDefinicion,
  moverNodo,
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
  /* PUENTE TEMPORAL (Lienzo, tarea 1.9 — se borra en la tarea 2b.5).
   *
   * `EditorBloques` todavía edita un `Programa` en lista, no un lienzo con
   * rutinas aparte (el DIBUJO ya las separa para el lienzo — tarea 2a.6 —
   * pero la edición sigue viajando fusionada). Mientras tanto le pasamos
   * la UNIÓN de `e.rutinas` (las `Mi rutina`, siempre primero) y
   * `e.programa` (la cadena verde), y en cada edición volvemos a
   * separarlas: los `def` vuelven a `rutinas`, todo lo demás vuelve a
   * `programa`. Sin esto, una partida migrada a v3 dejaría de mostrarle
   * al chico su propia rutina aunque `Hacer A` la siga ejecutando — una
   * regresión visible que la migración no puede introducir en silencio. */
  const cambiarCampo = useCallback(
    (fn: (p: Programa) => Programa) => {
      if (corriendo) return;
      const fusion = fn([...e.rutinas, ...e.programa]);
      e.rutinas = fusion.filter(esDefinicion) as NodoDef[];
      e.programa = fusion.filter((n) => !esDefinicion(n));
      // Toda `Mi rutina` nueva necesita un lugar en el lienzo: la misma
      // fila por defecto que usa la migración v1/v2→v3 (motor.ts).
      e.rutinas.forEach((d, i) => {
        if (!e.lienzo.rutinas[d.id]) e.lienzo.rutinas[d.id] = puntoRutinaPorDefecto(i);
      });
      guardador.current.pedir(usuario, e, true);
      repintar();
    },
    [corriendo, e, repintar, usuario],
  );

  const agregar = useCallback(
    (pieza: Pieza, destino?: Destino) => {
      const nodo: NodoPrograma = crearNodo(pieza, nuevoId());

      cambiarCampo((p) => {
        // La memoria es de TODO el lienzo (PROGRESION.md §11): la cadena
        // verde, las rutinas y las pilas sueltas — no sólo `p`.
        if (capacidadUsadaCampo(e) + costoDeNodo(nodo) > capacidad(e)) return p;
        // Arrastrada: cae donde el chico la soltó.
        if (destino) return colocar(p, nodo, destino);
        // Tocada: al final DE LA CADENA VERDE —no de la fusión con las
        // rutinas, que sólo existe para que el puente temporal le siga
        // mostrando sus rutinas al chico. Si el último bloque de la
        // cadena verde es un contenedor y la pieza es una acción, entra
        // ADENTRO — es lo que uno espera después de poner un `Repetir` o
        // un `Si` vacío. (Si la cadena verde está vacía y sólo hay
        // rutinas, `ultimo` es `undefined` y el bloque cae al final,
        // nunca adentro de una `Mi rutina` ajena.)
        const ultimo = e.programa[e.programa.length - 1];
        if (ultimo && esContenedor(ultimo) && !esContenedor(nodo)) {
          const adentro = colocar(p, nodo, { tipo: "dentro", id: ultimo.id });
          if (adentro !== p) return adentro;
        }
        return [...p, nodo];
      });
    },
    [cambiarCampo, e],
  );

  /** Tocar la pastilla del sensor pasa al siguiente de la lista. */
  const cambiarSensor = useCallback(
    (id: string) =>
      cambiarCampo((p) => {
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
        return reemplazar(p);
      }),
    [cambiarCampo, e],
  );

  const quitar = useCallback(
    (id: string) => cambiarCampo((p) => quitarNodo(p, id)),
    [cambiarCampo],
  );

  const mover = useCallback(
    (id: string, destino: Destino) => cambiarCampo((p) => moverNodo(p, id, destino)),
    [cambiarCampo],
  );

  const desplazar = useCallback(
    (id: string, delta: -1 | 1) => cambiarCampo((p) => desplazarNodo(p, id, delta)),
    [cambiarCampo],
  );

  /** Cicla la ranura numérica del nodo tocado: `Repetir.times`,
   *  `call.veces` (sólo si `Hacer A con N` ya lo tiene) o
   *  `sensor.valor` del contador — la página elige el campo y la lista
   *  inspeccionando el nodo, así las tres ranuras comparten un solo
   *  disparador sin agregar un tercer mecanismo de ciclado. */
  const cambiarVeces = useCallback(
    (id: string) =>
      cambiarCampo((p) => {
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
        return reemplazar(p);
      }),
    [cambiarCampo],
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
        // PUENTE TEMPORAL (tarea 1.9, se borra en la tarea 2b.5): rutinas
        // primero, cadena verde después — ver el comentario en
        // `cambiarCampo` más arriba.
        programa={[...e.rutinas, ...e.programa]}
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
        onMover={mover}
        onDesplazar={desplazar}
        onCambiarVeces={cambiarVeces}
        onCambiarSensor={cambiarSensor}
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
