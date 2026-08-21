/**
 * Lectura de marcadores. **Solo servidor.**
 *
 * Todo sale de la vista `public.game_leaderboards`, que ya colapsa el historial
 * de `scores` a la mejor marca de cada jugador y resuelve su alias. Aquí no se
 * agrupa nada: agrupar en TypeScript funcionaría hoy, con un puñado de filas, y
 * dejaría de funcionar sin avisar.
 *
 * Ninguna función lanza. Ante un fallo de consulta o falta de configuración se
 * devuelve un marcador vacío, que es un estado que la interfaz ya sabe pintar;
 * una excepción tumbaría la página entera por un adorno lateral.
 */

import { createClient } from "@/lib/supabase/server";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  score: number;
  /** Formato DD/MM/AAAA, la convención de fechas del proyecto. */
  date: string;
};

/** Puesto de un jugador en un juego, y cuánta gente hay en ese marcador. */
export type Standing = {
  rank: number;
  players: number;
};

/** Marca de tiempo ISO a DD/MM/AAAA. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * Top del juego: una fila por jugador, con su mejor marca, ya numerado.
 *
 * La base devuelve las filas ordenadas, así que el `rank` es la posición. El
 * desempate por `created_at` ascendente hace que, a igual puntuación, vaya
 * delante quien la consiguió antes.
 */
export async function topScores(gameId: string, limit = 12): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("game_leaderboards")
    .select("user_id, username, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.error(`[marcador] No se pudo leer el top de "${gameId}":`, error);
    return [];
  }

  return data
    .filter((row) => row.user_id !== null && row.username !== null)
    .map((row, index) => ({
      rank: index + 1,
      userId: row.user_id as string,
      name: row.username as string,
      score: row.score ?? 0,
      date: formatDate(row.created_at),
    }));
}

/**
 * Puesto de un jugador en el marcador de un juego.
 *
 * Se calcula contando cuántos jugadores tienen mejor marca que la suya, no
 * paginando el top: el puesto 40 sale igual de rápido que el 1.
 *
 * Devuelve `null` si el jugador no tiene marca en ese juego o si algo falla.
 * Quien llama decide qué hacer con eso; en el modal de fin de partida, omitir
 * la línea del puesto.
 */
export async function playerStanding(gameId: string, userId: string): Promise<Standing | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: own, error: ownError } = await supabase
    .from("game_leaderboards")
    .select("score")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownError || !own || own.score === null) {
    if (ownError) console.error(`[marcador] No se pudo leer la marca en "${gameId}":`, ownError);
    return null;
  }

  const [{ count: players }, { count: ahead }] = await Promise.all([
    supabase
      .from("game_leaderboards")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId),
    supabase
      .from("game_leaderboards")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId)
      .gt("score", own.score),
  ]);

  if (players === null || ahead === null) return null;

  return { rank: ahead + 1, players };
}

/**
 * Mejor puntuación de un jugador en un juego, o `null` si no tiene ninguna.
 *
 * Lee `scores` y no la vista porque se usa **antes** de insertar, para saber si
 * la partida que se está guardando es un récord personal.
 */
export async function personalBest(gameId: string, userId: string): Promise<number | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("scores")
    .select("score")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.score;
}
