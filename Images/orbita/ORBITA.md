# Arte del modo Órbita — cómo generarlo

El equivalente de `BOTONES.md` y `FONDOS.md`, pero para el modo arcade. Cubre
**ocho imágenes**: las tres capas del fondo espacial del minijuego *Tormenta de
palabras* y las cinco de los orbes de cristal de la pantalla de selección de
modo.

Los dieciocho iconos NO están acá: son SVG dibujados a mano, ya hechos, y no
pasan por ningún importador. Ver §6.

---

## 0. Las ocho imágenes, de un vistazo

Esta tabla es la respuesta a *qué nombre le pongo y dónde la guardo*. El nombre
va **exacto**, con el sufijo `-source`, o el importador no la encuentra.

| # | Guardar como | Medida | Transparencia | Qué es |
|---|---|---|---|---|
| 1 | `Images/orbita/orbes/cristal-source.png` | 1024×1024 | **Sí** | La esfera de vidrio vacía |
| 2 | `Images/orbita/orbes/brillo-source.png` | 1024×1024 | **Sí** | Los reflejos de esa misma esfera |
| 3 | `Images/orbita/orbes/mundo-aventura-source.png` | 1024×1024 | No hace falta | El archipiélago que se ve adentro |
| 4 | `Images/orbita/orbes/mundo-orbita-source.png` | 1024×1024 | No hace falta | El espacio que se ve adentro |
| 5 | `Images/orbita/orbes/mundo-dormido-source.png` | 1024×1024 | No hace falta | El cristal empañado de un modo bloqueado |
| 6 | `Images/orbita/fondo/estrellas-source.png` | 2560×1440 | **No** | El campo estelar, la capa base |
| 7 | `Images/orbita/fondo/nebulosa-source.png` | 2560×1440 | **Sí** | Las nubes, en gris |
| 8 | `Images/orbita/fondo/polvo-source.png` | 2560×1440 | **Sí** | Las partículas cercanas |

Las dos carpetas ya existen. El importador produce los WebP en
`public/assets/orbita/` sacándole el `-source` al nombre —
`cristal-source.png` → `orbes/cristal.webp`. Vos **no** tocás `public/`.

### Las diez piezas del rediseño (2026-09-02)

El rediseño estético (§7) suma **diez imágenes nuevas más dos rehechas**, en
tres tandas. Las fichas y los prompts están en §7; esta tabla es la
respuesta a *qué nombre y dónde*. El importador ya conoce las carpetas
nuevas y sus chequeos.

| Guardar como | Medida | Transparencia | Tanda | Qué es |
|---|---|---|---|---|
| `Images/orbita/fondo/horizonte-source.png` | 2560×1440 | **Sí** | 1 | El mundo de las islas visto desde la órbita, solo la franja de abajo |
| `Images/orbita/fondo/estrellas-source.png` (v2) | 2560×1440 | No | 1 | El campo estelar rehecho en índigo, con destellos ✦ |
| `Images/orbita/fondo/nebulosa-source.png` (v2) | 2560×1440 | **Sí**, en gris | 1 | Las nubes del cielo de día, como máscara |
| `Images/orbita/hub/estacion-source.png` | 1536×1024 | **Sí** | 2 | La estación orbital donde se apoya la nave |
| `Images/orbita/insignias/<rango>-source.png` | 1024×1024 | **Sí** | 2 | Seis medallas de caramelo (cadete … leyenda) |
| `Images/orbita/gemas/<poder>-source.png` | 1024×1024 | **Sí** | 3 | Siete gemas de poder y `cristal`, la moneda |

Salen como `fondo/horizonte.webp`, `hub/estacion.webp`,
`insignias/<rango>.webp` y `gemas/<poder>.webp`. Insignias y gemas son
listas ABIERTAS como los mundos: cualquier `<nombre>-source.png` en su
carpeta entra, recortado y encuadrado en un cuadrado con margen parejo.

### Por qué son sólo ocho

Un orbe son **tres capas apiladas: mundo + cristal + brillo**. El cristal (1) y
el brillo (2) son los **mismos archivos para todos los orbes**; lo único propio
de cada modo es el mundo de adentro. Por eso hay tres mundos y un solo cristal.

La consecuencia importa para el futuro: **sumar un modo nuevo cuesta UNA
imagen**. Si alguna vez se genera un cristal distinto por modo, esa propiedad se
pierde y el sexto modo cuesta lo mismo que el primero.

Lo que las imágenes **no** traen, porque lo dibuja el juego con HTML encima:
las palabras, la nave, el rayo, las explosiones, las cápsulas, los corazones,
el puntaje, los cristales, el PPM y la barra de amenaza.

---

## 1. Cinco reglas que valen para las ocho

1. **PNG siempre, nunca JPG.** El JPG deja halo de compresión en los bordes y
   el recorte queda sucio — le pasó al botón de la isla 2 y se nota. Además la
   transparencia sólo existe en PNG.
2. **Esa medida o más grande, nunca más chica.** El importador achica pero
   **nunca agranda**: estirar un PNG no inventa detalle. Si generás a 1536×864
   en vez de 2560×1440, el juego se queda con 1536×864 y se ve blando en un
   monitor grande.
3. **La nebulosa se genera en GRIS, no en violeta.** Esta es la que más se pasa
   por alto y no es un detalle de gusto: el color de la tensión lo pone una capa
   CSS abajo que se interpola con la amenaza —azul tranquilo → violeta → rojo—
   y una nebulosa ya coloreada no se puede llevar a otro tono sin ensuciarse.
4. **El centro de todo tiene que estar tranquilo.** No es un fondo decorativo:
   por el medio de la pantalla pasan palabras en movimiento que un chico tiene
   que leer y escribir a toda velocidad. Una nebulosa brillante en el centro es
   exactamente el mismo error que un pedestal tan claro como las teclas.
5. **Nada de texto, marcos, interfaz ni logos** en ninguna de las ocho.

---

## 2. El orden en que conviene generarlas

**Empezá por el cristal (1) y no sigas hasta que cierre.** Es el molde: los
otros cuatro orbes se juzgan contra él, y si el vidrio cambia después hay que
mirar todo de nuevo. Es el mismo criterio de `FONDOS.md`, donde primero se
itera el fondo de la isla 1 y recién después salen los otros catorce.

```
1. cristal          ← el molde. Iteralo hasta que la esfera se lea.
2. brillo           ← tiene que calzar EXACTO con el cristal.
3. mundo-aventura   ← el más difícil de los tres mundos.
4. mundo-orbita
5. mundo-dormido    ← el más fácil; usá el de aventura como referencia de encuadre.
6-8. estrellas · nebulosa · polvo   ← independientes, cuando quieras.
```

Las tres del fondo no dependen de nada ni entre sí. Si te trabás con los orbes,
hacé esas y volvé.

---

## 3. Cómo sé si salió bien

**El importador es el examen.** No adivines: generá, corré esto y leelo.

```bash
node scripts/import-orbita-art.mjs           # todo lo que tenga fuente
node scripts/import-orbita-art.mjs fondo     # solo las tres capas
node scripts/import-orbita-art.mjs orbes     # solo los orbes
```

Necesita sharp: `npm install sharp --no-save`.

Por cada imagen imprime `ok` o `ERROR` con **el número medido y el tope**, así
sabés si zafaste por poco o si estás lejos. Si algo da ERROR **no escribe
nada** y termina en código 1: corregís la fuente y volvés a correr. Nunca deja
pasar a medias.

Lo que mide, y por qué cada cosa:

| Chequeo | Sobre qué | Tope | Por qué |
|---|---|---|---|
| Alpha real | nebulosa · polvo · cristal · brillo | — | Un PNG "con transparencia" que salió opaco tapa todo lo que tiene debajo, y eso se descubre recién al abrir la página |
| Brillo medio | estrellas | ≤ 0.20 | Sobre un cielo claro las palabras no se leen — el mismo error que un pedestal pálido |
| Contraste del centro | estrellas | ≤ 0.13 | Mide el 60 % del medio: ahí encima pasan las palabras |
| Opacidad del centro | nebulosa · polvo | ≤ 0.20 · ≤ 0.12 | Mide el 55 % del medio, la franja donde el juego dibuja texto |
| Opacidad del centro | cristal · brillo | ≤ 0.14 · ≤ 0.22 | Mide el 70 %: si no está transparente tapa el mundo, y entonces cada modo necesita su propio cristal |
| Cuadradas | los cinco orbes | ±2 px | Se recortan en círculo |
| Nunca agranda | las ocho | — | Igual que `import-island-art.mjs` |

Los topes tienen aire: un campo estelar normal da alrededor de 0.04 de brillo
contra un tope de 0.20, y una nebulosa bien hecha da 0.01 contra 0.20. Si algo
da ERROR es porque está mal de verdad, no por unos decimales.

### 3.1 Mirarlo armado — las dos previews

Ninguna de estas ocho imágenes se aprueba suelta. **El cristal sólo se juzga
con un mundo adentro, y el fondo sólo se juzga con palabras encima**, que es la
misma razón por la que `import-gameplay-bg` mide el pedestal contra una tecla
en vez de mirarlo.

```bash
node scripts/preview-orbita-orbe.mjs    # mundo + cristal + brillo, sobre el
                                        # cielo real y sobre oscuro, 300 y 130 px
node scripts/preview-orbita-fondo.mjs   # las tres capas teñidas a tres niveles
                                        # de amenaza, con palabras encima
```

Las dos escriben a `.preview-orbita/` (gitignored). La del orbe toma la fuente
si el WebP todavía no está importado, así podés mirar una capa recién generada
sin importar nada.

**Lo que hay que mirar en cada una** está impreso al final de su salida. En el
fondo es una sola cosa: si las palabras se leen en los tres momentos, sobre
todo en el rojo.

**El importador también realza la textura de `mundo-dormido`.** No es un
retoque de gusto: la escarcha de helechos es preciosa a 1254 px y **desaparece
a los 300 px** a los que se muestra el orbe, y sin ella el orbe pasa de decir
*todavía no* a decir *vacío* — justo la distinción que tiene que sostener. Es
un defecto de reproducción, no de dibujo, así que se corrige al achicar y la
fuente generada queda intacta. Los valores están en `REALCE`, arriba de todo en
`scripts/import-orbita-art.mjs`. Mismo criterio por el que `import-island-art`
recorta el margen transparente y `import-gameplay-bg` centra el corte.

**Los mundos no necesitan traer alpha: el importador los recorta él.** Aplica
la máscara circular y escribe el disco ya listo, así que la fuente puede ser un
cuadrado opaco y el corte queda parejo en los tres. Y la lista de mundos es
**abierta**: cualquier `mundo-<loquesea>-source.png` que aparezca en `orbes/`
se importa solo, sin tocar el script.

---

## 4. Ficha de cada imagen

### 4.1 `cristal-source.png` — la esfera de vidrio

| | |
|---|---|
| **Guardar en** | `Images/orbita/orbes/cristal-source.png` |
| **Medida** | 1024×1024 exacta |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | ninguna — este es el molde |
| **Sale como** | `public/assets/orbita/orbes/cristal.webp` |

**Qué tiene que lograr.** Una burbuja de vidrio que se vea como vidrio, **y que
esté vacía**. El centro transparente es la condición que sostiene todo el
sistema: es lo que deja ver el mundo de adentro y lo que permite que un solo
cristal sirva para todos los modos.

```
Necesito una BURBUJA DE CRISTAL para un juego infantil de estética pastel, 3D
suave, colores brillantes, luz cálida, aire de cuento.

Una imagen cuadrada de 1024x1024, en PNG CON TRANSPARENCIA REAL.

Es una esfera de vidrio perfectamente circular, VACÍA y TRANSPARENTE POR
DENTRO: se tiene que poder ver a través de ella. Lo único que está dibujado es
el borde de la esfera — el grosor del vidrio, la refracción del canto, un aro
sutil de luz alrededor — y una sombra suave por dentro del borde de abajo, que
es lo que le da volumen.

Condición que manda sobre todas las demás: el 70% CENTRAL de la imagen tiene
que estar COMPLETAMENTE VACÍO. Sin nube interior, sin tinte, sin neblina, sin
degradado, sin nada. Si el centro no está vacío, la esfera tapa lo que va
adentro y no sirve.

La esfera ocupa casi todo el cuadro, centrada, dejando un margen chico de aire
alrededor.

Fondo completamente transparente, no blanco ni negro. Sin pedestal, sin
soporte, sin base, sin sombra proyectada abajo, sin texto, sin marco.
```

**Salió bien si:** la mirás sobre un fondo de color cualquiera y ves el color a
través del centro sin ningún velo, pero la esfera se lee igual como objeto de
vidrio por el borde. El importador lo comprueba midiendo la opacidad del 70 %
central: tope 0.14.

---

### 4.2 `brillo-source.png` — los reflejos

| | |
|---|---|
| **Guardar en** | `Images/orbita/orbes/brillo-source.png` |
| **Medida** | 1024×1024 exacta |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | **`cristal-source.png`, el que acabás de aprobar** |
| **Sale como** | `public/assets/orbita/orbes/brillo.webp` |

**Qué tiene que lograr.** Sólo los destellos de esa misma esfera, en una capa
aparte para que el juego los pueda mover despacio y el vidrio parezca vivo. Van
**en el mismo lugar** que en el cristal: se apilan uno sobre otro, así que si
la esfera no está en la misma posición y del mismo tamaño, los reflejos quedan
flotando fuera del vidrio.

```
Te paso la imagen de una burbuja de cristal. Necesito SOLO SUS REFLEJOS, en una
capa aparte.

Una imagen cuadrada de 1024x1024, en PNG CON TRANSPARENCIA REAL, con la esfera
EXACTAMENTE del mismo tamaño y en la MISMA POSICIÓN que en la imagen que te
paso, porque las dos se superponen.

Dibujá únicamente los brillos especulares del vidrio, sobre transparencia total:
una mancha de luz alargada y suave arriba a la izquierda, un reflejo más chico
y difuso abajo a la derecha, y algún destello fino en el canto de la esfera.

Nada más. No dibujes el borde de la esfera, ni el vidrio, ni sombra, ni fondo,
ni contorno. Todo lo que no sea un reflejo tiene que ser 100% transparente.
```

**Salió bien si:** apilada sobre el cristal, los reflejos caen dentro de la
esfera y en el canto — no afuera, no corridos.

---

### 4.3 `mundo-aventura-source.png` — el archipiélago

| | |
|---|---|
| **Guardar en** | `Images/orbita/orbes/mundo-aventura-source.png` |
| **Medida** | 1024×1024 exacta |
| **Formato** | PNG (la transparencia no hace falta: el importador la recorta en círculo) |
| **Referencias a adjuntar** | `public/assets/islands/island1/map.webp`, `public/assets/islands/island13/map.webp`, `public/assets/edutic-art/sky-soft-bg.webp` |
| **Sale como** | `public/assets/orbita/orbes/mundo-aventura.webp` |

**Qué tiene que lograr.** El modo historia visto como una maqueta adentro de una
bola de cristal. Un chico tiene que reconocer sus islas de un vistazo, desde el
otro lado del vidrio.

```
Te paso imágenes de referencia de un juego infantil de mecanografía: dos islas
flotantes recortadas y el cielo pastel del juego. Tomá de ahí el estilo — 3D
suave, colores brillantes y pasteles, luz cálida, aire de cuento.

Necesito una ilustración CUADRADA de 1024x1024 que después se va a recortar en
círculo y a mostrar adentro de una burbuja de cristal, como una maqueta.

Es un archipiélago de islas flotantes visto desde lejos y desde arriba, en un
cielo pastel de amanecer con nubes suaves, y un sendero de luz que une las
islas entre sí. Tres o cuatro islas, ninguna en primer plano: la escena se lee
entera y de un vistazo, como un mundo en miniatura.

La composición tiene que funcionar RECORTADA EN CÍRCULO: todo lo importante
bien adentro y hacia el centro, y las esquinas del cuadrado con relleno de
cielo y nubes que se pueden perder sin que se note.

Sin texto, sin personajes, sin naves, sin interfaz, sin marco, sin borde. Sólo
el paisaje.
```

**Salió bien si:** tapás mentalmente las esquinas del cuadrado y la escena
sigue completa.

---

### 4.4 `mundo-orbita-source.png` — el espacio

| | |
|---|---|
| **Guardar en** | `Images/orbita/orbes/mundo-orbita-source.png` |
| **Medida** | 1024×1024 exacta |
| **Formato** | PNG |
| **Referencias a adjuntar** | `mundo-aventura-source.png` (el que acabás de aprobar) y `public/assets/edutic-art/sky-soft-bg.webp` |
| **Sale como** | `public/assets/orbita/orbes/mundo-orbita.webp` |

**Qué tiene que lograr.** El reverso nocturno del otro orbe. Al lado del de
aventura tiene que leerse como **el mismo cuento de noche**, no como otro juego.

```
Te paso la ilustración del interior de otro orbe del mismo juego. Necesito el
compañero: mismo formato, mismo estilo, misma calidad de luz, pero de noche.

Una ilustración CUADRADA de 1024x1024 que se recorta en círculo y se muestra
adentro de una burbuja de cristal.

Es espacio profundo: azul muy oscuro, estrellas, una nebulosa suave violeta y
turquesa. Entre las estrellas flotan a la deriva unas pocas LETRAS y signos
sueltos, como escombros luminosos — una A, una ñ, un signo de pregunta
invertido, un asterisco. Las letras son objetos de cristal que brillan con luz
propia, no texto plano pegado encima.

Seis u ocho letras como mucho, bien repartidas y en distintos tamaños y
ángulos. Tiene que leerse como un mundo, no como un cartel.

La composición tiene que funcionar RECORTADA EN CÍRCULO: lo importante hacia el
centro, las esquinas con cielo estrellado que se puede perder.

Sin palabras completas ni frases, sin naves, sin interfaz, sin marco.
```

**Salió bien si:** puesto al lado del de aventura, los dos parecen dos ventanas
al mismo universo.

---

### 4.5 `mundo-dormido-source.png` — el modo bloqueado

| | |
|---|---|
| **Guardar en** | `Images/orbita/orbes/mundo-dormido-source.png` |
| **Medida** | 1024×1024 exacta |
| **Formato** | PNG |
| **Referencias a adjuntar** | `mundo-aventura-source.png`, para que el encuadre y la luz coincidan |
| **Sale como** | `public/assets/orbita/orbes/mundo-dormido.webp` |

**Qué tiene que lograr.** Decir *todavía no*, nunca *roto*. Es el único que se
reusa: **todo modo futuro que no esté listo muestra este mismo archivo**, así el
selector nunca tiene un hueco.

```
Te paso la ilustración del interior de un orbe de cristal de un juego infantil.
Necesito la versión APAGADA, para un modo que todavía no está disponible.

Una ilustración CUADRADA de 1024x1024, mismo encuadre, que se recorta en
círculo dentro de una burbuja de cristal.

Es el interior de un orbe dormido: cristal empañado por dentro, escarcha suave,
gris azulado frío y parejo, con un brillo tenue en el centro. Se intuye que hay
algo detrás pero no se distingue nada.

Sin escena, sin paisaje, sin islas, sin objetos reconocibles, sin candados, sin
grietas, sin símbolos de bloqueo.

Tiene que transmitir "todavía no", no "roto" ni "prohibido".
```

**Salió bien si:** da ganas de saber qué hay adentro.

---

### 4.6 `estrellas-source.png` — el campo estelar

| | |
|---|---|
| **Guardar en** | `Images/orbita/fondo/estrellas-source.png` |
| **Medida** | 2560×1440 (16:9). Mínimo aceptable 1920×1080 |
| **Formato** | PNG **sin** transparencia |
| **Referencias a adjuntar** | ninguna |
| **Sale como** | `public/assets/orbita/fondo/estrellas.webp` |

**Qué tiene que lograr.** Ser el fondo más aburrido posible. Es la capa sobre la
que se lee todo el juego: cualquier cosa interesante que tenga compite con las
palabras.

```
Necesito el campo estelar de fondo de un minijuego espacial para chicos de
primaria. Una sola imagen horizontal de 2560x1440, SIN transparencia.

Es azul muy oscuro, casi negro, con un degradado suave que aclara apenas hacia
el borde de arriba. Encima, estrellas chiquitas de distintos tamaños y brillos,
repartidas de forma irregular y natural — nunca en grilla, nunca en líneas.

Condición que manda sobre todas las demás: el TERCIO CENTRAL de la imagen tiene
que ser la parte más vacía y más oscura de todo el cuadro. Ahí encima el juego
dibuja palabras en movimiento que hay que leer rápido, así que en esa zona no
puede haber nada brillante: ni una estrella grande, ni un cúmulo, ni una
galaxia, ni una nube. Las estrellas más grandes van cerca de los bordes de
arriba y de abajo.

NO incluyas: planetas, naves, asteroides, lunas, cometas, nebulosas de colores
fuertes, texto, ni ningún objeto reconocible. Es sólo cielo profundo.

Estilo limpio y suave, de cuento, sin grano ni ruido fotográfico. Es para un
juego infantil de estética pastel, no para una simulación realista.
```

**Salió bien si:** te aburre mirarla. En serio: si algo te llama la atención al
verla, ese algo va a competir con las palabras.

---

### 4.7 `nebulosa-source.png` — las nubes

| | |
|---|---|
| **Guardar en** | `Images/orbita/fondo/nebulosa-source.png` |
| **Medida** | 2560×1440 (16:9). Mínimo 1920×1080 |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | ninguna |
| **Sale como** | `public/assets/orbita/fondo/nebulosa.webp` |

**Qué tiene que lograr.** Ser una **máscara de luminosidad**, no una
ilustración. Es la capa que lleva el color de la tensión, y por eso se dibuja
sin color: el juego se lo pone y lo va cambiando mientras se juega.

```
Necesito una capa de nebulosa para superponer sobre un campo estelar, en un
minijuego espacial para chicos. Imagen horizontal de 2560x1440, en PNG CON
TRANSPARENCIA REAL.

Son nubes suaves y difusas, de bordes lavados, sin ningún contorno duro. Se
concentran en las cuatro ESQUINAS y en las franjas de arriba y de abajo, y se
van desvaneciendo hasta ser COMPLETAMENTE TRANSPARENTES en el centro de la
imagen. El centro tiene que quedar limpio.

MUY IMPORTANTE, el color: dibujala en GRIS Y BLANCO, sin ningún color. Es una
máscara de luminosidad, no una ilustración: el juego le pone el color por
encima y lo va cambiando mientras se juega. Si la generás violeta, azul o
rosa, el juego no la puede llevar a otro tono sin ensuciarla.

Fondo completamente transparente, NO negro. Sin estrellas (van en otra capa),
sin planetas, sin objetos, sin texto.
```

**Salió bien si:** es gris, y el centro se ve limpio al ponerla sobre cualquier
color. Si vino violeta, **rehacela** — el importador la va a aceptar igual
porque no mide color, y el problema aparece recién cuando el juego intente
llevarla a rojo.

---

### 4.8 `polvo-source.png` — las partículas cercanas

| | |
|---|---|
| **Guardar en** | `Images/orbita/fondo/polvo-source.png` |
| **Medida** | 2560×1440 (16:9). Mínimo 1920×1080 |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | ninguna |
| **Sale como** | `public/assets/orbita/fondo/polvo.webp` |

**Qué tiene que lograr.** Dar profundidad. Es la capa que se mueve más rápido,
así que **pocas y suaves**: muchas partículas rápidas marean, y esto lo van a
jugar chicos durante dos minutos seguidos mirando fijo.

```
Necesito una capa de partículas cercanas para un minijuego espacial infantil.
Imagen horizontal de 2560x1440, en PNG CON TRANSPARENCIA REAL.

Son POCAS motas de polvo y cristalitos brillantes, esparcidas y con desenfoque
suave, como si estuvieran muy cerca de la cámara. Entre veinte y cuarenta en
toda la imagen, no más.

Blancas y celeste muy pálido, sin bordes definidos.

Dejá el tercio central bastante libre: por ahí pasan las palabras del juego.

Fondo completamente transparente. Sin estrellas de fondo, sin nebulosa, sin
objetos, sin texto.
```

**Salió bien si:** las podés contar.

---

## 5. El mapa de zonas del minijuego

**Medidos en la app (2026-09-02), en `TormentaPage.tsx`**, ya no son
objetivos: el HUD ocupa y 0–9 %; el punto de fuga está en (50 %, 24 %) y las
palabras convergen hacia (50 %, 78 %) creciendo hasta ×1,35; la nave ocupa
y 87–97 % centrada; el termómetro de amenaza va a 10 px del borde derecho
entre y 14 % y 72 %, con la nube 30 px por encima; el cartel del vuelo de
prueba queda en y 88 %. **El horizonte (§7.1) arranca en y 70 % y todo lo
que dibuja queda por debajo del 62 %**, así que las palabras lo cruzan solo
en su último tramo, ya grandes.

```
        0%        20%                             80%       100%
   0%   ┌──────────┬───────────────────────────────┬──────────┐
        │ corazones│  PUNTAJE Y RACHA              │ cristales│  ← y 0–9 %
   9%   ├──────────┴───────────────────────────────┴──────────┤
        │                                                     │
        │              PUNTO DE FUGA (50 %, 26 %)             │
        │        las palabras nacen acá y crecen hacia        │  ← y 9–74 %
        │        la cámara. TODO ESTO TIENE QUE SER           │
        │        TRANQUILO: encima va texto en movimiento     │
        │                                              ▓ ← barra
  74%   ├──────────┬───────────────────────────────┬──────────┤   de amenaza
        │          │            LA NAVE            │          │  ← y 74–94 %
 100%   └──────────┴───────────────────────────────┴──────────┘
             ↑                                          ↑
        estos 8 % de cada lado se pierden en las Chromebooks 3:2
```

Tres consecuencias, y son las tres que más se van a incumplir:

- **El centro tiene que estar vacío**, en las tres capas del fondo a la vez.
- **Los 8 % de cada costado se recortan** en las Chromebook 3:2, igual que en
  los fondos de nivel: el arte es 16:9 (1,777) y esa pantalla es 1,5, así que
  `cover` deja visible el 84 % del ancho. Ahí no va nada que importe.
- **Nada se alinea con nada.** A diferencia del fondo de nivel, acá no hay
  pedestal ni objeto que tenga que caer en su lugar: las tres capas se recortan
  libremente y se mueven en parallax. Eso las hace fáciles, con la única
  condición de que el centro esté tranquilo.

---

## 6. Los iconos no pasan por acá

Los veinte iconos —cinco de HUD, dos nubes del termómetro de amenaza, siete
de powerup, seis de rango— **ya están hechos**. Son SVG dibujados a mano, no
imágenes generadas: un icono de 16 px rasterizado sale sucio siempre, y
estos tienen que leerse sobre un campo estelar en movimiento.

```
Images/orbita/iconos/    corazón lleno y vacío · escudo entero y agrietado ·
                         cristal · nube calma y nube de tormenta · los siete powerups
Images/orbita/rangos/    cadete · piloto · explorador · as · capitán · leyenda
```

**Lo que se ve GRANDE no es SVG.** La insignia del resultado y del podio, la
gema del poder que llega a la nave y el cristal del saldo son objetos 3D
generados (§7.3 y §7.4). Los componentes `InsigniaRango tamano="grande"` y
`Gema` los cargan y, si el WebP todavía no existe, caen al SVG sin ruido:
así el rediseño entra por tandas y nada queda roto entre una y otra.

Dos convenciones, y las dos son funcionales:

- **Los de `iconos/` están dibujados en `currentColor`.** Una sola propiedad CSS
  los tiñe, así que el mismo archivo sirve para el corazón rojo del HUD y para
  la cápsula dorada que cae. El brillo va en blanco translúcido y la sombra en
  negro muy bajo, así que funcionan sobre cualquier fondo.
- **Los de `rangos/` tienen color propio y forma propia, y las dos suben
  juntas.** Cadete lleva la estrella sola, Piloto suma un galón, Explorador dos,
  As tres, Capitán las alas y Leyenda el cometa y el aro. Se distinguen
  contando, sin depender del color — la misma regla por la que el estado de un
  nivel no se dice sólo con color.

Estos archivos **no se copian a `public/`**: se inlinean en el bundle vía
copias en `src/components/orbita/svg/` que importa `OrbitaIconos.tsx` con
`?raw`. (Y `Images/` queda fuera del contenedor por `.dockerignore`, así que
servirlos desde acá no funcionaría.) **La fuente de verdad sigue siendo esta
carpeta**: si un icono se redibuja acá, copiarlo a `src/components/orbita/svg/`
en el mismo commit — son un espejo, no dos originales.

Para mirarlos todos juntos, teñidos y a tamaño real:

```bash
node scripts/preview-orbita-iconos.mjs      # escribe .preview-orbita/iconos.png
```

La fila del medio los dibuja a 20 px, que es donde un icono se rompe. Si algo no
se distingue ahí, hay que rehacerlo antes de que llegue al HUD.

---

## 7. El rediseño estético: horizonte, estación, insignias y gemas

La dirección de arte completa está en el artefacto "Rediseño visual de
Órbita" (2026-09-02). La tesis en una línea: **Órbita es el mismo cuento de
las islas, de noche, visto desde arriba.** Índigo en vez de negro, las
mismas nubes del cielo de día como máscara nocturna, el mundo de las islas
asomando debajo de la nave, el vidrio blanco esmerilado de la tarjeta de
login en todas las pantallas, y objetos de caramelo donde algo se ve grande.
La referencia de todo es `mundo-orbita` (§4.4), que ya está en estilo.

Valen las cinco reglas de §1. El generador da 1024×1024, 1536×1024 y
1024×1536: para las capas de 2560×1440 pedí 1536×1024 y escalá con el mismo
criterio de siempre (mínimo 1920×1080; el importador nunca agranda).

**Orden.** Primero el horizonte (7.1) y no sigas hasta que las palabras se
lean encima con los tres tintes. Después estrellas y nebulosa juntas (7.5):
se juzgan como un set. La estación (7.2) va sola. En insignias iterá
**cadete** hasta que cierre y mandalo de molde para las otras cinco; en
gemas el molde es **escudo**.

### 7.1 `horizonte-source.png` — el mundo visto desde la órbita

| | |
|---|---|
| **Guardar en** | `Images/orbita/fondo/horizonte-source.png` |
| **Medida** | 2560×1440 (16:9). Mínimo 1920×1080 |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | `public/assets/islands/island1/map.webp`, `public/assets/islands/island13/map.webp`, `public/assets/edutic-art/sky-soft-bg.webp` y `Images/orbita/orbes/mundo-orbita-source.png` |
| **Sale como** | `public/assets/orbita/fondo/horizonte.webp` |

**Qué tiene que lograr.** Darle lugar a la nave. Es la capa que convierte el
vacío en "estoy volando encima de mi mundo". Vive solo en la franja de
abajo: todo lo que esté por encima del 62 % de la altura tiene que ser
transparente, porque ahí pasan las palabras y el resto del cielo lo ponen
las otras capas.

```
Te paso imágenes de referencia de un juego infantil de mecanografía: dos islas
flotantes del mapa, el cielo pastel del juego y el interior de un orbe de
cristal con el espacio de noche. Tomá de ahí el estilo: 3D suave, colores
brillantes y pasteles, luz cálida, aire de cuento.

Necesito una capa de HORIZONTE para el fondo de un minijuego espacial. Imagen
horizontal de 2560x1440, en PNG CON TRANSPARENCIA REAL.

Es el mundo de esas islas visto desde muy arriba, desde la órbita, de noche.
Ocupa SOLO la franja de abajo: la curva suave y ancha del planeta, cubierta
por un mar de nubes nocturnas azul lavanda, y asomando entre las nubes cinco
o seis islas flotantes diminutas, con sus cristales y sus ventanitas
encendidas, como las luces de un pueblo visto desde un avión. Sobre la curva,
un aro fino de atmósfera turquesa y rosa, como un amanecer que todavía no
llegó.

Condición que manda sobre todas las demás: el 62% SUPERIOR de la imagen tiene
que ser COMPLETAMENTE TRANSPARENTE. Sin estrellas, sin nubes, sin brillo, sin
degradado, sin nada. La curva del horizonte arranca alrededor del 70% de la
altura y nada de lo dibujado sube más allá del 62%.

La franja dibujada es de tono medio a oscuro: nubes azul lavanda con luz
suave, nunca claras ni blancas. Encima de ese horizonte todavía pasan
palabras que hay que leer.

El centro de la franja de abajo tiene que ser la parte más tranquila: ahí se
apoya la nave del jugador. Las islas y los detalles van hacia los costados,
sin llegar a los 8% de cada borde.

Sin naves, sin personajes, sin texto, sin interfaz, sin marco. Estilo limpio,
de cuento, sin grano fotográfico.
```

**Salió bien si:** tapás mentalmente el 62 % de arriba y no perdés nada; las
islas se reconocen como las del mapa; y en `preview-orbita-fondo.mjs` (que
ahora apila el horizonte) las palabras que cruzan la franja se leen con el
tinte coral. El importador mide la opacidad del 62 % superior (tope 0,03) y
el brillo de la franja inferior (tope 0,35).

⚠️ **No la generes llenando el cuadro. Ya lo probamos y no funciona.**
La franja dibujada ocupa el 30 % de una imagen 16:9, así que dos tercios de
los píxeles son transparentes, y es tentador pedirla "más cerca" para ganar
detalle. El problema es geométrico: para que la franja entre en el tercio de
abajo **a lo ancho de la pantalla**, la imagen tendría que ser de proporción
5:1. Una 16:9 que llena el cuadro se despliega sobre TODA la pantalla — las
islas quedan grandes y contrastadas justo donde vuelan las palabras, y el
tinte de la amenaza casi no se ve porque el horizonte tapa el 75 % del cielo.
Medido: en la zona de vuelo daba 0,231 de brillo y 0,123 de contraste, contra
0,012 y 0,067 de la versión buena. El importador ahora lo rechaza solo.

**El importador la ATENÚA** (`ATENUAR` en `import-orbita-art.mjs`: brillo
×0,62, saturación ×0,82) y recién ahí mide, porque lo que hay que aprobar es
lo que se sirve, no la fuente. La primera versión aprobada medía 0,424 —
preciosa sola, pero un mediodía debajo de palabras blancas — y con la
atenuación queda en 0,246. **Generala igual como te guste**: bajarle la
exposición es un arreglo de reproducción, como el realce de `mundo-dormido`,
y la fuente queda intacta. Si con la atenuación puesta el brillo sigue
arriba del tope, ahí sí hay que regenerarla.

**Y se tiñe con la amenaza.** El horizonte se dibuja ARRIBA de la capa de
tinte, así que sin ayuda se quedaba azul mientras el cielo se iba a coral y
la pantalla se partía en dos. `.orb-horizonte-tinte` lo tiñe con el mismo
color, enmascarado por el propio horizonte y en `mix-blend-mode: color` (toma
el tono, deja la luminosidad), a media fuerza: el mundo se contagia de la
tormenta, no se disfraza.

### 7.2 `estacion-source.png` — la estación orbital

| | |
|---|---|
| **Guardar en** | `Images/orbita/hub/estacion-source.png` |
| **Medida** | 1536×1024 (3:2) |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | `public/assets/islands/island1/map.webp`, `public/assets/islands/island4/map.webp`, `public/assets/edutic-art/skins/ship-t1-f3.webp` (para la escala del puerto) y `Images/orbita/orbes/mundo-orbita-source.png` |
| **Sale como** | `public/assets/orbita/hub/estacion.webp` |

**Qué tiene que lograr.** Ser una isla más, la que quedó en órbita. Misma
piedra lavanda con runas encendidas, mismos cristales y plantitas de las
islas, pero de noche y con un puerto: una plataforma redonda y despejada
donde el juego apoya la nave con HTML (`.orb-puerto`). La nave NO va
dibujada.

```
Te paso imágenes de referencia de un juego infantil de mecanografía: dos islas
flotantes del mapa, la nave del jugador (solo para que sepas su tamaño y su
estilo) y el interior de un orbe con el espacio de noche. Tomá de ahí el
estilo: 3D suave, colores brillantes y pasteles, luz cálida, aire de cuento.

Necesito UNA ISLA FLOTANTE NUEVA: una pequeña estación orbital, la isla que
quedó flotando en el espacio, de noche. Imagen horizontal de 1536x1024 en PNG
CON TRANSPARENCIA REAL, con la isla sola sobre fondo transparente, vista en
tres cuartos desde arriba como las islas del mapa.

Está hecha del mismo material que las islas de referencia: bloques de piedra
lavanda con runas de luz turquesa, cristales que brillan, musgo y plantitas,
raíces y piedritas colgando abajo. Lo que la hace estación: en el centro
tiene una PLATAFORMA REDONDA, ANCHA Y DESPEJADA, de piedra lisa con un aro de
luz suave en el borde, que ocupa alrededor de un tercio del ancho de la
imagen. Es el puerto donde se apoya la nave, así que su superficie tiene que
estar completamente vacía y ser de tono medio, más oscura que el vidrio claro
de la nave. Alrededor de la plataforma, poca cosa: un farol de cristal, una
antena parabólica pequeña y redonda, dos o tres cristales grandes, una
bandera sin dibujo. Ventanitas encendidas con luz cálida en la piedra.

La plataforma queda en el centro del cuadro, un poco por encima de la mitad,
porque el juego apoya la nave ahí y la nave sobresale hacia arriba.

Sin nave, sin personajes, sin texto, sin carteles con letras, sin interfaz,
sin marco, sin fondo: solo la isla sobre transparencia.
```

**Salió bien si:** puesta al lado de la isla 1 parece de la misma serie, la
plataforma está vacía y se ve como una mesa, y la nave (que la página apoya
al 36 % del ancho, centrada, con su base a la altura del centro de la
plataforma) queda apoyada sin tapar los cristales. El importador exige alpha
real y recorta el margen transparente.

### 7.3 `insignias/<rango>-source.png` — seis medallas de caramelo

| | |
|---|---|
| **Guardar en** | `Images/orbita/insignias/cadete-source.png` y así con `piloto`, `explorador`, `as`, `capitan`, `leyenda` (sin tilde en los nombres) |
| **Medida** | 1024×1024, la medalla centrada con un margen chico de aire |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | Para **cadete**: `public/assets/edutic-art/mascot-proud.webp` (el material) y `Images/orbita/rangos/cadete.svg` (la forma). Para los otros cinco: **la medalla de cadete ya aprobada** más el SVG de ese rango |
| **Sale como** | `public/assets/orbita/insignias/<rango>.webp` |

**Qué tiene que lograr.** Que subir de rango se sienta como ganar un objeto.
La forma de cada rango ya está decidida en los SVG y se distingue contando,
sin depender del color: cadete la estrella sola, piloto suma un galón,
explorador dos, as tres, capitán las alas, leyenda el cometa y el aro. Los
SVG siguen valiendo para el HUD y las listas; estas medallas son para donde
se ven grandes: el resultado, el podio, el hub.

```
Te paso dos imágenes de referencia de un juego infantil: un robot mascota, del
que quiero el MATERIAL (esmalte color crema brillante, cantos dorados, gemas
turquesa y violeta, luz cálida, 3D suave de caramelo), y un icono plano con
la FORMA exacta de la medalla que necesito.

Necesito esa medalla como OBJETO 3D, para un juego de islas flotantes de
estética pastel. Imagen cuadrada de 1024x1024 en PNG CON TRANSPARENCIA REAL,
la medalla centrada, ocupando casi todo el cuadro con un margen chico de
aire, vista de frente con una leve inclinación que deje ver el grosor.

Respetá la forma del icono: mismo contorno hexagonal, misma estrella de
cuatro puntas en el centro, mismos elementos y en la misma cantidad. La
cantidad de galones, alas o aros es lo que distingue un rango de otro, así
que no agregues ni saques ninguno.

Es una medalla de esmalte con cantos redondeados, borde dorado fino, un
brillo especular arriba a la izquierda y una sombra suave dentro del propio
objeto. Sin cinta, sin cadena, sin pedestal, sin fondo, sin sombra
proyectada, sin texto ni números.

RANGO: cadete / esmalte color menta (#54e8c6) / la estrella sola, sin galones.
```

| Archivo | Bloque RANGO |
|---|---|
| `cadete-source.png` | cadete / esmalte menta (#54e8c6) / la estrella sola, sin galones |
| `piloto-source.png` | piloto / esmalte turquesa (#25c8df) / la estrella y UN galón abajo |
| `explorador-source.png` | explorador / esmalte azul eléctrico (#536bff) / la estrella y DOS galones apilados |
| `as-source.png` | as / esmalte violeta (#9b7cff) / la estrella y TRES galones apilados |
| `capitan-source.png` | capitán / esmalte rosa (#ff9fca) / la estrella con dos alas abiertas a los costados |
| `leyenda-source.png` | leyenda / esmalte dorado (#ffd552) con cantos crema / la estrella con un cometa cruzando y un aro de luz alrededor |

Para las cinco que siguen a cadete, cambiá la primera oración por: *"Te paso
la medalla de cadete ya hecha, que es el molde de material, tamaño, cámara y
posición en el cuadro, y el icono plano con la forma de la medalla que
necesito ahora"*. Después el prompt sigue igual con su bloque RANGO.

**Salió bien si:** las seis en fila se ven como una familia (misma cámara,
mismo tamaño, mismo brillo) y a 96 px todavía se cuentan los galones. El
importador las recorta y las encuadra en un cuadrado con margen parejo.

**No se aprueban sueltas**, igual que los orbes: una insignia sola siempre
parece linda, y el problema aparece en fila, que es como se ven en el podio.

```bash
node scripts/preview-orbita-objetos.mjs   # insignias y gemas, en fila
```

Las dibuja a 140, 96 y 40 px sobre los DOS fondos en los que viven: el índigo
de la escena y el vidrio claro de la tarjeta de resultado. Los 40 px son solo
de referencia — a ese tamaño la app usa el SVG, no la imagen.

El par que más se parece es **explorador (dos galones) y as (tres)**: si a
96 px no los podés contar, es ahí donde hay que insistir.

### 7.4 `gemas/<poder>-source.png` — las gemas de poder y el cristal

| | |
|---|---|
| **Guardar en** | `Images/orbita/gemas/escudo-source.png` y así con `reparacion`, `pulso`, `lento`, `rayo`, `cosecha`, `mira`, `cristal` |
| **Medida** | 1024×1024 |
| **Formato** | PNG con transparencia real |
| **Referencias a adjuntar** | Para **escudo**: `Images/orbita/orbes/cristal-source.png` (el vidrio), un cristal de `island1/map.webp` y `Images/orbita/iconos/pw-escudo.svg`. Para las otras: **la gema de escudo aprobada** más el SVG de ese poder (`lento` usa `pw-tiempo.svg`) |
| **Sale como** | `public/assets/orbita/gemas/<poder>.webp` |

**Qué tiene que lograr.** Que la sorpresa del poder, cuando llega a la nave,
se revele como un objeto que dan ganas de agarrar, y que en el hangar y en
el resultado se entienda qué es de un vistazo. Son cristales facetados con
el símbolo del poder adentro, iluminado. En el HUD y en la palabra que vuela
siguen los SVG.

```
Te paso tres imágenes de referencia de un juego infantil de estética pastel:
una burbuja de cristal (el vidrio), un cristal de una de sus islas (la
facetación y el brillo) y un icono plano con el SÍMBOLO que necesito adentro.

Necesito una GEMA DE PODER: un cristal facetado, redondeado, como una cápsula
de vidrio de colores, con el símbolo del icono flotando adentro, iluminado
con luz propia. Imagen cuadrada de 1024x1024 en PNG CON TRANSPARENCIA REAL,
la gema centrada, ocupando casi todo el cuadro con un margen chico de aire,
vista de frente.

Estilo 3D suave de caramelo, luz cálida, un brillo especular arriba a la
izquierda, sombra suave dentro del propio objeto. El símbolo tiene que leerse
a primera vista: simple, grueso, del color que digo abajo, sin detalles
finos.

Sin pedestal, sin fondo, sin sombra proyectada, sin texto, sin partículas
alrededor.

PODER: escudo / cristal color menta (#54e8c6) / adentro, un escudo redondeado
blanco con una gema en el centro.
```

| Archivo | Bloque PODER |
|---|---|
| `escudo-source.png` | escudo / cristal menta (#54e8c6) / un escudo redondeado blanco con una gema en el centro |
| `reparacion-source.png` | reparación / cristal rosa coral (#ff6b8a) / un corazón blanco con una cruz chiquita arriba a la derecha |
| `pulso-source.png` | pulso / cristal celeste (#25c8df) / tres aros concéntricos blancos que se expanden |
| `lento-source.png` | lento / cristal lavanda (#9b7cff) / un reloj de arena blanco |
| `rayo-source.png` | rayo / cristal dorado (#ffd552) / dos rayos blancos en paralelo |
| `cosecha-source.png` | cosecha / cristal violeta (#7c71ff) / dos cristalitos blancos pegados |
| `mira-source.png` | mira / cristal rosa (#ff9fca) / una mira redonda blanca con un punto en el centro |
| `cristal-source.png` | cristal / cristal violeta (#9b7cff) / sin símbolo adentro: es la gema pura, la moneda del modo |

**Salió bien si:** las ocho en fila son una familia, el símbolo se reconoce
a 72 px (el tamaño de la revelación sobre la nave) y el cristal de la moneda
parece hermano de los cristales de la isla 1.

### 7.5 Estrellas y nebulosa, versión 2

Las fichas de §4.6 y §4.7 siguen valiendo con dos cambios de dirección, y se
regeneran juntas porque se juzgan como un set:

- **Estrellas:** cielo ÍNDIGO PROFUNDO, no negro — azul violáceo oscuro y
  parejo que se aclara apenas hacia lavanda en las cuatro esquinas y en el
  borde de arriba — y unas pocas estrellas grandes con forma de destello de
  cuatro puntas, como las del cielo de día (`sky-soft-bg.webp`, que va de
  referencia junto con `mundo-orbita-source.png`), siempre cerca de los
  bordes. El tercio central sigue siendo lo más oscuro y vacío. El índigo
  da más brillo que la versión 1 (que estaba en 0,04): está previsto, el
  tope de 0,20 tiene aire.
- **Nebulosa:** cúmulos redondos y esponjosos con la forma de las nubes de
  `sky-soft-bg.webp` (que va de referencia), no jirones de nebulosa. Sigue
  siendo una máscara en GRIS con el centro transparente: el juego le pone
  el color de la amenaza, que ahora va de pervinca a violeta a coral.

Guardá la versión anterior de cada una fuera de la carpeta (por ejemplo
`estrellas-v1.png` en `Images/orbita/`) por si hay que volver.
