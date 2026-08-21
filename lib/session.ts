export type SessionUser = {
  /** `auth.users.id` si es una cuenta; `GUEST_ID` si es un invitado local. */
  id: string;
  /** Alias del jugador: mayúsculas, máximo 10 caracteres. */
  name: string;
  kind: "account" | "guest";
};

export type SavedScore = {
  /** `id` del juego. */
  game: string;
  score: number;
  name: string;
  /** Marca de tiempo en milisegundos. */
  at: number;
};

/** Identificador de las sesiones de invitado, que no tienen fila en la base. */
export const GUEST_ID = "guest";

/** Invitado local. Lo escribe esta versión. */
export const GUEST_KEY = "av_guest";

/**
 * Clave heredada del SPEC 01, cuando el acceso era simulado y toda sesión vivía
 * aquí. Solo se lee, para degradar esas sesiones a invitado sin que nadie
 * pierda su alias. Nunca se escribe y no se borra: dejarla cuesta cero y evita
 * perder datos si hay que revertir el despliegue.
 */
export const LEGACY_USER_KEY = "av_user";

export const SCORES_KEY = "av_scores";

/** Construye un invitado a partir de un alias. */
export function guestUser(name: string): SessionUser {
  return { id: GUEST_ID, name, kind: "guest" };
}

/**
 * Lee la sesión de invitado. Si no hay ninguna bajo `av_guest`, intenta migrar
 * una sesión antigua de `av_user` conservando su alias.
 *
 * No devuelve nada sobre las cuentas de Supabase: esas viven en una cookie y
 * las resuelve el `SessionProvider`.
 */
export function readGuest(): SessionUser | null {
  if (typeof window === "undefined") return null;

  const current = readGuestKey(GUEST_KEY);
  if (current) return current;

  const legacy = readGuestKey(LEGACY_USER_KEY);
  if (!legacy) return null;

  // Migración de un solo sentido: se reescribe bajo la clave nueva y la vieja
  // se deja intacta.
  writeGuest(legacy);
  return legacy;
}

function readGuestKey(key: string): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as SessionUser).name === "string" &&
      (parsed as SessionUser).name.length > 0
    ) {
      // El formato viejo solo tenía `name`: se completa al leerlo.
      return guestUser((parsed as SessionUser).name);
    }
    return null;
  } catch {
    return null;
  }
}

export function writeGuest(user: SessionUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      window.localStorage.setItem(GUEST_KEY, JSON.stringify(guestUser(user.name)));
    } else {
      window.localStorage.removeItem(GUEST_KEY);
    }
  } catch {
    // localStorage lleno o bloqueado: la sesión se queda solo en memoria.
  }
}

export function readScores(): SavedScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedScore =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.game === "string" &&
        typeof entry.score === "number" &&
        typeof entry.name === "string" &&
        typeof entry.at === "number",
    );
  } catch {
    return [];
  }
}

export function appendScore(entry: Omit<SavedScore, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const all = readScores();
    all.push({ ...entry, at: Date.now() });
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // Si no se puede escribir, la puntuación simplemente no se guarda.
  }
}

export function scoresForGame(gameId: string): SavedScore[] {
  return readScores().filter((entry) => entry.game === gameId);
}
