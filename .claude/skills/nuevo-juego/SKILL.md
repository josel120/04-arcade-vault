---
name: nuevo-juego
description: Integra un juego nuevo en Arcade Vault de punta a punta — ficha de catálogo, portada CSS, motor TypeScript sobre el contrato de la plataforma, registro, controles y marcador real. Úsala cuando haya que añadir, portar o hacer jugable un juego, venga o no de references/started-games/.
argument-hint: <id o nombre del juego> [ruta del original, si la hay]
---

# /nuevo-juego — Añadir un juego jugable con su marcador

Esta skill es la receta de implementación destilada de `specs/05-juego-asteroides.md`
(el primer motor real) y `specs/06-leaderboard-y-tabla-de-juegos.md` (el catálogo y el
marcador en la base). Todo lo que hay aquí ya está construido y funcionando para
`asteroides`: **el trabajo de un juego nuevo es rellenar los huecos, no rediseñar nada.**

## Lo que ya está resuelto y no hay que volver a hacer

Léelo antes de planificar nada, porque acota el trabajo a la mitad:

- **El marcador es genérico.** `public.scores`, las vistas `game_leaderboards` y
  `game_stats`, `lib/leaderboard.ts`, el Salón de la Fama, el lateral del Detalle, la
  línea `PUESTO #NN DE MM` del modal y el bloque de partidas locales están indexados por
  `game_id`. **Un juego nuevo no necesita ni una línea de código de marcador**: en cuanto
  su fila existe en `public.games`, todo eso funciona solo.
- **El contrato del motor existe** en `lib/games/engine.ts` (`GameEngine`, `GameSnapshot`,
  `GameAction`, `GAME_KEYS`, `isTextTarget`).
- **El anfitrión del canvas existe** en `components/games/game-canvas.tsx`: monta el motor,
  escala por `devicePixelRatio` (capado a 2), gestiona `P`/`Escape` y la pausa al ocultar
  la pestaña, y desmonta limpio.
- **El reproductor ya funciona en dos modos** en `components/game-player.tsx`: con motor
  registrado pinta el canvas y el HUD real; sin motor cae a la arena decorativa del SPEC 01.
- **El guardado existe** en `app/jugar/[id]/actions.ts`: valida contra el catálogo, resuelve
  el `user_id` de la sesión, inserta, calcula puesto y récord, y revalida las cuatro rutas.

Lo único que un juego nuevo aporta: **una fila de catálogo, una portada CSS, un motor y una
línea en el registro.**

---

## Fase 0 — De dónde sale el juego

Tres orígenes posibles. Identifícalo antes de nada, porque cambia el trabajo del motor.

**A) Está en `references/started-games/`.** Hoy hay `02-asteroids` (ya portado),
`03-tetris` y `04-arkanoid`. Es un `index.html` + `game.js` en JavaScript plano, con el
estado en globales de módulo. El trabajo es **portar**, y `lib/games/asteroides/engine.ts`
es el ejemplo de referencia de cómo se hace. Lee el `game.js` **entero** antes de traducir
nada, y también su `README.md` y su `CLAUDE.md` si los tiene: suelen documentar las
constantes de equilibrio. Mira si trae ficheros hermanos (`levels.js`, `spritesheet.js`,
`assets/`): eso es trabajo extra que no se ve en el `game.js`.

**B) Viene de fuera** (una ruta que da el usuario, un repo, un fichero pegado). Mismo
trabajo que A, pero **antes**: revisa qué dependencias externas trae. La plataforma no
carga librerías de juego; si el original depende de una, decide con el usuario si se
instala o se reescribe esa parte.

**C) No existe todavía.** Hay que escribirlo en TypeScript desde cero. Parte de
`motor-plantilla.ts` (en esta misma carpeta): es el esqueleto del contrato con el bucle,
el `dt` capado, el teclado, el diffing de snapshots y el `destroy` idempotente ya resueltos.

**Si el juego tiene entidad propia —decisiones de alcance, datos nuevos, riesgos—, dile al
usuario que lo pase antes por `/spec`.** Esta skill implementa; el proyecto es spec-driven.
No invoques `/spec-impl` tú: esa la lanza el usuario.

---

## Fase 1 — Preguntar lo que no se puede deducir

Usa `AskUserQuestion`. No inventes ninguno de estos campos:

1. **`id`** — segmento de URL, kebab-case, tiene que cumplir el `check` de la base:
   `^[a-z0-9-]{2,40}$`. Ojo: el catálogo usa nombres en castellano (`caida`,
   `serpentina`, `gloton`), no el nombre del original.
2. **`title`** — en mayúsculas, como los otros nueve.
3. **`cat`** — `ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`. No hay más: está en el `check`
   `games_cat_allowed` y en el tipo `GameCategory`.
4. **`color`** — `cyan` | `magenta` | `yellow` | `green`. Igual: `games_color_allowed`.
5. **Resolución interna del motor.** Fija, en píxeles lógicos. Asteroides usa 800×600 y el
   CSS de `.game-canvas` asume `aspect-ratio: 4 / 3`. **Una relación de aspecto distinta
   obliga a tocar `.game-canvas`** — decisión que hay que tomar aquí, no descubrir al final.
   Tetris (vertical) y Arkanoid (800×600) no encajan igual.
6. **Colisión con una ficha existente.** Si ya hay un juego de maqueta que describe lo
   mismo (`rocas` describía asteroides, `caida` describe Tetris, `bloque-buster` describe
   Arkanoid), pregunta explícitamente: ¿ficha nueva o se le pone motor a la existente?
   El SPEC 05 eligió ficha nueva para `asteroides` y dejó `rocas` intacto. **Poner motor a
   una ficha existente es más limpio** —no duplica catálogo— y ahorra la Fase 2 entera,
   porque el juego ya está en `public.games`.

`short`, `long` y `sortOrder` puedes proponerlos tú: `short` una línea para la tarjeta,
`long` dos o tres frases para el Detalle, y `sortOrder` el siguiente múltiplo de 10 libre
(hoy el último es 90 → el siguiente es 100).

---

## Fase 2 — El catálogo: migración + respaldo

**Solo si el juego es una ficha nueva.** Si le estás poniendo motor a un juego que ya
existe en el catálogo, salta a la Fase 3.

Son **dos sitios y hay que tocar los dos**. Es el riesgo documentado en el §7 del SPEC 06:

1. **La base, que es la fuente de verdad.**
   - Aplica la migración con `mcp__supabase__apply_migration`, nombre `add_game_<id>`.
   - **Y versiona el `.sql` en `supabase/migrations/`** con el nombre y la marca de tiempo
     que le asigne Supabase. Es criterio de aceptación del SPEC 06; aplicar sin versionar
     deja el repo mintiendo sobre el esquema.
   - El `insert` va sobre
     `public.games (id, title, short, long, cat, cover, color, sort_order)`.
     `is_published` y `created_at` tienen valor por omisión.
   - Comprueba con `mcp__supabase__execute_sql` que la fila está, y pasa
     `mcp__supabase__get_advisors` (`security`) para confirmar que no aparece ningún aviso
     nuevo.
   - **No regeneres `lib/database.types.ts`**: insertar filas no cambia el esquema. Solo si
     añades columnas, tablas o vistas.

2. **El respaldo en `lib/games.ts`.** Añade la entrada a `FALLBACK_GAMES` con exactamente
   los mismos textos, carácter a carácter, y su `sortOrder`. Es lo que se sirve sin
   variables de entorno, y `README.md` promete que la app se sirve sin configurar.

**Lo que ya NO hay que tocar:** el `check` `scores_game_id_allowed` no existe desde el
SPEC 06 — la integridad la da la clave foránea `scores_game_id_fkey` contra `games.id`. Si
el juego no está en `public.games`, `saveScore` devuelve `validation` y la fila se rechaza.

**Comprueba el tope de puntuación.** `MAX_SCORE` (`lib/games.ts`) y la restricción
`scores_score_range` valen 10.000.000. Si el juego nuevo puede pasar de ahí en una partida
larga, dilo: subirlo es otra migración y hay que tocar los dos sitios.

---

## Fase 3 — La portada CSS

Clase `.cover-<id>` en `app/globals.css`, junto a las otras nueve (busca `.cover-`, están
todas seguidas). Convenciones del proyecto, no negociables:

- **Solo gradientes CSS.** Ni imágenes, ni SVG, ni emojis salvo como glifo en un `::before`
  (`cover-asteroides` usa `▸` para la nave; `cover-glot` y `cover-rocas` tienen ejemplos).
- Base en el elemento, detalle en `::after`, acento en `::before`.
- Usa las variables de tema (`var(--cyan)`, `var(--magenta)`, `var(--yellow)`, `var(--ink)`).
- Tiene que distinguirse de un vistazo de las otras nueve.

**Invoca `/frontend-design` para diseñarla** — lo exige `CLAUDE.md`, y esto es interfaz.

---

## Fase 4 — El motor

Fichero `lib/games/<id>/engine.ts`, exportando `createEngine: CreateEngine`. Si el juego
trae datos separados (niveles, tablas de piezas), van a ficheros hermanos:
`lib/games/<id>/levels.ts`, `lib/games/<id>/pieces.ts`. Los binarios (sprites, sonidos) van
a `public/juegos/<id>/`; ten en cuenta que el SPEC 05 dejó el sonido fuera de alcance a
propósito, así que si el original trae audio, pregunta antes de portarlo.

**Reglas duras. Cada una está aquí porque su ausencia causa un fallo concreto:**

| Regla | Qué rompe si no se cumple |
| --- | --- |
| Todo el estado dentro de `createEngine`, ningún global de módulo | El doble montaje de React Strict Mode hace que dos partidas compartan estado |
| `destroy()` idempotente: `cancelAnimationFrame` + quitar **todos** los listeners | Dos bucles a la vez; el juego va al doble de velocidad y sigue corriendo tras navegar |
| `onSnapshot` **solo cuando cambia** `score`, `lives`, `level` o `status` | 60 renders de React por segundo compitiendo con el bucle de dibujo |
| `dt` capado (`Math.min(delta, 0.05)`) | Espiral de la muerte al volver de una pestaña oculta |
| Nada de `GAME OVER` dibujado ni reinicio con Espacio | El modal es de React; el canvas duplicaría el cartel y el Espacio del modal reiniciaría la partida |
| El HUD del canvas se retira: puntuación, vidas y nivel los pinta la plataforma | La misma información dos veces con dos tipografías |
| `preventDefault` solo sobre `GAME_KEYS` y solo si `!isTextTarget(e.target)` | La página hace scroll bajo el jugador, o no se puede escribir el alias en el modal |
| El `ctx` se pasa a `draw(ctx)`, no se cierra sobre un global | Deja de poder haber dos instancias, y vuelve el problema del Strict Mode |
| Las constantes de equilibrio del original se copian **sin cambiar un número** | El juego portado ya no es el juego que estaba probado |

**Excepción documentada al HUD:** algo que cambia varias veces por segundo puede quedarse
dibujado en el canvas (asteroides mantiene el contador `3x` del disparo triple), porque
subirlo al HUD obligaría a re-renderizar React a ese ritmo solo para adornar un temporizador.

**Lo que `GameEngine` obliga a implementar:** `pause`, `resume`, `restart`, `finish`
(lo llama el botón FIN del HUD), `setAction` (controles táctiles) y `destroy`.

**Si el juego no tiene el concepto de «vidas» o «nivel»** (Tetris tiene nivel pero no
vidas; muchos puzzles no tienen ninguno de los dos): `GameSnapshot` los exige igualmente.
Decide con el usuario qué mapear —líneas a nivel, `lives: 0`— o si el HUD debe dejar de
mostrar ese campo para ese juego. **No metas un valor fijo sin decirlo**: el HUD enseñaría
tres corazones eternos en un juego sin vidas.

---

## Fase 5 — Los controles

Aquí está el trabajo que el SPEC 05 dejó a medias, porque solo había un juego. **Léelo
antes de dar el motor por terminado.**

`GameAction` es `"left" | "right" | "thrust" | "fire"`: nombres de asteroides. Además, en
`components/game-player.tsx` la leyenda `.game-keys` está **escrita a mano con las teclas de
asteroides** (`Girar` / `Propulsar` / `Disparar` / `Pausa`), y `components/games/touch-pad.tsx`
tiene esos cuatro botones fijos, con sus `aria-label`.

Para el segundo juego hay dos caminos. Elige **con el usuario**:

1. **Reutilizar las cuatro acciones con significado propio** (`thrust` = rotar pieza,
   `fire` = caída rápida). El motor funciona al instante, pero **la leyenda y los
   `aria-label` de la botonera mienten**, así que hay que hacerlos por juego igualmente.
2. **Hacer los controles parte del registro**, que es a donde apunta el diseño: añadir a
   `GameEngineEntry` algo como
   `controls: { action: GameAction; key: string; label: string; pad: string }[]`, y que
   `game-player.tsx` pinte la leyenda y `touch-pad.tsx` los botones a partir de ese dato.
   Es más trabajo una vez y ninguno después.

Si el juego necesita una acción que no existe (`rotate`, `drop`, `hold`), **extiende
`GameAction` en `lib/games/engine.ts`** y actualiza `TouchPad`, la leyenda y `GAME_KEYS`.
No la disfraces de `fire`.

Verifica siempre: las teclas del juego están en `GAME_KEYS`, la botonera táctil mueve algo
en un viewport de puntero grueso, y `P` / `Escape` siguen pausando.

---

## Fase 6 — El registro

Una línea en `lib/games/registry.ts`:

```ts
<id>: {
  width: <ancho lógico>,
  height: <alto lógico>,
  load: () => import("@/lib/games/<id>/engine"),
},
```

`load` es un `import()` dinámico **a propósito**: mantiene el motor fuera del bundle de la
Biblioteca y de los juegos que siguen siendo maqueta. No lo cambies por un import estático.

Con esta línea, `/jugar/<id>` deja de pintar la arena decorativa y pasa a montar el canvas.
No hace falta tocar `game-player.tsx` para eso.

---

## Fase 7 — Verificación

**Automático, siempre:**

```
npx tsc --noEmit
npm run build
```

**A mano, en el navegador.** Esta lista sale de los criterios de aceptación del SPEC 05 y
del SPEC 06; recórrela entera antes de decir que está terminado:

_Catálogo_

- [ ] La tarjeta aparece en la Biblioteca con portada propia y distinta de las demás.
- [ ] El buscador lo encuentra y el filtro de su categoría lo muestra.
- [ ] `/juego/<id>` abre y su botón JUGAR lleva a `/jugar/<id>`.

_El juego_

- [ ] Se ve dentro del marco CRT sin scroll horizontal a 1280 px **ni a 390 px**.
- [ ] Cada control hace lo suyo, y las teclas del juego no desplazan la página.
- [ ] Terminar la partida abre el modal FIN DEL JUEGO con la puntuación real, y el canvas
      no dibuja ningún cartel propio.

_Integración_

- [ ] Puntuación, vidas y nivel del HUD coinciden con el motor y **no se mueven en pausa**.
- [ ] PAUSA congela y muestra EN PAUSA; `P` y `Escape` alternan; cambiar de pestaña y
      volver lo encuentra pausado.
- [ ] JUGAR DE NUEVO reinicia de cero.
- [ ] SALIR navega y **no queda ningún `requestAnimationFrame` programado**.
- [ ] En `npm run dev`, con el doble montaje de Strict Mode, hay **un solo** bucle: nada se
      mueve al doble de velocidad.
- [ ] La leyenda de controles describe **estos** controles, no los de asteroides.

_Marcador_ (lo que confirma que la Fase 2 se hizo bien)

- [ ] Con sesión de cuenta, guardar inserta una fila en `public.scores` con este `game_id`.
- [ ] El modal muestra `PUESTO #NN DE MM` y anuncia récord solo si se superó el anterior.
- [ ] `/salon?juego=<id>` tiene su pestaña y muestra la marca recién guardada.
- [ ] `Mejor global` y `Partidas` del Detalle dejan de ser `0`.
- [ ] Como invitado no se inserta nada y la marca aparece en TUS PARTIDAS EN ESTE NAVEGADOR.
- [ ] Sin las variables `NEXT_PUBLIC_SUPABASE_*`, `npm run build` pasa, el juego es jugable
      y solo falla el guardado, con mensaje visible.

_Los otros juegos_

- [ ] `/jugar/caida` y los demás sin motor siguen con su arena decorativa, sin cambios.

---

## Errores que ya se han cometido en este proyecto

- **Aplicar la migración y no versionar el `.sql`.** Van los dos, siempre.
- **Añadir el juego a la base y olvidar `FALLBACK_GAMES`** (o al revés). El catálogo cambia
  según haya o no configuración. `lib/catalog.ts` avisa por consola cuando cae al respaldo:
  si ves ese aviso, es que faltan las variables de entorno, no que el respaldo sea lo normal.
- **Copiar el `game.js` con sus globales intactos.** Compila, funciona en producción y se
  rompe justo en desarrollo con Strict Mode. Estado por instancia, siempre.
- **Dejar la leyenda de controles de asteroides.** Es lo primero que se ve y lo último que
  se revisa.
- **`import "server-only"`**: no está instalado y no hace falta. `lib/catalog.ts` y
  `lib/leaderboard.ts` documentan por qué (importan `next/headers`, y Next ya rechaza en
  compilación cualquier componente cliente que los arrastre). No lo añadas.

## Reglas de la casa

- Todo el código, los comentarios y los textos de interfaz **en castellano**, como el resto
  del proyecto.
- Next 16 es más nuevo que tus datos de entrenamiento: si tocas algo de framework, lee antes
  la página que toque de `node_modules/next/dist/docs/` (lo exige `AGENTS.md`).
- No borres nada de `references/started-games/`: el original se queda como referencia.
- No hay framework de tests. Si crees que hace falta, pregunta antes qué runner instalar.
- No hagas commit por tu cuenta. Enseña el diff y deja que decida el usuario.
