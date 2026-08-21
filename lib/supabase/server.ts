import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Devuelve `null` cuando faltan las variables de entorno, igual que el cliente
 * de navegador, para que una configuración incompleta no tumbe el renderizado
 * de una página que no necesita Supabase para nada.
 *
 * Se crea uno nuevo en cada llamada a propósito: nunca debe guardarse en una
 * variable de módulo, porque las cookies son de la petición en curso.
 */
export async function createClient(): Promise<SupabaseClient<Database> | null> {
  const env = readSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` llamado desde un Server Component, donde las cookies son
          // de solo lectura. Se puede ignorar: `proxy.ts` es quien refresca la
          // sesión y escribe las cookies actualizadas en cada petición.
        }
      },
    },
  });
}
