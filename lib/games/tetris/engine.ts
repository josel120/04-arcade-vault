/**
 * TETRIS — port de `references/started-games/03-tetris/game.js`.
 *
 * Cambios respecto al original, y solo estos:
 *
 * - El estado deja de vivir en variables globales de módulo y pasa a ser el de
 *   una instancia creada por `createEngine`. Sin esto, dos montajes del canvas
 *   —el doble render de Strict Mode, sin ir más lejos— compartirían tablero.
 * - El original tenía dos lienzos y un panel de DOM: tablero, vista previa y
 *   marcador lateral. Aquí hay uno solo de 800 × 600, con el tablero de
 *   300 × 600 a la izquierda y el panel dibujado a su derecha. Puntuación y
 *   nivel suben al HUD de la plataforma; LÍNEAS se queda en el lienzo porque el
 *   HUD no tiene esa casilla.
 * - El overlay de PAUSA y el de GAME OVER desaparecen: la pausa la pinta el
 *   reproductor y el fin de partida abre el modal de React con `onGameOver`.
 *   Con ellos se va el botón de reinicio, que ahora es JUGAR DE NUEVO.
 * - El interruptor de tema claro/oscuro y su `localStorage` no se portan: el
 *   sitio tiene su propio tema.
 * - Los botones táctiles repiten mientras se mantienen pulsados. El original no
 *   los tenía; con teclado esa repetición la da el sistema operativo.
 *
 * Ninguna constante de juego cambia de valor.
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
import { BLOCK, COLORS, COLS, LINE_SCORES, PIECES, ROWS } from "@/lib/games/tetris/pieces";

const W = 800;
const H = 600;

// ── Reparto del lienzo ───────────────────────────────────────────────────────
// El tablero mide 300 × 600 y el lienzo 800 × 600: márgenes iguales a los lados
// y el panel entre medias, para que el marco CRT no quede con dos franjas
// negras a los costados.
const BOARD_X = 100;
const BOARD_Y = 0;
const BOARD_W = COLS * BLOCK; // 300
const BOARD_H = ROWS * BLOCK; // 600

const PANEL_X = BOARD_X + BOARD_W + 60; // 460
const PANEL_W = 240;

/** Caja de la vista previa: cuatro celdas de lado, centrada en el panel. */
const PREVIEW = 4 * BLOCK; // 120
const PREVIEW_X = PANEL_X + (PANEL_W - PREVIEW) / 2;
const PREVIEW_Y = 132;

const INK = "#e6e9ff";
const INK_DIM = "#8a8fb5";
const INK_FAINT = "#4a4f70";
const GRID_LINE = "rgba(230, 233, 255, 0.06)";

/** Rotar. `KeyX` no está en `GAME_KEYS` porque no desplaza la página. */
const ROTATE_KEYS = new Set(["ArrowUp", "KeyX"]);

/** Acciones que se repiten mientras se mantiene pulsado el botón táctil. */
const REPEATABLE: ReadonlySet<GameAction> = new Set<GameAction>(["left", "right", "down"]);
/** Espera antes de la primera repetición, y cadencia a partir de ahí. */
const REPEAT_DELAY = 0.22;
const REPEAT_RATE = 0.06;

type Piece = { type: number; shape: number[][]; x: number; y: number };

export function createEngine({ canvas, onSnapshot, onGameOver }: CreateEngineOptions): GameEngine {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  // Las funciones de este ámbito están hoisted, así que el estrechamiento del
  // `if` no llega hasta ellas. Esta constante ya nace sin `null`.
  const ctx: CanvasRenderingContext2D = context;

  // ── Estado ─────────────────────────────────────────────────────────────────
  let board: number[][];
  let current: Piece;
  let upcoming: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let state: "playing" | "gameover";
  let dropAccum: number;
  let dropInterval: number;

  let paused = false;
  let destroyed = false;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let last: GameSnapshot | null = null;

  /** Acción táctil mantenida, con su cuenta atrás para repetir. */
  const held = new Map<GameAction, number>();

  // ── Tablero y piezas ───────────────────────────────────────────────────────
  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result[c][rows - 1 - r] = shape[r][c];
      }
    }
    return result;
  }

  /** Rotación con saltos de pared: si choca, prueba a desplazarse ±1 y ±2. */
  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) {
          board[current.y + r][current.x + c] = current.shape[r][c];
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  /** Fila en la que aterrizaría la pieza actual: la sombra. */
  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = upcoming;
    upcoming = randomPiece();
    // Si la pieza recién generada ya choca, el pozo ha llegado arriba.
    if (collide(current.shape, current.x, current.y)) gameOver();
  }

  function gameOver() {
    if (state === "gameover") return;
    state = "gameover";
    emit();
    onGameOver(score);
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    state = "playing";
    dropInterval = 1000;
    dropAccum = 0;
    held.clear();
    upcoming = randomPiece();
    spawn();
  }

  /** Avisa al HUD solo cuando algo cambia de verdad, nunca por fotograma. */
  function emit() {
    const status: GameStatus = state === "gameover" ? "gameover" : paused ? "paused" : "playing";
    // Tetris no tiene vidas. El HUD pinta «—» cuando recibe cero, que es más
    // honesto que enseñar tres corazones que nadie va a perder nunca.
    const next: GameSnapshot = { score, lives: 0, level, status };

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

  // ── Entrada ────────────────────────────────────────────────────────────────
  /**
   * Un movimiento discreto. Lo llaman el teclado —una vez por evento, así que
   * la repetición la pone el sistema operativo— y la botonera táctil.
   */
  function doAction(action: GameAction) {
    if (state !== "playing" || paused) return;

    switch (action) {
      case "left":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "right":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "thrust":
        tryRotate();
        break;
      case "down":
        softDrop();
        break;
      case "fire":
        hardDrop();
        break;
    }
    emit();
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextTarget(e.target)) return;
    // Solo se frena el desplazamiento de la página con las teclas que lo
    // provocan; `KeyX` no es una de ellas.
    if (GAME_KEYS.has(e.code)) e.preventDefault();

    if (ROTATE_KEYS.has(e.code)) {
      doAction("thrust");
      return;
    }
    switch (e.code) {
      case "ArrowLeft":
        doAction("left");
        break;
      case "ArrowRight":
        doAction("right");
        break;
      case "ArrowDown":
        doAction("down");
        break;
      case "Space":
        doAction("fire");
        break;
    }
  };

  window.addEventListener("keydown", onKeyDown, { passive: false });

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") return;

    // Repetición de los botones táctiles mantenidos.
    for (const [action, remaining] of held) {
      const left = remaining - dt;
      if (left <= 0) {
        doAction(action);
        held.set(action, REPEAT_RATE);
      } else {
        held.set(action, left);
      }
    }

    dropAccum += dt * 1000;
    if (dropAccum >= dropInterval) {
      // El original lo pone a cero en vez de restarle el intervalo, así que
      // pierde el sobrante entre fotogramas. Se porta tal cual.
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawBlock(x: number, y: number, colorIndex: number, size: number, alpha = 1) {
    const color = COLORS[colorIndex];
    if (!color) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    // El brillo superior que le da volumen a la celda.
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 1, y + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  function drawCell(col: number, row: number, colorIndex: number, alpha = 1) {
    drawBlock(BOARD_X + col * BLOCK, BOARD_Y + row * BLOCK, colorIndex, BLOCK, alpha);
  }

  function drawWell() {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(BOARD_X + c * BLOCK + 0.5, BOARD_Y);
      ctx.lineTo(BOARD_X + c * BLOCK + 0.5, BOARD_Y + BOARD_H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(BOARD_X, BOARD_Y + r * BLOCK + 0.5);
      ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * BLOCK + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = INK_FAINT;
    ctx.strokeRect(BOARD_X + 0.5, BOARD_Y + 0.5, BOARD_W - 1, BOARD_H - 1);
  }

  function label(text: string, x: number, y: number) {
    ctx.fillStyle = INK_DIM;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y);
  }

  function drawPanel() {
    const cx = PANEL_X + PANEL_W / 2;

    label("SIGUIENTE", cx, PREVIEW_Y - 18);
    ctx.strokeStyle = INK_FAINT;
    ctx.lineWidth = 1;
    ctx.strokeRect(PREVIEW_X + 0.5, PREVIEW_Y + 0.5, PREVIEW - 1, PREVIEW - 1);

    // Centrada en la caja de 4 × 4, como en el original.
    const shape = upcoming.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawBlock(
          PREVIEW_X + (offX + c) * BLOCK,
          PREVIEW_Y + (offY + r) * BLOCK,
          shape[r][c],
          BLOCK,
        );
      }
    }

    // LÍNEAS se dibuja aquí porque el HUD de la plataforma solo tiene casillas
    // para puntuación, vidas y nivel.
    label("LÍNEAS", cx, PREVIEW_Y + PREVIEW + 56);
    ctx.fillStyle = INK;
    ctx.font = "30px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(lines), cx, PREVIEW_Y + PREVIEW + 92);
  }

  function draw() {
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, W, H);

    drawWell();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawCell(c, r, board[r][c]);
      }
    }

    // La sombra: dónde va a aterrizar la pieza actual.
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) drawCell(current.x + c, gy + r, current.shape[r][c], 0.2);
      }
    }

    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) drawCell(current.x + c, current.y + r, current.shape[r][c]);
      }
    }

    drawPanel();
  }

  // ── Bucle principal ────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

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
      // Sin esto, un botón táctil que se quedó pulsado al pausar seguiría
      // contando para repetir al reanudar.
      held.clear();
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

    finish() {
      gameOver();
    },

    setAction(action, active) {
      if (!active) {
        held.delete(action);
        return;
      }
      doAction(action);
      // Mantener pulsado repite; el teclado no pasa por aquí, que para eso ya
      // repite el sistema.
      if (REPEATABLE.has(action)) held.set(action, REPEAT_DELAY);
    },

    // TETRIS no suena: el contrato se cumple sin hacer nada.
    setMuted() {},

    // Todavía dibuja con `PIECES` en `lib/games/tetris/pieces.ts`: el chrome
    // ya cambia de piel, el lienzo lo hará cuando este motor migre su paleta.
    setSkin() {},

    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
