"use server";

import { revalidatePath } from "next/cache";

import { getGame } from "@/lib/catalog";
import { MAX_SCORE } from "@/lib/games";
import { personalBest, playerStanding } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

export type SaveScoreInput = {
  gameId: string;
  score: number;
};

export type SaveScoreResult =
  | {
      ok: true;
      /** Puesto del jugador en el marcador del juego, tras guardar. 0 si no se pudo calcular. */
      rank: number;
      /** Cuántos jugadores tienen marca en ese juego. 0 si no se pudo calcular. */
      players: number;
      /** True si esta partida ha superado su mejor marca anterior. */
      isRecord: boolean;
    }
  | { ok: false; reason: "auth" | "validation" | "config" | "db" };

/**
 * Guarda la puntuación de una partida terminada y devuelve el puesto que deja.
 *
 * El cliente manda el juego y el número, nunca de quién es la puntuación: el
 * `user_id` sale de la sesión del servidor. Un Server Action se alcanza por
 * POST directo sin pasar por el juego, así que aquí no se da nada por bueno.
 *
 * Lo que esto **no** es: un anti-trampas. Nada impide llamar a esta función con
 * una puntuación verosímil e inventada. Las validaciones filtran lo absurdo.
 */
export async function saveScore({ gameId, score }: SaveScoreInput): Promise<SaveScoreResult> {
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, reason: "validation" };
  }

  // Devuelve null si faltan las variables de entorno. La app sigue sirviéndose
  // y el juego sigue siendo jugable; lo único que no funciona es el marcador.
  const supabase = await createClient();
  if (!supabase) {
    console.error(
      "[marcador] Faltan variables de entorno: revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
    return { ok: false, reason: "config" };
  }

  // El juego se comprueba contra el catálogo. La clave foránea de `scores` lo
  // impediría igualmente, pero así el fallo llega como `validation` con mensaje
  // claro en vez de como un error opaco de Postgres.
  const game = await getGame(gameId);
  if (!game) {
    return { ok: false, reason: "validation" };
  }

  // `getUser` valida el token contra Supabase; `getSession` se fiaría de la
  // cookie sin comprobarla.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "auth" };
  }

  // Antes de insertar: si no se lee ahora, después es imposible distinguir el
  // récord nuevo del que ya había.
  const previousBest = await personalBest(gameId, user.id);

  const { error } = await supabase.from("scores").insert({
    user_id: user.id,
    game_id: gameId,
    score,
  });

  if (error) {
    console.error("[marcador] No se pudo guardar la puntuación:", error);
    return { ok: false, reason: "db" };
  }

  // A partir de aquí la fila ya está en la base. Nada de lo que siga puede
  // convertir esto en un fallo: decir «no se ha guardado» de algo que sí se
  // guardó sería el peor error posible en esta pantalla.
  revalidatePath("/salon");
  revalidatePath(`/juego/${gameId}`);
  revalidatePath("/games");
  revalidatePath("/");

  const standing = await playerStanding(gameId, user.id);

  return {
    ok: true,
    rank: standing?.rank ?? 0,
    players: standing?.players ?? 0,
    isRecord: previousBest === null || score > previousBest,
  };
}
