"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/games";

/** Puntos por nivel: cada 2500 puntos sube el contador de nivel. */
const POINTS_PER_LEVEL = 2500;

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();

  const [score, setScore] = useState(0);
  const [lives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);

  // El nivel se deriva de la puntuación: no necesita estado propio y se
  // reinicia solo cuando la puntuación vuelve a 0.
  const level = Math.floor(score / POINTS_PER_LEVEL) + 1;

  // El provider lee la sesión tras montar, así que el HUD la toma del contexto
  // en cada render en vez de congelarla en un estado inicial.
  const playerName = user ? user.name : "INVITADO";

  useEffect(() => {
    if (over || paused) return;
    const timer = setInterval(() => {
      setScore((value) => value + Math.floor(10 + Math.random() * 90));
    }, 220);
    // Se limpia al pausar, al terminar y al desmontar el componente.
    return () => clearInterval(timer);
  }, [over, paused]);

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {playerName}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="btn yellow"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button type="button" className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juego/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor" />
            <div className="enemy e1" />
            <div className="enemy e2" />
            <div className="enemy e3" />
            <div className="player-ship" />
          </div>
          {paused && !over && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
    </div>
  );
}
