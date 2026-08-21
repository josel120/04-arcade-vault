/**
 * Lógica pura del formulario de contacto: tipos, validación y las dos
 * plantillas de correo.
 *
 * Este archivo no importa `resend` ni lee `process.env`: lo consume tanto el
 * Server Action como (potencialmente) el cliente, así que no puede arrastrar
 * nada del servidor al bundle del navegador.
 */

export type ContactInput = {
  name: string;
  email: string;
  msg: string;
};

export type ContactResult = { ok: true } | { ok: false; reason: "validation" | "config" | "send" };

/** Límites revalidados en servidor. El cliente no los impone. */
export const LIMITS = {
  name: 80,
  email: 160,
  msg: 2000,
} as const;

/**
 * Formato de correo mínimo: algo@algo.algo, sin espacios. Un correo
 * tipográficamente válido pero inexistente se acepta a propósito: el único
 * juez real de eso es el propio envío.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Devuelve null si el input es válido, o el motivo del rechazo. */
export function validateContact(input: ContactInput): "validation" | null {
  const name = input.name.trim();
  const email = input.email.trim();
  const msg = input.msg.trim();

  if (!name || !email || !msg) return "validation";

  if (name.length > LIMITS.name || email.length > LIMITS.email || msg.length > LIMITS.msg) {
    return "validation";
  }

  if (!EMAIL_RE.test(email)) return "validation";

  return null;
}

/**
 * Escapa lo que escribe el visitante antes de interpolarlo en el HTML del
 * correo. Sin esto, un mensaje con `<script>` llegaría como marcado.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * Los estilos van en línea y la estructura es una tabla de un solo bloque:
 * los clientes de correo descartan las hojas externas, buena parte de <style>
 * y casi todo flex y grid. Si aun así se degrada, degrada a texto legible.
 */
const BG = "#0a0a0f";
const PANEL = "#0f0f18";
const CYAN = "#00f5ff";
const MAGENTA = "#ff00e5";
const INK = "#e6e9ff";
const INK_DIM = "#8a8fb5";
const MONO = "'Courier New', Courier, monospace";

/** Marco común de los dos correos: fondo oscuro, borde cian y pie de firma. */
function emailShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:${PANEL};border:1px solid ${CYAN};">
<tr><td style="padding:20px 24px;border-bottom:1px solid rgba(0,245,255,0.25);">
<span style="font-family:${MONO};font-size:11px;letter-spacing:0.24em;color:${MAGENTA};">&#9656; ARCADE VAULT</span>
</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 20px;font-family:${MONO};font-size:16px;letter-spacing:0.08em;color:${CYAN};">${title}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid rgba(0,245,255,0.25);">
<span style="font-family:${MONO};font-size:11px;color:${INK_DIM};">Arcade Vault &middot; hecho con p&iacute;xeles y ne&oacute;n</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Una fila etiqueta / valor del cuerpo del correo. */
function field(label: string, value: string): string {
  return `<p style="margin:0 0 16px;font-family:${MONO};font-size:13px;line-height:1.6;">
<span style="display:block;font-size:11px;letter-spacing:0.16em;color:${INK_DIM};">${label}</span>
<span style="color:${INK};">${value}</span>
</p>`;
}

/** Cuerpo HTML retro del correo que recibe el equipo. */
export function teamEmailHtml(input: ContactInput): string {
  const name = escapeHtml(input.name.trim());
  const email = escapeHtml(input.email.trim());
  const msg = escapeHtml(input.msg.trim());

  const body = `${field("NOMBRE", name)}
${field("CORREO", email)}
<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:0.16em;color:${INK_DIM};">MENSAJE</p>
<div style="padding:16px;background:${BG};border-left:3px solid ${MAGENTA};font-family:${MONO};font-size:13px;line-height:1.7;color:${INK};white-space:pre-wrap;">${msg}</div>
<p style="margin:20px 0 0;font-family:${MONO};font-size:12px;color:${INK_DIM};">Responde a este correo y le llegar&aacute; directamente a ${email}.</p>`;

  return emailShell("NUEVO MENSAJE DE CONTACTO", body);
}

/** Cuerpo HTML retro del acuse de recibo que recibe el visitante. */
export function replyEmailHtml(input: ContactInput): string {
  const name = escapeHtml(input.name.trim());
  const msg = escapeHtml(input.msg.trim());

  const body = `<p style="margin:0 0 16px;font-family:${MONO};font-size:13px;line-height:1.7;color:${INK};">
Hola ${name}: tu mensaje ha llegado. Lo leemos y te respondemos en 24-48 h.
</p>
<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:0.16em;color:${INK_DIM};">ESTO ES LO QUE NOS ESCRIBISTE</p>
<div style="padding:16px;background:${BG};border-left:3px solid ${CYAN};font-family:${MONO};font-size:13px;line-height:1.7;color:${INK};white-space:pre-wrap;">${msg}</div>
<p style="margin:20px 0 0;font-family:${MONO};font-size:12px;color:${INK_DIM};">No hace falta que respondas a este correo: es autom&aacute;tico.</p>`;

  return emailShell("HEMOS RECIBIDO TU MENSAJE", body);
}
