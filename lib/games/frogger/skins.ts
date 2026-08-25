/**
 * Paleta de lienzo de FROGGER, por piel.
 *
 * `clasico` es una copia literal de los colores con los que se escribió el
 * motor — no se reinterpreta, se copia — porque esa piel es, por definición,
 * "no cambiar ni un píxel de lo que el juego pinta hoy". `retro` y `neon`
 * reutilizan los mismos hexadecimales que ya redefine `[data-skin]` en
 * `app/globals.css` para `--cyan`/`--magenta`/`--yellow`/`--green`, así que
 * el lienzo y el marco CRT de alrededor citan la misma paleta en vez de dos
 * inventadas por separado.
 */

import type { GameSkin } from "@/lib/games/engine";

export type FroggerPalette = {
  green: string;
  cyan: string;
  magenta: string;
  yellow: string;
  deadColor: string;
  goalBg: string;
  riverBg: string;
  safeBg: string;
  roadBg: string;
  logColor: string;
  logDark: string;
  truckColor: string;
};

export const PALETTES: Record<GameSkin, FroggerPalette> = {
  clasico: {
    green: "#00ff88",
    cyan: "#00f5ff",
    magenta: "#ff006e",
    yellow: "#f5ff00",
    deadColor: "#ff3860",
    goalBg: "#03110b",
    riverBg: "#0a1f2e",
    safeBg: "#0c1512",
    roadBg: "#141420",
    logColor: "#6b4423",
    logDark: "#4a2e17",
    truckColor: "#c9c9d6",
  },
  // Fósforo ámbar envejecido, igual que `[data-skin="retro"]` en globals.css:
  // negro cálido en vez de azulado, acentos quemados, menos brillo.
  retro: {
    green: "#7a9c3f",
    cyan: "#33c2a8",
    magenta: "#d9622b",
    yellow: "#e0a530",
    deadColor: "#c2451f",
    goalBg: "#100e05",
    riverBg: "#0f1310",
    safeBg: "#130f08",
    roadBg: "#180f08",
    logColor: "#7a4a22",
    logDark: "#54330f",
    truckColor: "#cbb99a",
  },
  // Un paso más saturado que CLÁSICO, no otra familia: negro casi puro y más
  // glow, igual que `[data-skin="neon"]`.
  neon: {
    green: "#14ffb0",
    cyan: "#00fff2",
    magenta: "#ff2fd6",
    yellow: "#faff3c",
    deadColor: "#ff2f5d",
    goalBg: "#050a08",
    riverBg: "#05080f",
    safeBg: "#07060c",
    roadBg: "#060608",
    logColor: "#4a2f5c",
    logDark: "#301d3d",
    truckColor: "#cfd0ff",
  },
};
