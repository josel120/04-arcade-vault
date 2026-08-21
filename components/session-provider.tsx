"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import {
  appendScore,
  readGuest,
  writeGuest,
  type SavedScore,
  type SessionUser,
} from "@/lib/session";

import type { SupabaseClient, User } from "@supabase/supabase-js";

type SessionContextValue = {
  user: SessionUser | null;
  /**
   * Inicia una sesión **local de invitado**. Las cuentas no pasan por aquí:
   * entran por Supabase desde el formulario de acceso y llegan solas a este
   * contexto por `onAuthStateChange`.
   */
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Resuelve el alias de una cuenta.
 *
 * La tabla `profiles` es la autoridad. Si la consulta falla —red, RLS, la fila
 * todavía no visible— se cae a `user_metadata.username`, que es donde `signUp`
 * dejó el mismo alias y viaja ya dentro de la sesión sin coste extra.
 */
async function resolveAccount(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<SessionUser | null> {
  const { data } = await supabase.from("profiles").select("username").eq("id", user.id).single();

  if (data?.username) {
    return { id: user.id, name: data.username, kind: "account" };
  }

  const fallback = user.user_metadata?.username;
  if (typeof fallback === "string" && fallback.length > 0) {
    return { id: user.id, name: fallback.toUpperCase(), kind: "account" };
  }

  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Arranca en null igual que el servidor; la sesión real se resuelve tras
  // montar para que el primer render de cliente coincida con el HTML.
  const [user, setUser] = useState<SessionUser | null>(null);

  // Devuelve null cuando faltan las variables de entorno. En ese caso la app
  // sigue funcionando entera con sesiones de invitado.
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(readGuest());
      return;
    }

    let active = true;

    // `onAuthStateChange` emite `INITIAL_SESSION` nada más suscribirse, así que
    // esta única suscripción cubre la carga inicial y los cambios posteriores.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;

      if (!sessionUser) {
        // Sin cuenta manda el invitado local, si lo hay.
        if (active) setUser(readGuest());
        return;
      }

      void resolveAccount(supabase, sessionUser).then((account) => {
        // La sesión de Supabase gana siempre sobre cualquier resto local.
        if (active) setUser(account);
      });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback((next: SessionUser) => {
    setUser(next);
    // Solo los invitados se persisten aquí: la sesión de una cuenta vive en la
    // cookie que gestionan Supabase y `proxy.ts`.
    if (next.kind === "guest") writeGuest(next);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    writeGuest(null);
    // Inofensivo si no había sesión de cuenta.
    if (supabase) void supabase.auth.signOut();
  }, [supabase]);

  const saveScore = useCallback((entry: Omit<SavedScore, "at">) => {
    appendScore(entry);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ user, signIn, signOut, saveScore }),
    [user, signIn, signOut, saveScore],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
