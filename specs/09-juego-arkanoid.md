# SPEC 09 — ARKANOID: el tercer juego, y el primero que suena

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-08-24
> **Objetivo:** Portar el ARKANOID de `references/started-games/04-arkanoid/` a un motor TypeScript dibujado a lienzo puro, con su ficha en el catálogo, su portada, el ratón como control de la paleta y el primer audio de la plataforma, gobernado por un interruptor de sonido en el reproductor.

---

## 1 — Por qué existe este spec

La SPEC 08 cerró diciendo que ARKANOID tendría su spec y que «ahora sí debería ser solo el motor». Casi acierta.

El port en sí es el más fácil de los tres. El original son 268 líneas de `game.js` más 46 de `levels.js`, el lienzo ya es de 800 × 600 —el 4/3 que `.game-canvas` asume desde la SPEC 05— y sus tres cifras son puntuación, vidas y nivel, que son exactamente las tres casillas del HUD. Ni una sola de las dos peleas de TETRIS —la relación de aspecto y el hueco de LÍNEAS— aparece aquí.

Lo que aparece es otra cosa: **este juego trae sonido, y la plataforma no tiene audio de ninguna clase.** Las SPEC 05 y 08 lo dejaron fuera de alcance a propósito, las dos veces con la misma nota. Arkanoid sin el «clac» del rebote es la mitad del juego, así que aquí se paga: dos `mp3`, un método más en el contrato del motor, un campo más en el registro y un botón en el reproductor que recuerda si el jugador quiere silencio. Es un cambio de plataforma, y por eso tiene su propio grupo de criterios de aceptación.

Y trae una segunda cosa que tampoco existía: **el ratón**. La paleta del original se mueve con el puntero, y con flechas solo como alternativa. Es lo que hace que Arkanoid se juegue bien. La plataforma nunca ha escuchado un evento de puntero sobre el lienzo; a partir de aquí, sí.

El resto es traducir sin tocar un número.

---

## 2 — Alcance

**Dentro:**

- **Ficha nueva `arkanoid`** en `public.games` por migración, y su copia en `FALLBACK_GAMES`. Es el undécimo juego, `sort_order` 110. No sustituye a BLOQUE BUSTER.
- **Portada CSS `.cover-arkanoid`** en `app/globals.css`, con gradientes puros y distinguible de `.cover-bricks` a tamaño de miniatura.
- **Motor portado** a `lib/games/arkanoid/engine.ts`, con los cinco niveles en `lib/games/arkanoid/levels.ts`. Mismas constantes, misma física, mismas puntuaciones.
- **Dibujo a lienzo puro.** El spritesheet del original no se porta: paleta, pelota, bloques y explosiones se dibujan con rectángulos, gradientes y brillo en el estilo neón del sitio.
- **La paleta se mueve con el ratón**, con las flechas `←` `→`, y **arrastrando el dedo sobre el lienzo** en pantallas táctiles. La botonera declara `◄` y `►`.
- **Fin de partida al limpiar el nivel 5**, como el original. El lienzo se queda con el tablero vacío y el modal FIN DEL JUEGO lo abre el reproductor.
- **Contrato de audio en la plataforma:** `GameEngine` gana `setMuted(muted)`, `GameEngineEntry` gana `audio: boolean`, y `lib/preferences.ts` guarda la preferencia bajo `av_muted`.
- **Interruptor de sonido en `components/game-player.tsx`**, que solo se pinta cuando el juego declara `audio: true`.
- **Los dos sonidos del original** copiados a `public/juegos/arkanoid/`.
- **`setMuted` vacío y `audio: false`** en ASTEROIDES y TETRIS, que no suenan y no cambian ni un píxel.

**Fuera de alcance (para specs futuras):**

- **Sonido en los otros juegos.** El contrato queda montado; ponerle audio a ASTEROIDES es reabrir un motor que funciona, y eso es otro spec.
- **Música de fondo, volumen graduable o mezclador.** El interruptor es binario: suena o no suena.
- **Selector de nivel.** El original lo tenía en su overlay de pausa. Saltar al nivel 5 en un juego con marcador es hacer trampa.
- **Carteles en el lienzo.** Ni `PAUSA`, ni `GAME OVER`, ni «¡Completaste el juego!». Los pinta React, como en los otros dos motores.
- **Bucle infinito de niveles.** Se limpia el 5 y se acaba. El techo de puntuación queda documentado en el §6.
- **Rediseñar la física.** Ni ángulo de rebote según el punto de impacto, ni colisión por eje, ni potenciadores, ni pelotas múltiples, ni bloques de varios golpes.
- **Banco de pruebas.** La infraestructura de `scripts/` está y se puede reutilizar cuando haga falta; aquí no se escribe ninguna.
- **Ponerle motor a BLOQUE BUSTER.** Se queda con su maqueta y su puntuación simulada, igual que ROCAS y CAÍDA.
- **Anti-trampas.** Sin cambios respecto a las SPEC 05 y 08.
- **Guardar la partida a medias.** Cerrar la pestaña pierde el tablero.
- **Borrar `references/started-games/04-arkanoid/`.** Se queda como referencia, spritesheet incluido.

---

## 3 — Modelo de datos

### La fila del catálogo

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('arkanoid', 'ARKANOID', …, 'ARCADE', 'cover-arkanoid', 'yellow', 110);
```

`sort_order` 110 es el siguiente múltiplo de diez libre. `cat` y `color` son valores que ya admiten los `check` del SPEC 06, así que no hace falta tocar ninguna restricción. `color: 'yellow'` y no `cyan` para que el botón JUGAR no sea idéntico al de BLOQUE BUSTER, que está en la misma categoría y describe lo mismo.

Textos propuestos:

- **`short`:** «Rompe los cinco muros antes de quedarte sin pelotas.»
- **`long`:** «Una paleta, una pelota y cinco muros de bloques que no se parecen en nada entre sí: una parrilla, una pirámide, un tablero de ajedrez, filas con huecos y un marco cruzado. Cada nivel lanza la pelota un diez por ciento más rápido que el anterior. Tienes tres vidas para llegar al final.»

La misma entrada, con los mismos textos carácter a carácter, se añade a `FALLBACK_GAMES` en `lib/games.ts`.

**No hay ningún otro cambio de esquema.** El marcador está indexado por `game_id` desde el SPEC 06: funciona en cuanto existe la fila. `lib/database.types.ts` no se regenera, porque insertar filas no cambia el esquema. `MAX_SCORE` tampoco se toca: la partida perfecta son 3.000 puntos, cuatro órdenes de magnitud por debajo del tope.

### Los niveles — `lib/games/arkanoid/levels.ts`

Traducción literal de `levels.js`, con los generadores tal cual: la parrilla completa, la pirámide de `pyStart`/`pyEnd`, el tablero de ajedrez por `(col + row) % 2`, las filas con los huecos de `gaps4` y el marco con la cruz central. Y las cinco velocidades, sin redondear:

```ts
export const LEVELS: Level[] = [
  { speed: 1.0, blocks: l1 },
  { speed: 1.1, blocks: l2 },
  { speed: 1.21, blocks: l3 },
  { speed: 1.33, blocks: l4 },
  { speed: 1.46, blocks: l5 },
];
```

El fichero exporta también la paleta de colores, que es lo único que cambia respecto al original: donde había siete recortes de un `png`, hay siete valores. Los nombres se conservan porque son los que usan los generadores de niveles:

```ts
export const BLOCK_COLORS: Record<BlockColor, string> = {
  red: "#ff3860",
  yellow: "#f5ff00",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  hotpink: "#ff5fd2",
  green: "#00ff88",
  gray: "#8891a8",
};
```

### El motor — `lib/games/arkanoid/engine.ts`

Constantes portadas sin tocar un número:

| Constante                       | Valor                                              |
| ------------------------------- | -------------------------------------------------- |
| Lienzo                          | 800 × 600                                          |
| `PADDLE_SPEED`                  | 400 px/s                                           |
| Paleta                          | 81 × 14, a `y = 560`                               |
| Pelota                          | 16 × 16                                            |
| `BASE_BALL_VX` / `BASE_BALL_VY` | 200 / −300, multiplicados por el `speed` del nivel |
| Rejilla                         | 10 × 6 bloques de 64 × 24                          |
| Origen de la rejilla            | `x = 80`, `y = 80`                                 |
| Vidas                           | 3                                                  |
| Puntos por bloque               | 10                                                 |
| `EXPLOSION_DURATION`            | 150 ms, en cuatro pasos                            |

La explosión se recrea sin sprites: el rectángulo del bloque roto crece y se desvanece en los mismos 150 ms, cuantizado en los mismos cuatro pasos, para que la animación se lea igual que la original.

**Lo que se quita del original:**

- El HUD dibujado en el lienzo (puntuación, nivel y las pelotitas de las vidas). Lo pinta la plataforma.
- Los carteles `GAME OVER` y «¡Completaste el juego!».
- El overlay de pausa entero, con sus botones 1–5 y su `click` de salto de nivel.
- La tecla `P` / `Escape`: la engancha `game-canvas.tsx` y es igual para todos.
- `loadSpritesheet` y los dos ficheros de `assets/`.

**Lo que se añade, y que el original no necesitaba:**

- Todo el estado dentro de `createEngine`. Ningún global de módulo.
- `dt` capado a 0,05 s.
- `onSnapshot` solo cuando cambia de verdad `score`, `lives`, `level` o `status`.
- `restart`, `finish` y un `destroy` idempotente que cancela el `requestAnimationFrame` y suelta **todos** los listeners: teclado, puntero y el `pointermove` del lienzo.
- `canvas.style.touchAction = "none"` al montar, restaurado en `destroy`. Sin eso, arrastrar el dedo sobre el lienzo desplaza la página. Se pone desde el motor y no en `.game-canvas` para no cambiarle el comportamiento a los otros dos juegos.

### El snapshot

```ts
{
  (score, lives, level, status);
}
```

Directo, sin traducciones: `level` es el nivel 1–5 del original y `lives` son las tres vidas. Es el primer juego en el que el HUD de la plataforma encaja entero sin negociar.

### Los controles declarados

```ts
audio: true,
keys: [
  { keys: ["◄", "►"], label: "Mover la paleta" },
  { keys: ["Ratón"], label: "Mover la paleta" },
],
touch: [
  [{ action: "left",  glyph: "◄", label: "Mover a la izquierda", tone: "cyan" }],
  [{ action: "right", glyph: "►", label: "Mover a la derecha",   tone: "cyan" }],
],
```

Dos botones, uno en cada grupo: `.game-touch` reparte con `space-between`, así que cada pulgar cae sobre el suyo. Es el reparto que mejor se ajusta a una paleta, y no hace falta tocar `.pad-key`.

`Ratón` no es una tecla y va igualmente en la leyenda: `KeyHint.keys` son glifos de presentación —lo dice el tipo desde la SPEC 07—, y el jugador tiene que enterarse de que puede usar el puntero, que es como se juega bien.

### El contrato de audio — `lib/games/engine.ts` y `lib/games/registry.ts`

```ts
export type GameEngine = {
  …
  /** Silencia o devuelve el sonido. Los juegos mudos lo implementan vacío. */
  setMuted: (muted: boolean) => void;
  …
};
```

```ts
export type GameEngineEntry = {
  …
  /** True si el juego produce sonido. Solo entonces se pinta el interruptor. */
  audio: boolean;
  …
};
```

Los dos son **obligatorios**, por el mismo motivo que `keys` y `touch` lo son desde la SPEC 07: un juego que declara audio y no responde al interruptor deja un botón muerto que solo se descubre jugando. `ASTEROIDES` y `TETRIS` reciben `audio: false` y un `setMuted: () => {}` con su comentario de una línea.

El reproductor no le pasa el estado inicial al motor por `CreateEngineOptions`: se lo dice en `onReady`, que es donde ya se le dice si la partida nació pausada.

### La preferencia — `lib/preferences.ts`

```ts
export const MUTED_KEY = "av_muted";
export function readMuted(): boolean;
export function writeMuted(muted: boolean): void;
```

Fichero nuevo, con el mismo patrón de `try`/`catch` que `lib/session.ts` para el caso de `localStorage` lleno o bloqueado, y la misma familia de claves `av_*`. Valor `"1"` para silenciado; cualquier otra cosa, incluida su ausencia, es **suena**.

**Se lee después de montar, en un efecto, nunca durante el render.** Leerlo en el render inicial haría que el servidor y el cliente pintasen botones distintos. Es la misma precaución que ya toma `components/local-scores.tsx`.

### El interruptor en el HUD

Un cuarto botón en `.hud-actions`, delante de PAUSA:

```tsx
{
  entry?.audio && (
    <button type="button" className="btn ghost" aria-pressed={muted} onClick={toggleMuted}>
      {muted ? "SILENCIO" : "SONIDO"}
    </button>
  );
}
```

Texto y no icono: la tira de botones es de tipografía de píxel y un emoji de altavoz desentonaría. `aria-pressed` para que un lector de pantalla sepa en qué estado está.

`.hud-actions` gana **una sola declaración**, `flex-wrap: wrap`, para que el cuarto botón no desborde en pantallas estrechas. Con tres botones no cambia nada, así que los otros diez juegos se ven igual.

### Los sonidos — `public/juegos/arkanoid/`

`ball-bounce.mp3` (10 KB) y `break-sound.mp3` (8 KB), copiados de `references/started-games/04-arkanoid/assets/sounds/`. El `.DS_Store` de esa carpeta no se copia.

El original hace `sonido.cloneNode().play()` en cada golpe, para que dos rebotes seguidos se solapen en vez de cortarse. Se porta tal cual, con dos cambios que no alteran ningún número:

- **La promesa de `play()` se recoge con un `catch` vacío.** El navegador rechaza la reproducción mientras no haya habido interacción del usuario, y la pelota sale disparada nada más cargar: sin el `catch`, la consola se llena de promesas rechazadas en cada partida.
- **No se reproduce nada si el motor está silenciado o ya destruido.**

---

## 4 — Plan de implementación

Cada paso deja la aplicación compilando y navegable.

1. **La ficha.** Migración `add_game_arkanoid` con el `insert`, aplicada por MCP **y** versionada en `supabase/migrations/`. Añadir la misma entrada a `FALLBACK_GAMES`. _Verificable:_ `/juego/arkanoid` abre con su Detalle, la tarjeta sale en la Biblioteca sin portada propia todavía, `/salon` tiene su pestaña, y `Mejor global` y `Partidas` están a 0.

2. **La portada.** `.cover-arkanoid` en `app/globals.css`, con gradientes puros y en el estilo de las otras diez. **Diseñarla con `/frontend-design`**, como exige `CLAUDE.md`, y **verificarla con `npm run dev` abierto, no solo con `npm run build`.** _Verificable:_ la tarjeta de ARKANOID tiene portada propia, se distingue de la de BLOQUE BUSTER de un vistazo, y el resto del sitio sigue con sus estilos.

3. **Los niveles.** `lib/games/arkanoid/levels.ts` con los cinco generadores, las cinco velocidades y la paleta de colores. _Verificable:_ `npx tsc --noEmit` pasa; nada ha cambiado en la pantalla porque todavía nadie lo importa.

4. **El motor, sin sonido.** `lib/games/arkanoid/engine.ts` con `createEngine`: estado por instancia, paleta con teclado y con ratón, física de la pelota, rebotes, colisión con bloques, explosiones, vidas, cambio de nivel, fin al limpiar el 5 y dibujo completo. Registrar la entrada en `GAME_ENGINES` con sus controles y `audio: false` de momento. _Verificable:_ `/jugar/arkanoid` es jugable con teclado y con ratón, el HUD sube de 10 en 10, las vidas bajan al perder la pelota, el nivel sube al limpiar el muro y limpiar el quinto abre el modal FIN DEL JUEGO con el tablero vacío detrás.

5. **El táctil.** `touchAction` en el motor y arrastre del dedo sobre el lienzo, además de los dos botones de la botonera. _Verificable:_ en un viewport de 390 px con puntero grueso, arrastrar sobre el lienzo mueve la paleta y no desplaza la página; los dos botones se ven enteros, uno a cada lado.

6. **El contrato de audio.** `setMuted` en `GameEngine`, `audio` en `GameEngineEntry`, los no-ops de ASTEROIDES y TETRIS, `lib/preferences.ts` y el botón en `game-player.tsx` con el `flex-wrap` de `.hud-actions`. _Verificable:_ `npx tsc --noEmit` pasa, añadir una entrada sin `audio` no compila, y ni ASTEROIDES ni TETRIS enseñan el botón nuevo ni cambian en nada.

7. **El sonido.** Copiar los dos `mp3` a `public/juegos/arkanoid/`, reproducirlos en el rebote y en la rotura, atender a `setMuted` y poner `audio: true` en el registro. _Verificable:_ ARKANOID suena, el botón SONIDO lo calla, y recargar la página lo encuentra como se dejó.

---

## 5 — Criterios de aceptación

**Catálogo**

- [ ] `public.games` tiene once filas y la undécima es `arkanoid`, con `sort_order` 110 y `cover = 'cover-arkanoid'`.
- [ ] La migración está versionada en `supabase/migrations/` además de aplicada, y `get_advisors` de seguridad no reporta ningún aviso nuevo.
- [ ] `FALLBACK_GAMES` tiene la misma entrada, con `id`, `title`, `short`, `long`, `cat`, `cover` y `color` idénticos carácter a carácter a los de la migración.
- [ ] La tarjeta de ARKANOID aparece en la Biblioteca, el buscador la encuentra escribiendo «arkanoid» y el filtro ARCADE la muestra junto a BLOQUE BUSTER.
- [ ] `/juego/arkanoid` abre y su botón JUGAR lleva a `/jugar/arkanoid`.
- [ ] BLOQUE BUSTER sigue en el catálogo, con su portada `cover-bricks`, y `/jugar/bloque-buster` sigue mostrando la arena decorativa y la puntuación simulada.

**Estilos**

- [ ] Con `npm run dev` corriendo, la Landing, la Biblioteca, el Detalle y el reproductor se ven **exactamente igual** que antes de este spec salvo por la tarjeta nueva y el botón de sonido.
- [ ] La portada de ARKANOID se distingue de la de BLOQUE BUSTER a tamaño de tarjeta, sin leer el título.
- [ ] `.cover-arkanoid` usa solo gradientes: ni `url()`, ni SVG embebido, ni imágenes.
- [ ] Ninguna declaración nueva de `app/globals.css` lleva comentarios intercalados dentro del valor.
- [ ] `npm run build` pasa, y la hoja de estilos que sirve `npm run dev` contiene las reglas de las otras diez portadas.

**El juego**

- [ ] En `/jugar/arkanoid` se ven la paleta, la pelota y los sesenta bloques del nivel 1 dentro del marco CRT, sin barra de scroll horizontal en un viewport de 1280 px ni en uno de 390 px.
- [ ] Mover el ratón sobre el lienzo mueve la paleta, y la paleta queda centrada en el puntero también cuando la ventana está a un tamaño distinto del lienzo lógico.
- [ ] `←` y `→` mueven la paleta, y la paleta no se sale por ninguno de los dos bordes.
- [ ] Arrastrar el dedo sobre el lienzo mueve la paleta y **no** desplaza la página.
- [ ] La pelota rebota en las tres paredes y en la paleta, y romper un bloque suma 10 puntos.
- [ ] Cada bloque roto deja la explosión, que dura 150 ms y desaparece sola.
- [ ] Que la pelota caiga por abajo descuenta una vida, deja los bloques como estaban y relanza la pelota desde la paleta.
- [ ] Perder la tercera vida abre el modal FIN DEL JUEGO con la puntuación real.
- [ ] Limpiar un muro carga el siguiente, sube el `Nivel` del HUD y la pelota va más rápida.
- [ ] Los cinco muros son los del original: parrilla, pirámide, ajedrez, filas con huecos y marco con cruz.
- [ ] Limpiar el quinto muro termina la partida y abre el modal, con el tablero vacío visible detrás.
- [ ] El lienzo **no** dibuja puntuación, ni vidas, ni nivel, ni ningún cartel de `PAUSA`, `GAME OVER` o victoria.
- [ ] `Espacio` no reinicia nada, y no hay ningún selector de nivel en ninguna parte.

**El sonido**

- [ ] Rebotar suena y romper un bloque suena distinto.
- [ ] Dos golpes seguidos se solapan: el segundo no corta al primero.
- [ ] El botón SONIDO aparece en `/jugar/arkanoid` y **no** aparece en `/jugar/asteroides`, `/jugar/tetris` ni en ningún juego sin motor.
- [ ] Pulsarlo pasa a SILENCIO y el juego deja de sonar en el acto, sin cortar la partida.
- [ ] Recargar la página, o entrar a otro juego con audio, encuentra la preferencia como se dejó.
- [ ] Con `localStorage` bloqueado el reproductor no se rompe: el juego suena y el botón funciona hasta recargar.
- [ ] La consola no muestra ninguna promesa rechazada al empezar una partida antes de tocar nada.
- [ ] En pausa no suena nada.
- [ ] Los cuatro botones del HUD se ven enteros en un viewport de 390 px, sin desbordar ni solapar.

**Contrato**

- [ ] `GameEngine` declara `setMuted` y `GameEngineEntry` declara `audio`, los dos obligatorios.
- [ ] Añadir una entrada a `GAME_ENGINES` sin `audio` no compila; devolver un motor sin `setMuted` tampoco.
- [ ] `lib/preferences.ts` exporta `MUTED_KEY`, `readMuted` y `writeMuted`, y no lanza si `localStorage` no está disponible.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.

**Integración con el reproductor**

- [ ] PAUSA congela el juego y muestra EN PAUSA; la pelota no se mueve y **la paleta tampoco responde al ratón** mientras tanto; REANUDAR la deja donde estaba.
- [ ] `P` y `Escape` alternan la pausa, y cambiar de pestaña y volver encuentra el juego pausado.
- [ ] Pulsar las flechas mientras se juega no desplaza la página.
- [ ] Escribir en el campo de iniciales del modal no mueve la paleta.
- [ ] JUGAR DE NUEVO reinicia desde cero: puntuación 0, tres vidas, nivel 1 y el primer muro entero.
- [ ] El botón FIN termina la partida con la puntuación acumulada.
- [ ] SALIR navega a `/juego/arkanoid` y no queda ningún fotograma programado ni ningún listener de puntero vivo.
- [ ] En `npm run dev`, con el doble montaje de Strict Mode, la pelota no va al doble de velocidad ni suena dos veces cada rebote.
- [ ] La leyenda de controles dice Mover la paleta, Ratón y Pausa. En ninguna pantalla aparece «Propulsar», «Disparar», «Rotar» ni «Soltar» jugando a ARKANOID.
- [ ] `/jugar/asteroides` y `/jugar/tetris` se juegan exactamente igual que antes de este spec.

**Marcador**

- [ ] Con sesión de cuenta, terminar una partida y guardar inserta una fila en `public.scores` con `game_id = 'arkanoid'` y el `user_id` de la sesión.
- [ ] El modal muestra `PUESTO #NN DE MM` y anuncia récord personal solo si se superó la marca anterior.
- [ ] `/salon?juego=arkanoid` muestra esa marca, y `Mejor global` y `Partidas` del Detalle dejan de estar a 0.
- [ ] Con sesión de invitado no se inserta ninguna fila y la marca aparece en TUS PARTIDAS EN ESTE NAVEGADOR.
- [ ] Sin las variables `NEXT_PUBLIC_SUPABASE_*`, `npm run build` pasa, `/jugar/arkanoid` es jugable, la Biblioteca muestra los once juegos del respaldo y solo falla el guardado, con mensaje visible.

---

## 6 — Decisiones tomadas y descartadas

**Ficha nueva `arkanoid`, y BLOQUE BUSTER intacto.** BLOQUE BUSTER ya describe este juego —«Rebota la pelota y destruye muros de neón»— y ponerle el motor habría ahorrado la migración y la portada. Se descarta por tercera vez consecutiva y por el mismo motivo que en las SPEC 05 y 08: el juego se llama Arkanoid, ya está escrito, y las maquetas no molestan a nadie. El coste asumido es que el catálogo tiene ahora tres pares de gemelos, y por eso la portada y el color del botón tienen criterio propio.

**La partida acaba al limpiar el nivel 5.** Se valoró encadenar los niveles en bucle acelerando, que es lo que daría un marcador con recorrido. Se descarta: el juego que está probado tiene cinco niveles y un final, y convertirlo en infinito es rediseñarlo, no portarlo. **El precio está aceptado y es alto: la partida perfecta son 3.000 puntos y el marcador de ARKANOID se llenará de empates arriba**, midiendo quién llegó al final y no quién jugó mejor. Si eso molesta, la solución es un spec de bucle infinito, no un parche aquí.

**Dibujo a lienzo puro, sin spritesheet.** Portar `spritesheet-breakout.png` habría dado el pixel-art exacto del original, explosiones incluidas. Se descarta por tres razones: sería el primer binario de un motor, obligaría a esperar una carga asíncrona antes del primer fotograma —con su estado de «cargando» que hoy no existe— y el pixel-art choca con el neón del resto del sitio. La explosión de cuatro fotogramas se recrea con escala y opacidad en los mismos 150 ms.

**El sonido entra, y trae contrato.** Es la tercera vez que aparece el tema y las dos anteriores se aplazó. Arkanoid sin el rebote es la mitad del juego, así que aquí se hace: pero se hace entero —interruptor, preferencia recordada, `audio` en el registro— y no como un `Audio` suelto dentro del motor. La alternativa barata, que el juego suene sin forma de callarlo, se descarta: es hostil, y el navegador no ofrece más remedio que silenciar la pestaña entera.

**El interruptor solo se pinta si el juego declara audio.** Un botón de sonido en los diez juegos mudos sería un control que no hace nada, que es exactamente el tipo de mentira que la SPEC 07 existió para quitar. `audio` y `setMuted` son obligatorios para que el compilador obligue a decidirlo al añadir un juego.

**El rebote plano y la colisión por vertical se portan tal cual.** En el original la paleta solo invierte `vy` y `vx` no cambia nunca, así que el jugador no puede dirigir la pelota; y un bloque golpeado de lado también invierte la vertical, lo que hace que una pelota que entra por el lateral recorra la fila entera. Las dos cosas son rarezas, y las dos se quedan: son las que producen las rachas largas y el equilibrio de los cinco niveles. Corregirlas es reequilibrar un juego probado.

**El ratón entra, y en pausa no.** El original mueve la paleta con `mousemove` pase lo que pase. Aquí, con pausa de plataforma, mover el ratón sobre un juego pausado movería la paleta bajo el cartel EN PAUSA. En pausa no se simula nada, y eso incluye el puntero.

**`touchAction` lo pone el motor, no `.game-canvas`.** Ponerlo en la clase compartida se lo aplicaría también a ASTEROIDES y TETRIS, que no arrastran nada y sí quieren que la página se pueda desplazar con el dedo desde encima del lienzo.

**Sin banco de pruebas.** La SPEC 08 lo escribió porque el port de Tetris tenía reglas —puntuaciones por tipo de línea, saltos de pared— que no se ven jugando. Aquí casi todo se ve: una vida perdida, un muro limpiado, un nivel más rápido. Se asume el riesgo de que el doble montaje y los listeners haya que comprobarlos a mano, y queda anotado abajo.

**El selector de nivel del original no se porta.** Era una herramienta de desarrollo dentro del overlay de pausa. En un juego con marcador es una forma de empezar en el nivel 5, y además el overlay de pausa ahora es de React.

**Se porta el juego, no se moderniza.** Ni potenciadores, ni pelota pegada esperando lanzamiento, ni bloques de varios golpes, ni pelotas múltiples. Nada de eso estaba.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                   | Mitigación                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El techo de 3.000 puntos deja el marcador de ARKANOID lleno de empates, que es lo contrario de lo que promete la Landing.                                                | Es una decisión tomada a sabiendas, documentada en el §6. Si molesta, el arreglo es un spec de bucle infinito, no un cambio de última hora en el reparto de puntos.                                 |
| El rebote plano puede meter la pelota en un carril vertical que no rompe nada y alarga el nivel indefinidamente.                                                         | Mover la paleta lo desatasca, porque el punto de rebote sí depende de dónde esté. Queda anotado para que nadie lo «arregle» creyendo que es un fallo del port.                                      |
| Una regla CSS mal formada tumba la hoja entera en desarrollo y `npm run build` no se entera. Ya pasó una vez antes de la SPEC 08.                                        | El paso 2 se verifica con `npm run dev` abierto, la portada tiene prohibidos los comentarios dentro de un valor, y hay criterio de aceptación explícito sobre las otras diez portadas.              |
| La portada se confunde con la de BLOQUE BUSTER en la parrilla: misma categoría y mismo tema.                                                                             | Criterio de aceptación propio, `color: 'yellow'` frente al `cyan` del vecino, y diseño con `/frontend-design`.                                                                                      |
| El estado del original son globales de módulo. Copiarlas tal cual compila y solo falla con el doble montaje de Strict Mode, en desarrollo — y aquí además sonaría doble. | Estado por instancia dentro de `createEngine`, y criterio de aceptación específico sobre la velocidad **y** sobre el sonido duplicado. Sin banco de pruebas, hay que comprobarlo a mano.            |
| Los listeners de puntero sobre el lienzo se quedan vivos tras navegar y siguen moviendo una paleta que ya no existe.                                                     | `destroy()` los quita todos y es idempotente; hay criterio de aceptación al salir del reproductor.                                                                                                  |
| El navegador rechaza `play()` mientras no haya habido interacción, y la pelota sale disparada al cargar.                                                                 | La promesa se recoge con un `catch` vacío y hay criterio de aceptación sobre la consola limpia. El primer sonido audible llega en cuanto el jugador toca cualquier cosa, que es a los dos segundos. |
| `cloneNode().play()` crea un elemento de audio por golpe y el navegador los va acumulando durante una partida larga.                                                     | Es lo que hacía el original y lo que permite que dos golpes se solapen. Los clones son de usar y tirar; queda anotado por si alguna vez aparece en un perfilado.                                    |
| La fila de `public.games` y la de `FALLBACK_GAMES` se desincronizan, y el catálogo cambia según haya o no variables de entorno.                                          | Es el riesgo que ya anotó el SPEC 06. Los textos se copian carácter a carácter en el mismo paso, y `lib/catalog.ts` avisa por consola cuando cae al respaldo.                                       |
| El cuarto botón del HUD desborda en pantallas estrechas.                                                                                                                 | `.hud-actions` gana `flex-wrap: wrap` —una declaración, sin efecto con tres botones— y hay criterio de aceptación a 390 px.                                                                         |

---

## Lo que **no** entra en este spec

Sonido en los otros juegos. Música ni volumen graduable. Selector de nivel. Carteles en el lienzo. Bucle infinito de niveles. Ángulo de rebote, colisión por eje, potenciadores, pelotas múltiples y bloques de varios golpes. Banco de pruebas. Ponerle motor a BLOQUE BUSTER. Anti-trampas. Guardar la partida a medias. Borrar `references/started-games/04-arkanoid/`.
