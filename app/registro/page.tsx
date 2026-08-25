import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function RegistroPage() {
  return (
    <AuthForm
      mode="signup"
      footer={
        <div className="auth-switch">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </div>
      }
    />
  );
}
