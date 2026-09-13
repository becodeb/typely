# Arte de Carrera de cohetes

Generado con imagegen integrado el 08/09/2026, siguiendo el brief y la autorización de Ezequiel para elegir e integrar imágenes sin una aprobación individual. Referencias: `Images/orbita/fondo/horizonte-source.png`, `Images/orbita/hub/estacion-source.png` y `public/assets/orbita/orbes/mundo-orbita.webp`. Los prompts siguientes son los registrados por la herramienta.

Las fuentes elegidas se conservan como `*-source.png`. El importador mantiene el alpha existente y recupera el mate negro de la recta y de las medallas corregidas con sharp, autorizado previamente. La pista conserva su lienzo completo para no desplazar los carriles; su 35 % superior tiene opacidad 0.000.

La recta fue solicitada a 2560×1440 y el generador entregó 1672×941; se conserva la resolución nativa, sin agrandar. Las otras piezas llegaron a 1254×1254 y se redujeron a los topes del brief.

Importación: `node scripts/import-orbita-art.mjs carrera`. Vista del arte con el texto: `node scripts/preview-orbita-carrera.mjs`. Las propuestas descartadas se conservan; no se cargan en el juego.

## Recta, primera propuesta

Generación: `exec-fa2a3268-bf9f-4a63-ba68-760d9016e74a`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 2560×1440 horizontal 16:9. RECTA ESPACIAL: pista de carrera de naves, cinco carriles de luz turquesa y violeta que van de izquierda a derecha con perspectiva suave, desde x=8% hasta x=87%. Arrancan a alturas y=55%,64%,73%,82%,91% y terminan a y=55%,60%,65%,70%,75% respectivamente. Carriles VACÍOS, SIN naves, SIN arco de meta (va aparte). Marcas discretas de luz y mar de nubes nocturnas muy tenue abajo. Tono medio oscuro para que se vean naves encima. El 40% superior COMPLETAMENTE VACÍO y transparente, allí va texto. No cielo, no estrellas arriba, no edificios. No recortar el lienzo: mantener franja superior vacía.
```

## Recta, corrección de perspectiva y fondo

Generación: `exec-579910d3-7f15-4618-bb44-8016e23b1944`.

```text
Corregí esta pista para usarla en TYPELY. Mantener textura de caramelo lavanda, cinco carriles luminosos turquesa y violeta y nubes oscuras abajo. CAMBIOS OBLIGATORIOS: quitar TODOS los edificios, torres, faroles, islas, plantas y cristales grandes. No hay objetos aparte de la pista y nubes abajo. Reemplazar completamente el damero gris por fondo NEGRO PURO #000000 uniforme. El 40% superior del lienzo negro completamente vacío. CINCO CARRILES RECTOS, sin curvas, desde la izquierda hacia la derecha en suave perspectiva; todos se ven y mantienen orden de arriba abajo. No son una autopista que dobla: cada carril es una RECTA diagonal que une un punto izquierdo a uno derecho. Dejar margen lateral8%. No arco de meta ni naves. Horizontal 2560×1440. Sin texto, logos o marcos. Fondo negro se quitará con sharp ya autorizado.
```

## Recta, cinco carriles definitivos

Generación: `exec-4acc1c2a-319f-4e7f-a825-0d688f989ead`.

```text
Esta pista tiene SOLO CUATRO carriles anchos. Necesito EXACTAMENTE CINCO carriles anchos (CINCO bandas anchas transitables entre SEIS líneas limítrofes finas). Agregar un QUINTO carril ancho violeta debajo del último carril rosa, desplazando un poco las nubes inferiores si hace falta. Mantener los otros cuatro carriles, la cámara, las rectas diagonales, el fondo NEGRO PURO uniforme completamente vacío arriba y la ausencia de objetos. Cada uno de los cinco carriles debe tener su propia fila de marcas de estrellas. Contar CINCO filas de estrellas separadas antes de terminar. No agregar números o texto. Mantener todo en la mitad inferior del lienzo horizontal. 2560×1440.
```

## Meta

Generación: `exec-bfcb45ea-828e-4d5c-91d7-1193538449cd`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 1024×1024. META: arco de cristal facetado con dos faros encendidos, uno a cada lado, y arco de luz dorada entre ellos. Vista de frente, apoyado en nada, sobre transparencia. Un solo arco compacto centrado con margen pequeño.
```

## Banderín rojo

Generación: `exec-8003d26e-bee4-457e-a447-94a2965f1912`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 512×512. BANDERÍN DE LARGADA: un foco redondo de cristal en un soporte corto de piedra lavanda, encendido en rojo coral, luz propia y brillo especular. Frente, un único foco centrado, material uniforme como una familia de semáforos. Sin letras ni otros colores de foco.
```

## Banderín amarillo

Generación: `exec-165fc572-669c-4e39-8bea-fef1b455a562`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 512×512. BANDERÍN DE LARGADA: un foco redondo de cristal en un soporte corto de piedra lavanda, encendido en amarillo dorado, luz propia y brillo especular. Frente, un único foco centrado, material uniforme como una familia de semáforos. Sin letras ni otros colores de foco.
```

## Banderín verde

Generación: `exec-d53bc147-f7ec-463c-809a-3fc4ba3c31a9`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 512×512. BANDERÍN DE LARGADA: un foco redondo de cristal en un soporte corto de piedra lavanda, encendido en verde menta, luz propia y brillo especular. Frente, un único foco centrado, material uniforme como una familia de semáforos. Sin letras ni otros colores de foco.
```

## Medalla de oro

Generación: `exec-ac150f13-86e4-4a81-b97e-1d41d3458cc9`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 1024×1024. MEDALLA DE CARRERA: medalla hexagonal de caramelo y metal oro, cantos gruesos redondeados dorados acordes al material, con cohete blanco estilizado en el centro y cinta corta lavanda arriba. Vista de frente, un solo objeto centrado. Sin letras ni números.
```

## Medalla de plata, primera propuesta

Generación: `exec-04f52207-12a0-4804-ac9d-445b040d3c85`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 1024×1024. MEDALLA DE CARRERA: medalla hexagonal de caramelo y metal plata, cantos gruesos redondeados dorados acordes al material, con cohete blanco estilizado en el centro y cinta corta lavanda arriba. Vista de frente, un solo objeto centrado. Sin letras ni números.
```

## Medalla de plata, metal definitivo

Generación: `exec-12916063-e545-4e00-97f2-78c4518209c5`.

```text
Editar solo colores del metal de esta medalla. Conservar forma hexagonal, cohete central, cinta, encuadre y material 3D suave de caramelo. PLATA FRÍA, metal blanco plateado gris azulado. Quitar TODO el dorado/amarillo del marco, canto, enganche, detalles y puntas: todo metal es plata. La cinta sigue lavanda, cohete blanco, interior azul. Debe identificarse como SEGUNDO lugar por el color plata, nunca oro. Fondo NEGRO PURO #000000 uniforme sin damero. Sin texto, números ni interfaz. 1024×1024.
```

## Medalla de bronce, primera propuesta

Generación: `exec-83cd874d-71ce-4cb0-abe9-d66e5e7225af`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 1024×1024. MEDALLA DE CARRERA: medalla hexagonal de caramelo y metal bronce, cantos gruesos redondeados dorados acordes al material, con cohete blanco estilizado en el centro y cinta corta lavanda arriba. Vista de frente, un solo objeto centrado. Sin letras ni números.
```

## Medalla de bronce, metal definitivo

Generación: `exec-3cfae58b-b7fe-43d4-a2c7-356e8e599916`.

```text
Editar solo colores del metal de esta medalla. Conservar forma hexagonal, cohete central, cinta, encuadre y material 3D suave de caramelo. BRONCE OSCURO COBRIZO MARRÓN ANARANJADO, como una moneda de cobre. Quitar el dorado amarillo del marco, canto y detalles: todo metal color cobre oscuro. Cinta lavanda y cohete blanco. Debe identificarse como TERCER lugar por bronce, claramente más oscuro y rojizo que oro. Fondo NEGRO PURO #000000 uniforme sin damero. Sin texto, números ni interfaz. 1024×1024.
```

## Chispa turquesa

Generación: `exec-8f923124-2bbd-416a-b47a-fc1676ed1014`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 256×256. CHISPA DE ESTELA: una única partícula de luz suelta, gota alargada blanca con borde turquesa, con volumen y brillo, sin fondo ni otras partículas. Centrada, grande en el cuadro.
```

## Chispa dorada

Generación: `exec-dbdc741e-10da-44d8-aae3-f0c946aaf8c0`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 256×256. CHISPA DE ESTELA: una única partícula de luz suelta, rombo dorado, con volumen y brillo, sin fondo ni otras partículas. Centrada, grande en el cuadro.
```

## Chispa rosa

Generación: `exec-40c1bd48-d018-4be0-aa31-eab782971c57`.

```text
Las tres referencias son de TYPELY: noche y las islas, estación de piedra lavanda y cristales, paleta espacial. Crear una pieza NUEVA del mismo cuento infantil. 3D suave de caramelo, luz cálida, colores saturados limpios, formas redondeadas. PNG con TRANSPARENCIA REAL; si no podés entregar alpha usar fondo NEGRO PURO #000000, sin gradiente ni damero, para quitarlo con sharp autorizado. Sin texto, interfaz, marco ni sombra exterior. 256×256. CHISPA DE ESTELA: una única partícula de luz suelta, estrellita de cuatro puntas rosa, con volumen y brillo, sin fondo ni otras partículas. Centrada, grande en el cuadro.
```

## Recta frontal sin deformación (08/09/2026)

La imagen lateral deformada y la segunda copia que parecía una escalera
se retiraron de la pantalla. La nueva fuente es `recta-frontal-source.png`
(1536×1024), generación `exec-ba13e810-7fd2-4ac6-bd76-53c4e7a6c08e`.
`recta-frontal-guia.png` fija la geometría y `recta-frontal-estilo.png`
conserva la referencia de materiales, generación
`exec-895985e7-770a-439c-97de-a887a396c60a`.

Prompt final, con guía como imagen 1 y referencia de estilo como imagen 2:

> La IMAGEN 1 es la geometría OBLIGATORIA, la IMAGEN 2 es SOLO la referencia de materiales y detalles. Renderizá la imagen 1 como una pista de cristal del estilo de la imagen 2. Conservá EXACTAMENTE la silueta y las seis líneas divisorias de la imagen 1: su extremo lejano mide apenas 72 píxeles entre x732 y x804 en y410 del lienzo 1536x1024. Son CINCO carriles, todos llegan a ese pequeño extremo. Suelo índigo y violeta, finas líneas luminosas turquesa y lavanda, pequeños paneles de cristal y pequeñas marcas luminosas, nítidos y proporcionados, sin manchas ni estrellas grandes ni textura estirada. No copies la anchura lejana de la imagen 2: es demasiado grande. Debés RESPETAR la silueta de la PRIMERA imagen sin ensancharla, sin estrecharla y sin cambiar la cámara. NEGRO PURO #000000 en todo el exterior del polígono, incluyendo toda la parte de arriba. Sin ninguna plataforma adicional, sin escalón, sin base saliente, sin arco ni naves, sin texto. Queremos pintar materiales sobre la guía precisa, no rediseñar su geometría.

El importador conserva el lienzo, quita el mate negro con sharp (autorizado)
y exporta `recta-frontal.webp`: 99 KB, alpha medio 0,000 en el 35 % superior.
En pantalla solo hay escala uniforme y traslación. Las coordenadas de los
corredores se calculan sobre los carriles pintados; no hay homografía ni
otra imagen debajo del arco. Los originales anteriores quedan conservados.

## Pórtico ancho apoyado en la pista (08/09/2026)

Generado con la herramienta integrada de imágenes, tomando `meta-source.png`
como referencia. La propuesta `exec-fb53d329-22f3-4724-85d2-2918b919e60a`
requería retirar un damero dibujado. La corrección final es
`exec-a41631e9-73f1-41ae-b42a-be449a08ad0c`, conservada en
`meta-ancha-source.png`, sin modificar las fuentes anteriores.

Prompt de arquitectura:

> Create a replacement finish arch game sprite based on the referenced TYPELY crystal arch. Keep exactly the charming polished illustrated 3D material style, lilac stone, small mint/aqua crystals, subtle gold trims and a central crystal crown. Change architecture: a very wide, low bridge-like triumphal finish arch spanning five racing lanes, with slender support columns only at far left and far right. 1536x1024 landscape canvas, symmetrical straight frontal camera with slightly visible top surfaces of shallow flat column feet. Overall arch fills x 3% to 97%, y 12% to 88%. Column feet centers x 8% and 92%, their bottom contact edge at y 88%. The clear opening between columns must span x 15% to 85%, keeping the bottom seventy percent of its opening completely empty; gently curved thin arch beam across top, no bulky inward growth of columns. Broad opening, thin graceful piers. Small flat square feet, no stairs, no layered pedestal, no platform, no floor, no floating stones or grass clumps. Faint reflected cyan light at the feet for matching a luminous blue crystal racetrack. Transparent background and clear transparent opening, no sky, no checkerboard, no lettering, no watermark. This is a reusable sprite, not a scene. Do not just stretch the old arch: redraw its slim columns and broad curved beam in natural proportions.

Prompt final de extracción, con la propuesta anterior como referencia:

> Precise background extraction edit. Keep this wide TYPELY crystal arch's architecture, column and beam shape, colors and layout exactly unchanged. Replace all of the grey checkerboard and all whitish swirling wisps (including the large empty opening under the arch) with perfectly uniform pure black #000000 matte. No checkerboard or smoke anywhere. Preserve the colored arch only; retain its little cyan contact glows beneath the feet. Same landscape 1536x1024 composition, no text. Completely clean pure black outside the silhouette and under the arch.

El importador recupera alpha con sharp y conserva el lienzo 3:2:
`meta-ancha.webp`, 1536×1024, 151 KB, 76,8 % de píxeles vacíos.
Los pies se anclan al 89 % de la altura. La pista continúa detrás del
pórtico: bajo los apoyos mide 1,05 veces su ancho, con espacio central
para los cinco corredores. Se agregan sombras de contacto discretas,
sin plataformas, escalones ni deformaciones de las ilustraciones.

## Recta con banquinas y encuadre nativo (12/09/2026)

Fuente: `recta-banquinas-source.png`, generada con la herramienta integrada
de imágenes (`exec-6af0f63d-2bf3-4410-be09-5705a1c88fbf`). Se conserva
`recta-banquinas-guia.png` como contrato de geometría; la referencia de
materiales fue `recta-frontal-source.png`. Se solicitaron 3072×2048; la
salida nativa fue 1536×1024. Se usa sin ampliar: 1366 px de ancho en ambas
resoluciones pedidas y 1440 px en monitor. La mejora de nitidez viene del
encuadre nuevo y de evitar la ampliación anterior, no de inventar píxeles.

Prompt final:

> Crear el nuevo suelo de Carrera de cohetes TYPELY. La imagen 1 es una GUÍA GEOMÉTRICA ESTRICTA. La imagen 2 es SOLO referencia de los materiales de cristal, NO de la composición. Pintá materiales sobre la guía 1 sin desplazar NI UNA de sus seis líneas. Entregar en ALTA RESOLUCIÓN 3072x2048. Cinco andariveles de cristal azul, violeta, azul, violeta, azul. Las dos bandas exteriores grises de la guía son BANQUINAS peatonales de piedra lavanda oscura y cristal, al mismo nivel del suelo: NO son carriles. Conservar su anchura considerable a AMBOS lados, separadas de los cinco carriles por los bordes cian; estas banquinas sostendrán dos columnas de meta agregadas por el juego. Cinco carriles únicamente, dos banquinas claramente distintas. Líneas finas y muy nítidas, pequeños paneles facetados bien definidos, reflejos discretos. Material infantil 3D pulido, limpio, NO difuminado ni con profundidad de campo: toda la pista debe estar enfocada desde el extremo hasta abajo. Paneles chicos proporcionados, nunca manchas estiradas. La punta de la guía comienza exactamente al 12.7% de altura y todos los carriles deben ocupar MUCHO MÁS del lienzo que en la imagen 2. Conservar perspectiva de la guía, incluyendo los carriles que salen de los laterales abajo. Todo el exterior del suelo debe ser NEGRO PURO #000000 liso para recuperar transparencia. Sin escalones, plataforma adicional, arco, naves, personajes, texto ni estrellas. No agregar luces grandes ni guirnaldas a las banquinas, mantenerlas como piso de apoyo plano con juntas de baldosas.

`node scripts/import-orbita-art.mjs carrera` conserva el lienzo, recupera
alpha con sharp autorizado y exporta `recta-banquinas.webp`: 1536×1024,
182 KB, alpha medio 0,000 en el 10 % superior. Los cinco carriles comparten
anclajes con las naves. Ambos pies de `meta-ancha.webp` quedan fuera de
la calzada y dentro de las banquinas: el examen de Carrera verifica esos
límites y el espacio del casco de los rivales exteriores.

## Circuito de cristal y cerámica lunar (12/09/2026)

Rediseño pedido por Ezequiel, con libertad para el arte y las animaciones.
Fuente `recta-lunar-source.png`, herramienta integrada de imágenes,
generación `exec-bbf66bfe-52fc-4886-898f-fc475305de1d`.
Referencias: `recta-banquinas-guia.png` y `recta-banquinas-source.png`.

Prompt final:

> Rediseñar por completo los materiales de esta pista de TYPELY, ilustración 3D de videojuego infantil de alta calidad. IMAGEN 1 es guía GEOMÉTRICA OBLIGATORIA: conservar exactamente cinco carriles, las seis líneas, los dos hombros/banquinas y la silueta, punto lejano al 12.7% de altura. IMAGEN 2 es solamente la versión anterior: NO repetir su mosaico caótico de triángulos ni su violeta eléctrico excesivo. NUEVO ESTILO: circuito de cristal tallado y cerámica lunar, elegante y lúdico; cinco bandas azules y pervinca de cristal translúcido profundo y pulido, paneles grandes pero proporcionados, lisos con leves curvaturas en las esquinas, juntas transversales espaciadas muy finas, reflejos largos suaves controlados. Separadores de carriles como finos perfiles de cristal menta lechosa con filete nacarado, volumen y pequeño bisel real. Pequeñas flechas e incrustaciones de luz alineadas al centro de cada carril. Banquinas a ambos lados como superficies de piedra lavanda azulada oscura pulida con baldosas grandes sobrias y un delicado filete dorado en su borde exterior; lugar de apoyo plano para un arco que el juego añadirá. Borde exterior del puente ligeramente grueso y biselado, sin escalones. Iluminación cyan y perla, acentos violetas más suaves. Alta nitidez, nada de bokeh, toda la pista enfocada; sin líneas rayadas ruidosas, sin confeti, sin parches facetados. Calidad Pixar juguete de cristal, no vector, no diseño Tron. Conservar rigurosamente la geometría y ancho de la primera guía y dejar las banquinas completamente transitables y vacías. NEGRO PURO #000000 fuera de la silueta para recuperar alpha, sin cielo, sin arco, sin naves, sin carteles ni texto. 3072×2048 solicitado; no agrandar una imagen pequeña, generar detalle nuevo.

La salida nativa es 1536×1024. `recta-lunar.webp` conserva esa resolución
(182 KB), con alpha recuperado por sharp autorizado: 26,5 % vacío y
alpha medio 0,000 en el 10 % superior. No se agranda ni se deforma.
Se midieron los separadores de esta salida para ajustar `pistaCarrera.ts`:
ancho aproximado 230 px en y=180; los pies del arco quedan en las banquinas.
El original, la guía y las versiones anteriores permanecen intactos.

Las naves reutilizan las vistas dibujadas del hangar: derecha para los
dos andariveles izquierdos, izquierda para los dos derechos y neutra
para el alumno. El casco tiene una inclinación leve hacia el suelo.
Los modelos prestados a rivales sin nave especial solo afectan esta vista;
se conserva la nave equipada de cada rival y del fantasma propio.
