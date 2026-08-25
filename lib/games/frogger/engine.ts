/**
 * FROGGER — spec de game jam, `specs/game-jam/frogger/`.
 *
 * Como VÍBORA (SPEC 10), no hay original que portar: cada número de este
 * fichero es una decisión del spec, no una copia. Las tres piezas que no son
 * evidentes leyendo el código:
 *
 * - **`bestRow` solo se reinicia al empezar la ronda**, nunca al perder una
 *   vida ni al volver a cruzar tras ocupar una meta. Es la lectura literal de
 *   "avance por primera vez en la ronda" del spec: la primera travesía de
 *   cada ronda puntúa fila a fila, y cualquier travesía posterior de esa
 *   misma ronda ya no encuentra filas nuevas que puntuar, exactamente como
 *   "el nivel no baja al perder una vida" en VÍBORA.
 * - **La rana es invulnerable durante la animación de salto.** Los choques y
 *   el soporte del río solo se comprueban con la rana aterrizada
 *   (`frog.jumping === false`), igual que en el Frogger original: es en el
 *   aire donde el jugador decide, no donde el juego lo castiga.
 * - **El soporte del río se resuelve con solapamiento de rango
 *   (`overlaps`), no con una celda entera.** `frog.col` es un entero mientras
 *   la rana está de pie y una coordenada continua mientras viaja sobre un
 *   tronco o una tortuga; la misma comprobación sirve para las dos, porque
 *   compara rangos `[frog.col, frog.col + 1)` contra `[entity.col, entity.col
 *   + entity.widthCells)` en vez de igualdad de celda.
 *
 * El sonido se sintetiza con WebAudio, con el mismo contrato que VÍBORA: el
 * `AudioContext` se crea perezosamente y se cierra en `destroy`.
 */

import {
  GAME_KEYS,
  isTextTarget,
  type CreateEngineOptions,
  type GameEngine,
  type GameSnapshot,
  type GameStatus,
} from "@/lib/games/engine";
import { PALETTES } from "@/lib/games/frogger/skins";

const W = 800;
const H = 600;

const CELL = 40;
const COLS = W / CELL; // 20

const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START_TOP = 13;
const ROW_START_BOT = 14;

const START_COL = 9;
const GOAL_COUNT = 5;
const GOAL_WIDTH = 4; // 20 columnas / 5 metas, sin resto

const JUMP_MS = 120;
const LIVES = 3;
/** Lo que la rana muerta se queda a la vista, parpadeando. Igual que VÍBORA. */
const DEATH_MS = 1000;

const ROUND_TIME_S = 20;
const TIME_STEP_S = 1;
const TIME_MIN_S = 10;

const POINTS_ADVANCE = 10;
const POINTS_GOAL = 50;
const POINTS_ROUND = 200;
const TIME_BONUS_PER_SEC = 10;

/** +15 % de velocidad de entidades por nivel. */
const SPEED_FACTOR = 1.15;
const ROAD_SPEED_MIN = 90;
const ROAD_SPEED_MAX = 220;
const RIVER_SPEED_MIN = 60;
const RIVER_SPEED_MAX = 180;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;

/** `#rrggbb` a `rgba(...)`, para los `shadowColor` de brillo por piel. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Dir = "up" | "down" | "left" | "right";
type EntityKind = "car" | "truck" | "log" | "turtle";

type Entity = {
  /** Coordenada continua en celdas, no entera: ver el comentario de cabecera. */
  col: number;
  widthCells: number;
  kind: EntityKind;
  submerged?: boolean;
  cyclePhaseMs?: number;
};

type Lane = {
  row: number;
  /** px/s, con signo: positivo va a la derecha, negativo a la izquierda. */
  speed: number;
  entities: Entity[];
};

type Frog = {
  col: number;
  row: number;
  jumping: boolean;
  jumpT: number;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  onRaft: boolean;
};

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function isRoadRow(row: number): boolean {
  return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
}

function isRiverRow(row: number): boolean {
  return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
}

function roundTimeForLevel(level: number): number {
  return Math.max(TIME_MIN_S, ROUND_TIME_S - TIME_STEP_S * (level - 1));
}

/** Coloca entidades espaciadas por un periodo fijo, con hueco atravesable entre ellas. */
function spawnLaneEntities(
  kind: EntityKind,
  widthCells: number,
  gapCells: number,
  submergible: boolean,
): Entity[] {
  const period = widthCells + gapCells;
  const count = Math.ceil((COLS + widthCells * 2) / period) + 1;
  const offset = Math.random() * period;
  const entities: Entity[] = [];
  for (let i = 0; i < count; i++) {
    entities.push({
      col: -widthCells + offset + i * period,
      widthCells,
      kind,
      submerged: submergible ? false : undefined,
      cyclePhaseMs: submergible
        ? Math.random() * (TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS)
        : undefined,
    });
  }
  return entities;
}

function buildLanes(level: number): Lane[] {
  const speedMul = SPEED_FACTOR ** (level - 1);
  const lanes: Lane[] = [];

  for (let i = 0; i < 5; i++) {
    const row = ROW_ROAD_TOP + i;
    const dir = i % 2 === 0 ? 1 : -1;
    const base = ROAD_SPEED_MIN + ((ROAD_SPEED_MAX - ROAD_SPEED_MIN) * i) / 4;
    const isTruck = i % 3 === 2;
    lanes.push({
      row,
      speed: dir * base * speedMul,
      entities: spawnLaneEntities(isTruck ? "truck" : "car", isTruck ? 3 : 1 + (i % 2), 3, false),
    });
  }

  for (let i = 0; i < 6; i++) {
    const row = ROW_RIVER_TOP + i;
    const dir = i % 2 === 0 ? -1 : 1;
    const base = RIVER_SPEED_MIN + ((RIVER_SPEED_MAX - RIVER_SPEED_MIN) * i) / 5;
    const isTurtle = i % 2 === 1;
    lanes.push({
      row,
      speed: dir * base * speedMul,
      entities: spawnLaneEntities(
        isTurtle ? "turtle" : "log",
        isTurtle ? 3 : 2 + (i % 3),
        3,
        isTurtle,
      ),
    });
  }

  return lanes;
}

export function createEngine({
  canvas,
  onSnapshot,
  onGameOver,
  skin,
}: CreateEngineOptions): GameEngine {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas.");
  // Las funciones de este ámbito están hoisted, así que el estrechamiento del
  // `if` no llega hasta ellas. Esta constante ya nace sin `null`.
  const ctx: CanvasRenderingContext2D = context;

  // ── Estado ─────────────────────────────────────────────────────────────────
  // Todo por instancia: un global de módulo compartiría rana entre los dos
  // montajes del doble render de React Strict Mode.
  // `draw()` lee esta variable en cada fotograma, así que `setSkin` la
  // reemplaza sin reiniciar la partida.
  let palette = PALETTES[skin];
  let lanes: Lane[] = [];
  let goalsFilled: boolean[] = new Array(GOAL_COUNT).fill(false);
  const frog: Frog = {
    col: START_COL,
    row: ROW_START_BOT,
    jumping: false,
    jumpT: 0,
    fromCol: START_COL,
    fromRow: ROW_START_BOT,
    toCol: START_COL,
    toRow: ROW_START_BOT,
    onRaft: false,
  };

  let score = 0;
  let lives = LIVES;
  let level = 1;
  let roundTimeLeft = ROUND_TIME_S;
  /** Fila más alta alcanzada (la más baja en número) en la ronda actual. */
  let bestRow = ROW_START_BOT;
  let state: "playing" | "gameover" = "playing";

  let dead = false;
  let deathElapsed = 0;

  let paused = false;
  let destroyed = false;
  let muted = false;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let last: GameSnapshot | null = null;

  // ── Sonido ─────────────────────────────────────────────────────────────────
  let audio: AudioContext | null = null;

  function audioContext(): AudioContext | null {
    if (muted || paused || destroyed) return null;
    if (!audio) {
      try {
        audio = new AudioContext();
      } catch {
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

  const soundJump = () => tone("square", 520, 520, 40, 0.06);
  const soundCrash = () => tone("sawtooth", 220, 50, 250, 0.11);

  function soundGoal() {
    tone("square", 660, 660, 80, 0.08);
    const ac = audio;
    if (!ac) return;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    const start = ac.currentTime + 0.08;
    osc.type = "square";
    osc.frequency.setValueAtTime(990, start);
    amp.gain.setValueAtTime(0.08, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    osc.connect(amp).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.08);
  }

  function soundRoundComplete() {
    const ac = audioContext();
    if (!ac) return;
    const notes = [660, 880, 1320];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      const start = ac.currentTime + i * 0.1;
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, start);
      amp.gain.setValueAtTime(0.08, start);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      osc.connect(amp).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.1);
    });
  }

  // ── Tablero ────────────────────────────────────────────────────────────────
  function laneAt(row: number): Lane | undefined {
    return lanes.find((lane) => lane.row === row);
  }

  function overlaps(entity: Entity): boolean {
    return frog.col < entity.col + entity.widthCells && frog.col + 1 > entity.col;
  }

  function checkRoadCollision(): boolean {
    const lane = laneAt(frog.row);
    if (!lane) return false;
    return lane.entities.some(overlaps);
  }

  function getSupport(): Entity | null {
    const lane = laneAt(frog.row);
    if (!lane) return null;
    const found = lane.entities.find(overlaps);
    if (!found) return null;
    if (found.kind === "turtle" && found.submerged) return null;
    return found;
  }

  function respawnAtStart() {
    frog.col = START_COL;
    frog.row = ROW_START_BOT;
    frog.jumping = false;
    frog.onRaft = false;
  }

  function initGame() {
    score = 0;
    lives = LIVES;
    level = 1;
    state = "playing";
    dead = false;
    deathElapsed = 0;
    goalsFilled = new Array(GOAL_COUNT).fill(false);
    bestRow = ROW_START_BOT;
    roundTimeLeft = roundTimeForLevel(1);
    lanes = buildLanes(1);
    respawnAtStart();
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

  function killFrog() {
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

  function respawnAfterLoss() {
    dead = false;
    deathElapsed = 0;
    // El reloj se reinicia en cada reaparición, no solo al empezar la ronda:
    // si la causa de la muerte fue agotar el propio temporizador, dejarlo en
    // 0 dispararía la misma muerte en el primer fotograma tras reaparecer,
    // encadenando las tres vidas en segundos sin que el jugador pueda hacer
    // nada. Cada vida es, en la práctica, su propio intento cronometrado.
    roundTimeLeft = roundTimeForLevel(level);
    respawnAtStart();
  }

  function completeRound() {
    level++;
    goalsFilled = new Array(GOAL_COUNT).fill(false);
    bestRow = ROW_START_BOT;
    roundTimeLeft = roundTimeForLevel(level);
    lanes = buildLanes(level);
    score += POINTS_ROUND;
    respawnAtStart();
    soundRoundComplete();
    emit();
  }

  function resolveGoal() {
    const index = Math.floor(frog.col / GOAL_WIDTH);
    if (index < 0 || index >= GOAL_COUNT || goalsFilled[index]) {
      killFrog();
      return;
    }
    goalsFilled[index] = true;
    score += POINTS_GOAL + Math.floor(roundTimeLeft) * TIME_BONUS_PER_SEC;
    soundGoal();
    emit();
    if (goalsFilled.every(Boolean)) {
      completeRound();
    } else {
      respawnAtStart();
    }
  }

  function completeJump() {
    frog.jumping = false;
    frog.col = frog.toCol;
    frog.row = frog.toRow;
    frog.onRaft = false;

    if (frog.row < bestRow) {
      score += POINTS_ADVANCE;
      bestRow = frog.row;
    }

    if (frog.row === ROW_GOALS) {
      resolveGoal();
    } else if (isRiverRow(frog.row)) {
      if (!getSupport()) {
        killFrog();
        return;
      }
      frog.onRaft = true;
    } else if (isRoadRow(frog.row) && checkRoadCollision()) {
      killFrog();
    }
  }

  // ── Entrada ────────────────────────────────────────────────────────────────
  function tryJump(dir: Dir) {
    if (state !== "playing" || paused || dead || frog.jumping) return;

    const fromCol = Math.round(frog.col);
    const fromRow = frog.row;
    let toCol = fromCol;
    let toRow = fromRow;
    if (dir === "up") toRow = fromRow - 1;
    else if (dir === "down") toRow = fromRow + 1;
    else if (dir === "left") toCol = fromCol - 1;
    else toCol = fromCol + 1;

    if (toCol < 0 || toCol >= COLS) return;
    if (toRow < ROW_GOALS || toRow > ROW_START_BOT) return;

    frog.jumping = true;
    frog.jumpT = 0;
    frog.fromCol = fromCol;
    frog.fromRow = fromRow;
    frog.toCol = toCol;
    frog.toRow = toRow;
    frog.onRaft = false;
    soundJump();
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextTarget(e.target)) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    const dir = KEY_DIRS[e.code];
    if (dir) tryJump(dir);
  };

  // No hay `keyup`: cada pulsación es un salto puntual, no un rumbo que se
  // mantenga.
  window.addEventListener("keydown", onKeyDown, { passive: false });

  // ── Update ─────────────────────────────────────────────────────────────────
  function updateLanes(dt: number) {
    for (const lane of lanes) {
      const deltaCells = (lane.speed * dt) / CELL;
      for (const entity of lane.entities) {
        entity.col += deltaCells;
        if (lane.speed > 0 && entity.col > COLS) {
          entity.col = -entity.widthCells;
        } else if (lane.speed < 0 && entity.col + entity.widthCells < 0) {
          entity.col = COLS;
        }
        if (entity.kind === "turtle") {
          entity.cyclePhaseMs = (entity.cyclePhaseMs ?? 0) + dt * 1000;
          const total = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
          entity.submerged = entity.cyclePhaseMs % total >= TURTLE_VISIBLE_MS;
        }
      }
    }
  }

  function update(dt: number) {
    if (state !== "playing") return;

    if (dead) {
      deathElapsed += dt * 1000;
      if (deathElapsed >= DEATH_MS) respawnAfterLoss();
      return;
    }

    updateLanes(dt);

    if (frog.jumping) {
      frog.jumpT += dt * 1000;
      if (frog.jumpT >= JUMP_MS) completeJump();
    } else if (frog.onRaft) {
      const lane = laneAt(frog.row);
      if (lane) frog.col += (lane.speed * dt) / CELL;
      if (frog.col < 0 || frog.col > COLS - 1) {
        killFrog();
        return;
      }
      if (!getSupport()) {
        killFrog();
        return;
      }
    } else if (isRoadRow(frog.row) && checkRoadCollision()) {
      killFrog();
      return;
    }

    if (state !== "playing" || dead) return;

    roundTimeLeft -= dt;
    if (roundTimeLeft <= 0) {
      roundTimeLeft = 0;
      killFrog();
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawZones() {
    // Relleno base defensivo: las cinco bandas de abajo ya cubren el lienzo
    // entero (15 filas de CELL = H), pero si algún cálculo de fila queda
    // corto es mejor un fondo oscuro que un cuadro sin pintar.
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = palette.goalBg;
    ctx.fillRect(0, ROW_GOALS * CELL, W, CELL);
    ctx.fillStyle = palette.riverBg;
    ctx.fillRect(0, ROW_RIVER_TOP * CELL, W, (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL);
    ctx.fillStyle = palette.safeBg;
    ctx.fillRect(0, ROW_SAFE_MID * CELL, W, CELL);
    ctx.fillStyle = palette.roadBg;
    ctx.fillRect(0, ROW_ROAD_TOP * CELL, W, (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL);
    ctx.fillStyle = palette.safeBg;
    ctx.fillRect(0, ROW_START_TOP * CELL, W, (ROW_START_BOT - ROW_START_TOP + 1) * CELL);
  }

  function drawGoals() {
    for (let i = 0; i < GOAL_COUNT; i++) {
      const x = i * GOAL_WIDTH * CELL;
      const y = ROW_GOALS * CELL;
      const w = GOAL_WIDTH * CELL;
      ctx.strokeStyle = palette.yellow;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, w - 6, CELL - 6);
      if (goalsFilled[i]) {
        ctx.shadowColor = withAlpha(palette.magenta, 0.7);
        ctx.shadowBlur = 10;
        ctx.fillStyle = palette.magenta;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + CELL / 2, CELL * 0.28, CELL * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawEntity(lane: Lane, entity: Entity) {
    const x = entity.col * CELL;
    const y = lane.row * CELL;
    const w = entity.widthCells * CELL;
    const h = CELL;

    if (entity.kind === "car" || entity.kind === "truck") {
      const carColor = lane.speed > 0 ? palette.cyan : palette.yellow;
      const color = entity.kind === "truck" ? palette.truckColor : carColor;
      ctx.fillStyle = color;
      ctx.shadowColor = withAlpha(color, 0.5);
      ctx.shadowBlur = 8;
      ctx.fillRect(x + 3, y + 6, w - 6, h - 14);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#05060f";
      ctx.beginPath();
      ctx.arc(x + 8, y + h - 8, 5, 0, Math.PI * 2);
      ctx.arc(x + w - 8, y + h - 8, 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (entity.kind === "log") {
      ctx.fillStyle = palette.logColor;
      ctx.fillRect(x + 2, y + 8, w - 4, h - 16);
      ctx.strokeStyle = palette.logDark;
      ctx.lineWidth = 2;
      for (let lx = x + 10; lx < x + w - 6; lx += 12) {
        ctx.beginPath();
        ctx.moveTo(lx, y + 9);
        ctx.lineTo(lx, y + h - 9);
        ctx.stroke();
      }
      return;
    }

    // turtle
    ctx.globalAlpha = entity.submerged ? 0.3 : 1;
    ctx.fillStyle = palette.green;
    ctx.shadowColor = withAlpha(palette.green, 0.5);
    ctx.shadowBlur = entity.submerged ? 0 : 8;
    for (let i = 0; i < entity.widthCells; i++) {
      ctx.beginPath();
      ctx.ellipse(x + i * CELL + CELL / 2, y + h / 2, CELL * 0.34, CELL * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function frogDrawPos(): { x: number; y: number; hop: number } {
    if (frog.jumping) {
      const t = Math.min(frog.jumpT / JUMP_MS, 1);
      const col = frog.fromCol + (frog.toCol - frog.fromCol) * t;
      const row = frog.fromRow + (frog.toRow - frog.fromRow) * t;
      return { x: col * CELL, y: row * CELL, hop: Math.sin(t * Math.PI) * (CELL * 0.35) };
    }
    return { x: frog.col * CELL, y: frog.row * CELL, hop: 0 };
  }

  function drawFrog() {
    const blinking = dead && Math.floor(deathElapsed / 62.5) % 2 === 0;
    if (dead && !blinking) return;

    const { x, y, hop } = frogDrawPos();
    const cx = x + CELL / 2;
    const cy = y + CELL / 2 - hop;

    ctx.shadowColor = withAlpha(dead ? palette.deadColor : palette.magenta, 0.7);
    ctx.shadowBlur = 12;
    ctx.fillStyle = dead ? palette.deadColor : palette.magenta;
    ctx.beginPath();
    ctx.ellipse(cx, cy, CELL * 0.32, CELL * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (!dead) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - 7, cy - 8, 3.5, 0, Math.PI * 2);
      ctx.arc(cx + 7, cy - 8, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#05060f";
      ctx.beginPath();
      ctx.arc(cx - 7, cy - 8, 1.6, 0, Math.PI * 2);
      ctx.arc(cx + 7, cy - 8, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    drawZones();
    drawGoals();
    for (const lane of lanes) {
      for (const entity of lane.entities) drawEntity(lane, entity);
    }
    drawFrog();
  }

  // ── Bucle principal ────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

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
      // El reloj de la partida usa `lastTime`, no un acumulador propio, así
      // que no hace falta descontar nada al reanudar.
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
      // Solo el flanco de pulsación: mantener el botón pulsado no repite el
      // salto, porque cada pulsación es un salto puntual, no un rumbo.
      if (!active) return;
      if (action === "left") tryJump("left");
      if (action === "right") tryJump("right");
      if (action === "thrust") tryJump("up");
      if (action === "down") tryJump("down");
    },

    setMuted(next) {
      muted = next;
      if (muted) closeAudio();
    },

    setSkin(next) {
      palette = PALETTES[next];
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
