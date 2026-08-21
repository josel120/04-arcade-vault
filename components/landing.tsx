"use client";

import Link from "next/link";

import { MiniCard } from "@/components/mini-card";
import { FeatureIcon, FloatingSilhouettes } from "@/components/pixel-art";
import { useReveal } from "@/components/use-reveal";
import type { Game } from "@/lib/games";
import { FAQ, FEATURES, PRICE_PERKS, STATS, TICKER, TOP_PLAYERS } from "@/lib/landing";

/** Oro, plata y bronce para los tres primeros puestos del top de la landing. */
function podiumClass(index: number): string {
  if (index === 0) return " top1";
  if (index === 1) return " top2";
  if (index === 2) return " top3";
  return "";
}

export function Landing({ games }: { games: Game[] }) {
  useReveal();

  return (
    <div className="home fade-in">
      <section className="home-hero">
        <FloatingSilhouettes />

        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>

          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>

          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>

          <div className="home-ctas">
            <Link className="btn xl pulse" href="/games">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link className="btn xl magenta" href="/auth">
              ✦ CREAR CUENTA
            </Link>
          </div>
        </div>

        {/* Fuera de `.home-hero-inner` a propósito: se ancla al pie de la
            sección entera, no al bloque de texto. */}
        <div className="hero-scroll" aria-hidden="true">
          <span>DESLIZA</span>
          <span className="arrow">▼</span>
        </div>
      </section>

      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule" />
        </div>

        <div className="feature-grid">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.kind}
              className={"feature-card " + feature.color}
              // Escalonado de 80 ms de la referencia. Retrasa la transición
              // de hover de `.feature-card`, no la entrada, que la hace la
              // sección entera vía `.reveal`.
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <FeatureIcon kind={feature.kind} />
              <div className="ft-title pixel">{feature.title}</div>
              <div className="ft-desc">{feature.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule" />
        </div>

        <div className="mini-rail">
          {games.slice(0, 6).map((game) => (
            <MiniCard key={game.id} game={game} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="btn lg" href="/games">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </section>

      <section className="home-stats reveal">
        <div className="stats-inner">
          {STATS.map((stat, index) => (
            <div key={stat.u} className="stat-block" style={{ transitionDelay: `${index * 90}ms` }}>
              <div className="stat-n neon-yellow">{stat.n}</div>
              <div className="stat-u pixel">{stat.u}</div>
              <div className="stat-s">{stat.s}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule" />
        </div>

        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <div className="ticker">
              {TICKER.map((row, index) => (
                <div
                  key={`${row.player}-${row.game}`}
                  className="tick-row"
                  // Escalonado real: `.tick-row` sí anima con `tickin`.
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className={"tk-p neon-" + row.color}>{row.player}</span>
                  <span className="tk-mid">▸ {row.game}</span>
                  <span className="tk-s">+{row.score.toLocaleString("es-ES")}</span>
                  <span className="tk-t">{row.ago}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
              <Link className="lb-link" href="/salon">
                VER SALÓN →
              </Link>
            </div>
            <div className="top-list">
              {TOP_PLAYERS.map((row, index) => (
                <div key={row.player} className={"top-row" + podiumClass(index)}>
                  <span className="tp-rk">#{String(row.rank).padStart(2, "0")}</span>
                  <span className="tp-bar">
                    <span className="tp-fill" style={{ width: `${100 - index * 16}%` }} />
                  </span>
                  <span className="tp-p">{row.player}</span>
                  <span className="tp-s">{row.score.toLocaleString("es-ES")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule" />
        </div>

        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>

            <ul className="pc-list">
              {PRICE_PERKS.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>

            <Link className="btn xl pulse" style={{ width: "100%" }} href="/auth">
              EMPEZAR GRATIS →
            </Link>

            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          {/* El orden importa: `.faq-item:nth-child(n)` colorea cada borde. */}
          <div className="pricing-faq">
            {FAQ.map((item) => (
              <div className="faq-item" key={item.q}>
                <div className="faq-q pixel">{item.q}</div>
                <div className="faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-final reveal">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link className="btn xl pulse final-cta" href="/games">
          INSERTAR MONEDA →
        </Link>
        <div className="final-tag">Gratis. Sin registro obligatorio. Empieza en segundos.</div>
      </section>
    </div>
  );
}
