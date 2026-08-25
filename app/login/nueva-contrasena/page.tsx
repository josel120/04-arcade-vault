"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { AUTH_ERROR_TEXT, type AuthError } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/client";

type Status = "waiting" | "ready" | "loading" | "error" | "expired";

/**
 * Ventana de espera al evento `PASSWORD_RECOVERY` que deja el enlace del
 * correo. Sin sesión de recuperación pasado este tiempo, el enlace se trata
 * como caducado o ya usado (SPEC 16 §4 paso 10).
 */
const RECOVERY_TIMEOUT_MS = 3000;

/**
 * Mínimo por defecto de Supabase Auth. No hay forma de leerlo del panel desde
 * el cliente, así que se valida en el navegador antes de llamar a
 * `updateUser()` — el criterio de aceptación exige que una contraseña débil
 * no dispare esa llamada.
 */
const MIN_PASSWORD_LENGTH = 6;

export default function NuevaContrasenaPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("waiting");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("config");

      setStatus("error");
      return;
    }

    let active = true;
    let recovered = false;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (!active || event !== "PASSWORD_RECOVERY") return;
      recovered = true;
      setStatus("ready");
    });

    const timeout = setTimeout(() => {
      if (active && !recovered) setStatus("expired");
    }, RECOVERY_TIMEOUT_MS);

    return () => {
      active = false;
      clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "ready") return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("weak_password");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("config");
      setStatus("error");
      return;
    }

    setError(null);
    setStatus("loading");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      const message = updateError.message.toLowerCase();
      setError(
        updateError.code === "weak_password" || message.includes("password should be")
          ? "weak_password"
          : "network",
      );
      setStatus("ready");
      return;
    }

    router.push("/login");
  };

  const loading = status === "loading";

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
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

        {status === "expired" ? (
          <>
            <div className="auth-error" role="alert">
              {AUTH_ERROR_TEXT.expired_link}
            </div>
            <div className="auth-links">
              <div className="auth-switch">
                <Link href="/login/recuperar">Pedir un enlace nuevo</Link>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="new-pass">Contraseña nueva</label>
              <input
                id="new-pass"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                disabled={status === "waiting"}
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              disabled={status !== "ready"}
              style={{ width: "100%", marginTop: 8 }}
            >
              {status === "waiting"
                ? "◌ COMPROBANDO ENLACE…"
                : loading
                  ? "◌ GUARDANDO…"
                  : "GUARDAR CONTRASEÑA"}
            </button>

            {error && (
              <div className="auth-error" role="alert">
                {AUTH_ERROR_TEXT[error]}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
