"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/components/session-provider";

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);

  const homeActive = pathname === "/";
  // Juegos queda activo también en el detalle y en el reproductor.
  const gamesActive =
    pathname === "/games" || pathname.startsWith("/juego") || pathname.startsWith("/jugar");
  const salonActive = pathname === "/salon";
  const aboutActive = pathname === "/about";
  const authActive = pathname === "/auth";

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={homeActive ? "active" : ""} href="/">
            Inicio
          </Link>
          <Link className={gamesActive ? "active" : ""} href="/games">
            Juegos
          </Link>
          <Link className={salonActive ? "active" : ""} href="/salon">
            Salón de la Fama
          </Link>
          <Link className={aboutActive ? "active" : ""} href="/about">
            Acerca de
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link className="btn auth-btn" href="/auth">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
        aria-hidden="true"
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link className={homeActive ? "active" : ""} href="/" onClick={close}>
          Inicio
        </Link>
        <Link className={gamesActive ? "active" : ""} href="/games" onClick={close}>
          Juegos
        </Link>
        <Link className={salonActive ? "active" : ""} href="/salon" onClick={close}>
          Salón de la Fama
        </Link>
        <Link className={aboutActive ? "active" : ""} href="/about" onClick={close}>
          Acerca de
        </Link>
        <Link className={authActive ? "active" : ""} href="/auth" onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
