import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Refresca el token de sesión en cada petición y reescribe las cookies.
 *
 * La documentación de Supabase llama a este archivo `middleware.ts`; en Next 16
 * ese convenio está deprecado y se llama `proxy.ts` (ver `AGENTS.md` y
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 * El nombre cambia, el contenido es el mismo.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const env = readSupabaseEnv();
  // Sin credenciales la app se sigue sirviendo entera: solo el acceso falla.
  if (!env) return supabaseResponse;

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANTE: no quitar esta llamada. Es lo que refresca el token; sin ella
  // las sesiones se cierran de forma aparentemente aleatoria cuando el token
  // caduca, y el síntoma aparece horas después de tocar este archivo.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
