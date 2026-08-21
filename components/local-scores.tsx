"use client";

import { useEffect, useState } from "react";

import { scoresForGame, type SavedScore } from "@/lib/session";

/** Marca de tiempo a DD/MM/AAAA, la convención de fechas del proyecto. */
function formatDate(at: number): string {
  const date = new Date(at);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * Las partidas que este navegador tiene guardadas en `localStorage`.
 *
 * Existe porque el invitado no tiene fila en `auth.users` y nunca podrá estar
 * en un marcador que solo lee de la base. Antes del SPEC 06 estas partidas se
 * mezclaban con las filas inventadas del Salón; ahora van a su propio bloque,
 * rotulado, y el ranking global es de la base y solo de la base.
 *
 * Empieza vacío y se rellena tras montar: el Salón se renderiza en servidor,
 * donde `localStorage` no existe, y pintar en el primer render datos que el
 * servidor no tiene rompe la hidratación.
 */
export function LocalScores({ gameId, gameTitle }: { gameId: string; gameTitle: string }) {
  const [mine, setMine] = useState<SavedScore[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(scoresForGame(gameId).sort((a, b) => b.score - a.score));
  }, [gameId]);

  if (mine.length === 0) return null;

  return (
    <section className="local-scores">
      <div className="local-head">
        <h3>TUS PARTIDAS EN ESTE NAVEGADOR</h3>
        <p>
          Guardadas solo en este equipo. No cuentan para el marcador de {gameTitle}: para eso hace
          falta una cuenta.
        </p>
      </div>
      <div className="local-table">
        {mine.map((entry, index) => (
          <div className="local-row" key={`${entry.at}-${index}`}>
            <div className="rk">#{String(index + 1).padStart(2, "0")}</div>
            <div className="pl">{entry.name}</div>
            <div className="sc">{entry.score.toLocaleString("es-ES")}</div>
            <div className="dt">{formatDate(entry.at)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
