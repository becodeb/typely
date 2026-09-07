import type { RarezaCosmetico } from "./orbitaCosmeticos";

export type MomentoMascota = "saludo" | "animo" | "celebrar" | "reintentar";
interface PersonalidadMascota {
  gesto: string;
  simbolo: string;
  frases: Record<MomentoMascota, readonly string[]>;
}

/** Más rareza aporta repertorio y puesta en escena, nunca ayudas al motor. */
export const DETALLE_MASCOTA: Record<RarezaCosmetico, { particulas: number; color: string }> = {
  comun: { particulas: 0, color: "#87ecdb" },
  rara: { particulas: 3, color: "#bfa7ff" },
  epica: { particulas: 4, color: "#ffda89" },
  legendaria: { particulas: 6, color: "#ffa5dc" },
};

export const PERSONALIDADES_MASCOTA: Record<string, PersonalidadMascota> = {
  "mascota-botito": {
    gesto: "robot", simbolo: "✦", frases: {
      saludo: ["¡Bip, bip! Copiloto listo.", "¡Motores listos! Vamos juntos."],
      animo: ["Una tecla a la vez. ¡Bip!", "¡Tu práctica recarga mi energía!"],
      celebrar: ["¡Bip! ¡Qué buena racha!", "¡Misión cumplida, piloto!"],
      reintentar: ["¡Recalculando! Probemos otra vez.", "Un error también enseña. ¡Bip!"],
    },
  },
  "mascota-lunita": {
    gesto: "luna", simbolo: "✧", frases: {
      saludo: ["¡Te acompaño hasta la luna!", "¿Volamos entre las estrellas?"],
      animo: ["A tu ritmo, estrella.", "Cada intento te hace brillar."],
      celebrar: ["¡Esa racha ilumina el cielo!", "¡Brillaste con esa palabra!"],
      reintentar: ["Respirá. Seguimos juntos.", "Hasta la luna cambia de fase."],
    },
  },
  "mascota-gatito-cometa": {
    gesto: "gato", simbolo: "✦", frases: {
      saludo: ["¡Miau! Tu copiloto llegó.", "¡Bigotes listos para despegar!", "¡Vamos a cazar palabras!"],
      animo: ["Pasito de gato, tecla a tecla.", "¡Tu esfuerzo me hace ronronear!", "¡Miau! Seguí a tu ritmo."],
      celebrar: ["¡Miauravillosa racha!", "¡Saltaste hasta las estrellas!", "¡Esa palabra merecía un miau!"],
      reintentar: ["Caemos de patitas. ¡Otra vez!", "Estiramos los bigotes y seguimos.", "¡Miau! Un intento más."],
    },
  },
  "mascota-medusa-burbuja": {
    gesto: "medusa", simbolo: "○", frases: {
      saludo: ["¡Burbujeando de emoción!", "¡Una aventura entre burbujas!", "Flotemos juntos, piloto."],
      animo: ["Suave y constante, como flotar.", "Cada tecla es una burbuja nueva.", "¡Pop! Tu práctica va creciendo."],
      celebrar: ["¡Pop, pop! ¡Qué linda racha!", "¡Una lluvia de burbujas para vos!", "¡Esa palabra salió flotando!"],
      reintentar: ["Si una burbuja se rompe, nace otra.", "Respirá suave. Podemos seguir.", "¡Pop! Soltamos el error y seguimos."],
    },
  },
  "mascota-pulpito-dj": {
    gesto: "dj", simbolo: "♫", frases: {
      saludo: ["¡DJ Pulpito en la cabina!", "¡Ocho brazos, un gran ritmo!", "¡Subimos la música de la aventura!", "Tu teclado, nuestra pista."],
      animo: ["Encontrá tu ritmo, sin apuro.", "Tecla a tecla suena tu canción.", "¡Tu práctica tiene mucho flow!", "Yo pongo el beat, vos las ganas."],
      celebrar: ["¡Esa racha pide un remix!", "¡Aplausos con mis ocho brazos!", "¡Temazo de palabras, piloto!", "¡Qué ritmo! La galaxia baila."],
      reintentar: ["Se fue una nota. La canción sigue.", "Bajamos el tempo y probamos.", "¡Nuevo intento, nuevo remix!", "Hasta los DJ practican. ¡Dale!"],
    },
  },
  "mascota-dino-patinador": {
    gesto: "dino", simbolo: "✧", frases: {
      saludo: ["¡Ruedas listas, piloto!", "¡Hoy patinamos entre letras!", "¡Un rugido y a despegar!", "¡Tu compa jurásico llegó!"],
      animo: ["Primero equilibrio, después velocidad.", "¡Cada intento es una vuelta más!", "¡Tus ganas son gigantes!", "Pasito jurásico, palabra a palabra."],
      celebrar: ["¡Truco perfecto! ¡Qué racha!", "¡Un rugido de aplausos para vos!", "¡Esa palabra fue un gran salto!", "¡Rodamos directo a las estrellas!"],
      reintentar: ["Nos levantamos y volvemos a rodar.", "Un tropiezo no termina la pista.", "¡Yo también practico mis trucos!", "Acomodamos las ruedas. ¡Seguimos!"],
    },
  },
  "mascota-capibara-astronauta": {
    gesto: "capibara", simbolo: "✦", frases: {
      saludo: ["Capitán Capi, listo para acompañarte.", "Traje listo. Apuro: ninguno.", "Tenemos toda una galaxia por explorar.", "¡Tripulación tranquila, aventura enorme!", "¡Un saludo cósmico, compañero!"],
      animo: ["La calma también llega lejos.", "Tu esfuerzo vale en cada intento.", "Sin correr: tu ritmo es un buen ritmo.", "Una palabra pequeña, un gran paso.", "Estoy acá, explorando con vos."],
      celebrar: ["¡Racha cósmica! Chocá esa patita.", "¡Un abrazo espacial por ese esfuerzo!", "Control de misión: ¡gran trabajo!", "¡Qué buena travesía de palabras!", "¡Festejo tranquilo, alegría gigante!"],
      reintentar: ["Pausa, aire y una nueva oportunidad.", "Una nube no tapa toda la galaxia.", "No hace falta que salga perfecto.", "Errar es parte de explorar.", "Seguimos juntos, sin apuro."],
    },
  },
  "mascota-dragon-gelatina": {
    gesto: "dragon", simbolo: "◆", frases: {
      saludo: ["¡Alitas de gelatina listas!", "¡Hoy volamos con magia y ganas!", "¡Tu dragoncito ya está rebotando!", "¡Aventura dulce a la vista!", "¡Un rugidito mágico para empezar!"],
      animo: ["La práctica es tu verdadera magia.", "¡Cada intento enciende una chispa!", "Tecla a tecla, desplegá tus alas.", "¡Tus ganas me hacen brillar!", "Un poquito cada vez también es volar."],
      celebrar: ["¡Racha de leyenda! ¡Brillitos para vos!", "¡Rugido de confeti por ese esfuerzo!", "¡Esa palabra hizo bailar mis alas!", "¡Una vuelta mágica de festejo!", "¡Reboto de alegría, piloto!"],
      reintentar: ["¡Rebotamos y volvemos a intentar!", "La gelatina tiembla, pero sigue.", "Todo dragón aprende a volar.", "Sacudimos las alitas. ¡Otra oportunidad!", "Un error no apaga tu magia."],
    },
  },
};
