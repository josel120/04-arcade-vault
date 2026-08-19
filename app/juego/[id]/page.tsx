import { notFound } from "next/navigation";

import { GameDetail } from "@/components/game-detail";
import { getGame } from "@/lib/games";
import { seededScores } from "@/lib/scores";

export default async function GameDetailPage(props: PageProps<"/juego/[id]">) {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) notFound();

  // Misma semilla que la maqueta: determinista por juego, 10 filas en el detalle.
  const scores = seededScores(id.length * 17 + 3, 10);

  return <GameDetail game={game} scores={scores} />;
}
