/**
 * Preferencias del jugador que viven en este navegador y no en su cuenta.
 *
 * Misma familia de claves `av_*` y mismo patrón de `try`/`catch` que
 * `lib/session.ts`: si `localStorage` está lleno o bloqueado, la preferencia se
 * queda solo en memoria y nada se rompe.
 *
 * Todo lo de aquí se lee **después de montar, en un efecto**, nunca durante el
 * render: leerlo en el render inicial haría que el servidor y el cliente
 * pintasen botones distintos.
 */

/** Silencio del reproductor. `"1"` es silenciado; cualquier otra cosa, suena. */
export const MUTED_KEY = "av_muted";

export function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    // Sin acceso al almacén, el juego suena: es lo que espera quien abre un
    // recreativo por primera vez.
    return false;
  }
}

export function writeMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      window.localStorage.setItem(MUTED_KEY, "1");
    } else {
      window.localStorage.removeItem(MUTED_KEY);
    }
  } catch {
    // La preferencia dura lo que dure la pestaña.
  }
}
