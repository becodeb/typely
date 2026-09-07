/* Catálogo del hangar de Órbita — ESPEJO del CATALOGO de
 * `api/src/routes/arcade.ts`. El precio que vale es el del servidor: este
 * archivo solo dibuja. Si cambia uno, cambiar el otro en el mismo commit.
 *
 * Regla de diseño: los cristales compran COSMÉTICOS, nunca ventaja. Una
 * estela y un color de rayo no tocan ni una perilla del motor — el
 * ranking compara habilidad, no billeteras de cristales.
 */

export type TipoCosmetico = "estela" | "rayo" | "impacto" | "nave" | "mascota";
export type RarezaCosmetico = "comun" | "rara" | "epica" | "legendaria";
export const NOMBRE_RAREZA: Record<RarezaCosmetico, string> = {
  comun: "Común", rara: "Rara", epica: "Épica", legendaria: "Legendaria",
};
export type EfectoCosmetico = "color" | "estrellas" | "aurora" | "pulso" | "espiral" | "anillos" | "cristales"
  | "burbujas" | "pixeles" | "arcoiris" | "relampago" | "caramelo" | "confeti" | "palomitas";
export const SLOT_COSMETICO = { estela: "trail", rayo: "beam", impacto: "impact", nave: "ship", mascota: "pet" } as const;

export interface Cosmetico {
  id: string;
  tipo: TipoCosmetico;
  nombre: string;
  precio: number;
  /** Color con el que se dibuja la estela o el rayo. Paleta §5. */
  color: string;
  efecto?: EfectoCosmetico;
  descripcion?: string;
  rareza: RarezaCosmetico;
}

export const COSMETICOS: readonly Cosmetico[] = [
  { id: "mascota-botito", tipo: "mascota", nombre: "Botito", precio: 400, color: "#54e8c6", rareza: "comun", descripcion: "Un pequeño robot curioso flota junto a tu nave." },
  { id: "mascota-lunita", tipo: "mascota", nombre: "Lunita", precio: 600, color: "#a9baff", rareza: "comun", descripcion: "Una lunita soñadora te acompaña entre las estrellas." },
  { id: "mascota-gatito-cometa", tipo: "mascota", nombre: "Gatito cometa", precio: 1000, color: "#8be7f1", rareza: "rara", descripcion: "Un gatito de cola brillante que disfruta cada vuelo." },
  { id: "mascota-medusa-burbuja", tipo: "mascota", nombre: "Medusa burbuja", precio: 1400, color: "#eaacff", rareza: "rara", descripcion: "Una medusa luminosa se balancea suavemente a tu lado." },
  { id: "mascota-pulpito-dj", tipo: "mascota", nombre: "Pulpito DJ", precio: 2000, color: "#bb83ff", rareza: "epica", descripcion: "Un pulpo con auriculares y mucho ritmo para acompañarte." },
  { id: "mascota-dino-patinador", tipo: "mascota", nombre: "Dino patinador", precio: 2600, color: "#8be85c", rareza: "epica", descripcion: "Un dinosaurio con patines que se toma el espacio como una pista." },
  { id: "mascota-capibara-astronauta", tipo: "mascota", nombre: "Capibara astronauta", precio: 3400, color: "#ffb35c", rareza: "legendaria", descripcion: "Un capibara relajado viaja en su salvavidas cósmico." },
  { id: "mascota-dragon-gelatina", tipo: "mascota", nombre: "Dragón de gelatina", precio: 4200, color: "#6cf5b1", rareza: "legendaria", descripcion: "Un dragoncito de gelatina, alas de caramelo y corazón brillante." },
  { id: "estela-burbujas", tipo: "estela", nombre: "Baño de burbujas", precio: 850, color: "#74dcff", efecto: "burbujas", rareza: "rara", descripcion: "Burbujas tornasoladas salen de los motores y se alejan flotando." },
  { id: "estela-pixeles", tipo: "estela", nombre: "Modo píxel", precio: 1600, color: "#82ff7a", efecto: "pixeles", rareza: "epica", descripcion: "Una lluvia de cuadraditos neón convierte tu vuelo en un juego retro." },
  { id: "estela-arcoiris", tipo: "estela", nombre: "Autopista arcoíris", precio: 1800, color: "#ff8acb", efecto: "arcoiris", rareza: "legendaria", descripcion: "Dos cintas de seis colores ondulan detrás de la nave." },
  { id: "rayo-relampago", tipo: "rayo", nombre: "Relámpago eléctrico", precio: 900, color: "#89cfff", efecto: "relampago", rareza: "rara", descripcion: "Un relámpago azul conecta el cristal con cada letra." },
  { id: "rayo-caramelo", tipo: "rayo", nombre: "Cañón de caramelo", precio: 1600, color: "#ff91bf", efecto: "caramelo", rareza: "epica", descripcion: "Un caramelo envuelto viaja por un rayo de franjas rosas y blancas." },
  { id: "rayo-burbujas", tipo: "rayo", nombre: "Pompas de jabón", precio: 1800, color: "#8defff", efecto: "burbujas", rareza: "legendaria", descripcion: "Una hilera de pompas brillantes corre desde el cristal hasta la letra." },
  { id: "impacto-rosa", tipo: "impacto", nombre: "Destello rosa", precio: 300, color: "#ff9fca", efecto: "color", rareza: "comun", descripcion: "Un destello y cuatro chispas rosas al completar una palabra." },
  { id: "impacto-burbujas", tipo: "impacto", nombre: "¡Pop, pop!", precio: 850, color: "#82e8ff", efecto: "burbujas", rareza: "rara", descripcion: "Un racimo de burbujas se expande y revienta alrededor de la palabra." },
  { id: "impacto-confeti", tipo: "impacto", nombre: "Fiesta de confeti", precio: 1500, color: "#ffc85a", efecto: "confeti", rareza: "epica", descripcion: "Papelitos de colores giran y caen para festejar cada palabra." },
  { id: "impacto-palomitas", tipo: "impacto", nombre: "Pochoclos cósmicos", precio: 1800, color: "#ffe18e", efecto: "palomitas", rareza: "legendaria", descripcion: "¡Una pequeña explosión de pochoclos salta al terminar de escribir!" },
  { id: "estela-menta", tipo: "estela", nombre: "Estela menta", precio: 120, color: "#54e8c6", rareza: "comun" },
  { id: "estela-violeta", tipo: "estela", nombre: "Estela violeta", precio: 180, color: "#9b7cff", rareza: "comun" },
  { id: "estela-rosa", tipo: "estela", nombre: "Estela rosa", precio: 260, color: "#ff9fca", rareza: "comun" },
  { id: "estela-dorada", tipo: "estela", nombre: "Estela dorada", precio: 400, color: "#ffd552", rareza: "comun" },
  { id: "rayo-violeta", tipo: "rayo", nombre: "Rayo violeta", precio: 100, color: "#9b7cff", rareza: "comun" },
  { id: "rayo-rosa", tipo: "rayo", nombre: "Rayo rosa", precio: 200, color: "#ff9fca", rareza: "comun" },
  { id: "rayo-dorado", tipo: "rayo", nombre: "Rayo dorado", precio: 350, color: "#ffd552", rareza: "comun" },
  { id: "estela-estrellas", tipo: "estela", nombre: "Polvo de estrellas", precio: 650, color: "#ffd552", efecto: "estrellas", rareza: "rara", descripcion: "Pequeñas estrellas doradas se desprenden de los motores." },
  { id: "estela-aurora", tipo: "estela", nombre: "Aurora", precio: 1400, color: "#54e8c6", efecto: "aurora", rareza: "epica", descripcion: "Cintas de luz menta, rosa y violeta ondulan al volar." },
  { id: "rayo-pulso", tipo: "rayo", nombre: "Pulso de plasma", precio: 700, color: "#54e8c6", efecto: "pulso", rareza: "rara", descripcion: "Un núcleo brillante recorre el disparo hasta su objetivo." },
  { id: "rayo-espiral", tipo: "rayo", nombre: "Espiral cósmica", precio: 1500, color: "#9b7cff", efecto: "espiral", rareza: "epica", descripcion: "Dos corrientes de energía se entrelazan alrededor del rayo." },
  { id: "impacto-anillos", tipo: "impacto", nombre: "Eco estelar", precio: 600, color: "#54e8c6", efecto: "anillos", rareza: "rara", descripcion: "Dos anillos luminosos se expanden al completar una palabra." },
  { id: "impacto-cristales", tipo: "impacto", nombre: "Lluvia de cristal", precio: 1200, color: "#9b7cff", efecto: "cristales", rareza: "epica", descripcion: "Una breve lluvia de gemas celebra cada palabra completada." },
  { id: "nave-aurora", tipo: "nave", nombre: "Aurora", precio: 2400, color: "#54e8c6", rareza: "comun", descripcion: "Alas curvas y luces de aurora para surcar el cielo." },
  { id: "nave-prisma", tipo: "nave", nombre: "Prisma", precio: 3600, color: "#9b7cff", rareza: "comun", descripcion: "Cristales facetados y motores rodeados de energía." },
  { id: "nave-fenix", tipo: "nave", nombre: "Fénix", precio: 4800, color: "#ffbe35", rareza: "rara", descripcion: "Alas de fuego, casco rubí y propulsores de luz dorada." },
  { id: "nave-eclipse", tipo: "nave", nombre: "Eclipse", precio: 6000, color: "#f051ff", rareza: "rara", descripcion: "Alas crecientes de zafiro conectadas por energía fucsia." },
  { id: "nave-zapatilla-cohete", tipo: "nave", nombre: "Zapatilla cohete", precio: 7200, color: "#b799ff", rareza: "epica", descripcion: "Cordones luminosos y motores en el talón para despegar con estilo." },
  { id: "nave-tiburon-galactico", tipo: "nave", nombre: "Tiburón galáctico", precio: 8400, color: "#55dfff", rareza: "epica", descripcion: "Una sonrisa de tiburón y aletas azules para nadar entre estrellas." },
  { id: "nave-dragon-caramelo", tipo: "nave", nombre: "Dragón de caramelo", precio: 9600, color: "#ffc55c", rareza: "epica", descripcion: "Alas de cristal violeta y escamas de caramelo para un vuelo mágico." },
  { id: "nave-ovni-gelatina", tipo: "nave", nombre: "Ovni gelatina", precio: 10800, color: "#ef78ff", rareza: "legendaria", descripcion: "Una nave de gelatina brillante con antenitas y burbujas de luz." },
  { id: "nave-ajolote-espacial", tipo: "nave", nombre: "Ajolote espacial", precio: 12000, color: "#6ae4ff", rareza: "legendaria", descripcion: "Branquias rosadas, una sonrisa y motores celestes para explorar el espacio." },
];

export function efectoCosmetico(id: string | null | undefined): EfectoCosmetico {
  return cosmeticoPorId(id)?.efecto ?? "color";
}

/** El rayo de serie, gratis: turquesa, el color de acción del producto. */
export const RAYO_DEFECTO = "#25c8df";

export function cosmeticoPorId(id: string | null | undefined): Cosmetico | null {
  if (!id) return null;
  return COSMETICOS.find((c) => c.id === id) ?? null;
}

/** Color del rayo según lo equipado (o el de serie). */
export function colorRayo(equippedBeam: string | null | undefined): string {
  return cosmeticoPorId(equippedBeam)?.color ?? RAYO_DEFECTO;
}

/** Color de la estela equipada, o null si vuela sin estela. */
export function colorEstela(equippedTrail: string | null | undefined): string | null {
  return cosmeticoPorId(equippedTrail)?.color ?? null;
}
