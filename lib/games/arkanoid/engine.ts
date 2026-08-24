/**
 * ARKANOID — port de `references/started-games/04-arkanoid/game.js`.
 *
 * Cambios respecto al original, y solo estos:
 *
 * - El estado deja de vivir en variables globales de módulo y pasa a ser el de
 *   una instancia creada por `createEngine`. Sin esto, dos montajes del canvas
 *   —el doble render de Strict Mode, sin ir más lejos— compartirían pelota, y
 *   ésta iría al doble de velocidad.
 * - El spritesheet no se porta. Bloques, paleta, pelota y explosiones se
 *   dibujan con rectángulos, gradientes y brillo, en el neón del sitio. La
 *   explosión conserva sus 150 ms y sus cuatro pasos: lo que era una tira de
 *   cuatro recortes es aquí un rectángulo que crece y se apaga.
 * - Del lienzo desaparecen el HUD —puntuación, nivel y las pelotitas de las
 *   vidas—, los carteles de GAME OVER y victoria, y el overlay de pausa entero
 *   con su selector de nivel. El HUD y la pausa los pinta el reproductor, y el
 *   selector de nivel era una herramienta de desarrollo que en un juego con
 *   marcador es una forma de empezar por el final.
 * - La tecla `P` no se engancha aquí: la pausa la gobierna `game-canvas.tsx` y
 *   es la misma para los tres juegos.
 * - La paleta también se mueve arrastrando el dedo, y para eso el lienzo pasa a
 *   `touch-action: none` mientras el motor está montado. Se pone desde aquí y
 *   no en `.game-canvas` para no quitarle el desplazamiento con el dedo a
 *   ASTEROIDES y a TETRIS, que no arrastran nada.
 * - En pausa el puntero no mueve la paleta. El original no tenía pausa de
 *   plataforma; moverla bajo el cartel EN PAUSA sería simular estando parado.
 * - Los dos sonidos se reproducen igual que en el original, clonando el
 *   elemento en cada golpe para que dos rebotes seguidos se solapen en vez
 *   de cortarse. Lo que cambia: la promesa de `play()` se recoge con un
 *   `catch` vacío —el navegador la rechaza mientras no haya habido
 *   interacción, y la pelota sale disparada nada más cargar—, y no suena
 *   nada si el motor está silenciado, en pausa o ya destruido.
 *
 * Ninguna constante de juego cambia de valor. Tampoco se corrigen sus dos
 * rarezas: la paleta solo invierte la vertical, así que el jugador no dirige la
 * pelota, y un bloque golpeado de lado también invierte la vertical, así que
 * una pelota que entra por el lateral se come la hilera entera. Las dos son las
 * que producen las rachas largas y el equilibrio de los cinco niveles.
 */

import {
  GAME_KEYS,
  isTextTarget,
  type CreateEngineOptions,
  type GameEngine,
  type GameSnapshot,
  type GameStatus,
} from "@/lib/games/engine";
import { BLOCK_COLORS, LEVELS, type BlockColor } from "@/lib/games/arkanoid/levels";

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;

const BALL_SIZE = 16;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;

const LIVES = 3;
const POINTS_PER_BLOCK = 10;

/** La explosión dura 150 ms y se lee en cuatro pasos, como en el original. */
const EXPLOSION_DURATION = 150;
const EXPLOSION_STEPS = 4;

const BACKGROUND = "#05060f";

const BOUNCE_SOUND = "/juegos/arkanoid/ball-bounce.mp3";
const BREAK_SOUND = "/juegos/arkanoid/break-sound.mp3";

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};

type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  /** Milisegundos transcurridos desde que se rompió el bloque. */
  elapsed: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createEngine({ canvas, onSnapshot, onGameOver }: CreateEngineOptions): GameEngine {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  // Las funciones de este ámbito están hoisted, así que el estrechamiento del
  // `if` no llega hasta ellas. Esta constante ya nace sin `null`.
  const ctx: CanvasRenderingContext2D = context;

  // ── Estado ─────────────────────────────────────────────────────────────────
  const paddle = { x: (W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: BASE_BALL_VX, vy: BASE_BALL_VY };

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = LIVES;
  let level = 1;
  let state: "playing" | "gameover" = "playing";

  const held = { left: false, right: false };

  let paused = false;
  let destroyed = false;
  let muted = false;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let last: GameSnapshot | null = null;

  // ── Sonido ─────────────────────────────────────────────────────────────────
  const bounce = new Audio(BOUNCE_SOUND);
  const broken = new Audio(BREAK_SOUND);

  /**
   * Un clon por golpe, como en el original: así el segundo rebote no corta
   * al primero. Los clones son de usar y tirar.
   */
  function play(sound: HTMLAudioElement) {
    if (muted || paused || destroyed) return;
    const clone = sound.cloneNode() as HTMLAudioElement;
    // Hasta que el jugador no toca nada el navegador rechaza la promesa, y
    // la pelota sale disparada al cargar: sin este `catch` la consola se
    // llenaría de promesas rechazadas en cada partida.
    void clone.play().catch(() => {});
  }

  // ── Tablero ────────────────────────────────────────────────────────────────
  /** Coloca la pelota sobre la paleta y le da la velocidad del nivel en curso. */
  function initBall() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    level = n;
    blocks = LEVELS[n - 1].blocks.map((spec) => ({
      x: BLOCKS_ORIGIN_X + spec.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + spec.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: spec.color,
      alive: true,
    }));
    explosions = [];
    initBall();
  }

  function initGame() {
    paddle.x = (W - paddle.w) / 2;
    score = 0;
    lives = LIVES;
    state = "playing";
    held.left = false;
    held.right = false;
    loadLevel(1);
  }

  function gameOver() {
    if (state === "gameover") return;
    state = "gameover";
    emit();
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

  // ── Entrada ────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextTarget(e.target)) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.code === "ArrowLeft") held.left = true;
    if (e.code === "ArrowRight") held.right = true;
  };

  // Sin guarda de campo de texto: soltar una tecla siempre tiene que soltarla,
  // o la paleta se queda corriendo sola.
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") held.left = false;
    if (e.code === "ArrowRight") held.right = false;
  };

  /**
   * Centra la paleta en el puntero. El lienzo real es más denso que el lógico
   * —lo escala el anfitrión por `dpr`— y además se estira por CSS, así que la
   * conversión se hace contra el rectángulo pintado, no contra `canvas.width`.
   */
  const onPointer = (e: PointerEvent) => {
    if (paused || state !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = (e.clientX - rect.left) * (W / rect.width);
    paddle.x = clamp(x - paddle.w / 2, 0, W - paddle.w);
  };

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("pointermove", onPointer);

  // Sin esto, arrastrar el dedo sobre el lienzo desplazaría la página en vez de
  // mover la paleta.
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";

  // ── Update ─────────────────────────────────────────────────────────────────
  function hits(block: Block): boolean {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function update(dt: number) {
    if (state !== "playing") return;

    if (held.left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (held.right) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Paredes: izquierda, derecha y techo. Abajo no hay pared, hay vidas.
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play(bounce);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play(bounce);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play(bounce);
    }

    // Rebote plano en la paleta: solo se invierte la vertical, así que el punto
    // de impacto no dirige la pelota. Es del original y se queda.
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play(bounce);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (!hits(block)) continue;

      block.alive = false;
      explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
      score += POINTS_PER_BLOCK;
      ball.vy = -ball.vy;
      play(broken);

      if (blocks.every((other) => !other.alive)) {
        if (level < LEVELS.length) loadLevel(level + 1);
        else gameOver();
      }
      // Un bloque por fotograma, como en el original.
      break;
    }

    for (const explosion of explosions) explosion.elapsed += dt * 1000;
    explosions = explosions.filter((explosion) => explosion.elapsed < EXPLOSION_DURATION);

    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameOver();
      } else {
        // El muro se queda como estaba: solo vuelve la pelota.
        initBall();
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawBlock(block: Block) {
    ctx.fillStyle = BLOCK_COLORS[block.color];
    ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
    // El brillo de arriba y la sombra de abajo son lo que le da volumen al
    // bloque ahora que no hay recorte de un png.
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, 4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(block.x + 1, block.y + block.h - 4, block.w - 2, 3);
  }

  function drawExplosion(explosion: Explosion) {
    const step = Math.min(
      Math.floor((explosion.elapsed / EXPLOSION_DURATION) * EXPLOSION_STEPS),
      EXPLOSION_STEPS - 1,
    );
    const t = step / (EXPLOSION_STEPS - 1);
    const grow = 1 + t * 0.7;
    const w = explosion.w * grow;
    const h = explosion.h * grow;
    const x = explosion.x + (explosion.w - w) / 2;
    const y = explosion.y + (explosion.h - h) / 2;

    ctx.globalAlpha = 1 - t * 0.8;
    ctx.fillStyle = BLOCK_COLORS[explosion.color];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
    ctx.globalAlpha = 1;
  }

  function drawPaddle() {
    const gradient = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    gradient.addColorStop(0.4, "#f5ff00");
    gradient.addColorStop(1, "#b3bd00");

    ctx.shadowColor = "rgba(245, 255, 0, 0.65)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = gradient;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.shadowBlur = 0;
  }

  function drawBall() {
    const r = ball.w / 2;
    const cx = ball.x + r;
    const cy = ball.y + r;

    const gradient = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#00f5ff");

    ctx.shadowColor = "rgba(0, 245, 255, 0.8)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, W, H);

    for (const block of blocks) {
      if (block.alive) drawBlock(block);
    }
    for (const explosion of explosions) drawExplosion(explosion);

    drawPaddle();
    drawBall();
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
      // Un botón táctil que se quedó pulsado al pausar no debe seguir moviendo
      // la paleta al reanudar.
      held.left = false;
      held.right = false;
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
      if (action === "left") held.left = active;
      if (action === "right") held.right = active;
    },

    setMuted(next) {
      muted = next;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.style.touchAction = previousTouchAction;
    },
  };
}
