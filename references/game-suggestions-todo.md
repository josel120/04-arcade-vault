# Juegos sugeridos — to-do de Arcade Vault

Lo mantiene el agente `game-planner` (`.claude/agents/game-planner.md`): lo lee antes de
proponer nada y lo actualiza al terminar. Es su memoria entre sesiones — un subagente
arranca en frío, así que lo que no esté escrito aquí, no ha pasado.

**Estados:** `siguiente` (elegido para el próximo spec) · `pendiente` (propuesto, sin
decidir) · `implementado` · `descartado`.

**Formato de entrada:**

- [ ] **TÍTULO** (`id`) — qué es y por qué encaja, en una línea
  - Sugerido: AAAA-MM-DD · Motor: bajo|medio|alto · Ficha: ya en catálogo | nueva
  - Notas: veredicto, riesgos, qué haría falta

---

## Siguiente

_(vacío — a la espera de la primera ronda del agente)_

---

## Pendientes

Las ocho fichas que están en el catálogo con portada CSS y sin motor. No las ha evaluado
todavía el agente: entran aquí como inventario de partida, no como recomendación.

- [ ] **BLOQUE BUSTER** (`bloque-buster`) — rompeladrillos; ficha ARCADE, portada `cover-bricks`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: mecánica solapada con `arkanoid`, que ya tiene motor. Hace falta argumentar
    qué aporta de distinto antes de considerarlo.

- [ ] **CAÍDA** (`caida`) — piezas que caen; ficha PUZZLE, portada `cover-tetro`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: mecánica solapada con `tetris`. Mismo problema que `bloque-buster`.

- [ ] **SERPENTINA** (`serpentina`) — serpiente; ficha ARCADE, portada `cover-snake`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: mecánica solapada con `vibora`, el último juego implementado (SPEC 10).

- [ ] **GLOTÓN** (`gloton`) — comecocos en laberinto; ficha ARCADE, portada `cover-glot`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: mecánica nueva en la plataforma. El coste está en la IA de los perseguidores
    y en los datos del laberinto; hay que estimarlo antes de proponerlo.

- [ ] **INVASORES** (`invasores`) — formación que baja y dispara; ficha SHOOTER, portada `cover-invaders`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: mecánica nueva. Colisión rectángulo-rectángulo y patrón de movimiento en
    bloque; a primera vista es de los más baratos del inventario.

- [ ] **ROCAS** (`rocas`) — rocas que se parten; ficha SHOOTER, portada `cover-rocas`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: mecánica solapada con `asteroides`, que ya tiene motor.

- [ ] **RANARIA** (`ranaria`) — cruzar carriles con tráfico; ficha ARCADE, portada `cover-rana`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: mecánica nueva. Movimiento por rejilla y carriles con obstáculos; hay que
    definir cómo se puntúa, porque el original puntúa por travesía completada.

- [ ] **DUELO PIXEL** (`duelo-pixel`) — versus a dos; ficha VERSUS, portada `cover-duelo`
  - Sugerido: 2026-08-24 · Motor: sin estimar · Ficha: ya en catálogo
  - Notas: es la única ficha de la categoría VERSUS. Choca de frente con el criterio del
    marcador: la plataforma guarda una puntuación individual por partida, así que un
    versus necesita una regla de puntuación inventada. Decisión de diseño, no de motor.

---

## Implementados

- [x] **ASTEROIDES** (`asteroides`) — SPEC 05, 2026-08-21. Portado de
      `references/started-games/02-asteroids`. Física continua con inercia.
- [x] **TETRIS** (`tetris`) — SPEC 08, 2026-08-24. Portado de
      `references/started-games/03-tetris`. Rejilla + `lib/games/tetris/pieces.ts`.
- [x] **ARKANOID** (`arkanoid`) — SPEC 09, 2026-08-24. Portado de
      `references/started-games/04-arkanoid`. Reflexión de ángulos +
      `lib/games/arkanoid/levels.ts`. Primer juego con sonido.
- [x] **VÍBORA** (`vibora`) — SPEC 10, 2026-08-24. Sin original: escrito desde cero sobre
      `motor-plantilla.ts`. Rejilla pura, el motor más barato de los cuatro.

---

## Descartados

_(vacío)_
