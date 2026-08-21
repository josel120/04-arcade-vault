# SPEC 06 — El marcador real y el catálogo en la base

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04, SPEC 05
> **Fecha:** 2026-08-21
> **Objetivo:** Mover el catálogo de juegos a la tabla `public.games` y hacer que el Salón de la Fama, el Detalle y las tarjetas lean puntuaciones reales de `public.scores`, retirando `seededScores` y las cifras inventadas.

---

## 1 — Por qué existe este spec

El SPEC 05 dejó una promesa escrita con nombre y número: _"Lectura y unificación de marcadores: **SPEC 06**"_. Hoy hay una tabla `public.scores` con RLS, con su índice `(game_id, score desc)` y con una política `scores_select_public` que **ninguna pantalla usa**. Se escribe en ella y no se lee de ella.

Lo que se ve en su lugar es una maqueta que ya no engaña a nadie:

- `lib/scores.ts` genera 12 filas por juego con un LCG determinista y una lista de 18 alias inventados (`PX_KAI`, `Z3R0COOL`, `RGB_QUEEN`…). El Salón de la Fama y el lateral del Detalle muestran eso.
- `components/hall-of-fame.tsx` mezcla esas filas falsas con lo que haya en `localStorage` bajo `av_scores` y, cuando el jugador no tiene marca propia, se inventa también su resumen: `Math.floor(8 + (tab.length % 4))` de puesto, `rows[5].score - 2400` de puntuación y la fecha literal `"11/05/2026"`.
- `lib/games.ts` es un array de nueve objetos con `best: 28450` y `plays: "12.4K"` escritos a mano. La ficha de ASTEROIDES, el único juego que se puede jugar de verdad, dice `best: 0` y `plays: "0"` porque su autor no quiso inventarse una cifra.

El SPEC 04 dejó fuera la tabla `games` con todas las letras (_"`lib/games.ts` sigue siendo un array en TypeScript"_) y el SPEC 05 la volvió a dejar fuera, además con un aviso: el `check` de `scores.game_id` repite los nueve identificadores a mano y _"añadir un juego al catálogo exigirá una migración"_. Son dos listas de lo mismo en dos sitios, más una tercera en `lib/games.ts`.

Este spec cierra las dos deudas a la vez porque están cosidas: `games.best` no es una columna que alguien escriba, es `max(score)` sobre `scores`. Separarlas obligaría a crear la tabla con cifras falsas en un spec y a vaciarlas en el siguiente.

**Advertencia asumida, igual que en el SPEC 05:** esto son dos dominios en una sola spec —lectura de marcadores y migración del catálogo—. Se hace así por decisión explícita del usuario. La mitigación es que el catálogo no gana ninguna superficie de escritura: se siembra por migración y se lee, nada más.

---

## 2 — Alcance

**Dentro:**

- **Tabla `public.games`** con los nueve juegos actuales sembrados por migración, `sort_order`, `is_published`, RLS de solo lectura y sin ninguna política de escritura.
- **`scores.game_id` pasa a clave foránea** contra `games.id` con `on delete restrict` y `on update cascade`. Se retira la restricción `scores_game_id_allowed`.
- **Dos vistas** con `security_invoker = on`: `public.game_leaderboards` (mejor marca de cada jugador en cada juego, con su alias) y `public.game_stats` (`best`, `plays` y `players` derivados de `scores`).
- **`lib/catalog.ts`**: lectura del catálogo en servidor, con respaldo al array de TypeScript cuando faltan las variables de entorno.
- **`lib/leaderboard.ts`**: lectura de marcadores en servidor —top por juego, marca del jugador, puesto conseguido—.
- **`lib/games.ts` se queda con los tipos y `FALLBACK_GAMES`.** `best` y `plays` salen del tipo `Game`: ya no son un dato del juego, son una consulta.
- **`seededScores` y `PLAYERS` desaparecen** de `lib/scores.ts`.
- **Salón de la Fama reescrito como Server Component**, con la pestaña de juego en la URL (`/salon?juego=asteroides`) y las pestañas como `<Link>`.
- **Estado vacío retro** cuando un juego no tiene ninguna partida, tanto en el Salón como en el lateral del Detalle.
- **Bloque «TUS PARTIDAS EN ESTE NAVEGADOR»** bajo el marcador del Salón, filtrado por el juego de la pestaña activa, alimentado por `localStorage` y visible solo si hay algo.
- **Biblioteca, Landing, Detalle, Reproductor y tarjetas leen el catálogo del servidor** en vez de importar el array.
- **`best` y `plays` de la tarjeta y del Detalle salen de `game_stats`.**
- **`saveScore` devuelve el puesto conseguido, el total de jugadores y si es récord personal**, y el modal FIN DEL JUEGO lo muestra.
- **`revalidatePath`** de las rutas de marcador dentro de `saveScore`, y renderizado dinámico de las páginas que muestran puntuaciones.
- **Tipos regenerados** en `lib/database.types.ts`, con las dos vistas incluidas.
- **CSS nuevo:** estado vacío del marcador, bloque de partidas locales y línea de puesto del modal.
- La app debe **seguir compilando y sirviéndose sin las variables de entorno**: el catálogo cae al respaldo y los marcadores se ven vacíos.

**Fuera de alcance (para specs futuras):**

- **Pantalla de administración del catálogo.** No hay rol de administrador ni formularios para crear o editar juegos. Añadir uno se hace por migración o desde el panel de Supabase. Eso es autorización, formularios y validación: su propia spec.
- **`TOP_PLAYERS` de la landing.** `lib/landing.ts` lo declara texto de escaparate y así se queda. Es un top global entre juegos y con cero partidas dejaría la sección `// 03` vacía en la portada del sitio.
- **`STATS` de la landing** (`"12+"` juegos, jugadores, partidas). Sigue siendo marketing, no se deriva de nada.
- **Puntuaciones de invitados en la base.** El invitado sigue sin fila en `auth.users` y sigue guardando solo en `localStorage`. Lo que cambia es que ahora tiene dónde verlas.
- **Migrar a la base lo que ya hay en `localStorage`.** No hay ninguna importación de partidas antiguas: no se sabe de quién son.
- **Anti-trampas.** Sigue siendo posible llamar a `saveScore` con una puntuación inventada y verosímil. Sin cambios respecto al SPEC 05.
- **Marcadores en vivo.** Nada de _realtime_, ni suscripciones, ni actualización sin recargar.
- **Paginación del Salón.** El marcador muestra un top fijo; con esta cantidad de datos no hay nada que paginar.
- **Filtro temporal** (hoy / esta semana / histórico). El marcador es histórico y punto.
- **Tetris, Arkanoid y los otros siete juegos sin motor.** Siguen con su maqueta y su puntuación simulada, exactamente como los dejó el SPEC 05.
- **Portadas en la base.** `cover` guarda el nombre de la clase CSS; la clase sigue viviendo en `app/globals.css`. Un juego nuevo necesitará su CSS igualmente.
- **Retirar `av_scores` de `localStorage`.** Se conserva, pero ya no se mezcla con el marcador global.
- **Framework de tests.**

---

## 3 — Modelo de datos

### Tabla `public.games`

```sql
create table public.games (
  id           text primary key,
  title        text not null,
  short        text not null,
  long         text not null,
  cat          text not null,
  cover        text not null,
  color        text not null,
  sort_order   integer not null,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint games_id_format check (id ~ '^[a-z0-9-]{2,40}$'),
  constraint games_cat_allowed check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  constraint games_color_allowed check (color in ('cyan', 'magenta', 'yellow', 'green'))
);

create unique index games_sort_order_idx on public.games (sort_order);
```

Las columnas son exactamente los campos que hoy tiene el tipo `Game`, menos `best` y `plays`, que se van a `game_stats`. Los dos `check` de `cat` y `color` codifican en la base los tipos `GameCategory` y `GameColor` de TypeScript.

`sort_order` fija el orden que hoy es implícito —la posición en el array— y es único para que no haya empates que Postgres resuelva a su antojo. Se siembra de 10 en 10 (`10, 20, 30…`) para poder colar un juego entre dos sin renumerar.

`is_published` es lo que permite retirar un juego del catálogo sin borrar la fila, que es justo lo que la clave foránea `restrict` va a impedir en cuanto tenga una sola partida.

### RLS de `games`

```sql
alter table public.games enable row level security;

create policy "games_select_published"
  on public.games for select
  to anon, authenticated
  using (is_published);
```

Sin `insert`, sin `update` y sin `delete`: con RLS habilitada y ninguna política, esas tres operaciones quedan cerradas para `anon` y `authenticated`. El catálogo se toca con la clave de servicio o por migración.

La condición es `using (is_published)` y no `using (true)`: un juego despublicado desaparece de la API, no solo de las consultas que se acuerden de filtrarlo. Las claves foráneas no pasan por RLS, así que las puntuaciones de un juego despublicado siguen siendo válidas y su fila sigue siendo referenciable.

### La clave foránea

```sql
alter table public.scores drop constraint scores_game_id_allowed;

alter table public.scores
  add constraint scores_game_id_fkey
  foreign key (game_id) references public.games (id)
  on delete restrict on update cascade;
```

`restrict` porque un historial no se tira sin querer desde el panel. `cascade` en `update` porque renombrar el identificador de un juego es plausible y las partidas deben seguirlo.

Esto retira la lista de nueve identificadores repetida a mano que el SPEC 05 anotó como riesgo. La migración se aplica **después** de sembrar `games`, o la restricción no valida.

### Vista `public.game_leaderboards`

Una fila por jugador y juego: su mejor marca, con el alias ya resuelto.

```sql
create view public.game_leaderboards
with (security_invoker = on) as
select distinct on (s.game_id, s.user_id)
  s.game_id,
  s.user_id,
  p.username,
  s.score,
  s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.game_id, s.user_id, s.score desc, s.created_at asc;
```

`security_invoker = on` no es decorativo: una vista sin él se ejecuta con los permisos de su propietario y **se salta la RLS de las tablas que consulta**. Es exactamente lo que el _advisor_ de Supabase marca como `security_definer_view`. Con `security_invoker`, `game_leaderboards` respeta `scores_select_public` y `profiles_select_public`, que ya son públicas, así que el resultado es el mismo y la vista no abre ninguna puerta nueva.

El `distinct on` lleva `created_at asc` como último criterio de desempate: si alguien repite su récord exacto, gana la primera vez que lo consiguió.

El `join` con `profiles` es un `inner join` a propósito: una puntuación sin perfil no existe hoy —el trigger de la SPEC 04 crea el perfil al registrarse— y si algún día existiera, no tendría nombre que mostrar.

### Vista `public.game_stats`

```sql
create view public.game_stats
with (security_invoker = on) as
select
  g.id                                   as game_id,
  coalesce(max(s.score), 0)::integer     as best,
  count(s.id)::integer                   as plays,
  count(distinct s.user_id)::integer     as players
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;
```

`left join` para que un juego sin ninguna partida siga apareciendo con ceros en vez de desaparecer de la lista.

### Tipos del catálogo — `lib/games.ts`

El fichero deja de ser la fuente y pasa a ser el contrato y el respaldo:

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  /** Clase CSS de la portada: `cover-bricks`. Vive en `app/globals.css`. */
  cover: string;
  color: GameColor;
  sortOrder: number;
};

/** Derivado de `scores`, nunca escrito a mano. */
export type GameStats = {
  gameId: string;
  best: number;
  plays: number;
  players: number;
};

export type GameWithStats = Game & { stats: GameStats };
```

`best` y `plays` salen del tipo `Game`. Es el cambio que rompe la compilación en los sitios que hay que revisar —`game-card.tsx` y `game-detail.tsx`—, y eso es deseable: el compilador enumera el trabajo.

`GAMES` se renombra a **`FALLBACK_GAMES`**, con las mismas nueve entradas menos `best` y `plays`, más `sortOrder`. Es la misma lista que siembra la migración, y su única razón de existir es que la app siga navegable sin variables de entorno. `CATS` y `Cat` se quedan donde están. `MAX_SCORE` también.

`getGame` e `isKnownGame` **se van de este fichero**: preguntar por un juego pasa a ser una consulta.

### Catálogo en servidor — `lib/catalog.ts`

```ts
import "server-only";

export async function listGames(): Promise<GameWithStats[]>;
export async function getGame(id: string): Promise<GameWithStats | null>;
```

`listGames` hace dos consultas —`games` ordenada por `sort_order`, y `game_stats`— y las cruza en memoria. Son nueve filas: un `join` con relaciones de PostgREST daría el mismo resultado con más ceremonia y dependería de que la vista tenga relación declarada, que no la tiene.

Si `createClient()` devuelve `null` o la consulta falla, devuelve `FALLBACK_GAMES` con estadísticas a cero y lo registra por consola. El catálogo nunca deja la Biblioteca en blanco.

### Marcadores en servidor — `lib/leaderboard.ts`

```ts
import "server-only";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  score: number;
  /** DD/MM/AAAA, la convención de fechas del proyecto. */
  date: string;
};

/** Top del juego, mejor marca por jugador, ya numerado. */
export async function topScores(gameId: string, limit = 12): Promise<LeaderboardRow[]>;
```

Consulta `game_leaderboards` filtrando por `game_id`, ordenando por `score desc, created_at asc` y limitando. El `rank` se calcula al mapear: la base ya devuelve las filas ordenadas.

Ante `null` del cliente o error de consulta, devuelve `[]`. Un marcador vacío es un estado que la interfaz ya sabe pintar; una excepción tumbaría la página.

### `lib/scores.ts` después de la poda

Se queda **solo** con el tipo de fila que consumen los componentes de presentación, alineado con `LeaderboardRow`:

```ts
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
  /** True si la fila es del jugador de la sesión. */
  isYou?: boolean;
};
```

`PLAYERS` y `seededScores` se borran. Con ellos se va el único generador de datos falsos que quedaba en el proyecto.

### Resultado del guardado — `app/jugar/[id]/actions.ts`

```ts
export type SaveScoreResult =
  | {
      ok: true;
      /** Puesto del jugador en el marcador del juego, tras guardar. */
      rank: number;
      /** Cuántos jugadores tienen marca en ese juego. */
      players: number;
      /** True si esta partida ha superado su mejor marca anterior. */
      isRecord: boolean;
    }
  | { ok: false; reason: "auth" | "validation" | "config" | "db" };
```

El puesto se calcula **después** del `insert`, en dos consultas contra `game_leaderboards`: cuántos jugadores del juego tienen mejor marca que la mejor marca actual del jugador (`rank = esa cuenta + 1`) y cuántos jugadores hay en total. `isRecord` compara la puntuación de la partida con el `max(score)` que el jugador tenía **antes** de insertar, leído al principio de la acción.

Si alguna de esas consultas falla, el guardado **no** se da por fallido: la fila ya está en la base. Se devuelve `ok: true` con `rank: 0` y `players: 0`, y el modal omite la línea del puesto.

---

## 4 — Plan de implementación

Cada paso deja la aplicación compilando y navegable.

1. **La tabla y la siembra.** Migración `create_games` con la tabla, los tres `check`, el índice único de `sort_order`, la RLS y la política de lectura, más los `insert` de los nueve juegos con `sort_order` de 10 en 10 y los textos copiados literalmente del array actual. Versionar el `.sql` en `supabase/migrations/`. _Verificable:_ `list_tables` muestra `games` con nueve filas y la aplicación no ha cambiado en nada, porque todavía nadie la lee.

2. **La clave foránea.** Migración `scores_game_id_fkey`: `drop constraint scores_game_id_allowed` y `add constraint … references public.games (id) on delete restrict on update cascade`. _Verificable:_ un `insert` en `scores` con `game_id = 'no-existe'` sigue siendo rechazado, ahora por la foránea; borrar un juego con partidas falla con `restrict`.

3. **Las vistas.** Migración `create_leaderboard_views` con `game_leaderboards` y `game_stats`, las dos con `security_invoker = on`. Regenerar `lib/database.types.ts`. _Verificable:_ `get_advisors` de seguridad no reporta `security_definer_view`, y el tipo `Database` incluye las dos vistas bajo `Views`.

4. **El catálogo en TypeScript.** Reescribir `lib/games.ts` (tipos nuevos, `FALLBACK_GAMES`, fuera `best`, `plays`, `getGame` e `isKnownGame`) y crear `lib/catalog.ts`. Adaptar los consumidores hasta que `npx tsc --noEmit` pase: `app/games/page.tsx` y `app/page.tsx` pasan a ser `async` y pasan `games` por props a `Library` y a `Landing`; `game-card.tsx` recibe `GameWithStats` y lee `game.stats.best`; `mini-card.tsx` se queda con `Game`; `app/juego/[id]/page.tsx` y `app/jugar/[id]/page.tsx` usan `getGame` de `lib/catalog.ts` con `await`. _Verificable:_ la Biblioteca, la Landing, el Detalle y el Reproductor se ven igual que antes salvo por las cifras: `Mejor global` y `Partidas` ahora son `0` en todos los juegos, porque `scores` está vacía.

5. **Los marcadores reales.** Crear `lib/leaderboard.ts`. `app/juego/[id]/page.tsx` pasa `topScores(id, 10)` al Detalle. `components/leaderboard.tsx` gana su estado vacío: cartel `A ÚN NADIE HA MARCADO_ / SÉ EL PRIMERO` cuando `rows` viene vacío. Borrar `seededScores` y `PLAYERS` de `lib/scores.ts`. _Verificable:_ el lateral del Detalle ya no muestra alias inventados; con la base vacía muestra el cartel, y tras jugar una partida con sesión iniciada muestra esa única fila.

6. **El Salón de la Fama, en servidor.** `app/salon/page.tsx` pasa a `async`, lee `searchParams.juego` (con el primer juego del catálogo como valor por defecto y `notFound()` si el identificador no existe), consulta catálogo, top y sesión, y renderiza `HallOfFame` ya sin `"use client"`. Las pestañas pasan a `<Link href={"/salon?juego=" + id}>`. El podio se pinta solo con las plazas que existen; con menos de tres filas, las que falten no se dibujan. La fila resumen del final deja de inventarse el puesto y la fecha: sale de buscar el `userId` de la sesión en las filas del top, y si el jugador no tiene marca en ese juego se muestra un aviso de que aún no ha puntuado. _Verificable:_ `/salon` abre en el primer juego, cada pestaña cambia la URL, la URL es enlazable y recargable, y `/salon?juego=inventado` da 404.

7. **Las partidas locales.** Nuevo `components/local-scores.tsx`, cliente, que lee `scoresForGame(gameId)` en un `useEffect` y pinta el bloque `TUS PARTIDAS EN ESTE NAVEGADOR` ordenado de mayor a menor. Devuelve `null` si no hay ninguna, para que no aparezca un bloque vacío ni haya desajuste de hidratación. Se monta bajo la tabla del Salón con el juego de la pestaña activa. _Verificable:_ jugando como invitado y guardando, la marca aparece en ese bloque y **no** en el marcador global.

8. **Frescura.** `export const dynamic = "force-dynamic"` en `/salon`, `/juego/[id]`, `/games` y `/`, y `revalidatePath` de esas cuatro rutas al final de `saveScore`. _Verificable:_ terminar una partida, guardar y navegar al Salón muestra la puntuación recién guardada sin recargar a mano.

9. **El puesto en el modal.** `saveScore` lee el mejor anterior, inserta, calcula puesto y total, y devuelve `rank`, `players` e `isRecord`. `components/game-player.tsx` guarda el resultado y, tras guardar, muestra `▸ PUNTUACIÓN GUARDADA_` con una línea debajo: `PUESTO #04 DE 27` y, si procede, `¡NUEVO RÉCORD PERSONAL!`. La línea se omite cuando `players` es `0`. _Verificable:_ con dos cuentas y dos partidas distintas, cada modal muestra el puesto correcto, y repetir una partida peor que la anterior no anuncia récord.

---

## 5 — Criterios de aceptación

**Base de datos**

- [ ] `public.games` existe con las diez columnas, los tres `check`, el índice único `games_sort_order_idx` y RLS habilitada.
- [ ] `games` tiene exactamente nueve filas y sus `id`, `title`, `short`, `long`, `cat`, `cover` y `color` coinciden carácter a carácter con el array que había en `lib/games.ts`.
- [ ] Un `select` anónimo sobre `games` devuelve las nueve filas; poner `is_published = false` en una la hace desaparecer de ese `select`.
- [ ] Un `insert`, `update` o `delete` sobre `games` como `authenticated` es rechazado por la RLS.
- [ ] La restricción `scores_game_id_allowed` ya no existe y `scores_game_id_fkey` sí.
- [ ] Un `insert` en `scores` con `game_id = 'no-existe'` es rechazado por la clave foránea.
- [ ] Borrar de `games` un juego que tiene partidas falla por `restrict`.
- [ ] `game_leaderboards` devuelve una sola fila por pareja `(game_id, user_id)`, y esa fila lleva la puntuación más alta de ese jugador en ese juego.
- [ ] `game_stats` devuelve nueve filas, y un juego sin partidas aparece con `best = 0`, `plays = 0` y `players = 0`.
- [ ] Las dos vistas tienen `security_invoker = on` y `get_advisors` de seguridad no reporta `security_definer_view` ni ningún aviso nuevo.
- [ ] `lib/database.types.ts` incluye `games`, `game_leaderboards` y `game_stats`, y `npx tsc --noEmit` pasa.
- [ ] Las tres migraciones están versionadas en `supabase/migrations/` además de aplicadas.

**Catálogo**

- [ ] `lib/games.ts` ya no exporta `GAMES`, `getGame` ni `isKnownGame`, y el tipo `Game` ya no tiene `best` ni `plays`.
- [ ] `lib/scores.ts` ya no exporta `seededScores` ni `PLAYERS`, y `grep -r seededScores` no encuentra nada fuera de `specs/`.
- [ ] La Biblioteca muestra los nueve juegos en el mismo orden que antes de la migración.
- [ ] El buscador y los filtros de categoría de la Biblioteca siguen funcionando exactamente igual.
- [ ] La tira `// 02` de la landing sigue mostrando los seis primeros juegos, en el mismo orden.
- [ ] `/juego/asteroides` abre; `/juego/no-existe` da 404.
- [ ] Sin `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `npm run build` pasa, la Biblioteca muestra los nueve juegos del respaldo y los marcadores se ven vacíos en vez de romperse.

**Marcador**

- [ ] Con `scores` vacía, el lateral del Detalle y la tabla del Salón muestran el cartel de estado vacío, no una tabla en blanco ni alias inventados.
- [ ] Ningún alias de la lista antigua (`PX_KAI`, `NEONFOX`, `Z3R0COOL`…) aparece en ninguna pantalla.
- [ ] Tras jugar y guardar dos partidas con la misma cuenta en el mismo juego, el marcador muestra **una** fila con la mejor de las dos.
- [ ] Tras guardar partidas con dos cuentas distintas, el marcador muestra las dos filas ordenadas de mayor a menor y numeradas `#01`, `#02`.
- [ ] `Mejor global` y `Partidas` del Detalle coinciden con `max(score)` y `count(*)` reales de ese juego; `MEJOR PUNTUACIÓN` de la tarjeta coincide con el mismo `max`.
- [ ] La fecha de cada fila del marcador es la de la partida que marcó ese récord, en formato DD/MM/AAAA.

**Salón de la Fama**

- [ ] `/salon` abre en el primer juego del catálogo sin necesidad de parámetro.
- [ ] Pulsar una pestaña navega a `/salon?juego=<id>` y esa URL, pegada en otra pestaña del navegador, abre el mismo marcador.
- [ ] `/salon?juego=no-existe` da 404.
- [ ] El componente `HallOfFame` ya no lleva `"use client"` y no tiene ningún `useState` ni `useEffect`.
- [ ] Con menos de tres jugadores en un juego, el podio dibuja solo las plazas que existen y no falla al leer `rows[1]` o `rows[2]`.
- [ ] Con sesión de cuenta y marca en el juego activo, la fila del jugador aparece resaltada dentro de la tabla y el resumen del final muestra su puesto, su puntuación y su fecha reales.
- [ ] Con sesión de cuenta y **sin** marca en el juego activo, el resumen dice que aún no ha puntuado en vez de inventarse un puesto.
- [ ] Ninguna pantalla muestra ya el puesto `Math.floor(8 + (tab.length % 4))` ni la fecha `11/05/2026`.

**Partidas locales**

- [ ] El bloque `TUS PARTIDAS EN ESTE NAVEGADOR` aparece bajo la tabla del Salón solo cuando `localStorage` tiene partidas del juego de la pestaña activa.
- [ ] Sin partidas guardadas en ese juego, el bloque no se renderiza y no deja hueco.
- [ ] Las partidas de invitado aparecen en ese bloque y **nunca** en el marcador global.
- [ ] Cambiar de pestaña cambia también las partidas del bloque.
- [ ] La primera pintura del Salón no produce ningún aviso de desajuste de hidratación en consola.

**Guardado y frescura**

- [ ] Terminar una partida con sesión de cuenta y guardar muestra `PUESTO #NN DE MM` con valores que coinciden con lo que enseña el Salón.
- [ ] Superar la propia mejor marca anuncia récord personal; no superarla, no.
- [ ] La primera partida de un juego muestra `PUESTO #01 DE 01` y anuncia récord.
- [ ] Guardar y navegar al Salón o al Detalle muestra la puntuación nueva sin recargar a mano.
- [ ] Con sesión de invitado no se inserta ninguna fila, el campo de iniciales sigue editable, el modal sigue ofreciendo el enlace a `/auth` y no se muestra ninguna línea de puesto.
- [ ] Un fallo de red al guardar sigue mostrando la banda de error y dejando el botón operativo, sin cerrar el modal.

---

## 6 — Decisiones tomadas y descartadas

**El marcador no miente, aunque esté vacío.** Se descartó rellenar el top con `seededScores` hasta doce filas. Un Salón de la Fama que mezcla jugadores reales con inventados es peor que uno vacío: el vacío se arregla jugando, la mezcla no se arregla nunca y además hace imposible saber si tu puesto es real. El precio es que el proyecto se ve pelado el primer día, y se paga con un estado vacío que invita a jugar en vez de disculparse.

**Mejor marca por jugador, no una fila por partida.** El `distinct on (game_id, user_id)` es la diferencia entre un salón de la fama y un registro de actividad. Con una fila por partida, el primero que juegue diez veces copa el top diez él solo. La tabla `scores` sigue guardando el historial completo —eso no cambia—, pero el marcador lo colapsa.

**Vistas SQL, no agregación en TypeScript.** Traerse todas las filas de `scores` y agrupar en el servidor de Next funcionaría hoy, con cero partidas, y dejaría de funcionar sin avisar. `distinct on` es de Postgres y esto es Postgres. Además, la vista es reutilizable desde la Server Action que calcula el puesto sin repetir la lógica.

**`security_invoker = on` en las dos vistas.** Es la decisión de seguridad de este spec y es fácil de olvidar: una vista de Postgres se ejecuta por omisión con los permisos de quien la creó, así que se salta la RLS de las tablas que consulta. Aquí las dos tablas tienen lectura pública y el resultado sería idéntico, pero dejarlo sin `security_invoker` planta una vista privilegiada que el día que `scores` gane una política restrictiva la ignorará en silencio. El _advisor_ de Supabase también lo marca.

**El catálogo se lee en servidor, con respaldo al array.** Se descartó leerlo desde el cliente: obligaría a estados de carga en la Biblioteca y en la Landing, que hoy pintan de una. Y se descartó el respaldo opcional: `lib/catalog.ts` cae a `FALLBACK_GAMES` siempre que Supabase no responda, porque `README.md` promete que la app se sirve sin variables de entorno y una portada sin juegos no es «degradada», es rota.

**`best` y `plays` dejan de ser columnas.** Ponerlos en `games` habría sido más rápido y habría conservado las cifras bonitas (`12.4K` partidas), pero son la misma mentira de antes con una tabla detrás, y además exigen mantenerlos sincronizados con `scores` por trigger o a mano. `game_stats` los calcula. El coste asumido es visible: el Detalle dirá `Partidas 0` hasta que alguien juegue.

**`sort_order` único, sembrado de diez en diez.** Sin él, `select … from games` devuelve las filas en el orden que a Postgres le convenga y la Biblioteca cambiaría de orden entre despliegues. El paso de diez permite insertar un juego entre dos sin renumerar los nueve.

**`is_published` en la política de RLS, no en cada consulta.** Filtrar en el cliente de PostgREST obliga a acordarse en los cinco sitios que consultan el catálogo, y olvidarlo en uno filtra un juego retirado. En la política se cumple siempre, incluso desde la consola de Supabase con la clave pública.

**Clave foránea con `restrict`, no con `cascade`.** `cascade` convierte un clic despistado en el panel de Supabase en la pérdida silenciosa de todo el historial de un juego. `restrict` obliga a decidir explícitamente qué hacer con las partidas, e `is_published` cubre el caso real —retirar un juego del catálogo— sin tocar ninguna fila de `scores`.

**El Salón pasa a Server Component con la pestaña en la URL.** Se descartó mantenerlo en cliente llamando a una Server Action por pestaña: obliga a manejar carga y error a mano, y deja la URL congelada en `/salon` diga lo que diga la pantalla. Con `?juego=`, un marcador concreto se puede enlazar y compartir, que es media gracia de competir. Se descartó también precargar los nueve marcadores para que las pestañas fueran instantáneas: es nueve veces el dato para mostrar uno.

**`localStorage` sobrevive, pero separado.** El SPEC 05 lo dejó vivo porque la lectura no había migrado, y este spec podría retirarlo del todo. No se hace: el invitado sigue sin poder escribir en la base, y quitarle `localStorage` significa que su partida no se guarda en ningún sitio. Lo que sí se corta es la mezcla: sus partidas van a un bloque propio, rotulado, bajo el marcador. El ranking global es de la base y solo de la base.

**El bloque local va en el Salón y filtrado por pestaña, también para las cuentas.** Se descartó enseñarlo solo a los invitados: una cuenta pudo jugar como invitado antes de registrarse, y esconderle esas partidas es tirar datos que ya tiene. Va donde el jugador va a buscar sus marcas, y junto al marcador con el que quiere compararlas.

**El puesto se calcula en `saveScore` y no rompe el guardado si falla.** Es el instante exacto en que a alguien le importa su posición, y la acción ya tiene sesión, juego y puntuación: la consulta extra es barata. Pero la fila ya está insertada cuando se calcula, así que un error en ese cálculo devuelve `ok: true` con puesto cero y el modal omite la línea. Decir «no se ha guardado» de algo que sí se guardó sería el peor de los fallos posibles aquí.

**`force-dynamic` más `revalidatePath`, no revalidación por tiempo.** Con nueve juegos y un puñado de filas, el coste de renderizar cada visita es irrelevante. Sesenta segundos de caché, en cambio, caen justo en el minuto en que acabas de guardar y vas al Salón a verte.

**La landing conserva su escaparate.** `TOP_PLAYERS` y `STATS` de `lib/landing.ts` siguen siendo texto de marketing. Son cifras globales entre juegos y de jugadores acumulados; derivarlas hoy dejaría la portada del sitio anunciando cero jugadores y cero partidas. Está declarado como fuera de alcance, no olvidado.

**Sin pantalla de administración.** Sembrar por migración y no dar ninguna política de escritura es coherente con lo que hay: no existe el concepto de administrador en el proyecto, e inventarlo aquí abriría un tercer dominio —roles, autorización, formularios, validación— en una spec que ya lleva dos.

---

## 7 — Riesgos identificados

**Vista sin `security_invoker`.** Es el fallo silencioso más probable de este spec: la vista funciona, devuelve los datos correctos y nadie nota nada, hasta que las políticas de `scores` cambien y la vista siga viendo todo. _Mitigación:_ está en las dos definiciones, tiene criterio de aceptación propio y `get_advisors` lo comprueba.

**La migración de `games` se desincroniza de `FALLBACK_GAMES`.** Vuelven a ser dos listas de lo mismo, aunque ahora una sea solo respaldo. Si alguien añade un juego por migración y no toca el array, el catálogo cambia según haya o no variables de entorno. _Mitigación:_ el respaldo solo se usa sin Supabase configurado, y `lib/catalog.ts` deja un aviso en consola cuando cae a él, para que la discrepancia no pase por comportamiento normal.

**Orden del catálogo distinto entre base y respaldo.** El respaldo ordena por el orden del array y la base por `sort_order`. Si divergen, la Biblioteca cambia de orden. _Mitigación:_ `FALLBACK_GAMES` lleva `sortOrder` explícito y `listGames` ordena por ese campo en los dos caminos.

**El podio del Salón asume tres filas.** El código actual lee `rows[0]`, `rows[1]` y `rows[2]` sin comprobar nada, porque `seededScores` siempre devolvía doce. Con la base real, lo normal el primer día es cero filas: eso es un `TypeError` en el primer render de `/salon`. _Mitigación:_ el podio se construye a partir de las plazas que existen y hay criterio de aceptación para el caso de menos de tres.

**Desajuste de hidratación en el bloque de partidas locales.** El Salón pasa a renderizarse en servidor, donde `localStorage` no existe. Pintar el bloque en el primer render con datos que el servidor no tiene rompe la hidratación. _Mitigación:_ es un componente cliente aparte que empieza vacío y se rellena en `useEffect`, el mismo patrón que ya usaba `hall-of-fame.tsx`.

**`revalidatePath` desde un Server Action con `force-dynamic`.** Las dos cosas juntas son redundantes: si la página no se cachea, no hay nada que invalidar. No hace daño, pero puede dar falsa sensación de que la frescura está resuelta por la invalidación cuando en realidad la resuelve el renderizado dinámico. _Mitigación:_ se deja documentado aquí; si algún día se quita `force-dynamic`, la invalidación ya está puesta.

**Alias duplicados en el marcador.** `profiles.username` es único, así que no puede haber dos filas con el mismo nombre... salvo que un día se permita cambiar el alias. La política `profiles_update_own` existe desde el SPEC 04 aunque ninguna pantalla la use. _Mitigación:_ la vista lleva `user_id`, así que la identidad de la fila nunca depende del nombre; la clave de React usa `user_id`.

**El `check` de `cat` y `color` se desincroniza de los tipos de TypeScript.** Misma clase de riesgo que el `check` que este spec retira, en pequeño: `GameCategory` y `GameColor` están escritos en la base y en `lib/games.ts`. _Mitigación:_ los tipos generados en `lib/database.types.ts` los declaran como `string`, así que `lib/catalog.ts` valida al mapear y descarta con aviso la fila cuya categoría o color no reconozca, en vez de colar un valor imposible en un tipo estrecho.

**Coste de las consultas por página.** El Salón hace tres consultas (catálogo, estadísticas, top) y el Detalle otras tres, en cada visita y sin caché. Con nueve juegos es irrelevante; con novecientos y un top paginado, no. _Mitigación:_ ninguna ahora, es una limitación asumida y proporcionada al tamaño del proyecto.

---

## 8 — Desviaciones al implementar

Dos cosas se apartaron del §4, las dos por el mismo motivo: el plan daba por hecho un detalle del entorno que no se sostiene.

**`import "server-only"` no se puso.** El §3 lo pedía en `lib/catalog.ts` y `lib/leaderboard.ts`, pero el paquete no está instalado y añadir una dependencia no estaba en el alcance. No hace falta: los dos módulos importan `lib/supabase/server.ts`, que importa `next/headers`, y Next rechaza en compilación cualquier componente cliente que arrastre eso. La barrera que se buscaba ya existe.

**`export const dynamic = "force-dynamic"` es redundante, y se dejó igualmente.** Las cuatro páginas llaman a `cookies()` a través del cliente de servidor de Supabase, así que ya son dinámicas sin declararlo: `npm run build` las marca `ƒ` con y sin la línea. Además Next 16 ha sacado `dynamic` de la referencia de configuración de segmento —solo sobrevive en la guía `caching-without-cache-components`— y recomienda `connection()` en su lugar. Se conserva porque documenta la intención en el fichero, pero es rótulo, no mecanismo. El riesgo ya anotado en el §7 sobre `revalidatePath` + `force-dynamic` sigue vigente y ahora tiene nombre.

---

## Lo que **no** entra en este spec

Pantalla de administración del catálogo. `TOP_PLAYERS` y `STATS` de la landing. Puntuaciones de invitados en la base. Importar a la base lo guardado en `localStorage`. Anti-trampas. Marcadores en vivo. Paginación y filtros temporales del Salón. Tetris, Arkanoid y los siete juegos sin motor. Portadas en la base. Retirar `av_scores`. Tests.
