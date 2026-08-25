# SPEC 11 — Rendimiento de ASTEROIDES: allocations y churn de arrays por fotograma

> **Estado:** Draft
> **Depende de:** SPEC 05
> **Fecha:** 2026-08-25
> **Objetivo:** Documentar y planificar, sin implementarlo, el saneamiento de las allocations y el churn de arrays que `lib/games/asteroides/engine.ts` genera en cada fotograma, con criterios de aceptación anclados a una medición real de `requestAnimationFrame`.

---

## 1 — Por qué existe este spec

Este es el primer spec de rendimiento sobre un motor de Arcade Vault. No hay precedente de qué forma debe tener un criterio de aceptación de FPS en este repo, así que este documento fija el patrón: cada hallazgo del audit estático se ancla a un número medido, no a una intuición ("esto parece caro"), y cada criterio de aceptación repite la misma metodología de muestreo para que el "antes" y el "después" sean comparables.

El alcance es exclusivamente `lib/games/asteroides/engine.ts`. En paralelo se están auditando `tetris`, `arkanoid`, `vibora` y `frogger` en specs propios — este documento no los menciona ni depende de ellos.

---

## 2 — Alcance

**Dentro:**

- El motor `lib/games/asteroides/engine.ts`: sus clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, y las funciones `update`, `draw` y `loop` del cierre de `createEngine`.
- Allocations de arrays y objetos por fotograma detectadas en el audit estático (§ más abajo).
- Medición de frame time real de `/jugar/asteroides` con Playwright, en reposo (sin input del jugador).

**Fuera de alcance (para specs futuros):**

- Cualquier otro motor (`tetris`, `arkanoid`, `vibora`, `frogger`) — cada uno tiene su propio spec de rendimiento en paralelo.
- Cambiar el contrato de la plataforma: `lib/games/engine.ts`, `components/games/game-canvas.tsx`, `lib/games/registry.ts`.
- Cambiar el balance de juego de ASTEROIDES: velocidades, puntuaciones, probabilidad de power-up, tamaños de asteroide. El §4 solo reordena cómo se calcula lo mismo, nunca cuánto vale.
- Implementar el arreglo. Este spec solo lo planifica y lo mide; la implementación es una pasada futura de `/spec-impl`.
- Añadir un arnés de pruebas automatizado de rendimiento (tipo `scripts/prueba-tetris.mjs` pero cronometrado). Si se decide que hace falta, es tema de otro spec.

---

## 3 — Modelo de datos

Este spec no introduce estructuras de datos nuevas. Reutiliza el contrato de la plataforma (`GameSnapshot`, `GameEngine`) tal cual está en `lib/games/engine.ts`, y las clases internas ya existentes en `lib/games/asteroides/engine.ts` (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`), a las que el plan de implementación solo les cambia la forma en que se crean y se descartan, no sus campos.

---

## 4 — Hallazgos del audit estático

Todos referidos a `lib/games/asteroides/engine.ts`, con línea del código auditado el 2026-08-25:

1. **`newAsteroids` se asigna en cada fotograma, haya o no colisión** (línea 528: `const newAsteroids: Asteroid[] = [];`). El array se crea siempre dentro de `update()`, incluso en los fotogramas —la inmensa mayoría— donde ninguna bala toca ningún asteroide, para acabar concatenándose vacío en la línea 548.

2. **Cinco `.filter()` que reconstruyen el array entero, algunos duplicados en el mismo fotograma**:
   - `bullets = bullets.filter((b) => !b.dead)` aparece **dos veces** en el mismo paso de `update()` en estado `"playing"`: línea 516 (tras `update`) y línea 549 (tras la colisión bala↔asteroide), sin que nada mute `bullets` entre medias salvo marcar `.dead`. Es un recorrido y una allocation de array de más por fotograma.
   - `particles = particles.filter((p) => !p.dead)` — línea 517 (estado `"playing"`), y también en líneas 489 y 496 para los estados `"gameover"` y `"dead"`. Se ejecuta cada fotograma en los tres estados, siempre, aunque no haya ninguna partícula muerta que limpiar.
   - `powerUps = powerUps.filter((p) => !p.dead)` — línea 518, cada fotograma, aunque casi siempre haya cero o un power-up en juego.
   - `asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids)` — línea 548, cada fotograma, con un `.concat()` adicional que crea un tercer array aunque `newAsteroids` esté vacío.

   Ninguno de los cuatro arrays se compacta in-place; los cuatro se reconstruyen enteros cada fotograma independientemente de si hubo alguna baja real.

3. **Colisión bala↔asteroide es O(bullets × asteroids)** (líneas 529–547), bucle anidado sin partición espacial. Con el balance actual (`ship.tryShoot()` dispara hasta 3 balas con `tripleShot`, `spawnAsteroids` arranca en 4 y sube a `3 + level` cada nivel) el tamaño típico ronda 3–9 balas × 4–15 asteroides ≈ 27–135 comparaciones/fotograma: barato hoy, pero crece sin cota con el nivel porque `spawnAsteroids(3 + level)` no tiene techo.

4. **`Particle.draw()` construye una cadena `rgba(...)` nueva por partícula y por fotograma** (línea 342: `` `rgba(255,255,255,${alpha.toFixed(2)})` ``). Cada explosión crea hasta `size * 5` partículas (línea 535, tamaño máximo 3 → 15 partículas, y `killShip()` crea 14 más en la línea 449), y cada una vive hasta 1.1 s reconstruyendo su color en cada fotograma en vez de precalcular un valor de alpha cuantizado o usar `globalAlpha`.

5. **No hay _pool_ de `Bullet`, `Asteroid` ni `Particle`.** Cada disparo, cada división de asteroide (línea 137) y cada explosión (línea 445) crea instancias nuevas con `new`, que el motor de recolección de basura tiene que barrer después vía los `.filter()` del punto 2. Con las tasas de disparo (cooldown de 0.2 s, línea 263) y de asteroides del juego, el volumen de objetos vivos a la vez es bajo (unas pocas decenas), así que el coste hoy es más de churn de GC que de cómputo por fotograma.

6. **No hay gradientes, `shadowBlur` ni nodos de audio que auditar.** ASTEROIDES no usa `createLinearGradient`/`createRadialGradient` ni `shadowBlur`/`shadowColor` en ningún `draw()`, y `audio: false` en el registro se cumple con `setMuted(){}` vacío: no hay `Audio`/`AudioContext` en este motor. Estas dos categorías del checklist habitual no aplican a ASTEROIDES y no generan hallazgo.

---

## 5 — Medición de FPS reales (línea base, 2026-08-25)

Metodología: servidor de `next dev` levantado con la skill `run`, navegación a `http://localhost:3000/jugar/asteroides` con `mcp__playwright__browser_navigate`, y un muestreador inyectado con `mcp__playwright__browser_evaluate` que encadena `requestAnimationFrame` durante una ventana continua, guarda el delta entre timestamps consecutivos y calcula media, máximo y porcentaje de fotogramas por encima de 16.7 ms y 33 ms. Sin input del jugador: la nave deriva sola, los asteroides ya están en movimiento por defecto.

| Métrica                              | Valor medido |
| ------------------------------------ | ------------ |
| Ventana muestreada                   | 3.0 s        |
| Muestras (`n`)                       | 154          |
| Frame time medio                     | 19.48 ms     |
| Frame time máximo                    | 33.6 ms      |
| % de fotogramas > 16.7 ms (< 60 fps) | 51.95 %      |
| % de fotogramas > 33 ms (< 30 fps)   | 16.88 %      |

**Limitación honesta, primera parte:** esta medición corre en reposo, sin simular una partida jugada con muchas naves/asteroides/balas vivos a la vez — mide el coste base del bucle `update`+`draw` con la carga inicial de nivel 1 (4 asteroides, 0 balas, 0 partículas), no el pico de estrés de niveles avanzados o de una ráfaga de disparo triple contra un enjambre. Los hallazgos del §4 (colisión O(n²), churn de `.filter()`) escalan con el número de entidades vivas, así que el peor caso real es más caro que lo que refleja esta tabla.

**Limitación honesta, segunda parte:** el navegador de Playwright de este entorno se comparte con otros agentes que auditaban `tetris`, `arkanoid`, `vibora` y `frogger` en paralelo en la misma sesión. Varios intentos de muestreo se descartaron porque, a mitad de la ventana, otro agente navegaba la misma pestaña a su propio `/jugar/<id>` y destruía el contexto de ejecución (`Execution context was destroyed, most likely because of a navigation`) o incluso completaba la ventana entera sobre la URL de otro juego sin que el `location.href` devuelto coincidiera con ASTEROIDES. La tabla de arriba es la única muestra de 3 segundos capturada de punta a punta con `location.href` confirmado en `/jugar/asteroides`; no se pudo lograr una segunda muestra limpia para promediar por la contención del navegador compartido, y la ventana se acortó de los 8-10 s recomendados a 3 s para maximizar la probabilidad de completarla antes de que otro agente navegase. Los números de esta tabla deben tratarse como indicativos de orden de magnitud, no como una medición aislada de laboratorio: parte del frame time registrado puede deberse a que la CPU del host estaba compartida con otras instancias de Chromium ejecutando los mismos cinco motores a la vez, no solo al coste propio de ASTEROIDES. Antes de fijar el criterio de aceptación del §6 en una pasada de `/spec-impl`, hay que re-muestrear en una sesión de Playwright exclusiva, sin otros agentes compitiendo por CPU.

No se registraron errores ni warnings en `mcp__playwright__browser_console_messages` durante la carga de `/jugar/asteroides`.

---

## 6 — Plan de implementación

Cada paso deja el motor compilando y jugable.

1. **Sustituir el `.concat(newAsteroids)` y el doble filtro de `bullets` por una sola pasada compactadora por array**, escrita como una función reutilizable dentro del propio fichero (p. ej. `compactAlive<T extends { dead: boolean }>(list: T[]): T[]`) que recorra el array una vez y reescriba in-place los elementos vivos, devolviendo el mismo array truncado con `.length` en vez de crear uno nuevo con `.filter()`. Se aplica a `bullets`, `particles`, `powerUps` y `asteroids`. _Verificable:_ una partida completa (disparar, partir asteroides, perder una vida, subir de nivel) se comporta igual a simple vista; `npm run build` sigue en verde.
2. **Eliminar la doble llamada a `bullets = bullets.filter(...)` dentro de `update()`**, dejando una sola compactación después del bucle de colisión bala↔asteroide, ya que es ahí donde `bullets` puede haber cambiado de verdad. _Verificable:_ disparar sigue destruyendo asteroides y las balas gastadas desaparecen igual que antes.
3. **Evitar la allocation de `newAsteroids` en fotogramas sin colisión**, empujando los asteroides nuevos directamente sobre el array `asteroids` según se generan en el bucle de colisión (o usando un array reutilizado entre fotogramas, vaciado con `.length = 0` en vez de recreado con `[]`) en lugar de crear un array literal en cada llamada a `update()`. _Verificable:_ dividir un asteroide grande sigue generando dos más pequeños del tamaño correcto.
4. **Cachear el color de `Particle.draw()`** precalculando un `alpha` cuantizado (p. ej. redondeado a dos decimales, como ya hace `toFixed(2)`) solo cuando cambia de valor entre fotogramas, o sustituyendo la cadena `rgba(...)` por `ctx.globalAlpha` + un `strokeStyle` blanco fijo, que evita construir una cadena nueva por partícula y por fotograma. _Verificable:_ las explosiones se ven con el mismo desvanecimiento a simple vista.
5. **Poner techo o pool a `spawnAsteroids(3 + level)`** si el paso 3 de medición confirma que niveles altos degradan el frame time por el crecimiento sin cota de asteroides vivos; de lo contrario, dejar constancia en el spec de implementación de por qué no hizo falta. _Verificable:_ jugar hasta el nivel 5 sin caída perceptible de frame time frente al nivel 1, con el mismo muestreador del §5.
6. **Introducir un pool simple de `Bullet` y `Particle`** (arrays de instancias reutilizables marcadas libres/ocupadas en vez de `new` en cada disparo/explosión) solo si la medición posterior a los pasos 1-4 sigue mostrando presión de GC visible en el `maxMs` del muestreador; si los pasos 1-4 ya bajan el `% > 16.7ms` por debajo del umbral del §7, este paso queda documentado como descartado, no como pendiente. _Verificable:_ el frame time máximo del muestreador del §5 baja frente al valor de esa misma tabla.

---

## 7 — Criterios de aceptación

Medidos con la misma metodología del §5 (`requestAnimationFrame` muestreado con Playwright sobre `/jugar/asteroides`, sin input del jugador, en una sesión de Playwright sin otros agentes compitiendo por CPU), tras implementar el plan del §6:

- [ ] El frame time medio de una ventana de al menos 8 s en `/jugar/asteroides` es ≤ 16.7 ms, frente a los 19.48 ms medidos en el §5 (ventana de 3 s, con la salvedad de contención de CPU ya anotada).
- [ ] El porcentaje de fotogramas por encima de 16.7 ms baja de 51.95 % a menos del 10 %.
- [ ] El porcentaje de fotogramas por encima de 33 ms baja de 16.88 % a 0 %.
- [ ] `update()` ya no contiene ninguna llamada a `.filter()` que reconstruya `bullets`, `particles`, `powerUps` o `asteroids` en cada fotograma; la compactación es in-place.
- [ ] `bullets` se compacta una sola vez por fotograma, no dos.
- [ ] `newAsteroids` (o su reemplazo) no se asigna con un literal `[]` nuevo en fotogramas sin colisión bala↔asteroide.
- [ ] `Particle.draw()` no construye una cadena `rgba(...)` nueva por partícula y por fotograma.
- [ ] Jugar una partida completa (mover, disparar, partir asteroides, perder las tres vidas, ver el modal de fin de partida) se comporta igual que antes de este spec: mismas puntuaciones por tamaño de asteroide, mismo comportamiento de `tripleShot`, mismo `POWERUP_DROP_CHANCE`.
- [ ] `npm run build` y `npm run lint` pasan sin avisos nuevos.
- [ ] `lib/games/engine.ts` no tiene ni una línea de diferencia.
- [ ] `lib/games/registry.ts` no tiene ni una línea de diferencia salvo que una futura pasada decida que hace falta (no previsto por este spec).
- [ ] Ningún error ni warning nuevo aparece en `mcp__playwright__browser_console_messages` al jugar una partida completa.

---

## 8 — Decisiones tomadas y descartadas

- **Sí: compactar arrays in-place en vez de seguir con `.filter()`.** `.filter()` es legible y es lo que ya usan los otros motores, pero recrea el array entero cada fotograma exista o no una baja que limpiar; para un bucle que corre 60 veces por segundo durante toda la partida, es la allocation más fácil de evitar sin tocar el balance del juego.
- **No: quitar la explosión de partículas o reducir su cantidad para bajar el coste.** Es un cambio de balance/estética, no de rendimiento — el §2 lo deja fuera de alcance explícitamente. El punto 4 del §6 ataca el coste de _dibujar_ cada partícula (la cadena `rgba`), no cuántas partículas hay.
- **Sí: cachear el color de partícula antes que introducir un sistema de partículas con buffer de vértices o WebGL.** El motor sigue siendo Canvas 2D por decisión de la SPEC 05; migrar el renderizado sería un cambio de arquitectura que ningún hallazgo de este audit justifica.
- **Condicional: pool de `Bullet`/`Particle` (punto 6 del §6) solo si hace falta.** Con las tasas de disparo y de partículas actuales, el volumen de objetos vivos a la vez es bajo (decenas, no cientos); introducir un pool sin necesidad medida sería complejidad sin beneficio demostrado. Se deja como paso condicionado a la medición, no como obligación de esta pasada.
- **No: poner techo a `spawnAsteroids(3 + level)` de entrada.** Cambiar cuántos asteroides aparecen por nivel es una decisión de balance de juego, fuera del alcance de un spec de rendimiento; el punto 5 del §6 solo lo activa si la medición demuestra que hace falta, y en ese caso habría que decidir el techo en coordinación con quien mantenga el balance de ASTEROIDES.
- **No: extender `scripts/prueba-tetris.mjs` o escribir un arnés equivalente cronometrado para ASTEROIDES.** El §2 ya lo excluye. La medición de este spec se apoya en Playwright porque necesita un `requestAnimationFrame` real de un navegador, no el reloj manual que usa ese arnés.

---

## 9 — Riesgos

| Riesgo                                                                                                                                                                                                               | Mitigación                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La compactación in-place del §6 introduce un bug sutil de índices (saltarse o duplicar un elemento) que solo se nota jugando varias partidas, no leyendo el diff.                                                    | El paso 1 del plan pide una partida jugada completa como verificación manual antes de seguir al paso 2; no basta con que compile.                                                                                           |
| Los números del §5 están inflados por la contención de CPU del navegador compartido entre agentes, y el criterio de aceptación del §7 se fija sobre un "antes" que no refleja el coste real y aislado de ASTEROIDES. | El propio §5 lo deja anotado como limitación, y el §7 exige remedir con la misma metodología en una sesión sin otros agentes antes de dar el criterio por cumplido — no basta con comparar contra la tabla del §5 tal cual. |
| Cachear el color de partícula (punto 4 del §6) con un valor cuantizado en vez de recalcularlo cada fotograma puede introducir un salto visible en el desvanecimiento si la cuantización es demasiado gruesa.         | El paso 4 pide verificación visual explícita ("se ven con el mismo desvanecimiento a simple vista") antes de darlo por bueno.                                                                                               |
| El pool condicional de `Bullet`/`Particle` (punto 6) se implementa "por si acaso" sin que la medición lo pida, añadiendo complejidad sin beneficio.                                                                  | El punto 6 y la decisión del §8 lo atan explícitamente a que los pasos 1-4 no basten; si bastan, queda documentado como descartado en la pasada de implementación, no como pendiente eterno.                                |

---

## Lo que **no** está en este spec

- Ningún otro motor de juego: `tetris`, `arkanoid`, `vibora` y `frogger` tienen (o tendrán) su propio spec de rendimiento.
- Ningún cambio al contrato de la plataforma (`lib/games/engine.ts`, `components/games/game-canvas.tsx`, `lib/games/registry.ts`).
- Ningún cambio de balance de juego: puntuaciones, velocidades, probabilidad de power-up, número de asteroides por nivel.
- La implementación del plan del §6. Este documento la planifica y la ancla a números medidos; se ejecuta en una pasada futura de `/spec-impl` sobre este spec ya `Aprobado`.
