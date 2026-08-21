import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * En Next 16 este archivo se llama `proxy.ts`, no `middleware.ts`: el convenio
 * viejo está deprecado. Toda la documentación de `@supabase/ssr` sigue diciendo
 * `middleware.ts`, así que hay que traducirla al leerla.
 *
 * Aquí solo se refresca el token de sesión. No se protege ninguna ruta: la
 * plataforma entera es pública y jugable sin cuenta.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas salvo:
     * - _next/static  (bundles)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico
     * - archivos de imagen servidos desde public/
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
