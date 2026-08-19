"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/session-provider";
import { GAMES, getGame } from "@/lib/games";
import { seededScores, type ScoreRow } from "@/lib/scores";
import { scoresForGame, type SavedScore } from "@/lib/session";

/** Marca de tiempo a DD/MM/AAAA, la convención de fechas del proyecto. */
function formatDate(at: number): string {
  const date = new Date(at);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Clase de medalla para los tres primeros puestos. */
function medalClass(index: number): string {
  if (index === 0) return " top1";
  if (index === 1) return " top2";
  if (index === 2) return " top3";
  return "";
}

export function HallOfFame() {
  const { user } = useSession();
  const [tab, setTab] = useState(GAMES[0].id);
  const [mine, setMine] = useState<SavedScore[]>([]);

  useEffect(() => {
    // localStorage solo existe en cliente: se lee tras montar para que el
    // primer render coincida con el HTML del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(scoresForGame(tab));
  }, [tab]);

  const rows = useMemo<ScoreRow[]>(() => {
    // Misma semilla que la maqueta: determinista por juego, 12 filas.
    const seeded = seededScores(tab.length * 23 + 7, 12);
    const own: ScoreRow[] = mine.map((entry) => ({
      rank: 0,
      name: entry.name,
      score: entry.score,
      date: formatDate(entry.at),
      isYou: true,
    }));

    return [...seeded, ...own]
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [tab, mine]);

  const game = getGame(tab);
  const best = rows.find((row) => row.isYou);

  // Sin marca propia todavía, el resumen conserva los valores simulados de la maqueta.
  const summaryRank = best ? best.rank : Math.floor(8 + (tab.length % 4));
  const summaryScore = best ? best.score : rows[5].score - 2400;
  const summaryDate = best ? best.date : "11/05/2026";

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={"chip" + (tab === entry.id ? " active" : "")}
            onClick={() => setTab(entry.id)}
            aria-pressed={tab === entry.id}
          >
            {entry.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{rows[1].name}</div>
          <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
          <div className="date">{rows[1].date}</div>
        </div>
        <div className="podium-slot gold">
          <div
            className="pixel"
            style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
          >
            CAMPEÓN
          </div>
          <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
            01
          </div>
          <div className="name">{rows[0].name}</div>
          <div className="score" style={{ fontSize: 20 }}>
            {rows[0].score.toLocaleString("es-ES")}
          </div>
          <div className="date">{rows[0].date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{rows[2].name}</div>
          <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
          <div className="date">{rows[2].date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((row, index) => (
          <div
            key={`${row.rank}-${row.name}`}
            className={
              "tr" + medalClass(index) + (row.isYou ? " you" : "")
            }
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="rk">#{String(row.rank).padStart(2, "0")}</div>
            <div className="pl">{row.name}</div>
            <div className="sc">{row.score.toLocaleString("es-ES")}</div>
            <div className="dt">{row.date}</div>
          </div>
        ))}
        {user && (
          <>
            <div className="tr you-label">
              ▸ TU MEJOR MARCA EN {game ? game.title : ""}
            </div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(summaryRank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {user.name}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {summaryScore.toLocaleString("es-ES")}
              </div>
              <div className="dt">{summaryDate}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/">
          VOLVER AL INICIO
        </Link>
      </div>
    </div>
  );
}
