# Fondos de nivel — cómo generar el de una isla

Cada isla tiene su propio fondo para la pantalla de juego: el escenario sobre
el que aparecen el teclado flotante y la tarjeta de la actividad. Hoy hay
quince archivos pero **no quince dibujos**: las islas 1 a 5 comparten el mismo
placeholder (mismo hash, `8b1350ed…`), así que las que más falta hacen son
ésas.

Este archivo es el equivalente de `BOTONES.md` para los fondos. Primero se
genera **un molde** con la isla 1 y se itera hasta que la composición cierre;
después ese molde va como referencia para las otras catorce, igual que
`REFERENCIA-boton-clasico.png` va con el prompt del botón.

---

## 0. Antes de empezar: qué es un fondo de nivel

Es **una sola imagen 16:9**, sin transparencia, que se dibuja con
`background-size: cover; background-position: center` detrás de toda la
pantalla de juego.

Lo que la imagen **no** trae, porque lo dibuja el juego con HTML encima:

- El teclado. Es DOM real, con sus teclas resaltables — el nivel asistido
  ilumina la tecla que toca. Si el fondo trae un teclado pintado, se ven dos.
- La tarjeta de la palabra, la barra de progreso, la consigna, los contadores.
- Los dos robots de las esquinas de abajo y sus globos de diálogo.

Lo que la imagen **sí** tiene que traer son dos lugares preparados para que eso
caiga encima:

1. **Un pedestal abajo** donde apoya el teclado flotante. Es el mismo gesto que
   el disco de la isla donde se apoyan los botones de nivel: una superficie
   ancha, de material propio de esa isla, que hace de mesa.
2. **Un fondo tranquilo en el medio** donde flota la tarjeta de la actividad.
   La tarjeta es de vidrio translúcido con texto azul oscuro, así que atrás
   necesita cielo, bruma o lejanía — nada de follaje detallado ni contraste
   fuerte, o el texto se pierde.

---

## 1. El mapa de zonas

Todo esto está **medido en la app**, no estimado, en los tres tamaños que
importan. Los porcentajes son de la imagen 16:9.

| Elemento | 1366×768 (16:9) | 1366×912 (3:2) | 1920×1080 |
|---|---|---|---|
| Bloque de teclas | x 26,5–73,5 · y 68–96 | x 26,5–73,5 · y 73–96,5 | x 33,3–66,7 · y 77–97 |
| Palabra objetivo | y 31–37 | y 34–39 | y 37–41 |
| Consigna (arriba) | y 3,5–7 | y 3–6 | y 3–6 |

El teclado tiene **ancho máximo fijo (~640 px)** y va centrado, así que ocupa
más porcentaje de pantalla cuanto más chica es. La unión de los tres casos da
las zonas a respetar:

```
        0%        20%                             80%       100%
   0%   ┌──────────┬───────────────────────────────┬──────────┐
        │          │  CALMO — consigna y botones   │          │  ← y 0–12 %
  12%   ├──────────┼───────────────────────────────┼──────────┤
        │          │                               │          │
        │ decorado │  CALMO Y CLARO                │ decorado │
        │ (lejanía)│  acá flota la tarjeta de      │ (lejanía)│  ← y 20–60 %
        │          │  vidrio con texto oscuro      │          │
  62%   ├──────────┼───────────────────────────────┼──────────┤
        │  robot   │  PEDESTAL                     │  robot   │
        │ izquierdo│  la mesa donde apoya el       │ derecho  │  ← y 62–100 %
        │          │  teclado — x 22–78 %          │          │
 100%   └──────────┴───────────────────────────────┴──────────┘
             ↑                                          ↑
        estos 8 % de cada lado se pueden RECORTAR
```

Dos cosas que salen de ahí y son las que más se incumplen:

- **Los 8 % de cada costado se pierden en las Chromebooks 3:2.** El fondo es
  16:9 (1,777) y la pantalla es 1,5, así que `cover` recorta los lados: queda
  visible el 84 % del ancho. Nada importante puede vivir en esa franja.
- **Las esquinas de abajo las tapan los robots.** Van con globo de diálogo, a
  la altura del teclado. Ahí no pongas nada que valga la pena mirar.

---

## 2. El molde — prompt inicial con la isla 1

Este es el prompt que se itera hasta que la composición quede bien. Va **con
tres imágenes de referencia**: `island.webp` de la isla 1 (el arte de la isla),
su `button.webp` (el botón de nivel) y, si ya existe, el fondo actual como
punto de partida.

El resultado aprobado se guarda como
`Images/islands/_default/REFERENCIA-fondo-nivel.png` y pasa a ser la referencia
de las otras catorce.

```
Te paso imágenes de referencia de un juego infantil de mecanografía: la isla
flotante de un mundo y el botón de nivel de ese mismo mundo. Tomá de ahí el
estilo: 3D suave, colores brillantes y pasteles, luz cálida, aire de cuento.

Necesito el FONDO de la pantalla de juego de ese mundo. Es una sola ilustración
horizontal 16:9, sin transparencia, que va detrás de toda la interfaz.

La cámara está PARADA SOBRE la isla, a la altura de una persona, mirando al
horizonte. No es la vista aérea del mapa: es el mismo lugar, pero desde
adentro.

La composición tiene tres franjas y cada una tiene un trabajo:

1) FRANJA DE ABAJO (del 62 % de la altura para abajo) — EL PEDESTAL.
   Una plataforma ancha y despejada, centrada, que ocupe del 22 % al 78 % del
   ancho. Es la mesa donde el juego apoya un teclado flotante. Tiene que ser
   del material de esa isla, como una versión grande del disco donde se apoyan
   los botones de nivel. Su superficie tiene que ser de VALOR MEDIO y textura
   pareja: encima van teclas claras con letras oscuras, y si la superficie es
   muy clara, muy oscura o muy estampada, las teclas dejan de leerse.
   Podés decorar los bordes de la plataforma, pero el centro va limpio.

2) FRANJA DEL MEDIO (del 20 % al 60 % de la altura) — EL AIRE.
   Acá flota una tarjeta de vidrio translúcido con texto azul oscuro. Necesita
   quedar CLARA, suave y sin detalle: cielo, nubes, bruma, islas lejanas
   desenfocadas. Nada de follaje cerca de la cámara, ni ramas cruzando, ni
   objetos de mucho contraste en el centro.

3) FRANJA DE ARRIBA (primer 12 % de la altura) — TAMBIÉN CALMA.
   Ahí van la consigna y unos botones redondos. Cielo o lejanía, sin nada que
   compita.

Los COSTADOS son el lugar de la decoración: vegetación, rocas, cristales,
arquitectura, lo que sea propio de la isla, enmarcando la escena. Dos avisos:
   - Los 8 % de cada borde lateral se recortan en pantallas más cuadradas.
     Nada importante ahí.
   - Las dos esquinas de abajo quedan tapadas por personajes. Que no haya nada
     que valga la pena mirar en esos rincones.

NO dibujes: teclado, teclas, botones de interfaz, ventanas, marcos, carteles,
paneles, iconos, texto, letras ni números de ningún tipo. Todo eso lo pone el
juego encima. Tampoco personajes ni criaturas.

Formato: PNG, 16:9 exacto, al menos 1920×1080, sin bordes ni márgenes, sin
firma ni marca de agua.

TEMA: isla de piedra helada con cristales y florcitas, cielo celeste de
amanecer, islas flotantes a lo lejos.
```

**Qué mirar al iterar.** Se itera hasta que las cuatro den bien:

1. ¿La plataforma de abajo es lo bastante ancha y despejada como para apoyarle
   un teclado de 640 px centrado?
2. ¿El centro de la imagen, entre el 20 % y el 60 % de la altura, está claro y
   sin detalle?
3. ¿Se entiende que la cámara está parada sobre la isla y no volando?
4. Tapando el 8 % de cada costado, ¿la escena sigue funcionando?

---

## 3. Las otras catorce — prompt por isla

Con el molde aprobado, para cada isla se manda **el molde + el `island.webp` de
esa isla + su `button.webp`**, y se cambia sólo el bloque `TEMA`.

```
Te paso tres imágenes: la primera es el MOLDE de composición, las otras dos son
la isla y el botón de nivel del mundo que hay que hacer ahora.

Redibujá el molde COMPLETO con el material y el clima del mundo nuevo. No es
retocarle el color al molde: es la misma escena, la misma cámara y el mismo
reparto de espacio, construida con otro material y otra luz.

Lo que NO puede cambiar, porque es lo que hace que los quince fondos sean
intercambiables:
- El encuadre y la altura del horizonte.
- La plataforma de abajo: mismo lugar, mismo ancho (del 22 % al 78 %), misma
  altura de su superficie, mismo centro despejado y de valor medio.
- La franja del medio clara y sin detalle, entre el 20 % y el 60 % de la
  altura.
- La franja de arriba tranquila, primer 12 %.
- La decoración en los costados, sabiendo que los 8 % de cada borde se
  recortan y que las esquinas de abajo quedan tapadas.
- Nada de teclado, interfaz, texto, letras, números ni personajes.
- PNG, 16:9 exacto, al menos 1920×1080.

TEMA: <material de la plataforma> / <vegetación y decoración de los costados> /
<cielo y hora del día>
```

### Los quince TEMA

Salen del tema que ya tiene el botón de cada isla, así el fondo y el botón
hablan del mismo material.

| Isla | Mundo | TEMA sugerido |
|---|---|---|
| 1 | Isla de teclas | piedra helada / cristales y florcitas / celeste de amanecer |
| 2 | Isla de palabras | piedra con pasto / florcitas y arbustos / mediodía despejado |
| 3 | Isla de la biblioteca | mármol y oro / pasto y pétalos, libros apilados / dorado de tarde |
| 4 | Isla del árbol | piedra con aro dorado / cerezo en flor y pétalos al viento / rosado suave |
| 5 | Isla digital | piedra con pasto / cubos de hielo flotantes / celeste frío |
| 6 | Isla de la escritura | piedra rúnica violeta / drusas y cristales, portal al fondo / índigo con auroras |
| 7 | Isla de palabras largas | piedra de jardín / cerezos en flor, farolitos / atardecer cálido |
| 8 | Isla de los signos | hielo y bronce / engranajes helados y nieve / gris azulado invernal |
| 9 | Isla de los correos | barro cocido / hojas de arce y árboles de otoño / naranja de tarde |
| 10 | Isla de las búsquedas | piedra con musgo / helechos y ruinas en la selva / verde húmedo con rayos de sol |
| 11 | Isla de los comandos | galleta glaseada / caramelos, algodón de azúcar / rosado de caramelo |
| 12 | Isla de ventanas | roca naranja del cañón / arena y cactus / cielo del desierto al mediodía |
| 13 | Isla de los mensajes | aros pastel / pasto y arcoíris / celeste con nubes de algodón |
| 14 | Isla de atajos | bronce y runas / cristales y aparatos de alquimia / verdeazul de laboratorio |
| 15 | Isla del gran reto | piedra junto al agua / nenúfares y juncos, laguna / azul de laguna al atardecer |

---

## 4. Importar

No hay script todavía: es una conversión sola, a WebP del tamaño que usan las
quince (1672×941).

```bash
npx sharp-cli -i Images/islands/island1/gameplay-source.png \
  -o public/assets/islands/island1/gameplay.webp \
  resize 1672 941 --fit cover -- webp --quality 82
```

O con node, que es lo que ya está instalado:

```bash
node -e "require('sharp')('Images/islands/island1/gameplay-source.png').resize(1672,941,{fit:'cover'}).webp({quality:82}).toFile('public/assets/islands/island1/gameplay.webp').then(i=>console.log(i.width+'x'+i.height, Math.round(i.size/1024)+'KB'))"
```

Guardá el original en `Images/islands/islandN/gameplay-source.png`, igual que
se guarda `button-sheet.png`. **No se toca**: si algún día hay que reencuadrar,
se vuelve a él.

El juego lo toma solo — `islandGameplayBg()` arma la ruta desde el `worldId`,
así que no hay ninguna tabla que actualizar.

---

## 5. Verificar

Abrí un nivel de esa isla y mirá los tres tamaños. El que manda es el 3:2,
que es la Chromebook:

```
/gameplay/island2-l1
```

- 1366×768 y 1920×1080 — que el teclado caiga sobre la plataforma.
- **1366×912** — que el recorte de los costados no se lleve nada.
- Que la tarjeta de la palabra se lea sin esfuerzo sobre lo que quedó atrás.
- Que las teclas se distingan de la plataforma.

Si la tarjeta no se lee, el problema casi siempre es que el centro quedó
oscuro o cargado. Antes de regenerar, probá bajarle contraste sólo a esa franja
— pero si el dibujo tiene un objeto grande justo ahí, no hay parche: hay que
volver a generar pidiendo el centro despejado.

---

## Archivos que intervienen

| Archivo | Qué hace |
|---|---|
| `_default/REFERENCIA-fondo-nivel.png` | El molde aprobado, va con el prompt de cada isla |
| `Images/islands/islandN/gameplay-source.png` | El original tal como vino. **No se toca** |
| `public/assets/islands/islandN/gameplay.webp` | El que consume el juego, 1672×941 |
| `src/utils/assets.ts` → `islandGameplayBg()` | Arma la ruta desde el `worldId` |
| `src/pages/GameplayPage.tsx` | Lo pinta con `bg-cover bg-center` |
