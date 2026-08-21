"use client";

import type { PointerEvent } from "react";

import type { GameAction } from "@/lib/games/engine";

/**
 * Controles táctiles, repartidos como el mueble de un salón recreativo: girar
 * bajo el pulgar izquierdo, propulsar y disparar bajo el derecho. Una fila
 * centrada obligaría a jugar con una sola mano.
 *
 * El color reutiliza la semántica que el HUD de al lado ya enseña: cian para
 * navegar, amarillo para el nivel y la propulsión, magenta para lo que quema
 * vidas.
 */
export function TouchPad({
  onAction,
}: {
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
      <div className="pad-cluster">
        <button
          type="button"
          className="pad-key cyan"
          aria-label="Girar a la izquierda"
          {...bind("left")}
        >
          ◄
        </button>
        <button
          type="button"
          className="pad-key cyan"
          aria-label="Girar a la derecha"
          {...bind("right")}
        >
          ►
        </button>
      </div>
      <div className="pad-cluster">
        <button type="button" className="pad-key yellow" aria-label="Propulsar" {...bind("thrust")}>
          ▲
        </button>
        <button type="button" className="pad-key magenta" aria-label="Disparar" {...bind("fire")}>
          ●
        </button>
      </div>
    </div>
  );
}
