"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { useSession } from "@/components/session-provider";
import {
  AUTH_ERROR_TEXT,
  normalizeUsername,
  validateUsername,
  type AuthError,
} from "@/lib/profiles";
import { guestUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

export type AuthMode = "login" | "signup";
type Status = "idle" | "loading" | "error";
type Provider = "google" | "github";

/** Alias de las sesiones locales sin cuenta. */
const GUEST_NAME = "INVITADO";

/**
 * Traduce el fallo que devuelve Supabase a uno de nuestros motivos.
 *
 * Se mira primero el `code`, que es estable, y el mensaje solo como respaldo
 * para versiones que no lo traen.
 */
function mapAuthError(error: { code?: string; message?: string } | null): AuthError {
  if (!error) return "network";

  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "credentials";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "email_unconfirmed";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered")
  ) {
    return "email_taken";
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return "weak_password";
  }
  if (
    code === "email_address_invalid" ||
    code === "validation_failed" ||
    message.includes("email address")
  ) {
    return "email";
  }
  // El trigger `on_auth_user_created` aborta el alta entera cuando el alias ya
  // existe, y Supabase lo devuelve como un fallo generico de base de datos.
  if (message.includes("database error")) {
    return "username_taken";
  }

  return "network";
}

type AuthFormProps = {
  mode: AuthMode;
  /** Motivo de error ya conocido al montar, p. ej. `?error=oauth_failed`. */
  initialError?: AuthError | null;
  /** Enlaces propios de cada pantalla (recuperación, cruce login↔registro). */
  footer?: ReactNode;
};

export function AuthForm({ mode, initialError = null, footer }: AuthFormProps) {
  const router = useRouter();
  const { signIn } = useSession();

  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");

  const [status, setStatus] = useState<Status>(initialError ? "error" : "idle");
  const [error, setError] = useState<AuthError | null>(initialError);

  const loading = status === "loading";

  const fail = (reason: AuthError) => {
    setError(reason);
    setStatus("error");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const supabase = createClient();
    if (!supabase) {
      fail("config");
      return;
    }

    setError(null);
    setStatus("loading");

    try {
      if (mode === "signup") {
        // El alias es obligatorio al registrarse: sin el, el perfil no existe.
        if (validateUsername(name)) {
          fail("username_format");
          return;
        }

        // Comprobacion previa, para dar un mensaje decente. El `unique` de la
        // tabla es el arbitro final y cierra la carrera entre dos altas
        // simultaneas.
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", name)
          .maybeSingle();

        if (taken) {
          fail("username_taken");
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { data: { username: name } },
        });

        if (signUpError) {
          fail(mapAuthError(signUpError));
          return;
        }

        // Sin sesion la cuenta existe pero esta pendiente de confirmar el
        // correo. Desaparece en cuanto el panel tenga *Confirm email* apagado.
        if (!data.session) {
          fail("email_unconfirmed");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (signInError) {
          fail(mapAuthError(signInError));
          return;
        }
      }
    } catch {
      fail("network");
      return;
    }

    setStatus("idle");
    router.push("/");
    // Para que el servidor vea la cookie nueva en el siguiente render.
    router.refresh();
  };

  const playAsGuest = () => {
    signIn(guestUser(GUEST_NAME));
    router.push("/");
  };

  const withProvider = async (provider: Provider) => {
    if (loading) return;

    const supabase = createClient();
    if (!supabase) {
      fail("config");
      return;
    }

    setError(null);
    setStatus("loading");

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login/callback` },
    });

    // Si no hay error, el navegador ya está saliendo hacia el proveedor: no
    // hace falta volver a `idle`, la pantalla desaparece.
    if (oauthError) {
      fail("oauth_failed");
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
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

        <form onSubmit={submit}>
          {mode === "signup" && (
            <div className="field slide-in">
              <label htmlFor="auth-user">Usuario</label>
              <input
                id="auth-user"
                value={name}
                onChange={(event) => setName(normalizeUsername(event.target.value))}
                placeholder="PX_KAI"
                autoComplete="username"
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(event) => setPass(event.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "◌ CONECTANDO…" : mode === "login" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>

          {error && (
            <div className="auth-error" role="alert">
              {AUTH_ERROR_TEXT[error]}
            </div>
          )}
        </form>

        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => void withProvider("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => void withProvider("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        {footer && <div className="auth-links">{footer}</div>}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
