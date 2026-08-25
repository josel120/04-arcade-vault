"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AUTH_ERROR_TEXT, type AuthError } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "loading" | "error" | "sent";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<AuthError | null>(null);

  const loading = status === "loading";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const supabase = createClient();
    if (!supabase) {
      setError("config");
      setStatus("error");
      return;
    }

    setError(null);
    setStatus("loading");

    // Se ignora a propósito el resultado de la llamada: el mensaje es el mismo
    // exista o no la cuenta, para no dejar enumerar correos registrados
    // probando la recuperación uno por uno (SPEC 16 §6).
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/nueva-contrasena`,
    });

    setStatus("sent");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">RECUPERAR ACCESO</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {status === "sent" ? (
          <p style={{ margin: 0 }}>SI EL CORREO EXISTE, TE HEMOS ENVIADO UN ENLACE</p>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="recover-email">Correo electrónico</label>
              <input
                id="recover-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                required
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "◌ ENVIANDO…" : "ENVIAR ENLACE"}
            </button>

            {error && (
              <div className="auth-error" role="alert">
                {AUTH_ERROR_TEXT[error]}
              </div>
            )}
          </form>
        )}

        <div className="auth-links">
          <div className="auth-switch">
            <Link href="/login">Volver a iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
