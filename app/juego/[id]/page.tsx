import { notFound } from "next/navigation";

import { GameDetail } from "@/components/game-detail";
import { getGame } from "@/lib/catalog";
import { topScores } from "@/lib/leaderboard";
import type { ScoreRow } from "@/lib/scores";

export const dynamic = "force-dynamic";

export default async function GameDetailPage(props: PageProps<"/juego/[id]">) {
  const { id } = await props.params;
  const game = await getGame(id);
  if (!game) notFound();

  const rows = await topScores(id, 10);
  const scores: ScoreRow[] = rows.map((row) => ({
    rank: row.rank,
    name: row.name,
    score: row.score,
    date: row.date,
  }));

  return <GameDetail game={game} scores={scores} />;
}
