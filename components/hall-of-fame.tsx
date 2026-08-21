import Link from "next/link";

import { EmptyBoard } from "@/components/leaderboard";
import { LocalScores } from "@/components/local-scores";
import type { GameWithStats } from "@/lib/games";
import type { LeaderboardRow } from "@/lib/leaderboard";

/** Clase de medalla para los tres primeros puestos. */
function medalClass(index: number): string {
  if (index === 0) return " top1";
  if (index === 1) return " top2";
  if (index === 2) return " top3";
  return "";
}

type Props = {
  games: GameWithStats[];
  /** Juego de la pestaña activa. */
  active: GameWithStats;
  rows: LeaderboardRow[];
  /** `auth.users.id` de la sesión, o `null` si es invitado o no hay sesión. */
  viewerId: string | null;
};

/**
 * Salón de la Fama.
 *
 * Es un Server Component: la pestaña activa vive en la URL (`?juego=`) y no en
 * un `useState`, así que un marcador concreto se puede enlazar y compartir, que
 * es media gracia de competir. Hasta el SPEC 06 esto era un componente cliente
 * que mezclaba doce filas inventadas con `localStorage` y, cuando el jugador no
 * tenía marca, se inventaba también su puesto y su fecha.
 */
export function HallOfFame({ games, active, rows, viewerId }: Props) {
  // El podio solo dibuja las plazas que existen. Con la base real, lo normal el
  // primer día es que no haya ninguna.
  const podium = [rows[1], rows[0], rows[2]];
  const podiumClasses = ["podium-slot silver", "podium-slot gold", "podium-slot bronze"];
  const podiumRanks = ["02", "01", "03"];
  const hasPodium = rows.length > 0;

  const own = viewerId ? rows.find((row) => row.userId === viewerId) : undefined;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((game) => (
          <Link
            key={game.id}
            href={`/salon?juego=${game.id}`}
            className={"chip" + (active.id === game.id ? " active" : "")}
            aria-current={active.id === game.id ? "page" : undefined}
          >
            {game.title}
          </Link>
        ))}
      </div>

      {hasPodium && (
        <div className="podium">
          {podium.map((row, index) =>
            row ? (
              <div key={row.userId} className={podiumClasses[index]}>
                {index === 1 && (
                  <div
                    className="pixel"
                    style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
                  >
                    CAMPEÓN
                  </div>
                )}
                <div
                  className="rank-num"
                  style={index === 1 ? { fontSize: 36, marginTop: 4 } : undefined}
                >
                  {podiumRanks[index]}
                </div>
                <div className="name">{row.name}</div>
                <div className="score" style={index === 1 ? { fontSize: 20 } : undefined}>
                  {row.score.toLocaleString("es-ES")}
                </div>
                <div className="date">{row.date}</div>
              </div>
            ) : (
              <div key={podiumRanks[index]} className={podiumClasses[index] + " vacant"}>
                <div className="rank-num">{podiumRanks[index]}</div>
                <div className="name">VACANTE</div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="hall-table">
        {rows.length === 0 ? (
          <EmptyBoard />
        ) : (
          <>
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((row, index) => (
              <div
                key={row.userId}
                className={"tr" + medalClass(index) + (row.userId === viewerId ? " you" : "")}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="rk">#{String(row.rank).padStart(2, "0")}</div>
                <div className="pl">{row.name}</div>
                <div className="sc">{row.score.toLocaleString("es-ES")}</div>
                <div className="dt">{row.date}</div>
              </div>
            ))}
          </>
        )}

        {viewerId && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {active.title}</div>
            {own ? (
              <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
                <div className="rk" style={{ color: "var(--yellow)" }}>
                  #{String(own.rank).padStart(2, "0")}
                </div>
                <div className="pl" style={{ color: "var(--yellow)" }}>
                  {own.name}
                </div>
                <div
                  className="sc"
                  style={{
                    color: "var(--yellow)",
                    textShadow: "0 0 6px rgba(245,255,0,0.5)",
                  }}
                >
                  {own.score.toLocaleString("es-ES")}
                </div>
                <div className="dt">{own.date}</div>
              </div>
            ) : (
              <div className="tr you-none">
                Todavía no has puntuado en {active.title}.{" "}
                <Link href={`/jugar/${active.id}`}>Juega una partida</Link> y aparecerás aquí.
              </div>
            )}
          </>
        )}
      </div>

      <LocalScores gameId={active.id} gameTitle={active.title} />

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/">
          VOLVER AL INICIO
        </Link>
      </div>
    </div>
  );
}
