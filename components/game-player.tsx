"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { saveScore as saveScoreToBoard } from "@/app/jugar/[id]/actions";
import { GameCanvas } from "@/components/games/game-canvas";
import { TouchPad } from "@/components/games/touch-pad";
import { useSession } from "@/components/session-provider";
import type { GameWithStats } from "@/lib/games";
import type { GameAction, GameEngine, GameSkin, GameSnapshot } from "@/lib/games/engine";
import { getEngineEntry } from "@/lib/games/registry";
import { readMuted, writeMuted } from "@/lib/preferences";
import { readSkin, writeSkin } from "@/lib/skins";

/** Las tres pieles, en el orden en que se enseñan en el selector del HUD. */
const SKIN_OPTIONS: { value: GameSkin; label: string }[] = [
  { value: "clasico", label: "CLÁSICO" },
  { value: "retro", label: "RETRO" },
  { value: "neon", label: "NEÓN" },
];

/** Puntos por nivel en los juegos que todavía son maqueta. */
const POINTS_PER_LEVEL = 2500;

/** Longitud máxima del alias que se guarda con la puntuación. */
const MAX_NAME_LENGTH = 10;

type Stats = { score: number; lives: number; level: number };

const INITIAL_STATS: Stats = { score: 0, lives: 3, level: 1 };

/**
 * Qué pasó y qué puede hacer el jugador. Nunca "ha ocurrido un error".
 */
const SAVE_ERROR_TEXT: Record<"auth" | "validation" | "config" | "db", string> = {
  auth: "Tu sesión ha caducado. Vuelve a entrar para guardar en el marcador.",
  validation: "El servidor ha rechazado esta puntuación.",
  config: "El marcador no está disponible ahora mismo. Tu puntuación sigue en este navegador.",
  db: "No se pudo guardar en el marcador. Vuelve a intentarlo.",
};

export function GamePlayer({ game }: { game: GameWithStats }) {
  const { user, saveScore } = useSession();

  // Los juegos sin motor registrado caen a la arena decorativa del SPEC 01.
  const entry = getEngineEntry(game.id);

  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [skin, setSkin] = useState<GameSkin>("clasico");
  /** Puesto conseguido, tal y como lo devuelve la acción. Null para el invitado. */
  const [standing, setStanding] = useState<{
    rank: number;
    players: number;
    isRecord: boolean;
  } | null>(null);

  const engineRef = useRef<GameEngine | null>(null);
  const pausedRef = useRef(false);
  const overRef = useRef(false);
  const playerNameRef = useRef("INVITADO");
  /** El histórico local se escribe una vez, aunque el marcador haya que reintentarlo. */
  const localSavedRef = useRef(false);
  const mutedRef = useRef(false);
  const skinRef = useRef<GameSkin>("clasico");

  // El provider lee la sesión tras montar, así que el HUD la toma del contexto
  // en cada render en vez de congelarla en un estado inicial.
  const playerName = user ? user.name : "INVITADO";
  const isAccount = user?.kind === "account";

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  // La preferencia se lee tras montar y no en el estado inicial: el servidor
  // no tiene `localStorage` y pintaría el botón contrario al del cliente. Es
  // la misma precaución que toma `components/local-scores.tsx`, con la misma
  // excepción a la regla.
  useEffect(() => {
    const stored = readMuted();
    mutedRef.current = stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(stored);
  }, []);

  // Misma cautela que arriba, pero por juego: la piel de INVASORES no tiene
  // por qué ser la de ROCAS.
  useEffect(() => {
    const stored = readSkin(game.id);
    skinRef.current = stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkin(stored);
  }, [game.id]);

  useEffect(() => {
    overRef.current = over;
  }, [over]);

  // Maqueta: puntuación simulada para los juegos que aún no tienen motor.
  useEffect(() => {
    if (entry || over || paused) return;
    const timer = setInterval(() => {
      setStats((prev) => {
        const score = prev.score + Math.floor(10 + Math.random() * 90);
        return { score, lives: 3, level: Math.floor(score / POINTS_PER_LEVEL) + 1 };
      });
    }, 220);
    // Se limpia al pausar, al terminar y al desmontar el componente.
    return () => clearInterval(timer);
  }, [entry, over, paused]);

  const onSnapshot = useCallback((snapshot: GameSnapshot) => {
    setStats({ score: snapshot.score, lives: snapshot.lives, level: snapshot.level });
  }, []);

  const openGameOver = useCallback((finalScore: number) => {
    setStats((prev) => ({ ...prev, score: finalScore }));
    // El campo de iniciales toma el alias vigente al abrirse el modal.
    setName(playerNameRef.current);
    setOver(true);
  }, []);

  const onReady = useCallback((engine: GameEngine | null) => {
    engineRef.current = engine;
    // El jugador puede haber pausado mientras cargaba el módulo del motor.
    if (engine && pausedRef.current) engine.pause();
    // Y el estado del sonido y de la piel se le dan aquí, no por
    // `CreateEngineOptions`: éste es el sitio donde el motor ya existe y las
    // preferencias ya se han leído. La piel inicial que `GameCanvas` le pasa a
    // `createEngine` puede haberse creado antes de que `readSkin` resolviera
    // —es una carga asíncrona—, así que se reafirma aquí igual que el sonido.
    if (engine) {
      engine.setMuted(mutedRef.current);
      engine.setSkin(skinRef.current);
    }
  }, []);

  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    writeMuted(next);
    engineRef.current?.setMuted(next);
  }, []);

  const changeSkin = useCallback(
    (next: GameSkin) => {
      skinRef.current = next;
      setSkin(next);
      writeSkin(game.id, next);
      // Si el juego no tiene motor (la maqueta), no hay nada que avisar: el
      // chrome ya cambió con el `data-skin` del contenedor.
      engineRef.current?.setSkin(next);
    },
    [game.id],
  );

  const applyPause = useCallback((next: boolean) => {
    pausedRef.current = next;
    setPaused(next);
    const engine = engineRef.current;
    if (!engine) return;
    if (next) engine.pause();
    else engine.resume();
  }, []);

  const togglePause = useCallback(() => {
    if (overRef.current) return;
    applyPause(!pausedRef.current);
  }, [applyPause]);

  const autoPause = useCallback(() => {
    if (overRef.current) return;
    applyPause(true);
  }, [applyPause]);

  const onTouchAction = useCallback((action: GameAction, active: boolean) => {
    engineRef.current?.setAction(action, active);
  }, []);

  const endGame = () => {
    if (entry) {
      // El motor avisa por `onGameOver`, que es quien abre el modal.
      engineRef.current?.finish();
      return;
    }
    openGameOver(stats.score);
  };

  const restart = () => {
    setStats(INITIAL_STATS);
    setOver(false);
    overRef.current = false;
    setSaved(false);
    setSaving(false);
    setSaveError(null);
    setStanding(null);
    localSavedRef.current = false;
    applyPause(false);
    engineRef.current?.restart();
  };

  const save = async () => {
    if (!localSavedRef.current) {
      saveScore({ game: game.id, score: stats.score, name });
      localSavedRef.current = true;
    }

    // El invitado no tiene fila en `auth.users`: su marca se queda local.
    if (!isAccount) {
      setSaved(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveScoreToBoard({ gameId: game.id, score: stats.score });
      if (result.ok) {
        setStanding({ rank: result.rank, players: result.players, isRecord: result.isRecord });
        setSaved(true);
      } else {
        setSaveError(SAVE_ERROR_TEXT[result.reason]);
      }
    } catch {
      setSaveError(SAVE_ERROR_TEXT.db);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in" data-skin={skin}>
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
            <div className="v">{stats.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(stats.lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(stats.level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          {/* Siempre visible: el chrome cambia de piel tenga o no motor el
              juego, así que el selector no depende de `entry`. */}
          <div className="skin-select" role="group" aria-label="Piel del reproductor">
            {SKIN_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={"chip" + (skin === option.value ? " active" : "")}
                aria-pressed={skin === option.value}
                onClick={() => changeSkin(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* Solo los juegos que suenan enseñan el interruptor. En los demás
              sería un control que no hace nada. */}
          {entry?.audio && (
            <button type="button" className="btn ghost" aria-pressed={muted} onClick={toggleMuted}>
              {muted ? "SILENCIO" : "SONIDO"}
            </button>
          )}
          <button type="button" className="btn yellow" onClick={togglePause} disabled={over}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button type="button" className="btn magenta" onClick={endGame} disabled={over}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juego/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {entry ? (
            <GameCanvas
              entry={entry}
              title={game.title}
              skin={skin}
              onSnapshot={onSnapshot}
              onGameOver={openGameOver}
              onReady={onReady}
              onTogglePause={togglePause}
              onAutoPause={autoPause}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && !over && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
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

      {entry && (
        <>
          <div className="game-keys">
            {entry.keys.map((hint) => (
              <span className="key-group" key={hint.label}>
                {hint.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
                {hint.label}
              </span>
            ))}
            {/* La pausa no la declara ningún juego: la engancha el anfitrión
                del canvas y es la misma para todos. Si cada motor tuviera que
                declararla, el primero que se le olvidara dejaría al jugador sin
                saber cómo pausar. */}
            <span className="key-group">
              <kbd>P</kbd>
              Pausa
            </span>
          </div>
          <TouchPad clusters={entry.touch} onAction={onTouchAction} />
        </>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Fin del juego">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{stats.score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <>
                {isAccount ? (
                  <div className="save-as">
                    <span className="l">Se guarda como</span>
                    <span className="v">{playerName}</span>
                  </div>
                ) : null}
                <div className="input-row">
                  {isAccount ? null : (
                    <input
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value.toUpperCase().slice(0, MAX_NAME_LENGTH))
                      }
                      placeholder="TUS INICIALES"
                      aria-label="Tus iniciales"
                      maxLength={MAX_NAME_LENGTH}
                    />
                  )}
                  <button type="button" className="btn yellow" onClick={save} disabled={saving}>
                    {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {!isAccount && (
                  <p className="guest-note">
                    Juegas como invitado: esta marca se queda en este navegador.{" "}
                    <Link href="/auth">Crea una cuenta</Link> para competir en el marcador.
                  </p>
                )}
                {saveError && (
                  <div className="auth-error" role="alert">
                    {saveError}
                  </div>
                )}
              </>
            ) : (
              <div className="saved-block">
                <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
                {/* `players` a 0 significa que el puesto no se pudo calcular:
                    la puntuación está guardada igual, así que se calla en vez
                    de enseñar un `#00 DE 0`. */}
                {standing && standing.players > 0 && (
                  <div className="standing">
                    <span className="rank">
                      PUESTO #{String(standing.rank).padStart(2, "0")} DE {standing.players}
                    </span>
                    {standing.isRecord && <span className="record">¡NUEVO RÉCORD PERSONAL!</span>}
                  </div>
                )}
              </div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
