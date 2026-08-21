import { Landing } from "@/components/landing";
import { listGames } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const games = await listGames();
  return <Landing games={games} />;
}
