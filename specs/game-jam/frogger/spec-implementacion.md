# SPEC (GAME JAM) — FROGGER: implementación

> Compañero: spec-diseno.md, en esta misma carpeta

---

## 3 — Modelo de datos

### La fila del catálogo

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('frogger', 'FROGGER',
   'Esquiva el tráfico y no te ahogues en el río.',
   'Guía a tu rana a través de cinco carriles de tráfico y seis de río en una cuadrícula de neón. Salta sobre troncos y tortugas —cuidado, se sumergen— y ocupa las cinco bocas de meta antes de que se acabe el tiempo. Cada ronda acelera el tráfico y acorta el reloj. Tres vidas, cero margen de error.',
   'ARCADE', 'cover-frogger', 'magenta', 130);
```

`sort_order` 130 es el siguiente múltiplo de diez libre **a fecha de este spec** (el
último ocupado es 120, `vibora`). Es una nota, no un hecho fijo: si este spec espera meses
antes de implementarse y el catálogo crece mientras tanto, hay que recalcular el valor
contra `lib/games.ts` en el momento de construirlo, no dar por bueno el 130 a ciegas.

`cat = 'ARCADE'` y `color = 'magenta'` ya admiten los `check` del SPEC 06: no hace falta
tocar ninguna restricción.

La misma entrada, carácter a carácter, va en `FALLBACK_GAMES` (`lib/games.ts`):

```ts
{
  id: "frogger",
  title: "FROGGER",
  short: "Esquiva el tráfico y no te ahogues en el río.",
  long: "Guía a tu rana a través de cinco carriles de tráfico y seis de río en una cuadrícula de neón. Salta sobre troncos y tortugas —cuidado, se sumergen— y ocupa las cinco bocas de meta antes de que se acabe el tiempo. Cada ronda acelera el tráfico y acorta el reloj. Tres vidas, cero margen de error.",
  cat: "ARCADE",
  cover: "cover-frogger",
  color: "magenta",
  sortOrder: 130,
},
```

**No hay ningún otro cambio de esquema.** El marcador está indexado por `game_id` desde el
SPEC 06 y funciona en cuanto existe la fila. `lib/database.types.ts` no se regenera —
insertar filas no cambia el esquema. `MAX_SCORE` no se toca: el §7 de `spec-diseno.md`
acota la puntuación máxima verosímil muy por debajo del tope de 10.000.000.

### La rejilla y las constantes — `lib/games/frogger/engine.ts`

| Constante                                   | Valor         | De dónde sale                                                          |
| ------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| Lienzo                                      | 800 × 600     | Fijo para todos los motores desde la SPEC 05                           |
| `CELL`                                      | 40 px         | 20 × 15 = 300 celdas, sin margen muerto en el lienzo 800×600           |
| `COLS` / `ROWS`                             | 20 / 15       | El tablero ocupa el lienzo entero                                      |
| `ROW_GOALS`                                 | 0             | Fila de metas, arriba del todo                                         |
| `ROW_RIVER_TOP` / `ROW_RIVER_BOT`           | 1 / 6         | Seis carriles de río                                                   |
| `ROW_SAFE_MID`                              | 7             | Fila segura entre río y carretera                                      |
| `ROW_ROAD_TOP` / `ROW_ROAD_BOT`             | 8 / 12        | Cinco carriles de carretera                                            |
| `ROW_START_TOP` / `ROW_START_BOT`           | 13 / 14       | Dos filas de inicio, abajo del todo                                    |
| `START_COL`                                 | 9             | Columna central de partida y de reaparición (20 columnas, índice 0-19) |
| `GOAL_COUNT` / `GOAL_WIDTH`                 | 5 / 4         | 20 columnas ÷ 5 metas = 4 columnas cada una, sin resto                 |
| `JUMP_MS`                                   | 120 ms        | Duración de la animación de salto de la rana; heredado del spec legado |
| `LIVES`                                     | 3             | Como ARKANOID y VÍBORA                                                 |
| `ROUND_TIME_S`                              | 20 s          | Temporizador de la ronda 1                                             |
| `TIME_STEP_S` / `TIME_MIN_S`                | 1 s / 10 s    | El tiempo de ronda baja 1 s por nivel, con suelo en 10 s               |
| `POINTS_ADVANCE`                            | 10 pts        | Por cada fila nueva avanzada por primera vez en la ronda               |
| `POINTS_GOAL`                               | 50 pts        | Por ocupar una meta                                                    |
| `POINTS_ROUND`                              | 200 pts       | Por completar las cinco metas                                          |
| `TIME_BONUS_PER_SEC`                        | 10 pts        | Multiplicado por el tiempo restante, al ocupar una meta                |
| `SPEED_FACTOR`                              | 1.15          | +15 % de velocidad de entidades por nivel                              |
| `ROAD_SPEED_MIN` / `ROAD_SPEED_MAX`         | 90 / 220 px/s | Rango base de velocidad de carriles de carretera, antes de escalar     |
| `RIVER_SPEED_MIN` / `RIVER_SPEED_MAX`       | 60 / 180 px/s | Rango base de velocidad de carriles de río, antes de escalar           |
| `TURTLE_VISIBLE_MS` / `TURTLE_SUBMERGED_MS` | 3000 / 1500   | Ciclo de inmersión de las tortugas                                     |

El tiempo de ronda del nivel `n` es `max(TIME_MIN_S, ROUND_TIME_S - TIME_STEP_S * (n - 1))`.
La velocidad de cada carril del nivel `n` es su velocidad base multiplicada por
`SPEED_FACTOR ** (n - 1)`, sin suelo ni techo explícitos — a diferencia de VÍBORA, aquí la
velocidad no puede volverse ilegible por fotograma porque las entidades siguen midiendo
varias celdas de ancho; si el paso 4 de calibrado descubre lo contrario, el número que
corrija esto se escribe en este spec, no solo en el código.

### El estado, todo dentro de `createEngine`

```ts
type Dir = "up" | "down" | "left" | "right";
type EntityKind = "car" | "truck" | "log" | "turtle";

type Lane = {
  row: number;
  speed: number; // px/s, con signo: positivo = derecha, negativo = izquierda
  entities: Entity[];
};

type Entity = {
  col: number; // coordenada continua, no entera — ver spec-diseno §7
  widthCells: number;
  kind: EntityKind;
  // Solo para "turtle": fase del ciclo de inmersión.
  submerged?: boolean;
  cyclePhaseMs?: number;
};

type Frog = {
  col: number; // entero salvo mientras onRaft
  row: number; // siempre entero
  jumping: boolean;
  jumpT: number; // 0..JUMP_MS
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  onRaft: boolean; // true en filas de río, sobre un tronco o tortuga visible
};

// Nada de esto es un global de módulo — mismo riesgo que anotaron
// las SPEC 08/09/10, y misma mitigación: todo vive dentro de createEngine.
let lanes: Lane[];
let goalsFilled: boolean[]; // longitud GOAL_COUNT
let frog: Frog;
let score: number;
let lives: number;
let level: number; // = número de ronda en curso
let roundTimeLeft: number; // segundos
let maxRowReached: number; // para POINTS_ADVANCE, se reinicia cada ronda
let status: GameStatus;
let dead: boolean; // parpadeo tras morir; no sale en el snapshot, igual que en VÍBORA
```

### El snapshot

```ts
{
  (score, lives, level);
}
status;
```

`level` es el número de ronda en curso, empezando en 1. `onSnapshot` solo se llama cuando
alguno de los cuatro campos cambia de verdad, igual que en los otros tres motores nativos.

### El paso de la rana — salto discreto

1. Si la rana no está saltando: leer la última dirección pulsada (`pendingDir`, sin cola —
   a diferencia de VÍBORA, aquí cada pulsación es un salto puntual, no un rumbo continuo, y
   una pulsación mientras se está saltando se ignora, no se encola). Si hay dirección
   pendiente y el destino no se sale de los bordes laterales (`0 <= toCol < COLS`), arrancar
   el salto: `jumping = true`, `jumpT = 0`, `fromCol/fromRow` = posición actual,
   `toCol/toRow` = posición destino.
2. Si la rana está saltando: `jumpT += dt * 1000`; la posición dibujada se interpola entre
   `from` y `to` solo para el dibujo — la posición lógica (`frog.col`, `frog.row`) salta de
   golpe al valor final en cuanto `jumpT >= JUMP_MS`. Al completar: `jumping = false`,
   resolver la celda de destino (colisión con vehículo, soporte en el río, meta, o avance
   simple), y actualizar `maxRowReached` y la puntuación por avance si la fila es nueva.
3. Si la rana está en una fila de río y no saltando: buscar la entidad que la soporta
   (`getSupport`). Si hay soporte y es visible, `frog.onRaft = true` y `frog.col` avanza en
   coordenada continua a la velocidad del carril (`frog.col += lane.speed * dt`). Si no hay
   soporte, o la tortuga que la soportaba se sumergió, `killFrog()`.
4. Si `frog.onRaft` y `frog.col` sale de `[0, COLS)`: `killFrog()` — salir por los bordes
   del río mata, aunque el vehículo lógico siga vivo fuera de pantalla.

### Las entidades de carril

`update(dt)` avanza cada entidad de cada carril: `entity.col += lane.speed * dt`; al salir
del lienzo por un borde, se reintroduce por el opuesto
(`col = -entity.widthCells` o `col = COLS`). Las tortugas alternan `submerged` según
`cyclePhaseMs`, acumulado igual que cualquier otro contador de este motor: nada de
`setInterval` ni `setTimeout`.

`buildLanes(level)` genera los once carriles (cinco de carretera, seis de río) con huecos
navegables entre entidades — la verificación del paso 3 del plan es literalmente imprimir
el array y confirmar que cada carril tiene al menos un hueco atravesable.

### Colisión, soporte y meta

- `checkRoadCollision(frog, lanes)`: alguna entidad de un carril de carretera cuyo rango
  `[entity.col, entity.col + entity.widthCells)` cubre `frog.col`, en la fila de la rana.
- `getSupport(frog, lanes)`: la entidad de un carril de río cuyo rango cubre `frog.col`, en
  la fila de la rana, o `null`. Una tortuga con `submerged === true` no cuenta como soporte.
- `checkGoal(frog)`: si `frog.row === ROW_GOALS`, la meta que corresponde a `frog.col` es
  `floor(frog.col / GOAL_WIDTH)`. Si `goalsFilled[esa meta]` es `false`, se marca, se suman
  `POINTS_GOAL + roundTimeLeft * TIME_BONUS_PER_SEC`, y si las cinco quedan `true` se llama
  `completeRound()`. Si ya estaba ocupada, o `frog.col` cae en el hueco entre dos bocas
  (decisión de diseño: los huecos entre metas son tan letales como el agua), es muerte.

### Ronda completada y muerte

`completeRound()`: `level++`, `goalsFilled` a `false` en las cinco, `maxRowReached` a 0,
`roundTimeLeft` al valor del nivel nuevo, `lanes = buildLanes(level)`, rana de vuelta a
`(START_COL, ROW_START_BOT)`.

`killFrog()`: suena el choque/splash, `lives--`, `dead = true` con un parpadeo breve (mismo
patrón que el `DEATH_MS` de VÍBORA). Si `lives === 0`: `onGameOver(score)`, `status` pasa a
`"gameover"`. Si quedan vidas: rana de vuelta a `(START_COL, ROW_START_BOT)`, `dead = false`,
y **el temporizador de ronda se reinicia a `roundTimeForLevel(level)`**. Es una corrección
sobre el diseño original del spec (que decía «morir no regala tiempo, el reloj no se
reinicia al perder una vida»): si la propia causa de la muerte es agotar el reloj, dejarlo en
0 dispara la misma muerte en el primer fotograma tras reaparecer, encadenando las tres vidas
en unos tres segundos sin que el jugador pueda hacer nada — un bucle descubierto jugando en
el paso 4 de implementación, no una decisión de diseño. Cada vida es, en la práctica, su
propio intento cronometrado, como en el Frogger original.

### Los controles declarados — la entrada de `GAME_ENGINES`

```ts
frogger: {
  width: 800,
  height: 600,
  keys: [{ keys: ["◄", "▲", "►", "▼"], label: "Saltar" }],
  touch: [
    [
      { action: "left", glyph: "◄", label: "Saltar a la izquierda", tone: "cyan" },
      { action: "right", glyph: "►", label: "Saltar a la derecha", tone: "cyan" },
    ],
    [
      { action: "thrust", glyph: "▲", label: "Saltar arriba", tone: "yellow" },
      { action: "down", glyph: "▼", label: "Saltar abajo", tone: "yellow" },
    ],
  ],
  audio: true,
  load: () => import("@/lib/games/frogger/engine"),
},
```

Mismo reparto que VÍBORA: horizontales bajo el pulgar izquierdo, verticales bajo el
derecho — así que `.game-touch` y `.pad-key` no se tocan. La etiqueta de la leyenda dice
«Saltar», no «Mover»: en Frogger cada pulsación es un salto puntual, no un rumbo que se
mantiene, y la palabra importa para que el jugador no espere el movimiento continuo de
VÍBORA.

### El sonido — WebAudio, sin ficheros

| Sonido           | Forma                                                        |
| ---------------- | ------------------------------------------------------------ |
| Salto            | Onda cuadrada corta, 520 Hz, 40 ms                           |
| Splash / choque  | Diente de sierra, 220 → 50 Hz en 250 ms                      |
| Meta ocupada     | Dos notas cuadradas, 660 → 990 Hz, 80 ms cada una            |
| Ronda completada | Tres notas ascendentes, 660 → 880 → 1320 Hz, 100 ms cada una |

Mismas tres reglas que SPEC 09/10: no suena nada si el motor está silenciado, pausado o
destruido; la promesa de `resume()` se recoge con un `catch` vacío; `destroy()` cierra el
`AudioContext`. `setMuted(muted)` sigue el mismo contrato que en VÍBORA.

---

## 4 — Plan de implementación

Cada paso deja la aplicación compilando y navegable.

1. **La ficha.** Migración `add_game_frogger` con el `insert` del §3, aplicada por MCP **y**
   versionada en `supabase/migrations/`. La misma entrada, carácter a carácter, en
   `FALLBACK_GAMES` de `lib/games.ts`. _Verificable:_ `/juego/frogger` abre con su Detalle,
   la tarjeta sale en la Biblioteca todavía sin portada propia, `/salon` tiene su pestaña, y
   `Mejor global` y `Partidas` están a 0. `ranaria` sigue exactamente igual que antes.

2. **La portada.** `.cover-frogger` en `app/globals.css`, con gradientes puros, diseñada
   con `/frontend-design` y verificada con `npm run dev` abierto. _Verificable:_ la tarjeta
   de FROGGER tiene portada propia, se distingue de `.cover-rana` (RANARIA) a tamaño de
   tarjeta sin leer el título, y el resto del sitio sigue con sus estilos.

3. **El motor, mudo y sin vidas.** `lib/games/frogger/engine.ts` con `createEngine`:
   rejilla, salto discreto de la rana con animación, `buildLanes`, colisión de carretera,
   soporte de río sin ciclo de inmersión todavía, metas, avance y puntuación, dibujo
   completo de las tres zonas. De momento la partida acaba al primer choque, y
   `audio: false` / `setSkin` vacío en el registro. _Verificable:_ `/jugar/frogger` es
   jugable con las flechas, la rana salta celda a celda con la animación de 120 ms, no
   puede salir por los bordes laterales, los vehículos y troncos se mueven en loop, y
   chocar o caer al agua abre el modal FIN DEL JUEGO.

4. **Tortugas, vidas, temporizador y calibrado.** El ciclo de inmersión de las tortugas,
   las tres vidas con reaparición sin perder el tiempo de ronda, el temporizador visible
   con muerte al agotarse, las cinco metas con `completeRound()` y el avance de nivel.
   **Jugar varias rondas completas de principio a fin** y confirmar que la ronda 1 se
   piensa y la ronda 4 aprieta de verdad; si no, el sitio donde se ajusta es
   `ROAD_SPEED_*`, `RIVER_SPEED_*` y `SPEED_FACTOR`, y el número que quede se escribe en
   este spec. _Verificable:_ las tortugas alternan visible/sumergida con el ciclo definido,
   morir con vidas de sobra no acaba la partida, llenar las cinco metas sube el `Nivel` del
   HUD y acelera todo, y agotar el reloj de ronda mata igual que un vehículo.

5. **El táctil.** Los cuatro botones del registro y el salto puntual desde `setAction`
   (una pulsación, un salto — mantener pulsado no debe repetir el salto solo). _Verificable:_
   en un viewport de 390 px con puntero grueso, los cuatro botones se ven enteros —dos a
   cada lado— y la rana salta con ellos.

6. **El sonido.** El módulo de WebAudio, los cuatro avisos, `setMuted`, el `close()` en
   `destroy` y `audio: true` en el registro. _Verificable:_ FROGGER suena al saltar, al
   chocar/ahogarse, al ocupar una meta y al completar una ronda; el botón SONIDO lo calla
   en el acto; recargar encuentra la preferencia como se dejó; la consola queda limpia.

7. **Verificación final.** `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
   Comprobar con el doble montaje de Strict Mode de `npm run dev` que no hay dos bucles ni
   sonido duplicado. _Verificable:_ ninguna ruta existente devuelve 500, y `/jugar/ranaria`
   se sigue viendo exactamente igual que antes de este spec.

---

## 5 — Criterios de aceptación

**Catálogo**

- [ ] `public.games` tiene una fila `frogger`, con `sort_order` 130 (o el valor
      recalculado si el catálogo creció antes de implementar esto), `cover = 'cover-frogger'`
      y `color = 'magenta'`.
- [ ] La migración está versionada en `supabase/migrations/` además de aplicada, y
      `get_advisors` de seguridad no reporta ningún aviso nuevo.
- [ ] `FALLBACK_GAMES` tiene la misma entrada, con `id`, `title`, `short`, `long`, `cat`,
      `cover` y `color` idénticos carácter a carácter a los de la migración.
- [ ] La tarjeta de FROGGER aparece en la Biblioteca, el buscador la encuentra y el filtro
      ARCADE la muestra.
- [ ] `/juego/frogger` abre y su botón JUGAR lleva a `/jugar/frogger`.
- [ ] `ranaria` sigue en el catálogo sin cambios, con su portada `cover-rana`, y
      `/jugar/ranaria` sigue mostrando la arena decorativa y la puntuación simulada.

**Estilos**

- [ ] Con `npm run dev` corriendo, la Landing, la Biblioteca, el Detalle y el reproductor
      se ven **exactamente igual** que antes de este spec salvo por la tarjeta nueva.
- [ ] La portada de FROGGER se distingue de la de RANARIA a tamaño de tarjeta, sin leer el
      título.
- [ ] `.cover-frogger` usa solo gradientes: ni `url()`, ni SVG embebido, ni imágenes.
- [ ] `npm run build` pasa, y la hoja de estilos que sirve `npm run dev` contiene las
      reglas de las demás portadas.

**El juego**

- [ ] En `/jugar/frogger` se ve la rejilla de 20 × 15 dentro del marco CRT, sin barra de
      scroll horizontal en un viewport de 1280 px ni en uno de 390 px.
- [ ] La partida empieza con la rana en la fila de inicio, columna central, quieta.
- [ ] Las cuatro flechas hacen saltar a la rana exactamente una celda en esa dirección, con
      la animación de 120 ms; una pulsación mientras salta se ignora, no se encola.
- [ ] La rana no puede saltar fuera de los bordes laterales del tablero.
- [ ] Coches y camiones se mueven horizontalmente en loop por sus carriles, con velocidad y
      sentido propios por carril, y se reintroducen por el lado opuesto al salir.
- [ ] Troncos y tortugas se mueven horizontalmente en loop por sus carriles del río.
- [ ] Sobre un tronco o una tortuga visible, la rana viaja con la velocidad del carril sin
      que el jugador toque nada.
- [ ] Las tortugas alternan entre visible y sumergida con el ciclo definido; sumergida, no
      sostiene a la rana.
- [ ] La rana muere al ser alcanzada por un vehículo.
- [ ] La rana muere al caer al agua (fila de río sin tronco ni tortuga visible debajo).
- [ ] La rana muere si la tortuga que la sostiene se sumerge mientras está encima.
- [ ] La rana muere si, viajando sobre un tronco o tortuga, sale de los bordes laterales.
- [ ] La rana muere al agotar el temporizador de la ronda.
- [ ] Al llegar a una meta libre, la meta queda marcada y se suma
      `POINTS_GOAL + tiempo_restante × TIME_BONUS_PER_SEC`.
- [ ] Al llegar a una meta ya ocupada, o al hueco entre dos metas, la rana muere.
- [ ] Al completar las cinco metas, la ronda termina, `Nivel` sube en el HUD, y las
      velocidades y el temporizador de la ronda siguiente reflejan el nuevo nivel.
- [ ] Perder una vida reaparece a la rana en la fila de inicio **con el temporizador de la
      ronda reiniciado** a su valor pleno para el nivel en curso — cada vida es su propio
      intento cronometrado, para que agotar el reloj una vez no encadene las tres vidas.
- [ ] `onScoreChange` (vía snapshot) refleja cada cambio de puntuación en tiempo real.
- [ ] El lienzo **no** dibuja puntuación, ni vidas, ni nivel, ni ningún cartel.

**El sonido**

- [ ] Saltar, chocar/ahogarse, ocupar una meta y completar una ronda suenan, y los cuatro
      son distinguibles entre sí.
- [ ] El botón SONIDO aparece en `/jugar/frogger` y **no** aparece en `/jugar/asteroides`
      ni en `/jugar/tetris`.
- [ ] Pulsarlo pasa a SILENCIO y el juego deja de sonar en el acto, sin cortar la partida.
- [ ] Recargar la página encuentra la preferencia como se dejó — es la misma clave
      `av_muted` que usan ARKANOID y VÍBORA.
- [ ] La consola no muestra ninguna promesa rechazada ni ningún aviso de `AudioContext`
      suspendido al abrir el juego antes de tocar nada.
- [ ] Entrar y salir del juego diez veces seguidas no acumula avisos de contextos de audio
      en la consola.

**Contrato**

- [ ] `lib/games/engine.ts`, `components/game-player.tsx` y
      `components/games/game-canvas.tsx` **no tienen ni una línea de diferencia** respecto
      a antes de este spec.
- [ ] El único cambio de `lib/games/registry.ts` es la entrada `frogger`.
- [ ] `setSkin` está implementado (aunque sea vacío) — el motor no lanza si el reproductor
      lo invoca.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.

**Integración con el reproductor**

- [ ] PAUSA congela el juego y muestra EN PAUSA; ninguna entidad avanza; REANUDAR continúa
      donde estaba, sin saltos de golpe.
- [ ] `P` y `Escape` alternan la pausa, y cambiar de pestaña y volver encuentra el juego
      pausado.
- [ ] Pulsar las flechas mientras se juega no desplaza la página.
- [ ] JUGAR DE NUEVO reinicia desde cero: puntuación 0, tres vidas, nivel 1, rana en el
      centro de la fila de inicio.
- [ ] El botón FIN termina la partida con la puntuación acumulada.
- [ ] SALIR navega a `/juego/frogger` y no queda ningún fotograma programado ni ningún
      `AudioContext` abierto.
- [ ] En `npm run dev`, con el doble montaje de Strict Mode, no hay dos bucles ni sonido
      duplicado.
- [ ] La leyenda de controles dice «Saltar» con las cuatro flechas, y «Pausa». No aparece
      «Mover», «Propulsar», «Disparar», «Rotar» ni «Mover la paleta» jugando a FROGGER.
- [ ] Los cuatro botones táctiles se ven enteros en un viewport de 390 px, dos a cada lado,
      sin desbordar ni solapar.
- [ ] `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` y `/jugar/vibora` se juegan
      exactamente igual que antes de este spec.

**Marcador**

- [ ] Con sesión de cuenta, terminar una partida y guardar inserta una fila en
      `public.scores` con `game_id = 'frogger'` y el `user_id` de la sesión.
- [ ] El modal muestra `PUESTO #NN DE MM` y anuncia récord personal solo si se superó la
      marca anterior.
- [ ] `/salon?juego=frogger` muestra esa marca, y `Mejor global` y `Partidas` del Detalle
      dejan de estar a 0.
- [ ] Con sesión de invitado no se inserta ninguna fila y la marca aparece en TUS PARTIDAS
      EN ESTE NAVEGADOR.
- [ ] Sin las variables `NEXT_PUBLIC_SUPABASE_*`, `npm run build` pasa, `/jugar/frogger` es
      jugable, la Biblioteca muestra el catálogo del respaldo y solo falla el guardado, con
      mensaje visible.

---
