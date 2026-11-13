import { AJUSTES, MINERALES, precioMejora, type ClaveMejora, type Costo, type Mineral } from "./balance";
import { reveladas, type EstadoCampo } from "../../utils/automatizacion/motor";

export const NOMBRES_MEJORA: Record<ClaveMejora, string> = {
  campo: "Más tierra", capacidad: "Más memoria", velocidad: "Nave más rápida",
  crecimiento: "Crecimiento", repetir: "Repetir", esperar: "Esperar", si: "Si está listo",
  sino: "Si / si no", mientras: "Mientras", siempre: "Por siempre", rutinas: "Mis rutinas",
  contador: "Contador", hacer_con: "Hacer con número",
};

export const USOS_MEJORA: Record<ClaveMejora, string> = {
  campo: "Tu isla crece: más baldosas y nuevos minerales.",
  capacidad: "Añade un espacio para bloques. Las pilas sueltas también ocupan memoria.",
  velocidad: "La nave tarda un 30 % menos por acción, hasta su velocidad máxima.",
  crecimiento: "Los cristales tardan un 30 % menos por etapa, hasta su mínimo.",
  repetir: "Haz lo mismo varias veces con menos bloques.",
  esperar: "Deja pasar un turno sin cosechar un cristal verde.",
  si: "Cosecha solamente cuando esté listo: así no rompes el cuarzo.",
  sino: "Haz una cosa si se cumple el sensor y otra si no.",
  mientras: "Repite mientras se cumpla una condición; vacío, sirve para esperar.",
  siempre: "Mantén trabajando la nave sin volver a pulsar Empezar.",
  rutinas: "Da un nombre a una tarea y llámala desde otros bloques.",
  contador: "Cuenta acciones y compáralas con el tamaño de la isla.",
  hacer_con: "Llama a una rutina varias veces usando un número o el lado del campo.",
};

export function textoCosto(costo: Costo): string {
  const partes = Object.entries(costo) as [Mineral, number][];
  return partes.length ? partes.map(([m, n]) => `${n} de ${MINERALES[m].nombre}`).join(" + ") : "gratis";
}

export function faltaPara(e: EstadoCampo, costo: Costo): string {
  const faltante: Costo = {};
  for (const [m, n] of Object.entries(costo) as [Mineral, number][]) if (e.saldos[m] < n) faltante[m] = n - e.saldos[m];
  return Object.keys(faltante).length ? `Faltan ${textoCosto(faltante)}` : "Ya puedes comprarla";
}

export function requisitoDe(e: EstadoCampo, clave: string): string {
  if (clave === "si" && !e.mejoras.si && !(e.cuarzosRotos ?? 0)) return "Observa qué pasa al cosechar un Cuarzo verde";
  const r = AJUSTES.revelado[clave];
  if (!r) return "";
  if (r.lado && e.lado < r.lado) return `Amplía tu isla a ${r.lado} × ${r.lado}`;
  if (r.requiere && !e.mejoras[r.requiere]) return `Descubre ${NOMBRES_MEJORA[r.requiere as ClaveMejora]}`;
  if (r.cosechado && e.cosechados[r.cosechado[0]] < r.cosechado[1]) return `Cosecha ${r.cosechado[1] - e.cosechados[r.cosechado[0]]} vetas de ${MINERALES[r.cosechado[0]].nombre}`;
  if (r.acumulado && e.acumulado < r.acumulado) return `Recolecta ${r.acumulado - e.acumulado} de valor más (lo gastado también cuenta)`;
  return "Disponible en descubrimientos";
}

export function proximoObjetivo(e: EstadoCampo): { titulo: string; detalle: string; clave?: ClaveMejora } {
  if (e.acumulado === 0) return { titulo: "Tu primera cosecha", detalle: "Toca Cosechar para ponerlo bajo el bloque verde. Después pulsa Empezar: la primera Chispa ya está lista." };
  let clave: ClaveMejora = "campo";
  if (!e.mejoras.siempre) clave = "siempre";
  else if (!e.mejoras.crecimiento) clave = "crecimiento";
  else if (e.lado === 1) clave = "campo";
  else if ((e.mejoras.capacidad ?? 0) < 2) clave = "capacidad";
  else if (!e.mejoras.velocidad) clave = "velocidad";
  else if (!e.cosechados.racimo) return { titulo: "Conoce el Cuarzo", detalle: "Hay Cuarzo en la isla. Muévete hasta él y espera a ver «Lista» antes de cosecharlo: si está verde, se rompe." };
  else if (!e.mejoras.si) clave = "si";
  else if (!e.mejoras.esperar) clave = "esperar";
  else if (!e.mejoras.repetir) clave = "repetir";
  else if (!e.mejoras.siempre) clave = "siempre";
  else if (e.lado >= 3 && !e.cosechados.prisma) return { titulo: "Cultiva tu primer Prisma", detalle: "Prepara tierra y planta Prisma por 2 de Chispa. Espera a que esté listo. No rebrota: tras cosechar, tendrás que plantar otra vez." };
  else if (!e.mejoras.mientras) clave = "mientras";
  else if (e.lado >= 3 && !e.mejoras.rutinas) clave = "rutinas";
  else if (e.lado >= 4 && !e.cosechados.estrella) return { titulo: "Deja espacio a las Estrellas", detalle: "Planta Estrella por 3 de Cuarzo. Deja una baldosa entre estrellas: no pueden ser vecinas horizontales ni verticales." };
  else if (e.lado >= 4 && !e.mejoras.contador) clave = "contador";
  else if (e.lado >= 4 && !e.mejoras.hacer_con) clave = "hacer_con";
  else if (e.lado >= AJUSTES.ladoMaximo) return { titulo: "Haz rendir tu isla", detalle: "Prueba dos programas durante el mismo tiempo. Compara valor por minuto, acciones sin cosecha y cristales rotos. Evoluciona tus minerales para mejorar la producción." };
  const precio = precioMejora(clave, e.mejoras[clave] ?? 0);
  return { titulo: NOMBRES_MEJORA[clave], clave, detalle: `${USOS_MEJORA[clave]} ${reveladas(e).includes(clave) && precio ? faltaPara(e, precio) + "." : requisitoDe(e, clave) + "."}` };
}
