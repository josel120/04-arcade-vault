import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Vuelta del consentimiento OAuth (Google/GitHub). Supabase redirige aquí con
 * un `code` en la query; intercambiarlo deja la sesión en las cookies.
 *
 * Sin fila en `profiles` para esa sesión —cualquier alta OAuth nueva, ver
 * SPEC 16 §3— se manda a `/login/alias` a elegir uno. Con fila, entra directo.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  const supabase = await createClient();
  if (!supabase || !code) {
    redirect("/login?error=oauth_failed");
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    redirect("/login?error=oauth_failed");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.session.user.id)
    .maybeSingle();

  redirect(profile ? "/" : "/login/alias");
}
