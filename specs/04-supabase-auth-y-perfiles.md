# SPEC 04 — Supabase: autenticación real y perfiles de jugador

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 03
> **Fecha:** 2026-08-21
> **Objetivo:** Sustituir el acceso simulado de `/auth` por Supabase Auth con correo y contraseña, respaldado por una tabla `profiles` que da a cada jugador un alias único.

---

## 1 — Por qué existe este spec

Hoy nadie inicia sesión de verdad. `components/auth-form.tsx` acepta cualquier cosa que le escribas —contraseña incluida, que ni se mira— y llama a `signIn({ name })`, que escribe `{"name":"PX_KAI"}` en `localStorage` bajo la clave `av_user`. Si borras esa clave dejas de existir. Si cambias de navegador eres otra persona. Los botones `◆ GOOGLE` y `▣ GITHUB` no tienen `onClick`.

Eso bastaba para el SPEC 01, que era maqueta declarada. Pero el `README.md` dice que Arcade Vault es _"una plataforma para jugar online y competir por la mayor cantidad de puntos"_, y competir exige que dos jugadores en dos ordenadores distintos aparezcan en el mismo marcador. Nada de eso es posible mientras la identidad viva en el `localStorage` de cada uno.

Ya hay un proyecto de Supabase conectado (`pbxvtepsqypqgqiejycl`, servidor MCP configurado en `.mcp.json`) y una variable `SUPABASE_DB_PASSWORD` en `.env.template` que ningún código lee todavía. El esquema `public` está **vacío**: cero tablas, cero usuarios en `auth.users`. Este spec pone la primera piedra.

**Este spec es solo la mitad del problema.** La otra mitad —guardar las puntuaciones en la base en vez de en `localStorage`, y leer el Salón de la Fama desde Supabase— queda explícitamente fuera y va en la SPEC 05. La razón del corte: la sesión es dependencia de las puntuaciones, no al revés. Una fila de `scores` necesita saber de quién es; un perfil no necesita ninguna puntuación. Hacer las dos cosas a la vez juntaría dos modelos de datos, dos conjuntos de políticas RLS y dos migraciones de datos existentes en un solo cambio, y el resultado no cabría en una spec revisable.

Hay además un detalle del entorno que ninguna documentación de Supabase contempla todavía: **Next.js 16 ha renombrado `middleware.ts` a `proxy.ts`**. Está verificado en `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`: _"The `middleware.js` file convention has been **deprecated** in Next.js 16 and renamed to `proxy.js`"_. Todas las guías de `@supabase/ssr` siguen diciendo `middleware.ts`. Seguirlas al pie de la letra en este proyecto crea un archivo que Next 16 marca como deprecado.

---

## 2 — Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Dos variables de entorno públicas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) documentadas en `.env.template`.
- Tres clientes de Supabase: navegador (`lib/supabase/client.ts`), servidor (`lib/supabase/server.ts`) y refresco de sesión (`lib/supabase/proxy.ts`).
- **`proxy.ts` en la raíz** —no `middleware.ts`— que refresca el token en cada petición. Ver §1 y §6.
- Tabla `public.profiles` con `username` único, su restricción de formato, RLS con tres políticas y un trigger que crea el perfil al registrarse.
- Migraciones aplicadas con el MCP (`apply_migration`) y **versionadas también** en `supabase/migrations/`.
- Tipos generados en `lib/database.types.ts`, con los clientes tipados como `SupabaseClient<Database>`.
- `components/auth-form.tsx` reescrito: registro (`signUp`) e inicio de sesión (`signInWithPassword`) reales, con estados de carga y de error.
- **Campo `Correo electrónico` añadido a la pestaña `INICIAR SESIÓN`**, que hoy solo tiene Usuario y Contraseña. Se entra con correo, no con alias.
- Comprobación de alias disponible antes de registrar, con mensaje `ALIAS OCUPADO`.
- `SessionProvider` híbrido: la sesión de Supabase manda; si no la hay, se lee el invitado de `localStorage`.
- `SessionUser` crece a `{ id, name, kind: "account" | "guest" }`. Un `av_user` de specs anteriores degrada a invitado conservando su alias.
- `signOut` real contra Supabase para las cuentas, y borrado de `localStorage` para los invitados.
- CSS nuevo: la banda de error retro del formulario de acceso.
- La app debe **compilar y servirse sin las variables definidas**; solo el acceso falla.

**Fuera de alcance (para specs futuras):**

- **Las puntuaciones.** `saveScore` sigue escribiendo en `localStorage`, `lib/scores.ts` sigue generando sus 12 filas deterministas por juego y el Salón de la Fama sigue leyendo de donde lee hoy. Tabla `scores`, sus políticas y la migración de lo guardado en el navegador: **SPEC 05**.
- **El catálogo de juegos.** `lib/games.ts` sigue siendo un array en TypeScript. No hay tabla `games`.
- **OAuth con Google y GitHub.** Los dos botones sociales siguen sin `onClick`, exactamente como hoy. Activarlos exige dar de alta aplicaciones OAuth fuera del repositorio.
- **Inicio de sesión anónimo de Supabase.** `JUGAR COMO INVITADO` sigue siendo una sesión local sin fila en `auth.users`. Decisión explícita del usuario.
- **Confirmación de correo.** Se desactiva _Confirm email_ en el panel. Sin `/auth/callback`, sin estado "revisa tu bandeja", sin correos transaccionales de Supabase.
- **Recuperar contraseña**, cambiar contraseña, cambiar correo o borrar la cuenta. No hay `/auth/reset` ni ajustes de perfil.
- **Cambiar el alias** una vez creada la cuenta. La política de `update` existe para no tener que migrar después, pero ninguna pantalla la usa.
- **Proteger rutas.** `proxy.ts` solo refresca el token. `/games`, `/jugar/[id]` y el resto siguen siendo públicos y jugables sin cuenta.
- **Avatares, foto de perfil o página `/perfil`.**
- **CLI de Supabase y stack local en Docker.** Las migraciones van por MCP.
- **Retirar `SUPABASE_DB_PASSWORD`** de `.env.template`. Se queda documentada como herramienta, aunque ningún código la lea.
- Metadatos SEO, Open Graph, `sitemap.ts` o `robots.ts`. Siguen fuera desde el SPEC 02.
- Framework de tests.

---

## 3 — Modelo de datos

### Tabla `public.profiles`

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Z0-9_]{3,10}$')
);
```

`id` **es** el `auth.users.id`: no hay columna `user_id` ni clave propia. Un usuario, un perfil, y el `on delete cascade` se encarga de que borrar la cuenta borre el perfil.

La restricción de formato codifica en la base lo que el `MAX_NAME_LENGTH = 10` de `auth-form.tsx` y `game-player.tsx` ya imponía en el cliente, y lo que los alias de `lib/scores.ts` (`PX_KAI`, `Z3R0COOL`, `RGB_QUEEN`) demuestran por ejemplo: mayúsculas, dígitos y guion bajo. El mínimo de 3 evita alias de una letra en el marcador.

Como el alias se guarda siempre en mayúsculas, el `unique` normal basta: no hacen falta índices sobre `lower()`.

### RLS

```sql
alter table public.profiles enable row level security;

-- Lectura pública: el Salón de la Fama tiene que poder mostrar el alias de
-- cualquiera, y la comprobación de disponibilidad al registrarse también.
create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Cada quien crea y edita solo el suyo.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
```

No hay política de `delete`: el perfil se va en cascada con la cuenta y nadie más debe poder borrarlo.

La tabla no contiene el correo ni ningún dato personal más allá del alias que el jugador eligió para aparecer en un marcador público. Esa es la razón de que `select` sea abierto: lo que se expone es exactamente lo que se pretende publicar.

### Trigger de alta

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

El alias viaja en `options.data.username` de la llamada a `signUp` y aterriza en `raw_user_meta_data`. El trigger es `security definer` porque corre sin sesión: el usuario todavía no existe cuando se inserta su perfil.

**El fallo del trigger es una función, no un accidente.** Trigger e inserción en `auth.users` comparten transacción: si el alias está cogido, el `unique` la aborta entera y **la cuenta no llega a crearse**. El jugador puede reintentar con otro alias sin que quede un usuario huérfano sin perfil. Supabase devuelve ese caso como un error genérico de base de datos, que el formulario traduce a `ALIAS OCUPADO` (ver §4, paso 10).

### Variables de entorno

```bash
# .env.template — se versiona; .env.local no
NEXT_PUBLIC_SUPABASE_URL=https://pbxvtepsqypqgqiejycl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Las dos llevan `NEXT_PUBLIC_` **a propósito**: acaban en el bundle del navegador porque el cliente de Supabase corre allí. La clave publicable está diseñada para ser pública; lo que protege los datos no es esconderla, es la RLS de §3. Es exactamente lo contrario de `RESEND_API_KEY` del SPEC 03, que no puede salir del servidor bajo ningún concepto.

Se usa la clave **publicable** (`sb_publishable_…`), no la `anon` heredada de JWT. Ambas están activas en el proyecto; la publicable se rota de forma independiente y es la que Supabase recomienda para proyectos nuevos.

Ninguna variable de servicio (`service_role`, `sb_secret_…`) entra en este spec. No hay ni un solo camino de código que necesite saltarse la RLS.

`SUPABASE_DB_PASSWORD`, ya presente en `.env.template`, se queda con un comentario que aclare que es para conectarse a la base con herramientas externas y que **ningún código de la app la lee**.

### Tipos y modelo en TypeScript

`lib/database.types.ts` lo genera el MCP y no se edita a mano. Sobre él:

```ts
// lib/session.ts — el tipo crece, la clave de localStorage cambia
export type SessionUser = {
  /** `auth.users.id` si es cuenta; `"guest"` si es invitado local. */
  id: string;
  /** Alias en mayúsculas, máximo 10 caracteres. */
  name: string;
  kind: "account" | "guest";
};

export const GUEST_KEY = "av_guest";
/** Clave heredada del SPEC 01. Solo se lee, para degradar a invitado. */
export const LEGACY_USER_KEY = "av_user";
```

```ts
// lib/profiles.ts — puro: no importa Supabase ni lee process.env
export const USERNAME_PATTERN = /^[A-Z0-9_]{3,10}$/;

/** Recorta, pasa a mayúsculas y sustituye lo no permitido. */
export function normalizeUsername(raw: string): string;

/** null si es válido, o el motivo del rechazo. */
export function validateUsername(name: string): "format" | null;

export type AuthError =
  | "credentials"
  | "username_taken"
  | "username_format"
  | "email"
  | "weak_password"
  | "config"
  | "network";
```

`lib/profiles.ts` es puro por la misma razón que lo era `lib/contact.ts` en el SPEC 03: se puede importar desde cliente y desde servidor sin arrastrar nada. `USERNAME_PATTERN` es literalmente la misma expresión que la restricción `profiles_username_format` de la tabla; están escritas en los dos sitios a propósito, y si una cambia la otra también.

`AuthError` distingue siete motivos porque llevan a siete textos distintos en la banda de error. `config` es el caso de las variables sin definir, y existe por el mismo motivo que en el SPEC 03: una mala configuración tiene que verse, no fallar en silencio.

### Migración de las sesiones existentes

| Estado de `localStorage`     | Qué ve el jugador tras el despliegue                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| `av_user` con alias válido   | Sesión de **invitado** con ese mismo alias. Se reescribe bajo `av_guest`. |
| `av_user` corrupto o ausente | Sin sesión. Igual que hoy.                                                |
| Sesión de Supabase en cookie | **Manda siempre**, ignorando cualquier cosa que haya en `localStorage`.   |

`av_user` se lee una vez y no se vuelve a escribir nunca. No se borra: dejarlo cuesta cero y evita que un despliegue revertido pierda datos.

---

## 4 — Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **Dependencias y entorno.** `npm install @supabase/supabase-js @supabase/ssr`. Añadir a `.env.template` las dos variables `NEXT_PUBLIC_` de §3 con un comentario que explique por qué son públicas, y anotar `SUPABASE_DB_PASSWORD` como no usada por la app. Copiar los valores reales a `.env.local` (la clave publicable se lee con `get_publishable_keys` o desde el panel). Verificación: `npm run build` pasa **con `.env.local` renombrado temporalmente**, y `git status` no muestra `.env.local`.

2. **Panel de Supabase.** Desactivar _Confirm email_ en Authentication → Sign In / Providers → Email. Comprobar que _Enable email provider_ está activo y que _Enable anonymous sign-ins_ sigue **desactivado** (no se usa). Verificación: el panel muestra `Confirm email` apagado.

3. **Migración del esquema.** Aplicar con `apply_migration` (nombre `create_profiles`) el bloque completo de §3: tabla, restricción, `enable row level security`, las tres políticas, la función `handle_new_user` y el trigger. Guardar el mismo SQL en `supabase/migrations/` con el nombre que devuelva `list_migrations`. Verificación: `list_tables` muestra `public.profiles` con `rls_enabled: true`, y `get_advisors` en modo `security` no reporta nada sobre `profiles`.

4. **Tipos.** Generar `lib/database.types.ts` con `generate_typescript_types` y versionarlo. Verificación: el archivo exporta `Database` y contiene `profiles` con las tres columnas; `npx tsc --noEmit` pasa.

5. **Clientes.** Crear `lib/supabase/client.ts` (`createBrowserClient<Database>`) y `lib/supabase/server.ts` (`createServerClient<Database>` con `await cookies()`, `getAll`/`setAll` y el `try/catch` que ignora la escritura desde un Server Component). Ambos leen las variables dentro de la función, nunca en el ámbito de módulo, y señalan el caso de que falten para que el formulario pueda mostrar `config`. Verificación: `npx tsc --noEmit` pasa y ninguna página cambia de aspecto.

6. **Refresco de sesión.** Crear `lib/supabase/proxy.ts` con `updateSession(request)` siguiendo el patrón documentado —`NextResponse.next({ request })`, cliente con `getAll`/`setAll` sobre `request.cookies` y `supabaseResponse.cookies`, y la llamada a `supabase.auth.getClaims()` **sin quitarla**, que es lo que refresca el token—. Crear en la raíz **`proxy.ts`** (no `middleware.ts`) que exporte `proxy` y un `config.matcher` que excluya `_next/static`, `_next/image`, `favicon.ico` y archivos de imagen. Antes de escribirlo, leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Si faltan las variables, `updateSession` devuelve la respuesta sin tocar para que la app siga sirviéndose. Verificación: `npm run dev` arranca sin avisos de deprecación, todas las rutas cargan, y con `.env.local` ausente también.

7. **Lógica de perfiles.** Crear `lib/profiles.ts` con `USERNAME_PATTERN`, `normalizeUsername`, `validateUsername` y el tipo `AuthError`. Verificación: `npx tsc --noEmit` pasa.

8. **CSS.** Añadir a `app/globals.css`, **antes** de `/* ===== accessibility floor ===== */` (línea 2870, mismo criterio que los SPEC 02 y 03), la banda de error del formulario de acceso: borde y texto en rojo sobre fondo oscuro, monoespaciada, con el mismo lenguaje visual que `.terminal-success.error` del SPEC 03. `.btn:disabled` **ya existe** (líneas 2861-2862, lo trajo el SPEC 03) y se reutiliza tal cual. Verificación: `npm run build` pasa y el selector nuevo no colisiona con ninguno existente.

9. **Provider híbrido.** Reescribir `lib/session.ts` con el `SessionUser` de §3, `GUEST_KEY`, la lectura de `LEGACY_USER_KEY` que degrada a invitado, y `readGuest`/`writeGuest`. `readScores`, `appendScore` y `scoresForGame` **se quedan intactas**: las puntuaciones no son de este spec. Reescribir `components/session-provider.tsx` para que tras montar consulte la sesión de Supabase, se suscriba a `onAuthStateChange`, cargue el `username` del perfil y solo caiga al invitado local si no hay sesión. `signOut` llama a `supabase.auth.signOut()` si es cuenta y limpia `av_guest` si es invitado. La forma del contexto (`user`, `signIn`, `signOut`, `saveScore`) no cambia, así que `nav.tsx`, `game-player.tsx` y `hall-of-fame.tsx` **no se tocan**. Verificación: `npx tsc --noEmit` pasa; con un `av_user` antiguo en `localStorage` la nav muestra ese alias; sin nada, muestra el estado sin sesión.

10. **Formulario de acceso.** Reescribir `components/auth-form.tsx`:
    - Pestaña `INICIAR SESIÓN`: **Correo** + Contraseña → `signInWithPassword`.
    - Pestaña `CREAR CUENTA`: Usuario + Correo + Contraseña → comprobar el alias con un `select` sobre `profiles`, luego `signUp` con `options.data.username`.
    - El alias se normaliza al escribir (mayúsculas, máximo 10) y ahora es **obligatorio** al registrarse: se retira el `FALLBACK_NAME = "PLAYER1"` de esa rama.
    - Estado `"idle" | "loading" | "error"`. Durante `loading` el botón se deshabilita y dice `◌ CONECTANDO…`.
    - La banda de error traduce cada `AuthError` a su texto: `CREDENCIALES INCORRECTAS`, `ALIAS OCUPADO`, `ALIAS INVÁLIDO: 3-10 CARACTERES, A-Z 0-9 _`, `CORREO INVÁLIDO`, `CONTRASEÑA DEMASIADO CORTA`, `SUPABASE NO CONFIGURADO`, `SIN CONEXIÓN`. Un error de base de datos en el registro se traduce a `ALIAS OCUPADO` (§3).
    - `JUGAR COMO INVITADO` y los dos botones sociales quedan **exactamente como están**.
    - Al terminar bien, `router.push("/")` y `router.refresh()` para que el servidor vea la cookie nueva.

    Verificación: crear una cuenta real, cerrar sesión, volver a entrar, y comprobar en el panel que hay una fila en `auth.users` y otra en `profiles` con el mismo `id`.

11. **Repaso.** Recorrer `/`, `/games`, `/juego/caida`, `/jugar/caida`, `/salon`, `/about` y `/auth` con sesión, como invitado y sin sesión, en 1440×900 y 375×812. Comprobar que el Salón de la Fama y el HUD del reproductor siguen mostrando lo mismo que antes del cambio.

---

## 5 — Criterios de aceptación

**Compilación**

- [ ] `npm run build` termina sin errores **sin ningún `.env.local` presente**.
- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `@supabase/supabase-js` y `@supabase/ssr` son las únicas dependencias nuevas.
- [ ] No existe `middleware.ts` en la raíz; existe `proxy.ts` y `next dev` no emite avisos de deprecación.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en ninguna ruta.

**Base de datos**

- [ ] `public.profiles` existe con `id`, `username` y `created_at`, y `rls_enabled` es `true`.
- [ ] `get_advisors` en modo `security` no reporta ninguna incidencia sobre `profiles`.
- [ ] El SQL aplicado está versionado en `supabase/migrations/`.
- [ ] `lib/database.types.ts` está versionado y refleja las tres columnas.
- [ ] Insertar un `username` en minúsculas, de 2 caracteres o con un espacio es rechazado por la restricción.
- [ ] Un cliente anónimo puede hacer `select` sobre `profiles`, pero un `insert` con un `id` ajeno es rechazado por la RLS.

**Registro**

- [ ] Crear cuenta con alias, correo y contraseña deja **una** fila en `auth.users` y **una** en `profiles` con el mismo `id`.
- [ ] El alias se guarda siempre en mayúsculas, aunque se escriba en minúsculas.
- [ ] Registrarse con un alias ya existente muestra `ALIAS OCUPADO` y **no** crea usuario en `auth.users`.
- [ ] Un alias de menos de 3 caracteres o con símbolos no permitidos se rechaza antes de llamar a Supabase.
- [ ] Enviar el formulario de registro con el alias vacío no crea ninguna cuenta.
- [ ] Tras registrarse se entra directo a `/` sin pasar por ningún correo de confirmación.

**Inicio y cierre de sesión**

- [ ] La pestaña `INICIAR SESIÓN` muestra Correo y Contraseña; la de `CREAR CUENTA` muestra Usuario, Correo y Contraseña.
- [ ] Entrar con credenciales correctas lleva a `/` y la nav muestra el alias del perfil, no el correo.
- [ ] Entrar con contraseña incorrecta muestra `CREDENCIALES INCORRECTAS` y no crea sesión.
- [ ] Durante la petición el botón está deshabilitado y dice `◌ CONECTANDO…`; un doble clic no envía dos peticiones.
- [ ] Cerrar sesión desde la nav borra la sesión y la nav vuelve al estado sin sesión.
- [ ] La sesión **sobrevive a recargar la página y a cerrar y abrir el navegador**.
- [ ] La sesión sigue viva tras estar más de una hora inactiva, sin cierre aleatorio.

**Invitado y sesiones heredadas**

- [ ] `JUGAR COMO INVITADO` sigue funcionando y no crea ninguna fila en `auth.users`.
- [ ] Un `av_user` de una spec anterior aparece como invitado con el mismo alias.
- [ ] Con sesión de Supabase activa, cualquier resto en `localStorage` se ignora.
- [ ] Las puntuaciones guardadas en `localStorage` antes de esta spec siguen apareciendo en el Salón de la Fama.

**Lo que no debe cambiar**

- [ ] Las pantallas de los SPEC 01, 02 y 03 se ven exactamente igual que antes.
- [ ] El Salón de la Fama y el Detalle siguen mostrando las 12 filas deterministas de `seededScores`.
- [ ] El HUD del reproductor sigue mostrando el alias vigente, o `INVITADO`.
- [ ] `/games`, `/juego/[id]`, `/jugar/[id]`, `/salon` y `/about` siguen siendo accesibles **sin sesión**.
- [ ] `nav.tsx`, `game-player.tsx`, `hall-of-fame.tsx` y `lib/scores.ts` no aparecen modificados en el diff.
- [ ] `saveScore` sigue escribiendo en `localStorage`.

**Configuración ausente**

- [ ] Sin las variables definidas, `/`, `/games`, `/about` y `/salon` se sirven con normalidad.
- [ ] Sin las variables definidas, el formulario de acceso muestra `SUPABASE NO CONFIGURADO` en vez de romperse.
- [ ] `JUGAR COMO INVITADO` funciona incluso sin variables.

**Seguridad**

- [ ] No existe ninguna clave `service_role` ni `sb_secret_` en el repositorio ni en `.env.template`.
- [ ] `grep -rn "SUPABASE_DB_PASSWORD" app/ components/ lib/` no devuelve nada.
- [ ] `.env.local` no está versionado.
- [ ] La contraseña no se registra en consola en ningún camino de código.

**Accesibilidad**

- [ ] Los cuatro campos tienen su `<label>` asociado y el foco se ve con el contorno cian de `:focus-visible`.
- [ ] La banda de error se anuncia a lectores de pantalla (`role="alert"`).
- [ ] A 375 px el formulario no provoca scroll horizontal.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** este spec se limita a **autenticación y perfiles**. Las puntuaciones van en la SPEC 05. Decisión explícita del usuario. La sesión es dependencia de las puntuaciones y no al revés, así que este es el corte que deja las dos mitades revisables por separado.
- **No:** meter también `scores` aquí. Habría juntado dos modelos de datos, dos conjuntos de políticas y dos migraciones de datos ya existentes en un solo cambio.
- **No:** limitarse a la infraestructura sin tocar el acceso. Habría dejado el repositorio con un cliente de Supabase que nadie llama y un formulario que sigue mintiendo.
- **No:** mover `lib/games.ts` a una tabla `games`. El catálogo es estático, cabe en un archivo y nadie lo edita en caliente. Estaría en la base solo por estar.
- **Sí:** **`proxy.ts` en la raíz, no `middleware.ts`.** Next 16 renombró el convenio y marca el nombre viejo como deprecado; está verificado en los docs del paquete instalado. Toda la documentación de Supabase sigue diciendo `middleware.ts` y en este proyecto hay que traducirla.
- **No:** `middleware.ts` "porque es lo que dice Supabase". Funciona hoy y deja de funcionar en la próxima mayor, y `AGENTS.md` existe exactamente para no cometer este error.
- **Sí:** el helper vive en `lib/supabase/proxy.ts` y la raíz solo lo llama. Mismo reparto que propone Supabase, con el nombre corregido.
- **Sí:** **`@supabase/ssr` con cookies**, con clientes separados de navegador y de servidor. Es lo único que permite que un Server Component sepa quién eres. La SPEC 05 va a leer puntuaciones en servidor; hacerlo solo en cliente obligaría a rehacer esto entero dentro de una spec.
- **No:** `@supabase/supabase-js` a secas con la sesión en `localStorage`. Menos archivos hoy, reescritura completa mañana.
- **Sí:** `getClaims()` se queda en `updateSession`. Es lo que refresca el token; quitarlo provoca cierres de sesión aparentemente aleatorios. Hay criterio de aceptación explícito.
- **Sí:** **tabla `profiles` con `username` único**. Es lo que permite mostrar el alias de _otros_ jugadores en un marcador sin exponer `auth.users` ni el correo de nadie.
- **No:** el alias en `user_metadata`. Cada quien solo puede leer el suyo, así que el Salón de la Fama tendría que duplicar el nombre en cada fila.
- **No:** el alias duplicado en cada puntuación, como hace hoy `localStorage`. Cambiar de alias dejaría el historial con el viejo.
- **Sí:** `profiles.id` **es** el `auth.users.id`, sin columna `user_id` aparte. Un usuario, un perfil.
- **Sí:** **`select` público sobre `profiles`.** La tabla contiene el alias que el jugador eligió para aparecer en un marcador público y nada más: ni correo, ni fecha de nacimiento, ni nada personal. Además la comprobación de disponibilidad al registrarse la hace un cliente anónimo.
- **No:** `select` restringido a `authenticated`. Rompería el marcador para quien navega sin cuenta, que es la mayoría de visitas.
- **Sí:** el perfil lo crea un **trigger** `security definer` sobre `auth.users`. Es atómico con el alta: no puede existir un usuario sin perfil.
- **No:** insertar el perfil desde el cliente tras `signUp`. Si esa segunda llamada falla —red, pestaña cerrada— queda una cuenta sin perfil, imposible de arreglar sin intervención manual.
- **Sí:** **alias único con error claro.** Decisión explícita del usuario. Se comprueba antes de registrar y el `unique` de la base es el árbitro final.
- **No:** sufijo automático (`PX_KAI2`). Nadie quiere un alias que no eligió.
- **No:** alias repetidos. En una plataforma cuyo propósito es competir, dos `NEONFOX` en el mismo marcador lo vuelven ilegible.
- **Sí:** la comprobación previa **y** la restricción de la base. La primera da un mensaje decente; la segunda cierra la carrera entre dos registros simultáneos. Ninguna sustituye a la otra.
- **Sí:** **el correo se añade a la pestaña `INICIAR SESIÓN`.** Supabase autentica por correo y el formulario de la maqueta no lo pedía. Es el cambio mínimo.
- **No:** traducir alias → correo consultando `profiles`. Exigiría exponer los correos por RLS o por una función RPC, y filtrar el correo de todos los jugadores para ahorrar un campo es un intercambio pésimo.
- **Sí:** **sin confirmación de correo.** Decisión explícita del usuario. Ahorra `/auth/callback`, el estado "revisa tu bandeja" y una plantilla de correo.
- **Riesgo asumido:** eso permite registrarse con un correo que no es tuyo. No hay nada valioso detrás de la cuenta y queda registrado en §7.
- **Sí:** **`JUGAR COMO INVITADO` sigue siendo local**, sin fila en `auth.users`. Decisión explícita del usuario. Evita activar los inicios anónimos y no llena la tabla de usuarios de un solo uso.
- **Sí:** **provider híbrido** con `SessionUser` creciendo a `{ id, name, kind }`. Un solo `useSession()` para toda la app: `nav.tsx`, `game-player.tsx` y `hall-of-fame.tsx` no se tocan y el diff se queda en los archivos que de verdad cambian.
- **No:** un `AuthProvider` separado. Obligaría a que cada consumidor pregunte a dos contextos y a decidir cuál gana en cada sitio.
- **Sí:** un `av_user` heredado **degrada a invitado** conservando el alias. Nadie pierde su alias ni sus puntuaciones locales en el despliegue.
- **Sí:** clave nueva `av_guest`, y `av_user` solo se lee. Deja claro qué escribe esta versión y no destruye nada por si hay que revertir.
- **Sí:** **la app compila y se sirve sin las variables.** Mismo criterio que fijó el SPEC 03 para `RESEND_API_KEY`: se leen dentro de la función, nunca en el ámbito de módulo.
- **No:** romper el arranque si faltan. Dejaría el repositorio sin poder construirse en cualquier entorno sin credenciales, y `/`, `/games` y `/about` no dependen de Supabase para nada.
- **Sí:** **clave publicable** (`sb_publishable_…`) en vez de la `anon` heredada. Se rota de forma independiente y es la recomendada para proyectos nuevos.
- **Sí:** las dos variables llevan `NEXT_PUBLIC_`. Son públicas por diseño; lo que protege los datos es la RLS. No confundir con `RESEND_API_KEY`, que nunca puede salir del servidor.
- **Sí:** **migraciones por MCP** (`apply_migration`) **con copia versionada** en `supabase/migrations/`. Decisión explícita del usuario. Sin herramientas nuevas y con historial en el repositorio.
- **No:** CLI de Supabase con Docker. Añade una dependencia de desarrollo pesada para un esquema de una tabla.
- **No:** SQL pegado a mano en el panel. El repositorio se quedaría sin rastro de cómo se construyó el esquema.
- **Sí:** **tipos generados** en `lib/database.types.ts`, versionados y regenerados a mano cuando cambie el esquema. Es lo que hace que `profiles.username` lo compruebe el compilador.
- **Sí:** `lib/profiles.ts` es puro y no importa Supabase, igual que `lib/contact.ts` en el SPEC 03.
- **Sí:** **estados de carga y error en línea**, con `◌ CONECTANDO…` y una banda roja con `role="alert"`. Sin el estado de carga un doble clic manda dos registros; sin el de error, un fallo de credenciales no se distingue de que no pase nada.
- **No:** reutilizar el terminal retro del SPEC 03 en el acceso. Habría reescrito bastante más marcado del formulario a cambio de vistosidad.
- **Sí:** **`proxy.ts` solo refresca el token**, sin proteger ninguna ruta. Decisión explícita del usuario. Toda la plataforma sigue siendo pública y jugable sin cuenta, que es lo que es hoy.
- **No:** exigir sesión para `/jugar`. Cambiaría el producto, no la infraestructura.
- **Sí:** los botones `◆ GOOGLE` y `▣ GITHUB` **se quedan decorativos**. Activarlos exige dar de alta aplicaciones OAuth fuera del repositorio; su propia spec.
- **Sí:** `SUPABASE_DB_PASSWORD` se queda en `.env.template` con un comentario que aclara que ningún código la lee.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                         | Mitigación                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Seguir la documentación de Supabase al pie de la letra crea un `middleware.ts` deprecado.** Todas sus guías lo llaman así; Next 16 lo renombró a `proxy.ts`. | El paso 6 obliga a leer `proxy.md` del paquete instalado antes de escribir el archivo, y hay criterio de aceptación explícito de que `middleware.ts` no existe.                                         |
| **Quitar `getClaims()` de `updateSession` provoca cierres de sesión aleatorios**, y el síntoma aparece horas después.                                          | La llamada está en el paso 6 con la advertencia, y hay criterio de aceptación sobre la sesión tras una hora de inactividad.                                                                             |
| **Sin confirmación de correo, cualquiera se registra con un correo que no es suyo.**                                                                           | Asumido y decidido: detrás de la cuenta solo hay un alias y puntuaciones de arcade. Se activa cambiando un interruptor del panel el día que haga falta, más la ruta `/auth/callback` en su propia spec. |
| **Sin límite de intentos, el registro y el acceso son abusables.** Un bot puede llenar `auth.users` o probar contraseñas.                                      | Supabase Auth aplica sus propios límites por proyecto. Es la misma exposición que aceptó el SPEC 03 para el formulario de contacto, y la mitigación seria (captcha, límite por IP) es su propia spec.   |
| **El trigger falla y el registro devuelve un error genérico de base de datos** que no dice nada del alias.                                                     | El paso 10 lo traduce a `ALIAS OCUPADO` y la comprobación previa hace que casi nunca se llegue a ese punto. Como todo va en una transacción, no queda usuario huérfano.                                 |
| Dos personas registran el mismo alias a la vez y la comprobación previa dice que está libre a las dos.                                                         | El `unique` de la base es el árbitro: la segunda transacción se aborta y su formulario muestra `ALIAS OCUPADO`.                                                                                         |
| **La RLS mal puesta expone datos.** Es el fallo clásico de un primer proyecto de Supabase.                                                                     | RLS activada en la misma migración que crea la tabla, tres políticas explícitas, sin política de `delete`, y el paso 3 cierra con `get_advisors` en modo `security`.                                    |
| Alguien confunde la clave publicable con un secreto y mete una `service_role` en el repositorio "por simetría".                                                | §3 explica por qué una es pública y la otra no, y hay criterio de aceptación de que no existe ninguna `service_role` ni `sb_secret_` en el repositorio.                                                 |
| **El despliegue rompe las sesiones existentes** y quien tenía alias aparece como desconocido.                                                                  | `av_user` se lee y degrada a invitado con el mismo alias; hay criterio de aceptación. Las puntuaciones locales no se tocan en este spec.                                                                |
| El `SessionProvider` lee la sesión tras montar y provoca un parpadeo en la nav, o un desajuste de hidratación.                                                 | Arranca en `null` igual que hoy —el patrón del SPEC 01 que ya evita el desajuste— y la sesión llega tras montar. El parpadeo es el mismo que hay hoy con `localStorage`.                                |
| El alcance se desborda hacia las puntuaciones a mitad de implementación, porque "ya que estamos".                                                              | §2 lo excluye por escrito y hay criterio de aceptación de que `nav.tsx`, `game-player.tsx`, `hall-of-fame.tsx` y `lib/scores.ts` **no aparecen en el diff**.                                            |
| `npm run build` en un entorno limpio sin `.env.local`.                                                                                                         | Es criterio de aceptación explícito y la razón de leer las variables dentro de cada función.                                                                                                            |
| Los tipos generados se desincronizan del esquema tras una migración futura.                                                                                    | Se regeneran a mano; `npx tsc --noEmit` falla en cuanto una columna deja de existir.                                                                                                                    |

---

## Lo que **no** entra en este spec

- La tabla `scores` y la migración de las puntuaciones de `localStorage` (SPEC 05).
- Retirar `seededScores()` y sus 12 filas deterministas por juego.
- La tabla `games`. El catálogo sigue en `lib/games.ts`.
- OAuth con Google y GitHub: los botones siguen decorativos.
- Inicio de sesión anónimo de Supabase.
- Confirmación de correo, `/auth/callback` y recuperación de contraseña.
- Cambiar alias, correo o contraseña; borrar la cuenta; página de perfil o avatares.
- Proteger rutas: toda la plataforma sigue siendo pública.
- CLI de Supabase y stack local en Docker.
- Captcha, honeypot o límite de intentos propio.
- Metadatos SEO, Open Graph, sitemap o robots.
- Framework de tests.

Cada uno de ellos, si llega, va en su propia spec.
