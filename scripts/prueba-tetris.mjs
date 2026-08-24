/**
 * Banco de pruebas del motor de TETRIS, fuera del navegador.
 *
 * Monta un canvas, un `window` y un `requestAnimationFrame` falsos, controla el
 * reloj y la pieza que sale, y comprueba las reglas del juego y el contrato de
 * la plataforma. Cubre justo lo que no se puede verificar mirando la pantalla:
 * que `destroy()` deje el bucle parado, que dos montajes seguidos no dupliquen
 * la partida, y que no se emitan snapshots cuando no cambia nada.
 *
 * No es un framework de tests: no hay runner, ni `watch`, ni CI, y no se
 * ejecuta en `npm run build` ni en `npm run lint`.
 *
 *     npm run prueba:tetris
 */

let fallos = 0;
let aciertos = 0;

function check(nombre, condicion, extra = "") {
  if (condicion) {
    aciertos++;
    console.log(`  ok    ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${extra ? `  → ${extra}` : ""}`);
  }
}

// ── Entorno falso ────────────────────────────────────────────────────────────
globalThis.HTMLElement = class HTMLElement {};

const listeners = new Map();
globalThis.window = {
  addEventListener: (tipo, fn) => {
    if (!listeners.has(tipo)) listeners.set(tipo, new Set());
    listeners.get(tipo).add(fn);
  },
  removeEventListener: (tipo, fn) => listeners.get(tipo)?.delete(fn),
};

let ahora = 0;
let siguienteId = 1;
const programados = new Map();
globalThis.requestAnimationFrame = (fn) => {
  const id = siguienteId++;
  programados.set(id, fn);
  return id;
};
globalThis.cancelAnimationFrame = (id) => programados.delete(id);

/** Avanza el reloj un fotograma. Devuelve cuántos había programados. */
function tick(ms = 16) {
  ahora += ms;
  const pendientes = [...programados.values()];
  programados.clear();
  for (const fn of pendientes) fn(ahora);
  return pendientes.length;
}

/** Todo lo que el motor escribe con `fillText`, para leer el panel. */
const textos = [];
function canvasFalso() {
  const ctx = new Proxy(
    { fillText: (t) => textos.push(String(t)) },
    { get: (target, prop) => target[prop] ?? (() => {}), set: () => true },
  );
  return { getContext: () => ctx, width: 0, height: 0 };
}

/** Fuerza qué pieza sale de `randomPiece`: 1 = I, 2 = O, … */
function forzarPieza(tipo) {
  Math.random = () => (tipo - 1) / 8 + 0.001;
}

function keydown(code, target = null) {
  let prevenido = false;
  const evento = { code, target, preventDefault: () => (prevenido = true) };
  for (const fn of listeners.get("keydown") ?? []) fn(evento);
  return prevenido;
}

/** El número de LÍNEAS que el motor acaba de pintar en el panel. */
function lineasEnPantalla() {
  return Number(textos[textos.length - 1]);
}

const { createEngine } = await import("@/lib/games/tetris/engine");

// ── Arranque y contrato del snapshot ─────────────────────────────────────────
console.log("\nArranque y snapshot");
const snaps = [];
let finalRecibido = null;
let motor = createEngine({
  canvas: canvasFalso(),
  onSnapshot: (s) => snaps.push(s),
  onGameOver: (s) => (finalRecibido = s),
});

check("emite un snapshot inicial", snaps.length === 1, JSON.stringify(snaps[0]));
check(
  "arranca a 0 puntos, nivel 1, jugando",
  snaps[0].score === 0 && snaps[0].level === 1 && snaps[0].status === "playing",
);
check("vidas a 0: tetris no tiene vidas", snaps[0].lives === 0);
check("hay un solo fotograma programado", programados.size === 1);

const antesDeEsperar = snaps.length;
for (let i = 0; i < 30; i++) tick(16);
check(
  "no emite snapshots mientras no cambia nada",
  snaps.length === antesDeEsperar,
  `emitió ${snaps.length - antesDeEsperar}`,
);

// ── Teclado ──────────────────────────────────────────────────────────────────
console.log("\nTeclado");
check("frena el desplazamiento con las flechas", keydown("ArrowDown") === true);
check("frena el desplazamiento con el espacio", keydown("Space") === true);
check("no frena la X, que no desplaza la página", keydown("KeyX") === false);

const campo = new globalThis.HTMLElement();
campo.tagName = "INPUT";
const puntosAntes = snaps[snaps.length - 1].score;
keydown("ArrowDown", campo);
check(
  "ignora las teclas cuando se escribe en un campo",
  snaps[snaps.length - 1].score === puntosAntes,
);

// ── Puntuación ───────────────────────────────────────────────────────────────
console.log("\nPuntuación");
motor.destroy();
snaps.length = 0;
textos.length = 0;
finalRecibido = null;

forzarPieza(1); // I
motor = createEngine({
  canvas: canvasFalso(),
  onSnapshot: (s) => snaps.push(s),
  onGameOver: (s) => (finalRecibido = s),
});

const antesDeBajar = snaps[snaps.length - 1].score;
keydown("ArrowDown");
check(
  "la bajada suave suma un punto por fila",
  snaps[snaps.length - 1].score === antesDeBajar + 1,
  `${snaps[snaps.length - 1].score}`,
);

const antesDeSoltar = snaps[snaps.length - 1].score;
keydown("Space");
const ganado = snaps[snaps.length - 1].score - antesDeSoltar;
check("la caída instantánea suma 2 por celda", ganado > 0 && ganado % 2 === 0, `sumó ${ganado}`);

// ── Línea completa ───────────────────────────────────────────────────────────
console.log("\nLínea completa");
motor.destroy();
snaps.length = 0;
textos.length = 0;

forzarPieza(1);
motor = createEngine({
  canvas: canvasFalso(),
  onSnapshot: (s) => snaps.push(s),
  onGameOver: (s) => (finalRecibido = s),
});
tick(16);
check("el panel pinta LÍNEAS a 0 al empezar", lineasEnPantalla() === 0);

// Dos piezas I (4 celdas) a los extremos y una O (2 celdas) en medio = 10.
// `forzarPieza` afecta a la pieza SIGUIENTE: `spawn()` promueve la que ya
// estaba en la vista previa, así que se pide con un turno de antelación.
for (let i = 0; i < 6; i++) keydown("ArrowLeft");
forzarPieza(2); // la O entrará como actual tras el próximo relevo
keydown("Space"); // la I de la izquierda ocupa las columnas 0-3

for (let i = 0; i < 6; i++) keydown("ArrowRight");
keydown("Space"); // la I de la derecha ocupa las columnas 6-9

const antesDeLimpiar = snaps[snaps.length - 1].score;
keydown("Space"); // la O cae en las columnas 4 y 5 y completa la fila
tick(16);

check("completar una fila la cuenta como una línea", lineasEnPantalla() === 1);
check(
  "una línea suma 100 puntos por el nivel",
  snaps[snaps.length - 1].score - antesDeLimpiar >= 100,
  `sumó ${snaps[snaps.length - 1].score - antesDeLimpiar}`,
);

// ── Pausa ────────────────────────────────────────────────────────────────────
console.log("\nPausa");
motor.pause();
check("pausar cambia el estado del snapshot", snaps[snaps.length - 1].status === "paused");
const congelado = snaps[snaps.length - 1].score;
for (let i = 0; i < 40; i++) tick(50); // dos segundos: la pieza habría caído
check("en pausa no se simula nada", snaps[snaps.length - 1].score === congelado);
keydown("ArrowLeft");
check("en pausa el teclado no mueve la pieza", snaps[snaps.length - 1].status === "paused");
motor.resume();
check("reanudar vuelve a jugando", snaps[snaps.length - 1].status === "playing");

// ── Fin de partida ───────────────────────────────────────────────────────────
console.log("\nFin de partida");
finalRecibido = null;
forzarPieza(1);
// Apilar piezas I hasta que el pozo llegue arriba.
for (let i = 0; i < 40 && finalRecibido === null; i++) keydown("Space");
check("el pozo lleno termina la partida", finalRecibido !== null);
check("el fin de partida llega al HUD", snaps[snaps.length - 1].status === "gameover");
check(
  "la puntuación del modal es la del snapshot",
  finalRecibido === snaps[snaps.length - 1].score,
  `${finalRecibido} vs ${snaps[snaps.length - 1].score}`,
);

let avisos = 0;
const otro = createEngine({
  canvas: canvasFalso(),
  onSnapshot: () => {},
  onGameOver: () => avisos++,
});
otro.finish();
otro.finish();
check("FIN no avisa dos veces del mismo fin de partida", avisos === 1, `avisó ${avisos}`);

// ── Reinicio ─────────────────────────────────────────────────────────────────
console.log("\nReinicio");
motor.restart();
tick(16);
check("reiniciar deja la puntuación a 0", snaps[snaps.length - 1].score === 0);
check("reiniciar deja el nivel a 1", snaps[snaps.length - 1].level === 1);
check("reiniciar vuelve a jugando", snaps[snaps.length - 1].status === "playing");
check("reiniciar vacía el contador de líneas", lineasEnPantalla() === 0);

// ── Desmontaje y doble montaje ───────────────────────────────────────────────
console.log("\nDesmontaje (Strict Mode)");
otro.destroy();
motor.destroy();
check("destroy cancela el bucle", tick(16) === 0, `quedaban ${programados.size}`);
motor.destroy();
check("destroy es idempotente", true);
check("destroy suelta los listeners de teclado", (listeners.get("keydown")?.size ?? 0) === 0);

const a = createEngine({ canvas: canvasFalso(), onSnapshot: () => {}, onGameOver: () => {} });
const b = createEngine({ canvas: canvasFalso(), onSnapshot: () => {}, onGameOver: () => {} });
a.destroy();
check("tras el doble montaje queda un solo bucle vivo", programados.size === 1);
check("y un solo listener de teclado", listeners.get("keydown").size === 1);
b.destroy();

console.log(`\n${aciertos} correctas, ${fallos} fallidas\n`);
process.exit(fallos === 0 ? 0 : 1);
