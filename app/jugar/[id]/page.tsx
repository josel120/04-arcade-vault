import { notFound } from "next/navigation";

import { GamePlayer } from "@/components/game-player";
import { getGame } from "@/lib/catalog";

export default async function GamePlayerPage(props: PageProps<"/jugar/[id]">) {
  const { id } = await props.params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
