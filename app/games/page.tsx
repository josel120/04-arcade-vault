import { Library } from "@/components/library";
import { listGames } from "@/lib/catalog";

// `listGames` pasa por `cookies()` a través del cliente de servidor de
// Supabase, así que esta ruta ya es dinámica. Se declara igualmente para que
// la intención —marcador siempre fresco— quede escrita en el fichero.
export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const games = await listGames();
  return <Library games={games} />;
}
