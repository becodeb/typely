# Nave exclusiva de Órbita

La vista neutra conserva el prototipo v4 aprobado. Las vistas izquierda y derecha mantienen el diseño, sin personajes visibles. Los PNG `*-source.png` son originales y no se sobrescriben.

## Importación

Desde la raíz del proyecto:

```sh
node scripts/import-orbita-naves.mjs orbita-01
```

El importador quita localmente el fondo de cuadrícula, conserva el lienzo para alinear las poses y genera WebP transparentes de 1024 px en `public/assets/orbita/naves/orbita-01/`. Los PNG transparentes derivados quedan en `../work/orbita/orbita-01/`. `generacion.json` registra la procedencia y los prompts.

## Integración

`src/data/orbitaNaves.ts` registra las vistas y los anclajes del cristal y los motores. `NaveOrbita.tsx` combina las poses con giro, propulsores, destello, retroceso e impacto, respetando pausa y movimiento reducido. Tormenta usa su reloj existente y calcula el origen de cada disparo desde el cristal transformado.

Esta nave es independiente de la progresión de estrellas de la cuenta. Para añadir otro diseño, incorporar sus fuentes y WebP y una nueva definición en el registro; la compra y selección de futuras naves todavía no forman parte de esta implementación.
