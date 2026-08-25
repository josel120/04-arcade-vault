/**
 * Reglas del alias del jugador. Módulo puro: no importa Supabase ni lee
 * `process.env`, así que se puede usar desde cliente y desde servidor sin
 * arrastrar nada, igual que `lib/contact.ts`.
 */

/**
 * Misma expresión que la restricción `profiles_username_format` de la tabla.
 * Está escrita en los dos sitios a propósito: la base es la que manda, esta
 * copia es la que permite dar un mensaje decente antes de llamar a Supabase.
 * Si una cambia, la otra también.
 */
export const USERNAME_PATTERN = /^[A-Z0-9_]{3,10}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 10;

/**
 * Deja el alias como lo guarda la base: mayúsculas, sin caracteres que la
 * restricción rechace y recortado a 10. Se aplica mientras se escribe, así que
 * el campo nunca llega al servidor con algo que la base vaya a rechazar por
 * forma.
 */
export function normalizeUsername(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
}

/** `null` si el alias es válido, o el motivo del rechazo. */
export function validateUsername(name: string): "format" | null {
  return USERNAME_PATTERN.test(name) ? null : "format";
}

/**
 * Los motivos de fallo del acceso. Cada uno lleva a un texto distinto en la
 * banda de error, porque «no ha funcionado» no le sirve a nadie:
 *
 * - `credentials`     el correo o la contraseña no cuadran.
 * - `username_taken`  el alias ya existe. Incluye el caso en que lo detecta el
 *                     `unique` de la base en vez de la comprobación previa.
 * - `username_format` el alias no cumple la forma que exige la tabla.
 * - `email`           correo mal escrito o rechazado por Supabase.
 * - `email_taken`     ya hay una cuenta con ese correo.
 * - `email_unconfirmed` la cuenta existe pero el correo está sin confirmar.
 * - `weak_password`   contraseña por debajo del mínimo del proyecto.
 * - `config`          faltan las variables de entorno. No es culpa de quien
 *                     entra, y tiene que verse en vez de fallar en silencio.
 * - `network`         no se pudo hablar con Supabase.
 * - `oauth_failed`    Supabase rechazó el intercambio de código en
 *                     `/login/callback`.
 * - `expired_link`    el enlace de recuperación de contraseña ya no tiene una
 *                     sesión de recuperación válida.
 *
 * Los dos motivos de correo no estaban en el §3 de la SPEC 04, que listaba
 * siete. Se añadieron al implementar: sin ellos, registrarse con un correo ya
 * usado mostraba `CORREO INVÁLIDO`, que es falso, y una cuenta pendiente de
 * confirmar no mostraba nada que explicara por qué no se entraba.
 * `email_unconfirmed` desaparece de la práctica en cuanto el panel tenga
 * *Confirm email* desactivado, como pide el paso 2 del plan.
 *
 * `oauth_failed` y `expired_link` los añade la SPEC 16 junto con OAuth y la
 * recuperación de contraseña.
 */
export type AuthError =
  | "credentials"
  | "username_taken"
  | "username_format"
  | "email"
  | "email_taken"
  | "email_unconfirmed"
  | "weak_password"
  | "config"
  | "network"
  | "oauth_failed"
  | "expired_link";

/** Texto retro que se pinta en la banda de error, uno por motivo. */
export const AUTH_ERROR_TEXT: Record<AuthError, string> = {
  credentials: "CREDENCIALES INCORRECTAS",
  username_taken: "ALIAS OCUPADO",
  username_format: "ALIAS INVÁLIDO: 3-10 CARACTERES, A-Z 0-9 _",
  email: "CORREO INVÁLIDO",
  email_taken: "YA HAY UNA CUENTA CON ESE CORREO",
  email_unconfirmed: "CUENTA CREADA: CONFIRMA TU CORREO PARA ENTRAR",
  weak_password: "CONTRASEÑA DEMASIADO CORTA",
  config: "SUPABASE NO CONFIGURADO",
  network: "SIN CONEXIÓN",
  oauth_failed: "NO SE PUDO COMPLETAR EL ACCESO CON EL PROVEEDOR",
  expired_link: "ENLACE CADUCADO O YA UTILIZADO",
};
