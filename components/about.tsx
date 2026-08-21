"use client";

import { useRef, useState, type FormEvent } from "react";

import { sendContactMessage } from "@/app/about/actions";
import { HighlightIcon, type HighlightKind } from "@/components/pixel-art";
import { useReveal } from "@/components/use-reveal";
import type { ContactResult } from "@/lib/contact";

type Highlight = {
  kind: HighlightKind;
  text: string;
  color: "magenta" | "cyan" | "green";
};

/** Los tres destacados de la misión, en el orden del template. */
const HIGHLIGHTS: Highlight[] = [
  { kind: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  {
    kind: "BROWSER",
    text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR",
    color: "cyan",
  },
  { kind: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];

/** Los 24 píxeles de la banda divisoria, cada uno con su retardo. */
const DIVIDER_PIXELS = Array.from({ length: 24 }, (_, i) => i);

const EMPTY_FORM = { name: "", email: "", msg: "" };

type Status = "idle" | "sending" | "sent" | "error";
type Reason = Extract<ContactResult, { ok: false }>["reason"];

/**
 * Las tres líneas de proceso del terminal cuando el envío falla. La última es
 * siempre el error, con el texto propio de cada motivo.
 */
const ERROR_LINES: Record<Reason, [string, string, string]> = {
  validation: [
    "[OK] Conectando con servidor…",
    "[OK] Transmitiendo paquete…",
    "[ERROR] Contenido rechazado. Revisa el correo y el mensaje.",
  ],
  config: [
    "[OK] Preparando paquete…",
    "[OK] Validando contenido…",
    "[ERROR] Servidor de correo sin configurar. Inténtalo más tarde.",
  ],
  send: [
    "[OK] Conectando con servidor…",
    "[OK] Validando contenido…",
    "[ERROR] No se ha podido transmitir el paquete. Inténtalo de nuevo.",
  ],
};

export function About() {
  useReveal();

  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<Status>("idle");
  const [reason, setReason] = useState<Reason>("send");
  const [sentName, setSentName] = useState("");
  const [shake, setShake] = useState(false);

  // El `disabled` del botón solo llega tras el re-render; esto frena el
  // segundo clic de un doble clic, que ocurre antes.
  const sending = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (sending.current) return;

    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }

    sending.current = true;
    setStatus("sending");

    const name = form.name.trim();
    const result = await sendContactMessage({
      name,
      email: form.email.trim(),
      msg: form.msg.trim(),
    });

    sending.current = false;

    if (result.ok) {
      setSentName(name);
      setStatus("sent");
      return;
    }

    setReason(result.reason);
    setStatus("error");
  };

  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y
          celebrar los arcades que definieron una generación, haciéndolos accesibles para todos, en
          cualquier lugar y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((highlight, index) => (
            <div
              key={highlight.kind}
              className={`highlight ${highlight.color}`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <HighlightIcon kind={highlight.kind} />
              <div className="hl-text pixel">{highlight.text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar" />
        <div className="div-pixels">
          {DIVIDER_PIXELS.map((i) => (
            <span key={i} style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="div-bar" />
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              <div className="tip">
                <span className="tip-led" />
                RESPUESTA EN 24-48H
              </div>
              <div className="tip">
                <span className="tip-led y" />
                SUGERENCIAS BIENVENIDAS
              </div>
              <div className="tip">
                <span className="tip-led m" />
                SIN SPAM, JAMÁS
              </div>
            </div>
          </div>

          {/* `noValidate`: la validación nativa del navegador se comería el
              envío de un correo mal formado y nunca se vería el terminal en
              rojo. Quien decide es la revalidación del servidor. */}
          <form className={`contact-form${shake ? " shake" : ""}`} onSubmit={onSubmit} noValidate>
            {status === "idle" || status === "sending" ? (
              <>
                <div className="field">
                  <label htmlFor="contact-name">NOMBRE</label>
                  <input
                    id="contact-name"
                    name="name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="px_kai"
                  />
                </div>
                <div className="field">
                  <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="jugador@vault.gg"
                  />
                </div>
                <div className="field">
                  <label htmlFor="contact-msg">MENSAJE</label>
                  <textarea
                    id="contact-msg"
                    name="msg"
                    rows={5}
                    value={form.msg}
                    onChange={(event) => setForm({ ...form, msg: event.target.value })}
                    placeholder="Cuéntanos qué tienes en mente…"
                  />
                </div>
                <button
                  className="btn xl press"
                  type="submit"
                  style={{ width: "100%" }}
                  disabled={status === "sending"}
                >
                  {status === "sending" ? "◌ ENVIANDO…" : "▶ ENVIAR MENSAJE"}
                </button>
              </>
            ) : status === "sent" ? (
              <div className="terminal-success">
                <div className="term-bar">
                  <span className="dot r" />
                  <span className="dot y" />
                  <span className="dot g" />
                  <span className="term-title">VAULT-OS // TERMINAL</span>
                </div>
                <div className="term-body">
                  <div className="line">
                    <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
                  </div>
                  <div className="line dim">[OK] Conectando con servidor…</div>
                  <div className="line dim">[OK] Validando contenido…</div>
                  <div className="line dim">[OK] Transmitiendo paquete…</div>
                  <div className="line success">
                    &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
                    {sentName.toUpperCase()}.<span className="caret">_</span>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setStatus("idle");
                        setForm(EMPTY_FORM);
                      }}
                    >
                      ENVIAR OTRO MENSAJE
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="terminal-success error">
                <div className="term-bar">
                  <span className="dot r" />
                  <span className="dot y" />
                  <span className="dot g" />
                  <span className="term-title">VAULT-OS // TERMINAL</span>
                </div>
                <div className="term-body">
                  <div className="line">
                    <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
                  </div>
                  <div className="line dim">{ERROR_LINES[reason][0]}</div>
                  <div className="line dim">{ERROR_LINES[reason][1]}</div>
                  <div className="line err">
                    {ERROR_LINES[reason][2]}
                    <span className="caret">_</span>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn ghost" type="button" onClick={() => setStatus("idle")}>
                      REINTENTAR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
