"use server";

import { isKnownGame, MAX_SCORE } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";

export type SaveScoreInput = {
  gameId: string;
  score: number;
};

export type SaveScoreResult =
  { ok: true } | { ok: false; reason: "auth" | "validation" | "config" | "db" };

/**
 * Guarda la puntuación de una partida terminada.
 *
 * El cliente manda el juego y el número, nunca de quién es la puntuación: el
 * `user_id` sale de la sesión del servidor. Un Server Action se alcanza por
 * POST directo sin pasar por el juego, así que aquí no se da nada por bueno.
 *
 * Lo que esto **no** es: un anti-trampas. Nada impide llamar a esta función con
 * una puntuación verosímil e inventada. Las validaciones filtran lo absurdo.
 */
export async function saveScore({ gameId, score }: SaveScoreInput): Promise<SaveScoreResult> {
  if (!isKnownGame(gameId)) {
    return { ok: false, reason: "validation" };
  }

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

  // `getUser` valida el token contra Supabase; `getSession` se fiaría de la
  // cookie sin comprobarla.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "auth" };
  }

  const { error } = await supabase.from("scores").insert({
    user_id: user.id,
    game_id: gameId,
    score,
  });

  if (error) {
    console.error("[marcador] No se pudo guardar la puntuación:", error);
    return { ok: false, reason: "db" };
  }

  return { ok: true };
}
