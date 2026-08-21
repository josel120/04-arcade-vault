/**
 * Fila de marcador tal y como la consumen los componentes de presentación.
 *
 * Hasta el SPEC 06 este fichero también fabricaba las filas: una lista de 18
 * alias inventados y un LCG determinista (`seededScores`) que rellenaba doce
 * puestos por juego. Eso ya no existe. Las filas vienen de la base, por
 * `lib/leaderboard.ts`, y cuando no hay ninguna el marcador lo dice en vez de
 * inventárselas.
 */
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  /** Formato DD/MM/AAAA. */
  date: string;
  /** True si la fila es del jugador de la sesión. */
  isYou?: boolean;
};
