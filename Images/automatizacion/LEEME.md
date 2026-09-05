# El arte del Vivero (modo Automatización)

Tres piezas de arte, tres caminos distintos, y conviene saber cuál es cuál
antes de tocar nada. `CLAUDE.md` manda sobre este archivo.

| Pieza | De dónde sale | Fuente | Script | Llega a |
| --- | --- | --- | --- | --- |
| Las islas (1×1 … 4×4) | Ilustración IA sobre verde croma | `islas/isla-NxN.png` | `scripts/importar-islas-verde.mjs` y después `scripts/medir-grilla-islas.mjs` | `public/assets/automatizacion/campo/` y `src/data/automatizacion/campos.ts` |
| Los cristales (4 × 3) | Ilustración IA sobre verde croma, **en un solo pliego** | `cristales/hoja-verde.png` | `scripts/importar-cristales-verde.mjs` y después `scripts/import-automatizacion-art.mjs` | `public/assets/automatizacion/cristales/` |
| La nave (4 rumbos) | Render de Blender del modelo de la nave con los dos robots | el `.blend` vive fuera del repo (pesa demasiado) | `scripts/blender/render-piezas.py` y después `scripts/import-automatizacion-art.mjs` | `public/assets/automatizacion/nave/` |

Todo lo que hay en `render/` son PNG intermedios con alfa, listos para el
importador. `render-blender/` es donde escribe el generador procedural de
cristales, que quedó **superado** (ver abajo) y por eso no pisa `render/`.

## Por qué los cristales son una ilustración y no un render

El primer intento fue procedural (`scripts/blender/cristales-automatizacion.py`):
prismas hexagonales con un shader estilizado. Funcionaba, pero al lado de la
piedra pintada de la isla se leían como velas de plástico — un cilindro con
brillo no es una gema, y ninguna cantidad de facetas lo iba a convertir en
algo que pareciera pintado por la misma mano que pintó la isla.

La isla es una ilustración; los cristales tienen que ser una ilustración
del mismo generador, con el mismo prompt de estilo. El script de Blender
queda como documentación del **contrato** (lienzo, ancla, encuadre) y
como respaldo si algún día hace falta una variante rápida.

## El pliego de cristales

Un solo PNG sobre verde lima puro (`#02F902`, el mismo de las islas):

- **Cuatro filas**, de arriba abajo: `punta` (celeste), `racimo`
  (violeta), `prisma` (rosa), `estrella` (dorado). Cuatro siluetas que se
  distinguen a golpe de vista, sin leer nada.
- **Tres columnas**, de izquierda a derecha: `brote`, `creciendo`,
  `maduro`. El maduro ocupa unas tres veces la altura del brote.
- **Sólo el maduro lleva destellos** de cuatro puntas alrededor: "listo"
  se lee por tamaño y por luz, nunca sólo por color (MVP.md §4).
- Aire entre piezas: el script corta por las franjas vacías, así que
  ninguna pieza ni ningún destello puede cruzar la línea entre celdas.
- Luz cálida desde arriba a la izquierda, 3D de caramelo, pasteles
  saturados, sombras blandas: el mismo brief que las islas.

Lo que hace el importador, y por qué a mano sale mal:

1. Quita el verde **des-premultiplicando**: en el borde el píxel es una
   mezcla de cristal y fondo, y despejar la ecuación recupera el color
   real en vez de dejar un filo verdoso semitransparente. Un limitador
   (`g ≤ max(r, b)`) mata lo que queda. Es más agresivo que el de las
   islas porque acá no hay follaje que cuidar.
2. Separa el **cuerpo** de los destellos por componentes conexas: el apoyo
   y el tamaño se miden sobre el cuerpo. Si contaran los destellos, el
   maduro apoyaría flotando.
3. Encuadra cada fila **por su maduro** y fuerza la progresión
   `0.33 / 0.62 / 1.0` de altura. Nunca agranda un dibujo.
4. Apoya cada pieza en **(50 %, 75 %)** de un lienzo cuadrado de 512. Esa
   coordenada es "el centro de la baldosa" — es el contrato con
   `CampoCristales.tsx`, y lo que permite cambiar una pieza sin mover un
   número. Ancla y ancho en pantalla viven en
   `src/data/automatizacion/escena.ts`, que los scripts compilan con
   esbuild para leer el mismo valor que el juego.

Y deja para mirar, en `.preview-automatizacion/`:

- `cristales-pliego.png` — las doce sobre violeta claro con una cruz en
  el apoyo. Las tres de una fila tienen que leerse como el mismo cristal
  creciendo; las cuatro filas, como cuatro minerales distintos.
- `cristales-isla-2x2.png` y `cristales-isla-4x4.png` — las piezas sobre
  las islas reales, con la misma cuenta que hace el juego. Es la prueba
  que importa: ¿parecen del mismo mundo?

```bash
node scripts/importar-cristales-verde.mjs
node scripts/import-automatizacion-art.mjs
```

## Las islas

Ver la cabecera de `scripts/medir-grilla-islas.mjs`: las posiciones de las
baldosas se miden sobre las juntas de luz turquesa entre baldosas, nadie
las escribe a mano, y `campos.ts` es GENERADO — no se edita.
