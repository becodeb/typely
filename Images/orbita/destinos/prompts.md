# Ilustraciones del carrusel de minijuegos

El 07/09/2026 Ezequiel pidió reemplazar las galaxias por objetos simples que representen cada juego y autorizó elegir, generar e integrar las imágenes sin otra aprobación individual. El hito de revisión del lobby antes de Carrera se conserva.

Generadas con imagegen integrado. Referencias de estilo: `public/assets/orbita/naves/orbita-01/neutra.webp` y `public/assets/orbita/hub/estacion.webp`. Los prompts siguientes se recuperaron del registro de cada generación, sin transcribirlos de memoria.

Los cinco resultados elegidos se conservan como `*-source.png` en esta carpeta. Tormenta ya tenía alpha; para los otros objetos se retiró el mate negro con sharp, según la autorización previa. Huevo, cristal y cofre requirieron una edición de fondo antes de importar.

Importación reproducible: `node scripts/import-orbita-art.mjs destinos`. Produce WebP con alpha y encuadre cuadrado, tope 768 px, sin agrandar las fuentes.

## Tormenta

Generación: `exec-8ebad02c-89eb-40ba-bf22-c9d8c43c7f6e`.

```text
Use case: stylized-concept. Pieza recortada para el menú de minijuegos de TYPELY, para chicos de primaria. Las referencias muestran SOLO el estilo: nave blanca perlada con cristal turquesa, filos dorados y volumen de juguete; estación de piedra lavanda y caramelo. Crear un objeto NUEVO de la misma familia, mucho más simple que la estación, silueta clara que se reconozca a 160 px. Render 3D suave de juguete coleccionable, redondeado, luz cálida arriba a la izquierda, sombras propias suaves, materiales de porcelana y caramelo, pocos detalles grandes. Vista de tres cuartos apenas desde arriba. Objeto compacto centrado, ocupando 82% de una imagen cuadrada 1024×1024. Pedir TRANSPARENCIA REAL. Si no podés entregar canal alpha, el fondo debe ser NEGRO PURO #000000, liso, sin damero ni gradiente: se quitará con el proceso de sharp ya autorizado. Sin suelo, pedestal, marcos, tarjetas, cielo, galaxias, anillos cósmicos, humo o partículas sueltas. No interfaz ni logos. PIEZA TORMENTA DE PALABRAS: una nube pequeña y mullida de caramelo lavanda, con tres palabras cayendo debajo como gotas de lluvia de luz. Las palabras son objetos de letras gruesas y redondeadas, tridimensionales, muy legibles, de color blanco perlado con bordes turquesa y dorado. Exactamente tres palabras en minúsculas, horizontales, separadas, escalonadas bajo la nube: «sol», «luna», «mar». Deletreo obligatorio: s-o-l; l-u-n-a; m-a-r. No teclas, no teclado, no pantallas, no signos de interrogación. Una nubecita y tres palabras, nada más. Composición alegre y compacta, no nebulosa espacial difusa. La nube tiene cuerpo sólido, sin cara.
```

## Carrera

Generación: `exec-e42c4602-7b45-42e5-8544-1eff4ccd8b55`.

```text
Use case: stylized-concept. Pieza recortada para el menú de minijuegos de TYPELY, para chicos de primaria. Las referencias muestran SOLO el estilo: nave blanca perlada con cristal turquesa, filos dorados y volumen de juguete; estación de piedra lavanda y caramelo. Crear un objeto NUEVO de la misma familia, mucho más simple que la estación, silueta clara que se reconozca a 160 px. Render 3D suave de juguete coleccionable, redondeado, luz cálida arriba a la izquierda, sombras propias suaves, materiales de porcelana y caramelo, pocos detalles grandes. Vista de tres cuartos apenas desde arriba. Objeto compacto centrado, ocupando 82% de una imagen cuadrada 1024×1024. Pedir TRANSPARENCIA REAL. Si no podés entregar canal alpha, el fondo debe ser NEGRO PURO #000000, liso, sin damero ni gradiente: se quitará con el proceso de sharp ya autorizado. Sin suelo, pedestal, marcos, tarjetas, cielo, galaxias, anillos cósmicos, humo o partículas sueltas. No interfaz ni logos. PIEZA CARRERA DE COHETES: dos pequeños cohetes de juguete compiten, lado a lado, apuntando en diagonal hacia arriba y a la derecha; uno está apenas adelante del otro. Un cohete blanco perlado con alas turquesa y filo dorado; su rival lavanda con alas rosa coral y filo dorado. Formas muy simples y redondeadas, una ventanita de cristal celeste cada uno, cortas llamas de motor turquesa. Detrás y a la derecha, una bandera de llegada pequeña de cuadros blanco perlado y violeta oscuro en un palito dorado corto. Los cohetes y la bandera forman una única composición compacta. No pista, no planeta, no plataforma, no aro, no galaxia. Sin letras ni números.
```

## Huevo, generación inicial

Generación: `exec-cb352569-e8a0-476b-b6c7-3651e852608a`.

```text
undefined PIEZA MISTERIOSA PRÓXIMAMENTE: un único huevo cerrado de porcelana lavanda pálida, gordito y pequeño, con una junta ecuatorial fina de oro mate y una diminuta estrella turquesa incrustada. Sin grietas ni criaturas, sin cara, sin texto, sin signo de pregunta. Solo el huevo flotando. Paleta desaturada y tranquila, tiene que acompañar a otros juegos sin competir con ellos. Forma orgánica y simple, no realista.
```

## Cristal, generación inicial

Generación: `exec-8703608e-467e-4e1e-844e-34e58771c44f`.

```text
undefined PIEZA MISTERIOSA PRÓXIMAMENTE: un único cristal de hielo grande, vertical, gordito, facetado con esquinas suavemente redondeadas, color celeste muy pálido y lavanda. Dentro del cristal hay una pequeña estrella perlada, como un secreto congelado. Solo el cristal, sin peana, sin piedras pequeñas alrededor, sin cara ni texto ni signo de pregunta. Paleta desaturada y tranquila. Material semitranslúcido pero con cuerpo bien definido.
```

## Cofre, generación inicial

Generación: `exec-b6f4dc82-da63-443a-88dd-88ed0330d689`.

```text
undefined PIEZA MISTERIOSA PRÓXIMAMENTE: un único cofrecito de juguete cerrado, cuerpo de porcelana lavanda grisácea, tapa abovedada, dos bandas simples de oro mate y cierre turquesa pequeño sin cerradura. Una pequeña estrella grabada en la tapa. Es compacto, gordito, redondeado, de tres cuartos, flotando solo. Sin monedas, tesoros, destellos, pedestal, cara, letras ni signos de pregunta. Paleta desaturada y tranquila.
```

## Huevo, corrección del fondo

Generación: `exec-c6be56dc-c904-44d0-b07c-815e6442ba02`.

```text
Edición de un asset de juego. Conservar exactamente el objeto de la referencia, su forma, encuadre y color. REEMPLAZAR TODO EL FONDO por NEGRO PURO #000000 sólido y uniforme, incluyendo la zona debajo del objeto: SIN suelo, SIN sombra proyectada, SIN degradado gris y SIN niebla. La silueta completa del objeto debe quedar aislada, rodeada de negro puro por los cuatro lados, con un margen pequeño de aire. El objeto conserva su iluminación y sus sombras internas. Salida cuadrada 1024×1024; si la referencia es vertical, alejar el encuadre para que el objeto entero entre en el cuadrado. El negro se quitará después con sharp; por eso es esencial que sea RGB 0,0,0 en todo el exterior, sin luces de ambiente sobre el fondo.
```

## Cristal, corrección del fondo

Generación: `exec-c2d6f93b-2227-4a00-8cae-c3ca6c92688d`.

```text
Edición de un asset de juego. Conservar exactamente el objeto de la referencia, su forma, encuadre y color. REEMPLAZAR TODO EL FONDO por NEGRO PURO #000000 sólido y uniforme, incluyendo la zona debajo del objeto: SIN suelo, SIN sombra proyectada, SIN degradado gris y SIN niebla. La silueta completa del objeto debe quedar aislada, rodeada de negro puro por los cuatro lados, con un margen pequeño de aire. El objeto conserva su iluminación y sus sombras internas. Salida cuadrada 1024×1024; si la referencia es vertical, alejar el encuadre para que el objeto entero entre en el cuadrado. El negro se quitará después con sharp; por eso es esencial que sea RGB 0,0,0 en todo el exterior, sin luces de ambiente sobre el fondo.
```

## Cofre, corrección del fondo

Generación: `exec-5dede4aa-ae14-49df-8eb2-199b63cbde63`.

```text
Edición de un asset de juego. Conservar exactamente el objeto de la referencia, su forma, encuadre y color. REEMPLAZAR TODO EL FONDO por NEGRO PURO #000000 sólido y uniforme, incluyendo la zona debajo del objeto: SIN suelo, SIN sombra proyectada, SIN degradado gris y SIN niebla. La silueta completa del objeto debe quedar aislada, rodeada de negro puro por los cuatro lados, con un margen pequeño de aire. El objeto conserva su iluminación y sus sombras internas. Salida cuadrada 1024×1024; si la referencia es vertical, alejar el encuadre para que el objeto entero entre en el cuadrado. El negro se quitará después con sharp; por eso es esencial que sea RGB 0,0,0 en todo el exterior, sin luces de ambiente sobre el fondo.
```
