# SPEC 15 — Rendimiento del motor de FROGGER

> **Estado:** Draft
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, `specs/game-jam/frogger/spec-implementacion.md`
> **Fecha:** 2026-08-25
> **Objetivo:** Documentar y priorizar, con números medidos de `requestAnimationFrame`, los costes por fotograma del motor de FROGGER (`lib/games/frogger/engine.ts`) para que una pasada futura de `/spec-impl` los elimine sin tocar el contrato de la plataforma.

---

## 1 — Por qué existe este spec

Este agente audita rendimiento, no lo arregla: **no tiene `Edit`**, y el único fichero que produce es este spec. El alcance de esta pasada es exclusivamente el motor de FROGGER — los otros cuatro motores con motor real (`asteroides`, `tetris`, `arkanoid`, `vibora`) los están auditando, en paralelo y en este mismo momento, otras cuatro instancias de este mismo agente, cada una con su propio spec de salida (`specs/11-*.md` a `specs/14-*.md`, previsiblemente). No se ha leído ni tocado ningún fichero de esos otros cuatro motores.

FROGGER es el motor más joven de la casa (`specs/game-jam/frogger/`, sin original que portar, igual que VÍBORA) y el que más entidades dibuja por fotograma de los cinco: hasta 11 carriles simultáneos con un total aproximado de 60-70 coches, camiones, troncos y tortugas en pantalla a la vez, cada uno con su propio color por piel. Nunca se había medido su coste real de fotograma.

---

## 2 — Alcance

**Dentro:**

- El motor `lib/games/frogger/engine.ts` completo: `update`, `updateLanes`, las funciones de colisión (`checkRoadCollision`, `getSupport`, `overlaps`, `laneAt`) y todo `draw()` (`drawZones`, `drawGoals`, `drawEntity`, `drawFrog`, `frogDrawPos`, `withAlpha`).
- Medición de FPS reales de `/jugar/frogger` con el muestreador de `requestAnimationFrame` del Paso 2.
- Cada hallazgo de la auditoría estática, como criterio de aceptación medible para una implementación futura.

**Fuera de alcance (para este spec y para specs futuros):**

- Los otros cuatro motores (`asteroides`, `tetris`, `arkanoid`, `vibora`): cada uno tiene su propio spec de rendimiento en paralelo.
- Cualquier cambio a `lib/games/engine.ts`, `lib/games/registry.ts` o `components/games/game-canvas.tsx` — el contrato de la plataforma no se toca.
- Cambiar el balance de juego de FROGGER (velocidades, tiempo de ronda, puntuación): eso es `specs/game-jam/frogger/`, no esto.
- Implementar cualquiera de los arreglos descritos abajo: este spec solo los planifica. Los ejecuta una pasada de `/spec-impl` posterior, lanzada por el usuario.

---

## 3 — Modelo de datos

Este spec no introduce estructuras de datos nuevas. Reutiliza el contrato de la plataforma (`GameEngine`, `GameSnapshot` de `lib/games/engine.ts`) y el modelo interno de `Lane`/`Entity`/`Frog` ya definido en `lib/games/frogger/engine.ts`. Donde el plan de implementación menciona un caché (p. ej. de colores `rgba`), es una estructura interna del motor, no un cambio de contrato.

---

## 4 — Auditoría estática: hallazgos

Todas las referencias son a `lib/games/frogger/engine.ts` salvo que se indique lo contrario.

### H1 — `shadowColor`/`shadowBlur` activado y desactivado por entidad, cada fotograma

`drawEntity` (líneas 617-665) activa `ctx.shadowBlur` para cada coche/camión (líneas 627-630) y para cada tortuga no sumergida (líneas 656-663), y lo vuelve a poner a `0` justo después. `drawGoals` (líneas 597-615) hace lo mismo por cada meta ocupada, y `drawFrog` (líneas 677-705) una vez más para la rana.

Con la disposición actual de carriles (`buildLanes`, líneas 164-198, y `spawnLaneEntities`, líneas 140-162) hay habitualmente **~32 vehículos en los 5 carriles de carretera y ~35 troncos/tortugas en los 6 carriles de río** en pantalla a la vez — unas 67 entidades por fotograma, de las cuales sobre unas **50** (todos los coches/camiones más las tortugas visibles) activan `shadowBlur` al menos una vez. `shadowBlur` es, documentadamente, una de las operaciones más caras del canvas 2D porque fuerza una pasada de desenfoque por cada trazo, y aquí se paga entre 30 y 50 veces por fotograma, 60 veces por segundo, sin que ninguno de esos valores cambie entre fotogramas salvo por el propio movimiento del carril.

### H2 — `withAlpha` recalcula `rgba(...)` con `parseInt` cada llamada, para colores que solo cambian con `setSkin`

`withAlpha` (líneas 82-87) hace tres `parseInt` en base 16 y arma un string `rgba(...)` nuevo cada vez que se llama. Se invoca en:

- Cada coche/camión, para `shadowColor` (línea 627).
- **Cada tortuga, sumergida o no** (línea 656): la llamada ocurre incondicionalmente aunque justo después `shadowBlur` se ponga a `0` cuando está sumergida (línea 657), es decir, se calcula un color de sombra que no se va a usar.
- Cada meta ocupada (línea 606, hasta 5 veces).
- La rana, una vez por fotograma (línea 685).

Esto son hasta ~56 llamadas a `withAlpha` por fotograma — más de 3000 por segundo a 60 fps — para un puñado de colores (`palette.cyan`, `palette.yellow`, `palette.truckColor`, `palette.green`, `palette.magenta`, `palette.deadColor`) que solo cambian de verdad cuando `setSkin` reemplaza `palette` (línea 777). Es trabajo repetido cacheable: nada en `withAlpha(color, alpha)` depende del fotograma, solo de `color` y `alpha`, y ambos son un conjunto fijo y pequeño por piel.

### H3 — `laneAt` es una búsqueda lineal repetida varias veces por fotograma

`laneAt` (líneas 332-334) recorre el array `lanes` con `.find()`. Se llama desde `checkRoadCollision` (línea 341), `getSupport` (línea 347) y directamente desde `update` cuando la rana va sobre una balsa (línea 554) — hasta 2-3 veces por fotograma sobre un array de 11 carriles. El coste absoluto es pequeño (11 comparaciones), pero es una relectura del mismo dato en el mismo fotograma sin necesidad: `frog.row` no cambia entre esas llamadas dentro de un mismo `update`.

### H4 — Sin colisiones O(n²): las comprobaciones ya están acotadas al carril de la rana

`checkRoadCollision` y `getSupport` solo recorren `lane.entities` del carril en el que está la rana (`.some(overlaps)` / `.find(overlaps)` sobre 5-7 entidades), no el producto cruzado de todas las entidades del tablero. **No hay hallazgo aquí** — a diferencia de "balas × asteroides" o "bola × bloques" en otros motores, FROGGER no tiene un bucle anidado que crezca con el número de entidades vivas.

### H5 — Sin _allocations_ de gameplay por fotograma sin _pool_

Las entidades de cada carril se crean una vez en `buildLanes`/`spawnLaneEntities` (al iniciar partida y en `completeRound`) y se reciclan por posición (`entity.col = -widthCells` / `entity.col = COLS`, líneas 525-529) en vez de crearse y destruirse. No hay `new Particle`/`.filter()` de entidades muertas cada fotograma. **No hay hallazgo aquí.**

La única asignación pequeña por fotograma es el objeto literal que devuelve `frogDrawPos()` (líneas 667-675), llamado una vez por fotograma desde `drawFrog`. Es una asignación mínima (tres números), de presión sobre el recolector de basura despreciable frente a H1/H2; se anota por completitud pero no se convierte en criterio de aceptación propio.

### H6 — Sin _churn_ de audio

El sonido usa el mismo patrón que VÍBORA: un único `AudioContext` perezoso (líneas 253-264, `audioContext()`/`closeAudio()`) y osciladores de un solo uso creados y desechados por evento discreto (salto, choque, meta, ronda completa — líneas 273-329), nunca por fotograma. Es el patrón esperable de WebAudio, no _churn_. **No hay hallazgo aquí.**

---

## 5 — Medición de FPS reales (Paso 2)

Medido navegando a `/jugar/frogger` y muestreando `requestAnimationFrame` durante 8 segundos con un script inyectado vía Playwright, sin interacción del jugador (el tráfico y el río se mueven solos; el hallazgo del §4 no depende de que la rana salte).

**Limitación del entorno de medición, además de la ya conocida:** el navegador de Playwright de esta sesión se comparte con las otras cuatro instancias de este agente que auditaban `asteroides`, `tetris`, `arkanoid` y `vibora` en paralelo — `browser_navigate` sobre la pestaña compartida se vio interrumpido repetidamente por la navegación de esos otros agentes a mitad de muestreo. Para aislar la medición se cargó FROGGER en un `<iframe>` propio (mismo origen, `http://localhost:3000/jugar/frogger`) en vez de navegar la pestaña compartida, y se muestreó `requestAnimationFrame` de ese `iframe.contentWindow`. Esto evita que otro agente tire la navegación a mitad de muestra, pero **no aísla el reparto de CPU**: las otras cuatro pestañas seguían corriendo sus propios motores a la vez, en el mismo proceso de navegador. La primera muestra tomada bajo contención visible (justo cuando otro agente navegaba activamente) dio una media de 41,93 ms/fotograma — muy por encima de las siguientes dos muestras, tomadas con menos actividad simultánea. Se descarta esa primera muestra como no representativa del coste propio del motor y se usan las dos siguientes como línea base:

| Métrica                                       | Muestra A    | Muestra B    |
| --------------------------------------------- | ------------ | ------------ |
| Duración                                      | 8 s          | 8 s          |
| Muestras (fotogramas)                         | 381          | 358          |
| Frame time medio                              | **21,00 ms** | **22,39 ms** |
| Frame time máximo                             | 33,5 ms      | 33,5 ms      |
| % fotogramas > 16,7 ms (por debajo de 60 fps) | 58,3 %       | 63,4 %       |
| % fotogramas > 33 ms (por debajo de 30 fps)   | 24,9 %       | 34,1 %       |
| Errores de consola                            | 0            | 0            |

El tope repetido en exactamente 33,5 ms en ambas muestras (≈ 2× 16,7 ms) es la firma de un fotograma perdido por sincronía vertical en una pantalla de 60 Hz — es decir, el motor no está simplemente "algo lento", está regularmente perdiendo un ciclo entero de refresco, consistente con el coste de `draw()` descrito en H1/H2. La contención del navegador compartido probablemente **infla** el frame time medio absoluto de ambas muestras, pero no explica por sí sola que más de la mitad de los fotogramas superen el presupuesto de 16,7 ms de forma consistente entre dos muestras independientes.

No se detectaron errores ni _warnings_ propios de FROGGER en la consola del navegador durante el muestreo (el `<iframe>` aislado permitió filtrar el ruido de consola de las otras pestañas, que sí mostraban errores ajenos — p. ej. una clave de React duplicada en el motor de ARKANOID, fuera de este alcance).

**Limitación adicional, la esperada por diseño:** este muestreo mide el coste base del motor con el tablero recién iniciado (nivel 1, sin que el jugador acumule progreso), no el pico bajo estrés de una partida avanzada. En FROGGER, sin embargo, el número de entidades en pantalla **no crece con el progreso del jugador** — `buildLanes` genera el mismo número de vehículos y troncos en el nivel 1 que en el nivel 20, solo cambia su velocidad (`SPEED_FACTOR`) — así que a diferencia de un _shooter_ con oleadas, esta medición de nivel 1 sí es representativa del coste sostenido de una partida completa, no solo del arranque.

---

## 6 — Plan de implementación

Cada paso deja el motor compilando y jugable.

1. **Cachear los colores derivados de la piel en `setSkin`.** En `lib/games/frogger/skins.ts` o en el propio `engine.ts`, precalcular un mapa `Record<string, string>` de `rgba(...)` para cada combinación `(color, alpha)` que usa hoy `withAlpha` (`shadowColor` de coche/camión al 0.5, de tortuga al 0.5, de meta al 0.7, de rana al 0.7), una vez al crear el motor y de nuevo dentro de `setSkin` cuando cambia `palette`. `draw()` deja de llamar a `withAlpha` en el bucle caliente; solo lee del mapa ya calculado. _Verificable:_ FROGGER sigue jugable y visualmente idéntico con las tres pieles; `withAlpha` ya no aparece en el cuerpo de `drawEntity`/`drawGoals`/`drawFrog`.
2. **No calcular `shadowColor` de una tortuga sumergida.** En el bloque de tortuga de `drawEntity`, mover el cálculo de `shadowColor` dentro de la misma condición que ya decide `shadowBlur` (`entity.submerged ? 0 : 8`), para no gastar ni una lectura del caché del paso 1 cuando no hay sombra que dibujar. _Verificable:_ la tortuga sumergida se sigue viendo atenuada (`globalAlpha`) igual que antes.
3. **Evaluar bajar o quitar `shadowBlur` en entidades de carretera y río cuando hay muchas en pantalla**, o agruparlas por color antes de activarlo una sola vez por color en vez de una vez por entidad — a decidir en la implementación según el resultado visual; ver §7 sobre el riesgo de regresión visual. _Verificable:_ medido de nuevo con el muestreador del §5, el frame time medio baja de forma medible frente a la línea base de este spec.
4. **Memoizar `laneAt(frog.row)` dentro de un mismo `update()`.** Resolver el carril de la rana una sola vez al principio de `update` (o de las funciones que lo necesitan dentro de la misma invocación) y pasarlo como parámetro a `checkRoadCollision`/`getSupport`, en vez de que cada una vuelva a buscarlo. _Verificable:_ mismo comportamiento de colisión y soporte, una sola llamada a `.find()` sobre `lanes` por `update()` en vez de 2-3.
5. **Medir de nuevo con el muestreador del §5** tras los pasos 1-4, con el mismo protocolo (8 s, sin interacción, `/jugar/frogger` recién cargado) y en las mismas condiciones de contención de máquina que sea posible, para poblar el §5 "después" que hoy no existe.

---

## 7 — Criterios de aceptación

- [ ] `drawEntity`, `drawGoals` y `drawFrog` no llaman a `withAlpha` en su cuerpo; los `rgba(...)` que usan como `shadowColor` salen de un caché poblado en la creación del motor y en `setSkin`.
- [ ] El caché de colores se repuebla correctamente al cambiar de piel en caliente: cambiar de `clasico` a `retro` o `neon` durante una partida en curso no dibuja el `shadowColor` de la piel anterior en ningún fotograma posterior al cambio.
- [ ] Una tortuga sumergida no calcula `shadowColor` en absoluto (ni de caché ni con `withAlpha`) en el fotograma en que `entity.submerged === true`.
- [ ] `checkRoadCollision` y `getSupport`, llamadas dentro del mismo `update()`, no producen más de una llamada a `laneAt` para la fila de la rana.
- [ ] FROGGER mantiene un frame time medio ≤ 16,7 ms durante 8 s de muestreo sin interacción del jugador en `/jugar/frogger`, medido con el mismo muestreador del §5, frente a los 21,00-22,39 ms medidos antes de este spec.
- [ ] El porcentaje de fotogramas por encima de 16,7 ms baja de forma medible frente al 58,3-63,4 % de la línea base de este spec, en la misma medición de verificación del punto anterior.
- [ ] El porcentaje de fotogramas por encima de 33 ms (por debajo de 30 fps) baja de forma medible frente al 24,9-34,1 % de la línea base.
- [ ] No aparecen errores ni _warnings_ nuevos en la consola del navegador jugando una partida completa (tres vidas) tras los cambios.
- [ ] `lib/games/engine.ts`, `lib/games/registry.ts` y `components/games/game-canvas.tsx` no tienen ni una línea de diferencia.
- [ ] El resultado visual de FROGGER con las tres pieles (`clasico`, `retro`, `neon`) es indistinguible a ojo del actual, salvo la decisión que se tome en el paso 3 sobre `shadowBlur` en carreteras/río, que debe quedar registrada explícitamente en el spec de implementación si cambia el aspecto.

---

## 8 — Decisiones tomadas y descartadas

- **Sí: cachear el color en vez de quitar el efecto de brillo.** El `shadowBlur`/`shadowColor` es una decisión visual deliberada de FROGGER (coches, troncos y meta brillan con la piel activa) documentada en `specs/game-jam/frogger/`. Este spec prioriza no rehacer ese trabajo de diseño y en su lugar atacar la parte que sí es puro desperdicio: recalcular el mismo string cada fotograma.
- **No: quitar `shadowBlur` de golpe en todas las entidades.** Sería la solución más barata en fotogramas pero cambia el aspecto de un tirón, sin medir primero cuánto del coste es el propio `shadowBlur` (una operación cara del motor de canvas, difícil de mitigar solo con caché) frente al de recalcular el color. Por eso el paso 3 del plan queda como "a evaluar" y no como un cambio decidido de antemano: hace falta medir antes/después del paso 1-2 para saber si hace falta tocar el `shadowBlur` en sí.
- **No: indexar `lanes` por fila en una estructura tipo mapa.** Se descarta por desproporcionado: 11 carriles y una búsqueda lineal de como mucho 2-3 veces por fotograma no justifica una estructura de datos nueva; memoizar dentro de `update()` (paso 4) resuelve la redundancia real sin tocar la forma de `lanes`.
- **No: convertir la medición en una suite de tests automatizada.** El único arnés del repo (`scripts/prueba-tetris.mjs`) no mide tiempo, solo reglas; añadir un cronómetro ahí sería un cambio de alcance mayor que este spec. Queda para quien decida si el repo necesita un runner de pruebas de verdad (ver `CLAUDE.md`: "si hacen falta pruebas de verdad, preguntar qué runner añadir").
- **No: repetir la medición del §5 hasta eliminar toda contención del navegador compartido.** Habría requerido esperar a que las otras cuatro instancias de este agente terminaran su propia auditoría, fuera del control de esta pasada. Se documenta la contención como limitación y se usan las dos muestras menos contendidas como línea base, en vez de bloquear el spec a la espera de un entorno perfectamente aislado.

---

## 9 — Riesgos

| Riesgo                                                                                                           | Mitigación                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un caché de color mal invalidado deja el `shadowColor` de la piel anterior tras `setSkin`.                       | El criterio de aceptación del §7 exige probar el cambio de piel en caliente a mitad de partida, no solo al arrancar el motor.                                                                                                                                                               |
| La línea base del §5 está inflada por la contención de cinco agentes compartiendo un único navegador Playwright. | Se documenta explícitamente en el §5 y se descarta la muestra más contendida (41,93 ms); las dos muestras usadas como línea base son consistentes entre sí (21,00 ms y 22,39 ms, tope de fotograma idéntico en ambas), lo que sugiere que el patrón, aunque no la magnitud exacta, es real. |
| Quitar o atenuar `shadowBlur` en el paso 3 cambia el aspecto de FROGGER sin que nadie lo apruebe explícitamente. | El criterio de aceptación del §7 exige que cualquier cambio visual de ese paso quede registrado explícitamente en el spec de implementación, no colado como efecto colateral de una optimización.                                                                                           |
| No se puede reproducir exactamente la misma contención de máquina al medir el "después".                         | El plan de implementación (paso 5) pide medir con el mismo protocolo, no en las mismas condiciones exactas de carga — el criterio de aceptación compara contra un rango (21,00-22,39 ms), no un número único, para tolerar variación razonable del entorno.                                 |

---

## Lo que **no** está en este spec

- Ningún cambio a los otros cuatro motores con motor real.
- Ningún cambio al contrato de la plataforma (`lib/games/engine.ts`, `lib/games/registry.ts`, `components/games/game-canvas.tsx`).
- Ningún cambio de balance de juego de FROGGER (velocidades, puntuación, tiempo de ronda).
- La implementación de cualquiera de los pasos del §6: los ejecuta una pasada de `/spec-impl` posterior, lanzada por el usuario, una vez este spec pase de `Draft` a `Approved`.
