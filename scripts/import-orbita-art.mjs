/* =====================================================================
   IMPORTAR EL ARTE DEL MODO ÓRBITA — fondo espacial + orbes de cristal
   ---------------------------------------------------------------------
   Toma las fuentes generadas y produce los WebP que carga el juego.

     Images/orbita/fondo/estrellas-source.png    ->  fondo/estrellas.webp
     Images/orbita/fondo/nebulosa-source.png     ->  fondo/nebulosa.webp
     Images/orbita/fondo/polvo-source.png        ->  fondo/polvo.webp
     Images/orbita/orbes/cristal-source.png      ->  orbes/cristal.webp
     Images/orbita/orbes/brillo-source.png       ->  orbes/brillo.webp
     Images/orbita/orbes/mundo-<modo>-source.png ->  orbes/mundo-<modo>.webp
     Images/orbita/fondo/horizonte-source.png    ->  fondo/horizonte.webp
     Images/orbita/hub/estacion-source.png       ->  hub/estacion.webp
     Images/orbita/insignias/<rango>-source.png  ->  insignias/<rango>.webp
     Images/orbita/gemas/<poder>-source.png      ->  gemas/<poder>.webp

   todo bajo public/assets/orbita/.

   Uso:
     node scripts/import-orbita-art.mjs           todo lo que tenga fuente
     node scripts/import-orbita-art.mjs fondo     solo las capas del fondo
     node scripts/import-orbita-art.mjs orbes     solo los orbes
     node scripts/import-orbita-art.mjs hub insignias gemas   (se combinan)

   Las piezas del rediseño (horizonte, estación, insignias, gemas) traen
   sus propias medidas, y son las que un ojo no ve hasta que es tarde:
     · el horizonte tiene que ser TRANSPARENTE en el 62 % de arriba, porque
       por ahí pasan las palabras, y de tono medio-oscuro en la franja de
       abajo, porque por ahí también pasan al final;
     · la estación, las insignias y las gemas vienen sobre transparencia y
       se les recorta el margen vacío, así el tamaño en pantalla depende del
       objeto y no del aire que dejó el generador. Las insignias y las gemas
       se encuadran además en un cuadrado, para que las seis (u ocho) se
       vean del mismo tamaño en fila.

   Qué hace por vos:

   - RECORTA EN CÍRCULO los mundos de los orbes, con el borde apenas
     difuminado. Así el archivo que llega al juego ya es el disco que se
     ve adentro de la burbuja, y no hace falta que la página lo enmascare
     ni que el artista adivine dónde cae el corte.
   - MIDE lo que no se puede ver hasta que es tarde, y se niega:
       · que las capas con alpha traigan alpha de verdad — una capa opaca
         tapa todo lo que tiene debajo y eso se descubre recién en pantalla;
       · que el campo estelar sea OSCURO — sobre un cielo claro las palabras
         del juego no se leen, que es el mismo error que un pedestal pálido;
       · que el CENTRO de las tres capas del fondo esté tranquilo — por ahí
         pasan las palabras en movimiento;
       · que el centro del cristal y del brillo esté TRANSPARENTE — si no lo
         está tapa el mundo de adentro, y entonces cada modo necesita su
         propio cristal en vez de compartir uno.
   - No agranda nada, igual que import-island-art.mjs: estirar un PNG no
     inventa detalle.

   Los iconos NO pasan por acá: son SVG a mano y se inlinean en el bundle.
   Ver Images/orbita/ORBITA.md §5.
===================================================================== */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const FUENTES = path.join(RAIZ, "Images", "orbita");
const DESTINO = path.join(RAIZ, "public", "assets", "orbita");

const CALIDAD = 88;

/* ------------------------------------------------------------------ */
/* Qué se importa y qué tiene que cumplir cada pieza                   */
/* ------------------------------------------------------------------ */

/** `centroLimpio` es el promedio de alpha permitido en el recuadro central:
 *  el cristal tiene que dejar ver el mundo, y la nebulosa tiene que dejar
 *  leer las palabras. `brilloMax` sólo aplica a la capa base, que es la
 *  única sin transparencia.
 *
 *  `centroFraccion` es de qué tamaño es ese recuadro, y no es el mismo para
 *  todos a propósito. En las capas del fondo lo que importa es la franja
 *  donde el juego dibuja texto, que es angosta (55 %). En los orbes importa
 *  todo lo que tape el mundo de adentro, que es casi el disco entero (70 %).
 *  Medir las dos cosas con el mismo recuadro rechazaba nebulosas correctas
 *  por el degradado del borde. */
const PIEZAS = [
  { grupo: "fondo", base: "estrellas", tope: 2560, alfa: false, brilloMax: 0.20, contrasteMax: 0.13 },
  { grupo: "fondo", base: "nebulosa",  tope: 2560, alfa: true,  centroLimpio: 0.20, centroFraccion: 0.55 },
  { grupo: "fondo", base: "polvo",     tope: 2560, alfa: true,  centroLimpio: 0.12, centroFraccion: 0.55 },

  { grupo: "orbes", base: "cristal",   tope: 1024, alfa: true, cuadrada: true, centroLimpio: 0.14, centroFraccion: 0.70 },
  { grupo: "orbes", base: "brillo",    tope: 1024, alfa: true, cuadrada: true, centroLimpio: 0.22, centroFraccion: 0.70 },

  /* El horizonte vive SOLO en la franja de abajo (ORBITA.md §7.1), y lo que
     de verdad hay que proteger es la ZONA DE VUELO: el pasillo por el que
     las palabras van del punto de fuga a la nave. */
  {
    grupo: "fondo", base: "horizonte", tope: 2560, alfa: true,
    arribaLimpio: 0.03, arribaFraccion: 0.62, franjaBrilloMax: 0.35,
    vueloBrilloMax: 0.08, vueloContrasteMax: 0.09,
  },
  /* La estación del hub: la isla sola sobre transparencia, sin encuadrar
     (es 3:2 y la página la apoya por CSS). */
  { grupo: "hub", base: "estacion", tope: 1536, alfa: true, recortar: true },
];

/** Insignias y gemas son listas ABIERTAS como los mundos: cualquier
 *  `<nombre>-source.png` en su carpeta entra. Se recortan y se encuadran
 *  en un cuadrado con margen parejo, así la fila del ranking o del hangar
 *  muestra objetos del mismo tamaño aunque el generador haya dejado
 *  distinto aire en cada uno. */
/* Los nombres válidos de cada lista abierta. NO es burocracia: el juego
 * pide `gemas/<PowerupId>.webp` y `insignias/<RangoId>.webp`, así que un
 * nombre mal escrito no rompe nada — simplemente esa gema no aparece
 * NUNCA y el componente cae al SVG en silencio. Es el peor tipo de error:
 * el que se descubre en el aula. Pasó con `reparacio-source.png`. */
const NOMBRES = {
  insignias: ["cadete", "piloto", "explorador", "as", "capitan", "leyenda"],
  gemas: [
    "cristal", "reparacion", "escudo", "pulso", "lento", "rayo", "cosecha", "mira",
    /* Las mejoras permanentes (ORBITA.md §7.6). */
    "bala", "regeneracion", "critico", "congelar", "iman", "racha", "teclas", "segunda",
  ],
};

function abiertas(grupo) {
  const dir = path.join(FUENTES, grupo);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((f) => /^([a-z0-9-]+)-source\.(png|jpg|jpeg|webp)$/i.exec(f))
    .filter(Boolean)
    .map((m) => ({
      grupo,
      base: m[1],
      tope: 1024,
      alfa: true,
      recortar: true,
      encuadrar: true,
      nombreValido: NOMBRES[grupo],
    }));
}

/* Realce de textura por pieza — un problema de REPRODUCCIÓN, no de dibujo.
 *
 * `mundo-dormido` es vidrio empañado con escarcha de helechos: preciosa a
 * 1254px e invisible a los 300px a los que se muestra el orbe. La textura
 * fina no sobrevive la reducción, y sin ella el orbe pasa de decir "todavía
 * no" a decir "vacío" — que es justo la distinción que tiene que sostener.
 *
 * Se corrige acá y no regenerando, por dos motivos: el dibujo está bien (el
 * defecto aparece sólo al achicar), y así la fuente generada queda intacta.
 * Es el mismo criterio por el que import-island-art recorta el margen y
 * import-gameplay-bg centra el corte: arreglos de reproducción, no de arte.
 *
 * `linear(a, b)` sube el contraste sin tocar el promedio: la escarcha
 * reaparece y el orbe sigue siendo el más callado de los tres. */
const REALCE = {
  "mundo-dormido": { linear: [1.55, -58], saturacion: 0.85, nitidez: { sigma: 2.5, m1: 0, m2: 2.2 } },
};

/* Atenuación por pieza — el otro arreglo de REPRODUCCIÓN, y el inverso del
 * realce. Un generador de imágenes dibuja para que la imagen se vea linda
 * SOLA, y devuelve un mediodía saturado; acá esa capa es el suelo sobre el
 * que hay que leer texto blanco en movimiento. Bajarle la exposición no
 * cambia el dibujo, cambia la hora del día, y es lo que la vuelve fondo.
 *
 * Se aplica ANTES de medir, no después: lo que el importador tiene que
 * aprobar es lo que va a ver el chico, no la fuente. Si con la atenuación
 * puesta el brillo sigue arriba del tope, la imagen está mal de verdad y
 * hay que regenerarla — el error sigue siendo un error. */
const ATENUAR = {
  horizonte: { brillo: 0.62, saturacion: 0.82 },
};

/** Los mundos son abiertos: cualquier `mundo-<modo>-source.png` entra, así
 *  sumar un modo futuro no obliga a tocar este archivo. */
function mundosPresentes() {
  const dir = path.join(FUENTES, "orbes");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((f) => /^(mundo-[a-z0-9-]+)-source\.(png|jpg|jpeg|webp)$/i.exec(f))
    .filter(Boolean)
    .map((m) => ({
      grupo: "orbes", base: m[1], tope: 1024, cuadrada: true, circular: true,
      realce: REALCE[m[1]],
    }));
}

/* ------------------------------------------------------------------ */
/* Mediciones                                                          */
/* ------------------------------------------------------------------ */

/** Píxeles crudos RGBA más las dimensiones. */
async function pixeles(archivo) {
  return sharp(archivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** ¿El canal alfa dice algo, o es opaco de punta a punta? Un PNG "con
 *  transparencia" que salió opaco es el error más caro de esta tanda. */
function tieneAlfaReal({ data, info }) {
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] < 250) return true;
  }
  return false;
}

/** Luminancia media de toda la imagen, 0-1. Ignora lo transparente. */
function brilloMedio({ data, info }) {
  let suma = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 8) continue;
    suma += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n++;
  }
  return n ? suma / n : 0;
}

/** Recuadro central, como fracción del lado. 0.6 = el 60% del medio. */
function recuadro(info, fraccion) {
  const mx = Math.round((info.width * (1 - fraccion)) / 2);
  const my = Math.round((info.height * (1 - fraccion)) / 2);
  return { x0: mx, y0: my, x1: info.width - mx, y1: info.height - my };
}

/** Desvío estándar de luminancia en el centro: cuán "movido" está el fondo
 *  justo donde el juego dibuja texto en movimiento. */
function contrasteCentral({ data, info }) {
  const c = recuadro(info, 0.6);
  const vals = [];
  for (let y = c.y0; y < c.y1; y += 3) {
    for (let x = c.x0; x < c.x1; x += 3) {
      const i = (y * info.width + x) * info.channels;
      if (data[i + 3] < 8) { vals.push(0); continue; }
      vals.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
    }
  }
  if (!vals.length) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length);
}

/** Opacidad media del centro, 0-1. Es lo que decide si el cristal deja ver
 *  el mundo que tiene detrás. */
function opacidadCentral({ data, info }, fraccion = 0.7) {
  const c = recuadro(info, fraccion);
  let suma = 0;
  let n = 0;
  for (let y = c.y0; y < c.y1; y += 3) {
    for (let x = c.x0; x < c.x1; x += 3) {
      suma += data[(y * info.width + x) * info.channels + 3] / 255;
      n++;
    }
  }
  return n ? suma / n : 0;
}

/** Opacidad media de la franja SUPERIOR (las primeras `fraccion` filas):
 *  el horizonte tiene que dejar ese aire vacío para las palabras. */
function opacidadArriba({ data, info }, fraccion) {
  const hasta = Math.round(info.height * fraccion);
  let suma = 0;
  let n = 0;
  for (let y = 0; y < hasta; y += 3) {
    for (let x = 0; x < info.width; x += 3) {
      suma += data[(y * info.width + x) * info.channels + 3] / 255;
      n++;
    }
  }
  return n ? suma / n : 0;
}

/** La ZONA DE VUELO: el pasillo por el que las palabras van del punto de
 *  fuga (50 %, 24 %) a la nave (50 %, 78 %), medido sobre el 60 % central
 *  del ancho. Devuelve el brillo medio y el contraste, los dos pesados por
 *  alfa — lo transparente no molesta a nadie.
 *
 *  Por qué existe. Una capa puede tener un brillo PROMEDIO bajísimo y aun
 *  así arruinar el juego, si toda su luz está concentrada justo donde vuela
 *  el texto. Pasó: una versión del horizonte que llenaba el cuadro midió
 *  0.260 de brillo general —aprobada— y 0.231 con 0.123 de contraste en la
 *  zona de vuelo, contra 0.012 y 0.067 de la versión buena. Diez veces más
 *  luz exactamente donde hay que leer. El promedio no lo veía; esto sí. */
function zonaDeVuelo({ data, info }) {
  const x0 = Math.round(info.width * 0.2);
  const x1 = Math.round(info.width * 0.8);
  const y0 = Math.round(info.height * 0.24);
  const y1 = Math.round(info.height * 0.78);
  const vals = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * info.width + x) * info.channels;
      const a = data[i + 3] / 255;
      vals.push(a * ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255));
    }
  }
  if (!vals.length) return { brillo: 0, contraste: 0 };
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length);
  return { brillo: m, contraste: sd };
}

/** Luminancia media de lo DIBUJADO en la franja inferior (desde la fila
 *  `desde`), pesada por su alfa: por ahí pasan las palabras al final del
 *  viaje y necesitan un fondo de tono medio-oscuro. */
function brilloFranjaInferior({ data, info }, desde) {
  const y0 = Math.round(info.height * desde);
  let suma = 0;
  let peso = 0;
  for (let y = y0; y < info.height; y += 3) {
    for (let x = 0; x < info.width; x += 3) {
      const i = (y * info.width + x) * info.channels;
      const a = data[i + 3] / 255;
      if (a < 0.03) continue;
      suma += a * ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
      peso += a;
    }
  }
  return peso ? suma / peso : 0;
}

/* ------------------------------------------------------------------ */

function fuenteDe(grupo, base) {
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    const p = path.join(FUENTES, grupo, `${base}-source.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Máscara circular con el borde apenas suavizado, del tamaño pedido. */
function mascaraCircular(lado) {
  const r = lado / 2;
  return Buffer.from(
    `<svg width="${lado}" height="${lado}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="#fff"/></svg>`,
  );
}

async function importar(pieza) {
  const origen = fuenteDe(pieza.grupo, pieza.base);
  if (!origen) return null;

  const notas = [];
  let error = false;

  /* La atenuación va primero: se mide lo que se va a servir. */
  const atenuar = ATENUAR[pieza.base];
  let fuente = origen;
  if (atenuar) {
    fuente = await sharp(origen)
      .ensureAlpha()
      .modulate({ brightness: atenuar.brillo, saturation: atenuar.saturacion })
      .png()
      .toBuffer();
    notas.push(
      `atenuada al importar: brillo ×${atenuar.brillo}, saturación ×${atenuar.saturacion} (ver ATENUAR arriba)`,
    );
  }

  const px = await pixeles(fuente);
  const { width: w, height: h } = px.info;
  notas.push(`fuente ${path.basename(origen)} · ${w}x${h}`);

  if (pieza.nombreValido && !pieza.nombreValido.includes(pieza.base)) {
    notas.push(
      `ERROR: "${pieza.base}" no es un nombre que el juego busque. Los de ${pieza.grupo} son: ${pieza.nombreValido.join(", ")}. Con otro nombre la imagen no aparece nunca y se usa el SVG de respaldo, sin avisar.`,
    );
    error = true;
  }

  if (pieza.cuadrada && Math.abs(w - h) > 2) {
    notas.push(`ERROR: tiene que ser cuadrada y vino ${w}x${h}. Se recorta en círculo.`);
    error = true;
  }

  if (pieza.alfa === true && !tieneAlfaReal(px)) {
    notas.push("ERROR: no trae transparencia real. Opaca, tapa todo lo que tiene debajo.");
    error = true;
  }
  if (pieza.alfa === false && tieneAlfaReal(px)) {
    notas.push("aviso: es la capa base y trae alpha; se aplana sobre negro.");
  }

  if (pieza.brilloMax != null) {
    const b = brilloMedio(px);
    const marca = b > pieza.brilloMax ? "ERROR" : "ok";
    notas.push(`${marca}: brillo medio ${b.toFixed(3)} (tope ${pieza.brilloMax}) — sobre un cielo claro no se leen las palabras`);
    if (b > pieza.brilloMax) error = true;
  }

  if (pieza.contrasteMax != null) {
    const c = contrasteCentral(px);
    const marca = c > pieza.contrasteMax ? "ERROR" : "ok";
    notas.push(`${marca}: contraste del centro ${c.toFixed(3)} (tope ${pieza.contrasteMax}) — ahí pasan las palabras`);
    if (c > pieza.contrasteMax) error = true;
  }

  if (pieza.centroLimpio != null) {
    const o = opacidadCentral(px, pieza.centroFraccion);
    const marca = o > pieza.centroLimpio ? "ERROR" : "ok";
    const porque =
      pieza.grupo === "orbes"
        ? "si no está transparente tapa el mundo y cada modo necesita su propio cristal"
        : "el centro tiene que quedar limpio para que se lean las palabras";
    notas.push(`${marca}: opacidad del centro ${o.toFixed(3)} (tope ${pieza.centroLimpio}) — ${porque}`);
    if (o > pieza.centroLimpio) error = true;
  }

  if (pieza.arribaLimpio != null) {
    const o = opacidadArriba(px, pieza.arribaFraccion);
    const marca = o > pieza.arribaLimpio ? "ERROR" : "ok";
    notas.push(
      `${marca}: opacidad del ${Math.round(pieza.arribaFraccion * 100)} % superior ${o.toFixed(3)} (tope ${pieza.arribaLimpio}) — ahí pasan las palabras y el cielo lo ponen otras capas`,
    );
    if (o > pieza.arribaLimpio) error = true;
  }

  if (pieza.vueloBrilloMax != null) {
    const v = zonaDeVuelo(px);
    const malBrillo = v.brillo > pieza.vueloBrilloMax;
    const malContraste = v.contraste > pieza.vueloContrasteMax;
    const marca = malBrillo || malContraste ? "ERROR" : "ok";
    notas.push(
      `${marca}: zona de vuelo — brillo ${v.brillo.toFixed(3)} (tope ${pieza.vueloBrilloMax}) y contraste ${v.contraste.toFixed(3)} (tope ${pieza.vueloContrasteMax}) — es el pasillo por el que van las palabras: tiene que estar VACÍO`,
    );
    if (malBrillo || malContraste) error = true;
  }

  if (pieza.franjaBrilloMax != null) {
    const b = brilloFranjaInferior(px, pieza.arribaFraccion ?? 0.62);
    const marca = b > pieza.franjaBrilloMax ? "ERROR" : "ok";
    notas.push(
      `${marca}: brillo de la franja de abajo ${b.toFixed(3)} (tope ${pieza.franjaBrilloMax}) — las palabras cruzan esa franja al final del viaje`,
    );
    if (b > pieza.franjaBrilloMax) error = true;
  }

  if (error) {
    notas.push("NO se escribió nada. Corregí la fuente y volvé a correr.");
    return { notas, error };
  }

  /* Recorte del margen transparente: el tamaño en pantalla lo decide el
     objeto, no el aire que dejó el generador (mismo criterio que
     import-island-art). Se hace en un paso aparte porque sharp aplica el
     trim ANTES de medir el tamaño para escalar. */
  let entrada = fuente;
  let ancho = w;
  let alto = h;
  if (pieza.recortar) {
    const buf = await sharp(fuente).ensureAlpha().trim({ threshold: 12 }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    entrada = buf;
    ancho = meta.width;
    alto = meta.height;
    notas.push(`margen transparente recortado -> ${ancho}x${alto}`);
  }

  /* Nunca agrandar: si la fuente es más chica que el tope, se deja. */
  const lado = Math.max(ancho, alto);
  const escala = Math.min(1, pieza.tope / lado);
  if (escala === 1 && lado < pieza.tope) notas.push(`no se agranda (${lado}px < tope ${pieza.tope}px)`);

  let img = sharp(entrada);
  let anchoFinal = Math.round(ancho * escala);
  let altoFinal = Math.round(alto * escala);
  if (pieza.encuadrar) {
    /* Cuadrado con margen parejo del 6 %: las insignias y las gemas se
       ven del mismo tamaño en fila. */
    const ladoFinal = Math.round(lado * escala);
    const interior = Math.round(ladoFinal * 0.88);
    img = sharp(entrada)
      .resize(interior, interior, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.floor((ladoFinal - interior) / 2),
        bottom: Math.ceil((ladoFinal - interior) / 2),
        left: Math.floor((ladoFinal - interior) / 2),
        right: Math.ceil((ladoFinal - interior) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    anchoFinal = ladoFinal;
    altoFinal = ladoFinal;
    notas.push("encuadrado en cuadrado con margen parejo");
  } else if (escala < 1) {
    img = img.resize(anchoFinal, altoFinal);
  }

  if (pieza.realce) {
    const r = pieza.realce;
    if (r.linear) img = img.linear(r.linear[0], r.linear[1]);
    if (r.saturacion != null) img = img.modulate({ saturation: r.saturacion });
    if (r.nitidez) img = img.sharpen(r.nitidez);
    notas.push("textura realzada al achicar (ver REALCE arriba)");
  }

  if (pieza.circular) {
    img = sharp(await img.ensureAlpha().png().toBuffer()).composite([
      { input: mascaraCircular(anchoFinal), blend: "dest-in" },
    ]);
    notas.push("recortado en círculo");
  } else if (pieza.alfa === false) {
    img = img.flatten({ background: { r: 0, g: 0, b: 0 } });
  }

  const salidaDir = path.join(DESTINO, pieza.grupo);
  fs.mkdirSync(salidaDir, { recursive: true });
  const salida = path.join(salidaDir, `${pieza.base}.webp`);
  await img.webp({ quality: CALIDAD, alphaQuality: 100 }).toFile(salida);

  const kb = (fs.statSync(salida).size / 1024).toFixed(0);
  notas.push(`-> assets/orbita/${pieza.grupo}/${pieza.base}.webp · ${anchoFinal}x${altoFinal} · ${kb} KB`);
  return { notas, error: false };
}

/* ------------------------------------------------------------------ */

const GRUPOS = ["fondo", "orbes", "hub", "insignias", "gemas"];
const filtro = process.argv.slice(2).filter((a) => GRUPOS.includes(a));
const todas = [...PIEZAS, ...mundosPresentes(), ...abiertas("insignias"), ...abiertas("gemas")];
const objetivo = filtro.length ? todas.filter((p) => filtro.includes(p.grupo)) : todas;

let hubo = false;
let fallo = false;
for (const pieza of objetivo) {
  const r = await importar(pieza);
  if (!r) continue;
  hubo = true;
  if (r.error) fallo = true;
  console.log("");
  console.log(`-- ${pieza.grupo}/${pieza.base} --`);
  for (const n of r.notas) console.log("  " + n);
}

console.log("");
if (!hubo) {
  console.log("Nada que importar. Las fuentes van en Images/orbita/{fondo,orbes,hub,insignias,gemas}/,");
  console.log("con el sufijo -source. Los prompts están en Images/orbita/ORBITA.md.");
} else if (fallo) {
  console.log("Quedaron piezas sin importar. Cada ERROR de arriba dice qué medir y por qué importa.");
  process.exitCode = 1;
} else {
  console.log("Listo. Todo en public/assets/orbita/.");
}
