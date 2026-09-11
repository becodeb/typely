# Prompt — rediseño de progresión, bloques y feedback del Vivero

Este archivo es el prompt de implementación para el próximo pase del modo
Automatización. Está escrito para ejecutarse por cortes pequeños: no intentar
resolver motor, árbol, layout y arte en una sola respuesta.

## Prompt listo para pegar

```text
Trabajá sobre TYPELY, en la rama actual y únicamente dentro del modo
Automatización. No hagas deploy, no mezcles ramas y no toques Aventura, Órbita
ni los assets originales de Images/ o Images-new/.

Antes de editar leé CLAUDE.md y contrastá el código real con:
- docs/modo-automatizacion/ESTADO-ACTUAL.md
- docs/modo-automatizacion/MVP.md
- docs/modo-automatizacion/PROGRESION.md
- docs/modo-automatizacion/IMPLEMENTACION.md
- Images/automatizacion/LEEME.md

Si vas a crear o importar imágenes, leé además Images/islands/ISLAS.md y
Images/islands/BOTONES.md. Los MD son reglas de producción, no sugerencias.
No generes imágenes hasta terminar el corte de motor y progresión.

Objetivo de producto:
Que el jugador entienda qué está creciendo, por qué una mejora está
disponible, qué acaba de comprar y cuál es el siguiente paso. La progresión
debe sentirse descubierta por necesidad, con un árbol gráfico descendente
inspirado en la legibilidad de The Farmer Was Replaced, sin copiar sus assets,
layout exacto ni código.

Reglas de ejecución:
- Trabajá en cortes independientes y verificables.
- No mezcles una migración de datos con una reescritura visual sin justificarlo.
- No inventes un segundo estado para React si el motor ya es la fuente de verdad.
- Mantené IDs internos y snapshots compatibles; agregá migración si hace falta.
- No uses eval, Function ni código dinámico para ejecutar bloques.
- Al terminar cada corte ejecutá las pruebas específicas y reportá archivos,
  riesgos y pendientes antes de pasar al siguiente.

Corte 1 — especificación y balance, sin código:
1. Reconciliá ESTADO-ACTUAL.md con el motor y balance actuales; corregí la
   documentación de tiempos, precios y gates.
2. Definí un grafo de progresión data-driven, con nodos, prerequisitos, coste,
   efecto, era y evento que los revela. No uses un array de tarjetas filtradas
   como sustituto del grafo.
3. Usá esta secuencia pedagógica:
   primera cosecha → Repetir N → Repetir muchas veces (finito) → Esperar →
   Si está listo → Mientras → Por siempre.
4. Todos los multiplicadores de crecimiento, acción o recompensa pertenecen al
   árbol. No queda ningún x2, 2x, ×2 ni selector de velocidad gratuito.
5. Elegí y documentá una regla única de cosecha prematura. Recomendación:
   cualquier mineral inmaduro se puede cosechar, no entrega recurso y se
   corta/reinicia. Una excepción tutorial para Chispa solo es válida si queda
   visible y no cambia la regla permanente.

Corte 2 — motor y pruebas:
1. Cosechar siempre consume la acción. Diferenciá vacío, creciendo, listo y
   corte prematuro en los eventos del motor.
2. Verificá la regla en Chispa, Cuarzo, Prisma y Estrella, incluyendo saldo,
   etapa, timestamps y efectos visuales.
3. Implementá “Repetir muchas veces” como una opción finita del repeat actual
   (por ejemplo 8/16/32), no como un bucle infinito nuevo.
4. Por siempre queda bloqueado hasta que Esperar y una condición útil estén
   comprados y usados en la progresión.
5. Sacá del panel principal cualquier acelerador Normal/Lento/x2. Si queda un
   control de depuración, debe ser Un paso y no una ventaja de producción.
6. Escribí pruebas de regresión para loops, pausa, detener, pestaña oculta,
   persistencia y compras.

Corte 3 — árbol, compras y controles:
1. Reemplazá la lista actual por un componente ArbolProgresion gráfico,
   desplazable y operable con teclado.
2. El árbol es descendente: raíz abajo, siguientes conceptos arriba, ramas
   laterales para campo, crecimiento, sensores, minerales y rutinas.
3. Cada nodo debe mostrar solo: icono, nombre corto, efecto de una línea,
   coste y estado (comprado, disponible, bloqueado o progreso).
4. Dibujá conectores visibles entre prerequisitos. Resaltá el próximo nodo
   recomendado y explicá qué problema del campo resuelve.
5. La tienda inline muestra solo la siguiente compra relevante; el árbol
   completo es la explicación del futuro.
6. Rediseñá Empezar/Pausar, Un paso y Detener con una jerarquía simple,
   superficies sólidas y sin gradientes brillantes ni colección de píldoras.
7. Creá ToastStack fijo abajo a la derecha, con role=status y aria-live=polite.
   Una compra normal muestra icono, título grande y una sola línea de efecto.
   Una expansión de isla o nueva era puede usar una celebración central breve.

Corte 4 — bloques y arte:
1. Primero corregí la geometría del bloque: ranura fija para icono, ranura
   independiente para etiqueta HTML, ancho mínimo, altura consistente y
   wrapping seguro. No recortes ni escondas texto.
2. El texto nunca se dibuja dentro de una imagen. Los assets solo son símbolos.
3. Generá/importá assets individuales y transparentes para:
   arriba, atrás, girar izquierda, girar derecha, avanzar, cosechar,
   preparar tierra, plantar, repetir, esperar, si, si-no, mientras, por
   siempre, rutina, hacer rutina, contador +1 y contador = 0.
4. Todas las imágenes deben compartir lienzo, escala, iluminación, material y
   márgenes. Corregí cualquier asignación semántica incorrecta, especialmente
   Si/Sino. Para flechas pequeñas, play, pausa, detener, deshacer y rehacer
   preferí SVG consistente si el bitmap no mejora la lectura.
5. Guardá los assets finales en public/assets/automatizacion/bloques/ con
   nombres estables, sin reemplazar assets existentes sin autorización.
6. Verificá el editor en 320, 768 y 1440 px, con mouse, touch, teclado,
   foco visible y targets mínimos de 44 px.

Corte 5 — QA:
- npm run build
- node scripts/probar-automatizacion.mjs
- git diff --check
- búsqueda de x2, 2x, ×2 y selectores de velocidad gratuitos
- prueba manual de cosecha verde, Repetir muchas veces, Esperar y Por siempre
- prueba de compra: descuento una sola vez, toast visible y efecto inmediato
- prueba de responsive y prefers-reduced-motion
- actualización final de ESTADO-ACTUAL.md

No cierres el trabajo con “se ve mejor”: reportá los criterios de aceptación,
las capturas o comprobaciones visuales y cualquier pendiente real.
```

## Contrato visual para los nuevos assets

- Fondo transparente real, sin blanco, verde croma ni sombra rectangular.
- Un símbolo por archivo; ningún texto generado dentro de la imagen.
- Estética 3D suave de TYPELY: fantasía pastel, cristal pintado, luz cálida
  desde arriba a la izquierda y sombras blandas.
- Silueta simple y reconocible a 32–48 px; no agregar detalles decorativos que
  compitan con la etiqueta del bloque.
- Mantener el mismo centro óptico y margen seguro en todos los archivos.
- La carcasa del bloque es una única pieza PNG facetada (`bloque-shell-facetado.png`)
  con ranura y lengüeta compartidas; los símbolos siguen siendo assets separados
  y el texto siempre queda en HTML.

## Archivos esperados

```text
public/assets/automatizacion/bloques/
├── bloque-shell-facetado.png
├── inicio-shell-facetado.png
├── avanzar.webp
├── atras.webp
├── arriba.webp
├── abajo.webp
├── derecha.webp
├── izquierda.webp
├── girar-izquierda.webp
├── girar-derecha.webp
├── cosechar.webp
├── preparar-tierra.webp
├── plantar.webp
├── repetir.webp
├── esperar.webp
├── si.webp
├── sino.webp
├── mientras.webp
├── por-siempre.webp
├── rutina.webp
├── hacer-rutina.webp
├── contador-mas.webp
└── contador-cero.webp
```

Las imágenes son un pack visual para la implementación. La integración inicial
ya apunta los símbolos del editor a esta carpeta desde `IconosAuto.tsx` y usa
`preparar-tierra.webp` para `clear`; los assets anteriores se conservan como
respaldo y para sensores/monedas que no son bloques.
