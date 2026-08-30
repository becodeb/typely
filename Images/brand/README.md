# Portadas y material de marca

Arte de **presentación**: portadas, posts, publicaciones. **Nada de acá lo usa
el juego** — por eso vive en `Images/`, que `.dockerignore` deja afuera del
contenedor. Si alguna vez una de estas imágenes tiene que aparecer dentro de la
app, hay que copiarla a `public/assets/` y optimizarla; no se sirve desde acá.

| Archivo | Tamaño | Relación | Para qué |
|---|---|---|---|
| `portada-panoramica.png` | 1979×795 | 2.49:1 | Encabezados anchos: banner de repo, cabecera de una landing, portada de LinkedIn |
| `portada-horizontal.png` | 1672×941 | 16:9 | Lo horizontal en general: slide de presentación, miniatura de video, post apaisado |
| `portada-vertical.png` | 941×1672 | 9:16 | Historias y reels, feed vertical, cartel |

Las tres son la misma escena contada en tres encuadres: las islas de los
mundos flotando entre nubes pastel, los dos robots parados en la isla de
adelante y el logotipo arriba. Se generaron juntas y comparten paleta,
personajes y logo, así que se pueden usar mezcladas en una misma campaña sin
que desentonen.

## El logotipo viene dibujado en la imagen

Las tres traen **TYPELY** ya escrito, como logo 3D de caramelo. Eso es
deliberado y salió bien, pero tiene dos consecuencias:

- **No le encimes el wordmark en Baloo 2.** Quedarían dos títulos. La
  tipografía de marca (§5 de `CLAUDE.md`) es para la app, no para estas piezas.
- **Si hay que cambiar el logo, se regeneran.** No es texto editable: está
  pintado. Los prompts con los que salieron están en el historial de esta
  conversación; si se rehacen, que sea con las tres juntas para que sigan
  siendo la misma familia.

## Si hacen falta más encuadres

Pasá como referencia **estas tres** más los dos personajes
(`public/assets/edutic-art/mascot-women-wave.webp` y `mascot-proud.webp`) para
que el estilo y los robots no se corran.

Ojo con el generador: ChatGPT sólo da 1024×1024, 1536×1024 y 1024×1536. Nada
más ancho que 3:2 sale directo — la panorámica de acá salió 2.49:1 pidiéndole
que dejara la acción en una banda central y recortando después.

## Los originales no se tocan

Son los máster en PNG, sin comprimir. Para publicar, cada plataforma
recomprime por su cuenta; si hace falta una versión liviana para un lugar
puntual (un correo, un CMS que limite el peso), se genera una copia y **se deja
el PNG como está**.
