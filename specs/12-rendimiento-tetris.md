# SPEC 12 — Rendimiento del motor de TETRIS

> **Estado:** Draft
> **Depende de:** SPEC 08 (motor de Tetris)
> **Fecha:** 2026-08-25
> **Objetivo:** Documentar, con números medidos, los costes reales de fotograma del motor de `tetris` y dejar un plan de arreglos verificables, sin tocar el código todavía.

---

## 1 — Por qué existe este spec

Es el primer spec de rendimiento del motor de TETRIS. No hay un `specs/NN-rendimiento-*` previo del que partir — la única mención de rendimiento en todo `specs/` está en el SPEC 05 (asteroides), como riesgo, no como spec dedicado. Esta auditoría se ejecutó en paralelo con cuatro más, una por motor real (`asteroides`, `arkanoid`, `vibora`, `frogger`), cada una escribiendo su propio spec de salida sin tocar el motor de las demás.

Esa ejecución en paralelo tiene una consecuencia que hay que dejar por escrito antes de leer ningún número del §5: **las cinco auditorías compartieron el mismo servidor `next dev` en `localhost:3000` y, aparentemente, la misma pestaña de navegador Playwright.** Se confirmó en directo varias veces durante la medición: tras navegar a `/jugar/tetris` y lanzar el muestreador, `location.href` cambió solo a `/jugar/asteroides`, a `/jugar/arkanoid` o a `about:blank` sin que este agente navegara a ningún sitio, y una de las llamadas a `evaluate` terminó con `Execution context was destroyed, most likely because of a navigation`. Los números de frame time de este spec incluyen, por tanto, contención de CPU de una máquina con cinco motores y cinco navegadores corriendo a la vez, no solo el coste propio de TETRIS. Se anota como limitación explícita en el §7 y se usa como criterio de aceptación una medición en un entorno aislado, no los promedios brutos de esta pasada.

Dicho eso, la auditoría estática (sin ejecutar nada) es independiente de esa contaminación y es fiable: es lectura de código, no medición de tiempo.

---

## 2 — Alcance

**Dentro:**

- `lib/games/tetris/engine.ts`: su bucle `update`/`draw`, y cualquier trabajo repetido innecesariamente en cada fotograma.
- `lib/games/tetris/pieces.ts`, solo como referencia de las constantes que el motor consume (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `LINE_SCORES`); no tiene lógica que auditar.
- Medición de FPS reales en `/jugar/tetris` con el muestreador de `requestAnimationFrame` descrito en el §5, y los errores/warnings de consola durante esa sesión.
- Los hallazgos de rendimiento de TETRIS, cada uno como criterio de aceptación medible.

**Fuera de alcance (para otros specs, ya en marcha en paralelo):**

- `lib/games/asteroides/engine.ts`, `lib/games/arkanoid/engine.ts`, `lib/games/vibora/engine.ts`, `lib/games/frogger/engine.ts`. Cuatro agentes distintos los están auditando ahora mismo, cada uno con su propio spec de salida.
- `lib/games/engine.ts` (el contrato de la plataforma) y `lib/games/registry.ts`. No se propone ningún cambio a ninguno de los dos.
- `components/games/game-canvas.tsx` y cualquier cosa relacionada con el anfitrión del lienzo, el escalado por `devicePixelRatio` o el ciclo de montaje/desmontaje: eso ya está cubierto por el SPEC 08 y no tiene coste por fotograma propio.
- Implementar el arreglo. Este spec solo lo planifica; lo ejecuta un `/spec-impl` posterior, lanzado por el usuario.
- Un framework de medición de rendimiento nuevo, o cambios a `scripts/prueba-tetris.mjs` para que mida tiempo: ese arnés comprueba reglas, no rendimiento, y seguirá siendo así.

---

## 3 — Modelo de datos

Este spec no introduce estructuras de datos nuevas. Reutiliza el contrato de la plataforma (`lib/games/engine.ts`) y el estado por instancia que ya vive dentro de `createEngine` en `lib/games/tetris/engine.ts`. El único dato nuevo que cualquier implementación futura tendría que añadir es una caché interna del motor (por ejemplo, la fila de aterrizaje de la sombra ya calculada), que es estado privado del motor, no un tipo exportado ni un campo del `GameSnapshot`.

---

## 4 — Auditoría estática — hallazgos

Repasando `lib/games/tetris/engine.ts` categoría por categoría:

1. **Allocations por frame sin _pool_.** No aplica. El único sitio que crea objetos o arrays nuevos es `randomPiece()` (línea 104-113) y `rotateCW()` (línea 128-138), y ambos se llaman solo en eventos discretos (generar la siguiente pieza, rotar), nunca dentro de `update()` ni de `draw()`. TETRIS no tiene balas, partículas ni explosiones.
2. **Arrays reconstruidos con `.filter()` cada frame.** No aplica. No hay ninguna lista de entidades vivas/muertas que depurar cada fotograma.
3. **Gradientes o patrones recreados cada frame.** No aplica. `draw()` (línea 416-443) no llama a `createLinearGradient` ni a `createRadialGradient` en ningún punto; todo el dibujado es `fillRect`/`strokeRect`/`fillText` con colores planos.
4. **`shadowBlur`/`shadowColor` por fotograma.** No aplica. El motor no usa esas propiedades del contexto en ningún sitio.
5. **Colisiones O(n²).** No aplica en el sentido de la categoría. `collide()` (línea 115-126) itera sobre la forma de la pieza actual, que mide como mucho 4×4 celdas; no hay bucle anidado sobre dos arrays que crecen con la partida.
6. **Churn de audio.** No aplica. `setMuted()` está vacío (línea 506) y el motor no crea ningún `Audio`/`AudioContext`: TETRIS no suena, como ya documentó el SPEC 08.
7. **Trabajo repetido que podría cacherse.** Aquí sí hay dos hallazgos reales, ambos de bajo impacto pero verificables:
   - **`ghostY()` se recalcula en cada `draw()`, incluida cada fotograma en pausa.** `draw()` la llama en la línea 429 para pintar la sombra, y `loop()` sigue llamando a `draw()` mientras `paused` es `true` (líneas 452-459, a propósito: "la escena congelada se ve bajo el cartel"). Como `current.x`, `current.y` y `current.shape` no cambian en pausa, el resultado de `ghostY()` es idéntico fotograma tras fotograma, y aun así se recorren hasta 20 filas llamando a `collide()` (hasta 16 comprobaciones por llamada) para recalcular lo mismo. El coste absoluto es pequeño (~320 comprobaciones en el peor caso, 60 veces por segundo), pero es trabajo desechado por definición.
   - **`label()` fija `ctx.font` y `ctx.textAlign` en cada llamada** (línea 377-382), y `drawPanel()` la llama dos veces por fotograma (líneas 387 y 409) con los mismos valores de fuente y alineación todo el tiempo que dura la partida. Es una escritura de dos propiedades del contexto que nunca cambian, repetida sin necesidad.

**Conclusión de la auditoría estática:** el motor de TETRIS es, comparado con motores que manejan partículas o gradientes, ya bastante económico por diseño — no hay ningún hallazgo de las categorías 1 a 6. Los dos hallazgos de la categoría 7 son optimizaciones de bajo riesgo y bajo impacto, no correcciones de un cuello de botella real. Si los números del §5 muestran un frame time alto, la causa más probable no es el propio motor sino la contaminación de la medición descrita en el §1 y el §7.

---

## 5 — Medición de FPS reales

Metodología: navegar a `http://localhost:3000/jugar/tetris` con `mcp__playwright__browser_navigate`, e inyectar con `mcp__playwright__browser_evaluate` un muestreador que encadena `requestAnimationFrame`, guarda el delta entre timestamps consecutivos durante una ventana de 4 a 8 segundos, y aborta si `location.pathname` cambia a media medición (señal de contaminación). El motor se mueve solo por la caída automática de la pieza aunque no haya ninguna tecla pulsada, así que no hace falta simular una partida jugada para tener una muestra representativa del coste base de `update` + `draw`.

Se registran los tres intentos que terminaron **sin** contaminación confirmada (`location.pathname` se mantuvo en `/jugar/tetris` durante toda la ventana):

| Intento | Duración | Muestras | Frame time medio | Frame time máx. | % > 16.7 ms | % > 33 ms |
| ------- | -------- | -------- | ---------------- | --------------- | ----------- | --------- |
| 1       | 8.0 s    | 415      | 19.28 ms         | 33.6 ms         | 43.4 %      | 15.4 %    |
| 2       | 4.0 s    | 164      | 24.39 ms         | 33.7 ms         | 61.6 %      | 45.7 %    |
| 3       | 5.0 s    | 116      | 42.82 ms         | 66.9 ms         | 97.4 %      | 96.6 %    |

Otros dos intentos se descartaron por contaminación explícita: uno terminó con `location.href` apuntando a `/jugar/asteroides` sin que este agente navegara, y otro lanzó `Execution context was destroyed, most likely because of a navigation` a mitad de la ventana de muestreo.

El deterioro entre el intento 1 y el intento 3 (19 ms → 43 ms de media) en el mismo motor, sin ningún cambio de código de por medio, es la prueba de que la variable dominante en estos números es la carga de la máquina en el momento de la medición —más agentes de auditoría arrancando sus propios `next dev` y sus propios navegadores en paralelo— y no el coste intrínseco de TETRIS, que el §4 no encontró especialmente costoso.

**Consola:** ninguno de los tres intentos válidos, ni las navegaciones previas a `/jugar/tetris`, dejaron ningún error ni warning en `mcp__playwright__browser_console_messages` (solo los mensajes informativos habituales de React DevTools y HMR).

**Limitación honesta:** esta medición, incluso en su intento más limpio, no aísla el coste base de TETRIS de la contención de CPU de una máquina compartida con otras cuatro auditorías simultáneas. Tampoco simula una partida jugada con el pozo casi lleno —el escenario en que el §4 señala que el redibujado completo del tablero hace más trabajo real—, así que ninguno de los tres intentos mide el peor caso, solo el coste base con un tablero mayormente vacío.

---

## 6 — Plan de implementación

Dos pasos, ambos sobre el mismo fichero, cada uno dejando el motor compilando y jugable.

1. **Cachear `ghostY()`.** Guardar la última fila de aterrizaje calculada junto con la posición/forma de pieza y la versión del tablero con la que se calculó; en `draw()`, reutilizar el valor cacheado si `current.x`, `current.y`, `current.shape` y el tablero no han cambiado desde la última vez, y recalcular solo cuando alguno lo haya hecho (tras `doAction`, tras la caída automática de `update()`, y tras `lockPiece()`/`spawn()`). _Verificable:_ la sombra se sigue viendo en la posición correcta jugando una partida completa, y en pausa (`paused === true`) el motor deja de invocar `collide()` desde `ghostY()` fotograma tras fotograma.
2. **Fijar `ctx.font` y `ctx.textAlign` una sola vez para el panel**, en vez de en cada llamada a `label()`. _Verificable:_ SIGUIENTE y LÍNEAS se siguen viendo con la misma tipografía y alineación que antes, y `label()` deja de escribir esas dos propiedades del contexto en cada invocación.

No hay un tercer paso para el redibujado completo del tablero: el §4 concluye que, con colores planos y sin gradientes ni sombras, su coste ya es bajo, y trocearlo en una versión "solo lo que cambió" es la clase de complejidad que el §7 (SPEC 08) descartó a propósito para no rediseñar un motor que ya funciona. Si una medición futura en un entorno aislado mostrara que sigue siendo un problema real, mereceria su propio spec.

---

## 7 — Criterios de aceptación

**Auditoría estática**

- [ ] No hay ningún `new`, `.filter()`, `createLinearGradient`/`createRadialGradient`, `shadowBlur`/`shadowColor`, colisión O(n²) sobre arrays crecientes, ni `Audio`/`AudioContext` dentro de `update()` o `draw()` en `lib/games/tetris/engine.ts` — confirmado en este spec (§4) y a reconfirmar tras la implementación.

**Rendimiento medido**

- [ ] `ghostY()` (`lib/games/tetris/engine.ts:182-186`) deja de recalcularse en cada llamada a `draw()`; con el juego en pausa durante 60 fotogramas seguidos, se invoca `collide()` desde `ghostY()` cero veces adicionales.
- [ ] La sombra de la pieza se ve en la misma posición, cuadro a cuadro, jugando una partida completa con la caché activada — ningún salto ni desfase frente al comportamiento de antes de este spec.
- [ ] `label()` (`lib/games/tetris/engine.ts:377-382`) ya no asigna `ctx.font` ni `ctx.textAlign` en cada llamada; se fijan una sola vez por la vida del motor.
- [ ] SIGUIENTE y LÍNEAS se ven con la misma tipografía, tamaño y alineación que antes de este spec.
- [ ] Repitiendo el muestreador del §5 en un navegador y una máquina sin otro proceso de auditoría corriendo en paralelo (una sola pestaña, un solo `next dev`), el frame time medio en `/jugar/tetris` durante una ventana de 5 s es ≤ 16.7 ms, y menos del 5 % de los fotogramas superan 33 ms — frente a los 19.3–42.8 ms de media y hasta 96.6 % de fotogramas por encima de 33 ms medidos en este spec bajo carga concurrente (§5).
- [ ] `mcp__playwright__browser_console_messages` no reporta ningún error ni warning nuevo jugando una partida completa hasta GAME OVER, con las mismas comprobaciones que en el §5.

**Contrato y no-regresión**

- [ ] `lib/games/engine.ts` no tiene ni una línea de diferencia.
- [ ] `lib/games/registry.ts` no tiene ni una línea de diferencia.
- [ ] `components/games/game-canvas.tsx` no tiene ni una línea de diferencia.
- [ ] `npm run prueba:tetris` sigue terminando en verde con código de salida 0 tras el cambio, sin ninguna comprobación nueva desactivada.
- [ ] `npx tsc --noEmit` y `npm run build` pasan sin avisos nuevos.

---

## 8 — Decisiones tomadas y descartadas

- **Sí: cachear `ghostY()`.** Es trabajo medible y desechado con seguridad (se recalcula igual en pausa), y la invalidación tiene puntos de enganche claros y ya existentes (`doAction`, la caída automática de `update()`, `lockPiece()`). Riesgo de regresión bajo porque el criterio de aceptación exige que la sombra se vea idéntica.
- **Sí: fijar `ctx.font`/`ctx.textAlign` del panel una sola vez.** Cambio de una línea, sin riesgo, con el mismo espíritu que cachear `ghostY()`: quitar trabajo que el contexto de canvas hace igual todas las veces.
- **No: trocear el redibujado del tablero en "solo lo que cambió desde el frame anterior".** El §4 no encontró que las 200 celdas del tablero, dibujadas con `fillRect` planos y sin gradientes ni sombras, sean un coste real — la propia auditoría estática del SPEC 08 nunca lo señaló como problema, y la medición del §5, aunque contaminada, tampoco aísla ese redibujado como la causa del frame time alto (el motor rinde peor con exactamente el mismo tablero casi vacío en los tres intentos). Introducir seguimiento de celdas "sucias" es la clase de complejidad nueva que el SPEC 08 descartó a propósito ("se porta el juego, no se moderniza"), y aquí se descarta por la misma razón: no hay coste medido que justifique el riesgo.
- **No: _pooling_ de objetos, arreglo de `.filter()`, caché de gradientes, desactivación de `shadowBlur`, ni optimización de colisiones O(n²).** Ninguna de esas categorías aparece en el motor de TETRIS (§4). Proponer un arreglo para un problema que no existe sería inventar alcance.
- **No: repetir la medición del §5 hasta conseguir un entorno aislado dentro de esta misma pasada.** Los cinco motores se estaban auditando en paralelo a propósito, compartiendo máquina y, según se confirmó, la misma pestaña de Playwright. Insistir en aislar la medición aquí habría significado competir activamente con las otras cuatro auditorías por el mismo recurso. Se deja como criterio de aceptación explícito (§7) para cuando se implemente el spec, momento en el que ya no habrá cuatro auditorías hermanas corriendo a la vez.
- **No: anclar el criterio de aceptación de FPS a los números brutos del §5 (19–43 ms).** Se comprobó en directo que esos números incluyen contención de CPU ajena a TETRIS (navegaciones a otras rutas que este agente no inició, un contexto de ejecución destruido a mitad de muestra). Usarlos como objetivo literal fijaría el listón según la carga de una máquina compartida en un momento dado, no según el coste real del motor. El objetivo se fija en el umbral estándar de la plataforma (≤ 16.7 ms de media, < 5 % de fotogramas > 33 ms) medido en un entorno sin esa interferencia.

---

## 9 — Riesgos

| Riesgo                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La medición del §5 se hizo con cinco auditorías de rendimiento corriendo en paralelo, compartiendo servidor y, según se confirmó, la misma pestaña de navegador.            | Documentado explícitamente en el §1, el §5 y el §8. El criterio de aceptación de FPS no usa los números brutos de esta pasada como objetivo, sino un umbral fijo a verificar en un entorno aislado durante `/spec-impl`.                 |
| Invalidar mal la caché de `ghostY()` deja la sombra clavada en una posición vieja tras mover, rotar o soltar la pieza.                                                      | El paso de implementación enumera explícitamente los puntos de invalidación (`doAction`, caída automática, `lockPiece`/`spawn`), y hay un criterio de aceptación dedicado a que la sombra se vea idéntica jugando una partida completa.  |
| La medición del §5, incluso en su intento más limpio, no simula un tablero casi lleno, que es el escenario en el que el redibujado completo del pozo hace más trabajo real. | Anotado como limitación honesta en el §5. El plan de implementación no toca el redibujado del tablero precisamente porque no hay medición que lo justifique; si una medición futura en carga real lo señalara, merecería su propio spec. |
| Fijar `ctx.font`/`ctx.textAlign` una sola vez podría quedar obsoleto si un spec futuro (por ejemplo, uno de skins) necesitara cambiar la tipografía del panel en caliente.  | Cambio de una línea, fácil de revertir; queda documentado aquí para quien lo toque después.                                                                                                                                              |

---

## Lo que **no** entra en este spec

Los motores de asteroides, arkanoid, vibora y frogger — cada uno tiene su propio spec de auditoría en paralelo. Cambios a `lib/games/engine.ts`, `lib/games/registry.ts` o `components/games/game-canvas.tsx`. Un framework de medición de rendimiento nuevo, o cambios a `scripts/prueba-tetris.mjs` para que mida tiempo. _Pooling_ de objetos, arreglos de `.filter()`, caché de gradientes, desactivación de `shadowBlur` o rediseño de colisiones: ninguno aplica a TETRIS. Trocear el redibujado del tablero en celdas "sucias". Implementar cualquiera de los dos pasos del §6 — eso lo hace un `/spec-impl` posterior, lanzado por el usuario, con este spec en estado `Approved`.
