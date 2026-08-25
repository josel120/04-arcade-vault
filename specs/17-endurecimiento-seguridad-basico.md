# SPEC 17 — Endurecimiento de seguridad básico (RLS, contraseñas, rate limit y cabeceras)

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 06
> **Fecha:** 2026-08-25
> **Objetivo:** Aplicar el checklist de seguridad básico de `references/security/checklist.md` — verificar RLS, subir el mínimo de contraseña, intentar activar la protección de contraseñas filtradas, revisar el límite de registros por IP, y añadir las tres cabeceras HTTP de seguridad que hoy no existen en Next.js.

---

## 1 — Por qué existe este spec

`references/security/checklist.md` es una lista de cinco puntos de seguridad básica, más un aviso concreto que ya reporta el propio panel de Supabase (`auth_leaked_password_protection`, nivel `WARN`). Antes de tocar nada se comprobó el estado real de cada punto:

- **RLS.** `list_tables` confirma `rls_enabled: true` en `public.profiles`, `public.scores` y `public.games` — las tres tablas base ya quedaron con RLS activada por la SPEC 04 y la SPEC 06. `game_stats` y `game_leaderboards` son vistas, no tablas (Postgres no tiene `ENABLE ROW LEVEL SECURITY` para vistas); se comprobó que las dos se crearon con `security_invoker=on`, así que al consultarlas se respeta la RLS de `scores`, `profiles` y `games` en vez de correr con los permisos de quien las creó. `get_advisors` en modo `security` no reporta ningún hallazgo sobre RLS, solo el de contraseñas filtradas. **Este punto del checklist ya está resuelto**; este spec lo deja como criterio de verificación, no como cambio.
- **Mínimo de contraseña y protección de contraseñas filtradas.** Son ajustes del panel de Supabase (Authentication → Providers → Email), no código. Hoy el mínimo es el valor por defecto del proyecto (por debajo de 8) y la protección contra contraseñas filtradas está apagada — exactamente lo que reporta `get_advisors`. La documentación de Supabase advierte que la protección de contraseñas filtradas **requiere plan Pro o superior**; este proyecto está en plan Free, así que puede que el panel no deje activarla todavía.
- **Límite de registros por IP.** También es un ajuste del panel (Authentication → Rate Limits), no código. No se añade CAPTCHA: la SPEC 04 §6/§7 ya dejó anotado que "la mitigación seria (captcha, límite por IP)" es su propia spec, y aquí se resuelve solo la mitad barata — ajustar los límites que el panel ya expone — dejando CAPTCHA fuera, igual que hizo la SPEC 04.
- **Cabeceras de seguridad en Next.js.** `next.config.ts` está vacío (`{/* config options here */}`). Ninguna cabecera de seguridad se envía hoy. Se verificó en `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` que la clave `headers()` de `next.config.js` sigue funcionando igual en Next 16 — no hay cambio de convención que traducir aquí, a diferencia de `proxy.ts` en la SPEC 04.

En resumen: dos de los cinco puntos (RLS, cabeceras) son objetivos claros de código o verificación; los otros tres viven en el panel de Supabase y se documentan como pasos manuales, con el mismo criterio que la SPEC 04 usó para desactivar _Confirm email_ y que la SPEC 16 usó para dar de alta las apps OAuth.

**Resultado de la implementación (pasos manuales del panel):**

- **Mínimo de contraseña:** hecho, quedó en 8 en Authentication → Providers → Email.
- **Leaked password protection:** bloqueada por el plan Free del proyecto, tal como anticipaba el riesgo de §7. Sigue en `WARN` en `get_advisors`. Queda pendiente de un futuro cambio de plan; este punto **no** se marca como resuelto.
- **Rate Limits del registro:** todavía sin revisar en el panel. Queda como pendiente antes de marcar este spec como `Implementado`.

---

## 2 — Alcance

**Dentro:**

- `next.config.ts`: función `headers()` que aplica a todas las rutas (`source: "/:path*"`) las tres cabeceras del checklist: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Verificación (sin cambio de esquema) de que RLS sigue activa en `profiles`, `scores` y `games`, y de que `game_stats`/`game_leaderboards` siguen con `security_invoker=on`.
- Panel de Supabase (Authentication → Providers → Email): subir **Minimum password length** a 8.
- Panel de Supabase, mismo lugar: intentar activar **Leaked password protection**. Si el plan Free no lo permite, se documenta como bloqueado en vez de darlo por hecho.
- Panel de Supabase (Authentication → Rate Limits): revisar los límites que aplican a `/auth/v1/signup` y ajustar el que corresponda para mitigar registros automatizados por IP, dentro de lo que el panel ya expone — sin CAPTCHA ni código nuevo.

**Fuera de alcance (para specs futuras):**

- **Content-Security-Policy.** El checklist no lo pide y no es una de sus tres cabeceras de ejemplo. Con Google Fonts, los estilos de Tailwind y el resto del sitio, definir un CSP correcto que no rompa nada es trabajo suficiente para su propia spec.
- **Permissions-Policy, Strict-Transport-Security** u otras cabeceras adicionales no listadas en el checklist. Decisión explícita del usuario: solo las tres cabeceras pedidas.
- **CAPTCHA (hCaptcha, Turnstile, etc.) en `/login` o `/registro`.** Decisión explícita del usuario: el checklist se resuelve solo con el ajuste del panel de Rate Limits, sin nueva dependencia ni cambio de UI. Sigue siendo, como ya anotó la SPEC 04, candidato a su propia spec si hace falta más adelante.
- **Validación de longitud de contraseña en el cliente** (`components/auth-form.tsx`). Decisión explícita del usuario: el mínimo se sube solo en el panel; un intento por debajo del mínimo lo sigue rechazando Supabase con el motivo `weak_password` que ya existe desde la SPEC 04.
- **Cambiar cualquier política de RLS existente.** Este spec solo verifica que siguen activas; no audita ni endurece su contenido.
- **Editar `references/security/checklist.md`.** Es material de referencia de solo lectura según `CLAUDE.md` — la única excepción documentada es `references/game-suggestions-todo.md`, que no es este archivo.
- Subir el plan de Supabase de Free a Pro. Si Leaked password protection queda bloqueada por plan, se documenta como riesgo (§7), no se fuerza un cambio de plan desde este spec.

---

## 3 — Modelo de datos

No hay tablas, columnas ni migraciones nuevas. El único punto del checklist con forma de "modelo de datos" (RLS) ya está resuelto por la SPEC 04 y la SPEC 06; este spec lo deja como verificación:

| Objeto                     | Tipo  | RLS / seguridad                                     |
| -------------------------- | ----- | --------------------------------------------------- |
| `public.profiles`          | tabla | `rls_enabled: true`                                 |
| `public.scores`            | tabla | `rls_enabled: true`                                 |
| `public.games`             | tabla | `rls_enabled: true`                                 |
| `public.game_leaderboards` | vista | `security_invoker=on` (hereda la RLS de las tablas) |
| `public.game_stats`        | vista | `security_invoker=on` (hereda la RLS de las tablas) |

---

## 4 — Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **Cabeceras HTTP.** Editar `next.config.ts` para exportar `headers()` (función `async`, como documenta `next/dist/docs/.../headers.md`) que devuelva una entrada con `source: "/:path*"` y las tres cabeceras de §2. Verificación: `npm run build` pasa; `npm run dev` y `curl -I http://localhost:3000/` (o el inspector de red del navegador) muestran las tres cabeceras en la respuesta.

2. **Verificar RLS.** Ejecutar `list_tables` (confirma `rls_enabled: true` en las tres tablas) y `get_advisors` en modo `security` (no debe reportar nada sobre RLS, solo — hasta el paso 4 — el aviso de contraseñas filtradas). No se toca ninguna migración. Verificación: los dos resultados coinciden con lo descrito en §1.

3. **Panel — mínimo de contraseña.** En Authentication → Providers → Email, subir **Minimum password length** a 8. Verificación: el panel muestra el valor guardado en 8.

4. **Panel — contraseñas filtradas.** En el mismo lugar, activar **Leaked password protection**. Si el plan Free bloquea la opción, dejar constancia en el repaso final (paso 6) de que sigue en `WARN` por el plan del proyecto, sin marcar este punto como resuelto. Verificación: `get_advisors` en modo `security` ya no reporta `auth_leaked_password_protection`, o el repaso documenta que sigue apareciendo por el plan.

5. **Panel — límite de registros por IP.** En Authentication → Rate Limits, revisar el límite que aplica a `/auth/v1/signup` (compartido con los demás endpoints que envían correo, según la documentación de Supabase) y ajustarlo a un valor más bajo que el que trae el proyecto por defecto, como mitigación anti-bot básica. Verificación: el panel muestra el valor ajustado.

6. **Repaso final.** `npm run build` y `npm run lint` sin errores. Confirmar con `curl -I` (o devtools) que `/`, `/login` y `/registro` responden con las tres cabeceras. Volver a correr `get_advisors` en modo `security` y anotar en este spec (antes de marcarlo `Implementado`) si el aviso de contraseñas filtradas sigue presente por el plan Free.

---

## 5 — Criterios de aceptación

**Compilación**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] No se añade ninguna dependencia nueva al `package.json`.

**Cabeceras**

- [ ] Cualquier ruta responde con `X-Content-Type-Options: nosniff`.
- [ ] Cualquier ruta responde con `X-Frame-Options: DENY`.
- [ ] Cualquier ruta responde con `Referrer-Policy: strict-origin-when-cross-origin`.

**RLS (verificación, sin cambios de esquema)**

- [ ] `list_tables` muestra `rls_enabled: true` en `profiles`, `scores` y `games`.
- [ ] `game_stats` y `game_leaderboards` siguen con `security_invoker=on`.
- [ ] `get_advisors` en modo `security` no reporta ningún hallazgo relacionado con RLS.

**Panel de Supabase**

- [ ] Authentication → Providers → Email muestra **Minimum password length** en 8.
- [ ] Se documenta si **Leaked password protection** quedó activada o si el plan Free la sigue bloqueando.
- [ ] Se documenta el ajuste aplicado (o el valor revisado) en Authentication → Rate Limits para el endpoint de registro.

**Lo que no debe cambiar**

- [ ] `components/auth-form.tsx` no aparece en el diff.
- [ ] `references/security/checklist.md` no aparece en el diff.
- [ ] Ninguna política de RLS existente (`profiles_*`, `scores_*`, `games_*`) cambia de definición.
- [ ] La app sigue sirviéndose igual sin las variables de Supabase definidas (SPEC 04 §5 sigue vigente).

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** el límite de registros por IP se resuelve solo con el ajuste ya expuesto en el panel de Rate Limits, sin CAPTCHA. Decisión explícita del usuario, consistente con la SPEC 04 §6/§7, que ya había apartado CAPTCHA como "su propia spec".
- **No:** añadir hCaptcha o Turnstile a `/login`/`/registro` en este spec. Sería una dependencia nueva, variables de entorno nuevas y cambio de UI — mucho más alcance que "limitar signups por IP" tal como lo pide el checklist.
- **Sí:** el mínimo de contraseña se sube solo en el panel de Supabase. Decisión explícita del usuario.
- **No:** validar la longitud de la contraseña en `auth-form.tsx`. El camino de error `weak_password` ya existe desde la SPEC 04 y cubre el caso; añadir validación en el cliente es trabajo duplicado que el usuario decidió no pedir.
- **Sí:** RLS se trata como punto ya resuelto por specs anteriores, y este spec solo lo deja como criterio de verificación. Decisión explícita del usuario tras confirmar `list_tables` y `get_advisors` en la fase de investigación.
- **No:** auditar o endurecer el contenido de las políticas de RLS existentes (por ejemplo, que `scores` no tenga política de `insert` anónimo). El checklist solo pide que RLS esté _habilitada_, no una auditoría de políticas; abrirlo sería alcance no pedido.
- **Sí:** las cabeceras HTTP se limitan a las tres que trae el ejemplo del checklist (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`). Decisión explícita del usuario.
- **No:** añadir `Permissions-Policy`, `Strict-Transport-Security` o `Content-Security-Policy` en este spec. `Permissions-Policy` no la pidió el checklist; `Strict-Transport-Security` la gestiona la plataforma de despliegue, no el código; `Content-Security-Policy` con Tailwind y Google Fonts es trabajo suficiente para su propia spec, y la propia documentación de Next señala que `X-Frame-Options` está "superseded" por el `frame-ancestors` de un CSP que aquí no se construye.
- **Sí:** si Leaked password protection queda bloqueada por el plan Free, se documenta como tal en vez de forzar un cambio de plan. Decisión explícita del usuario (no se conoce con certeza el plan del proyecto en el momento de escribir este spec).
- **No:** editar `references/security/checklist.md`. `CLAUDE.md` lo trata como material de referencia de solo lectura; la única excepción documentada es `references/game-suggestions-todo.md`.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                              | Mitigación                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leaked password protection no se puede activar por estar en plan Free.** El aviso `auth_leaked_password_protection` seguiría en `WARN`.                                           | El paso 4 y el criterio de aceptación correspondiente piden documentar el bloqueo en vez de darlo por resuelto; queda anotado como pendiente de un futuro cambio de plan. |
| **Sin CAPTCHA, el límite de Rate Limits del panel es la única barrera anti-bot** para registros masivos.                                                                            | Riesgo asumido y documentado, igual que la SPEC 04 §7 ya había dejado pendiente "la mitigación seria (captcha, límite por IP)" como trabajo de otra spec.                 |
| `X-Frame-Options: DENY` bloquea que **cualquier** página del sitio se muestre dentro de un `iframe`, incluido uno propio.                                                           | Hoy no hay ningún uso conocido de Arcade Vault embebido en un `iframe`; el paso 6 incluye un repaso general que lo confirmaría si apareciera algo roto.                   |
| Cambiar `next.config.ts` con una regla demasiado amplia (`/:path*`) podría interferir con alguna respuesta especial (por ejemplo, una API o un asset) sin que se note en el repaso. | El paso 1 verifica con `curl -I` sobre varias rutas, no solo `/`, y el paso 6 repite la comprobación como parte del repaso final antes de cerrar el spec.                 |

---

## Lo que **no** entra en este spec

- Content-Security-Policy y cualquier otra cabecera fuera de las tres del checklist.
- CAPTCHA o cualquier control anti-bot más allá del ajuste de Rate Limits del panel.
- Validación de contraseña en el cliente.
- Auditoría o cambios al contenido de las políticas de RLS existentes.
- Cambiar el plan de Supabase del proyecto.
- Editar `references/security/checklist.md`.

Cada uno de ellos, si llega, va en su propia spec.
