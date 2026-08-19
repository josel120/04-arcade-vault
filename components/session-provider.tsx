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

import {
  appendScore,
  readUser,
  writeUser,
  type SavedScore,
  type SessionUser,
} from "@/lib/session";

type SessionContextValue = {
  user: SessionUser | null;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Arranca en null igual que el servidor; la sesión real se lee tras montar
  // para que el primer render de cliente coincida con el HTML del servidor.
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // Lectura tras montar: el servidor no ve localStorage, así el primer
    // render de cliente coincide con el HTML y no hay desajuste de hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readUser());
  }, []);

  const signIn = useCallback((next: SessionUser) => {
    setUser(next);
    writeUser(next);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    writeUser(null);
  }, []);

  const saveScore = useCallback((entry: Omit<SavedScore, "at">) => {
    appendScore(entry);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ user, signIn, signOut, saveScore }),
    [user, signIn, signOut, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
