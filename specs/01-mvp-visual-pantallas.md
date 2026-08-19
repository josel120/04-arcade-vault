# SPEC 01 — MVP visual: las cinco pantallas de Arcade Vault

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-08-19
> **Objetivo:** Portar las cinco pantallas de `references/templates/` a Next.js 16 con App Router como maqueta navegable, sin implementar ningún juego real.

---

## 1 — Por qué existe este spec

El repo está en el scaffold de `create-next-app`: `app/page.tsx` sigue siendo la plantilla generada. Existe una maqueta completa en `references/templates/` escrita como React 18 UMD + Babel standalone con routing por hash, que no es ejecutable en producción ni aprovecha nada del App Router.

Parte del trabajo ya está hecho fuera de este spec: `app/globals.css` (992 líneas) ya contiene el CSS retro completo de `styles.css` con los tokens expuestos a Tailwind v4 vía `@theme inline`, y `app/layout.tsx` ya carga Press Start 2P, JetBrains Mono y Courier Prime con `next/font/google` y pinta los fondos `.av-bg` / `.av-noise`. **Este spec no reescribe el CSS.** Lo que falta es la capa React: rutas reales, componentes tipados, datos mock en TypeScript y sesión de mentira.

La decisión estructural clave es sustituir el routing por hash del template por rutas reales del App Router. Cada juego pasa a tener una URL propia y compartible, que es la base para todo lo que venga después (juegos reales, marcadores de servidor, perfiles).

---

## 2 — Alcance

**Dentro:**

- Cinco rutas del App Router: `/` (Biblioteca), `/juego/[id]` (Detalle), `/jugar/[id]` (Reproductor), `/auth` (Acceso) y `/salon` (Salón de la Fama).
- Barra de navegación compartida con menú lateral móvil, contador de créditos estático y botón de sesión.
- Pie de página compartido, movido a `app/layout.tsx`.
- Biblioteca: hero, buscador por nombre, chips de categoría, grilla de tarjetas con inclinación 3D al pasar el ratón y estado vacío.
- Detalle: portada grande, etiquetas, descripción larga, tira de estadísticas, acciones y leaderboard lateral de 10 filas.
- Reproductor: HUD (jugador, puntuación, vidas, nivel), marco CRT con arena decorativa animada, pausa, simulación de puntuación con `setInterval`, modal de FIN DEL JUEGO y guardado de puntuación.
- Acceso: pestañas iniciar sesión / crear cuenta, campos, entrada como invitado y botones sociales decorativos.
- Salón de la Fama: pestañas por juego, podio de tres puestos, tabla de 12 filas con animación escalonada y fila destacada del jugador con sesión.
- Sesión falsa y puntuaciones en `localStorage`, gestionadas por un provider de cliente.
- Las puntuaciones guardadas desde el reproductor se leen y se mezclan en la tabla del Salón de la Fama.
- Página `app/not-found.tsx` con estética arcade para IDs y URLs inexistentes.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados a TypeScript con tipos explícitos.

**Fuera de alcance (para specs futuras):**

- Cualquier motor de juego real. El reproductor es una maqueta animada; nada es jugable.
- Backend, base de datos, API routes y autenticación real. El login no valida credenciales.
- Marcadores de servidor o puntuaciones compartidas entre usuarios.
- Perfil de usuario, avatar y ajustes de cuenta.
- Sistema de créditos funcional. `CRÉDITOS · 03` es texto fijo.
- Login social con Google o GitHub. Los botones no hacen nada.
- Sonido, música y efectos de audio.
- Internacionalización. Todo en español, cadenas escritas en el código.
- Framework de tests.
- Reescribir `app/globals.css`. Solo se añaden las reglas nuevas que pida `not-found.tsx`.
- Borrar `references/templates/`. Se queda como referencia visual.

---

## 3 — Modelo de datos

Todo el modelo vive en `lib/`. No hay persistencia de servidor.

### `lib/games.ts`

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string; // "bloque-buster" — es el segmento de URL
  title: string; // "BLOQUE BUSTER"
  short: string; // texto de la tarjeta
  long: string; // texto del detalle
  cat: GameCategory;
  cover: string; // clase CSS de portada: "cover-bricks"
  color: GameColor; // variante del botón JUGAR
  best: number;
  plays: string; // "12.4K" — ya formateado
};

export const GAMES: Game[] = [
  /* los 8 juegos de data.jsx, sin cambios */
];
export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
export function getGame(id: string): Game | undefined;
```

Los ocho juegos se copian literalmente de `references/templates/data.jsx`: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`.

### `lib/scores.ts`

```ts
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string; // "14/03/2026"
  isYou?: boolean; // true si viene de localStorage
};

export const PLAYERS: string[]; // los 18 alias del template
export function seededScores(seed: number, count?: number): ScoreRow[];
```

`seededScores` conserva el LCG del template (`s = (s * 9301 + 49297) % 233280`). Es determinista: el mismo `seed` produce siempre las mismas filas, en servidor y en cliente. Esto es lo que permite renderizar los marcadores sin desajuste de hidratación.

Las semillas se derivan del `id` igual que en el template: `id.length * 17 + 3` con 10 filas en el detalle, `id.length * 23 + 7` con 12 filas en el Salón.

### `lib/session.ts`

```ts
export type SessionUser = { name: string }; // "PX_KAI", máx. 10 chars, mayúsculas
export type SavedScore = {
  game: string;
  score: number;
  name: string;
  at: number;
};

export const USER_KEY = "av_user"; // JSON de SessionUser o ausente
export const SCORES_KEY = "av_scores"; // JSON de SavedScore[]

export function readUser(): SessionUser | null;
export function writeUser(user: SessionUser | null): void;
export function readScores(): SavedScore[];
export function appendScore(entry: Omit<SavedScore, "at">): void;
export function scoresForGame(gameId: string): SavedScore[];
```

Todas las funciones comprueban `typeof window === "undefined"` y devuelven el valor vacío en servidor. Todos los `JSON.parse` van en `try/catch`: un `localStorage` corrupto se trata como vacío, nunca revienta la pantalla.

**Convenciones:**

- Los números se formatean siempre con `toLocaleString("es-ES")`.
- Los rangos se muestran con dos dígitos: `#01`, `#02`.
- Las fechas son `DD/MM/AAAA`.

---

## 4 — Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **Datos.** Crear `lib/games.ts` con los tipos, los 8 juegos y `getGame`. Crear `lib/scores.ts` con `PLAYERS` y `seededScores` tipados. Verificación: `npx tsc --noEmit` pasa.

2. **Sesión.** Crear `lib/session.ts` con los lectores y escritores de `localStorage` protegidos para servidor. Crear `components/session-provider.tsx`: componente cliente con `createContext`, estado inicial `null`, lectura en `useEffect`, y expone `{ user, signIn, signOut, saveScore }` mediante un hook `useSession()`.

3. **Layout.** Envolver `children` en `app/layout.tsx` con `<SessionProvider>`, añadir `<Nav />`, `<main className="av-main">` y el pie de página con el texto `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`. Crear `components/nav.tsx` como componente cliente que usa `usePathname()` para el estado activo, `next/link` para los enlaces y `useSession()` para el botón de sesión. Verificación: la nav y el pie aparecen en todas las rutas.

4. **Biblioteca.** Crear `components/game-card.tsx` (tarjeta con la inclinación 3D en `onMouseMove` sobre un `useRef`) y `components/library.tsx` (hero, buscador, chips, grilla, estado vacío) con `useState` + `useMemo`. Sustituir `app/page.tsx` por el Server Component que renderiza `<Library />`. Verificación: buscar y filtrar reduce la grilla; sin resultados sale el mensaje `NO HAY RESULTADOS`.

5. **404.** Crear `app/not-found.tsx` con estética arcade (`GAME OVER · 404` y botón de vuelta a la Biblioteca), añadiendo a `app/globals.css` solo las reglas que necesite.

6. **Detalle.** Crear `components/leaderboard.tsx` (las 10 filas laterales) y `components/game-detail.tsx`. Crear `app/juego/[id]/page.tsx` como Server Component que resuelve el `id` desde `PageProps<"/juego/[id]">`, llama a `notFound()` si `getGame` no encuentra nada, y pasa el juego y las filas ya calculadas. Verificación: `/juego/caida` muestra el detalle; `/juego/xxx` muestra el 404.

7. **Reproductor, marco.** Crear `components/game-player.tsx` como componente cliente con el HUD, el marco CRT, la arena decorativa y los botones PAUSA / FIN / SALIR. Crear `app/jugar/[id]/page.tsx` con la misma resolución de `id` y `notFound()`. Verificación: `/jugar/caida` muestra el CRT; PAUSA superpone el cartel `EN PAUSA`.

8. **Reproductor, simulación.** Añadir a `game-player.tsx` el `setInterval` de 220 ms que suma puntuación, la subida de nivel cada 2500 puntos y la limpieza del intervalo al desmontar, pausar o terminar. Verificación: la puntuación sube sola y se congela al pausar.

9. **Reproductor, fin de partida.** Añadir el modal de FIN DEL JUEGO con la puntuación final, el campo de nombre (mayúsculas, 10 caracteres), el botón de guardar que llama a `saveScore` del provider, el aviso `▸ PUNTUACIÓN GUARDADA_` y los botones JUGAR DE NUEVO / VOLVER AL VAULT. Verificación: guardar deja una entrada en `av_scores`.

10. **Acceso.** Crear `components/auth-form.tsx` con las dos pestañas, los campos, el envío que llama a `signIn({ name })` y navega a `/`, la entrada como invitado que llama a `signIn({ name: "INVITADO" })` y los botones sociales decorativos. Crear `app/auth/page.tsx`. Verificación: al enviar, la nav pasa a mostrar el nombre del jugador.

11. **Salón de la Fama.** Crear `components/hall-of-fame.tsx` como componente cliente: pestañas por juego, podio, tabla con `animationDelay` escalonado y fila destacada del jugador. Las puntuaciones de `scoresForGame(tab)` se mezclan con las de `seededScores`, se ordenan por puntuación descendente y se renumeran los rangos; las propias llevan `isYou` y la clase `you`. Crear `app/salon/page.tsx`. Verificación: una puntuación guardada en el paso 9 aparece en la tabla del juego correspondiente.

12. **Repaso.** Recorrer las cinco pantallas comparándolas contra `references/templates/Arcade Vault.html` abierto al lado, en escritorio y en un ancho de 375 px.

---

## 5 — Criterios de aceptación

**Compilación**

- [ ] `npm run build` termina sin errores de tipos ni de compilación.
- [ ] `npm run lint` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en ninguna de las cinco rutas.

**Navegación**

- [ ] `/`, `/juego/caida`, `/jugar/caida`, `/auth` y `/salon` cargan directamente por URL, sin pasar por la Biblioteca.
- [ ] `/juego/no-existe` y `/jugar/no-existe` muestran la página 404 con estética arcade, no una pantalla en blanco.
- [ ] La nav marca en cian el enlace activo: Biblioteca en `/`, `/juego/*` y `/jugar/*`; Salón de la Fama en `/salon`.
- [ ] Por debajo de 840 px de ancho, los enlaces de la nav se ocultan y el botón `≡` abre el panel lateral.

**Biblioteca**

- [ ] Se muestran las 8 tarjetas con su portada CSS, categoría, descripción corta y mejor puntuación formateada.
- [ ] Escribir `serp` en el buscador deja una sola tarjeta visible.
- [ ] Pulsar el chip `PUZZLE` deja solo CAÍDA.
- [ ] Una búsqueda sin resultados muestra `NO HAY RESULTADOS`.
- [ ] Pasar el ratón sobre una tarjeta la inclina en 3D y devolverla a su sitio al salir.
- [ ] Pulsar una tarjeta o su botón JUGAR navega a `/juego/[id]`.

**Detalle**

- [ ] Se muestran portada, las cuatro etiquetas, descripción larga y las tres estadísticas (Partidas, Mejor global, Dificultad).
- [ ] El leaderboard lateral muestra 10 filas con los tres primeros puestos en oro, plata y bronce.
- [ ] `▶ JUGAR AHORA` navega a `/jugar/[id]`; `VOLVER AL VAULT` navega a `/`.

**Reproductor**

- [ ] El HUD muestra el nombre del jugador con sesión, o `INVITADO` si no hay sesión.
- [ ] La puntuación sube sola de forma continua mientras la partida está activa.
- [ ] `PAUSA` detiene el contador y superpone `EN PAUSA`; `REANUDAR` lo reactiva.
- [ ] `FIN` abre el modal con la puntuación final formateada.
- [ ] Guardar la puntuación reemplaza el formulario por `▸ PUNTUACIÓN GUARDADA_` y añade una entrada a `av_scores`.
- [ ] `JUGAR DE NUEVO` reinicia puntuación a 0, vidas a 3 y nivel a 01.
- [ ] Salir de `/jugar/[id]` detiene el intervalo (no quedan avisos de actualización sobre componente desmontado).

**Acceso**

- [ ] Las pestañas alternan entre iniciar sesión y crear cuenta; el campo de correo solo aparece en crear cuenta.
- [ ] Enviar el formulario guarda el nombre en mayúsculas y con 10 caracteres como máximo, y navega a `/`.
- [ ] `JUGAR COMO INVITADO` inicia sesión como `INVITADO` y navega a `/`.
- [ ] Con sesión iniciada, la nav muestra el nombre del jugador; pulsarlo cierra la sesión y vuelve a mostrar `Iniciar Sesión`.
- [ ] Recargar la página conserva la sesión.

**Salón de la Fama**

- [ ] Las pestañas listan los 8 juegos y cambian el podio y la tabla.
- [ ] El podio muestra los puestos 01, 02 y 03 con sus bordes en oro, plata y bronce.
- [ ] La tabla muestra 12 filas con la animación de entrada escalonada.
- [ ] Con sesión, aparece la fila `▸ TU MEJOR MARCA` destacada en amarillo.
- [ ] Una puntuación guardada desde el reproductor aparece en la tabla de ese juego, en la posición que le corresponde por puntuación.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** rutas reales del App Router (`/juego/[id]`, `/jugar/[id]`). Da URLs compartibles por juego y es la base para cualquier funcionalidad de servidor futura.
- **No:** portar `app.jsx` tal cual como SPA con estado en un único `page.tsx`. Sería más fiel al template, pero desaprovecha el App Router y no da URLs por juego.
- **No:** rutas interceptadas para abrir el reproductor como modal sobre el detalle. Complejidad sin valor en un MVP visual.
- **Sí:** el CSS del template vive íntegro en `app/globals.css`, y los componentes usan las mismas `className` (`av-nav`, `crt`, `cover-bricks`…). Garantiza fidelidad visual del 100% en los efectos CRT, neón y portadas generadas.
- **No:** convertir las 992 líneas a utilidades de Tailwind. Los efectos complejos (scanlines, `::after` de las portadas, keyframes) acabarían en CSS de todos modos, con mucho más riesgo de desviación visual.
- **No:** enfoque híbrido con el layout en Tailwind y los efectos en CSS. Dos fuentes de verdad para el mismo componente.
- **Sí:** `localStorage` con las claves `av_user` y `av_scores`, iguales a las del template. Cero backend y permite ver los estados de UI con sesión.
- **Sí:** un `SessionProvider` de cliente que arranca en `null` y lee `localStorage` en `useEffect`. Servidor y primer render coinciden, así que no hay desajuste de hidratación.
- **No:** leer `localStorage` desde cada pantalla por su cuenta. Duplica lógica y desincroniza la nav al iniciar o cerrar sesión.
- **No:** un estado de carga en la nav para evitar el parpadeo de `Iniciar Sesión` → nombre del jugador. Un frame de parpadeo es aceptable; añadir estados no lo justifica.
- **Sí:** las puntuaciones guardadas se leen en el Salón de la Fama y se mezclan con las mock. El template las escribía sin leerlas nunca, dejando el ciclo jugar → guardar → ver a medias.
- **No:** mezclarlas también en el leaderboard del detalle. Se puede añadir después; no es necesario para cerrar el ciclo.
- **Sí:** `notFound()` más un `app/not-found.tsx` con estética arcade. El template hacía `return null`, que dejaba la pantalla en blanco.
- **No:** redirigir a `/` en silencio cuando el `id` no existe. El usuario no entendería qué ha pasado.
- **Sí:** la simulación completa del reproductor (contador, vidas, nivel, pausa, modal). Es la maqueta visual de la pantalla; sin ella el 60% de sus estados no se puede ver.
- **Sí:** filtros de la Biblioteca con `useState` local, sin tocar la URL. Nadie va a compartir un enlace de búsqueda filtrada en un MVP visual.
- **No:** `useSearchParams` con su `Suspense boundary`. Complejidad sin retorno aquí.
- **Sí:** `components/` y `lib/` en la raíz. Encaja con el alias `@/*` ya configurado y separa la UI de las rutas.
- **Sí:** verificación por `npm run build`, `npm run lint` y repaso visual contra el template. El proyecto no tiene framework de tests y no se añade uno para un MVP puramente visual.
- **No:** añadir Vitest o Playwright. Va en su propia spec cuando haya lógica de juego que merezca cubrirse.
- **Sí:** `references/templates/` se queda en el repo como fuente de verdad visual. No se importa desde el código de la app.
- **Sí:** se corrige el fallo del template donde `JUGAR COMO INVITADO` llamaba a `onLogin(null)`, que dejaba la sesión vacía en lugar de iniciar como invitado.

---

## 7 — Riesgos identificados

| Riesgo                                                               | Mitigación                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Desajuste de hidratación por leer `localStorage` durante el render   | El `SessionProvider` arranca en `null` y solo lee dentro de `useEffect`. Servidor y primer render coinciden siempre.                     |
| `seededScores` produciendo filas distintas en servidor y cliente     | El generador es un LCG determinista sin `Date.now()` ni `Math.random()`. Mismo `seed`, mismas filas.                                     |
| `localStorage` deshabilitado o corrupto (modo privado)               | Todas las lecturas van en `try/catch` y devuelven el valor vacío. La app funciona, simplemente no persiste.                              |
| El `setInterval` del reproductor sigue vivo tras salir de la ruta    | El `useEffect` devuelve su `clearInterval` y depende de `paused` y `over`.                                                               |
| Las clases del template chocan con las utilidades de Tailwind        | Los nombres del template llevan prefijo (`av-`) o son específicos (`crt`, `podium-slot`); no colisionan con las utilidades generadas.    |
| `LayoutProps` / `PageProps` no existen antes del primer build        | Son tipos globales generados en `.next/types`. Requieren un `next dev` o `next build` previo.                                            |
| Los tipos de props de ruta cambian en Next 16 respecto a lo conocido | Antes de escribir `app/juego/[id]/page.tsx`, leer la documentación en `node_modules/next/dist/docs/01-app/`, tal como exige `AGENTS.md`. |

---

## Lo que **no** entra en este spec

- Ningún juego real. Nada de lo que se implementa aquí es jugable.
- Backend, base de datos, API routes ni autenticación real.
- Marcadores de servidor o puntuaciones compartidas entre usuarios.
- Perfil de usuario y ajustes de cuenta.
- Sistema de créditos funcional.
- Login con Google o GitHub.
- Sonido y música.
- Internacionalización.
- Framework de tests.

Cada uno de ellos, si llega, va en su propia spec.
