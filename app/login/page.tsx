import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import type { AuthError } from "@/lib/profiles";

/**
 * El único motivo que `/login` puede recibir por query es el que deja
 * `/login/callback` cuando el intercambio de OAuth falla.
 */
const KNOWN_QUERY_ERRORS: ReadonlySet<AuthError> = new Set<AuthError>(["oauth_failed"]);

function parseError(raw: string | string[] | undefined): AuthError | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && KNOWN_QUERY_ERRORS.has(value as AuthError) ? (value as AuthError) : null;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;

  return (
    <AuthForm
      mode="login"
      initialError={parseError(error)}
      footer={
        <>
          <Link href="/login/recuperar">¿Olvidaste tu contraseña?</Link>
          <div className="auth-switch">
            ¿Sin cuenta? <Link href="/registro">Regístrate</Link>
          </div>
        </>
      }
    />
  );
}
