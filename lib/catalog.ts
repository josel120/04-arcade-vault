/**
 * Lectura del catálogo de juegos. **Solo servidor.**
 *
 * No lleva `import "server-only"` porque ese paquete no está instalado y
 * añadirlo no hacía falta: este módulo importa `lib/supabase/server.ts`, que a
 * su vez importa `next/headers`, y Next rechaza en compilación cualquier
 * componente cliente que arrastre eso. La barrera ya existe.
 *
 * La fuente de verdad es `public.games`. Cuando Supabase no está configurado o
 * la consulta falla, se sirve `FALLBACK_GAMES` con estadísticas a cero: la
 * Biblioteca nunca se queda en blanco.
 */

import {
  emptyStats,
  FALLBACK_GAMES,
  type Game,
  type GameCategory,
  type GameColor,
  type GameStats,
  type GameWithStats,
} from "@/lib/games";
import { createClient } from "@/lib/supabase/server";

/**
 * Los tipos generados declaran `cat` y `color` como `string`, porque en la base
 * son `text` con una restricción `check`. Estas dos listas son las que impiden
 * que un valor imposible entre en un tipo estrecho: una fila con categoría o
 * color desconocidos se descarta con aviso en vez de colarse.
 */
const CATEGORIES: readonly string[] = ["ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
const COLORS: readonly string[] = ["cyan", "magenta", "yellow", "green"];

type GameRow = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  sort_order: number;
};

type StatsRow = {
  game_id: string | null;
  best: number | null;
  plays: number | null;
  players: number | null;
};

function toGame(row: GameRow): Game | null {
  if (!CATEGORIES.includes(row.cat) || !COLORS.includes(row.color)) {
    console.warn(
      `[catálogo] El juego "${row.id}" tiene cat="${row.cat}" o color="${row.color}" fuera de los valores conocidos. Se descarta.`,
    );
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as GameCategory,
    cover: row.cover,
    color: row.color as GameColor,
    sortOrder: row.sort_order,
  };
}

function toStats(row: StatsRow): GameStats | null {
  if (!row.game_id) return null;
  return {
    gameId: row.game_id,
    best: row.best ?? 0,
    plays: row.plays ?? 0,
    players: row.players ?? 0,
  };
}

/** El catálogo de respaldo, con todas las cifras a cero. */
function fallback(): GameWithStats[] {
  return [...FALLBACK_GAMES]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((game) => ({ ...game, stats: emptyStats(game.id) }));
}

/**
 * Catálogo completo, ordenado por `sort_order`, con las cifras de `game_stats`
 * ya cruzadas.
 *
 * Son dos consultas y no un `join`: la vista no tiene relación declarada en
 * PostgREST, y cruzar nueve filas en memoria cuesta menos que explicárselo.
 */
export async function listGames(): Promise<GameWithStats[]> {
  const supabase = await createClient();
  if (!supabase) {
    console.warn(
      "[catálogo] Faltan las variables de entorno de Supabase: se sirve el catálogo de respaldo con las cifras a cero.",
    );
    return fallback();
  }

  const [games, stats] = await Promise.all([
    supabase.from("games").select("*").order("sort_order", { ascending: true }),
    supabase.from("game_stats").select("*"),
  ]);

  if (games.error || !games.data) {
    console.error("[catálogo] No se pudo leer public.games:", games.error);
    return fallback();
  }

  // Un fallo en las estadísticas no vacía el catálogo: los juegos se sirven
  // igualmente y las cifras salen a cero.
  if (stats.error) {
    console.error("[catálogo] No se pudo leer public.game_stats:", stats.error);
  }

  const byGame = new Map<string, GameStats>();
  for (const row of stats.data ?? []) {
    const parsed = toStats(row);
    if (parsed) byGame.set(parsed.gameId, parsed);
  }

  return games.data
    .map(toGame)
    .filter((game): game is Game => game !== null)
    .map((game) => ({ ...game, stats: byGame.get(game.id) ?? emptyStats(game.id) }));
}

/** Un juego por su identificador, o `null` si no existe o no está publicado. */
export async function getGame(id: string): Promise<GameWithStats | null> {
  const supabase = await createClient();
  if (!supabase) {
    const game = FALLBACK_GAMES.find((entry) => entry.id === id);
    return game ? { ...game, stats: emptyStats(game.id) } : null;
  }

  const [game, stats] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("game_stats").select("*").eq("game_id", id).maybeSingle(),
  ]);

  if (game.error) {
    console.error(`[catálogo] No se pudo leer el juego "${id}":`, game.error);
    const backup = FALLBACK_GAMES.find((entry) => entry.id === id);
    return backup ? { ...backup, stats: emptyStats(backup.id) } : null;
  }

  if (!game.data) return null;

  const parsed = toGame(game.data);
  if (!parsed) return null;

  const parsedStats = stats.data ? toStats(stats.data) : null;
  return { ...parsed, stats: parsedStats ?? emptyStats(parsed.id) };
}
