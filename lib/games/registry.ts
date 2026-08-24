import type { CreateEngine, GameAction } from "@/lib/games/engine";

/** Color del botón táctil. Reutiliza la semántica que el HUD de al lado enseña. */
export type TouchTone = "cyan" | "yellow" | "magenta";

/**
 * Un renglón de la leyenda de teclas que se pinta bajo el marco CRT.
 *
 * `keys` son los glifos que se ven, no los `KeyboardEvent.code` que lee el
 * motor: el mapa de teclas de verdad vive dentro de cada motor. Son dos sitios,
 * a sabiendas —derivar el glifo del código sería más maquinaria de la que esto
 * necesita—, así que al cambiar una tecla en el motor hay que cambiarla aquí.
 */
export type KeyHint = {
  keys: string[];
  /** Qué hace: «Girar», «Rotar». */
  label: string;
};

/** Un botón de la botonera táctil. */
export type TouchButton = {
  action: GameAction;
  glyph: string;
  /** Qué hace, para el lector de pantalla. */
  label: string;
  tone: TouchTone;
};

export type GameEngineEntry = {
  /**
   * Resolución interna del motor, en píxeles lógicos. Es fija: el juego tiene
   * su física calibrada sobre este lienzo y el anfitrión lo escala por CSS.
   */
  width: number;
  height: number;
  /**
   * Leyenda de teclas. La pausa no se declara aquí: la engancha el anfitrión
   * del canvas y es la misma para todos los juegos, así que la añade el
   * reproductor. Es obligatoria: un motor sin controles declarados es un motor
   * que el jugador no sabe usar, y el compilador es el sitio barato para
   * descubrirlo.
   */
  keys: KeyHint[];
  /**
   * Botonera táctil, repartida en grupos como el mueble de un recreativo: el
   * primero bajo el pulgar izquierdo, el segundo bajo el derecho. Una fila
   * centrada obligaría a jugar con una sola mano.
   */
  touch: TouchButton[][];
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
    keys: [
      { keys: ["◄", "►"], label: "Girar" },
      { keys: ["▲"], label: "Propulsar" },
      { keys: ["Espacio"], label: "Disparar" },
    ],
    touch: [
      [
        { action: "left", glyph: "◄", label: "Girar a la izquierda", tone: "cyan" },
        { action: "right", glyph: "►", label: "Girar a la derecha", tone: "cyan" },
      ],
      [
        { action: "thrust", glyph: "▲", label: "Propulsar", tone: "yellow" },
        { action: "fire", glyph: "●", label: "Disparar", tone: "magenta" },
      ],
    ],
    load: () => import("@/lib/games/asteroides/engine"),
  },

  tetris: {
    width: 800,
    height: 600,
    keys: [
      { keys: ["◄", "►"], label: "Mover" },
      { keys: ["▲", "X"], label: "Rotar" },
      { keys: ["▼"], label: "Bajar" },
      { keys: ["Espacio"], label: "Soltar" },
    ],
    touch: [
      [
        { action: "left", glyph: "◄", label: "Mover a la izquierda", tone: "cyan" },
        { action: "right", glyph: "►", label: "Mover a la derecha", tone: "cyan" },
      ],
      [
        { action: "thrust", glyph: "⟳", label: "Rotar la pieza", tone: "yellow" },
        { action: "down", glyph: "▼", label: "Bajar más rápido", tone: "cyan" },
        { action: "fire", glyph: "⤓", label: "Soltar la pieza de golpe", tone: "magenta" },
      ],
    ],
    load: () => import("@/lib/games/tetris/engine"),
  },
};

export function getEngineEntry(gameId: string): GameEngineEntry | undefined {
  return GAME_ENGINES[gameId];
}
