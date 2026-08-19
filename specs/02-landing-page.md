# SPEC 02 — Landing page y reorganización de rutas

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-19
> **Objetivo:** Portar la landing de `references/home-about/home.jsx` a la raíz `/` y mover la Biblioteca actual a `/games`, dejando la nav con tres enlaces.

---

## 1 — Por qué existe este spec

El SPEC 01 dejó cinco pantallas navegables, pero la raíz `/` es la Biblioteca: entras directamente a una rejilla de tarjetas sin que nadie te haya explicado qué es Arcade Vault. No hay landing, no hay propuesta de valor y no hay ninguna puerta de entrada para quien llega por primera vez.

En `references/home-about/` existe una landing completa (`home.jsx`, 338 líneas) escrita con el mismo enfoque que los templates del SPEC 01: React UMD con routing por hash. Su CSS vive en `references/home-about/styles.css` y **ninguna de sus clases está todavía en `app/globals.css`** — ni `home-hero`, ni `feature-card`, ni `mini-rail`, ni `activity-grid`, ni `pricing-grid`, ni `home-final`, ni `reveal`.

Este spec hace dos cosas a la vez, y por eso son un solo spec y no dos: **la landing solo tiene sentido en `/`**, y ponerla en `/` obliga a mover la Biblioteca. Separarlas dejaría un estado intermedio con dos páginas peleándose por la raíz.

La página **Acerca de** de `references/home-about/about.jsx` queda explícitamente fuera. Va en su propio spec.

---

## 2 — Alcance

**Dentro:**

- Nueva ruta `/` con la landing completa: hero, `// 01` características, `// 02` preview de juegos, franja de estadísticas, `// 03` actividad en vivo, `// 04` precios y FAQ, y CTA final.
- Mover la Biblioteca de `/` a `/games`. El componente `components/library.tsx` no se toca.
- Nav con tres enlaces: **Inicio** (`/`), **Juegos** (`/games`) y **Salón de la Fama** (`/salon`), en la barra de escritorio y en el panel lateral móvil.
- Redirigir a `/` los seis enlaces que hoy apuntan a la raíz queriendo decir "Biblioteca": logo de la nav, `VOLVER AL VAULT` del detalle, `VOLVER AL VAULT` del reproductor, botón de vuelta del Salón, botón del 404 y el `router.push` de `auth-form`.
- Portar a `app/globals.css` los bloques de CSS de la landing desde `references/home-about/styles.css`: `HOME PAGE` (líneas 930–1069), `ACTIVITY` (1621–1670) y `PRICING` (1672–1725).
- Datos mock estáticos y tipados en `lib/landing.ts` para el ticker de puntuaciones, el top 5 de jugadores, las cuatro características, las tres estadísticas y las tres preguntas frecuentes.
- Hook `useReveal` con `IntersectionObserver` para la animación de entrada por scroll.
- Ocho siluetas pixel SVG flotantes en el hero y cuatro iconos pixel SVG en las tarjetas de características, portados como componentes.
- Ajustes al bloque `prefers-reduced-motion` de `app/globals.css` para que `.reveal` y `.tick-row` no se queden invisibles.
- **CSS nuevo, no portado** (añadido durante la implementación; ver §6): `.hero-eyebrow .blink`, los estilos de `.tp-bar` / `.tp-fill`, `min-width: 0` en `.activity-card` y el reposicionamiento de `.hero-scroll`.

**Fuera de alcance (para specs futuras):**

- La página **Acerca de** (`references/home-about/about.jsx`) y su formulario de contacto con terminal. Spec propio.
- El enlace `Acerca de` en la nav. No se añade hasta que exista la página.
- El bloque de CSS del gamepad (`.gp*`, líneas 1151–1619 de la referencia). No lo usa la landing.
- Cualquier dato real en la actividad en vivo. El ticker y el top 5 son constantes escritas a mano; no leen `localStorage` ni `seededScores`.
- Redirección o `redirect()` desde `/` antiguo. No hay URLs publicadas que preservar.
- Metadatos SEO, Open Graph, `sitemap.ts` o `robots.ts`.
- Tocar `components/library.tsx`. El hero de la Biblioteca sigue diciendo `ARCADE VAULT`.
- Cambiar el texto `VOLVER AL VAULT`. Con `/` convertida en landing, "el Vault" pasa a ser precisamente la landing, así que el texto queda coherente sin tocarlo.
- Sistema de precios o pasarela de pago. La sección `// 04` es puramente informativa: el plan es `$0`.
- Framework de tests.

---

## 3 — Modelo de datos

Todos los datos nuevos son constantes estáticas en un archivo nuevo. No hay persistencia ni estado de servidor.

### `lib/landing.ts`

```ts
import type { GameColor } from "@/lib/games";

export type FeatureKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export type Feature = {
  kind: FeatureKind; // selecciona el icono pixel SVG
  title: string; // "JUEGOS CLÁSICOS"
  desc: string;
  color: GameColor; // "cyan" | "magenta" | "yellow" | "green"
};

export type StatBlock = {
  n: string; // "12+" — literal, no derivado de GAMES.length
  u: string; // "JUEGOS"
  s: string; // "Y CONTANDO"
};

export type TickerRow = {
  player: string; // "NEONFOX"
  game: string; // "Caída" — texto libre, no es un Game["id"]
  score: number;
  ago: string; // "hace 2 min" — cadena fija, nunca se recalcula
  color: GameColor;
};

export type TopPlayer = {
  rank: number; // 1..5
  player: string;
  score: number;
};

export type FaqItem = { q: string; a: string };

export const FEATURES: Feature[]; // 4 entradas
export const STATS: StatBlock[]; // 3 entradas
export const TICKER: TickerRow[]; // 7 entradas
export const TOP_PLAYERS: TopPlayer[]; // 5 entradas
export const PRICE_PERKS: string[]; // 6 entradas
export const FAQ: FaqItem[]; // 3 entradas
```

Todo el contenido se copia literalmente de `references/home-about/home.jsx`. `TICKER` y `TOP_PLAYERS` conservan los valores del template (`NEONFOX` 184220 "hace 2 min", `PX_KAI` 96400 "hace 5 min", …; top 1 `NEONFOX` 312840). `STATS` mantiene `12+ JUEGOS` aunque `GAMES` tenga ocho entradas: es texto de marketing, no un dato derivado.

La barra del top 5 conserva la fórmula del template: `width: (100 - i * 16) + "%"`.

**Convenciones (heredadas del SPEC 01):**

- Los números se formatean con `toLocaleString("es-ES")`.
- Los rangos se muestran con dos dígitos: `#01`.
- No hay ningún `Date.now()` ni `Math.random()` en el render: la landing es determinista y no puede producir desajuste de hidratación.

La preview de juegos de `// 02` no introduce datos nuevos: usa `GAMES.slice(0, 6)` de `lib/games.ts`.

---

## 4 — Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **Mover la Biblioteca.** Crear `app/games/page.tsx` con el mismo contenido que tiene hoy `app/page.tsx` (renderiza `<Library />`). Dejar `app/page.tsx` temporalmente igual. Verificación: `/games` y `/` muestran ambas la Biblioteca.

2. **CSS de la landing.** Añadir al final de `app/globals.css` los tres bloques de `references/home-about/styles.css`: `HOME PAGE` (930–1069), `ACTIVITY` (1621–1670) y `PRICING` (1672–1725), incluidos sus `@keyframes` (`float`, `bounce`, `tickin`) y sus `@media`. Añadir al bloque `prefers-reduced-motion` existente las reglas `.reveal { opacity: 1; transform: none; }` y `.tick-row { opacity: 1; }`. Verificación: `npm run build` pasa y no hay clases duplicadas con las ya presentes.

   > **Al implementar:** los tres bloques se insertaron **antes** de `/* ===== accessibility floor ===== */`, no al final del archivo, para que las reglas de movimiento reducido sigan ganando por orden de fuente. Se contrastaron los 64 selectores y los 4 `@keyframes` contra `app/globals.css`: cero colisiones. A este bloque portado se le sumaron después cuatro reglas **nuevas**, decididas durante los pasos 6, 8 y 12 y justificadas en §6: `.hero-eyebrow .blink`, `.tp-bar` / `.tp-fill` (con sus variantes de podio), `min-width: 0` en `.activity-card` y `bottom: 24px` en `.hero-scroll`.

3. **Datos.** Crear `lib/landing.ts` con los tipos y las seis constantes. Verificación: `npx tsc --noEmit` pasa.

4. **Hook de scroll.** Crear `components/use-reveal.ts`: hook cliente que en `useEffect` observa todos los `.reveal` con `IntersectionObserver` (`threshold: 0.12`), les añade `in` al entrar y deja de observarlos, y devuelve `io.disconnect()` en la limpieza. Si `matchMedia("(prefers-reduced-motion: reduce)")` está activo, añade `in` a todos de golpe sin observar nada.

5. **Decoración SVG.** Crear `components/pixel-art.tsx` con dos exportaciones: `<FloatingSilhouettes />` (las ocho siluetas `s1`–`s8` dentro de `.home-silos`, con `aria-hidden`) y `<FeatureIcon kind={...} />` (los cuatro iconos de 16×16 dibujados con `<rect>`, coloreados con `currentColor`). Ambos portados literalmente de `home.jsx`.

6. **Hero.** Crear `components/landing.tsx` como componente cliente que llama a `useReveal()` y renderiza por ahora solo `<section className="home-hero">`: eyebrow `▸ INSERTA UNA MONEDA_`, título en tres líneas, subtítulo, los dos CTA (`▶ EXPLORAR JUEGOS` → `/games`, `✦ CREAR CUENTA` → `/auth`) y el indicador `DESLIZA ▼`. Sustituir `app/page.tsx` por el Server Component que renderiza `<Landing />`. Verificación: `/` muestra el hero a pantalla completa con las siluetas flotando; `/games` sigue mostrando la Biblioteca.

7. **Secciones 01 y 02.** Añadir a `landing.tsx` la sección de características (rejilla de 4 con `transitionDelay` escalonado de 80 ms) y la de preview con `GAMES.slice(0, 6)`. Crear `components/mini-card.tsx` con `next/link` a `/juego/[id]`, más el botón `VER TODOS LOS JUEGOS →` a `/games`. Verificación: al hacer scroll, ambas secciones aparecen con la animación; pulsar una mini-tarjeta lleva al detalle de ese juego.

8. **Estadísticas y actividad.** Añadir la franja `.home-stats` con `STATS` y la sección `// 03` con las dos tarjetas: ticker (`TICKER`, con `animationDelay` escalonado de 60 ms) y top 5 (`TOP_PLAYERS`, con las clases `top1`/`top2`/`top3` y la barra proporcional). El botón `VER SALÓN →` enlaza a `/salon`. Verificación: las filas del ticker entran escalonadas y el podio del top 5 se pinta en oro, plata y bronce.

9. **Precios, FAQ y cierre.** Añadir la sección `// 04` con la tarjeta de plan único (`$0 / SIEMPRE`, `PRICE_PERKS`, sello `FREE PLAY`, CTA `EMPEZAR GRATIS →` a `/auth`), la columna de `FAQ`, y la sección final `¿LISTO PARA JUGAR?` con `INSERTAR MONEDA →` a `/games`. Verificación: la landing se recorre entera sin scroll horizontal en escritorio y a 375 px.

10. **Nav.** Actualizar `components/nav.tsx`: el logo pasa a enlazar a `/`; los enlaces pasan a ser `Inicio` (`/`), `Juegos` (`/games`) y `Salón de la Fama` (`/salon`), tanto en la barra como en el panel móvil. Recalcular el estado activo: `Inicio` solo con `pathname === "/"`; `Juegos` con `/games`, `/juego/*` y `/jugar/*`. Verificación: cada ruta marca en cian exactamente un enlace.

11. **Enlaces de vuelta.** Cambiar a `/` los destinos de `components/game-detail.tsx` (`VOLVER AL VAULT`), `components/game-player.tsx` (`VOLVER AL VAULT`), `components/hall-of-fame.tsx` (botón de vuelta), `app/not-found.tsx` (botón de vuelta) y los dos `router.push("/")` de `components/auth-form.tsx`. Los textos no cambian. Verificación: `grep -rn 'href="/"' components/ app/` devuelve solo destinos intencionados.

    > **Al implementar: cero cambios de destino.** Los seis sitios ya apuntaban a `/`, así que al convertirse `/` en la landing (paso 6) pasaron a llevar donde debían sin editar una línea. Este paso previó un trabajo que se disolvió al elegir la landing como destino en lugar de `/games`.
    >
    > **Lo que sí hubo fueron cambios de texto**, no contemplados aquí: dos botones decían `VOLVER A LA BIBLIOTECA` (en `app/not-found.tsx` y en `components/hall-of-fame.tsx`) y pasaron a `VOLVER AL INICIO`, porque prometían la Biblioteca y entregaban la landing, y porque "Biblioteca" dejó de ser el nombre de ninguna sección. La frase del 404 pasó de "vuelve a la Biblioteca" a "vuelve al inicio". El texto `VOLVER AL VAULT` del detalle y del reproductor **no** se tocó, como manda el alcance: sigue siendo cierto.

12. **Repaso.** Recorrer `/`, `/games`, `/juego/caida`, `/jugar/caida`, `/auth` y `/salon` comparando la landing contra `references/home-about/arcade-vault-standalone.html` abierto al lado, en escritorio y a 375 px.

---

## 5 — Criterios de aceptación

Verificados en el paso 12 con Playwright sobre `next dev`, en 1440×900 y 375×812.

**Compilación**

- [x] `npm run build` termina sin errores de tipos ni de compilación.
- [x] `npm run lint` termina sin errores.
- [x] La consola del navegador no muestra errores ni avisos de hidratación en `/` ni en `/games`.

**Rutas**

- [x] `/` muestra la landing, no la Biblioteca.
- [x] `/games` muestra la Biblioteca con sus 8 tarjetas, buscador y chips, exactamente igual que antes.
- [x] `/juego/[id]`, `/jugar/[id]`, `/auth` y `/salon` siguen funcionando sin cambios visibles.
- [x] No queda ningún enlace en la app apuntando a `/` con la intención de llegar a la Biblioteca.

**Nav**

- [x] La barra muestra tres enlaces: `Inicio`, `Juegos` y `Salón de la Fama`. No aparece `Acerca de`.
- [x] En `/` se marca en cian `Inicio`; en `/games`, `/juego/caida` y `/jugar/caida` se marca `Juegos`; en `/salon` se marca `Salón de la Fama`.
- [x] Pulsar el logo desde cualquier ruta lleva a `/`.
- [x] Por debajo de 840 px el panel lateral muestra los mismos tres enlaces más el de sesión.

**Landing — hero**

- [x] El hero ocupa la altura de la ventana menos la nav y muestra las ocho siluetas pixel flotando con su color y su retardo propios.
- [x] El título aparece en tres líneas: `EL ARCADE` en blanco, `CLÁSICO ESTÁ` y `DE VUELTA` con sus colores neón.
- [x] `▶ EXPLORAR JUEGOS` navega a `/games` y `✦ CREAR CUENTA` navega a `/auth`.
- [x] El eyebrow `▸ INSERTA UNA MONEDA` termina con el guion bajo parpadeante. — Requirió la regla nueva `.hero-eyebrow .blink`; con el CSS solo portado el guion salía estático.

**Landing — secciones**

- [x] Las cuatro tarjetas de `// 01` muestran su icono pixel con el brillo de su color (cian, amarillo, magenta, verde).
- [x] `// 02` muestra exactamente 6 mini-tarjetas con la portada CSS del juego; pulsar una navega a `/juego/[id]`.
- [x] `VER TODOS LOS JUEGOS →` navega a `/games`.
- [x] La franja de estadísticas muestra `12+ JUEGOS`, `MILES DE PARTIDAS` y `GLOBAL RANKING`.
- [x] El ticker de `// 03` muestra las 7 filas con las puntuaciones formateadas con separador de miles y su tiempo relativo. — En escritorio. **A 375 px solo se ven 3 de las 7**: el `max-height: 360px` de `.ticker` recorta el contenido, que apilado mide 719 px. Es comportamiento del template (un feed deliberadamente recortado) y se deja como está.
- [x] El top 5 muestra las barras decrecientes y los tres primeros en oro, plata y bronce. — Requirió estilar `.tp-bar` y `.tp-fill`, que el template dejaba sin reglas.
- [x] `VER SALÓN →` navega a `/salon`.
- [x] `// 04` muestra `$0 / SIEMPRE`, las 6 ventajas, el sello `FREE PLAY` girado y las 3 preguntas frecuentes con su borde izquierdo de color distinto.
- [x] `EMPEZAR GRATIS →` navega a `/auth` e `INSERTAR MONEDA →` navega a `/games`.

**Animación**

- [x] Al cargar `/`, las secciones bajo el pliegue están ocultas y aparecen al entrar en pantalla al hacer scroll. — Las 6 secciones `.reveal` reciben `in` al hacer scroll.
- [x] Con `prefers-reduced-motion: reduce` activo, todas las secciones y las filas del ticker son visibles desde el primer render.
- [x] Salir de `/` no deja el `IntersectionObserver` conectado.

**Responsive**

- [ ] A 375 px de ancho no hay scroll horizontal en ninguna sección de la landing. — **No se cumple, por causa ajena a este spec.** El desbordamiento propio de la landing (`.activity-card`, 340 px sobre una pista de 296) se corrigió con `min-width: 0`. El que queda lo produce el botón `≡` de la nav: logo (119) + botón de sesión (123) + hamburguesa (57) no caben en 360 px. Es deuda del SPEC 01 — se reproduce igual en `/games`, que este spec no toca — y a esa anchura la nav ya oculta `.links`, así que el tercer enlace añadido aquí no influye. Merece su propia spec para arreglarse en todas las rutas a la vez.
- [x] La rejilla de características pasa a 2 columnas por debajo de 980 px y a 1 por debajo de 520 px.
- [x] La rejilla de precios y la de actividad pasan a una columna por debajo de 900 px.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** `/` pasa a ser la landing y la Biblioteca se mueve a `/games`. Es donde se espera una landing y coincide con la nav de la referencia, que lista `Inicio` antes que `Biblioteca`.
- **No:** dejar la landing en `/inicio` y la Biblioteca en `/`. Habría evitado tocar seis enlaces, pero deja la landing en una URL que nadie escribe y el logo llevando a la rejilla de juegos.
- **Sí:** la ruta se llama `/games` en inglés y el enlace de la nav dice `Juegos`. Decisión explícita del usuario.
- **Sí:** el `h1` de la Biblioteca sigue diciendo `ARCADE VAULT`. Este spec no modifica `components/library.tsx`, lo que reduce el riesgo de romper una pantalla ya validada.
- **Sí:** todos los enlaces de vuelta (`VOLVER AL VAULT` del detalle y del reproductor, el del Salón, el del 404) y el `router.push` tras iniciar sesión apuntan a `/`. Cualquier vía de salida devuelve a la landing.
- **No:** apuntarlos a `/games`. Habría sido más directo para quien solo quiere cambiar de juego, pero rompe la lectura del texto `VOLVER AL VAULT`, que con esta reorganización describe exactamente la landing.
- **Sí:** la landing lleva las cuatro secciones de la referencia, precios y FAQ incluidos. Refuerzan el mensaje de que la plataforma es gratis, que es lo que responde la sección `// 04`.
- **Sí:** los datos de actividad son mock estático literal en `lib/landing.ts`. Determinista, sin `Date.now()`, sin riesgo de desajuste de hidratación, y los tiempos relativos son cadenas fijas.
- **No:** derivarlos de `seededScores()` y `GAMES`. Sería más coherente con el resto de la app, pero los alias y los tiempos relativos habría que inventarlos igualmente, así que solo añade indirección.
- **No:** mezclar en el ticker las puntuaciones guardadas en `localStorage`. Obligaría a manejar el estado sin sesión en una sección puramente decorativa. Se puede añadir después.
- **Sí:** `STATS` mantiene el literal `12+ JUEGOS` aunque `GAMES` tenga ocho. Es una cifra de marketing de la referencia, decidida explícitamente.
- **Sí:** `useReveal` con `IntersectionObserver`, igual que la referencia, con salida por `prefers-reduced-motion`. Sin él se pierde buena parte del efecto de la landing.
- **No:** animar por scroll con CSS puro (`animation-timeline`). Soporte irregular y no aporta nada frente a un observer de 12 líneas.
- **Sí:** `components/landing.tsx` es un único componente cliente. Necesita el hook de scroll y no hay ningún dato de servidor que justifique trocearlo.
- **No:** partir cada sección en su propio archivo. Son bloques estáticos que solo se usan aquí; siete archivos para una sola página es ruido.
- **Sí:** el CSS se copia de `references/home-about/styles.css` a `app/globals.css` sin traducir a Tailwind, con la misma decisión y por las mismas razones que el SPEC 01.
- **Sí:** `references/home-about/` se queda en el repo como fuente de verdad visual, igual que `references/templates/`. No se importa desde el código de la app.
- **No:** portar el bloque `.gp*` del gamepad. Ocupa 470 líneas de CSS y ni la landing ni la página Acerca de lo usan.
- **No:** añadir ya el enlace `Acerca de` a la nav apuntando a una ruta inexistente. Un enlace de la barra principal que cae en el 404 es peor que no tenerlo.

### Decisiones tomadas durante la implementación

El spec daba por hecho que bastaba con portar el CSS de la referencia. No bastó: el template arrastra cuatro defectos latentes que solo se ven al montarlo. Cada uno se resolvió con una regla nueva, acotada, y sin tocar nada del SPEC 01.

- **Sí:** regla nueva `.hero-eyebrow .blink`. La única `.blink` del proyecto está acotada a `.av-hero .sub`, así que en la landing el guion no parpadeaba. En la referencia original tampoco lo hace. Se acota al eyebrow y reutiliza el `@keyframes blink` existente.
- **No:** desacotar `.blink` a regla global. Habría tocado una regla que la pantalla de juegos ya usa, fuera del alcance de este spec.
- **Sí:** estilar `.tp-bar` y `.tp-fill`. El template deja `.tp-bar` como absoluto de tamaño cero y `.tp-fill` sin ninguna regla, así que el `width: 100 - i*16 %` que calcula no pintaba nada: la única "barra" era un `::before` del mismo ancho en las cinco filas. Se le devuelve su columna del grid, con el relleno en oro, plata y bronce para los tres primeros.
- **No:** borrar el marcado muerto `.tp-bar` / `.tp-fill` y corregir el criterio. Se prefirió cumplir el criterio tal como estaba escrito.
- **Sí:** `min-width: 0` en `.activity-card`. Como item de grid con `min-width: auto`, el `white-space: nowrap` de `.ac-title` (310 px) la estiraba a 340 px sobre una pista de 296 y desbordaba la pantalla a 375 px. Con esto, el `text-overflow: ellipsis` que ya traía por fin se aplica.
- **Sí:** sacar `.hero-scroll` de `.home-hero-inner` y pasar su `bottom: -20px` a `24px`. Anclado al bloque interior, el indicador `DESLIZA ▼` se montaba 15 px sobre los botones del hero. Ahora se apoya en el pie de la sección a pantalla completa, que es donde se espera.
- **No:** arreglar el desbordamiento del botón `≡` de la nav a 375 px. Es previo a este spec y afecta a las cinco pantallas del SPEC 01; tocarlo aquí significaría modificar la nav de rutas ya validadas por un problema que este spec no introdujo.
- **Sí:** actualizar a `VOLVER AL INICIO` los dos botones que decían `VOLVER A LA BIBLIOTECA`. Prometían una sección que ya no se llama así y llevaban a otro sitio.
- **Nota:** los `transitionDelay` escalonados de `.feature-card` (80 ms) y `.stat-block` (90 ms) que pide el plan **no producen entrada escalonada**. `.feature-card` solo transiciona el hover y `.stat-block` no tiene ninguna `transition`; la entrada la hace la sección entera vía `.reveal`. Se conservan por fidelidad a la referencia. El único escalonado real es el del ticker, que sí usa `animation`.

---

## 7 — Riesgos identificados

| Riesgo                                                                   | Mitigación                                                                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queda algún enlace apuntando a `/` esperando la Biblioteca               | El paso 11 revisa los seis sitios conocidos y cierra con un `grep -rn 'href="/"' components/ app/` sobre el resultado.                                    |
| Las clases nuevas del CSS chocan con las 1032 líneas ya presentes        | Los tres bloques que se portan (`HOME PAGE`, `ACTIVITY`, `PRICING`) no existen hoy en `app/globals.css`; se verifica antes de pegarlos.                   |
| `.reveal` deja la página en blanco si el `IntersectionObserver` no corre | El hook añade `in` a todo de golpe con `prefers-reduced-motion`, y el bloque de movimiento reducido de `globals.css` fuerza `opacity: 1`.                 |
| El hero a `100vh` se corta en navegadores móviles con barra dinámica     | Se conserva el `calc(100vh - 60px)` de la referencia y se revisa a 375 px en el paso 12.                                                                  |
| `GAMES.slice(0, 6)` se rompe si en el futuro hay menos de 6 juegos       | `slice` devuelve lo que haya sin error; la rejilla simplemente muestra menos tarjetas.                                                                    |
| Los tipos de props de ruta de Next 16 en `app/games/page.tsx`            | La ruta no tiene parámetros dinámicos, pero antes de escribirla se lee la documentación en `node_modules/next/dist/docs/01-app/`, como exige `AGENTS.md`. |
| **Materializado:** el CSS del template arrastra defectos que solo se ven al montarlo | Aparecieron cuatro (parpadeo, barras del top 5, desbordamiento de `.activity-card`, solape de `DESLIZA`). Los cuatro se corrigieron con reglas nuevas acotadas; ver §6. El riesgo estaba mal enunciado: se temían colisiones con el CSS existente, y el problema real fue el CSS portado que no hacía lo que aparentaba. |

---

## Lo que **no** entra en este spec

- La página **Acerca de** y su formulario de contacto.
- El enlace `Acerca de` en la nav.
- El CSS del gamepad (`.gp*`).
- Datos reales en la actividad en vivo.
- Metadatos SEO, Open Graph, sitemap o robots.
- Cambios en `components/library.tsx`.
- Sistema de precios o pasarela de pago.
- Framework de tests.

Cada uno de ellos, si llega, va en su propia spec.
