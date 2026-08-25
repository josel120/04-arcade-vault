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
  /**
   * True si el juego produce sonido. Solo entonces el reproductor pinta el
   * interruptor: un botón de sonido en un juego mudo es un control que no
   * hace nada. Obligatorio, para que el compilador obligue a decidirlo al
   * añadir un juego.
   */
  audio: boolean;
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
    audio: false,
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
    audio: false,
    load: () => import("@/lib/games/tetris/engine"),
  },

  arkanoid: {
    width: 800,
    height: 600,
    keys: [
      { keys: ["◄", "►"], label: "Mover la paleta" },
      // `Ratón` no es una tecla y va igualmente en la leyenda: estos son
      // glifos de presentación, y el jugador tiene que enterarse de que puede
      // usar el puntero, que es como se juega bien a esto.
      { keys: ["Ratón"], label: "Mover la paleta" },
    ],
    // Un botón en cada grupo, uno por pulgar: es el reparto que mejor se
    // ajusta a una paleta que solo va a izquierda y derecha.
    touch: [
      [{ action: "left", glyph: "◄", label: "Mover a la izquierda", tone: "cyan" }],
      [{ action: "right", glyph: "►", label: "Mover a la derecha", tone: "cyan" }],
    ],
    audio: true,
    load: () => import("@/lib/games/arkanoid/engine"),
  },

  vibora: {
    width: 800,
    height: 600,
    // Las cuatro flechas en un solo renglón: cuatro que dijeran «Mover arriba»,
    // «Mover abajo»… serían cuatro veces la misma información.
    keys: [{ keys: ["◄", "▲", "►", "▼"], label: "Mover" }],
    // Horizontales bajo el pulgar izquierdo, verticales bajo el derecho. Es el
    // mismo reparto que ASTEROIDES y TETRIS, así que no hace falta tocar CSS.
    touch: [
      [
        { action: "left", glyph: "◄", label: "Mover a la izquierda", tone: "cyan" },
        { action: "right", glyph: "►", label: "Mover a la derecha", tone: "cyan" },
      ],
      [
        { action: "thrust", glyph: "▲", label: "Mover arriba", tone: "yellow" },
        { action: "down", glyph: "▼", label: "Mover abajo", tone: "yellow" },
      ],
    ],
    audio: true,
    load: () => import("@/lib/games/vibora/engine"),
  },

  frogger: {
    width: 800,
    height: 600,
    keys: [{ keys: ["◄", "▲", "►", "▼"], label: "Saltar" }],
    touch: [
      [
        { action: "left", glyph: "◄", label: "Saltar a la izquierda", tone: "cyan" },
        { action: "right", glyph: "►", label: "Saltar a la derecha", tone: "cyan" },
      ],
      [
        { action: "thrust", glyph: "▲", label: "Saltar arriba", tone: "yellow" },
        { action: "down", glyph: "▼", label: "Saltar abajo", tone: "yellow" },
      ],
    ],
    audio: true,
    load: () => import("@/lib/games/frogger/engine"),
  },
};

export function getEngineEntry(gameId: string): GameEngineEntry | undefined {
  return GAME_ENGINES[gameId];
}
