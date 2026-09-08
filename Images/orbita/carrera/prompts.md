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
