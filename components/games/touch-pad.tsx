"use client";

import type { PointerEvent } from "react";

import type { GameAction } from "@/lib/games/engine";
import type { TouchButton } from "@/lib/games/registry";

/**
 * Controles táctiles, repartidos como el mueble de un salón recreativo: un
 * grupo bajo cada pulgar. Una fila centrada obligaría a jugar con una mano.
 *
 * Qué botones hay, qué hacen y de qué color son lo declara cada juego en
 * `GAME_ENGINES`. Este componente solo los pinta: no sabe qué juego está
 * corriendo, y por eso no puede mentir sobre lo que hace cada botón.
 */
export function TouchPad({
  clusters,
  onAction,
}: {
  clusters: TouchButton[][];
  onAction: (action: GameAction, active: boolean) => void;
}) {
  const bind = (action: GameAction) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      // Captura el puntero para que soltar fuera del botón también suelte la
      // acción: sin esto la nave se queda propulsando sola.
      event.currentTarget.setPointerCapture(event.pointerId);
      onAction(action, true);
    },
    onPointerUp: () => onAction(action, false),
    onPointerCancel: () => onAction(action, false),
    onContextMenu: (event: PointerEvent<HTMLButtonElement>) => event.preventDefault(),
  });

  return (
    <div className="game-touch" aria-label="Controles táctiles">
      {clusters.map((cluster, index) => (
        <div className="pad-cluster" key={index}>
          {cluster.map((button) => (
            <button
              key={button.action}
              type="button"
              className={`pad-key ${button.tone}`}
              aria-label={button.label}
              {...bind(button.action)}
            >
              {button.glyph}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
