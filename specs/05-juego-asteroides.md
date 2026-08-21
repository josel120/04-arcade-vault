# SPEC 05 — ASTEROIDES: el primer juego real y la tabla de puntuaciones

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04
> **Fecha:** 2026-08-21
> **Objetivo:** Portar el clon de Asteroids de `references/started-games/02-asteroids/` a un motor TypeScript montado en el reproductor de la plataforma, y crear la tabla `public.scores` donde las cuentas guardan la puntuación de cada partida.

---

## 1 — Por qué existe este spec

El SPEC 01 dejó cinco pantallas navegables y declaró, con todas las letras, que _"el reproductor es una maqueta animada; nada es jugable"_. Y así sigue: `components/game-player.tsx` tiene un `setInterval` que suma `10 + Math.random() * 90` puntos cada 220 ms, tres vidas que son un `useState` sin _setter_, un nivel que se deriva de dividir la puntuación entre 2500, y una arena de CSS con tres `div` llamados `.enemy` flotando sobre una rejilla. Pulsar FIN abre un modal que guarda ese número inventado en `localStorage`.

El SPEC 04 conectó Supabase y dio a cada jugador un alias real en `public.profiles`. Ahora hay identidad, pero no hay nada que puntuar: el esquema `public` tiene exactamente una tabla y ningún juego que la alimente.

En `references/started-games/` hay tres juegos ya escritos y funcionando: `02-asteroids`, `03-tetris` y `04-arkanoid`. El de asteroides son ~500 líneas de canvas 2D sin dependencias: clases `Bullet`, `Asteroid`, `Ship`, `Particle` y `PowerUp`, un bucle de `requestAnimationFrame` con `dt` capado a 50 ms, envolvimiento toroidal, división de rocas en fragmentos y un power-up de disparo triple. Está terminado. Lo que no está es _dentro_ de la plataforma: vive en un `index.html` suelto con todo su estado en variables globales de módulo y su propio HUD dibujado en el canvas.

Este spec hace dos cosas que el `README.md` lleva pidiendo desde el principio —_"una plataforma para jugar online y competir por la mayor cantidad de puntos"_—: pone el primer juego jugable de verdad y abre la tabla donde se compite.

---

## 2 — Alcance

**Dentro:**

- **Ficha nueva `asteroides`** en `lib/games.ts`. Es el noveno juego del catálogo, no sustituye a nada.
- **Portada CSS `cover-asteroides`** en `app/globals.css`, en el mismo estilo de gradientes puros que las otras ocho.
- **Motor portado a TypeScript** en `lib/games/asteroides/engine.ts`: mismas constantes, misma física, mismo power-up, pero como instancia con estado propio en vez de globales de módulo.
- **Contrato genérico de motor** (`lib/games/engine.ts`) y **registro `GAME_ENGINES`** (`lib/games/registry.ts`) que mapea `id` de juego a motor, con carga diferida.
- **`components/games/game-canvas.tsx`**: el anfitrión React del canvas. Monta el motor, escala por `devicePixelRatio`, engancha el teclado y lo desmonta limpio.
- **El HUD de la plataforma pasa a reflejar el estado real** del motor —jugador, puntuación, vidas, nivel— para los juegos que tienen motor. El `setInterval` falso y `POINTS_PER_LEVEL` sobreviven **solo** para los ocho juegos que siguen sin motor.
- **PAUSA del HUD pausa el motor de verdad**, más pausa por teclado (`P` / `Escape`) y pausa automática al ocultarse la pestaña.
- **`preventDefault` en flechas y espacio** mientras se juega, para que la página no haga scroll bajo el jugador.
- **Controles táctiles** en pantallas de puntero grueso: rotar izquierda / derecha, propulsar y disparar.
- **Leyenda de controles** bajo el marco CRT en la estética retro del sitio.
- **Fin de partida por la plataforma:** el motor emite `gameover` y React abre el modal FIN DEL JUEGO existente. Se elimina el `drawOverlay('GAME OVER')` y el reinicio con Espacio del motor.
- **Tabla `public.scores`** con su RLS, sus restricciones y su índice, por migración vía MCP.
- **Server Action `saveScore`** que resuelve el `user_id` de la sesión del servidor e inserta la fila. El cliente nunca elige de quién es la puntuación.
- **Tipos regenerados** en `lib/database.types.ts`.

**Fuera de alcance (para specs futuras):**

- **Leer las puntuaciones de la base.** El Salón de la Fama y el leaderboard lateral de `/juego/[id]` siguen con `seededScores` y `localStorage`, exactamente como hoy. La política de `select` se crea igualmente para no tener que migrar después, pero **ninguna pantalla la usa en este spec**. Lectura y unificación de marcadores: **SPEC 06**.
- **Retirar `localStorage` como almacén de puntuaciones.** `appendScore` sigue escribiendo, para todos, con motor o sin él. Es lo que mantiene viva la fila destacada del jugador en el Salón de la Fama mientras la lectura no migre.
- **Los otros dos juegos de `references/started-games/`.** Tetris y Arkanoid tendrán su propio spec cada uno. El registro queda preparado para que añadirlos sea una línea.
- **Sustituir la maqueta de los ocho juegos sin motor.** `/jugar/bloque-buster` y compañía siguen con su arena decorativa y su puntuación inventada.
- **Anti-trampas serio.** No hay validación de la partida, ni semilla verificable, ni repetición del replay en servidor. Las restricciones de la tabla son un badén, no una puerta.
- **Puntuaciones de invitados en la base.** El invitado no tiene fila en `auth.users`; sigue guardando solo en `localStorage`.
- **Sonido, música y efectos.** El `game.js` original tampoco los tiene.
- **Récord y número de partidas reales en la tarjeta.** `best` y `plays` de la ficha nueva son valores estáticos como los de los otros ocho.
- **Tabla `games`.** El catálogo sigue siendo un array de TypeScript.
- **Borrar `references/started-games/02-asteroids/`.** Se queda como referencia del original.
- **Marcadores en vivo, multijugador o partidas compartidas.**
- **Framework de tests.**

---

## 3 — Modelo de datos

### Ficha del juego — `lib/games.ts`

Se añade una novena entrada al array `GAMES`, sin tocar las ocho existentes:

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Rompe rocas a la deriva en un espacio sin bordes.",
  long: "Tu nave flota en un campo de asteroides donde el espacio se dobla sobre sí mismo: sal por un borde y aparecerás por el opuesto. Dispara para partir las rocas grandes en medianas y las medianas en pequeñas, y recoge el módulo de disparo triple antes de que se apague.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Y dos ayudas nuevas en el mismo fichero, que la Server Action usa para validar:

```ts
/** Tope superior de una puntuación aceptable. Badén, no candado. */
export const MAX_SCORE = 10_000_000;

export function isKnownGame(id: string): boolean {
  return GAMES.some((game) => game.id === id);
}
```

### Tabla `public.scores`

Una fila por partida terminada. Historial completo: el mejor resultado se obtiene con un `order by score desc limit 1`, y así no se pierde nada por el camino.

```sql
create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  game_id    text not null,
  score      integer not null,
  created_at timestamptz not null default now(),
  constraint scores_score_range check (score >= 0 and score <= 10000000),
  constraint scores_game_id_allowed check (
    game_id in (
      'bloque-buster', 'caida', 'serpentina', 'gloton',
      'invasores', 'rocas', 'ranaria', 'duelo-pixel', 'asteroides'
    )
  )
);

create index scores_game_score_idx on public.scores (game_id, score desc);
```

No hay `unique (user_id, game_id)`: caben tantas partidas como se jueguen.

### RLS

```sql
alter table public.scores enable row level security;
```

| Política               | Operación | Rol                     | Condición                       |
| ---------------------- | --------- | ----------------------- | ------------------------------- |
| `scores_select_public` | `select`  | `anon`, `authenticated` | `true`                          |
| `scores_insert_own`    | `insert`  | `authenticated`         | `(select auth.uid()) = user_id` |

Sin `update` y sin `delete`: una puntuación no se corrige ni se borra, y las filas se van en cascada con la cuenta. La política de `select` se crea ahora aunque nadie lea todavía —habilitar RLS sin una política de lectura deja la tabla ciega, y añadirla después obligaría a otra migración por nada.

### Contrato del motor — `lib/games/engine.ts`

El contrato es de la plataforma, no de este juego: es lo que permite que Tetris y Arkanoid entren después sin tocar el reproductor.

```ts
export type GameStatus = "playing" | "paused" | "gameover";

/** Lo que el motor le cuenta al HUD. */
export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  status: GameStatus;
};

/** Acciones abstractas, para que los controles táctiles no sepan de teclas. */
export type GameAction = "left" | "right" | "thrust" | "fire";

export type GameEngine = {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  /** Para los controles táctiles: activa o suelta una acción. */
  setAction: (action: GameAction, active: boolean) => void;
  /** Cancela el rAF y suelta todos los listeners. Idempotente. */
  destroy: () => void;
};

export type CreateEngine = (options: {
  canvas: HTMLCanvasElement;
  /** Solo se llama cuando algún campo del snapshot cambia de verdad. */
  onSnapshot: (snapshot: GameSnapshot) => void;
  onGameOver: (score: number) => void;
}) => GameEngine;
```

### Registro — `lib/games/registry.ts`

```ts
export type GameEngineEntry = {
  /** Resolución interna del motor. Fija: el juego asume estas medidas. */
  width: number;
  height: number;
  load: () => Promise<{ createEngine: CreateEngine }>;
};

export const GAME_ENGINES: Record<string, GameEngineEntry> = {
  asteroides: {
    width: 800,
    height: 600,
    load: () => import("@/lib/games/asteroides/engine"),
  },
};
```

`load` es un `import()` dinámico a propósito: el motor no entra en el bundle de `/jugar/bloque-buster` ni en el de la Biblioteca.

### Estado interno del motor de asteroides

Lo que en `game.js` son globales de módulo (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, `powerUpSpawned`, `killsSinceSpawn`) pasa a ser el estado de una única instancia creada por `createEngine`. Las clases `Bullet`, `Asteroid`, `Ship`, `Particle` y `PowerUp` reciben el `ctx` en lugar de cerrarlo sobre el global. Las constantes se conservan **sin tocar un solo número**: `RADII`, `SPEEDS`, `POINTS`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `POWERUP_TTL`, `TRIPLE_SPREAD`, y las de la nave (`ROT`, `THRUST`, `DRAG`, cooldown de 0.2 s, invencibilidad de 3 s).

### Resultado del guardado — `app/jugar/[id]/actions.ts`

```ts
export type SaveScoreInput = { gameId: string; score: number };

export type SaveScoreResult =
  { ok: true } | { ok: false; reason: "auth" | "validation" | "config" | "db" };
```

Mismo patrón que `sendContactMessage` en `app/about/actions.ts`: un discriminante en el resultado, nada de excepciones cruzando la frontera, y las variables de entorno leídas dentro de la función.

---

## 4 — Plan de implementación

Cada paso deja la aplicación compilando y navegable.

1. **Ficha y portada.** Añadir la entrada `asteroides` a `GAMES`, más `MAX_SCORE` e `isKnownGame`. Escribir `.cover-asteroides` en `app/globals.css` con gradientes puros: fondo estrellado, siluetas de roca, nave triangular. _Verificable:_ el juego aparece en la Biblioteca, filtra por SHOOTER, `/juego/asteroides` abre y `/jugar/asteroides` muestra la maqueta actual.

2. **Contratos y anfitrión.** Crear `lib/games/engine.ts` con los tipos, `lib/games/registry.ts` con el registro **vacío**, y `components/games/game-canvas.tsx`, que recibe una `GameEngineEntry` y monta el motor en un `useEffect` con su limpieza. Escalado por `devicePixelRatio`: `canvas.width = width * dpr` y `ctx.scale(dpr, dpr)`, de modo que el motor siga dibujando en su espacio lógico de 800×600. CSS `.game-canvas` con `aspect-ratio: 4 / 3` para llenar `.crt-screen`. _Verificable:_ nada cambia todavía —el registro está vacío—, `npm run build` pasa.

3. **Portar el motor.** Traducir `game.js` a `lib/games/asteroides/engine.ts` exportando `createEngine`. Cambios respecto al original, y solo estos: estado por instancia en vez de global; `ctx` inyectado; `drawHUD()` reducido al indicador `3x` (la puntuación, el nivel y las vidas los pinta el HUD de la plataforma); `drawOverlay('GAME OVER')` y el reinicio con Espacio eliminados, sustituidos por `onGameOver(score)`; `onSnapshot` emitido **solo cuando `score`, `lives`, `level` o `status` cambian**, nunca por fotograma. Registrar `asteroides` en `GAME_ENGINES`. _Verificable:_ `/jugar/asteroides` es jugable con teclado, el HUD sube puntos reales, morir tres veces abre el modal.

4. **El reproductor, en dos modos.** En `components/game-player.tsx`, consultar `GAME_ENGINES[game.id]`. Con motor: puntuación, vidas y nivel vienen del snapshot, PAUSA llama a `pause()`/`resume()`, FIN fuerza el fin de partida y JUGAR DE NUEVO llama a `restart()`. Sin motor: se conserva íntegro el camino actual —`setInterval`, tres vidas fijas, `POINTS_PER_LEVEL` y la arena decorativa—. _Verificable:_ `/jugar/asteroides` juega de verdad y `/jugar/caida` se comporta exactamente igual que antes de este spec.

5. **Controles.** `preventDefault` en `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` y `Space` mientras el motor está vivo; `P` y `Escape` alternan pausa; `visibilitychange` pausa al ocultar la pestaña. Leyenda `.game-keys` bajo el CRT y botonera `.game-touch` con `pointerdown`/`pointerup` sobre `setAction`, visible solo bajo `@media (pointer: coarse)` y la leyenda al revés. _Verificable:_ la página no hace scroll al pulsar flechas o espacio, `P` pausa, volver de otra pestaña encuentra el juego pausado y la botonera aparece al reducir a viewport táctil.

6. **La tabla.** Migración `create_scores` por MCP con la tabla, las restricciones, el índice, la RLS y las dos políticas. Regenerar `lib/database.types.ts`. _Verificable:_ `list_tables` muestra `scores`, `get_advisors` no levanta avisos de seguridad nuevos y el tipo `Database` incluye `scores`.

7. **Guardar de verdad.** `app/jugar/[id]/actions.ts` con `saveScore`: cliente de servidor (`null` → `config`), `getUser()` (sin usuario → `auth`), validación de `isKnownGame(gameId)` y de que `score` es un entero entre 0 y `MAX_SCORE` (→ `validation`), `insert` (error → `db`). En el modal: si la sesión es una cuenta, el alias se muestra como texto fijo —es el de `profiles` y no se edita— y GUARDAR PUNTUACIÓN llama a la acción además de a `appendScore`; si es invitado, el campo de iniciales sigue siendo editable, solo se guarda en `localStorage` y aparece un enlace a `/auth` invitando a crear cuenta para competir. Banda de error retro cuando el resultado no es `ok`. _Verificable:_ con sesión iniciada, terminar una partida y guardar deja una fila en `public.scores` con el `user_id` correcto.

---

## 5 — Criterios de aceptación

**Catálogo y navegación**

- [ ] `GAMES` tiene nueve entradas y la novena es `asteroides`; las ocho anteriores no han cambiado ni un carácter.
- [ ] La tarjeta de ASTEROIDES aparece en la Biblioteca con portada propia, distinta de las otras ocho, y el buscador la encuentra escribiendo "aster".
- [ ] El filtro SHOOTER muestra ASTEROIDES, ROCAS e INVASORES.
- [ ] `/juego/asteroides` renderiza el Detalle y su botón JUGAR lleva a `/jugar/asteroides`.

**El juego**

- [ ] En `/jugar/asteroides` se ve la nave triangular sobre fondo negro dentro del marco CRT, sin barra de scroll horizontal en un viewport de 1280 px ni en uno de 390 px.
- [ ] `←` y `→` rotan, `↑` propulsa y muestra la llama, `Espacio` dispara con una cadencia máxima de 5 disparos por segundo.
- [ ] Salir por un borde reaparece por el opuesto: nave, balas, asteroides y power-ups.
- [ ] Un asteroide grande destruido da 20 puntos y deja dos medianos; un mediano da 50 y deja dos pequeños; un pequeño da 100 y no deja nada.
- [ ] Destruir el último asteroide sube el nivel en el HUD y aparece una oleada mayor que la anterior.
- [ ] El módulo `3x` aparece como muy tarde al quinto asteroide destruido, y recogerlo dispara tres balas en abanico durante 5 segundos con la cuenta atrás visible en el canvas.
- [ ] Chocar con un asteroide resta una vida en el HUD; al reaparecer, la nave parpadea y es inmune durante 3 segundos.
- [ ] Perder la tercera vida abre el modal FIN DEL JUEGO con la puntuación real de la partida. El canvas **no** dibuja ningún cartel de GAME OVER y pulsar Espacio no reinicia nada.

**Integración con el reproductor**

- [ ] Puntuación, vidas y nivel del HUD coinciden en todo momento con el estado del motor; ninguno de los tres se mueve solo cuando el juego está pausado o terminado.
- [ ] PAUSA congela el juego y muestra el cartel EN PAUSA; REANUDAR lo devuelve donde estaba.
- [ ] `P` y `Escape` alternan la pausa, y cambiar de pestaña y volver encuentra el juego pausado.
- [ ] Pulsar flechas o espacio mientras se juega no desplaza la página.
- [ ] JUGAR DE NUEVO reinicia la partida desde cero: puntuación 0, tres vidas, nivel 1.
- [ ] SALIR navega a `/juego/asteroides` y el bucle de `requestAnimationFrame` deja de correr —no queda ningún fotograma programado tras desmontar.
- [ ] En modo desarrollo, con el doble montaje de React Strict Mode, solo hay un bucle activo: la nave no se mueve al doble de velocidad.
- [ ] La leyenda de controles se ve en escritorio; la botonera táctil se ve en puntero grueso y cada botón mueve la nave.
- [ ] `/jugar/caida` y los otros siete juegos sin motor siguen mostrando la arena decorativa y la puntuación simulada, sin cambios de comportamiento.

**Base de datos**

- [ ] `public.scores` existe con las cinco columnas, las dos restricciones `check`, el índice `scores_game_score_idx` y RLS habilitada.
- [ ] Un `insert` con `score = -1` es rechazado por la restricción.
- [ ] Un `insert` con `game_id = 'no-existe'` es rechazado por la restricción.
- [ ] Un `insert` en el que `user_id` no es el de la sesión es rechazado por la RLS.
- [ ] `lib/database.types.ts` incluye `scores` y `npx tsc --noEmit` pasa.
- [ ] `get_advisors` no reporta avisos de seguridad nuevos sobre `scores`.

**Guardado**

- [ ] Con sesión de cuenta, terminar una partida y pulsar GUARDAR PUNTUACIÓN inserta exactamente una fila en `public.scores` con el `user_id` de la sesión, `game_id = 'asteroides'` y la puntuación mostrada en el modal.
- [ ] Con sesión de cuenta, el alias del modal es el de `profiles` y no se puede editar.
- [ ] Con sesión de invitado no se inserta ninguna fila, el campo de iniciales sigue siendo editable y el modal ofrece un enlace a `/auth`.
- [ ] La puntuación se sigue escribiendo en `localStorage` en los dos casos, y la fila destacada del jugador en el Salón de la Fama sigue apareciendo como antes.
- [ ] Sin las variables `NEXT_PUBLIC_SUPABASE_*` definidas, `npm run build` pasa, `/jugar/asteroides` es jugable y solo falla el guardado en la base, con mensaje visible.
- [ ] Un fallo de red al guardar muestra la banda de error y deja el botón operativo para reintentar; no cierra el modal ni pierde la puntuación.

---

## 6 — Decisiones tomadas y descartadas

**ASTEROIDES es un juego nuevo, no un repintado de ROCAS.** `rocas` ya existía en el catálogo con la descripción _"Pulveriza asteroides en gravedad cero"_ y encajaba de maravilla. Aun así entra como ficha aparte, por decisión explícita: el juego se llama Asteroides, ya está escrito, y `rocas` se queda intacto con su maqueta. Se descartó reusar la ficha y también renombrarla.

**Motor TypeScript puro + anfitrión React, no iframe.** El iframe habría portado el juego en minutos copiando `index.html` a `public/`, pero deja el HUD, el botón PAUSA y el guardado de puntuación al otro lado de una frontera que solo se cruza con `postMessage`. Un motor que emite snapshots es lo que hace que el HUD de la plataforma sea el HUD del juego. Se descartó también meter todo en un único componente cliente: mezclar el bucle de juego con el JSX complica reusar el patrón para Tetris y Arkanoid.

**Registro `id → motor` con carga diferida, no un caso especial para asteroides.** Añadir el segundo juego debe ser una línea en `GAME_ENGINES`, no otra rama en el reproductor. Y el `import()` dinámico mantiene las ~500 líneas del motor fuera del bundle de las páginas que no lo usan.

**El HUD del canvas se retira, salvo el contador `3x`.** Puntuación, vidas y nivel pasan al `player-hud` de la plataforma; dejarlos también dentro del canvas duplicaría la información con dos tipografías distintas. El indicador de disparo triple es la excepción: se queda dibujado porque su cuenta atrás cambia varias veces por segundo, y sacarla al HUD obligaría a re-renderizar React a ese ritmo para adornar un temporizador.

**`onSnapshot` solo cuando algo cambia.** Emitir el estado en cada fotograma serían 60 renders de React por segundo compitiendo con el bucle de dibujo. El motor compara los cuatro campos y solo avisa cuando alguno se mueve —en la práctica, unas pocas veces por segundo.

**Resolución interna fija de 800×600, escalada por CSS.** El wrapping toroidal, el radio de los asteroides, la distancia de spawn seguro y las velocidades están todos calibrados sobre ese lienzo. Un canvas realmente responsive obligaría a recalcular posiciones al redimensionar y a repensar el `SAFE_DIST`. Escalar por CSS con `aspect-ratio: 4 / 3` da el mismo resultado visual sin tocar un número, y `devicePixelRatio` mantiene el trazo fino en pantallas densas.

**Vector blanco sobre negro, sin repintar a la paleta del sitio.** El marco CRT ya aporta scanlines, curvatura y brillo: el juego se integra sin renunciar al lápiz del arcade original. El power-up, que ya era cian en el original, coincide por casualidad con `--cyan`.

**El power-up de disparo triple se porta tal cual.** Está implementado y equilibrado en `game.js` —15% de probabilidad, garantizado al quinto asteroide, 5 s de efecto, 12 s de caducidad—. Recortarlo habría sido trabajo extra que resta juego.

**La tabla `scores` entra en este spec, contra lo que dijo el SPEC 04.** El SPEC 04 la reservó explícitamente para más adelante. Decisión del usuario, tomada tras advertirle de que mezcla dos dominios —motor de juego y backend— en un solo spec. La mitigación es que solo entra la **escritura**: la lectura de marcadores sigue fuera, y con ella el trabajo de unificar `seededScores`, `localStorage` y la base en las tres pantallas que hoy muestran puntuaciones.

**Una fila por partida, no la mejor por jugador.** Un `upsert` sobre `(user_id, game_id)` daría una tabla mínima, pero tira el historial: no habría "partidas jugadas", ni progresión, ni forma de auditar una puntuación sospechosa. El índice `(game_id, score desc)` hace que sacar el récord siga siendo trivial.

**Solo las cuentas escriben en la base.** El invitado no tiene fila en `auth.users` —así lo dejó el SPEC 04— y permitir inserts anónimos con el alias escrito a mano convertiría el marcador en un formulario abierto. El invitado sigue con `localStorage`, y el modal le dice por qué.

**Insert por Server Action, no directo desde el cliente.** La RLS bastaría para impedir que alguien firme una puntuación con el `user_id` de otro, pero la acción de servidor resuelve la identidad de la sesión y el cliente ni siquiera manda ese campo. Sigue el patrón ya establecido en `app/about/actions.ts`.

**`check` sobre `game_id` en vez de una tabla `games` con clave foránea.** Una tabla de juegos es lo correcto a medio plazo, pero abre un tercer dominio en un spec que ya tiene dos. El coste conocido de la restricción: añadir un juego al catálogo exigirá una migración.

**`localStorage` sigue vivo en paralelo.** Duplicar la escritura es feo. Pero la lectura de marcadores está fuera de alcance, y si el reproductor dejase de escribir en `localStorage` hoy, la fila destacada del jugador en el Salón de la Fama desaparecería sin que nada la sustituya. La duplicidad se retira en el SPEC 06, cuando la lectura migre.

---

## 7 — Riesgos identificados

**El doble montaje de React Strict Mode duplica el bucle.** En desarrollo, `useEffect` corre dos veces; si `destroy()` no cancela el `requestAnimationFrame` y no suelta los listeners de teclado, habrá dos bucles actualizando el mismo estado y el juego irá al doble de velocidad. _Mitigación:_ `destroy()` idempotente que guarda el id del `rAF` y lo cancela, más un criterio de aceptación específico para esto.

**Listeners de teclado globales que sobreviven a la navegación.** El original engancha `window` sin desenganchar nunca. Si el port hereda eso, salir a `/juego/asteroides` dejaría la página capturando flechas y espacio. _Mitigación:_ todos los listeners se registran en el montaje y se retiran en `destroy()`.

**`preventDefault` demasiado agresivo.** Bloquear el espacio en toda la ventana rompería escribir en el campo de iniciales del modal o en cualquier formulario. _Mitigación:_ solo se previene mientras el motor está activo, y no cuando el foco está en un `input` o `textarea`.

**Cualquiera puede llamar a la Server Action con la puntuación que quiera.** Un Server Action es un endpoint POST alcanzable sin pasar por el juego. Las restricciones de la tabla filtran lo absurdo, no lo verosímil: nada impide inyectar 250.000 puntos a mano. _Mitigación:_ ninguna en este spec, es una limitación asumida. El día que duela, el camino es firmar la partida en servidor o validar el replay.

**Marcadores dobles cuando el SPEC 06 lea de la base.** Una misma partida queda escrita en `localStorage` y en `scores`. Si el Salón de la Fama pasa a leer de la base sin retirar la fuente local, el jugador se verá dos veces. _Mitigación:_ el SPEC 06 retira `localStorage` como fuente en el mismo cambio que introduce la lectura.

**Rendimiento en móviles modestos.** El juego dibuja polígonos, partículas y un `strokeRect` pulsante a 60 fps sobre un canvas ya escalado por `devicePixelRatio`, dentro de un marco CRT que aplica sus propios pseudo-elementos y filtros. _Mitigación:_ el `dt` capado a 50 ms ya evita el espiral de la muerte; si hiciera falta, se limita el `dpr` a 2.

**El `check` de `game_id` se desincroniza de `lib/games.ts`.** Son dos listas de los mismos nueve identificadores en dos sitios distintos. Añadir un juego y olvidar la migración da un error de inserción en producción y no en desarrollo. _Mitigación:_ `isKnownGame` valida antes en la Server Action, así que el fallo llega como `validation` con mensaje claro en vez de como un error opaco de Postgres.

---

## Lo que **no** entra en este spec

Leer puntuaciones de la base en cualquier pantalla. Retirar `localStorage`. Tetris y Arkanoid. Sustituir la maqueta de los otros ocho juegos. Anti-trampas real. Puntuaciones de invitados en la base. Sonido. Récord y partidas reales en las tarjetas. Tabla `games`. Borrar `references/started-games/`. Multijugador. Tests.
