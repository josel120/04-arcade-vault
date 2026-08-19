"use client";

import { useRouter } from "next/navigation";
import { useRef, type MouseEvent } from "react";

import type { Game } from "@/lib/games";

/** Variante de color del botón JUGAR; `cyan` y `green` usan el botón base. */
function buttonClass(color: Game["color"]): string {
  if (color === "magenta") return "btn magenta";
  if (color === "yellow") return "btn yellow";
  return "btn";
}

export function GameCard({ game }: { game: Game }) {
  const router = useRouter();
  const tiltRef = useRef<HTMLDivElement>(null);

  const href = `/juego/${game.id}`;

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "";
  };

  return (
    <div
      ref={tiltRef}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => router.push(href)}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover} />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          <button
            type="button"
            className={buttonClass(game.color)}
            onClick={(event) => {
              event.stopPropagation();
              router.push(href);
            }}
          >
            JUGAR
          </button>
        </div>
      </div>
    </div>
  );
}
