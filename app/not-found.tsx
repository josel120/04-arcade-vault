import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Game Over · 404 · Arcade Vault",
};

export default function NotFound() {
  return (
    <div className="av-404 fade-in">
      <h1>
        GAME OVER · <span className="code">404</span>
      </h1>
      <div className="plate">CARTUCHO NO ENCONTRADO</div>
      <p>
        Esta dirección no apunta a ningún juego del Vault. Revisa la URL o vuelve al inicio para
        elegir otro cartucho.
      </p>
      <div className="actions">
        <Link className="btn" href="/">
          VOLVER AL INICIO
        </Link>
      </div>
    </div>
  );
}
