"use client";

import { useMemo, useState } from "react";

import { GameCard } from "@/components/game-card";
import { CATS, GAMES, type Cat } from "@/lib/games";

export function Library() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Cat>("TODOS");

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return GAMES.filter(
      (game) => (cat === "TODOS" || game.cat === cat) && game.title.toLowerCase().includes(needle),
    );
  }, [query, cat]);

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
