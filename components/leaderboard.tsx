import type { ScoreRow } from "@/lib/scores";

/** Clase de medalla para los tres primeros puestos: oro, plata y bronce. */
function medalClass(index: number): string {
  if (index === 0) return " top1";
  if (index === 1) return " top2";
  if (index === 2) return " top3";
  return "";
}

export function Leaderboard({ rows }: { rows: ScoreRow[] }) {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows.length === 0 ? (
        <EmptyBoard />
      ) : (
        rows.map((row, index) => (
          <div
            key={`${row.rank}-${row.name}`}
            className={"lb-row" + medalClass(index) + (row.isYou ? " you" : "")}
          >
            <div className="rk">#{String(row.rank).padStart(2, "0")}</div>
            <div className="pl">
              {row.name}
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-faint)",
                  letterSpacing: "0.1em",
                }}
              >
                {row.date}
              </div>
            </div>
            <div className="sc">{row.score.toLocaleString("es-ES")}</div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Un marcador vacío se dice, no se disimula. Antes del SPEC 06 este hueco lo
 * tapaban doce filas de jugadores inventados.
 */
export function EmptyBoard() {
  return (
    <div className="lb-empty">
      <div className="lb-empty-title">
        AÚN NADIE HA MARCADO<span className="blink">_</span>
      </div>
      <p>Sé el primero en dejar tu nombre en esta pantalla.</p>
    </div>
  );
}
