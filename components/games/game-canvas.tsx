"use client";

import { useEffect, useRef } from "react";

import {
  isTextTarget,
  type GameEngine,
  type GameSkin,
  type GameSnapshot,
} from "@/lib/games/engine";
import type { GameEngineEntry } from "@/lib/games/registry";

type GameCanvasProps = {
  entry: GameEngineEntry;
  /** Título del juego, para describir el lienzo a un lector de pantalla. */
  title: string;
  /**
   * Piel con la que arranca el motor. Los cambios en caliente no pasan por
   * aquí —remontar el efecto reiniciaría la partida—, sino por
   * `GameEngine.setSkin`, que el reproductor llama directamente sobre el
   * motor ya creado.
   */
  skin: GameSkin;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onGameOver: (score: number) => void;
  /** Entrega el motor al reproductor, y `null` al desmontar. */
  onReady: (engine: GameEngine | null) => void;
  /** `P` o `Escape`. */
  onTogglePause: () => void;
  /** La pestaña ha dejado de estar visible. */
  onAutoPause: () => void;
};

/**
 * Anfitrión del canvas: monta el motor, lo escala y lo desmonta limpio.
 *
 * Solo pinta el lienzo. La botonera táctil y la leyenda de teclas las coloca el
 * reproductor, que es quien manda en la maquetación.
 */
export function GameCanvas({
  entry,
  title,
  skin,
  onSnapshot,
  onGameOver,
  onReady,
  onTogglePause,
  onAutoPause,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Solo cuenta la piel vigente cuando el motor se crea: cambiarla después no
   * debe remontar el efecto de abajo —reiniciaría la partida—, así que los
   * cambios en caliente van por `GameEngine.setSkin`, no por aquí.
   */
  const initialSkinRef = useRef(skin);

  /**
   * Las llamadas del reproductor cambian de identidad en cada render suyo. Si
   * entrasen en las dependencias del efecto, el motor se recrearía cada vez que
   * sube la puntuación: la partida se reiniciaría sola. Se leen por referencia.
   */
  const callbacks = useRef({ onSnapshot, onGameOver, onReady, onTogglePause, onAutoPause });
  useEffect(() => {
    callbacks.current = { onSnapshot, onGameOver, onReady, onTogglePause, onAutoPause };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: GameEngine | null = null;
    let cancelled = false;

    // El motor dibuja siempre en su espacio lógico; el lienzo real es más denso
    // en pantallas retina para que el trazo fino no se vea sucio. Se capa a 2
    // para no cuadruplicar el relleno en móviles con dpr 3 o 4.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = entry.width * dpr;
    canvas.height = entry.height * dpr;
    canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);

    void entry.load().then(({ createEngine }) => {
      // El componente puede haberse desmontado mientras cargaba el módulo.
      if (cancelled) return;
      engine = createEngine({
        canvas,
        skin: initialSkinRef.current,
        onSnapshot: (snapshot) => callbacks.current.onSnapshot(snapshot),
        onGameOver: (score) => callbacks.current.onGameOver(score),
      });
      callbacks.current.onReady(engine);
    });

    return () => {
      cancelled = true;
      engine?.destroy();
      callbacks.current.onReady(null);
    };
  }, [entry]);

  // Pausa por teclado y al ocultarse la pestaña. Vive aquí y no en el motor
  // porque el estado de pausa tiene que verse en el HUD de React.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextTarget(event.target)) return;
      if (event.code !== "KeyP" && event.code !== "Escape") return;
      event.preventDefault();
      callbacks.current.onTogglePause();
    };

    const onVisibilityChange = () => {
      if (document.hidden) callbacks.current.onAutoPause();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" aria-label={`Partida de ${title}`} />;
}
