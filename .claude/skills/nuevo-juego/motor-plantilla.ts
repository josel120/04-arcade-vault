/**
 * PLANTILLA DE MOTOR — cópiala a `lib/games/<id>/engine.ts` y rellena los huecos.
 *
 * No es código de la aplicación: vive en la skill y no se compila. Es el
 * esqueleto del contrato `lib/games/engine.ts` con lo delicado ya resuelto —el
 * bucle, el `dt` capado, el teclado, el diffing del snapshot y el `destroy`
 * idempotente—, que es exactamente lo que se rompe al portar un `game.js`.
 *
 * El ejemplo completo y probado es `lib/games/asteroides/engine.ts`.
 *
 * Lo que hay que tocar está marcado con TODO. Lo que no lleva TODO, déjalo:
 * cada línea de esas está ahí por un fallo concreto documentado en el SPEC 05.
 */

import {
  GAME_KEYS,
  isTextTarget,
  type CreateEngineOptions,
  type GameAction,
  type GameEngine,
  type GameSnapshot,
  type GameStatus,
} from "@/lib/games/engine";

/**
 * Resolución interna, en píxeles lógicos. Fija: la física del juego está
 * calibrada sobre este lienzo y el anfitrión lo escala por CSS.
 *
 * TODO: ajusta y usa los mismos números en la entrada de `GAME_ENGINES`.
 * Si la relación de aspecto no es 4/3, hay que tocar `.game-canvas` en
 * `app/globals.css`.
 */
const W = 800;
const H = 600;

/**
 * Teclas del juego, por acción abstracta. Es lo que traduce la botonera táctil
 * a la misma entrada que el teclado, para que el motor solo lea `keys`.
 *
 * TODO: mapea las acciones de este juego. Si necesitas una acción que no
 * existe, añádela a `GameAction` en `lib/games/engine.ts` y actualiza también
 * `TouchPad`, la leyenda de `game-player.tsx` y `GAME_KEYS`.
 */
const ACTION_KEYS: Record<GameAction, string> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  thrust: "ArrowUp",
  fire: "Space",
};

type Keys = Record<string, boolean>;

export function createEngine({ canvas, onSnapshot, onGameOver }: CreateEngineOptions): GameEngine {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  // Las funciones de este ámbito están hoisted, así que el estrechamiento del
  // `if` no llega hasta ellas. Esta constante ya nace sin `null`.
  const ctx: CanvasRenderingContext2D = context;

  // ── Entrada ────────────────────────────────────────────────────────────────
  const keys: Keys = {};
  const justPressed: Keys = {};

  /** Consume una pulsación: true una sola vez por tecla, hasta que se suelte. */
  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // `isTextTarget` es lo que permite escribir el alias en el modal de fin de
    // partida sin que la barra espaciadora dispare.
    if (!GAME_KEYS.has(e.code) || isTextTarget(e.target)) return;
    // Sin esto la página se desplaza bajo el jugador con cada flecha.
    e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    keys[e.code] = false;
  };

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);

  // ── Estado ─────────────────────────────────────────────────────────────────
  // TODO: todo el estado del juego va AQUÍ DENTRO, nunca como global de módulo.
  // Un global lo comparten las dos instancias que crea el doble montaje de
  // React Strict Mode, y el juego corre al doble de velocidad.
  let score: number;
  let lives: number;
  let level: number;
  let state: "playing" | "gameover";

  // Fontanería del bucle. Esto no se toca.
  let paused = false;
  let destroyed = false;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let last: GameSnapshot | null = null;

  /** Estado inicial de una partida. Lo llaman el arranque y `restart()`. */
  function initGame() {
    score = 0;
    lives = 3; // TODO: si el juego no tiene vidas, decide qué enseña el HUD.
    level = 1;
    state = "playing";
    // TODO: crear entidades, sembrar el nivel, colocar al jugador.
  }

  function gameOver() {
    state = "gameover";
    emit();
    // Abre el modal FIN DEL JUEGO de React. El canvas NO dibuja ningún cartel
    // de GAME OVER, y el Espacio no reinicia nada: eso es cosa del modal.
    onGameOver(score);
  }

  /** Avisa al HUD solo cuando algo cambia de verdad, nunca por fotograma. */
  function emit() {
    const status: GameStatus = state === "gameover" ? "gameover" : paused ? "paused" : "playing";
    const next: GameSnapshot = { score, lives, level, status };

    if (
      last &&
      last.score === next.score &&
      last.lives === next.lives &&
      last.level === next.level &&
      last.status === next.status
    ) {
      return;
    }

    last = next;
    onSnapshot(next);
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") return;

    // TODO: la simulación del juego. `dt` viene en segundos y ya está capado.
    // Lectura de entrada: `keys["ArrowLeft"]` para lo sostenido,
    // `pressed("Space")` para lo que se dispara una vez por pulsación.
    void dt;
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // TODO: dibujar la escena. Puntuación, vidas y nivel NO se dibujan aquí:
    // los pinta el HUD de la plataforma. La excepción admitida es un indicador
    // que cambie varias veces por segundo (asteroides mantiene el contador del
    // disparo triple), porque subirlo al HUD haría re-renderizar React a ese
    // ritmo solo para un temporizador.
  }

  // ── Bucle principal ────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

    // El cap de 50 ms evita la espiral de la muerte al volver de una pestaña
    // oculta: sin él, el primer fotograma traería un `dt` de varios segundos y
    // todo atravesaría todo.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    // En pausa se sigue dibujando —la escena congelada se ve bajo el cartel—
    // pero no se simula. `lastTime` se mantiene al día, así que al reanudar no
    // hay un salto de dt acumulado.
    if (!paused) {
      update(dt);
      emit();
    }
    draw();

    frame = requestAnimationFrame(loop);
  }

  initGame();
  emit();
  frame = requestAnimationFrame(loop);

  return {
    pause() {
      if (paused) return;
      paused = true;
      emit();
    },

    resume() {
      if (!paused) return;
      paused = false;
      emit();
    },

    restart() {
      initGame();
      paused = false;
      emit();
    },

    /** Lo llama el botón FIN del HUD. */
    finish() {
      if (state === "gameover") return;
      gameOver();
    },

    /** Los controles táctiles entran por aquí, como si fueran teclas. */
    setAction(action, active) {
      const code = ACTION_KEYS[action];
      if (active) {
        if (!keys[code]) justPressed[code] = true;
        keys[code] = true;
      } else {
        keys[code] = false;
      }
    },

    /**
     * Idempotente y completo: cancela el rAF y suelta TODOS los listeners.
     * Si aquí falta uno, sobrevive a la navegación y sigue capturando teclas.
     *
     * TODO: si has añadido más listeners (puntero, resize, gamepad…), quítalos
     * aquí también.
     */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
