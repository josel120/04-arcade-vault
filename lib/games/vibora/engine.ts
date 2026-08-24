/**
 * VÍBORA — SPEC 10.
 *
 * Es el primer motor de la plataforma que no es un port. ASTEROIDES, TETRIS y
 * ARKANOID venían de un `game.js` probado en `references/started-games/`, con
 * sus constantes ya calibradas; aquí no hay original, así que **cada número de
 * este fichero es una decisión del spec**, no una copia. Antes de tocar
 * `BASE_STEP_MS` o `SPEED_FACTOR`, léete el §6 del spec: el reparto de puntos
 * y la curva de dificultad se sostienen entre sí.
 *
 * Las tres piezas que no son evidentes leyendo el código:
 *
 * - **La cola de giros.** Guardar solo la última tecla y validarla contra la
 *   dirección pintada tiene dos fallos, y los dos se viven como injusticia: la
 *   esquina cerrada `↑ →` pulsada rápido pierde el primer giro, y `↑ ↓`
 *   pulsados rápido yendo a la derecha dan media vuelta y matan, porque cada
 *   uno por separado es legal. Cada giro se valida contra el **último de la
 *   cola**, no contra `dir`. Ver `enqueue`.
 *
 * - **La colisión con el cuerpo no cuenta la cola.** La cola se va en el mismo
 *   paso en que la cabeza llega a su celda, así que contarla haría ilegal ir
 *   pegado a la propia cola — la maniobra que salva las partidas apuradas.
 *
 * - **La comida se busca sobre la lista de celdas libres.** Con la víbora
 *   ocupando el 90 % del tablero, `while (ocupada) reintentar` es una espera de
 *   duración indefinida dentro del bucle de dibujo.
 *
 * El sonido se sintetiza con WebAudio y no hay ningún fichero: no había
 * original del que copiar los `mp3`. El `AudioContext` se crea perezosamente y
 * se cierra en `destroy`, que es lo que aquí hace de «soltar los listeners».
 */

import {
  GAME_KEYS,
  isTextTarget,
  type CreateEngineOptions,
  type GameEngine,
  type GameSnapshot,
  type GameStatus,
} from "@/lib/games/engine";

const W = 800;
const H = 600;

const CELL = 20;
const COLS = W / CELL; // 40
const ROWS = H / CELL; // 30

/** 8 pasos/s en el nivel 1. */
const BASE_STEP_MS = 125;
/** +12 % de ritmo por nivel. */
const SPEED_FACTOR = 1.12;
/**
 * Suelo de velocidad, alcanzado en el nivel 10. Sin él, `125 / 1.12 ** (n-1)`
 * cruza los 20 ms sobre el nivel 17 y la víbora deja de ser difícil para pasar
 * a ser una lotería. El nivel sigue subiendo y sigue multiplicando puntos, así
 * que el marcador no tiene techo.
 */
const MIN_STEP_MS = 50;

const FOOD_PER_LEVEL = 5;
const POINTS_PER_FOOD = 10;
const START_LENGTH = 3;
const LIVES = 3;
/** Lo que la víbora muerta se queda a la vista, parpadeando. */
const DEATH_MS = 1000;
/** Cabe la esquina cerrada en un gesto; no cabe el suicidio en dos pulsaciones. */
const MAX_QUEUED_TURNS = 2;

const BACKGROUND = "#05060f";
const GRID_LINE = "rgba(0, 255, 136, 0.07)";
const BODY = "#00ff88";
const HEAD = "#c9ffe6";
const FOOD = "#ff006e";
const DEAD_BODY = "#ff3860";

type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };

const STEPS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function createEngine({ canvas, onSnapshot, onGameOver }: CreateEngineOptions): GameEngine {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  // Las funciones de este ámbito están hoisted, así que el estrechamiento del
  // `if` no llega hasta ellas. Esta constante ya nace sin `null`.
  const ctx: CanvasRenderingContext2D = context;

  // ── Estado ─────────────────────────────────────────────────────────────────
  // Todo por instancia. Un global de módulo aquí compila y solo falla con el
  // doble montaje de Strict Mode: dos víboras, velocidad doble y sonido doble.
  let snake: Cell[] = [];
  let dir: Dir = "right";
  let queued: Dir[] = [];
  let food: Cell = { x: 0, y: 0 };

  let score = 0;
  let lives = LIVES;
  /** Bocados de toda la partida, no de la vida: perder no devuelve velocidad. */
  let eaten = 0;
  let state: "playing" | "gameover" = "playing";

  /** Muerta y esperando reaparecer. No viaja en el snapshot: ver `GameStatus`. */
  let dead = false;
  let deathElapsed = 0;
  /** Reaparecida y quieta hasta que el jugador diga hacia dónde. */
  let waiting = true;

  let paused = false;
  let destroyed = false;
  let muted = false;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let accumulator = 0;
  let elapsed = 0;
  let last: GameSnapshot | null = null;

  function level(): number {
    return Math.floor(eaten / FOOD_PER_LEVEL) + 1;
  }

  function stepMs(): number {
    return Math.max(MIN_STEP_MS, BASE_STEP_MS / SPEED_FACTOR ** (level() - 1));
  }

  // ── Sonido ─────────────────────────────────────────────────────────────────
  let audio: AudioContext | null = null;

  /**
   * El contexto se crea en el primer sonido que de verdad haya que emitir.
   * Crearlo al montar lo deja «suspended» hasta que el jugador toca algo, y el
   * navegador lo apunta en la consola de cada partida.
   */
  function audioContext(): AudioContext | null {
    if (muted || paused || destroyed) return null;
    if (!audio) {
      try {
        audio = new AudioContext();
      } catch {
        // Sin WebAudio el juego se juega igual, solo que en silencio.
        return null;
      }
    }
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    return audio;
  }

  function closeAudio() {
    if (!audio) return;
    const closing = audio;
    audio = null;
    void closing.close().catch(() => {});
  }

  /** Una nota corta: oscilador, envolvente y a la basura. */
  function tone(type: OscillatorType, from: number, to: number, ms: number, gain: number) {
    const ac = audioContext();
    if (!ac) return;

    const osc = ac.createOscillator();
    const amp = ac.createGain();
    const now = ac.currentTime;
    const seconds = ms / 1000;

    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, now + seconds);

    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

    osc.connect(amp).connect(ac.destination);
    osc.start(now);
    osc.stop(now + seconds);
  }

  const soundEat = () => tone("square", 660, 660, 60, 0.08);
  const soundCrash = () => tone("sawtooth", 200, 60, 300, 0.11);

  function soundLevelUp() {
    tone("square", 660, 660, 90, 0.07);
    const ac = audio;
    if (!ac) return;
    // La segunda nota se programa a mano sobre el mismo reloj: encadenarla con
    // un setTimeout la dejaría sonando después de un `destroy`.
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    const start = ac.currentTime + 0.09;
    osc.type = "square";
    osc.frequency.setValueAtTime(990, start);
    amp.gain.setValueAtTime(0.07, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    osc.connect(amp).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.09);
  }

  // ── Tablero ────────────────────────────────────────────────────────────────
  function occupies(cell: Cell): boolean {
    return snake.some((part) => part.x === cell.x && part.y === cell.y);
  }

  /**
   * Sortea sobre la lista de celdas libres. Devuelve `null` cuando no queda
   * ninguna, que es la victoria: no hay dónde poner comida y la partida acaba.
   */
  function findFood(): Cell | null {
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupies({ x, y })) free.push({ x, y });
      }
    }
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  /** Víbora corta en el centro, mirando a la derecha y parada. */
  function spawn() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [];
    for (let i = 0; i < START_LENGTH; i++) snake.push({ x: cx - i, y: cy });
    dir = "right";
    queued = [];
    waiting = true;
    dead = false;
    deathElapsed = 0;
    // Sin esto, el resto de paso que quedó a medias al morir se gastaría en
    // cuanto el jugador lance a la víbora nueva.
    accumulator = 0;
  }

  function placeFood() {
    const next = findFood();
    if (next === null) {
      gameOver();
      return;
    }
    food = next;
  }

  function initGame() {
    score = 0;
    lives = LIVES;
    eaten = 0;
    state = "playing";
    accumulator = 0;
    spawn();
    placeFood();
  }

  function gameOver() {
    if (state === "gameover") return;
    state = "gameover";
    dead = false;
    emit();
    onGameOver(score);
  }

  /** Avisa al HUD solo cuando algo cambia de verdad, nunca por fotograma. */
  function emit() {
    const status: GameStatus = state === "gameover" ? "gameover" : paused ? "paused" : "playing";
    const next: GameSnapshot = { score, lives, level: level(), status };

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
   * Encola un giro validándolo contra el **último de la cola**, no contra la
   * dirección pintada. Es lo que hace que `↑ →` salga como esquina cerrada y
   * que `↑ ↓` yendo a la derecha no sea media vuelta.
   */
  function enqueue(next: Dir) {
    if (state !== "playing" || paused || dead) return;

    const from = queued.length > 0 ? queued[queued.length - 1] : dir;

    // Seguir recto no es un giro que encolar, pero sí es una orden válida: es
    // la que lanza a la víbora parada, y `→` es la flecha que pulsa cualquiera
    // cuando la ve mirando a la derecha.
    if (next === from) {
      waiting = false;
      return;
    }

    // Media vuelta, ni parada ni en marcha: el cuerpo está justo ahí detrás.
    if (next === OPPOSITE[from]) return;
    if (queued.length >= MAX_QUEUED_TURNS) return;

    queued.push(next);
    // La primera orden después de reaparecer es la que lanza a la víbora.
    waiting = false;
  }

  const KEYS: Record<string, Dir> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextTarget(e.target)) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    const next = KEYS[e.code];
    if (next) enqueue(next);
  };

  // No hay `keyup`: en un juego de rejilla no existe «mantener la dirección»,
  // la víbora ya va sola.
  window.addEventListener("keydown", onKeyDown, { passive: false });

  // ── Update ─────────────────────────────────────────────────────────────────
  function die() {
    lives--;
    soundCrash();
    if (lives <= 0) {
      lives = 0;
      emit();
      gameOver();
      return;
    }
    dead = true;
    deathElapsed = 0;
    emit();
  }

  /** Un paso de rejilla. */
  function step() {
    const turn = queued.shift();
    if (turn) dir = turn;

    const delta = STEPS[dir];
    const head: Cell = { x: snake[0].x + delta.x, y: snake[0].y + delta.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      die();
      return;
    }

    // Sin la cola: se va en este mismo paso, así que perseguirla es legal.
    const body = snake.slice(0, snake.length - 1);
    if (body.some((part) => part.x === head.x && part.y === head.y)) {
      die();
      return;
    }

    const ate = head.x === food.x && head.y === food.y;
    snake.unshift(head);
    if (!ate) {
      snake.pop();
      return;
    }

    // Se puntúa con el nivel del momento del bocado, antes de que este mismo
    // bocado lo suba.
    const before = level();
    score += POINTS_PER_FOOD * before;
    eaten++;
    if (level() > before) soundLevelUp();
    else soundEat();
    placeFood();
  }

  function update(dt: number) {
    if (state !== "playing") return;

    if (dead) {
      deathElapsed += dt * 1000;
      if (deathElapsed >= DEATH_MS) {
        spawn();
        // La comida se queda donde estaba, salvo que caiga sobre la víbora
        // nueva: entonces estorba y se recoloca.
        if (occupies(food)) placeFood();
      }
      return;
    }

    if (waiting) return;

    accumulator += dt * 1000;
    const interval = stepMs();
    while (accumulator >= interval && state === "playing" && !dead) {
      accumulator -= interval;
      step();
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
    }
    ctx.stroke();
  }

  function drawFood() {
    // Late entre 0,8 y 1,0 para que se encuentre sin buscarla.
    const pulse = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(elapsed / 140));
    const size = (CELL - 4) * pulse;
    const x = food.x * CELL + (CELL - size) / 2;
    const y = food.y * CELL + (CELL - size) / 2;

    ctx.shadowColor = "rgba(255, 0, 110, 0.8)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = FOOD;
    ctx.fillRect(x, y, size, size);
    ctx.shadowBlur = 0;
  }

  function drawSnake() {
    // Durante el segundo de muerte el cuerpo entero parpadea a 8 Hz.
    const blinking = dead && Math.floor(deathElapsed / 62.5) % 2 === 0;
    if (dead && !blinking) return;

    ctx.shadowColor = dead ? "rgba(255, 56, 96, 0.7)" : "rgba(0, 255, 136, 0.6)";
    ctx.shadowBlur = 12;

    for (let i = snake.length - 1; i >= 0; i--) {
      const part = snake[i];
      const x = part.x * CELL + 1;
      const y = part.y * CELL + 1;
      const size = CELL - 2;

      if (dead) {
        ctx.fillStyle = DEAD_BODY;
      } else if (i === 0) {
        ctx.fillStyle = HEAD;
      } else {
        // El brillo baja de la cabeza a la cola, para que se lea por dónde va.
        const fade = 1 - Math.min(i / Math.max(snake.length, 12), 0.62);
        ctx.globalAlpha = 0.38 + 0.62 * fade;
        ctx.fillStyle = BODY;
      }

      ctx.fillRect(x, y, size, size);
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;

    // Un borde en la cabeza: sin él, a velocidad alta los dos extremos se
    // confunden.
    if (!dead && snake.length > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(snake[0].x * CELL + 2, snake[0].y * CELL + 2, CELL - 4, CELL - 4);
    }
  }

  function draw() {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawFood();
    drawSnake();
  }

  // ── Bucle principal ────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    elapsed += dt * 1000;

    // En pausa se sigue dibujando —la escena congelada se ve bajo el cartel—
    // pero no se simula.
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
      // El acumulador se vacía: si no, una pausa larga dispara media docena de
      // pasos de golpe y la víbora se teletransporta contra una pared.
      accumulator = 0;
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
      // Solo el flanco de bajada: mantener el botón pulsado no encola más
      // giros, porque en un juego de rejilla no hay dirección que sostener.
      if (!active) return;
      if (action === "left") enqueue("left");
      if (action === "right") enqueue("right");
      if (action === "thrust") enqueue("up");
      if (action === "down") enqueue("down");
    },

    setMuted(next) {
      muted = next;
      // Callar de verdad y en el acto: una nota ya programada seguiría sonando.
      if (muted) closeAudio();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      window.removeEventListener("keydown", onKeyDown);
      closeAudio();
    },
  };
}
