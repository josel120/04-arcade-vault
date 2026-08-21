import { notFound } from "next/navigation";

import { HallOfFame } from "@/components/hall-of-fame";
import { listGames } from "@/lib/catalog";
import { topScores } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HallOfFamePage(props: PageProps<"/salon">) {
  const { juego } = await props.searchParams;

  const games = await listGames();
  if (games.length === 0) notFound();

  // Sin parámetro se abre en el primer juego del catálogo. Con un parámetro que
  // no existe, 404: una URL compartida que apunta a nada no debe caer en
  // silencio al primer juego, porque quien la abre creería estar viendo otro.
  const requested = typeof juego === "string" ? juego : undefined;
  const active = requested ? games.find((game) => game.id === requested) : games[0];
  if (!active) notFound();

  const rows = await topScores(active.id, 12);

  // Solo las cuentas tienen fila en el marcador; el invitado no.
  const supabase = await createClient();
  const viewerId = supabase ? ((await supabase.auth.getUser()).data.user?.id ?? null) : null;

  return <HallOfFame games={games} active={active} rows={rows} viewerId={viewerId} />;
}
