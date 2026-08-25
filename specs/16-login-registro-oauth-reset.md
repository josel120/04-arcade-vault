# SPEC 16 — Login y registro en pantallas propias, OAuth real y recuperación de contraseña

> **Estado:** Implementado
> **Depende de:** SPEC 04
> **Fecha:** 2026-08-25
> **Objetivo:** Separar `/auth` en `/login` y `/registro`, activar de verdad los botones GOOGLE y GITHUB, y añadir recuperación de contraseña por correo — las tres cosas que la SPEC 04 dejó explícitamente fuera.

---

## 1 — Por qué existe este spec

La SPEC 04 (`Implementado`) construyó la autenticación real contra Supabase, pero cerró tres puertas a propósito, cada una con su razón anotada en su §2 y su §6: los botones sociales se quedaron sin `onClick` porque activar OAuth «exige dar de alta aplicaciones OAuth fuera del repositorio»; no hay `/auth/reset` porque esa spec se limitó a alta y acceso; y `/auth` es una sola pantalla con pestañas porque no hacía falta más para la primera versión. Las tres puertas se abren aquí, a petición del usuario.

Abrir la puerta de OAuth destapa un problema que la SPEC 04 no tenía que resolver: el trigger `handle_new_user()` (`supabase/migrations/20260821194615_create_profiles.sql`) saca el alias de `new.raw_user_meta_data ->> 'username'`, una clave que **solo** rellena nuestro propio formulario vía `options.data.username` en `signUp`. Cuando Supabase crea la fila de `auth.users` para un inicio de sesión con Google o GitHub, esa clave no existe: `upper(null)` es `null`, y `profiles.username` es `not null unique`. Sin cambiar el trigger, **cualquier alta por OAuth aborta la transacción entera** y la cuenta ni siquiera llega a crearse en `auth.users`. Este spec tiene que resolver eso antes de que sea seguro pintar los botones como activos.

---

## 2 — Alcance

**Dentro:**

- `/login`: correo + contraseña, enlace «¿Olvidaste tu contraseña?», botones GOOGLE/GITHUB, `JUGAR COMO INVITADO`, enlace a `/registro`.
- `/registro`: alias + correo + contraseña, los mismos botones GOOGLE/GITHUB e `JUGAR COMO INVITADO` que `/login` (decisión explícita del usuario: mismo pie en las dos pantallas), enlace a `/login`.
- `components/auth-form.tsx` deja de llevar pestañas internas: se convierte en un formulario que recibe `mode: "login" | "signup"` por prop. `app/login/page.tsx` y `app/registro/page.tsx` lo montan cada uno con su modo.
- `/auth` se retira. `app/auth/` desaparece del repo; quien visite esa URL ve el 404 estándar (`app/not-found.tsx`), sin redirección.
- `components/nav.tsx` apunta a `/login` en los dos sitios donde hoy enlaza `/auth` (el botón `Iniciar Sesión` de escritorio y el enlace del panel móvil).
- OAuth real con `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })` para Google y GitHub, con `/login/callback` como ruta de vuelta.
- Migración que cambia `handle_new_user()` para que **solo** inserte un perfil cuando `raw_user_meta_data` trae `username` (el camino de correo+contraseña, sin cambios de comportamiento). Un alta por OAuth no dispara ningún `insert` en `profiles`.
- `/login/alias`: pantalla que aparece cuando `/login/callback` detecta una sesión de Supabase sin fila en `profiles`. Pide un alias con las mismas reglas que `/registro` (formato + comprobación de disponibilidad) e inserta la fila con `profiles_insert_own`, la política que ya existe.
- Recuperación de contraseña: enlace en `/login` → `/login/recuperar` (pide el correo, llama a `resetPasswordForEmail`) → correo con enlace → `/login/nueva-contrasena` (fija la contraseña nueva con `updateUser`).
- Configuración manual en el panel de Supabase, documentada en el plan: alta de las apps OAuth en Google Cloud Console y GitHub, activación de los providers Google/GitHub en Authentication → Providers, y las URLs de `/login/callback`, `/login/nueva-contrasena` en la lista de Redirect URLs.
- `lib/profiles.ts` crece con los motivos de error nuevos (`oauth_failed`, `expired_link`) y sus textos en `AUTH_ERROR_TEXT`.
- CSS nuevo: enlace cruzado entre `/login` y `/registro`, enlace «¿Olvidaste tu contraseña?», y los estados de las pantallas de alias y recuperación — reutilizando `.auth-card`, `.field`, `.auth-error` y `.btn` tal cual existen.

**Fuera de alcance (para specs futuras):**

- Confirmación de correo. Sigue desactivada, decisión explícita de la SPEC 04 que este spec no reabre.
- Cambiar la contraseña estando ya logueado, o cualquier pantalla de ajustes de cuenta. Decisión explícita del usuario: `/login/nueva-contrasena` solo se llega desde el enlace de recuperación por correo, no hay `/perfil`.
- Cambiar el alias o el correo de una cuenta existente.
- Proteger rutas. `proxy.ts` sigue sin gatear nada; toda la plataforma sigue siendo pública y jugable sin cuenta, y también sin alias.
- Forzar a quien entra por OAuth y cierra `/login/alias` sin completarla a elegir un alias en su siguiente visita. Se queda como invitado silencioso con sesión de Supabase activa hasta que vuelva a pasar por `/login/callback` (ver §6).
- Captcha o límite de intentos propio en ningún formulario nuevo.
- Avatares, foto de perfil o página `/perfil`.

---

## 3 — Modelo de datos

No hay tablas nuevas. Se modifica una función existente y no cambia ninguna política de RLS: `profiles_insert_own` ya permite exactamente el `insert` que necesita `/login/alias`.

### Migración: `handle_new_user()` deja de exigir alias

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.profiles (id, username)
    values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  end if;
  return new;
end;
$$;
```

El `if` es la única diferencia con la función de la SPEC 04. Un alta por correo+contraseña sigue funcionando exactamente igual — `options.data.username` sigue llegando y el trigger sigue insertando el perfil en la misma transacción. Un alta por OAuth no trae esa clave, el `if` no entra, no se inserta nada, y la fila de `auth.users` se crea igual: **la cuenta ya no aborta**. La fila de `profiles` para esa cuenta la crea, después y en su propia transacción, el `insert` explícito de `/login/alias`.

`profiles.username` sigue siendo `not null unique`: una cuenta OAuth existe en `auth.users` sin fila en `profiles` hasta que alguien complete `/login/alias`. Eso es exactamente lo que dice §6 sobre invitados silenciosos — no hace falta relajar la restricción para tolerarlo.

### Tipos en TypeScript

```ts
// lib/profiles.ts — dos motivos de error nuevos, mismo patrón que los siete de la SPEC 04
export type AuthError =
  | "credentials"
  | "username_taken"
  | "username_format"
  | "email"
  | "email_taken"
  | "email_unconfirmed"
  | "weak_password"
  | "config"
  | "network"
  | "oauth_failed" // Supabase rechazó el intercambio de código en /login/callback.
  | "expired_link"; // el enlace de recuperación ya no tiene sesión válida.
```

`AUTH_ERROR_TEXT` crece con las dos entradas correspondientes. Ningún motivo existente cambia de texto.

### Rutas nuevas

| Ruta                      | Qué hace                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `/login`                  | Formulario de acceso (antes, pestaña `INICIAR SESIÓN` de `/auth`).                   |
| `/registro`               | Formulario de alta (antes, pestaña `CREAR CUENTA` de `/auth`).                       |
| `/login/callback`         | Route Handler. Intercambia el `code` de OAuth por sesión y decide a dónde redirigir. |
| `/login/alias`            | Pantalla de alias para cuentas OAuth sin perfil todavía.                             |
| `/login/recuperar`        | Pide el correo y dispara `resetPasswordForEmail`.                                    |
| `/login/nueva-contrasena` | Fija la contraseña nueva tras el enlace del correo.                                  |

`app/auth/` se borra entera.

---

## 4 — Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **Migración del trigger.** Aplicar con `apply_migration` (nombre `handle_new_user_username_optional`) el `create or replace function` de §3. Guardar copia en `supabase/migrations/`. Verificación: `list_migrations` la muestra aplicada; un `signUp` de correo+contraseña de prueba sigue dejando una fila en `profiles` igual que antes.

2. **Separar el formulario.** Reescribir `components/auth-form.tsx` para que reciba `mode: "login" | "signup"` en vez de llevar pestañas internas (`tab`, `switchTab` desaparecen). El resto del componente —validación, `mapAuthError`, los campos, la banda de error, `JUGAR COMO INVITADO`, los botones sociales— se queda igual, condicionado por `mode` en vez de por `tab`. Verificación: `npx tsc --noEmit` pasa.

3. **Páginas nuevas y retirada de `/auth`.** Crear `app/login/page.tsx` (monta `<AuthForm mode="login" />` más el enlace «¿Olvidaste tu contraseña?» → `/login/recuperar` y el enlace cruzado a `/registro`) y `app/registro/page.tsx` (monta `<AuthForm mode="signup" />` más el enlace cruzado a `/login`). Borrar `app/auth/`. Verificación: `/login` y `/registro` renderizan cada uno su formulario; `/auth` da el 404 estándar.

4. **Nav.** Actualizar los dos `href="/auth"` de `components/nav.tsx` (botón de escritorio y enlace del panel móvil) a `/login`, y `authActive` a comparar contra `/login` (además de `/registro`, para que el ítem de nav se marque activo en las dos). Verificación: recorrer la nav en 1440×900 y 375×812, el estado activo se ve en ambas rutas.

5. **OAuth: botones.** En `auth-form.tsx`, dar `onClick` real a `◆ GOOGLE` y `▣ GITHUB`: `supabase.auth.signInWithOAuth({ provider: "google" | "github", options: { redirectTo: `${window.location.origin}/login/callback` } })`. Verificación: `npx tsc --noEmit` pasa; el clic navega a la pantalla de consentimiento del proveedor (fallará hasta el paso 6, es esperado).

6. **Panel de Supabase y consolas de los proveedores (fuera del repo).** Dar de alta una app OAuth en Google Cloud Console y otra en GitHub (Settings → Developer settings → OAuth Apps), cada una con el _Authorization callback URL_ que exige Supabase: `https://<project-ref>.supabase.co/auth/v1/callback` (no `/login/callback`, ese es el de la app — Supabase hace su propio salto intermedio). Copiar client ID y secret de cada una a Authentication → Providers → Google/GitHub en el panel de Supabase, y activarlos. Añadir `http://localhost:3000/login/callback` y el equivalente de producción a Authentication → URL Configuration → Redirect URLs. Verificación: el panel muestra los dos providers activos y las Redirect URLs listadas.

7. **`/login/callback`.** Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` antes de escribir el archivo (Route Handler, no page). Crear `app/login/callback/route.ts`: lee `code` de la query, llama a `supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor (`lib/supabase/server.ts`), y si tiene éxito comprueba con un `select` si existe fila en `profiles` para ese `id`. Si existe, `redirect("/")`; si no, `redirect("/login/alias")`. Si el intercambio falla, `redirect("/login?error=oauth_failed")` y `/login` lee ese parámetro para mostrar la banda de error con `oauth_failed`. Verificación: iniciar sesión con una cuenta de Google o GitHub que ya tenga perfil (creada antes por correo con el mismo correo, si aplica) lleva a `/`; una cuenta nueva lleva a `/login/alias`.

8. **`/login/alias`.** Página cliente que comprueba con `supabase.auth.getUser()` que hay sesión; si no la hay, `redirect("/login")`. El formulario reutiliza `normalizeUsername`/`validateUsername`/la comprobación de disponibilidad de `auth-form.tsx` (extraídas a una función compartida si hace falta, o duplicadas si es más simple — a decidir en la implementación). Al enviar, `insert` en `profiles` con el `id` de la sesión y el alias elegido; si el `insert` falla por `unique`, se traduce a `username_taken` igual que en el registro. Al terminar bien, `router.push("/")` y `router.refresh()`. Verificación: completar el alias dispara la creación de la fila y a partir de ahí `useSession()` resuelve el alias igual que una cuenta de correo+contraseña.

9. **Recuperación: solicitud.** Crear `app/login/recuperar/page.tsx`: un campo de correo, botón `ENVIAR ENLACE`, llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/login/nueva-contrasena` })`. **Siempre** muestra el mismo mensaje de éxito («SI EL CORREO EXISTE, TE HEMOS ENVIADO UN ENLACE»), exista o no la cuenta — ver §6, es una decisión de seguridad. Verificación: pedir el enlace para un correo real deja un correo de recuperación en la bandeja (o en los logs de Supabase si no hay SMTP propio).

10. **Recuperación: nueva contraseña.** Leer la documentación de recuperación de contraseña de `@supabase/ssr`/`@supabase/supabase-js` instalados (mismo criterio que la SPEC 04 aplicó a `proxy.ts`: la guía genérica de Supabase puede no coincidir exactamente con la versión del paquete) antes de escribir `app/login/nueva-contrasena/page.tsx`. La pantalla espera la sesión de recuperación que el enlace deja (vía el evento `PASSWORD_RECOVERY` de `onAuthStateChange` o el intercambio de `code` que use la versión instalada), pide una contraseña nueva y llama a `supabase.auth.updateUser({ password })`. Si no hay sesión de recuperación válida (enlace caducado o reusado), muestra `expired_link` con un enlace de vuelta a `/login/recuperar`. Al terminar bien, `router.push("/login")`. Verificación: seguir el enlace del correo, fijar una contraseña nueva, y entrar con ella en `/login`.

11. **CSS.** Añadir el enlace cruzado login↔registro y el enlace «¿Olvidaste tu contraseña?» reutilizando el estilo ya existente de `.auth-divider`/enlaces de texto; ningún componente nuevo de tarjeta — `/login/alias`, `/login/recuperar` y `/login/nueva-contrasena` reutilizan `.auth-card`/`.field`/`.auth-error` tal cual. Verificación: `npm run build` pasa y ningún selector nuevo colisiona con uno existente.

12. **Repaso.** Recorrer `/`, `/login`, `/registro`, `/login/recuperar`, `/salon`, `/about` con sesión, como invitado y sin sesión, en 1440×900 y 375×812. Repetir el flujo OAuth completo con una cuenta de Google o GitHub de prueba, de principio a fin (botón → consentimiento → callback → alias → `/`). Confirmar que `/auth` da 404.

---

## 5 — Criterios de aceptación

**Compilación**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` pasa.
- [ ] No se añade ninguna dependencia nueva al `package.json`.

**Rutas**

- [ ] `/login` muestra correo + contraseña, el enlace de recuperación, `JUGAR COMO INVITADO`, los dos botones sociales y un enlace a `/registro`.
- [ ] `/registro` muestra alias + correo + contraseña, `JUGAR COMO INVITADO`, los dos botones sociales y un enlace a `/login`.
- [ ] `/auth` devuelve el 404 estándar del sitio.
- [ ] Los dos enlaces de `components/nav.tsx` que antes iban a `/auth` van a `/login`.

**Correo y contraseña (sin regresión de la SPEC 04)**

- [ ] Crear cuenta en `/registro` deja una fila en `auth.users` y una en `profiles` con el mismo `id`, igual que antes.
- [ ] Entrar en `/login` con credenciales correctas lleva a `/` y la nav muestra el alias.
- [ ] Los siete motivos de error de la SPEC 04 se siguen mostrando exactamente igual que antes de este spec.

**OAuth**

- [ ] Los botones GOOGLE y GITHUB navegan a la pantalla de consentimiento real del proveedor.
- [ ] Completar el consentimiento con una cuenta de proveedor **sin** perfil previo lleva a `/login/alias`, no a `/`.
- [ ] Elegir un alias válido y libre en `/login/alias` crea la fila en `profiles` y de ahí en adelante la nav muestra ese alias.
- [ ] Un alta por OAuth **no** aborta: `auth.users` recibe la fila aunque `profiles` todavía no tenga la suya.
- [ ] Repetir el inicio de sesión OAuth con una cuenta que ya completó `/login/alias` lleva directo a `/`, sin volver a pedir alias.
- [ ] Cerrar `/login/alias` sin completarla y navegar al resto del sitio no rompe nada: el sitio se sigue viendo y jugando con normalidad, sin alias.
- [ ] Un alta por correo+contraseña sigue creando su perfil en la misma transacción, sin pasar por `/login/alias`.

**Recuperación de contraseña**

- [ ] Pedir la recuperación con un correo que **no** tiene cuenta muestra el mismo mensaje de éxito que uno que sí la tiene.
- [ ] Seguir el enlace del correo y fijar una contraseña nueva permite entrar en `/login` con la contraseña nueva y ya no con la vieja.
- [ ] Visitar `/login/nueva-contrasena` sin haber pasado por el enlace de recuperación muestra `expired_link`, no un formulario funcional.
- [ ] Una contraseña nueva por debajo del mínimo de Supabase muestra `weak_password` sin llamar a `updateUser`.

**Lo que no debe cambiar**

- [ ] `lib/session.ts`, `components/session-provider.tsx`, `lib/scores.ts`, `hall-of-fame.tsx` y `game-player.tsx` no aparecen en el diff.
- [ ] `/games`, `/juego/[id]`, `/jugar/[id]`, `/salon` y `/about` siguen siendo accesibles sin sesión y sin alias.
- [ ] Las políticas de RLS de `profiles` no cambian: la migración de §3 solo toca `handle_new_user()`.
- [ ] `JUGAR COMO INVITADO` sigue funcionando igual en las dos pantallas nuevas.

**Accesibilidad**

- [ ] Los campos nuevos (`/login/alias`, `/login/recuperar`, `/login/nueva-contrasena`) tienen su `<label>` asociado y foco visible con `:focus-visible`.
- [ ] Las bandas de error nuevas usan `role="alert"`, igual que las de la SPEC 04.
- [ ] A 375 px ninguna pantalla nueva provoca scroll horizontal.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** `/login` y `/registro` como rutas propias, no pestañas. Decisión explícita del usuario.
- **No:** mantener `/auth` como alias que redirige. Decisión explícita del usuario: se retira sin más, quien tenga el enlace viejo guardado ve el 404 del sitio.
- **Sí:** `components/auth-form.tsx` se queda como un único componente parametrizado por `mode`, no dos componentes separados. Es el cambio mínimo sobre lo que ya existe: valida, traduce errores y pinta el pie social igual en los dos modos, y duplicar ese cuerpo en dos ficheros solo para quitar el `<div className="auth-tabs">` sería el mismo componente dos veces.
- **Sí:** las dos pantallas comparten idéntico pie (invitado + social). Decisión explícita del usuario: menos sorpresas para quien aterriza en la que no buscaba.
- **Sí:** `/login/callback` como nombre de la ruta de vuelta de OAuth, colgando de `/login` y no de `/auth`. Decisión explícita del usuario.
- **Sí:** pantalla de alias tras el callback, bloqueando solo esa transición, no cada visita futura. Decisión explícita del usuario.
- **No:** exigir el alias en cada carga de página mientras no exista `profiles`. Habría significado interceptar la navegación entera con una comprobación adicional en cada ruta, para un caso — cerrar `/login/alias` a medias — que el usuario decidió tratar como invitado silencioso.
- **Sí:** el trigger `handle_new_user()` pasa a ser condicional (`if raw_user_meta_data ? 'username'`) en vez de aceptar un alias vacío o inventado. Es el cambio mínimo que evita que OAuth aborte el alta sin tocar la forma de la tabla ni sus políticas.
- **No:** hacer `profiles.username` nullable. Habría obligado a que todo el resto del código —marcador, `resolveAccount`, el propio `select` de disponibilidad— contemplara un alias vacío. Dejar la columna `not null` y que el trigger simplemente no inserte la fila hasta que haya alias es más simple.
- **No:** generar un alias automático a partir del nombre de GitHub o del correo de Google. Decisión explícita del usuario: prefiere que la persona elija el suyo, igual que en el registro por correo.
- **Sí:** correo de recuperación con el servicio por defecto de Supabase, sin SMTP propio. Decisión explícita del usuario. Mismo patrón que el resto del proyecto: cero secretos nuevos.
- **Sí:** `/login/recuperar` muestra siempre el mismo mensaje exista o no la cuenta. Estándar de seguridad para no dejar enumerar correos registrados probando la recuperación uno por uno; ninguna spec anterior lo necesitaba porque no había flujo por correo hasta ahora.
- **No:** una pantalla de cambio de contraseña estando ya logueado. Decisión explícita del usuario: eso es el primer paso de una página `/perfil` que no existe y no es parte de este spec.
- **Sí:** las URLs de callback y de redirect de recuperación se añaden a mano en el panel de Supabase (paso 6 del plan), igual que la SPEC 04 desactivó _Confirm email_ a mano. Es configuración de la plataforma, no algo que el código del repo pueda fijar.
- **No:** guardar el `client_id`/`client_secret` de Google o GitHub en este repositorio, ni siquiera en `.env.template`. Esas credenciales viven solo en el panel de Supabase; la app nunca las necesita porque `signInWithOAuth` habla con el proyecto de Supabase, no con el proveedor directamente.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                     | Mitigación                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sin el cambio del trigger, activar los botones OAuth rompe el alta entera** para cualquier cuenta nueva de Google o GitHub.              | El paso 1 aplica la migración de §3 antes de que el paso 5 dé `onClick` a los botones. Hay criterio de aceptación explícito de que un alta OAuth no aborta.                                                                                                                                              |
| Alguien entra por Google con un correo que ya tiene cuenta de correo+contraseña y espera que sea "la misma cuenta".                        | Supabase trata cada proveedor como una identidad separada salvo que se enlacen explícitamente; enlazar identidades es trabajo de otra spec. Aquí simplemente se le pedirá un alias nuevo en `/login/alias`, como a cualquier cuenta OAuth nueva. Se documenta como comportamiento esperado, no como bug. |
| El enlace de recuperación se reutiliza o caduca y la pantalla de nueva contraseña se queda en un estado roto sin explicar por qué.         | El paso 10 exige el estado `expired_link` explícito con vuelta a `/login/recuperar`, y hay criterio de aceptación que lo cubre.                                                                                                                                                                          |
| Las Redirect URLs no se añaden en el panel de Supabase y el callback de OAuth o de recuperación falla en silencio o con un error genérico. | Paso 6 del plan las deja como parte explícita de la configuración manual, con verificación de que el panel las lista antes de dar el paso por hecho.                                                                                                                                                     |
| La comprobación previa de alias en `/login/alias` dice libre y otra alta se cuela entre medias con el mismo alias.                         | Igual que en la SPEC 04: el `unique` de `profiles` es el árbitro final, y el `insert` fallido se traduce a `username_taken`.                                                                                                                                                                             |
| Revelar por temporización o por respuesta si un correo existe al pedir la recuperación.                                                    | El paso 9 fija un mensaje de éxito idéntico para ambos casos; hay criterio de aceptación explícito.                                                                                                                                                                                                      |

---

## Lo que **no** entra en este spec

- Confirmación de correo, `/auth/callback` del flujo de alta por correo (sigue sin existir; no confundir con `/login/callback`, que es solo de OAuth).
- Cambiar contraseña, correo o alias estando ya logueado; borrar la cuenta; página `/perfil` o avatares.
- Enlazar una cuenta OAuth con una cuenta de correo+contraseña que use el mismo correo.
- Proteger rutas: toda la plataforma sigue siendo pública y jugable sin cuenta y sin alias.
- Captcha, honeypot o límite de intentos propio en ningún formulario nuevo.
- Cualquier otro proveedor OAuth además de Google y GitHub.

Cada uno de ellos, si llega, va en su propia spec.
