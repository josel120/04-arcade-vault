"use client";

import { useMemo, useState } from "react";

import { GameCard } from "@/components/game-card";
import { CATS, type Cat, type GameWithStats } from "@/lib/games";

/**
 * Minúsculas y sin tildes.
 *
 * Nadie escribe «víbora» con tilde en un buscador, ni «caída», ni «glotón».
 * `NFD` separa cada letra de su acento y `\p{Diacritic}` se lleva los acentos
 * que quedan sueltos, así que «VÍBORA» y «vibora» acaban en la misma cadena.
 */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function Library({ games }: { games: GameWithStats[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Cat>("TODOS");

  const filtered = useMemo(() => {
    const needle = fold(query);
    return games.filter(
      (game) => (cat === "TODOS" || game.cat === cat) && fold(game.title).includes(needle),
    );
  }, [games, query, cat]);

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar un juego por nombre…"
            aria-label="Buscar un juego por nombre"
          />
        </div>
        <div className="av-chips">
          {CATS.map((option) => (
            <button
              key={option}
              type="button"
              className={"chip" + (cat === option ? " active" : "")}
              onClick={() => setCat(option)}
              aria-pressed={cat === option}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 80,
              color: "var(--ink-faint)",
            }}
          >
            <div
              className="pixel"
              style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
            >
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </div>
  );
}
