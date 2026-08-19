"use server";

import { Resend } from "resend";

import {
  replyEmailHtml,
  teamEmailHtml,
  validateContact,
  type ContactInput,
  type ContactResult,
} from "@/lib/contact";

/**
 * Envía el mensaje del formulario de contacto.
 *
 * Un Server Action es un punto de entrada no confiable: se alcanza por POST
 * aunque nadie pase por el formulario, así que lo primero es revalidar.
 *
 * Las tres variables de entorno se leen **aquí dentro**, nunca en el ámbito
 * de módulo: sin ellas la app tiene que compilar, arrancar y servir /about
 * con normalidad, y solo el envío falla.
 */
export async function sendContactMessage(
  input: ContactInput,
): Promise<ContactResult> {
  if (validateContact(input) !== null) {
    return { ok: false, reason: "validation" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !from || !to) {
    console.error(
      "[contacto] Faltan variables de entorno: revisa RESEND_API_KEY, CONTACT_FROM_EMAIL y CONTACT_TO_EMAIL.",
    );
    return { ok: false, reason: "config" };
  }

  const name = input.name.trim();
  const email = input.email.trim();
  const msg = input.msg.trim();
  const clean: ContactInput = { name, email, msg };

  const resend = new Resend(apiKey);

  // El correo al equipo es el que decide el resultado.
  try {
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      html: teamEmailHtml(clean),
    });

    if (error) {
      console.error("[contacto] Resend rechazó el correo al equipo:", error);
      return { ok: false, reason: "send" };
    }
  } catch (cause) {
    console.error("[contacto] Falló el envío al equipo:", cause);
    return { ok: false, reason: "send" };
  }

  // El acuse al visitante es best-effort: su fallo solo se registra.
  // Con `onboarding@resend.dev` devuelve 403 a cualquier destinatario que no
  // sea la dirección de la cuenta; se arregla verificando un dominio y
  // cambiando CONTACT_FROM_EMAIL, sin tocar código.
  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Hemos recibido tu mensaje — Arcade Vault",
      html: replyEmailHtml(clean),
    });

    if (error) {
      console.error("[contacto] No se pudo enviar el acuse de recibo:", error);
    }
  } catch (cause) {
    console.error("[contacto] Falló el envío del acuse de recibo:", cause);
  }

  return { ok: true };
}
