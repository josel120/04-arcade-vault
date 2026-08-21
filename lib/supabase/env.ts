/**
 * Las dos variables públicas de Supabase.
 *
 * Llevan el prefijo `NEXT_PUBLIC_` a propósito: el cliente de Supabase corre en
 * el navegador y acaban en el bundle. Lo que protege los datos no es esconder
 * la clave publicable, es la RLS de `public.profiles`. Es exactamente lo
 * contrario de `RESEND_API_KEY`, que no puede salir del servidor.
 *
 * Se leen aquí dentro de una función y nunca en el ámbito de módulo: eso es lo
 * que permite que `npm run build` pase en un entorno sin `.env.local` y que
 * `/`, `/games` y `/about` se sigan sirviendo sin credenciales.
 */
export type SupabaseEnv = {
  url: string;
  key: string;
};

/**
 * Devuelve las dos variables, o `null` si falta alguna.
 *
 * Next inlinea `process.env.NEXT_PUBLIC_*` en el bundle solo cuando se accede
 * a la expresión completa, así que estas dos lecturas no se pueden
 * desestructurar ni construir dinámicamente.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  return { url, key };
}
