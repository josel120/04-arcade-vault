/**
 * Piezas, colores y tabla de puntuación de TETRIS.
 *
 * Copiado literal de `references/started-games/03-tetris/game.js`: ni un número
 * cambia. Vive aparte del motor porque son datos, no lógica, y porque así se ve
 * de un vistazo que el port no ha reequilibrado nada.
 */

export const COLS = 10;
export const ROWS = 20;
/** Lado de una celda, en píxeles lógicos. El tablero mide 300 × 600. */
export const BLOCK = 30;

/**
 * Color por índice de pieza. El 0 no existe: en el tablero significa «vacío».
 *
 * Son pasteles, no los cuatro neones del sitio. Se conservan tal cual porque
 * son los que distinguen una pieza de otra de un vistazo, y la portada
 * `.cover-tetris` los reutiliza para que la tarjeta enseñe el juego real.
 */
export const COLORS: readonly (string | null)[] = [
  null,
  "#4dd0e1", // I - cian
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - morado
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - naranja
  "#9e9e9e", // N - tuerca (gris metálico)
];

/**
 * Las siete piezas clásicas más una octava que el original añadió por su
 * cuenta: la «tuerca», un 3 × 3 con el centro hueco. No aparece en el README
 * del original, pero `randomPiece` la reparte una de cada ocho veces, así que
 * entra en el port: quitarla haría el juego más fácil y ya no sería el que
 * estaba probado.
 */
export const PIECES: readonly (readonly number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

/** Puntos por 1, 2, 3 o 4 líneas, multiplicados por el nivel. */
export const LINE_SCORES = [0, 100, 300, 500, 800];
