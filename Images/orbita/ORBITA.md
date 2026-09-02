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

⚠️ **Estos números son objetivos de diseño, no mediciones.** Los de `FONDOS.md`
se tomaron en la app; la pantalla de Órbita todavía no existe. **Volver acá y
medirlos de verdad cuando el juego esté armado**, igual que se hizo con el
pedestal, y corregir este bloque.

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

Los dieciocho iconos —cinco de HUD, siete de powerup, seis de rango— **ya están
hechos**. Son SVG dibujados a mano, no imágenes generadas: un icono de 16 px
rasterizado sale sucio siempre, y estos tienen que leerse sobre un campo
estelar en movimiento.

```
Images/orbita/iconos/    corazón lleno y vacío · escudo entero y agrietado ·
                         cristal · los siete powerups
Images/orbita/rangos/    cadete · piloto · explorador · as · capitán · leyenda
```

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
