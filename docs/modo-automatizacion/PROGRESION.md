# Vivero — la progresión: de "avanzar y cosechar" a administrar una isla

> Diseño de la segunda etapa del modo. Extiende [`MVP.md`](MVP.md) e
> [`IMPLEMENTACION.md`](IMPLEMENTACION.md); donde los contradice, manda
> este documento. `CLAUDE.md` sigue mandando sobre los tres.

## 0. En una frase

El chico arranca con **avanzar → cosechar** y termina con **un programa que
administra sola una isla entera**: rutas, sensores, decisiones, rutinas
propias. El salto de escala no lo da un tutorial: lo dan **cristales que
exigen programas mejores** para rendir, y una isla que crece con lo que
esos cristales pagan.

## 1. Qué enseña The Farmer Was Replaced, y qué tomamos

Estudiado a fondo (wiki, funciones del dron, árbol de desbloqueos, reseñas).
Lo que hace que funcione no es Python: son cinco decisiones de diseño.

| Decisión de TFWR | Qué hace en el juego | Nuestro equivalente |
| --- | --- | --- |
| **Una cadena de recursos**: heno → madera → zanahorias → calabazas → girasoles → cactus | Cada recurso nuevo se paga con el anterior; nada se saltea | Cuatro minerales en cadena: chispa → cuarzo → prisma → estrella (§2) |
| **Cada cultivo exige un concepto nuevo** para rendir: los árboles no pueden ir pegados (posición), las zanahorias piden tierra arada (condición), las calabazas se funden si se llena la grilla (planificar), los girasoles se cosechan por pétalos (medir y comparar), los cactus se ordenan (algoritmo) | El concepto no se enseña: se **necesita** | Cada mineral tiene una regla que castiga el programa tonto y premia el sensor, la condición o la rutina (§2) |
| **Los desbloqueos de lenguaje se compran** con recursos: loops (5 heno), sensores (100 heno), variables (35 zanahorias), funciones (40 zanahorias), listas (500 zanahorias) | El chico paga por poder pensar mejor, y lo hace cuando ya sintió que le falta | Bloques nuevos en la tienda, pagados con el mineral de la etapa anterior (§5) |
| **El programa sigue corriendo**: `while True` es la meta, no un error | Es un juego *idle*: escribís algo bueno y mirás cómo trabaja | `Por siempre` como desbloqueo; la corrida no tiene tope de pasos, tiene botón de detener (§6) |
| **La granja se expande** con `Expand` y todo escala: el mismo programa sirve más grande si usa `get_world_size()` | La expansión rompe programas fijos y premia los genéricos | Más tierra rompe rutas fijas; `tamaño del campo` y contadores las arreglan (§5, nivel 4) |

Lo que **no** tomamos: la estética, el código escrito, las estructuras de
datos (listas, diccionarios) y la escala numérica (miles de calabazas). Un
chico de primaria programa con bloques y con números de una o dos cifras.

## 2. Los cuatro minerales — el color significa algo

Hoy las cuatro variantes valen lo mismo y aparecen al azar. Eso se termina.
**Cada color es un recurso distinto, con su contador, su regla y su uso.**
Mirar el campo ya dice qué conviene hacer.

| Mineral | Pieza | Color | Vale | Crece | Cómo aparece | Su regla (lo que exige del programa) | Qué compra |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Chispa** | punta | turquesa | 1 | rápido (3 s por etapa) | Sola, en cualquier baldosa vacía | Ninguna. Es el heno: perdona todo. | Tierra, memoria, velocidad, `Repetir`, `Esperar` |
| **Cuarzo** | racimo | violeta | 3 | lento (×2) | Sola, desde la isla 2×2, en la mitad de los rebrotes | **Cosecharlo verde lo rompe** (vuelve a cero, no paga). Una ruta fija lo destroza: hace falta `si está listo`. | Sensores, `Si`, `Si/sino`, `Mientras`, `Por siempre`, crecimiento |
| **Prisma** | prisma | rosa | 6 | medio (×1.5) | **Sólo si se planta** (`Plantar prisma`, cuesta 2 chispas), desde la 3×3 | No rebrota solo: la baldosa queda vacía. Hace falta `si está vacía → plantar`. | `Plantar`, rutinas (funciones), evolución de cristales |
| **Estrella** | estrella | dorado | 15 | muy lento (×3) | Sólo si se planta (cuesta 3 cuarzos), desde la 4×4, y **no crece con otra estrella al lado** | Espaciado: hay que planificar dónde va, y esperar sin romperla. Hace falta `Mientras no está listo → esperar`, contadores y posición. | Variables, rutinas con número, segunda nave, isla 5×5 |

Dos reglas transversales que hacen que el color importe de verdad:

- **Cosechar verde rompe todo lo que no sea chispa.** Hoy cosechar en vacío
  sólo pierde el turno. Con esto, un programa sin sensor que pasa por un
  cuarzo a medio crecer lo pierde: se ve la grieta, salen esquirlas, la veta
  vuelve a cero. Ese es el dolor que vende `si está listo`, igual que en
  TFWR cosechar antes de tiempo vende `can_harvest()`.
- **Cada mineral tiene su contador** en la cabecera, del color de su cristal,
  y aparece recién cuando ese mineral existe en el campo. El saldo único de
  hoy se convierte en el contador de chispas; los otros tres se suman al
  lado. Los precios se escriben con el ícono del mineral que piden.

### 2.1 Por qué estos cuatro y en este orden

- Chispa es gratis y abundante: se aprende a mover la nave sin perder nada.
- Cuarzo introduce el **tiempo** (crece lento) y el **castigo** (se rompe):
  primera vez que un programa que "anda" rinde mal. Ahí se compra `Si`.
- Prisma introduce la **decisión de qué cultivar** y la idea de que el campo
  es del jugador: lo que no planta, no crece. Ahí se compran `Plantar` y las
  rutinas, porque plantar-esperar-cosechar en varias baldosas es la primera
  cosa que se repite de verdad.
- Estrella introduce **planificación espacial** y **paciencia**: dónde
  plantarla para que no se toquen, y cómo esperar sin romperla. Ahí se
  compran contadores, posición y la segunda nave.

## 3. Evolución de los cristales — nivel 1 a 4

Además del **crecimiento** (brote → creciendo → maduro, que es por veta y
por tiempo), cada mineral tiene un **nivel** (1 a 4), que es del jugador y
se compra. Es la mejora "evolución" de la tienda, una por mineral.

| Nivel | Vale | Crece | Se ve |
| --- | --- | --- | --- |
| 1 | ×1 | ×1 | La pieza tal cual |
| 2 | ×1.6 | ×0.9 | Resplandor interior tenue todo el tiempo, un 6 % más grande |
| 3 | ×2.5 | ×0.8 | Motas de luz orbitando, un 12 % más grande |
| 4 | ×4 | ×0.7 | Halo, destellos permanentes, un 20 % más grande, más saturado |

Los cuatro niveles usan **la misma ilustración**; lo que cambia lo dibuja el
juego encima (CSS: escala, resplandor, motas, halo). Así la progresión se
ve sin generar doce piezas más, y si algún día se ilustran versiones
"evolucionadas", entran por el mismo contrato de apoyo sin tocar código.

El nivel se paga con el propio mineral más el anterior (nivel 2 de cuarzo:
cuarzo y chispas), así que evolucionar un mineral exige seguir cosechando
el de abajo. Nada queda obsoleto.

## 4. La isla que evoluciona

La isla ya crece (1×1 → 4×4, ilustraciones hechas). Ahora cada tamaño es
una **era**, y una era trae de todo a la vez:

| Era | Isla | Trae | Mineral nuevo | Bloques que se revelan en la tienda |
| --- | --- | --- | --- | --- |
| 1 | 1×1 | La nave y una veta de chispa | Chispa | Tierra |
| 2 | 2×2 | Movimiento útil, memoria | Cuarzo | `Repetir`, `Esperar`, memoria, velocidad |
| 3 | 3×3 | Rutas de verdad, sensores | Prisma | `Si`, sensores, `Si/sino`, `Mientras`, `Por siempre`, `Plantar`, crecimiento |
| 4 | 4×4 | Automatización | Estrella | Rutinas, contadores, posición, evolución |
| 5 | 5×5 | Escala (isla por ilustrar) | — | Segunda nave, rutinas con número |

La isla no cambia sólo de tamaño: **cada era tiene más cosas creciendo a la
vez y menos memoria por baldosa**, así que la única forma de administrarla
es un programa cada vez más general. Ese es el "cambio de escala".

## 5. La curva de bloques — se compra lo que ya duele

Todo se programa con bloques; el nombre de cada uno vive sólo en el
`aria-label`. El orden de aparición es fijo y cada bloque llega cuando el
campo ya creó la necesidad. Costos provisionales (balance centralizado).

| Nivel | Bloque | Forma | Cuesta | La necesidad que lo vende |
| --- | --- | --- | --- | --- |
| 0 | `Cosechar`, `Avanzar`, `Retroceder`, `Girar ←`, `Girar →` | acción | — | Están desde el inicio |
| 1 | `Repetir N` | contenedor | 28 chispas | La memoria no alcanza para escribir la ruta de la 2×2 |
| 1 | `Esperar` | acción | 15 chispas | El cristal no está listo cuando la nave llega |
| 2 | `Si [sensor]` | contenedor con ranura | 20 cuarzos | El cuarzo se rompe si se cosecha verde |
| 2 | Sensores: `está listo`, `está vacía`, `es [color]`, `hay borde adelante` | pastilla (va en la ranura) | vienen con `Si` | — |
| 2 | `Si / sino` | dos cavidades | 30 cuarzos | "Si está listo cosecho, si no avanzo" |
| 2 | `Mientras [sensor]` | contenedor con ranura | 40 cuarzos | Esperar hasta que esté listo sin contar los `Esperar` |
| 2 | `Por siempre` | contenedor | 60 cuarzos | Dejar la nave trabajando sola |
| 3 | `Plantar [color]` | acción con elección | 50 cuarzos | El prisma no rebrota: hay que plantarlo |
| 3 | `Mi rutina A/B/C` (definir) + `Hacer A/B/C` (llamar) | contenedor + acción | 60 prismas | Plantar-esperar-cosechar se repite en cada baldosa |
| 4 | `Contador +1`, `Contador = 0`, sensor `contador es N`, sensor `tamaño del campo` | acción + pastilla | 100 prismas | Una ruta escrita para la 3×3 se rompe en la 4×4 |
| 4 | `Hacer A con N` (rutina con número) | acción con número | 80 estrellas | "Avanzar N" sin escribir N veces avanzar |
| 5 | Segunda nave | mejora | 200 estrellas | La isla es más grande de lo que una nave recorre a tiempo |

La lógica dentro de un `Si` o un `Mientras` es una **pastilla** que encaja
en la ranura del contenedor: se elige tocándola (cicla entre los sensores
comprados) o arrastrándola desde la caja. `es [color]` y `Plantar [color]`
muestran el cristal mismo, no una palabra. Un solo nivel de anidamiento
sigue valiendo para `Repetir` dentro de `Por siempre`; `Si` puede ir adentro
de cualquiera. Profundidad máxima 2.

### Qué NO entra

Listas, diccionarios, texto, números negativos, operadores aritméticos
sueltos. Los "parámetros" son sólo un número en `Hacer A con N`. Las
"variables" son un único contador y el tamaño del campo. Es lo que un chico
de primaria puede leer en un bloque de un vistazo.

## 6. El intérprete — lo que cambia en el motor

Hoy el programa se **expande** a una lista de pasos antes de correr
(`expandir`) y la nave la ejecuta a ciegas. Con sensores eso ya no alcanza:
un `Si` mira el campo **en el momento** en que la nave está parada ahí.

Se agrega `src/utils/automatizacion/interprete.ts`, puro como el motor:

- Un **intérprete paso a paso**: recibe el programa y el estado, y devuelve
  el próximo paso cada vez que se le pide (`siguiente()`). Guarda su propia
  pila (dónde está en cada contenedor, cuántas vueltas van).
- Las **acciones** cuestan un turno (`msPorAccion`), como hoy.
- Los **sensores** son gratis y se evalúan contra el estado real.
- Una vuelta de `Mientras`/`Por siempre` que **no ejecuta ninguna acción**
  cuesta un **tic** (`msPorAccion / 4`): así `Mientras no está listo → (nada)`
  es una espera visible y no un bucle que cuelga la pestaña.
- `Esperar` cuesta un turno entero y no hace nada: es la forma explícita de
  la paciencia.
- **Sin tope de pasos** para `Por siempre`: detenerse es el botón rojo, la
  pestaña oculta, o salir. Un tope de seguridad muy alto (100 000 pasos)
  protege de un bucle sin sentido, y llegar a él se trata como detención
  normal, sin cartel.
- Las **rutinas** son definiciones al nivel raíz (`Mi rutina A`) que la
  llamada expande en su lugar; sin recursión (una rutina no puede llamarse
  a sí misma: el bloque `Hacer A` no se acepta adentro de `Mi rutina A`).
- El **contador** vive en el estado de la corrida, no en el campo, y arranca
  en cero en cada corrida.

`expandir()` se conserva para programas sin sensores (los exámenes lo usan)
y pasa a ser un caso particular del intérprete.

## 7. La economía

- Cuatro contadores, uno por mineral. `saldo` de hoy = chispas.
- **Precios en el mineral de la etapa anterior** para los bloques (tabla de
  §5) y **en el propio mineral** para las evoluciones (§3).
- Tierra: 5 chispas (2×2) → 40 chispas (3×3) → 60 cuarzos (4×4) → 120 prismas
  (5×5). La tierra es la compra que abre una era: siempre se paga con lo que
  esa era enseñó a cosechar.
- El **revelado progresivo** deja de ser por saldo acumulado y pasa a ser
  **por era y por primera cosecha**: `Si` aparece cuando el chico ya cosechó
  (o rompió) su primer cuarzo, `Plantar` cuando la isla es 3×3, y así.
- **Producción por minuto** se mide en valor (cada mineral por lo que vale),
  no en unidades: es el número que dice si el programa nuevo es mejor.

## 8. La escena — corregir la lectura 3D

Problemas vistos en pantalla (1366×768) y su causa:

| Se ve | Causa | Corrección |
| --- | --- | --- |
| La isla enorme | La escena ocupa `min(100cqw, 100cqh)` del visor entero | La escena entra al 82 % del visor, centrada un poco más abajo |
| Cristales altos y "adelante" | Lienzo a 1.2 pasos de baldosa: el maduro mide 0.75 baldosas | 1.0 pasos: el maduro mide ~0.6 baldosas, y una sombra de contacto suave los apoya en el anillo |
| La nave adelante de todo | Su sombra se dibuja **debajo del punto de apoyo** (en la base del lienzo, no en el ancla), así que se lee más cerca de la cámara que la baldosa; y el lienzo mide 1.12 baldosas | La sombra va en el ancla (el centro de la baldosa); la nave baja a 0.82 pasos; z-index por fila, entre los cristales de su fila y los de la fila de adelante |
| Tapa la veta del muelle | Nave y veta en el mismo centro | Estacionada, la nave se corre un cuarto de baldosa hacia adelante y abajo; al arrancar vuelve al centro |

Y la nave deja de ser una ficha:

- **Dieciséis vistas** en vez de cuatro (`render-piezas.py --pasos 16`): la
  nave tiene un ángulo continuo y al girar pasa por las vistas intermedias
  en ~380 ms. Es lo que "rota físicamente" con un modelo prerenderizado.
- **Despegue** al arrancar (sube un 5 %, el motor se enciende) y
  **aterrizaje** al terminar o detener.
- **Traslado** entre baldosas con una curva suave (ease-in-out, 420 ms) y
  una inclinación hacia adelante de 4° que vuelve a cero al llegar.
- **Motor**: un resplandor turquesa bajo la nave que late suave parada y se
  intensifica moviéndose.
- **Cosecha**: la nave baja un 4 % hacia el cristal, el cristal sube al
  casco (ya hecho), la nave vuelve a su altura.
- **Choque**: el sacudón que ya existe.
- **Rebrote**: cada cambio de etapa entra con un "pop" elástico; al llegar a
  maduro, un estallido de destellos y el resplandor permanente. Crecimiento
  base más rápido (3 s por etapa), pero los tiempos por mineral (§2) son lo
  que hace que el crecimiento sea juego y no un reloj.

## 9. Qué se conserva, qué se extiende, qué se refactoriza

| Pieza | Hoy | Queda |
| --- | --- | --- |
| `motor.ts` — campo, nave, crecimiento, compra | Funciona y está probado | **Se extiende**: celda con `mineral` fijo y regla de rebrote; cuatro saldos; niveles; romper al cosechar verde; plantar; espaciado de estrella |
| `programa.ts` — árbol, validación, capacidad, arrastre | Funciona | **Se extiende**: tipos nuevos (`wait`, `if`, `if_else`, `while`, `forever`, `plant`, `def`, `call`, `counter_*`), sensores, profundidad 2 |
| `expandir()` | Única forma de correr | **Se conserva** para programas sin sensores; el juego pasa al intérprete |
| `interprete.ts` | No existe | **Nuevo** (§6) |
| `EditorBloques.tsx` | Acciones y `Repetir`, con arrastre | **Se extiende**: contenedores con ranura, pastillas de sensor, `Si/sino`, elección de color, rutinas |
| `CampoCristales.tsx` | Cristales, nave, efectos | **Se refactoriza** la nave (ángulo continuo, animador propio) y se suman sombras, niveles, pops |
| `BarraMejoras.tsx` | Cinco mejoras | **Se extiende**: precios en minerales, evoluciones, bloques por era |
| `balance.ts` | Un saldo | **Se extiende**: minerales, eras, costos de bloques |
| `almacenamiento.ts` | Snapshot v1 | **Migra** v1 → v2 (saldo → chispas; celdas ganan mineral) sin perder partidas |
| `probar-automatizacion.mjs` | 40 pruebas | **Crece**: minerales, romper, plantar, intérprete, contador |

## 10. Cortes

Cada corte deja el juego jugable y el examen en verde.

1. **Escena** (§8): composición, sombras, dieciséis vistas, animaciones de
   nave, pops de crecimiento, crecimiento base más rápido. **Hecho
   (2026-09-04).**
2. **Minerales y evolución** (§2, §3, §7): celdas con mineral, cuatro
   contadores, romper al cosechar verde, plantar, niveles, tienda con precios
   en minerales, migración del snapshot. **Hecho (2026-09-04).** Queda para
   después el CSS de los niveles de evolución (§3, "se ve"): hoy el nivel se
   ve en la tienda y en el valor, todavía no encima del cristal.
3. **Intérprete y bloques de control** (§5 niveles 1–2, §6): `Esperar`,
   `Si`, `Si/sino`, `Mientras`, `Por siempre`, sensores; editor con ranuras.
   **Hecho (2026-09-04).** `Plantar` llega con la era (3×3) en vez de
   comprarse, para que el prisma no quede atrás de una compra más.
4. **Rutinas y contador** (§5 niveles 3–4): `Mi rutina`, `Hacer`, contador,
   tamaño del campo, `Hacer con N`. **Pendiente.**
5. **Escala** (§4 era 5): isla 5×5 ilustrada, segunda nave. **Pendiente.**

## 11. Criterios de aceptación (agregados a los del MVP)

- [ ] Los cuatro minerales tienen contador propio y un chico puede decir qué
      vale cada uno mirando el precio de una mejora.
- [ ] Un programa sin `Si` rompe cuarzos, y se ve.
- [ ] Un prisma no aparece nunca sin `Plantar`.
- [ ] Dos estrellas pegadas no crecen.
- [ ] `Mientras no está listo → Esperar` deja a la nave esperando y cosecha
      apenas madura.
- [ ] `Por siempre` corre hasta que se toca Detener, y la producción por
      minuto sube sola mientras el chico mira.
- [ ] Una rutina definida una vez y llamada tres veces ocupa menos memoria
      que las tres copias.
- [ ] El mismo programa con `tamaño del campo` recorre la 3×3 y la 4×4.
- [ ] La nave gira pasando por vistas intermedias, despega al arrancar y
      aterriza al terminar; nunca tapa la veta del muelle estando quieta.
- [ ] Cada cambio de etapa de una veta se ve, y llegar a maduro estalla.
