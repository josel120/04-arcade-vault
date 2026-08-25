# SPEC 14 — Rendimiento del motor de VÍBORA

> **Estado:** Draft
> **Depende de:** SPEC 10 (motor de víbora), SPEC 07 (contrato de controles), SPEC 09 (contrato `setMuted`/`setSkin` que este motor ya implementa)
> **Fecha:** 2026-08-25
> **Objetivo:** Documentar y acotar con números concretos los costes por fotograma de `lib/games/vibora/engine.ts` — allocations por paso, `shadowBlur` sobre el cuerpo entero y el coste de `findFood()` — para que una pasada de `/spec-impl` posterior los corrija sin cambiar el contrato de la plataforma.

---

## 1 — Por qué existe este spec

Es el primer spec de rendimiento que toca a VÍBORA, y el primero de la casa que audita un motor sin tocar su código: el trabajo de esta pasada es medir y escribir, no arreglar. `lib/games/vibora/engine.ts` es, además, el único motor de los cinco reales que **no avanza solo** — asteroides deriva, arkanoid tiene la bola en movimiento, frogger tiene tráfico — la víbora se queda quieta (`waiting = true`) hasta la primera tecla. Eso importa para leer el §5: cualquier medición de FPS tomada sin lanzar la víbora primero solo certifica el coste de `draw()` en reposo, no el de `step()`.

No existía ningún spec de rendimiento previo en `specs/` en el momento de escribir este (`Glob specs/*.md` + búsqueda de "rendimiento"/"performance" sin resultados), así que no hay nada que ampliar ni pisar.

---

## 2 — Alcance

**Dentro:**

- **Solo `lib/games/vibora/engine.ts`.** Ningún otro motor (`asteroides`, `tetris`, `arkanoid`, `frogger`) entra en este documento — se auditan por separado, en paralelo, con sus propios specs.
- Los tres costes reales encontrados en el motor: allocations por paso en `step()`, `shadowBlur` sobre el cuerpo completo de la víbora en `drawSnake()`, y el barrido de las 1200 celdas del tablero en `findFood()`.
- La línea base de FPS medida en el Paso 2, con víbora quieta y con víbora en movimiento.

**Fuera de alcance (para specs futuras):**

- **Los otros cuatro motores.** No se leyó ni una línea de `lib/games/asteroides/`, `lib/games/tetris/`, `lib/games/arkanoid/` ni `lib/games/frogger/` para este documento.
- **El contrato de la plataforma.** Ni `lib/games/engine.ts`, ni `components/games/game-canvas.tsx`, ni `lib/games/registry.ts` cambian aquí; SPEC 10 ya los dejó cerrados y este spec no reabre esa discusión.
- **Implementar el arreglo.** Este documento solo dimensiona el problema y fija los criterios con los que se medirá la corrección; la corrección la hace un `/spec-impl` posterior, lanzado por el usuario, sobre el estado `Approved`.
- **La paleta en canvas de VÍBORA (`GameSkin`).** El motor sigue sin `skins.ts` propio (`setSkin` vacío, ver línea 560); cambiar eso es trabajo de `skin-designer`, no de este spec.
- **Rehacer `findFood()` con una estructura de datos nueva** (p. ej. un `Set` de celdas libres mantenido de forma incremental). El §6 explica por qué se deja como decisión abierta para la implementación, no cerrada aquí.

---

## 3 — Modelo de datos

Este spec no introduce estructuras de datos nuevas. Reutiliza el contrato de la plataforma (`GameEngine`, `GameSnapshot` de `lib/games/engine.ts`) y el modelo interno de SPEC 10 (`Cell`, `Dir`, el array `snake: Cell[]`), documentado, no modificado.

---

## 4 — Hallazgos de la auditoría estática

Todos los números de línea son de `lib/games/vibora/engine.ts` en el estado del repo a fecha de este spec.

### 4.1 — Allocation por paso sin reutilización (`step()`, líneas 353-388)

- **Línea 359**: `const head: Cell = { x: ..., y: ... }` — un objeto nuevo por paso.
- **Línea 367**: `const body = snake.slice(0, snake.length - 1);` — **copia el array completo de la víbora en cada paso**, solo para comprobar la colisión con el cuerpo. Con la víbora en su tamaño máximo teórico (`COLS * ROWS - 1` = 1199 celdas, justo antes de ganar), esto es una copia de ~1199 elementos, en cada paso, hasta 20 veces por segundo (`MIN_STEP_MS = 50`).
- **Línea 374/376**: `snake.unshift(head)` / `snake.pop()` — `unshift` reindexa el array entero en cada paso; con la víbora larga es O(n) por paso, igual que el `.slice()` de arriba.

`step()` no corre en cada fotograma de `requestAnimationFrame` — corre como mucho `1000 / stepMs()` veces por segundo, que va de 8/s en el nivel 1 a 20/s en el nivel 10 (`stepMs()`, líneas 134-136) — pero cada paso hace al menos dos recorridos O(n) del array de la víbora (`slice` + `unshift`), y eso escala con la longitud, no con el nivel.

### 4.2 — `shadowBlur` sobre el cuerpo entero, no solo sobre la cabeza (`drawSnake()`, líneas 444-482)

`ctx.shadowBlur` se activa una vez por fotograma (línea 450) **antes** del bucle que pinta los segmentos (líneas 452-471), y se desactiva una vez después (línea 473). No es el patrón "por entidad" más caro de encender y apagar el sombreado en cada iteración, pero el efecto de sombra en Canvas 2D se recalcula **por cada llamada a `fillRect` mientras `shadowBlur` sigue activo**, así que el coste real escala con el número de segmentos del bucle, no con el número de veces que se asigna la propiedad. Con la víbora corta (3-20 celdas) esto es barato; con la víbora larga (cientos de celdas, que es exactamente el escenario que premia la partida — más comida, más nivel, más puntos) son cientos de `fillRect` con sombra activa, en cada uno de los 60 fotogramas por segundo, con la víbora completamente quieta entre pasos de rejilla (la sombra se repinta 60 veces por segundo aunque el cuerpo no se mueva hasta el siguiente `step()`).

Es, textualmente, el caso que la propia auditoría de la casa señala como el más caro: sombreado activado por entidad cuando hay muchas, y aquí las "muchas entidades" son los propios segmentos del cuerpo de la víbora.

### 4.3 — `findFood()` barre las 1200 celdas del tablero en cada bocado (líneas 219-228, 246-253, 399)

```
function findFood(): Cell | null {
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++)       // 30
    for (let x = 0; x < COLS; x++)     // 40
      if (!occupies({ x, y })) free.push({ x, y });
  ...
}
```

`occupies()` (línea 211-213) es `snake.some(...)`, O(longitud de la víbora). `findFood()` la llama una vez por cada una de las `ROWS * COLS = 1200` celdas del tablero, así que el coste total es **O(1200 × longitud de la víbora)**. Se llama desde `placeFood()` en cada bocado (línea 387) y, además, en cada reaparición si la comida cayó sobre la víbora nueva (línea 399). Con la víbora cerca de llenar el tablero (que es, otra vez, el estado que más premia el marcador: nivel alto, `SPEED_FACTOR` acumulado, `stepMs()` en su suelo de 50 ms) esto son del orden de 1,2 millones de comparaciones de propiedades por cada bocado, ejecutadas de forma síncrona dentro de `step()`, antes de que ese mismo fotograma llegue a `draw()`. El propio comentario de cabecera del fichero (líneas 24-26) ya señala esto como una espera de duración indefinida; este spec lo convierte en un número.

### 4.4 — Lo que se auditó y no es un problema

- **Gradientes.** No hay ni un `createLinearGradient`/`createRadialGradient` en el fichero — el criterio de "gradiente recreado cada frame" de la casa no aplica a este motor.
- **Audio.** `tone()` (líneas 168-187) crea un `OscillatorNode`/`GainNode` por nota, pero se dispara por evento discreto (bocado, choque, subida de nivel), nunca por fotograma; es el patrón normal de WebAudio (un oscilador solo puede arrancar una vez) y no hay `cloneNode`/`new Audio()` por evento. `AudioContext` se crea perezosamente y se cierra en `destroy`/`setMuted(true)` (líneas 146-165). Sin hallazgo aquí.
- **`emit()` (línea 274-290).** Construye un objeto `GameSnapshot` nuevo en cada fotograma para compararlo con el último enviado, aunque solo llama a `onSnapshot` si algo cambió. Es una allocation menor de cuatro campos primitivos, 60 veces por segundo; se documenta pero no se convierte en criterio de aceptación — el coste es órdenes de magnitud menor que los tres hallazgos de arriba.

---

## 5 — Línea base medida (Paso 2)

Medido con `mcp__playwright__browser_navigate` a `http://localhost:3000/jugar/vibora` (servidor `next dev` ya levantado — ver limitación en el punto 3 de abajo) y un muestreador de `requestAnimationFrame` inyectado con `mcp__playwright__browser_evaluate`, que registra el delta entre timestamps consecutivos.

| Muestra                                           | Duración | Fotogramas | Frame time medio | Frame time máx. | % > 16,7 ms (< 60 fps) | % > 33 ms (< 30 fps) |
| ------------------------------------------------- | -------- | ---------- | ---------------- | --------------- | ---------------------- | -------------------- |
| A — víbora quieta (`waiting`, sin tecla)          | 8 s      | 413        | 19,37 ms         | 33,60 ms        | 50,4 %                 | 16,2 %               |
| B — víbora en marcha (giros forzados cada 600 ms) | 5 s      | 240        | 20,90 ms         | 33,60 ms        | 61,3 %                 | 24,6 %               |
| C — víbora quieta, repetición sin contención      | 5 s      | 301        | 16,67 ms         | 17,30 ms        | 30,9 %                 | 0 %                  |

Consola del navegador: sin errores ni warnings al cargar `/jugar/vibora` ni durante las tres muestras.

**Limitaciones honestas de esta medición:**

1. **No mide el peor caso de `step()`/`findFood()`.** Las muestras B se tomaron con una víbora de 3-15 celdas, muy lejos de las ~1200 del hallazgo 4.3. El coste de `findFood()` en tablero casi lleno **no está medido con Playwright en este spec** — está acotado por conteo de operaciones en el §4.3, no por cronómetro. Verificar ese número real queda como parte del plan de implementación (§6, paso de instrumentación).
2. **Entorno compartido con contención real y medible.** Este spec se ejecutó junto a otros cuatro agentes auditando en paralelo los otros cuatro motores, todos sobre el mismo servidor `next dev` (puerto 3000) y, según lo observado, el mismo navegador MCP de Playwright: una navegación a `/jugar/vibora` fue redirigida a mitad de medición a `/jugar/frogger` y luego a `/jugar/asteroides` por otra sesión, y la consola mostró errores de React (`Encountered two children with the same key… Mover la paleta`) ajenos a este motor. En el momento de medir había 35 procesos `chrome.exe` y 6 `node.exe` activos en la máquina. La muestra C, tomada en una ventana sin esa interferencia visible, da un resultado consistente con 60 fps limpios (16,67 ms de media, 0 fotogramas por debajo de 30 fps); las muestras A y B, con cifras más altas, no deben leerse como "el motor de víbora cuesta 20 ms por fotograma" sino como "el motor de víbora más la contención del entorno compartido cuesta hasta 20 ms". La línea base "antes" de este spec, para efectos del §6, es **la muestra C** — la más limpia — con las otras dos anotadas como techo bajo carga del entorno, no del motor.
3. El servidor `next dev` usado (`http://localhost:3000`) no lo levantó este agente — el puerto 3000 ya estaba ocupado por el proceso de otro agente en paralelo (mismo repositorio, mismo código) cuando se intentó arrancar uno propio. Por eso no se detiene al terminar: pararlo rompería el trabajo de esa otra sesión. Solo se cerró la pestaña de Playwright propia.

---

## 6 — Plan de implementación

Cada paso dejaría el motor compilando y jugable; ninguno se ejecuta en esta pasada, quedan para `/spec-impl` sobre este spec ya `Approved`.

1. **Instrumentar antes de tocar nada.** Añadir temporalmente (o vía un flag de depuración) un `performance.now()` alrededor de `findFood()` y `step()` para confirmar con números reales, y no solo con conteo de operaciones, el coste en tablero casi lleno que el §4.3 acota analíticamente. _Verificable:_ forzar una víbora larga en `scripts/prueba-tetris.mjs`-style harness o jugando manualmente, y ver el tiempo logueado.
2. **Quitar la copia de `step()`.** Sustituir `const body = snake.slice(0, snake.length - 1)` (línea 367) por un recorrido que ignore el último elemento sin copiar el array (`for (let i = 0; i < snake.length - 1; i++)` o equivalente). _Verificable:_ la víbora sigue detectando colisión contra su propio cuerpo y sigue pudiendo perseguir su cola, igual que antes del cambio.
3. **Acotar el `shadowBlur` del cuerpo a un tramo de segmentos, no a todos.** Por ejemplo, aplicar el brillo solo a la cabeza y a los primeros N segmentos (el resto se pinta sin sombra, ya que a partir de cierta distancia el degradado de `globalAlpha` ya lo apaga visualmente, línea 464). _Verificable:_ a simple vista la víbora se sigue leyendo igual de "encendida" cerca de la cabeza; captura de pantalla antes/después para comparar.
4. **Evitar el barrido completo de `findFood()` cuando el tablero está poco ocupado.** Con la víbora corta (el caso común), sortear una celda al azar y reintentar si está ocupada es más barato que construir la lista de 1200 celdas libres; reservar el barrido completo (o una estructura incremental) solo para cuando la ocupación supera un umbral (p. ej. 60 % del tablero). _Verificable:_ la comida sigue apareciendo siempre en una celda libre, nunca sobre la víbora, incluida la reaparición de la línea 399.
5. **Re-medir con el mismo muestreador del Paso 2 de este spec**, en las mismas tres condiciones (A, B, C), para poder comparar como manzanas con manzanas. _Verificable:_ los números nuevos se anotan junto a los de este spec, no los sustituyen.

---

## 7 — Criterios de aceptación

- [ ] `step()` ya no ejecuta `Array.prototype.slice` sobre `snake` en cada paso (línea 367 de antes de este spec).
- [ ] `drawSnake()` ya no activa `shadowBlur` para el cuerpo completo de la víbora en todos los tamaños; a partir de un umbral documentado de longitud, el sombreado se limita a un tramo (cabeza + N segmentos), sin cambio visible a simple vista respecto al aspecto de antes de este spec.
- [ ] `findFood()` no recorre las 1200 celdas del tablero cuando la ocupación es baja (víbora corta); el barrido completo, o su sustituto, solo se ejecuta cuando hace falta.
- [ ] Con víbora corta (3-20 celdas) y sin contención de entorno, el frame time medio durante 5 s de juego real (mismo muestreador del Paso 2) se mantiene en ≤ 16,7 ms, igual o mejor que los **16,67 ms** de la muestra C de este spec.
- [ ] Con víbora en marcha y giros forzados durante 5 s (misma receta de la muestra B), el frame time medio es ≤ 16,7 ms, frente a los **20,90 ms** (61,3 % de fotogramas por debajo de 60 fps) medidos antes de este spec.
- [ ] El coste de `findFood()` con el tablero al 90 % de ocupación, medido con `performance.now()` según el paso 1 del §6, baja de forma medible respecto al número que arroje esa instrumentación — no hay cifra "antes" en este spec porque no se instrumentó, así que la propia instrumentación deja la línea base.
- [ ] Una partida completa (spawn, comer, chocar, perder las tres vidas) se sigue jugando exactamente igual que antes: mismas reglas de la cola de giros, mismo muro mortal, mismas tres vidas — este spec no cambia ninguna regla de SPEC 10.
- [ ] `lib/games/engine.ts` no tiene ni una línea de diferencia.
- [ ] `components/games/game-canvas.tsx` no tiene ni una línea de diferencia.
- [ ] `lib/games/registry.ts` no tiene ni una línea de diferencia.
- [ ] La consola del navegador sigue sin errores ni warnings nuevos al jugar una partida completa de víbora tras el cambio.

---

## 8 — Decisiones tomadas y descartadas

- **Sí:** medir con víbora en movimiento además de en reposo. La víbora es el único de los cinco motores reales que no avanza sin input; medir solo en reposo habría certificado el coste de `draw()` y nada del de `step()`.
- **No:** simular una víbora casi llena de 1000+ celdas con Playwright en esta pasada. El muestreador de rAF del Paso 2 mide fotogramas en tiempo real; forzar ese estado de forma fiable requiere o bien una partida jugada de varios minutos, o bien un modo de depuración que este spec no tiene mandato para añadir (sería tocar el motor). Se deja como paso explícito de instrumentación en el §6 en vez de como número fabricado.
- **Sí:** acotar el `shadowBlur` por tramo de segmentos en vez de quitarlo del todo. Quitarlo cambia el aspecto visual que ya jugó SPEC 10; limitarlo a la cabeza y un tramo corto mantiene el efecto donde más se nota (la cabeza, que es lo que sigue el ojo) y lo quita donde menos se echa en falta (la cola lejana, que SPEC 10 ya apaga con `globalAlpha`).
- **No:** reescribir `findFood()` con una estructura incremental de celdas libres (un `Set` mantenido en cada `step()`/`spawn()`) como única solución. Es más rápida en el caso extremo, pero añade una segunda fuente de verdad que hay que mantener sincronizada con `snake` en cada movimiento, con su propio riesgo de desincronización silenciosa. Se deja como alternativa a evaluar en la implementación, no como decisión cerrada aquí — el umbral de "solo barrer completo por encima de X% de ocupación" del paso 4 del §6 resuelve el caso común sin esa complejidad añadida.
- **No:** tocar `emit()` para evitar la allocation del snapshot en cada fotograma (hallazgo §4.4). Es una allocation de un objeto de cuatro campos primitivos, 60 veces por segundo; el coste es marginal comparado con los tres hallazgos que sí entran en el plan, y "arreglarlo" complicaría una función que hoy se lee en diez líneas.
- **Sí:** dejar la muestra C como línea base "antes" de este spec, no la A ni la B. Son la representación más fiel del coste propio del motor, sin la contención del entorno compartido documentada en el §5.

---

## 9 — Riesgos

| Riesgo                                                                                                                  | Mitigación                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acotar `shadowBlur` a un tramo de segmentos deja una transición visible entre "con brillo" y "sin brillo"               | El paso 3 del §6 pide comparación de capturas antes/después; si se nota, el tramo se agranda o se sustituye por un degradado de `shadowBlur` en vez de un corte binario. |
| El umbral de ocupación del paso 4 del §6 se fija mal (demasiado alto) y no evita el coste real en la práctica           | El paso 1 del §6 (instrumentación con `performance.now()`) se hace **antes** de fijar el umbral, no después.                                                             |
| Las cifras del §5 (muestras A y B) se leen como el coste real del motor en vez de como "motor + contención del entorno" | El §5 lo dice explícito en el punto 2 de sus limitaciones, y el §7 solo usa la muestra C y la B como referencia comparativa, nunca la A.                                 |

---

## Lo que **no** está en este spec

- Los otros cuatro motores (`asteroides`, `tetris`, `arkanoid`, `frogger`): cada uno tiene su propio spec de rendimiento en paralelo.
- Ningún cambio al contrato de la plataforma (`lib/games/engine.ts`, `components/games/game-canvas.tsx`, `lib/games/registry.ts`).
- La implementación del arreglo: este documento se queda en `Estado: Draft` hasta que alguien lo revise y lo pase a `Approved`; solo entonces `/spec-impl 14-rendimiento-vibora` (lanzado por el usuario) ejecuta el §6.
- La paleta en canvas de VÍBORA (`GameSkin`/`skins.ts`): sigue siendo trabajo de `skin-designer`.
