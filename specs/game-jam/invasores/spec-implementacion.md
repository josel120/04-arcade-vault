# SPEC (GAME JAM) — INVASORES: implementación

> Compañero: spec-diseno.md, en esta misma carpeta

---

## 3 — Modelo de datos

### La fila del catálogo — ya existe, no se toca

`invasores` ya está en `FALLBACK_GAMES` (`lib/games.ts`) y, si el catálogo viene de
Supabase, en `public.games`:

```ts
{
  id: "invasores",
  title: "INVASORES",
  short: "Defiende el planeta de filas alienígenas.",
  long: "Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.",
  cat: "SHOOTER",
  cover: "cover-invaders",
  color: "green",
  sortOrder: 50,
}
```

`sort_order` **50 ya está asignado** — es el que tiene la ficha maqueta desde que se sembró
el catálogo, no un valor nuevo que este spec tenga que elegir. No hace falta migración, no
hace falta tocar `FALLBACK_GAMES`: las Fases 2 y 3 de `/nuevo-juego` están completas desde
antes de este spec. La portada `.cover-invaders` (`app/globals.css`, líneas 747-765 en el
momento de escribir esto) tampoco se toca: ya usa gradientes puros y ya se distingue de
`.cover-rocas`, su vecina en la parrilla.

**Si al implementar esto el catálogo ha crecido** y `sort_order` 50 ya no es el que tiene
`invasores` en `lib/games.ts`, es que algo se movió fuera de este spec — no hay nada que
recalcular aquí, porque no se inserta ninguna fila nueva.

### Las constantes — `lib/games/invasores/engine.ts`

| Constante                                     | Valor                   | De dónde sale                                                                                         |
| --------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Lienzo                                        | 800 × 600               | Fijo para todos los motores desde la SPEC 05                                                          |
| `ROWS` / `COLS`                               | 5 / 11                  | 55 invasores: 1 fila de calamar, 2 de cangrejo, 2 de pulpo                                            |
| `ALIEN_W` / `ALIEN_H`                         | 32 / 24 px              | Tamaño de dibujo de cada invasor                                                                      |
| `CELL_W` / `CELL_H`                           | 48 / 40 px              | Espaciado de la rejilla de formación                                                                  |
| `FORMATION_LEFT` / `FORMATION_TOP`            | 144 / 80 px             | Centra la formación (512 px de ancho) en el lienzo, con margen para moverse                           |
| `EDGE_MARGIN`                                 | 40 px                   | Distancia al borde del lienzo a la que la formación invierte dirección                                |
| `STEP_PX`                                     | 10 px                   | Paso horizontal de la formación en cada marcha                                                        |
| `DROP_PX`                                     | 16 px                   | Lo que baja la formación al invertir dirección                                                        |
| `BASE_STEP_MS`                                | 800 ms                  | Intervalo de paso en la oleada 1 con los 55 invasores vivos                                           |
| `MIN_STEP_MS`                                 | 60 ms                   | Suelo de velocidad — sin él, la fórmula cruza valores absurdos, igual que en VÍBORA                   |
| `WAVE_SPEED_FACTOR`                           | 0.92                    | Cada oleada empieza un 8 % más rápida que la anterior                                                 |
| `DANGER_Y`                                    | 540 px                  | Si el borde inferior de un invasor la alcanza, fin de partida instantáneo                             |
| `PLAYER_Y`                                    | 560 px                  | Fila del cañón                                                                                        |
| `PLAYER_W` / `PLAYER_H`                       | 40 / 20 px              | Tamaño del cañón                                                                                      |
| `PLAYER_SPEED`                                | 280 px/s                | Velocidad horizontal, sin inercia                                                                     |
| `LIVES`                                       | 3                       | Como ARKANOID y VÍBORA                                                                                |
| `DEATH_MS`                                    | 1200 ms                 | Pausa parpadeante tras perder una vida                                                                |
| `INVULN_MS`                                   | 1500 ms                 | Ventana de invulnerabilidad tras reaparecer                                                           |
| `PLAYER_BULLET_SPEED`                         | 480 px/s (hacia arriba) | —                                                                                                     |
| `PLAYER_BULLET_MAX`                           | 1                       | Un solo disparo del jugador en pantalla — decisión de diseño, §6 del spec de diseño                   |
| `ALIEN_BULLET_SPEED`                          | 220 px/s (hacia abajo)  | —                                                                                                     |
| `ALIEN_BULLET_MAX`                            | 3                       | Balas de invasor simultáneas                                                                          |
| `ALIEN_FIRE_BASE_CHANCE`                      | 0.08 por paso           | Probabilidad de que se dispare una bala nueva en cada paso de la formación, con cupo libre            |
| `ROW_POINTS`                                  | `[30, 20, 20, 10, 10]`  | Puntos por fila, de arriba abajo                                                                      |
| `UFO_POINTS`                                  | `[50, 100, 150, 300]`   | Sorteo uniforme al matar el OVNI — no la tabla de 15 disparos del original, ver §6 del spec de diseño |
| `UFO_SPEED`                                   | 160 px/s                | —                                                                                                     |
| `UFO_Y`                                       | 46 px                   | Fila fija, por encima de la formación                                                                 |
| `UFO_MIN_INTERVAL_MS` / `UFO_MAX_INTERVAL_MS` | 15.000 / 28.000 ms      | Rango del temporizador entre apariciones                                                              |
| `BUNKER_COUNT`                                | 4                       | —                                                                                                     |
| `BUNKER_COLS` / `BUNKER_ROWS`                 | 7 / 5                   | Subceldas por búnker                                                                                  |
| `BUNKER_CELL`                                 | 8 px                    | Tamaño de cada subcelda — el búnker completo mide 56 × 40 px                                          |
| `BUNKER_Y`                                    | 460 px                  | Fila de los cuatro búnkeres, entre la formación y el cañón                                            |
| `BUNKER_X`                                    | `[100, 280, 460, 640]`  | Origen horizontal de cada búnker, repartidos a intervalos de 180 px                                   |

La probabilidad de disparo alienígena sube cuanta menos formación queda:
`chance = ALIEN_FIRE_BASE_CHANCE * (1 + (1 - vivos / 55) * 2)`, evaluada una vez por paso
de la formación mientras haya cupo libre bajo `ALIEN_BULLET_MAX`. El intervalo de paso de
la oleada `n` con `vivos` invasores es
`max(MIN_STEP_MS, BASE_STEP_MS * WAVE_SPEED_FACTOR ** (n - 1) * (vivos / 55))`.

### La forma de los invasores y del OVNI — `lib/games/invasores/sprites.ts`

Fichero hermano, con el precedente de `lib/games/tetris/pieces.ts`: matrices booleanas,
no imágenes. Tres tipos de invasor —`squid` (fila 0, 30 pts), `crab` (filas 1-2, 20 pts),
`octopus` (filas 3-4, 10 pts)— con dos fotogramas cada uno para la animación de marcha, más
la silueta del OVNI. Son siluetas propias para este spec, no una copia del arcade original
(ver §6 del spec de diseño). Formato:

```ts
export type AlienType = "squid" | "crab" | "octopus";

/** Dos fotogramas por tipo; se alterna uno por cada paso de la formación. */
export const ALIEN_FRAMES: Record<AlienType, [boolean[][], boolean[][]]> = {
  squid: [frameA, frameB],
  crab: [frameA, frameB],
  octopus: [frameA, frameB],
};

export const UFO_SHAPE: boolean[][] = [/* silueta ovalada de OVNI, 11 × 6 */];
```

`ROW_TYPE(row: number): AlienType` mapea la fila a su tipo: `0 → squid`, `1-2 → crab`,
`3-4 → octopus`.

### La forma de los búnkeres — también en `sprites.ts`

```ts
/** 7 × 5. `true` = subcelda ocupada. El arco con hueco inferior del original. */
export const BUNKER_SHAPE: boolean[][] = [
  [false, true, true, true, true, true, false],
  [true, true, true, true, true, true, true],
  [true, true, true, true, true, true, true],
  [true, true, false, false, false, true, true],
  [true, true, false, false, false, true, true],
];
```

Cada búnker tiene su propia copia mutable de esta matriz al iniciar la partida —**no** se
comparte la referencia entre los cuatro, y **no** se regenera entre oleadas: se degrada
durante toda la partida y solo se reinicia con `restart()`.

### El estado, todo dentro de `createEngine`

```ts
type Alien = { row: number; col: number; alive: boolean };
type Bullet = { x: number; y: number; vx: number; vy: number };
type Bunker = { x: number; y: number; cells: boolean[][] };
type Ufo = { x: number; y: number; dir: 1 | -1; alive: boolean } | null;

let aliens: Alien[]; // 55 entradas fijas, `alive` se apaga; nunca se recorta el array
let formationX: number;
let formationY: number;
let formationDir: 1 | -1;
let formationFrame: 0 | 1; // fotograma de animación, alterna cada paso
let marchTone: 0 | 1 | 2 | 3; // índice del ciclo de la marcha, alterna cada paso

let playerX: number;
let playerBullet: Bullet | null;
let alienBullets: Bullet[];
let bunkers: Bunker[]; // 4, persisten sin repararse
let ufo: Ufo;
let ufoTimer: number; // ms hasta la próxima aparición

let score: number;
let lives: number;
let wave: number; // = level en el snapshot
let status: GameStatus;

let dead: boolean; // igual que en VÍBORA: no viaja en el snapshot
let deathElapsed: number;
let invulnUntil: number; // ms de partida en los que el cañón no puede morir
```

Todo por instancia, ninguna variable de módulo — el mismo motivo que ya documentaron
ASTEROIDES, TETRIS, ARKANOID y VÍBORA: el doble montaje de Strict Mode comparte estado si
no lo es.

### El snapshot

```ts
{ score, lives, level: wave, status }
```

Sin traducciones: `lives` son las vidas del cañón, `level` es la oleada en curso. Es un
juego con vidas y con nivel nativos, así que el `GameSnapshot` se llena sin trampas — a
diferencia de TETRIS, que no tiene vidas.

### Los controles declarados — la entrada de `GAME_ENGINES`

```ts
invasores: {
  width: 800,
  height: 600,
  keys: [
    { keys: ["◄", "►"], label: "Mover el cañón" },
    { keys: ["Espacio"], label: "Disparar" },
  ],
  touch: [
    [
      { action: "left",  glyph: "◄", label: "Mover a la izquierda", tone: "cyan" },
      { action: "right", glyph: "►", label: "Mover a la derecha",   tone: "cyan" },
    ],
    [
      { action: "fire", glyph: "●", label: "Disparar", tone: "magenta" },
    ],
  ],
  audio: true,
  load: () => import("@/lib/games/invasores/engine"),
},
```

Tres botones, el mismo reparto de dos grupos que ASTEROIDES y ARKANOID: horizontales bajo
el pulgar izquierdo, disparo bajo el derecho. No hace falta tocar `.game-touch` ni
`.pad-key`.

### El sonido — WebAudio, sin ficheros

Siguiendo el precedente de `lib/games/vibora/engine.ts`: `AudioContext` perezoso, creado en
el primer sonido real, cerrado en `destroy()`, promesa de `resume()` recogida con `catch`
vacío, nada suena en pausa ni silenciado.

| Sonido               | Forma                                                               | Disparador                                                   |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Marcha (4 tonos)     | Onda cuadrada, frecuencias `[155, 138, 116, 98]` Hz, 80 ms cada una | Cada paso de la formación, avanzando `marchTone` en el ciclo |
| Disparo del jugador  | Onda cuadrada, 880 Hz, 40 ms                                        | `fire` con cupo libre                                        |
| Explosión de invasor | Diente de sierra, 300 → 80 Hz en 90 ms                              | Bala del jugador impacta un invasor vivo                     |
| Muerte del jugador   | Diente de sierra, 200 → 40 Hz en 500 ms                             | El cañón pierde una vida                                     |
| Aparición de OVNI    | Dos notas cuadradas, 660 → 990 → 660 Hz                             | Se genera el OVNI                                            |
| OVNI destruido       | Arpegio corto de tres notas ascendentes                             | Bala del jugador impacta el OVNI                             |

`setMuted(muted)` guarda la bandera y cierra el `AudioContext` en curso al silenciar, igual
que VÍBORA. `destroy()` lo cierra siempre.

### El dibujo

Todo con `fillRect`/matrices de subceldas y el neón del sitio, sin sprites externos:

- **Formación**: cada invasor vivo se dibuja con el fotograma en curso de su tipo, en
  verde para calamar y cangrejo, magenta para pulpo — o la paleta que salga del diseño con
  `/frontend-design` si se decide afinarla al implementar.
- **Cañón**: un triángulo/rectángulo simple en cian, con un parpadeo durante `INVULN_MS`.
- **Balas**: rectángulos finos, blancas las del jugador, ámbar las de los invasores.
- **Búnkeres**: cada subcelda ocupada es un cuadrado de 8 px en verde apagado; las
  destruidas no se dibujan.
- **OVNI**: su silueta de `sprites.ts`, en magenta, con estela.

**El lienzo no dibuja puntuación, ni vidas, ni nivel, ni ningún cartel.** Eso lo pinta la
plataforma, como en los otros cuatro motores.

---

## 4 — Plan de implementación

Empieza directamente en el motor: las Fases 2 (catálogo) y 3 (portada) de `/nuevo-juego`
ya están hechas y no forman parte de este plan. Cada paso deja la aplicación compilando y
navegable.

1. **Las formas.** `lib/games/invasores/sprites.ts` con las matrices de `squid`, `crab`,
   `octopus` —dos fotogramas cada una—, `UFO_SHAPE` y `BUNKER_SHAPE`. _Verificable:_
   `npx tsc --noEmit` pasa; nada cambia en pantalla porque todavía nadie lo importa.

2. **El motor base, sin búnkeres, sin OVNI, sin sonido.** `lib/games/invasores/engine.ts`
   con `createEngine`: formación con marcha a pasos, inversión de dirección y bajada de
   fila, disparo del jugador con el tope de uno en pantalla, disparo alienígena con su
   probabilidad y su tope de tres, colisión bala-invasor con puntuación por fila, colisión
   bala de invasor-cañón, vidas con pausa de muerte y reaparición invulnerable, línea de
   peligro con fin de partida instantáneo, y oleada siguiente al limpiar la formación.
   Registrar la entrada en `GAME_ENGINES` con `audio: false` de momento. _Verificable:_
   `/jugar/invasores` es jugable con teclado, la formación marcha y acelera al perder
   invasores, el HUD sube de puntos según la fila, perder tres vidas o dejar que la
   formación llegue a `DANGER_Y` abre el modal FIN DEL JUEGO, y limpiar la formación entera
   sube el `Nivel` del HUD y reinicia la formación arriba, más rápida.

3. **Los búnkeres.** Los cuatro `Bunker` con su copia mutable de `BUNKER_SHAPE`, la
   colisión de cualquier bala contra las subceldas por división entera de la posición, el
   apagado de la celda impactada más hasta cuatro vecinas al 50 % cada una, y la
   persistencia entre oleadas sin reparo. _Verificable:_ disparar contra un búnker le abre
   un cráter visible y detiene la bala; una bala de invasor hace lo mismo; el búnker sigue
   degradado al empezar la oleada 2.

4. **El OVNI.** El temporizador aleatorio entre `UFO_MIN_INTERVAL_MS` y
   `UFO_MAX_INTERVAL_MS`, su cruce a velocidad constante por `UFO_Y`, la colisión con el
   disparo del jugador y el sorteo de `UFO_POINTS`. _Verificable:_ el OVNI aparece
   periódicamente por el borde superior, cruza y desaparece si no se le da, y si se le da
   suma una de las cuatro puntuaciones y desaparece con su propio efecto.

5. **El táctil.** Los tres botones del registro y `setAction` para `left`/`right`/`fire`.
   _Verificable:_ en un viewport de 390 px con puntero grueso, los tres botones se ven
   enteros —dos a la izquierda, uno a la derecha— y mueven y disparan correctamente.

6. **El sonido.** El módulo de WebAudio, los seis eventos de la tabla del §3, `setMuted`,
   el `close()` en `destroy` y `audio: true` en el registro. _Verificable:_ la marcha
   suena y se acelera con la formación, disparar y las tres explosiones suenan distinto
   entre sí, el OVNI tiene su propio aviso de entrada y de muerte, el botón SONIDO lo calla
   todo en el acto, recargar encuentra la preferencia como se dejó, y la consola queda
   limpia.

**Antes de dar el motor por terminado**, jugar varias partidas completas hasta la oleada 4
o 5: si la marcha se siente lenta en la oleada 1 o injugable en la oleada 4, el sitio donde
se ajusta es `BASE_STEP_MS` y `WAVE_SPEED_FACTOR`, y el número que quede se escribe en el
spec de diseño, no solo en el código — mismo criterio que dejó VÍBORA en su §4.

---

## 5 — Criterios de aceptación

**Catálogo**

- [ ] `invasores` sigue en `public.games`/`FALLBACK_GAMES` con `sort_order = 50`,
      `cover = 'cover-invaders'`, `color = 'green'` y `cat = 'SHOOTER'`, sin ninguna
      diferencia respecto a antes de este spec.
- [ ] No hay ninguna migración nueva en `supabase/migrations/` a nombre de este spec.
- [ ] `/juego/invasores` abre y su botón JUGAR lleva a `/jugar/invasores`, que deja de
      mostrar la arena decorativa y pasa a montar el canvas.

**Estilos**

- [ ] `.cover-invaders` no tiene ninguna diferencia respecto a antes de este spec.
- [ ] La tarjeta de INVASORES se sigue viendo igual en la Biblioteca; ningún otro estilo
      del sitio cambia.

**El juego**

- [ ] En `/jugar/invasores` se ve la formación de 55 invasores, el cañón y los cuatro
      búnkeres dentro del marco CRT, sin barra de scroll horizontal en un viewport de
      1280 px ni en uno de 390 px.
- [ ] La formación marcha en bloque, invierte dirección y baja una fila al tocar
      cualquiera de los dos bordes del área de juego.
- [ ] La marcha se acelera perceptiblemente a medida que quedan menos invasores vivos.
- [ ] `←`/`→` mueven el cañón sin que se salga de los bordes del lienzo; `Espacio`/`fire`
      dispara solo si no hay ya un disparo del jugador en pantalla.
- [ ] Cada invasor vale los puntos de su fila: 30 la fila superior, 20 las dos centrales,
      10 las dos inferiores.
- [ ] Los invasores disparan hacia abajo, con un máximo de tres balas de invasor a la vez.
- [ ] Una bala de invasor que toca el cañón fuera de la ventana de invulnerabilidad
      descuenta una vida; el cañón parpadea, se pausa brevemente y reaparece en el centro,
      invulnerable un momento.
- [ ] Perder la tercera vida abre el modal FIN DEL JUEGO con la puntuación real.
- [ ] Si cualquier invasor llega a la línea de peligro, la partida termina en el acto, con
      independencia de las vidas que queden.
- [ ] Disparar contra un búnker apaga la subcelda impactada y algunas vecinas, y detiene la
      bala; lo mismo con una bala de invasor.
- [ ] Los búnkeres siguen degradados al empezar una oleada nueva: no se reparan.
- [ ] El OVNI aparece por el borde superior a intervalos, cruza a velocidad constante y
      desaparece sin efecto si no se le da.
- [ ] Alcanzar al OVNI con el disparo del jugador suma una de las cuatro puntuaciones de
      `UFO_POINTS` y lo hace desaparecer.
- [ ] Limpiar la formación entera sube el `Nivel` del HUD, reinicia una formación nueva
      arriba y la marcha empieza más rápida que en la oleada anterior.
- [ ] El lienzo **no** dibuja puntuación, ni vidas, ni nivel, ni ningún cartel de `PAUSA`,
      `GAME OVER` o cambio de oleada.

**El sonido**

- [ ] La marcha de cuatro tonos suena mientras la formación se mueve y se acelera con ella.
- [ ] Disparar, la explosión de un invasor y la muerte del cañón suenan distinto entre sí.
- [ ] El OVNI tiene un aviso de entrada y un efecto propio al ser destruido.
- [ ] El botón SONIDO aparece en `/jugar/invasores` y pasa a SILENCIO al pulsarlo, sin
      cortar la partida.
- [ ] Recargar la página encuentra la preferencia como se dejó — la misma clave
      `av_muted` que usan ARKANOID y VÍBORA.
- [ ] La consola no muestra ninguna promesa rechazada ni ningún aviso de `AudioContext`
      suspendido al abrir el juego antes de tocar nada.
- [ ] En pausa no suena nada.
- [ ] Entrar y salir del juego diez veces seguidas no acumula avisos de contextos de audio.

**Contrato**

- [ ] `lib/games/engine.ts`, `components/game-player.tsx` y
      `components/games/game-canvas.tsx` no tienen ni una línea de diferencia respecto a
      antes de este spec.
- [ ] El único cambio de `lib/games/registry.ts` es la entrada `invasores`.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.

**Integración con el reproductor**

- [ ] PAUSA congela el juego y muestra EN PAUSA; nada se mueve ni dispara mientras tanto;
      REANUDAR lo deja donde estaba.
- [ ] `P` y `Escape` alternan la pausa, y cambiar de pestaña y volver encuentra el juego
      pausado.
- [ ] Pulsar las flechas o `Espacio` mientras se juega no desplaza la página.
- [ ] Escribir en el campo de iniciales del modal no mueve el cañón.
- [ ] JUGAR DE NUEVO reinicia desde cero: puntuación 0, tres vidas, oleada 1, formación
      completa y los cuatro búnkeres intactos.
- [ ] El botón FIN termina la partida con la puntuación acumulada.
- [ ] SALIR navega a `/juego/invasores` y no queda ningún fotograma programado ni ningún
      `AudioContext` abierto.
- [ ] En `npm run dev`, con el doble montaje de Strict Mode, la formación no marcha al
      doble de velocidad ni la marcha suena dos veces.
- [ ] La leyenda de controles dice «Mover el cañón» y «Disparar». En ninguna pantalla
      aparece «Propulsar», «Rotar» ni «Soltar» jugando a INVASORES.
- [ ] Los tres botones táctiles se ven enteros en un viewport de 390 px, sin desbordar ni
      solapar.
- [ ] `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` y `/jugar/vibora` se juegan
      exactamente igual que antes de este spec.

**Marcador**

- [ ] Con sesión de cuenta, terminar una partida y guardar inserta una fila en
      `public.scores` con `game_id = 'invasores'` y el `user_id` de la sesión.
- [ ] El modal muestra `PUESTO #NN DE MM` y anuncia récord personal solo si se superó la
      marca anterior.
- [ ] `/salon?juego=invasores` muestra esa marca, y `Mejor global` y `Partidas` del
      Detalle dejan de estar a 0.
- [ ] Con sesión de invitado no se inserta ninguna fila y la marca aparece en TUS PARTIDAS
      EN ESTE NAVEGADOR.
- [ ] Sin las variables `NEXT_PUBLIC_SUPABASE_*`, `npm run build` pasa, `/jugar/invasores`
      es jugable y solo falla el guardado, con mensaje visible.
