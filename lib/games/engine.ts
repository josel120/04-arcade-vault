/**
 * Contrato entre el reproductor de Arcade Vault y el motor de un juego.
 *
 * Es de la plataforma, no de ningún juego en concreto: es lo que permite que
 * el reproductor pinte el HUD y gestione la pausa sin saber nada de asteroides,
 * y lo que hará que añadir Tetris o Arkanoid sea registrar una entrada más.
 */

/**
 * `dead` (la pausa breve entre perder una vida y reaparecer) no sale aquí: de
 * puertas afuera el jugador sigue jugando, y el HUD no debe parpadear por eso.
 */
export type GameStatus = "playing" | "paused" | "gameover";

/** Lo que el motor le cuenta al HUD. */
export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  status: GameStatus;
};

/**
 * Acciones abstractas. Existen para que los controles táctiles no tengan que
 * saber qué tecla usa cada juego.
 *
 * Los nombres vienen de asteroides, que fue el primero, pero el significado lo
 * pone cada juego: en un juego de piezas, `thrust` rota y `fire` suelta. Lo que
 * el jugador lee de cada acción no sale de aquí, sale de los controles que cada
 * motor declara en `lib/games/registry.ts`.
 */
export type GameAction = "left" | "right" | "thrust" | "fire" | "down";

export type GameEngine = {
  pause: () => void;
  resume: () => void;
  /** Vuelve a empezar desde cero: puntuación 0, vidas llenas, nivel 1. */
  restart: () => void;
  /** Fuerza el fin de la partida. Lo usa el botón FIN del HUD. */
  finish: () => void;
  /** Para los controles táctiles: activa o suelta una acción. */
  setAction: (action: GameAction, active: boolean) => void;
  /**
   * Silencia o devuelve el sonido. Obligatorio, como `setAction`: un juego
   * que declara audio y no responde al interruptor deja un botón muerto que
   * solo se descubre jugando. Los juegos mudos lo implementan vacío.
   */
  setMuted: (muted: boolean) => void;
  /** Cancela el rAF y suelta todos los listeners. Idempotente. */
  destroy: () => void;
};

export type CreateEngineOptions = {
  canvas: HTMLCanvasElement;
  /** Solo se llama cuando algún campo del snapshot cambia de verdad. */
  onSnapshot: (snapshot: GameSnapshot) => void;
  onGameOver: (score: number) => void;
};

export type CreateEngine = (options: CreateEngineOptions) => GameEngine;

/**
 * Teclas que el motor consume y que, por tanto, no deben desplazar la página
 * mientras se juega.
 */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

/**
 * True si el evento viene de un campo de texto.
 *
 * Sin esta comprobación, el `preventDefault` de la barra espaciadora impediría
 * escribir el alias en el modal de fin de partida.
 */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
