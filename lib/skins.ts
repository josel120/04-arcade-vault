/**
 * Piel elegida para cada juego. A diferencia de `av_muted` (global, un único
 * valor para todo el sitio), la piel es una preferencia por juego: un mismo
 * jugador puede querer RETRO en Serpentina y NEÓN en Rocas. Por eso, y con el
 * mismo precedente que `av_scores` en `lib/session.ts`, se guarda como un
 * único mapa `{ [gameId]: GameSkin }` bajo una sola clave, no una clave por
 * juego.
 *
 * Mismo patrón que `lib/preferences.ts`: `try`/`catch` silencioso —si
 * `localStorage` está lleno o bloqueado, la piel se queda solo en memoria— y
 * se lee siempre después de montar, en un efecto, nunca durante el render.
 */

import type { GameSkin } from "@/lib/games/engine";

export const SKINS_KEY = "av_skins";

const DEFAULT_SKIN: GameSkin = "clasico";

const VALID_SKINS: ReadonlySet<GameSkin> = new Set(["clasico", "retro", "neon"]);

function isGameSkin(value: unknown): value is GameSkin {
  return typeof value === "string" && VALID_SKINS.has(value as GameSkin);
}

function readSkinMap(): Record<string, GameSkin> {
  try {
    const raw = window.localStorage.getItem(SKINS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(([, value]) =>
      isGameSkin(value),
    ) as [string, GameSkin][];
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** Piel del juego `gameId`. `"clasico"` si no hay preferencia guardada o no parsea. */
export function readSkin(gameId: string): GameSkin {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  try {
    return readSkinMap()[gameId] ?? DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function writeSkin(gameId: string, skin: GameSkin): void {
  if (typeof window === "undefined") return;
  try {
    const map = readSkinMap();
    if (skin === DEFAULT_SKIN) {
      // No hace falta guardar el valor por defecto: menos que leer y un mapa
      // que no crece sin límite a medida que el jugador prueba juegos.
      delete map[gameId];
    } else {
      map[gameId] = skin;
    }
    window.localStorage.setItem(SKINS_KEY, JSON.stringify(map));
  } catch {
    // La preferencia dura lo que dure la pestaña.
  }
}
