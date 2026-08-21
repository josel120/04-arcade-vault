import type { CreateEngine } from "@/lib/games/engine";

export type GameEngineEntry = {
  /**
   * Resolución interna del motor, en píxeles lógicos. Es fija: el juego tiene
   * su física calibrada sobre este lienzo y el anfitrión lo escala por CSS.
   */
  width: number;
  height: number;
  load: () => Promise<{ createEngine: CreateEngine }>;
};

/**
 * Juegos con motor real, por `id` del catálogo.
 *
 * `load` es un `import()` dinámico a propósito: así el motor no entra en el
 * bundle de la Biblioteca ni en el de los juegos que siguen siendo maqueta.
 *
 * Un `id` que no esté aquí hace que el reproductor caiga a la arena decorativa
 * del SPEC 01, que es exactamente lo que queremos para los otros ocho.
 */
export const GAME_ENGINES: Record<string, GameEngineEntry> = {
  asteroides: {
    width: 800,
    height: 600,
    load: () => import("@/lib/games/asteroides/engine"),
  },
};

export function getEngineEntry(gameId: string): GameEngineEntry | undefined {
  return GAME_ENGINES[gameId];
}
