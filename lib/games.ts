export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  /** Segmento de URL: `/juego/bloque-buster`. */
  id: string;
  title: string;
  /** Texto corto de la tarjeta de la Biblioteca. */
  short: string;
  /** Texto largo del Detalle. */
  long: string;
  cat: GameCategory;
  /** Clase CSS de la portada: `cover-bricks`. Vive en `app/globals.css`. */
  cover: string;
  /** Variante de color del botón JUGAR. */
  color: GameColor;
  /** Orden en el catálogo. En la base es único y va de diez en diez. */
  sortOrder: number;
};

/**
 * Cifras del juego. No son un dato del juego: son una consulta sobre `scores`,
 * servida por la vista `public.game_stats`. Por eso no están en `Game`.
 */
export type GameStats = {
  gameId: string;
  best: number;
  plays: number;
  players: number;
};

export type GameWithStats = Game & { stats: GameStats };

/** Estadísticas de un juego que nadie ha jugado todavía. */
export function emptyStats(gameId: string): GameStats {
  return { gameId, best: 0, plays: 0, players: 0 };
}

/**
 * Copia de respaldo del catálogo.
 *
 * La fuente de verdad es `public.games`; esto es lo que se sirve cuando faltan
 * las variables de entorno de Supabase o la consulta falla. El `README.md`
 * promete que la aplicación se sirve sin configurar, y una portada sin juegos
 * no es «degradada», es rota.
 *
 * Tiene que coincidir con la siembra de la migración `create_games`. Si
 * divergen, el catálogo cambia según haya o no configuración: por eso
 * `lib/catalog.ts` avisa por consola cada vez que cae aquí.
 */
export const FALLBACK_GAMES: Game[] = [
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rebota la pelota y destruye muros de neón.",
    long: "Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
    sortOrder: 10,
  },
  {
    id: "caida",
    title: "CAÍDA",
    short: "Encaja las piezas antes de que el techo te aplaste.",
    long: "Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
    sortOrder: 20,
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Crece sin morder tu propia cola.",
    long: "Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    sortOrder: 30,
  },
  {
    id: "gloton",
    title: "GLOTÓN",
    short: "Devora puntos y escapa de los fantasmas.",
    long: "Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
    sortOrder: 40,
  },
  {
    id: "invasores",
    title: "INVASORES",
    short: "Defiende el planeta de filas alienígenas.",
    long: "Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
    sortOrder: 50,
  },
  {
    id: "rocas",
    title: "ROCAS",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
    sortOrder: 60,
  },
  {
    id: "ranaria",
    title: "RANARIA",
    short: "Cruza la autopista de pixeles.",
    long: "Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.",
    cat: "ARCADE",
    cover: "cover-rana",
    color: "green",
    sortOrder: 70,
  },
  {
    id: "duelo-pixel",
    title: "DUELO PIXEL",
    short: "Dos paletas. Una pelota. Reflejos máximos.",
    long: "El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.",
    cat: "VERSUS",
    cover: "cover-duelo",
    color: "cyan",
    sortOrder: 80,
  },
  {
    id: "asteroides",
    title: "ASTEROIDES",
    short: "Rompe rocas a la deriva en un espacio sin bordes.",
    long: "Tu nave flota en un campo de asteroides donde el espacio se dobla sobre sí mismo: sal por un borde y aparecerás por el opuesto. Dispara para partir las rocas grandes en medianas y las medianas en pequeñas, y recoge el módulo de disparo triple antes de que se apague.",
    cat: "SHOOTER",
    cover: "cover-asteroides",
    color: "cyan",
    sortOrder: 90,
  },
  {
    id: "tetris",
    title: "TETRIS",
    short: "Rota, encaja y funde líneas contra el reloj.",
    long: "Ocho piezas distintas caen sobre un pozo de diez columnas. Rótalas apurando los saltos de pared, apóyate en la sombra que marca dónde van a aterrizar y complétalas en líneas para hacerlas desaparecer. Cada diez líneas sube el nivel y la caída se acelera, hasta que el pozo llega arriba.",
    cat: "PUZZLE",
    cover: "cover-tetris",
    color: "cyan",
    sortOrder: 100,
  },
];

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

export type Cat = (typeof CATS)[number];

/**
 * Tope superior de una puntuación aceptable.
 *
 * Es un badén, no un candado: filtra lo absurdo, no lo verosímil. Tiene que
 * coincidir con la restricción `scores_score_range` de `public.scores`.
 */
export const MAX_SCORE = 10_000_000;
