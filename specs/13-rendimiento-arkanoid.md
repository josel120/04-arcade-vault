# SPEC 13 — Rendimiento de ARKANOID: gradientes y `shadowBlur` por fotograma

> **Estado:** Draft
> **Depende de:** SPEC 09 (motor de ARKANOID)
> **Fecha:** 2026-08-25
> **Objetivo:** Medir y documentar, sin implementar, los costes de fotograma reales de `lib/games/arkanoid/engine.ts` para que un `/spec-impl` posterior los reduzca sin tocar el contrato de la plataforma ni la física del juego.

---

## 1 — Por qué existe este spec

Este spec **no implementa nada**: es la auditoría de rendimiento de un solo motor, `arkanoid`, hecha por un agente que solo lee código y mide con Playwright, nunca edita. El motor en sí no ha cambiado desde la SPEC 09 — sigue siendo el mismo `createEngine` de 488 líneas —, pero nadie había medido todavía cuánto cuesta su `update`+`draw` fotograma a fotograma, ni había puesto números concretos a los gradientes y al `shadowBlur` que se recrean sesenta veces por segundo.

El alcance de esta pasada es **exclusivamente ARKANOID**. Otros cuatro motores (`asteroides`, `tetris`, `vibora`, `frogger`) se están auditando en paralelo, cada uno con su propio spec de salida; este documento no dice nada sobre ellos y no debe fusionarse con los suyos sin revisión.

---

## 2 — Alcance

**Dentro:**

- El motor `lib/games/arkanoid/engine.ts`: sus funciones `drawPaddle`, `drawBall`, `drawBlock`, `drawExplosion`, `draw`, `update` y el manejo de `explosions`.
- La medición de FPS reales de `/jugar/arkanoid` con Playwright, y su comparación con una medición de control en el mismo entorno.
- Documentar el hallazgo de audio (`cloneNode` por golpe) ya anotado como riesgo aceptado en la SPEC 09 §7, confirmando si sigue vigente tal cual.

**Fuera de alcance (para specs futuros o para este mismo spec una vez `Approved`):**

- Cualquier cambio a `lib/games/engine.ts` o `lib/games/registry.ts` — el contrato de plataforma no se toca.
- Los otros cuatro motores con motor real (`asteroides`, `tetris`, `vibora`, `frogger`) y los siete juegos sin motor propio.
- Implementar cualquiera de las optimizaciones descritas aquí: eso lo hace `/spec-impl` cuando este documento pase a `Approved`, lanzado por el usuario.
- Rediseñar la física, los niveles, el HUD o el contrato de audio de ARKANOID — nada de eso está roto ni es objeto de este spec.
- Introducir `object pooling` genérico para las explosiones: el array tiene como máximo unos pocos elementos vivos 150 ms cada uno; no hay evidencia de que necesite una estructura de reciclaje.

---

## 3 — Modelo de datos

Este spec no introduce estructuras de datos nuevas. Reutiliza el contrato de la plataforma (`GameEngine`, `GameSnapshot` en `lib/games/engine.ts`) y el estado ya existente del motor de ARKANOID (`paddle`, `ball`, `blocks`, `explosions`). Las optimizaciones que plantea son de **caché de valores derivados** (un gradiente, un sprite pre-renderizado), no de un modelo de datos nuevo.

---

## 4 — Hallazgos de la auditoría estática (Paso 1)

Todos localizados en `lib/games/arkanoid/engine.ts`, revisado en su versión actual (488 líneas):

1. **Gradiente lineal de la paleta recreado cada frame sin necesidad.** `drawPaddle()`, línea 369: `ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h)`, llamada una vez por frame desde `draw()` (línea 408, invocado desde el bucle `loop()` en línea 428 vía `requestAnimationFrame`). Los cuatro parámetros son constantes durante toda la partida: `paddle.y` es siempre `PADDLE_Y = 560` (línea 57) y `paddle.h = PADDLE_H = 14` (línea 56); solo `paddle.x` varía al mover la paleta, y no participa en este gradiente vertical. Es una asignación de objeto (`CanvasGradient`) nueva, 60 veces por segundo, para un resultado que no cambia nunca.

2. **Gradiente radial de la pelota recreado cada frame.** `drawBall()`, línea 386: `ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r)`. A diferencia del anterior, sus parámetros sí dependen de `cx`/`cy` (centro de la pelota), que cambian cada frame porque la pelota está en movimiento constante. No es cacheable en el sitio tal cual está escrito, pero sí es evitable pre-renderizando el sprite de la pelota una sola vez (relativo a su propio centro) y componiéndolo cada frame con `drawImage` en la posición absoluta.

3. **`shadowBlur`/`shadowColor` activados y apagados dos veces por frame.** `drawPaddle()` líneas 374-378 y `drawBall()` líneas 390-396: cada una fija `ctx.shadowColor`, `ctx.shadowBlur = 12` o `14`, dibuja, y vuelve a poner `ctx.shadowBlur = 0`. Es una de las operaciones más caras del canvas 2D — el propio navegador tiene que recalcular un desenfoque de píxeles en cada llamada — y aquí se paga sin condición alguna, se mueva o no la pelota o la paleta, en cada uno de los ~60 fotogramas por segundo.

4. **`explosions.filter()` se ejecuta todos los frames, tenga o no elementos.** Línea 322: `explosions = explosions.filter((explosion) => explosion.elapsed < EXPLOSION_DURATION);`, incondicional dentro de `update()`. Una explosión dura 150 ms (`EXPLOSION_DURATION`), así que durante la inmensa mayoría de la partida `explosions.length === 0` y esta línea sigue reconstruyendo un array vacío en cada fotograma. El coste por llamada es bajo, pero es una asignación evitable con una guarda `if (explosions.length)`.

5. **Bucle de colisión bloque-a-bloque, tamaño acotado.** Líneas 296-319: recorre hasta 60 bloques (`BLOCK_COLS = 10` × 6 filas) por frame con `for...of` y `break` al primer impacto — no es cuadrático porque solo hay una pelota. Al limpiar el último bloque de un muro se ejecuta además `blocks.every((other) => !other.alive)` (línea 313), otro recorrido de hasta 60 elementos, pero solo en el fotograma exacto en que eso ocurre. **No se marca como hallazgo que requiera acción**: el array es de tamaño fijo y pequeño, y no hay evidencia de que sea un cuello de botella medible.

6. **Audio: `cloneNode()` sin pool, ya documentado.** Líneas 139-146 (`function play`): cada rebote o rotura clona `bounce`/`broken` con `cloneNode()` y no los reutiliza. Esto **ya está anotado como riesgo aceptado en la SPEC 09 §7** («`cloneNode().play()` crea un elemento de audio por golpe... queda anotado por si alguna vez aparece en un perfilado»). Se confirma que sigue exactamente igual. El volumen de clones por segundo está acotado por la tasa de colisiones (máximo un par de sonidos por fotograma en el peor caso, normalmente menos), no por el framerate, así que no se trata como una regresión nueva de esta auditoría — ver decisión en el §6.

No se encontró ningún `new Particle`/`new Bullet` por disparo (ARKANOID no dispara nada), ninguna reconstrucción de `blocks` con `.filter()` (usa `for...of` con `continue`, correcto), ningún patrón (`createPattern`) ni ninguna construcción de cadenas de color repetida por frame.

---

## 5 — Medición de FPS reales (Paso 2)

**Método:** con el sitio ya levantado (`npm run dev`, puerto 3000 — ver limitación de entorno abajo), se navegó a `http://localhost:3000/jugar/arkanoid` con Playwright y se inyectó con `browser_evaluate` un muestreador de `requestAnimationFrame` que acumula el delta entre timestamps consecutivos durante una ventana fija, sin ninguna interacción del jugador — la pelota y la paleta base ya generan trabajo de `update`+`draw` constante. Se calculó el frame time medio, el máximo, y el porcentaje de frames por encima de 16.7 ms (por debajo de 60 fps) y de 33 ms (por debajo de 30 fps).

| Medición                                        | Ventana | Muestras | Frame time medio | Frame time máx. | % frames > 16.7 ms | % frames > 33 ms |
| ----------------------------------------------- | ------- | -------- | ---------------- | --------------- | ------------------ | ---------------- |
| A — `/jugar/arkanoid`                           | 8 s     | 412      | **19.46 ms**     | 33.6 ms         | 50.24 %            | 16.75 %          |
| B — `/jugar/arkanoid`                           | 3 s     | 177      | **17.04 ms**     | 50.0 ms         | 38.98 %            | —                |
| Control — `about:blank` (mismo entorno cargado) | 6 s     | 292      | **16.93 ms**     | 99.9 ms         | 33.22 %            | 0.34 %           |

**Consola:** sin errores nuevos atribuibles al motor. Se observó un `[ERROR]` de React repetido — _"Encountered two children with the same key... Mover la paleta"_ — causado por que `lib/games/registry.ts` declara dos entradas de leyenda con el mismo `label: "Mover la paleta"` (líneas 120 y 124: una para `["◄", "►"]` y otra para `["Ratón"]`). Es un bug de renderizado en la leyenda de controles, **no un problema de rendimiento del lienzo**, y vive fuera de `lib/games/arkanoid/engine.ts`; se deja anotado aquí para que quien revise este spec decida si merece un spec propio, pero no forma parte de los criterios de aceptación de éste.

### Limitación honesta: entorno con contención severa, no aislado

Dos limitaciones, una esperada y otra que apareció durante la medición:

1. **La esperada:** el muestreador mide el coste base del motor con la pelota en movimiento automático, sin simular una partida jugada con los 60 bloques vivos, las explosiones activas o el jugador moviendo la paleta a la vez. Es el coste de fondo, no el pico bajo estrés.
2. **La inesperada, y más relevante para leer la tabla de arriba:** esta pasada se ejecutó **en paralelo con otros cuatro agentes** auditando `asteroides`, `tetris`, `vibora` y `frogger` en la misma máquina — cada uno con su propio `npm run dev` y su propia sesión de Chromium — y además se descubrió que **la pestaña de Playwright estaba compartida** entre agentes: varios intentos de muestreo se interrumpieron a mitad de camino con `Execution context was destroyed, most likely because of a navigation` porque otro agente navegó la misma pestaña a `/jugar/tetris` o `/jugar/frogger` mientras el muestreador de éste corría. La medición de control contra `about:blank` (16.93 ms de media, 33 % de frames por encima de 16.7 ms **sin ningún canvas dibujando nada**) confirma que buena parte del ruido de la tabla es contención de CPU del entorno, no coste propio de ARKANOID. La diferencia entre ARKANOID (17.0–19.5 ms) y el control (16.9 ms) es real pero modesta; el §5 de más abajo pide una re-medición aislada como parte de la verificación.

---

## 6 — Plan de implementación (para el `/spec-impl` que apruebe este documento)

Cada paso deja el motor compilando y jugable.

1. **Cachear el gradiente lineal de la paleta.** Construirlo una sola vez (por ejemplo, al crear el motor o la primera vez que se llama a `drawPaddle`) y reutilizarlo en cada frame, en vez de llamar a `ctx.createLinearGradient` dentro de `drawPaddle()`. Como `paddle.y`/`paddle.h` no cambian hoy, no hace falta invalidación; dejar un comentario explicando por qué es seguro cachearlo sin comprobar esos valores. _Verificable:_ la paleta se ve pixel por pixel igual que antes; `npx tsc --noEmit` pasa.
2. **Pre-renderizar el brillo de la pelota.** Sustituir la creación de `createRadialGradient` + `shadowBlur` dentro de `drawBall()`, ejecutada cada frame, por un sprite dibujado una sola vez (por ejemplo en un `canvas` auxiliar del tamaño de la pelota) y compuesto cada frame con `ctx.drawImage` en la posición actual de `ball`. _Verificable:_ una captura de un frame estático antes y después del cambio es indistinguible a simple vista; la pelota sigue rebotando igual.
3. **Evitar el `shadowBlur` por frame en la paleta.** Mismo tratamiento que el paso 2: pre-renderizar la paleta con su resplandor una vez (se puede invalidar si en el futuro `setSkin` empieza a repintar el lienzo — hoy no lo hace, línea 474) y componerla con `drawImage` en `paddle.x`. _Verificable:_ visualmente idéntica; el motor sigue respondiendo al teclado, al ratón y al arrastre táctil.
4. **Guardar la reconstrucción de `explosions` detrás de una guarda.** Cambiar la línea 322 para que `explosions.filter(...)` solo se ejecute si `explosions.length > 0`. _Verificable:_ las explosiones se siguen viendo y desapareciendo a los 150 ms.
5. **Re-medir con el muestreador de este spec, en un entorno sin otros agentes ni `npm run dev` concurrentes**, y sustituir la tabla del §5 por los números "después". _Verificable:_ los criterios de aceptación del §7 se cumplen con la nueva medición.

---

## 7 — Criterios de aceptación

**Medición (ancladas a la tabla del §5)**

- [ ] Repetir el muestreador de este spec (misma ventana de 8 s, sin interacción del jugador) en un entorno sin otros procesos Node/Chromium concurrentes da un frame time medio en `/jugar/arkanoid` que iguala o mejora el control de `about:blank` de este spec (16.93 ms), frente a los 17.0–19.5 ms medidos aquí con el entorno contaminado.
- [ ] El porcentaje de frames por encima de 33 ms baja de 16.75 % (Medición A de este spec) a menos de 2 % en la re-medición aislada.
- [ ] El máximo de frame time medido no supera 25 ms en una ventana de 8 s sin interacción (frente a los 33.6–50 ms medidos aquí).

**Cambios concretos en el código**

- [ ] `ctx.createLinearGradient` para la paleta se invoca como máximo una vez por partida, no una vez por frame — verificable instrumentando temporalmente un contador dentro de `drawPaddle()` durante la implementación y quitándolo después.
- [ ] `ctx.createRadialGradient` para la pelota deja de invocarse dentro del bucle de dibujo por frame; el brillo de la pelota se compone con `drawImage` desde un sprite pre-renderizado.
- [ ] `ctx.shadowBlur`/`ctx.shadowColor` dejan de fijarse y apagarse en el contexto principal en cada frame para la paleta y la pelota.
- [ ] `explosions.filter(...)` solo se ejecuta cuando `explosions.length > 0`.
- [ ] Ninguno de los cambios anteriores altera la física, la puntuación, las vidas, los niveles, los sonidos ni ninguna constante de juego de la SPEC 09: jugar la misma secuencia de entradas antes y después produce la misma puntuación final.

**Contrato y calidad**

- [ ] `lib/games/engine.ts` no tiene ni una línea de diferencia.
- [ ] `lib/games/registry.ts` no tiene ni una línea de diferencia (el bug de la clave duplicada del §5 se deja fuera de este spec, ver decisión en el §8).
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.
- [ ] La consola de `/jugar/arkanoid` no muestra ningún error ni warning nuevo atribuible a estos cambios.
- [ ] `/jugar/asteroides`, `/jugar/tetris`, `/jugar/vibora` y `/jugar/frogger` no se tocan ni cambian de comportamiento.

---

## 8 — Decisiones tomadas y descartadas

- **Cachear el gradiente de la paleta en vez de quitarle el efecto visual.** El estilo neón a base de gradientes y brillo es una decisión explícita de la SPEC 09 §6 («dibujo a lienzo puro... en el estilo neón del sitio»). Quitar el gradiente sería más barato pero cambiaría el aspecto del juego sin que nadie lo haya pedido; cachearlo da el mismo píxel a coste casi nulo porque sus parámetros son constantes.
- **Pre-renderizar un sprite para la pelota, no solo cachear el `CanvasGradient`.** A diferencia de la paleta, el gradiente de la pelota depende de su posición, que cambia cada frame — cachear el objeto `CanvasGradient` tal cual no serviría porque sus coordenadas absolutas quedarían desfasadas. La alternativa de recalcularlo pero mantener el mismo resultado visual es pre-renderizarlo relativo a un sprite fijo y moverlo con `drawImage`, que sí es cacheable de verdad.
- **No introducir `object pooling` para las explosiones.** Se consideró llevar un pool de objetos `Explosion` reutilizables, al estilo de lo que pediría un motor con cientos de partículas. Se descarta: el array de explosiones tiene como máximo un puñado de elementos vivos durante 150 ms cada uno — la SPEC 09 solo rompe un bloque por frame (línea 317-318, «Un bloque por fotograma, como en el original»). El único ajuste que se justifica es no reconstruir el array cuando está vacío, no reciclar objetos.
- **El churn de audio (`cloneNode` por golpe) se deja fuera de alcance de este spec.** Ya es una decisión tomada y un riesgo aceptado explícitamente en la SPEC 09 §6 y §7: el `cloneNode` es lo que permite que dos rebotes seguidos se solapen en vez de cortarse, y sustituirlo por un pool cambiaría ese comportamiento sonoro sin que haya evidencia de que sea un problema de fotogramas — el volumen de clones lo marca la tasa de colisiones, no el framerate. Reabrir esa decisión es un spec de audio, no uno de rendimiento de fotogramas.
- **El bucle de colisión bloque-a-bloque no se toca.** Es O(n) sobre un array de tamaño fijo (máximo 60), con `break` en el primer impacto. No hay medición ni indicio de que sea un cuello de botella; optimizarlo (por ejemplo con una rejilla espacial) sería resolver un problema que no existe a esta escala.
- **El bug de la clave duplicada en la leyenda de controles (§5) se documenta pero no se convierte en criterio de aceptación de este spec.** Vive en `lib/games/registry.ts`, fuera del alcance declarado de esta auditoría (solo `lib/games/arkanoid/engine.ts`), y no es un problema de frame time — es un warning de React en el HUD. Corregirlo aquí sería tocar un fichero que varios agentes en paralelo pueden estar editando a la vez.
- **Usar la medición contaminada por contención de entorno como línea base "antes", en vez de descartar el spec.** No fue posible aislar un entorno limpio durante esta pasada — cuatro agentes más compartían máquina, servidor de desarrollo y, según se descubrió, la propia pestaña de Playwright. Descartar la medición habría dejado el spec sin ningún número. En su lugar, se documenta la contaminación con una medición de control (`about:blank`) y se exige una re-medición aislada como parte de los criterios de aceptación del §7, en vez de fijar umbrales absolutos que podrían no ser alcanzables por ruido del entorno y no por el motor.

---

## 9 — Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                               | Mitigación                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los números del §5 están inflados por contención de CPU (cinco agentes y sus navegadores en la misma máquina) y por una pestaña de Playwright compartida entre agentes en paralelo.                                                                                                  | Medición de control (`about:blank`, mismo entorno) documentada en la tabla; el §7 exige una re-medición aislada en vez de fijar un umbral absoluto sobre la cifra contaminada.  |
| El sprite pre-renderizado de la pelota o la paleta queda desalineado a nivel de subpíxel al componerse con `drawImage`, y el brillo se ve ligeramente distinto del actual.                                                                                                           | Criterio de aceptación explícito de comparación visual de un frame estático antes/después en el §7.                                                                             |
| El motor de ARKANOID aún no implementa `setSkin` en el lienzo (línea 474: `setSkin() {}`), así que un sprite cacheado hoy asume los colores fijos de `BLOCK_COLORS`/gradientes actuales; si un spec futuro migra la paleta del motor a `skins.ts`, el caché tendría que invalidarse. | Se deja anotado en el paso 3 del plan de implementación; no es un riesgo de este spec porque `setSkin` no dibuja nada todavía, pero sí de cualquier spec que lo cambie después. |
| El muestreador del Paso 2 solo mide el coste base (pelota en movimiento automático, sin los 60 bloques cayendo simultáneamente ni al jugador moviendo la paleta), así que un pico de coste bajo estrés real podría no reflejarse en la mejora medida.                                | Documentado explícitamente en el §5; queda fuera de alcance simular una partida completa, pero el plan de implementación no depende de esa simulación para dar resultado.       |

---

## Lo que **no** entra en este spec

Cualquier cambio a `lib/games/engine.ts` o `lib/games/registry.ts`. Los motores `asteroides`, `tetris`, `vibora` y `frogger`. Rediseñar la física, los niveles, el HUD o el audio de ARKANOID. Introducir un pool de objetos para las explosiones. Corregir el bug de clave duplicada en la leyenda de controles de `registry.ts`. Implementar cualquiera de los pasos del §6 — eso corresponde a `/spec-impl` una vez este documento esté `Approved`, y lo lanza el usuario.
