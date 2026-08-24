# SPEC 08 — TETRIS: el segundo juego real

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-08-24
> **Objetivo:** Portar el TETRIS de `references/started-games/03-tetris/` a un motor TypeScript montado en el reproductor, con su ficha en el catálogo, su portada y su marcador, sin tocar nada de lo que ya funciona.

---

## 1 — Por qué existe este spec

El SPEC 05 dejó ASTEROIDES jugable y una promesa: _«Tetris y Arkanoid tendrán su propio spec cada uno. El registro queda preparado para que añadirlos sea una línea»_. Esta es la de Tetris.

Es también la primera vez que se comprueba si la promesa era cierta. La respuesta corta es que casi: el SPEC 07 tuvo que sacar los controles del JSX antes de que un segundo juego pudiera entrar sin mentirle al jugador. Con eso hecho, aquí solo queda el juego.

En `references/started-games/03-tetris/` hay 332 líneas de JavaScript sin dependencias, con las mecánicas completas: siete piezas —ocho, en realidad—, rotación con saltos de pared, bajada suave y caída instantánea, pieza fantasma, vista previa de la siguiente, puntuación clásica y niveles que aceleran cada diez líneas. Está terminado. Lo que no está es dentro de la plataforma: vive en tres lienzos, un panel de DOM y un puñado de globales de módulo.

Hay dos diferencias con el port de ASTEROIDES que este spec tiene que resolver y aquél no:

- **El original no cabe.** Su tablero es de 300 × 600, relación 1:2, y `.game-canvas` asume 4/3. Un lienzo vertical dentro del marco CRT deja dos franjas negras a los lados.
- **El HUD no encaja.** El de la plataforma tiene casillas para puntuación, vidas y nivel. Tetris no tiene vidas y sí tiene LÍNEAS, que no tiene dónde ir.

Y hay un aviso que sale de un intento anterior, ya revertido: **una regla CSS mal formada en `app/globals.css` dejó todo el sitio sin estilos en `npm run dev`, mientras `npm run build` pasaba sin quejarse.** Eso no es una anécdota, es un criterio de aceptación.

---

## 2 — Alcance

**Dentro:**

- **Ficha nueva `tetris`** en `public.games` por migración, y su copia en `FALLBACK_GAMES`. Es el décimo juego, `sort_order` 100. No sustituye a CAÍDA.
- **Portada CSS `.cover-tetris`** en `app/globals.css`, con gradientes puros y distinguible de `.cover-tetro` a tamaño de miniatura.
- **Motor portado** a `lib/games/tetris/engine.ts`, con las piezas y las tablas en `lib/games/tetris/pieces.ts`. Mismas constantes, misma física, mismas puntuaciones.
- **Lienzo lógico de 800 × 600**, con el tablero de 300 × 600 a la izquierda y un panel a su derecha donde se dibujan SIGUIENTE y LÍNEAS.
- **`lives: 0` en el snapshot.** El HUD ya pinta `—` cuando no hay vidas.
- **Entrada en `GAME_ENGINES`** con sus cinco controles declarados, en el formato que abrió la SPEC 07.
- **Repetición de los botones táctiles mantenidos** para mover y bajar. El original no tenía botonera; con teclado la repetición la da el sistema.
- **`.pad-key` se encoge** para que los cinco botones quepan en un viewport de 390 px.
- **Banco de pruebas en Node** en `scripts/`, que ejecuta el motor real con un canvas y un `requestAnimationFrame` simulados, más el script `npm run prueba:tetris`.

**Fuera de alcance (para specs futuras):**

- **ARKANOID.** El tercer juego tendrá su spec, y ahora sí debería ser solo el motor.
- **Poner motor a CAÍDA.** Se queda con su maqueta y su puntuación simulada, igual que ROCAS se quedó con la suya cuando entró ASTEROIDES.
- **Framework de tests.** El banco de pruebas es un script suelto: no hay runner, ni `watch`, ni CI, ni se ejecuta en `npm run build`.
- **Banco de pruebas para ASTEROIDES.** Se hará si alguna vez toca ese motor.
- **Anti-trampas.** Igual que en el SPEC 05: se puede llamar a `saveScore` con una puntuación inventada.
- **Sonido.** El original tampoco lo tiene.
- **Guardar la partida a medias.** Cerrar la pestaña pierde el tablero.
- **Puntuaciones de invitados en la base.** Sin cambios respecto al SPEC 06.
- **Modo a dos jugadores, piezas retenidas (`hold`), o los siete rebotes del SRS oficial.** El original no los tiene y portarlos es diseñar, no portar.
- **Borrar `references/started-games/03-tetris/`.** Se queda como referencia.

---

## 3 — Modelo de datos

### La fila del catálogo

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('tetris', 'TETRIS', …, 'PUZZLE', 'cover-tetris', 'cyan', 100);
```

`sort_order` 100 es el siguiente múltiplo de diez libre. `cat` y `color` son valores que ya admiten los `check` del SPEC 06, así que no hace falta tocar ninguna restricción. La misma entrada, con los mismos textos carácter a carácter, se añade a `FALLBACK_GAMES` en `lib/games.ts`.

**No hay ningún otro cambio de esquema.** `scores`, `game_leaderboards` y `game_stats` están indexadas por `game_id` desde el SPEC 06: el marcador de TETRIS funciona en cuanto existe la fila. `lib/database.types.ts` no se regenera, porque insertar filas no cambia el esquema.

### Piezas y tablas — `lib/games/tetris/pieces.ts`

Copia literal del original: `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, los ocho colores, las ocho matrices de `PIECES` y `LINE_SCORES = [0, 100, 300, 500, 800]`.

La octava pieza es una «tuerca» 3 × 3 con el centro hueco:

```ts
[
  [8, 8, 8],
  [8, 0, 8],
  [8, 8, 8],
]; // N (tuerca)
```

No aparece en el README del original, pero `randomPiece` la reparte una de cada ocho veces. Se porta: quitarla cambiaría la dificultad de un juego que ya estaba equilibrado.

### Reparto del lienzo — `lib/games/tetris/engine.ts`

```
0                                                    800
├──── 100 ────┬──── 300 ────┬── 60 ──┬──── 240 ────┬── 100 ──┤
   margen        tablero       hueco      panel       margen
```

Márgenes iguales a los lados, el tablero de `COLS × BLOCK` = 300 por `ROWS × BLOCK` = 600 —que llena el alto exacto— y el panel entre medias. El panel lleva la caja de SIGUIENTE, de cuatro celdas de lado, y el contador de LÍNEAS debajo.

### El snapshot

```ts
{ score, lives: 0, level, status }
```

`level = Math.floor(lines / 10) + 1`, como en el original. `lines` **no** va en el snapshot: se dibuja en el panel del lienzo, porque el HUD de la plataforma no tiene esa casilla y añadírsela cambiaría el HUD de los otros nueve juegos.

### Los controles declarados

```ts
keys: [
  { keys: ["◄", "►"], label: "Mover" },
  { keys: ["▲", "X"], label: "Rotar" },
  { keys: ["▼"], label: "Bajar" },
  { keys: ["Espacio"], label: "Soltar" },
],
touch: [
  [ left ◄, right ► ],
  [ thrust ⟳ Rotar, down ▼ Bajar, fire ⤓ Soltar ],
],
```

Cinco botones en total, tres en el grupo derecho. `thrust` rota y `fire` suelta: los nombres son los de asteroides y el significado lo pone el juego, tal y como dejó documentado la SPEC 07.

### El banco de pruebas — `scripts/`

Tres ficheros y un script de npm:

- `scripts/alias-loader.mjs` — resuelve el alias `@/…` para poder importar los módulos reales sin bundler.
- `scripts/alias-register.mjs` — lo registra; va en `--import`.
- `scripts/prueba-tetris.mjs` — el banco: monta `window`, `HTMLElement`, `requestAnimationFrame` y un canvas falsos, controla el reloj y `Math.random`, y comprueba las reglas del juego y el contrato de la plataforma.

```json
"prueba:tetris": "node --experimental-strip-types --import ./scripts/alias-register.mjs scripts/prueba-tetris.mjs"
```

Devuelve código de salida 0 si todo pasa y 1 si algo falla.

---

## 4 — Plan de implementación

Cada paso deja la aplicación compilando y navegable.

1. **La ficha.** Migración `add_game_tetris` con el `insert`, aplicada por MCP **y** versionada en `supabase/migrations/`. Añadir la misma entrada a `FALLBACK_GAMES`. _Verificable:_ `/juego/tetris` abre con su Detalle, la tarjeta sale en la Biblioteca sin portada propia todavía, `/salon` tiene su pestaña, y `Mejor global` y `Partidas` están a 0.

2. **La portada.** `.cover-tetris` en `app/globals.css`, con gradientes puros y en el estilo de las otras nueve. **Verificar con `npm run dev` abierto, no solo con `npm run build`.** _Verificable:_ la tarjeta de TETRIS tiene portada propia, se distingue de la de CAÍDA de un vistazo, y el resto del sitio sigue con sus estilos.

3. **Las piezas.** `lib/games/tetris/pieces.ts` con las constantes, los colores, las ocho matrices y `LINE_SCORES`. _Verificable:_ `npx tsc --noEmit` pasa; nada ha cambiado en la pantalla porque todavía nadie lo importa.

4. **El motor.** `lib/games/tetris/engine.ts` con `createEngine`: estado por instancia, tablero, colisiones, rotación con saltos de pared, limpieza de líneas, sombra, caída automática, fin de partida y el dibujo del tablero y del panel. Registrar la entrada en `GAME_ENGINES` con sus controles. _Verificable:_ `/jugar/tetris` es jugable con teclado, el HUD sube puntos reales, `Vidas` muestra `—`, y llenar el pozo abre el modal FIN DEL JUEGO.

5. **Los controles táctiles.** Repetición de `left`, `right` y `down` mientras se mantiene pulsado el botón, y `.pad-key` con `flex: 0 1 72px` y `min-width` para que los cinco quepan. _Verificable:_ en un viewport de 390 px con puntero grueso, los cinco botones se ven enteros sin scroll horizontal, y mantener ◄ mueve la pieza más de una celda.

6. **El banco de pruebas.** Los tres ficheros de `scripts/` y el script de npm. _Verificable:_ `npm run prueba:tetris` termina con todas las comprobaciones en verde y código de salida 0.

---

## 5 — Criterios de aceptación

**Catálogo**

- [ ] `public.games` tiene diez filas y la décima es `tetris`, con `sort_order` 100 y `cover = 'cover-tetris'`.
- [ ] La migración está versionada en `supabase/migrations/` además de aplicada, y `get_advisors` de seguridad no reporta ningún aviso nuevo.
- [ ] `FALLBACK_GAMES` tiene la misma entrada, con `id`, `title`, `short`, `long`, `cat`, `cover` y `color` idénticos carácter a carácter a los de la migración.
- [ ] La tarjeta de TETRIS aparece en la Biblioteca, el buscador la encuentra escribiendo «tetris» y el filtro PUZZLE la muestra junto a CAÍDA.
- [ ] `/juego/tetris` abre y su botón JUGAR lleva a `/jugar/tetris`.
- [ ] CAÍDA sigue en el catálogo, con su portada `cover-tetro`, y `/jugar/caida` sigue mostrando la arena decorativa y la puntuación simulada.

**Estilos**

- [ ] Con `npm run dev` corriendo, la Landing, la Biblioteca, el Detalle y el reproductor se ven **exactamente igual** que antes de este spec salvo por la tarjeta nueva.
- [ ] La portada de TETRIS se distingue de la de CAÍDA a tamaño de tarjeta, sin leer el título.
- [ ] `.cover-tetris` usa solo gradientes: ni `url()`, ni SVG embebido, ni imágenes.
- [ ] Ninguna declaración nueva de `app/globals.css` lleva comentarios intercalados dentro del valor.
- [ ] `npm run build` pasa, y la hoja de estilos que sirve `npm run dev` contiene las reglas de las otras nueve portadas.

**El juego**

- [ ] En `/jugar/tetris` se ve el tablero con su rejilla dentro del marco CRT, sin barra de scroll horizontal en un viewport de 1280 px ni en uno de 390 px.
- [ ] `←` y `→` mueven la pieza, `↑` y `X` la rotan, `↓` la baja una fila y `Espacio` la suelta de golpe.
- [ ] Una pieza pegada a la pared rota igualmente, desplazándose hasta dos columnas.
- [ ] La sombra marca dónde va a aterrizar la pieza actual y se mueve con ella.
- [ ] El panel muestra la pieza siguiente, y esa es la que aparece al aterrizar la actual.
- [ ] Completar una fila la borra, baja lo que había encima y suma 100 puntos por el nivel; dos filas a la vez suman 300.
- [ ] Bajar con `↓` suma 1 punto por fila; soltar con `Espacio` suma 2 por celda recorrida.
- [ ] Cada diez líneas sube el nivel en el HUD y la caída se acelera.
- [ ] Las ocho piezas salen, la tuerca incluida.
- [ ] `Vidas` muestra `—` durante toda la partida, no tres corazones.
- [ ] LÍNEAS se ve en el panel del lienzo y coincide con las líneas hechas.
- [ ] Llenar el pozo hasta arriba abre el modal FIN DEL JUEGO con la puntuación real. El lienzo **no** dibuja ningún cartel de GAME OVER y `Espacio` no reinicia nada.

**Integración con el reproductor**

- [ ] PAUSA congela el juego y muestra EN PAUSA; la pieza no baja mientras tanto; REANUDAR la deja donde estaba.
- [ ] `P` y `Escape` alternan la pausa, y cambiar de pestaña y volver encuentra el juego pausado.
- [ ] Pulsar flechas o espacio mientras se juega no desplaza la página.
- [ ] Escribir en el campo de iniciales del modal no mueve ninguna pieza.
- [ ] JUGAR DE NUEVO reinicia desde cero: puntuación 0, nivel 1, LÍNEAS 0 y tablero vacío.
- [ ] SALIR navega a `/juego/tetris` y no queda ningún fotograma programado.
- [ ] En `npm run dev`, con el doble montaje de Strict Mode, la pieza no cae al doble de velocidad.
- [ ] La leyenda de controles dice Mover, Rotar, Bajar, Soltar y Pausa. En ninguna pantalla aparece «Propulsar» ni «Disparar» jugando a TETRIS.
- [ ] En un viewport de 390 px con puntero grueso, los cinco botones táctiles se ven enteros y cada uno hace lo suyo.
- [ ] Mantener pulsado ◄, ► o ▼ repite la acción; mantener ⟳ o ⤓ no la repite.
- [ ] `/jugar/asteroides` se juega exactamente igual que antes de este spec.

**Marcador**

- [ ] Con sesión de cuenta, terminar una partida y guardar inserta una fila en `public.scores` con `game_id = 'tetris'` y el `user_id` de la sesión.
- [ ] El modal muestra `PUESTO #NN DE MM` y anuncia récord personal solo si se superó la marca anterior.
- [ ] `/salon?juego=tetris` muestra esa marca, y `Mejor global` y `Partidas` del Detalle dejan de estar a 0.
- [ ] Con sesión de invitado no se inserta ninguna fila y la marca aparece en TUS PARTIDAS EN ESTE NAVEGADOR.
- [ ] Sin las variables `NEXT_PUBLIC_SUPABASE_*`, `npm run build` pasa, `/jugar/tetris` es jugable, la Biblioteca muestra los diez juegos del respaldo y solo falla el guardado, con mensaje visible.

**Banco de pruebas**

- [ ] `npm run prueba:tetris` pasa y devuelve código de salida 0.
- [ ] Comprueba, como mínimo: la puntuación de una línea, la de la bajada suave y la de la caída instantánea, el fin de partida al llenarse el pozo, que `destroy()` cancela el bucle y suelta los listeners, que dos montajes seguidos dejan un solo bucle vivo, que no se emiten snapshots cuando nada cambia, y que en pausa no se simula.
- [ ] No se ejecuta como parte de `npm run build` ni de `npm run lint`.

---

## 6 — Decisiones tomadas y descartadas

**Ficha nueva `tetris`, y CAÍDA intacta.** CAÍDA ya describe Tetris con todas las letras y ponerle el motor habría ahorrado la migración y la portada. Se descarta por la misma razón que el SPEC 05 no repintó ROCAS: el juego se llama Tetris, ya está escrito, y la maqueta de CAÍDA no molesta a nadie. El coste asumido es que el catálogo tiene dos juegos de piezas que caen, y por eso la portada tiene criterio de aceptación propio.

**Lienzo de 800 × 600 con panel, no de 300 × 600.** Un lienzo vertical obligaría a que `.game-canvas` dejara de tener un aspecto fijo y lo tomara del registro, tocando CSS que hoy usa ASTEROIDES, y dejaría el marco CRT con dos franjas negras. Con 800 × 600 no se toca nada compartido y el hueco de la derecha resuelve además dónde va la vista previa, que en el original tenía su propio lienzo.

**LÍNEAS se dibuja en el lienzo; el HUD no gana una casilla.** Añadir un campo opcional al snapshot y hacer que `game-player.tsx` decida qué columnas pinta según el juego es la solución bonita, pero cambia el HUD compartido y obliga a decidir qué pasa con los otros nueve. LÍNEAS cambia pocas veces por partida y cabe en el panel que ya existe. Misma excepción que el contador `3x` de ASTEROIDES, y por el mismo motivo.

**`lives: 0`, no tres vidas de mentira.** El HUD ya pinta `—` cuando recibe cero. Enseñar tres corazones que nadie va a perder sería el mismo tipo de mentira que las puntuaciones sembradas que retiró el SPEC 06.

**La octava pieza se porta.** La «tuerca» no está documentada en el README del original, pero está en `PIECES` y sale una de cada ocho veces. La regla al portar es no cambiar lo que estaba probado: quitarla haría el juego más fácil y ya no sería el que había.

**Repetición solo en los botones táctiles.** Con teclado, mantener una flecha repite porque lo hace el sistema operativo; si el motor repitiera además, la pieza volaría. Los botones táctiles no tienen ese comportamiento y sin repetición mover la pieza al otro extremo son nueve toques. Se repite `left`, `right` y `down`, y no `thrust` ni `fire`: rotar en bucle o soltar dos veces seguidas no es lo que nadie quiere.

**El fallo de estilos es un criterio de aceptación, no una nota.** En un intento anterior una regla mal formada en `app/globals.css` dejó todo el sitio sin estilos en `npm run dev`, mientras `npm run build` pasaba. Por eso el paso 2 se verifica con el servidor de desarrollo abierto, la portada tiene prohibidos los comentarios dentro de un valor, y hay un criterio que exige que las otras nueve portadas sigan en la hoja servida.

**Banco de pruebas en Node, versionado, y no un framework de tests.** Se descartó instalar Vitest o Jest: el proyecto dice explícitamente que no tiene framework de tests, y añadir uno es una decisión que merece su propia spec. Se descartó también dejar el banco en el scratchpad: la mitad de los criterios de aceptación del juego —el doble montaje, los listeners, los snapshots— son cosas que un humano no puede comprobar mirando la pantalla, y la próxima vez que alguien toque el motor las va a querer.

**Se porta el juego, no se moderniza.** Nada de piezas retenidas, ni de la bolsa de siete, ni del sistema de rotación oficial, ni del contador de _combo_. `dropAccum` se pone a cero en vez de restarle el intervalo, igual que en el original, aunque eso pierda el sobrante entre fotogramas. Todo eso es rediseñar un juego que ya funciona.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                        | Mitigación                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una regla CSS mal formada tumba la hoja entera en desarrollo y `npm run build` no se entera. Ya ha pasado una vez.                            | El paso 2 se verifica con `npm run dev` abierto, la portada tiene prohibidos los comentarios dentro de un valor, y hay criterio de aceptación explícito sobre las otras nueve portadas. |
| La portada se confunde con la de CAÍDA en la parrilla: misma categoría, mismo tema, tarjetas contiguas.                                       | Criterio de aceptación propio: distinguirse a tamaño de tarjeta sin leer el título.                                                                                                     |
| El estado del original son globales de módulo. Copiarlas tal cual compila y solo falla con el doble montaje de Strict Mode, en desarrollo.    | Estado por instancia dentro de `createEngine`, criterio de aceptación específico, y comprobación en el banco de pruebas.                                                                |
| La fila de `public.games` y la de `FALLBACK_GAMES` se desincronizan, y el catálogo cambia según haya o no variables de entorno.               | Es el riesgo que ya anotó el SPEC 06. Los textos se copian carácter a carácter en el mismo paso, y `lib/catalog.ts` avisa por consola cuando cae al respaldo.                           |
| El banco de pruebas depende de `--experimental-strip-types` y de un cargador de alias hecho a mano: una actualización de Node puede romperlo. | Es un script suelto, no entra en `build` ni en `lint`, y si deja de arrancar no bloquea nada. Queda documentado en el §3 cómo se ejecuta.                                               |
| El `dropAccum = 0` del original pierde el sobrante entre fotogramas, así que la caída va ligeramente más lenta de lo que dice `dropInterval`. | Es el comportamiento del juego que estaba probado. Se porta tal cual y queda anotado aquí para que nadie lo «arregle» por sorpresa.                                                     |
| Cinco botones táctiles desbordan el ancho en móviles estrechos.                                                                               | `.pad-key` pasa a encogerse con un mínimo pulsable, y hay criterio de aceptación a 390 px.                                                                                              |

---

## Lo que **no** entra en este spec

ARKANOID. Poner motor a CAÍDA. Framework de tests. Banco de pruebas para ASTEROIDES. Anti-trampas. Sonido. Guardar la partida a medias. Puntuaciones de invitados en la base. Piezas retenidas, bolsa de siete y rotación SRS. Modo a dos jugadores. Borrar `references/started-games/03-tetris/`.
