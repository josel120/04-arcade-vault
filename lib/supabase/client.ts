import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Cliente de Supabase para el navegador.
 *
 * Devuelve `null` cuando faltan las variables de entorno, en vez de lanzar: es
 * lo que permite que el formulario de acceso muestre `SUPABASE NO CONFIGURADO`
 * y que `JUGAR COMO INVITADO` siga funcionando sin credenciales.
 *
 * `createBrowserClient` ya aplica un patrón singleton, así que llamar a esta
 * función varias veces no crea varias instancias.
 */
export function createClient(): SupabaseClient<Database> | null {
  const env = readSupabaseEnv();
  if (!env) return null;

  return createBrowserClient<Database>(env.url, env.key);
}
