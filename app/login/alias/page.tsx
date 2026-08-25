"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  AUTH_ERROR_TEXT,
  normalizeUsername,
  validateUsername,
  type AuthError,
} from "@/lib/profiles";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "idle" | "loading" | "error";

/**
 * Pantalla que `/login/callback` manda a completar cuando una sesión OAuth
 * nueva no tiene todavía fila en `profiles` (SPEC 16 §3): el trigger deja de
 * insertarla porque no hay `username` en `raw_user_meta_data`.
 */
export default function LoginAliasPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("checking");
  const [name, setName] = useState("");
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }

    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setStatus("idle");
    });

    return () => {
      active = false;
    };
  }, [router]);

  const fail = (reason: AuthError) => {
    setError(reason);
    setStatus("error");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading" || status === "checking") return;

    const supabase = createClient();
    if (!supabase) {
      fail("config");
      return;
    }

    if (validateUsername(name)) {
      fail("username_format");
      return;
    }

    setError(null);
    setStatus("loading");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", name)
      .maybeSingle();

    if (taken) {
      fail("username_taken");
      return;
    }

    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: userData.user.id, username: name });

    if (insertError) {
      fail(insertError.code === "23505" ? "username_taken" : "network");
      return;
    }

    setStatus("idle");
    router.push("/");
    router.refresh();
  };

  const loading = status === "loading" || status === "checking";

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ELIGE TU ALIAS</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ÚLTIMO PASO PARA ENTRAR AL VAULT
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="alias-user">Usuario</label>
            <input
              id="alias-user"
              value={name}
              onChange={(event) => setName(normalizeUsername(event.target.value))}
              placeholder="PX_KAI"
              autoComplete="username"
              required
              disabled={status === "checking"}
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {status === "checking"
              ? "◌ COMPROBANDO SESIÓN…"
              : status === "loading"
                ? "◌ GUARDANDO…"
                : "GUARDAR ALIAS Y ENTRAR"}
          </button>

          {error && (
            <div className="auth-error" role="alert">
              {AUTH_ERROR_TEXT[error]}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
