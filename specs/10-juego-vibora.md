# SPEC 10 — VÍBORA: el cuarto juego, y el primero escrito desde cero

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 09
> **Fecha:** 2026-08-24
> **Objetivo:** Escribir un Snake de rejilla como motor TypeScript nativo de la plataforma, con su ficha en el catálogo, su portada, cuatro direcciones absolutas con cola de giros y sonido sintetizado con WebAudio, sin ningún fichero binario nuevo.

---

## 1 — Por qué existe este spec

Las SPEC 05, 08 y 09 fueron ports. Había un `game.js` probado en `references/started-games/`, con sus constantes calibradas por alguien que ya había jugado a eso, y el trabajo consistía en traducir sin tocar un número. La frase «se porta el juego, no se moderniza» aparece en los tres.

**Aquí no hay original.** No existe `references/started-games/05-snake/`. Cada número de este documento es una decisión, no una copia, y por eso el §6 es más largo que el de la SPEC 09: cuando no hay un original al que apelar, lo único que queda es haber escrito por qué.

Eso cambia el reparto del riesgo. Un port falla al traducir; esto falla al calibrar. Una serpiente demasiado lenta aburre, una demasiado rápida es injugable, y ninguna de las dos cosas se descubre leyendo el diff. El paso 4 del plan de implementación termina obligando a **jugar tres partidas completas** antes de dar el motor por bueno, y hay criterios de aceptación con cronómetro.

Lo que **no** cambia: el contrato de la plataforma. `GameEngine`, `GameEngineEntry`, el HUD de tres casillas, la pausa del anfitrión, el modal de fin de partida y el interruptor de sonido de la SPEC 09 se usan tal como están. **Este spec no toca ni una línea de `lib/games/engine.ts`, `components/game-player.tsx`, `components/games/game-canvas.tsx` ni `lib/preferences.ts`, y de `lib/games/registry.ts` solo su entrada nueva.** Si al implementarlo aparece la tentación de tocar uno de esos ficheros, es señal de que algo se ha entendido mal: el contrato lleva tres juegos aguantando y este es el primero diseñado sabiendo que existía.

---

## 2 — Alcance

**Dentro:**

- **Ficha nueva `vibora`** en `public.games` y en `FALLBACK_GAMES`, categoría ARCADE, color verde, `sort_order` 120.
- **Portada `.cover-vibora`** en `app/globals.css`, con gradientes puros, diseñada con `/frontend-design`.
- **Motor nuevo** en `lib/games/vibora/engine.ts`: rejilla de 40 × 30 celdas de 20 px sobre el lienzo de 800 × 600 de siempre.
- **Muro mortal.** Tocar cualquiera de los cuatro bordes cuesta una vida. Sin envoltura.
- **Tres vidas.** Chocar deja la serpiente muerta 1 s a la vista y la reaparece corta en el centro, parada.
- **Nivel por comidas.** Sube cada 5 bocados, acelera un 12 % por nivel y multiplica lo que vale cada bocado.
- **Cuatro direcciones absolutas** con `←` `↑` `→` `↓`, sin giro de 180°, con **cola de dos giros**.
- **Botonera táctil de cuatro botones** reusando las acciones `left`, `right`, `thrust` y `down` que ya existen.
- **Sonido sintetizado con WebAudio**: bocado, subida de nivel y choque. Sin ficheros. `audio: true` y `setMuted` de verdad.
- **Fin de partida** al perder la tercera vida **o** al llenar el tablero.

**Fuera de alcance (para specs futuras):**

- **Ponerle motor a SERPENTINA.** Se queda con su maqueta y su puntuación simulada, igual que ROCAS, CAÍDA y BLOQUE BUSTER.
- **Fruta bonus, obstáculos, muros interiores, niveles con forma.** El tablero es un rectángulo vacío en la partida 1 y en la 100.
- **Envoltura por los bordes**, ni fija ni desbloqueable por nivel.
- **Modo a dos jugadores**, que es la otra mitad del Snake de recreativa y es un spec entero.
- **Música de fondo, volumen graduable o mezclador.** El interruptor sigue siendo binario, como lo dejó la SPEC 09.
- **Tocar el contrato de la plataforma.** Ni una acción nueva en `GameAction`, ni un campo nuevo en `GameSnapshot`, ni un botón nuevo en el HUD.
- **Carteles en el lienzo.** Ni `PAUSA`, ni `GAME OVER`, ni «Nivel 3». Los pinta React, como en los otros tres motores.
- **Guardar la partida a medias.** Cerrar la pestaña pierde la serpiente.
- **Anti-trampas.** Sin cambios respecto a las SPEC 05, 08 y 09.
- **Banco de pruebas.** La infraestructura de `scripts/` está y se puede reutilizar; aquí no se escribe ninguna. El §6 explica por qué, y el §7 anota lo que eso cuesta.
- **Sonido en ASTEROIDES y TETRIS.** Siguen mudos, con su `audio: false` y su `setMuted` vacío.

---

## 3 — Modelo de datos

### La fila del catálogo

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('vibora', 'VÍBORA', …, 'ARCADE', 'cover-vibora', 'green', 120);
```

`sort_order` 120 es el siguiente múltiplo de diez libre. `cat = 'ARCADE'` y `color = 'green'` son valores que ya admiten los `check` del SPEC 06: **no hace falta tocar ninguna restricción**.

Textos, que se copian carácter a carácter en la migración y en `FALLBACK_GAMES`:

- **`short`:** «Crece con cada bocado hasta que ya no cabes.»
- **`long`:** «Una víbora de luz recorre una rejilla de cuarenta por treinta buscando comida. Cada bocado la alarga un segmento y cada cinco suben el nivel, la velocidad y lo que vale el siguiente. Las cuatro paredes matan, tu propia cola también, y tienes tres vidas.»

**No hay ningún otro cambio de esquema.** El marcador está indexado por `game_id` desde el SPEC 06 y funciona en cuanto existe la fila. `lib/database.types.ts` no se regenera, porque insertar filas no cambia el esquema. `MAX_SCORE` no se toca: el §7 acota la puntuación máxima verosímil muy por debajo del tope de 10.000.000.

### La rejilla y las constantes — `lib/games/vibora/engine.ts`

| Constante          | Valor     | De dónde sale                                                                |
| ------------------ | --------- | ---------------------------------------------------------------------------- |
| Lienzo             | 800 × 600 | Fijo para todos los motores desde la SPEC 05                                 |
| `CELL`             | 20 px     | 40 × 30 = 1.200 celdas                                                       |
| `COLS` / `ROWS`    | 40 / 30   | El tablero ocupa el lienzo entero, sin margen muerto                         |
| `BASE_STEP_MS`     | 125 ms    | 8 pasos/s en el nivel 1                                                      |
| `SPEED_FACTOR`     | 1.12      | +12 % de ritmo por nivel                                                     |
| `MIN_STEP_MS`      | 50 ms     | Suelo de velocidad: 20 pasos/s, que se alcanza en el nivel 10                |
| `FOOD_PER_LEVEL`   | 5         | Nivel = `floor(comidas / 5) + 1`                                             |
| `POINTS_PER_FOOD`  | 10        | Se multiplica por el nivel del momento del bocado                            |
| `START_LENGTH`     | 3         | Al empezar y al reaparecer                                                   |
| `LIVES`            | 3         | Como ARKANOID                                                                |
| `DEATH_MS`         | 1000 ms   | Lo que la serpiente muerta se queda a la vista, parpadeando                  |
| `MAX_QUEUED_TURNS` | 2         | Cabe la esquina cerrada en un gesto; no cabe el suicidio por dos pulsaciones |

El intervalo de paso del nivel `n` es `max(MIN_STEP_MS, BASE_STEP_MS / SPEED_FACTOR ** (n - 1))`. Nivel 1: 125 ms. Nivel 5: 79 ms. Nivel 10: 50 ms, y **de ahí no baja**: a partir del nivel 10 el nivel solo multiplica puntos. Es deliberado y está justificado en el §6.

### El estado, todo dentro de `createEngine`

```ts
type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };

// Nada de esto es un global de módulo. Ver el §7.
let snake: Cell[]; // [0] es la cabeza
let dir: Dir; // dirección en curso
let queued: Dir[]; // cola de giros, máximo MAX_QUEUED_TURNS
let food: Cell;
let score: number;
let lives: number;
let eaten: number; // bocados de toda la partida, no de la vida
let status: GameStatus; // "playing" | "paused" | "gameover"
let dead: boolean; // muerta y esperando reaparecer; NO sale en el snapshot
let waiting: boolean; // reaparecida y quieta hasta la primera flecha
```

`eaten` cuenta los bocados de **toda la partida** y no los de la vida actual: perder una vida no devuelve la velocidad ganada. `dead` no viaja en el snapshot, por el mismo motivo que en ASTEROIDES: de puertas afuera el jugador sigue jugando y el HUD no debe parpadear por eso — es exactamente el caso que documenta el comentario de `GameStatus` en `lib/games/engine.ts`.

### El snapshot

```ts
{
  (score, lives, level, status);
}
```

Sin traducciones. `level` es `floor(eaten / 5) + 1` y `lives` son las tres vidas. `onSnapshot` solo se llama cuando alguno de los cuatro cambia de verdad.

### El paso de la serpiente

El bucle es de **paso fijo con acumulador**, no de posición interpolada: la serpiente salta de celda en celda, que es lo que hace que Snake sea Snake.

1. `dt` capado a 0,05 s, se suma al acumulador.
2. Mientras el acumulador supere el intervalo del nivel: se descuenta y se da **un** paso.
3. Un paso: sacar el primer giro de `queued` si lo hay y aplicarlo a `dir`; calcular la celda de la cabeza; comprobar colisión; avanzar.

La colisión es contra el borde (`x < 0 || x >= COLS || y < 0 || y >= ROWS`) y contra el cuerpo. **Contra el cuerpo sin contar la cola**, porque la cola se va en el mismo paso en que la cabeza llega: perseguir tu propia cola pegado a ella es legal y es la maniobra que salva una partida apurada.

Si la cabeza cae sobre la comida: `eaten++`, `score += POINTS_PER_FOOD * nivel` calculado **antes** de recolocar la comida, la cola no se recorta ese paso —así crece un segmento— y se busca comida nueva.

### La comida

Se coloca en una celda libre al azar. La búsqueda es sobre la **lista de celdas libres**, no un `while (ocupada) reintentar`: con la serpiente ocupando 1.100 de las 1.200 celdas, el reintento al azar es una espera indefinida dentro del bucle de dibujo. Construir el array de libres son 1.200 iteraciones una vez por bocado, que es nada.

Si no hay ninguna celda libre, **la partida termina** con la puntuación acumulada: es la victoria, y se trata igual que perder la última vida.

### Perder una vida

1. Suena el choque, `lives--`, `dead = true` y arranca el temporizador de `DEATH_MS`.
2. Durante ese segundo la serpiente muerta se queda dibujada, parpadeando, y no se mueve nada. El HUD ya muestra la vida descontada.
3. Si `lives === 0`, en vez de reaparecer se llama a `onGameOver(score)` y `status` pasa a `"gameover"`.
4. Si quedan vidas: serpiente de `START_LENGTH` segmentos en el centro mirando a la derecha, `queued` vacía, `waiting = true`. **No se mueve hasta que el jugador pulse una flecha o toque un botón.**
5. La comida **se queda donde estaba**, salvo que caiga sobre la serpiente nueva, en cuyo caso se recoloca.

`waiting` también es el estado del arranque de la partida y del `restart`: la primera partida empieza quieta, no con la serpiente ya lanzada hacia la pared derecha.

### Los controles declarados — la entrada de `GAME_ENGINES`

```ts
vibora: {
  width: 800,
  height: 600,
  keys: [
    { keys: ["◄", "▲", "►", "▼"], label: "Mover" },
  ],
  touch: [
    [
      { action: "left",  glyph: "◄", label: "Mover a la izquierda", tone: "cyan" },
      { action: "right", glyph: "►", label: "Mover a la derecha",   tone: "cyan" },
    ],
    [
      { action: "thrust", glyph: "▲", label: "Mover arriba", tone: "yellow" },
      { action: "down",   glyph: "▼", label: "Mover abajo",  tone: "yellow" },
    ],
  ],
  audio: true,
  load: () => import("@/lib/games/vibora/engine"),
},
```

Cuatro botones repartidos en los dos grupos de siempre: horizontales bajo el pulgar izquierdo, verticales bajo el derecho. Es el mismo reparto que ASTEROIDES y TETRIS, así que **`.game-touch` y `.pad-key` no se tocan**.

`thrust` significa «arriba» aquí, y eso no es un abuso: el comentario de `GameAction` en `lib/games/engine.ts` ya dice que los nombres vienen de asteroides pero el significado lo pone cada juego. Lo que el jugador lee sale de `label`, no del nombre de la acción.

Las cuatro flechas van en **un solo renglón** de la leyenda, con la etiqueta «Mover»: cuatro renglones que dijeran «Mover arriba», «Mover abajo»… serían cuatro veces la misma información.

Una pulsación táctil encola el giro igual que una tecla; **mantener el botón pulsado no hace nada más** que el primer giro. En un juego de rejilla no existe «mantener la dirección»: la serpiente ya va sola.

### El sonido — WebAudio, sin ficheros

Tres avisos, sintetizados con un oscilador y una envolvente cortas:

| Sonido       | Forma                                                   |
| ------------ | ------------------------------------------------------- |
| Bocado       | Onda cuadrada, 660 Hz, 60 ms, ataque y caída inmediatos |
| Subida nivel | Dos notas cuadradas, 660 → 990 Hz, 90 ms cada una       |
| Choque       | Diente de sierra, 200 → 60 Hz en 300 ms                 |

```ts
// El AudioContext se crea perezosamente, en el primer sonido que de verdad
// haya que emitir. Crearlo al montar lo deja en estado "suspended" hasta que
// el jugador toca algo, y el navegador lo apunta en la consola.
function ctx(): AudioContext | null;
```

Reglas, que son las mismas tres de la SPEC 09 traducidas a WebAudio:

- **No suena nada si el motor está silenciado, pausado o ya destruido.**
- **La promesa de `resume()` se recoge con un `catch` vacío**, por si el navegador la rechaza.
- **`destroy()` cierra el `AudioContext`.** Es lo que aquí hace de «soltar los listeners»: sin ese `close()`, cada visita al juego deja un contexto de audio vivo, y los navegadores tienen un tope de contextos por pestaña.

`setMuted(muted)` guarda la bandera y, si pasa a silenciado, cierra el contexto en curso; el siguiente sonido no silenciado lo vuelve a crear. El reproductor le dice el estado inicial en `onReady`, como a ARKANOID.

### El dibujo

Todo con `fillRect` y gradientes, en el neón del sitio:

- **Fondo:** el negro del lienzo con una rejilla de líneas de 1 px muy tenues, para que se lea que las celdas son celdas.
- **Cuerpo:** cuadrados de 20 px con 2 px de separación, en verde, con el brillo bajando de la cabeza a la cola.
- **Cabeza:** el mismo cuadrado, más claro y con un borde, para que se distinga de un vistazo cuál de los dos extremos es.
- **Comida:** un cuadrado magenta que late —escala entre 0,8 y 1,0 según el reloj—, para que se encuentre sin buscarla.
- **Serpiente muerta:** el cuerpo entero en rojo, parpadeando a 8 Hz durante el segundo de `DEATH_MS`.

**El lienzo no dibuja puntuación, ni vidas, ni nivel, ni ningún cartel.** Eso lo pinta la plataforma desde la SPEC 05.

---

## 4 — Plan de implementación

Cada paso deja la aplicación compilando y navegable.

1. **La ficha.** Migración `add_game_vibora` con el `insert`, aplicada por MCP **y** versionada en `supabase/migrations/`. La misma entrada, carácter a carácter, en `FALLBACK_GAMES` de `lib/games.ts`. _Verificable:_ `/juego/vibora` abre con su Detalle, la tarjeta sale en la Biblioteca todavía sin portada propia, `/salon` tiene su pestaña, y `Mejor global` y `Partidas` están a 0.

2. **La portada.** `.cover-vibora` en `app/globals.css`, con gradientes puros y en el estilo de las otras once. **Diseñarla con `/frontend-design`**, como exige `CLAUDE.md`, y **verificarla con `npm run dev` abierto, no solo con `npm run build`.** _Verificable:_ la tarjeta de VÍBORA tiene portada propia, se distingue de la de SERPENTINA a tamaño de tarjeta sin leer el título, y el resto del sitio sigue con sus estilos.

3. **El motor, mudo y sin vidas.** `lib/games/vibora/engine.ts` con `createEngine`: rejilla, paso fijo con acumulador, cuatro direcciones con cola de dos giros, comida sobre lista de celdas libres, crecimiento, puntuación, nivel, muerte contra pared y contra cuerpo, y dibujo completo. De momento la partida acaba al primer choque, y `audio: false` en el registro. _Verificable:_ `/jugar/vibora` es jugable con las flechas, la serpiente crece al comer, el HUD sube de 10 en 10 en el nivel 1, el nivel sube al quinto bocado y se nota la aceleración, y chocar abre el modal FIN DEL JUEGO.

4. **Las vidas y el calibrado.** Los tres estados `dead` / `waiting` / vivo, el parpadeo del segundo de muerte, la reaparición corta en el centro, la comida que se queda, y el fin al llenar el tablero. **Jugar tres partidas completas de principio a fin** y confirmar que el nivel 1 se piensa y el nivel 6 aprieta; si no, el sitio donde se ajusta es `BASE_STEP_MS` y `SPEED_FACTOR`, y el número que quede se escribe en este spec. _Verificable:_ chocar con vidas de sobra no acaba la partida, la serpiente reaparece corta y quieta, la primera flecha la lanza, y perder la tercera vida abre el modal con la puntuación real.

5. **El táctil.** Los cuatro botones en el registro y el encolado desde `setAction`. _Verificable:_ en un viewport de 390 px con puntero grueso, los cuatro botones se ven enteros —dos a cada lado— y la serpiente gira con ellos; mantener pulsado no hace nada raro.

6. **El sonido.** El módulo de WebAudio, los tres avisos, `setMuted`, el `close()` en `destroy` y `audio: true` en el registro. _Verificable:_ VÍBORA suena al comer, al subir de nivel y al chocar; el botón SONIDO lo calla en el acto; recargar encuentra la preferencia como se dejó; la consola queda limpia; y ni ASTEROIDES ni TETRIS enseñan el botón.

---

## 5 — Criterios de aceptación

**Catálogo**

- [ ] `public.games` tiene doce filas y la duodécima es `vibora`, con `sort_order` 120, `cover = 'cover-vibora'` y `color = 'green'`.
- [ ] La migración está versionada en `supabase/migrations/` además de aplicada, y `get_advisors` de seguridad no reporta ningún aviso nuevo.
- [ ] `FALLBACK_GAMES` tiene la misma entrada, con `id`, `title`, `short`, `long`, `cat`, `cover` y `color` idénticos carácter a carácter a los de la migración.
- [ ] La tarjeta de VÍBORA aparece en la Biblioteca, el buscador la encuentra escribiendo «víbora» **y** escribiendo «vibora» sin tilde, y el filtro ARCADE la muestra.
- [ ] `/juego/vibora` abre y su botón JUGAR lleva a `/jugar/vibora`.
- [ ] SERPENTINA sigue en el catálogo, con su portada `cover-snake`, y `/jugar/serpentina` sigue mostrando la arena decorativa y la puntuación simulada.

**Estilos**

- [ ] Con `npm run dev` corriendo, la Landing, la Biblioteca, el Detalle y el reproductor se ven **exactamente igual** que antes de este spec salvo por la tarjeta nueva.
- [ ] La portada de VÍBORA se distingue de la de SERPENTINA a tamaño de tarjeta, sin leer el título.
- [ ] `.cover-vibora` usa solo gradientes: ni `url()`, ni SVG embebido, ni imágenes.
- [ ] Ninguna declaración nueva de `app/globals.css` lleva comentarios intercalados dentro del valor.
- [ ] `npm run build` pasa, y la hoja de estilos que sirve `npm run dev` contiene las reglas de las otras once portadas.

**El juego**

- [ ] En `/jugar/vibora` se ve la rejilla de 40 × 30 dentro del marco CRT, sin barra de scroll horizontal en un viewport de 1280 px ni en uno de 390 px.
- [ ] La partida empieza con una serpiente de 3 segmentos en el centro, **quieta**, y no se mueve hasta la primera flecha.
- [ ] Las cuatro flechas mueven en esa dirección, y la contraria a la dirección en curso se ignora: yendo a la derecha, `←` no mata.
- [ ] Pulsando `↑` y luego `→` entre dos pasos, la serpiente hace la esquina cerrada: primero sube, después gira. No se pierde el primer giro ni se salta el segundo.
- [ ] Yendo a la derecha, pulsar `↑` e inmediatamente `↓` no da media vuelta ni mata.
- [ ] Comer alarga la serpiente exactamente un segmento y coloca comida nueva en una celda libre, nunca sobre el cuerpo.
- [ ] En el nivel 1 un bocado suma 10 puntos; en el nivel 3 suma 30.
- [ ] El quinto bocado sube el `Nivel` del HUD a 2 y se nota que va más rápida.
- [ ] Cronometrado: en el nivel 1 la serpiente da 8 pasos por segundo (± 1); del nivel 10 en adelante no acelera más.
- [ ] Tocar cualquiera de las cuatro paredes cuesta una vida.
- [ ] Morderse el cuerpo cuesta una vida; ir pegado a la propia cola, persiguiéndola, **no**.
- [ ] Al chocar con vidas de sobra, la serpiente muerta se queda un segundo a la vista parpadeando, el HUD ya muestra la vida descontada, y después reaparece corta, en el centro y quieta.
- [ ] Perder una vida **no** baja el nivel, ni la velocidad, ni la puntuación.
- [ ] Perder la tercera vida abre el modal FIN DEL JUEGO con la puntuación real.
- [ ] El lienzo **no** dibuja puntuación, ni vidas, ni nivel, ni ningún cartel de `PAUSA`, `GAME OVER` o victoria.
- [ ] `Espacio` no hace nada en este juego, y no hay ningún selector de nivel en ninguna parte.

**El sonido**

- [ ] Comer suena, subir de nivel suena distinto y chocar suena distinto de los dos.
- [ ] El botón SONIDO aparece en `/jugar/vibora` y **no** aparece en `/jugar/asteroides`, `/jugar/tetris` ni en ningún juego sin motor.
- [ ] Pulsarlo pasa a SILENCIO y el juego deja de sonar en el acto, sin cortar la partida.
- [ ] Recargar la página, o venir de `/jugar/arkanoid`, encuentra la preferencia como se dejó: es la misma clave `av_muted`.
- [ ] Con `localStorage` bloqueado el reproductor no se rompe.
- [ ] La consola no muestra ninguna promesa rechazada, ni ningún aviso de `AudioContext` suspendido, al abrir el juego antes de tocar nada.
- [ ] En pausa no suena nada.
- [ ] Entrar y salir del juego diez veces seguidas no acumula avisos de contextos de audio en la consola.

**Contrato**

- [ ] `lib/games/engine.ts`, `components/game-player.tsx`, `components/games/game-canvas.tsx` y `lib/preferences.ts` **no tienen ni una línea de diferencia** respecto a antes de este spec.
- [ ] El único cambio de `lib/games/registry.ts` es la entrada `vibora`.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.

**Integración con el reproductor**

- [ ] PAUSA congela el juego y muestra EN PAUSA; la serpiente no avanza ni acumula pasos; REANUDAR la deja donde estaba y **no** la teletransporta varias celdas de golpe.
- [ ] `P` y `Escape` alternan la pausa, y cambiar de pestaña y volver encuentra el juego pausado.
- [ ] Pulsar las flechas mientras se juega no desplaza la página.
- [ ] Escribir en el campo de iniciales del modal no mueve la serpiente.
- [ ] JUGAR DE NUEVO reinicia desde cero: puntuación 0, tres vidas, nivel 1, serpiente de 3 en el centro y quieta.
- [ ] El botón FIN termina la partida con la puntuación acumulada.
- [ ] SALIR navega a `/juego/vibora` y no queda ningún fotograma programado, ningún `AudioContext` abierto ni ningún listener vivo.
- [ ] En `npm run dev`, con el doble montaje de Strict Mode, la serpiente no va al doble de velocidad ni suena dos veces cada bocado.
- [ ] La leyenda de controles dice «Mover» con las cuatro flechas, y «Pausa». En ninguna pantalla aparece «Propulsar», «Disparar», «Rotar», «Soltar» ni «Mover la paleta» jugando a VÍBORA.
- [ ] Los cuatro botones táctiles se ven enteros en un viewport de 390 px, dos a cada lado, sin desbordar ni solapar.
- [ ] `/jugar/asteroides`, `/jugar/tetris` y `/jugar/arkanoid` se juegan exactamente igual que antes de este spec.

**Marcador**

- [ ] Con sesión de cuenta, terminar una partida y guardar inserta una fila en `public.scores` con `game_id = 'vibora'` y el `user_id` de la sesión.
- [ ] El modal muestra `PUESTO #NN DE MM` y anuncia récord personal solo si se superó la marca anterior.
- [ ] `/salon?juego=vibora` muestra esa marca, y `Mejor global` y `Partidas` del Detalle dejan de estar a 0.
- [ ] Con sesión de invitado no se inserta ninguna fila y la marca aparece en TUS PARTIDAS EN ESTE NAVEGADOR.
- [ ] Sin las variables `NEXT_PUBLIC_SUPABASE_*`, `npm run build` pasa, `/jugar/vibora` es jugable, la Biblioteca muestra los doce juegos del respaldo y solo falla el guardado, con mensaje visible.

---

## 6 — Decisiones tomadas y descartadas

**Ficha nueva `vibora`, y SERPENTINA intacta.** Aquí la decisión fue de verdad reñida, y al revés que las tres anteriores. En las SPEC 05, 08 y 09 el argumento era «el juego ya está escrito y se llama ASTEROIDES»; ese argumento **no existe** cuando el juego lo escribimos nosotros y podríamos llamarlo como quisiéramos. Se valoró en serio darle el motor a SERPENTINA: habría ahorrado la migración, la portada y un cuarto par de gemelos en el catálogo. Se descarta para no romper el patrón a mitad de camino: hoy la regla «maqueta y motor son fichas distintas» se explica en una frase, y con una excepción pasaría a explicarse en un párrafo. El coste asumido es un catálogo con doce entradas de las que cuatro son sombras de otras cuatro.

**VÍBORA y no SNAKE.** Rompe con ASTEROIDES / TETRIS / ARKANOID, que llevan el nombre real del clásico. Se acepta por dos razones: «Snake» no es una marca como Tetris o Arkanoid, es un sustantivo común; y el nombre en español separa mejor la ficha de su gemela SERPENTINA que un anglicismo casi sinónimo. La tilde obliga a que el buscador la encuentre también escribiendo «vibora», y hay criterio de aceptación para ello.

**Muro mortal, sin envoltura.** La envoltura habría dado partidas más largas y un juego más amable, y ya hay precedente en la plataforma: el espacio de ASTEROIDES se dobla sobre sí mismo. Se descarta porque en Snake la pared es la mitad del juego: sin ella la serpiente solo puede morir de sí misma, y las primeras vidas dejan de tener tensión. Se descartó también la variante «muro hasta el nivel 4 y luego envoltura»: es una regla que hay que explicar, y un juego de recreativa no debería necesitar leerse.

**Tres vidas, y no una.** El Snake canónico es de una vida. Se descarta por el HUD: la plataforma tiene tres casillas fijas desde la SPEC 05, y una `Vidas` que solo sabe decir 1 o 0 es una casilla que no informa. Con tres, además, la partida media dura lo suficiente para que llegar al nivel 6 sea alcanzable, que es lo que hace que el marcador tenga recorrido.

**El nivel no baja al perder una vida.** La alternativa —volver al nivel 1— castiga más, pero convierte las vidas 2 y 3 en una repetición lenta de un tramo ya superado. `eaten` cuenta los bocados de toda la partida precisamente por esto.

**10 × nivel por bocado.** Con 10 fijos la puntuación sería, literalmente, el número de comidas, y llegar al nivel 9 valdría lo mismo que quedarse en el 2. El multiplicador hace que la parte rápida —que es la difícil— sea la que decide el marcador. Es la primera puntuación de la plataforma que no es una constante por evento, y es la que mejor separa a dos jugadores.

**Suelo de velocidad en 50 ms, a partir del nivel 10.** Sin suelo, `125 / 1.12 ** (n - 1)` cruza los 20 ms sobre el nivel 17 y la serpiente empieza a dar más pasos por fotograma que celdas caben en la pantalla: deja de ser difícil y pasa a ser una lotería. Con el suelo el nivel sigue subiendo y sigue multiplicando puntos, así que **el marcador no tiene techo**, que es justo lo contrario del problema de 3.000 puntos que la SPEC 09 se comió en ARKANOID.

**Cola de dos giros, y no «el último gana».** La implementación ingenua —guardar solo la última tecla y validarla contra la dirección actual— tiene dos fallos conocidos, y los dos se viven como injusticia: la esquina cerrada `↑ →` pulsada rápido pierde el primer giro, y `↑ ↓` pulsados rápido yendo a la derecha dan media vuelta y matan, porque cada uno por separado es legal. La cola valida cada giro contra el **anterior de la cola**, no contra la dirección pintada, y arregla los dos. Dos es el tope: con tres, el jugador puede adelantarse tanto que la serpiente ya no responde a lo que ve.

**Paso fijo con acumulador, no interpolación.** Se valoró mover la serpiente por píxeles con las celdas solo como referencia lógica, que se ve más suave. Se descarta: el salto de celda a celda es lo que hace legible dónde va a estar la cabeza dentro de tres pasos, y esa legibilidad es el juego entero.

**Comida sobre lista de celdas libres, no reintento al azar.** Con la serpiente ocupando el 90 % del tablero, `while (ocupada) reintentar` es una espera de duración indefinida **dentro del bucle de dibujo**. Construir el array de libres son 1.200 iteraciones una vez por bocado. Se paga el coste conocido antes que el riesgo desconocido.

**Llenar el tablero termina la partida.** Es el caso que en la práctica nadie va a ver, y es el que cuelga la pestaña si no está escrito, porque no hay celda libre donde poner comida. Tres líneas.

**El cuerpo colisiona sin contar la cola.** La cola se va en el mismo paso en que la cabeza llega a su celda, así que contarla haría ilegal ir pegado a la propia cola — que es la maniobra que salva las partidas apuradas, y la que todo el mundo que ha jugado a Snake espera que funcione.

**Sonido sintetizado con WebAudio, sin ficheros.** No hay original del que copiar `mp3`, así que las opciones eran sintetizar o buscar audio de terceros con licencia clara. Se sintetiza: son unas 25 líneas, cero binarios en el repo, cero dependencias externas y cero decisiones de licencia dentro de un spec que no las necesita. El contrato de audio de la SPEC 09 se reutiliza tal cual — es su primera prueba real con un segundo juego, y era exactamente para esto.

**El `AudioContext` se crea perezosamente y se cierra en `destroy`.** Crearlo al montar lo deja «suspended» y el navegador lo apunta en la consola. No cerrarlo deja un contexto vivo por visita, y los navegadores tienen un tope por pestaña. Es el equivalente aquí a lo que en ARKANOID era soltar los listeners de puntero.

**Sin banco de pruebas.** La SPEC 08 escribió uno porque el port de Tetris tenía reglas invisibles jugando —puntuación por tipo de línea, saltos de pared—. Aquí todo se ve: la serpiente crece, choca, acelera. Lo que **no** se ve es la cola de giros, que es la única lógica sutil del motor; se asume que se comprueba a mano con los dos criterios de aceptación específicos que tiene, y queda anotado en el §7.

**La partida empieza quieta.** Arrancar con la serpiente ya lanzada regala una muerte al jugador que todavía está leyendo la leyenda de controles. `waiting` cubre el arranque, el `restart` y cada reaparición con el mismo estado.

**Seguir recto es una orden válida, aunque no encole ningún giro.** Salió al implementar, y no estaba previsto aquí: la víbora nace mirando a la derecha, así que `→` es la flecha que pulsa cualquiera al verla parada. La primera versión la descartaba por ser la dirección en curso y dejaba la víbora congelada hasta que el jugador probaba otra tecla. `enqueue` distingue ahora tres casos: seguir recto suelta el `waiting` sin encolar nada, la media vuelta se descarta entera, y el resto se encola.

**Es un Snake, no se moderniza.** Ni fruta bonus, ni obstáculos, ni muros interiores, ni portales, ni potenciadores, ni dos jugadores. Cada uno de esos es una decisión de diseño que aquí no hay original que respalde, y este spec ya tiene demasiadas.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                        | Mitigación                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No hay original: los números son inventados y pueden estar mal calibrados.** Es el riesgo mayor de este spec y no se parece a nada de las SPEC 05, 08 y 09. | El paso 4 obliga a jugar tres partidas completas antes de dar el motor por bueno, y hay criterios con cronómetro sobre los pasos por segundo. Si hay que mover `BASE_STEP_MS` o `SPEED_FACTOR`, el número nuevo se escribe **en este spec**, no solo en el código. |
| La cola de dos giros es la única lógica sutil del motor y no hay banco de pruebas que la cubra.                                                               | Dos criterios de aceptación específicos y explícitos: la esquina cerrada `↑ →` y el `↑ ↓` que no debe matar. Son 20 segundos de comprobación manual, y hay que hacerla en cada cambio del bloque de giros.                                                         |
| El estado como globales de módulo compila, y solo falla con el doble montaje de Strict Mode en desarrollo — dos serpientes, velocidad doble y sonido doble.   | Todo el estado vive dentro de `createEngine`, sin excepción, y hay criterio de aceptación específico sobre la velocidad **y** sobre el sonido duplicado. Es el mismo riesgo que anotaron las tres specs anteriores.                                                |
| Al reanudar tras una pausa larga, el acumulador de tiempo dispara media docena de pasos de golpe y la serpiente se teletransporta contra una pared.           | `dt` capado a 0,05 s **y** el acumulador se pone a cero al reanudar. Hay criterio de aceptación explícito sobre reanudar sin saltos.                                                                                                                               |
| El `AudioContext` no cerrado se acumula: cada entrada al juego deja uno vivo y el navegador acaba negándose a crear más.                                      | `destroy()` llama a `close()`, y hay criterio de aceptación de entrar y salir diez veces con la consola limpia.                                                                                                                                                    |
| Una regla CSS mal formada tumba la hoja entera en desarrollo y `npm run build` no se entera. Ya pasó una vez antes de la SPEC 08.                             | El paso 2 se verifica con `npm run dev` abierto, la portada tiene prohibidos los comentarios dentro de un valor, y hay criterio de aceptación sobre las otras once portadas.                                                                                       |
| La portada se confunde con la de SERPENTINA en la parrilla: misma categoría, mismo color y el mismo bicho.                                                    | Criterio de aceptación propio a tamaño de tarjeta y diseño con `/frontend-design`. Es el par de gemelos más parecido del catálogo y el que más trabajo de portada necesita.                                                                                        |
| La tilde de VÍBORA hace que el buscador no la encuentre escribiendo «vibora».                                                                                 | Criterio de aceptación con las dos grafías. Si el buscador no normaliza tildes hoy, se arregla ahí, que es donde está el fallo, y no cambiando el título.                                                                                                          |
| La fila de `public.games` y la de `FALLBACK_GAMES` se desincronizan, y el catálogo cambia según haya o no variables de entorno.                               | Es el riesgo que ya anotó el SPEC 06. Los textos se copian carácter a carácter en el mismo paso, y `lib/catalog.ts` avisa por consola cuando cae al respaldo.                                                                                                      |
| La puntuación no tiene techo y alguien monta un marcador con cifras absurdas.                                                                                 | Una partida excelente —nivel 12, unos 60 bocados— ronda los 4.000 puntos; llenar el tablero entero no llega a 200.000. `MAX_SCORE` está en 10.000.000 y no hace falta tocarlo.                                                                                     |

---

## Lo que **no** entra en este spec

Ponerle motor a SERPENTINA. Fruta bonus, obstáculos y muros interiores. Envoltura por los bordes. Modo a dos jugadores. Música, volumen graduable o mezclador. Cualquier cambio en `lib/games/engine.ts`, `components/game-player.tsx`, `components/games/game-canvas.tsx` o `lib/preferences.ts`. Carteles en el lienzo. Guardar la partida a medias. Anti-trampas. Banco de pruebas. Sonido en ASTEROIDES y TETRIS.

Cada uno de esos, si cae, va en su propio spec.
