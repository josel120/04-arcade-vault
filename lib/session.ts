export type SessionUser = {
  /** Alias del jugador: mayúsculas, máximo 10 caracteres. */
  name: string;
};

export type SavedScore = {
  /** `id` del juego. */
  game: string;
  score: number;
  name: string;
  /** Marca de tiempo en milisegundos. */
  at: number;
};

export const USER_KEY = "av_user";
export const SCORES_KEY = "av_scores";

export function readUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as SessionUser).name === "string"
    ) {
      return { name: (parsed as SessionUser).name };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeUser(user: SessionUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_KEY);
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
