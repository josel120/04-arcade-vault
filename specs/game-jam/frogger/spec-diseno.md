# SPEC (GAME JAM) — FROGGER: cruzar sin miedo la autopista de neón

> Estado: Implementado — game jam, pendiente de decisión (no implementado)
> Tema: «Frogger» (juego dirigido explícitamente por el usuario, no elegido a partir de un
> tema libre — ver §6 para el porqué de esta salvedad al proceso habitual de `game-jam`)
> Depende de (si se construye): SPEC 05, SPEC 06, SPEC 07, SPEC 09
> Fecha: 2026-08-25
> Compañero: spec-implementacion.md, en esta misma carpeta

---

## 1 — Por qué este juego, para este tema

El "tema" de este spec no es una palabra suelta de game jam: es un encargo directo del
usuario, que ya tenía una carpeta `specs/game-jam/frogger/` con un spec previo de Frogger
(`01-frogger-core.md`) escrito contra una arquitectura que este proyecto ya no usa —
componente React con props en vez de `GameEngine`, rutas `app/games/<id>/play/` en vez de
`/juego/[id]` y `/jugar/[id]`, `lib/supabase/types.ts` en vez de `lib/catalog.ts` /
`lib/leaderboard.ts`. Ese fichero antiguo no lo escribe ni lo toca este spec — se queda
intacto como referencia histórica — pero **su diseño de juego** (cuadrícula, tres zonas,
tortugas que se sumergen, temporizador de ronda) es sólido y clásico, y se reutiliza aquí
como punto de partida, adaptado al contrato de motor vigente.

Frogger encaja con el catálogo de Arcade Vault exactamente como encajó VÍBORA (SPEC 10):
es un juego de rejilla, sin física continua, con las cuatro flechas como único control, y
sin original en `references/started-games/` — se escribe desde cero sobre
`motor-plantilla.ts`. La mecánica central (cruzar hacia arriba esquivando tráfico y luego
flotando sobre un río) no comparte ni una línea con los cuatro motores reales de hoy
(`asteroides`, `tetris`, `arkanoid`, `vibora`): no hay inercia, no hay piezas que caen, no
hay pelota que rebota, no hay serpiente que crece. Aporta una capa de mecánica que el
catálogo todavía no tiene — **soporte pasivo**: la rana no controla su desplazamiento
horizontal en el río, lo hereda del tronco o la tortuga bajo sus patas, y perderlo mata sin
que el jugador haya tocado ninguna tecla en ese instante. Es la primera vez que la
plataforma pide "quédate quieto y deja que el mundo te lleve" como mecánica de
supervivencia.

## 2 — Alcance

**Dentro:**

- **Ficha nueva `frogger`** en `public.games` y en `FALLBACK_GAMES` (categoría ARCADE,
  color `magenta`, `sort_order` 130 — ver §6 sobre por qué ficha nueva y no motor para
  `ranaria`, que ya existe en el catálogo con la misma idea de juego).
- **Portada `.cover-frogger`** en `app/globals.css`, diseñada con `/frontend-design`,
  distinguible a tamaño de tarjeta de `.cover-rana` (RANARIA, su gemela de maqueta).
- **Motor nuevo** en `lib/games/frogger/engine.ts`, sobre una rejilla de 20 × 15 celdas de
  40 px que llena el lienzo fijo de 800 × 600 exacto — sin tocar `.game-canvas` ni su
  `aspect-ratio: 4 / 3`.
- **Tres zonas verticales**: fila de metas (arriba), seis carriles de río, una fila segura
  central, cinco carriles de carretera, y dos filas de inicio (abajo).
- **Movimiento de la rana por saltos discretos** de una celda, con una animación corta de
  desplazamiento — nunca continuo — en las cuatro direcciones, mapeadas a
  `left` / `right` / `thrust` (arriba) / `down` (abajo), exactamente como VÍBORA. **Cero
  coste de plataforma**: no hace falta ampliar `GameAction` ni `GAME_KEYS`.
- **Vehículos en los carriles de carretera** (coches de 1-2 celdas, camiones de 3), en
  loop horizontal continuo por carril, mortales al contacto.
- **Troncos y tortugas en los carriles del río**: la rana sobrevive en el río solo si está
  sobre un tronco o sobre una tortuga visible; se mueve con la velocidad del carril
  mientras dura el apoyo. Las tortugas alternan entre visibles y sumergidas con un ciclo
  temporizado; sumergida, no sirve de apoyo.
- **Cinco bocas de meta**, cada una ocupable una sola vez por ronda; llenar las cinco
  completa la ronda y empieza la siguiente con las velocidades un 15 % más rápidas y el
  temporizador de ronda más corto.
- **Temporizador de ronda visible**, con muerte al agotarse.
- **Tres vidas**, muerte por vehículo, por caída al agua, por tortuga que se sumerge bajo
  la rana, por salir de los bordes laterales del río o por agotar el tiempo.
- **Puntuación**: avance por primera vez en la ronda, ocupar una meta, completar la ronda,
  y bonus por tiempo restante al llegar a una meta.
- **Sonido sintetizado con WebAudio** (salto, splash/choque, meta ocupada, ronda
  completada), siguiendo el contrato de audio de SPEC 09 / SPEC 10: `audio: true`,
  `setMuted` real, `AudioContext` perezoso y cerrado en `destroy`.
- **`setSkin` implementado** como exige el contrato actual de `GameEngine` — de entrada
  vacío (el lienzo se queda en `"clasico"`; el chrome de alrededor ya cambia solo por
  `data-skin` en `.av-player`), a falta de que una fase posterior de skins le dé paleta
  propia en canvas, igual que hoy tienen pendiente ASTEROIDES y TETRIS.
- **Entrada en `lib/games/registry.ts`**: lienzo 800×600, cuatro flechas, botonera táctil
  de cuatro botones repartidos en dos grupos (igual que VÍBORA), `audio: true`.

**Fuera de alcance:**

- **Sprites bitmap** — todo se dibuja con primitivas de canvas (rectángulos, círculos,
  formas compuestas) y gradientes, como el resto de motores nativos de la casa.
- **Controles táctiles alternativos** más allá de los cuatro botones de dirección — nada de
  gestos de arrastre.
- **Animaciones de muerte elaboradas** (explosiones, partículas, splash animado con
  físicas) — un parpadeo corto y el modal de fin de partida bastan, igual que en VÍBORA.
- **Power-ups** (mosca bonus en la meta, cocodrilo disfrazado de tronco) — capa de
  recompensa y riesgo independiente de la mecánica base; se deja para un spec futuro si se
  decide perseguirla.
- **Ponerle motor a `ranaria`.** Se queda con su maqueta y su puntuación simulada, igual
  que SERPENTINA, CAÍDA, BLOQUE BUSTER y ROCAS. Ver §6.
- **Modo a dos jugadores.**
- **Tocar el contrato de la plataforma**: ni una acción nueva en `GameAction`, ni un campo
  nuevo en `GameSnapshot`, ni cambios en `lib/games/engine.ts`, `components/game-player.tsx`
  ni `components/games/game-canvas.tsx`.
- **Carteles dibujados en el lienzo** (puntuación, vidas, nivel, "PAUSA", "GAME OVER") — los
  pinta React, como en los otros cuatro motores.
- **Anti-trampas ni banco de pruebas propio.**

---

## 6 — Decisiones tomadas y descartadas

**Ficha nueva `frogger`, con `ranaria` intacta.** Es la decisión más discutible de este
spec, y se tomó explícitamente con el usuario antes de escribir una sola línea: la
alternativa — ponerle motor a `ranaria`, la ficha ARCADE ya publicada con la misma idea de
juego (`cover-rana`, verde, `sortOrder` 70, y ya evaluada como candidata en
`references/game-suggestions-todo.md`) — se ahorra la migración, `FALLBACK_GAMES` y la
portada CSS enteros, y es el patrón que el propio proyecto prefiere ("poner motor a una
ficha existente es más limpio", Fase 1 de `/nuevo-juego`). Se descarta a favor de la ficha
nueva porque el punto de partida de este spec era la carpeta ya existente
`specs/game-jam/frogger/`, con `id = frogger` fijado desde antes de este documento, y
porque el usuario, puesto ante la disyuntiva, prefirió mantener ese `id`. El precedente
directo es VÍBORA / SERPENTINA (SPEC 10): ahí también se valoró en serio reutilizar la
ficha maqueta y se descartó para no convertir "maqueta y motor son fichas distintas" en una
regla con excepciones. El coste asumido es el mismo que allí: el catálogo gana una
duodécima… decimotercera entrada de la que otra es su sombra — hoy quedarían **dos**
fichas de Frogger, una maqueta (`ranaria`) y una con motor (`frogger`). Si en el futuro se
decide que es demasiada duplicación, la vía de salida está documentada: retirar `ranaria`
del catálogo (o describirla como un juego distinto de verdad) es un spec aparte, no algo
que este documento resuelva.

**FROGGER y no un nombre propio en español.** Rompe con la regla que sí siguió VÍBORA
("nombre propio, sin marca registrada") y con la que llevó a bautizar `ranaria` en vez de
"rana-x" o el nombre comercial. Se acepta porque, igual que ASTEROIDES, TETRIS y ARKANOID
llevan el nombre real del clásico que portan (SPEC 05, 08, 09), aquí el usuario pidió
explícitamente mantener el `id`/título `frogger` heredado de la carpeta y del spec legado,
y ese es el mismo criterio editorial que ya se aplicó a los tres ports con motor real. Es
un riesgo de marca distinto al de un port (aquí no hay código fuente original que copiar,
solo el nombre), y queda anotado en el §7 por si una política de marca más estricta obliga
a rebautizarlo más adelante — el cambio sería solo de `title`/textos, no de mecánica.

**Color `magenta`, no `green`.** `ranaria` ya usa verde, y las otras dos fichas verdes de
ARCADE (`serpentina`, `vibora`) forman el mismo patrón de gemelas maqueta/motor que aquí se
repite. Ponerle también verde a `frogger` haría que la Biblioteca tuviera **tres** tarjetas
verdes de temática "criatura en rejilla" seguidas. Magenta está sin usar hoy dentro de
ARCADE (solo lo lleva CAÍDA, que es PUZZLE), así que separa visualmente a `frogger` de su
gemela `ranaria` de un vistazo, sin depender del título.

**Rejilla de 20 × 15 celdas de 40 px, llenando el lienzo 800 × 600 exacto.** El spec legado
usaba un lienzo propio de 480 × 640 (vertical, ajustado al juego). El contrato actual fija
800 × 600 para los cuatro motores reales y `.game-canvas` asume `aspect-ratio: 4 / 3`; tocar
eso es justo lo que este spec tiene prohibido. La opción barata — y la que ya usa TETRIS,
que tampoco es un tablero naturalmente 4:3 — es diseñar la rejilla para que quepa en el
lienzo fijo en vez de al revés. 20 × 15 celdas de 40 px encajan sin resto ni margen muerto:
5 carriles de carretera, 6 de río, 1 fila segura central, 1 fila de metas y 2 filas de
inicio suman exactamente 15 filas.

**Cinco metas de cuatro columnas cada una**, en vez de las cinco de dos columnas del spec
legado (16 columnas ÷ 5 no encaja limpio; 20 ÷ 5 sí). Es la misma mecánica, solo recalculada
para la rejilla nueva.

**Tortugas con ciclo de inmersión, mantenidas del spec legado.** Es lo que diferencia
Frogger de "VÍBORA con carriles": gestión de riesgo por temporizador, no solo esquivar. Se
mantiene el ciclo 3 s visible / 1,5 s sumergida del spec original porque no hay razón para
cambiarlo — no depende de la rejilla, solo del reloj.

**Salto discreto con animación de 120 ms, sin interpolación libre.** Mismo argumento que la
SPEC 10 sobre el paso fijo de VÍBORA: la legibilidad de "en tres saltos estaré aquí" es el
juego. Se mantiene el número del spec legado (120 ms) por no tener motivo para inventarse
otro sin haber jugado ni una partida — el paso 4 del plan de implementación obliga a
calibrarlo jugando, igual que hizo VÍBORA con su velocidad de avance.

**Sonido desde el primer motor (`audio: true`) y no mudo.** ARKANOID y VÍBORA ya
establecieron el contrato de audio sintetizado con WebAudio; no adoptarlo aquí sin motivo
sería un paso atrás. El coste es bajo (cuatro avisos cortos) y el género —tráfico, agua,
impacto— se presta mejor a sonido que Tetris o Asteroides, que siguen mudos por herencia
del port original, no por decisión de diseño.

**`setSkin` declarado pero vacío.** El motor nace después de que el contrato de
`GameEngine` ya exige `setSkin` (a diferencia de SPEC 08/09/10, escritas antes de que
existiera el sistema de skins). Implementarlo vacío —el lienzo se queda en `"clasico"`— dej
a el motor cumpliendo el contrato sin adelantar trabajo que le corresponde a una fase de
skins dedicada, igual que hoy tienen ASTEROIDES y TETRIS.

**Es un Frogger, no se moderniza.** Ni power-ups, ni cocodrilos disfrazados de tronco, ni
modo a dos jugadores, ni pantallas con formas. Cada uno de esos es una decisión de diseño
que este spec no necesita para tener un juego completo y jugable.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                                                         | Mitigación                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **La rejilla 20×15 es una recalibración del diseño legado (16×14), no una copia**: los números de velocidad y densidad de carriles pueden no trasladarse limpios a la proporción nueva.                                                                                                                        | El paso de calibrado del plan de implementación exige jugar varias rondas completas antes de dar el motor por bueno, con criterios de aceptación cronometrados sobre pasos por segundo y densidad de huecos atravesables.                                                |
| **El río rompe la alineación a rejilla**: mientras la rana está sobre un tronco, su posición horizontal deja de ser un múltiplo exacto de `CELL` (hereda velocidad continua del carril). Es la misma trampa de estimación que ya anotó `game-planner` para `ranaria` en `references/game-suggestions-todo.md`. | El motor guarda la posición de la rana en río como coordenada continua (`col: number`, no entero) mientras `onRaft === true`, y la vuelve a redondear al saltar de nuevo. Hay criterio de aceptación específico sobre que un salto siempre aterriza en una celda entera. |
| **Duplicación de catálogo**: `ranaria` y `frogger` son el mismo juego clásico con dos fichas. Un jugador que no conozca el historial puede verlo como un error del catálogo, no como una decisión.                                                                                                             | Documentado en el §6 con el mismo razonamiento que ya validó la casa para VÍBORA/SERPENTINA; los textos de `short`/`long` de `frogger` en `spec-implementacion.md` se escriben para no repetir literalmente los de `ranaria`.                                            |
| **Riesgo de marca por el título literal `FROGGER`.**                                                                                                                                                                                                                                                           | Anotado en el §6. El cambio, si hace falta, es solo de `title`/`short`/`long`, no de `id` ni de mecánica — mismo alcance que retitular cualquier otra ficha.                                                                                                             |
| **Cinco carriles de tráfico y seis de río compitiendo por rendimiento de dibujo** — es más entidades por fotograma que ningún motor actual de la casa.                                                                                                                                                         | Todas las entidades por carril se recorren desde un array plano por carril, sin estructuras anidadas; el paso 9 del plan mide fotogramas por segundo con las herramientas del navegador antes de cerrar el spec como implementado.                                       |
| **La cola de temporizadores** (ronda, muerte, inmersión de tortugas, animación de salto) puede desincronizarse si alguno no se limpia en `destroy()` o al reiniciar.                                                                                                                                           | Ningún `setTimeout`: todos los temporizadores son contadores en el propio `update(dt)`, siguiendo el patrón de `dt` capado de VÍBORA. `destroy()` solo cancela el `requestAnimationFrame` y cierra el `AudioContext` — no hay nada más que limpiar.                      |

---
