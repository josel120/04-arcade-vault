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

- [ ] **INVASORES** (`invasores`) — formación alienígena que baja y dispara; el candidato
      más barato del inventario y el único que no obliga a inventar ni una regla
  - Sugerido: 2026-08-24 · Revisado: 2026-08-24 · Motor: bajo-medio · Ficha: ya en catálogo
    (SHOOTER, `cover-invaders`, `green`, `sortOrder` 50)
  - Notas: **recomendado en la ronda del 2026-08-24.** Se ahorra la Fase 2 (migración +
    `FALLBACK_GAMES`) y la Fase 3 (portada CSS) enteras, porque la ficha ya está en el
    catálogo con portada propia.
    - Marcador: nativo del original — 10/20/30 puntos según la fila del invasor, OVNI
      entre 50 y 300. Nada que inventar.
    - Vidas y nivel: nativos (3 vidas, oleada = nivel). `GameSnapshot` se llena sin
      trampas, al contrario que TETRIS, que no tiene vidas.
    - Controles: `left`, `right`, `fire`. Tres de las cinco acciones que ya existen; las
      teclas ya están en `GAME_KEYS`. **Cero coste de plataforma.**
    - Motor: la formación se mueve en bloque a pasos (no hay física continua ni inercia),
      la colisión es rectángulo contra rectángulo, y la aceleración clásica sale sola de
      `intervalo = f(invasores vivos)`. Los dibujos de los invasores caben en matrices
      booleanas en un fichero hermano, con el precedente de `lib/games/tetris/pieces.ts`.
    - Riesgo único y decisión de alcance: **los búnkeres**. La destrucción por píxeles del
      original es la parte cara. La variante barata es un búnker hecho de subceldas que se
      apagan al recibir impacto, que sigue siendo AABB puro. Hay que decidirlo en el spec.
    - Otras decisiones para el spec: OVNI sí/no, oleadas infinitas con aceleración vs.
      tabla de niveles, y sonido (la marcha de cuatro tonos con WebAudio sintetizado,
      siguiendo lo que ya hace `lib/games/vibora/engine.ts`).
    - Variedad frente a `asteroides`, el otro SHOOTER con motor: ahí hay rotación libre,
      inercia y borde que envuelve; aquí hay un solo eje de movimiento y presión que baja.
      No comparten ni una línea de física.
    - Traspaso: `/spec` (SPEC 11) antes de `/nuevo-juego`. Lo lanza el usuario.

---

## Pendientes

- [ ] **RANARIA** (`ranaria`) — cruzar carriles de tráfico y un río a saltos; ficha ARCADE,
      portada `cover-rana`
  - Sugerido: 2026-08-24 · Revisado: 2026-08-24 · Motor: medio · Ficha: ya en catálogo
  - Notas: evaluado en la ronda del 2026-08-24 y **descartado como siguiente, no como
    idea**: es el plan B directo.
    - Marcador: el original ya puntúa por avance (10 por paso hacia arriba, 50 por rana en
      casa, 1000 por completar la hilera, más bonus de tiempo). No hay que inventar nada.
    - Controles: las cuatro flechas, exactamente el mapa que ya usa `vibora`. Cero coste
      de plataforma.
    - La trampa de la estimación está en el río: la rana viaja **montada** sobre troncos,
      así que deja de estar alineada a la rejilla y el motor tiene que mezclar celdas con
      coordenada continua. Es lo que lo sube de `bajo` a `medio`.
    - Necesitaría datos de carriles (velocidad, sentido, densidad) en un fichero hermano,
      con el precedente de `lib/games/arkanoid/levels.ts`.
    - Lo que le resta hoy: viene justo detrás de VÍBORA (SPEC 10) y comparte con ella la
      sensación de moverse a celdas con las cuatro flechas. Conviene meter algo distinto
      entre medias.

- [ ] **GLOTÓN** (`gloton`) — comecocos en laberinto con cuatro perseguidores; ficha
      ARCADE, portada `cover-glot`
  - Sugerido: 2026-08-24 · Revisado: 2026-08-24 · Motor: **alto** · Ficha: ya en catálogo
  - Notas: evaluado en la ronda del 2026-08-24. Es el juego más apetecible del inventario
    y también, con diferencia, el más caro. **No es el siguiente.**
    - Marcador excelente y nativo: 10 por punto, 50 por píldora, y la cadena 200-400-800-1600
      al comerse fantasmas encadenados.
    - El coste está donde avisaba el inventario: laberinto de 28×31 en un fichero de datos,
      **cuatro IAs distintas** (persecución directa, anticipación cuatro celdas por delante,
      triangulación, y el que huye al acercarse), modos scatter/chase con temporizador de
      ciclos por nivel, decisión solo en intersecciones sin poder invertir el sentido, casa
      de fantasmas con cola de salida, y túnel lateral.
    - Si algún día entra, entra con `/spec` propio y con al menos dos ficheros hermanos
      (`laberinto.ts`, `fantasmas.ts`). No es una integración directa.

- [ ] **DUELO PIXEL** (`duelo-pixel`) — versus a dos paletas; ficha VERSUS, portada
      `cover-duelo`
  - Sugerido: 2026-08-24 · Revisado: 2026-08-24 · Motor: bajo · Ficha: ya en catálogo
  - Notas: el motor es de los más baratos que existen, pero **choca de frente con el
    criterio del marcador**: la plataforma guarda una puntuación individual por partida y
    un versus no la tiene. Habría que inventar una regla (por ejemplo, puntuar los tantos
    seguidos contra una CPU que acelera). Es una decisión de diseño, no de motor, y por eso
    sigue esperando. A favor: es la **única ficha de la categoría VERSUS**, que hoy es un
    agujero visible en la biblioteca — cero juegos reales.

---

## Cartera ampliada — ronda del 2026-08-24 (20 candidatos)

Segunda ronda del mismo día, repartida entre cuatro instancias del agente en paralelo
(shooters · plataformas · puzzle · deportes-varios) y consolidada aquí de una sola pasada.

**Dato que condiciona a los veinte:** el inventario de fichas maqueta está **agotado**. Los
cuatro candidatos vivos con ficha (`invasores`, `ranaria`, `gloton`, `duelo-pixel`) son los
únicos que se ahorran trabajo de catálogo. Todo lo de esta sección paga **Fases 2 y 3
completas** de `/nuevo-juego`: migración `add_game_<id>` + fila gemela en `FALLBACK_GAMES` +
clase `.cover-<id>` en `app/globals.css`. `sortOrder` libre desde **130**; asignar al
implementar, no antes. Y todos se escriben desde cero sobre `motor-plantilla.ts`.

Orden global por encaje real: coste de motor + marcador nativo + coste de plataforma +
variedad frente a lo ya publicado.

### Tier A — entrarían ya

- [ ] **CUBITO** (`cubito`) — Q*bert (Gottlieb, 1982). Escalada por pirámide de 28 cubos.
  - Motor: **bajo-medio** · Ficha: nueva (ARCADE, `magenta`)
  - Marcador nativo: 25 por cubo al color objetivo, 100 bola verde, 300 Slick/Sam, 500 Coily
    con disco, bonus de pantalla 1000 + 250 por pantalla siguiente.
  - `GameSnapshot` **3/3 nativo**: score, 3 vidas, ronda = nivel.
  - Controles: 4 flechas mapeadas a las diagonales (`left`=↖, `thrust`=↗, `down`=↙,
    `right`=↘). Cero coste de plataforma. Glifos propios en la leyenda.
  - Salto por celda con arco interpolado: es **animación, no gravedad**. La IA de Coily es
    elegir entre los dos saltos que reducen distancia — la persecución más barata posible,
    en la otra punta de las cuatro IAs de `gloton`. Sin fichero de niveles: la pirámide es
    una fórmula.
  - Riesgo único: el mapeo flecha→diagonal es *la* decisión de diseño (el original usa
    joystick a 45° y la desorientación es su queja histórica). Va al spec.
  - **El mejor encaje de los veinte.**

- [ ] **MECHA CORTA** (`mecha-corta`) — Kaboom! (Activision, 1981). Atrapar bombas con cubos.
  - Motor: **bajo** · Ficha: nueva (ARCADE, `magenta`)
  - Marcador nativo: cada bomba vale tantos puntos como el nivel (1 en el 1, 8 en el 8, el
    multiplicador topa en la oleada 8).
  - `GameSnapshot` **3/3 nativo**: score, 3 cubos = 3 vidas, oleada = nivel.
  - Controles: `left`/`right` + ratón, con el precedente de `arkanoid`. Cero coste.
  - Lo que le resta: el verbo motor (paleta horizontal) es el de ARKANOID, y es un juego de
    una sola idea — se sostiene solo si la curva de dificultad está muy bien calibrada.

- [ ] **ESTELAS** (`estelas`) — motos de luz de Tron (Bally Midway, 1982). Duelo en arena.
  - Motor: **bajo** · Ficha: nueva (**VERSUS**, `cyan`)
  - **Tapa el agujero de VERSUS**, que hoy tiene cero motores, y resuelve lo que atasca a
    `duelo-pixel`: el arcade ya daba 1000 por victoria, y la escalera de rivales (1, luego
    2, luego 3, más rápidos) convierte un versus en puntuación individual ascendente.
  - `GameSnapshot`: score acumulado, 3 vidas (patrón de `arkanoid`/`vibora`), ronda = nivel.
  - Controles: las cuatro flechas, mapa idéntico a `vibora`. Cero coste de plataforma.
  - Coste de rejilla pura como VÍBORA; la IA rival es *flood fill* acotado, no pathfinding.
  - Riesgo: **variedad**. Comparte con VÍBORA rejilla, rumbo y "no toques tu estela". A
    favor: no hay comida ni crecimiento, y el bucle mental es **encerrar**, no recolectar.
    Estética y nombre deliberadamente lejos de la marca Disney.

- [ ] **FUSIÓN** (`fusion`) — 2048 (Cirulli, 2014). Rejilla 4×4 de fichas que se fusionan.
  - Motor: **bajo** — el más barato que ha pasado por esta lista, por debajo de `vibora`.
    Sin colisiones, sin física, sin fichero hermano, sin tabla de niveles.
  - Marcador nativo: cada fusión suma el valor resultante (dos 64 → +128). Máximo teórico
    ~3,9 M, por debajo de `MAX_SCORE`.
  - `GameSnapshot`: score nativo, `lives: 0` → HUD pinta `—` (precedente de TETRIS), `level`
    = exponente de la ficha mayor menos uno.
  - Controles: 4 flechas, mapa de `vibora`. Cero coste.
  - Dos frentes para el spec: **duración** (llegar a 2048 son 10-20 min, roza el criterio de
    partida corta) y que es de 2014, no un clásico de recreativa — decisión editorial.

- [ ] **ANTIMISIL** (`antimisil`) — Missile Command (Atari, 1980). Defender seis ciudades.
  - Motor: **bajo-medio** · Ficha: nueva (SHOOTER, `yellow`)
  - Todo primitivas: misiles = segmentos, explosiones = círculos que crecen, colisión =
    punto dentro de círculo (más barato aún que el AABB de INVASORES). Casa con la estética
    CRT vectorial de la plataforma mejor que ningún otro candidato.
  - Marcador nativo: 25 por misil, 100 por avión/satélite; bonus de oleada 5× por misil sin
    usar y 50× por ciudad viva, multiplicador +1 cada dos oleadas hasta ×6.
  - `GameSnapshot`: score nativo, `lives` = ciudades vivas (empieza en **6** — comprobar que
    el HUD las pinta, o mapear a 3), oleada = nivel.
  - Decisión de alcance: **una sola batería** (mira con las 4 flechas + `fire`, cero coste de
    plataforma). Tres baterías con botón propio obligaría a ampliar `GameAction`: descartado.
  - Riesgo: la mira con teclado es mucho peor que con trackball; hay que calibrar su
    velocidad o la puntuación deja de ser comparable entre teclado y ratón.

- [ ] **CIEMPIÉS** (`ciempies`) — Centipede (Atari, 1981). Rejilla de hongos y ciempiés.
  - Motor: **medio** · Ficha: nueva (SHOOTER, `magenta`)
  - Marcador nativo: cuerpo 10, cabeza 100, hongo 1, pulga 200, escorpión 1000, y la araña
    vale **300/600/900 según lo cerca que muera del cañón**. Vida extra cada 10.000.
  - `GameSnapshot` 3/3 nativo. Controles: **las cinco acciones exactas**, cero coste.
  - La pieza cara no es física, es estructura: el ciempiés es una lista de segmentos y al
    reventar uno intermedio **la lista se parte y el siguiente segmento pasa a cabeza**.
  - Riesgos para el spec: el original es de **monitor vertical** contra el `aspect-ratio: 4/3`
    de `.game-canvas`; y la regla de **un solo disparo en pantalla** es equilibrio, no
    limitación técnica — quitarla rompe el juego.

- [ ] **ASFALTO** (`asfalto`) — Road Fighter (Konami, 1984). Carrera vertical cenital.
  - Motor: **bajo-medio** · Ficha: nueva (ARCADE, `yellow`)
  - **La única carrera que encaja**, porque el original ya puntúa en vez de cronometrar:
    bidones encadenados 300 → 500 → 1000 → 2000 → 3000 → 5000 → 10.000, y fallar uno
    devuelve la cadena a 300. Bonus de 3000 por aguantar sin chocar.
  - No paga pseudo-3D: la carretera es una banda con bordes por tabla de tramos, los rivales
    son rectángulos que bajan, colisión AABB.
  - `GameSnapshot`: score nativo, etapa = nivel, `lives: 0` → `—` (el recurso real es el
    combustible, dibujado dentro del canvas).
  - Controles: `left`/`right`/`thrust`/`down`. Cero coste de plataforma.

### Tier B — buenos, con una reserva concreta

- [ ] **PENTATLÓN NEÓN** (`pentatlon`) — Track & Field (Konami, 1983). Motor: **medio**.
  - El coste es de **volumen**, no de dificultad: N minijuegos con reglas propias más una
    máquina de estados evento → intento → clasificación.
  - `GameSnapshot` **3/3 nativo y el mejor de la ronda**: score acumulado, vidas nativas
    (fallar la mínima resta una, extra cada 100.000), prueba en curso = nivel.
  - Controles: `left`/`right` alternados = correr, `fire` = saltar/lanzar, `thrust`/`down` =
    ángulo. 5 de 5. En táctil alternar dos botones con los pulgares **es** el juego.
  - Aviso honesto: la fórmula exacta marca→puntos no está publicada. Hay anclas reales
    (7,65 s en 100 m ≈ 18.050 pts; 9,67 m en longitud ≈ 13.340; récord mundial 95.350) y hay
    que **interpolar una curva**. Es nativo en espíritu, calibrado por nosotros: decirlo.
  - Reserva: el alcance. **Tres o cuatro pruebas, no seis.**

- [ ] **TORRE INFINITA** (`torre-infinita`) — Icy Tower (2001). Motor: **bajo-medio**.
  - Sería el **primer motor con gravedad y salto** de la casa, por la puerta fácil:
    plataformas de un solo sentido (comparar `y` previa contra `y` actual), sin enemigos, sin
    IA, sin proyectiles, sin fichero de niveles. Pisos generados por procedimiento.
  - Marcador nativo: piso más alto × 10, más el **cuadrado** de los pisos de cada combo.
  - `lives: 1` es lo honesto (una sola vida en el original) y hay que decidirlo, no pintar
    tres corazones eternos. Controles: `left`/`right`/`thrust`. Cero coste.
  - Reserva: el juego vive del *tacto* del salto y **no hay original que portar**, así que se
    incumple por fuerza la regla de copiar constantes: hay que afinarlo a mano. Además pide
    lienzo vertical contra el 4/3 de la casa.

- [ ] **PRISMA** (`prisma`) — Columns (Sega, 1990). Motor: **medio**.
  - **No es un clon de TETRIS disfrazado**: la pieza es siempre la misma (columna de tres) y
    no rota, se **ciclan sus colores**; no se limpian líneas sino **grupos de 3+ en las ocho
    direcciones**; y las joyas caen **celda a celda**, lo que produce cadenas. El motor de
    `tetris` no tiene detección de grupos, ni gravedad por celda, ni cadenas.
  - Marcador nativo (30 por trío en nivel 1, +10 por nivel, diagonales y cadenas multiplican)
    y `level` nativo. `lives: 0` → `—`.
  - Reserva: **variedad percibida**. Mismo pozo, misma categoría y literalmente el mismo mapa
    de teclas que TETRIS (SPEC 08). Necesita un juego de otra familia de por medio.

- [ ] **TUBERÍAS** (`tuberias`) — Pipe Mania (1989). Motor: **medio-bajo**.
  - **El candidato más original del catálogo entero**: no se parece a nada publicado.
  - Marcador nativo y muy concreto: 50 por tramo normal, 100 por tramo de un sentido, 200 por
    depósito, 1000 por bomba, 800 por túnel, **−100 por pieza colocada que el fluido no usa**.
    `level` nativo (distancia exigida y velocidad del fluido escalan por nivel).
  - Todo se reduce a una tabla de conectividad en `lib/games/tuberias/piezas.ts`, con el
    precedente de `tetris/pieces.ts`. Sin colisión ni coma flotante.
  - Reserva: **el original es de ratón**. Con 4 flechas moviendo cursor + `fire` cabe sin
    ampliar el contrato, pero **degrada el juego** (con ratón colocas en un gesto; con cursor
    son varios pasos mientras el fluido corre). Salida ya probada: declarar `Ratón` en la
    leyenda como hace `arkanoid`.

- [ ] **AVISPERO** (`avispero`) — Galaga (Namco, 1981). Motor: **medio**.
  - Marcador nativo excelente y que premia el riesgo: abeja 50 en formación / 100 en picado,
    mariposa 80/160, jefe 150/400/800/1600 según escoltas, nave rescatada 1000, y **10.000
    por acertar las 40** en la fase de desafío.
  - `GameSnapshot` 3/3 nativo. Controles: `left`/`right`/`fire`. Cero coste.
  - El salto de coste frente a INVASORES son **las trayectorias**: entradas en bucle y
    picados por curvas prefijadas, con fichero de rutas y sistema de "recorre y vuelve a tu
    hueco". Más el rayo tractor, que es estado extra del jugador.
  - Reserva: **variedad, no coste**. Llega justo detrás de INVASORES y comparte encuadre.
    Publicarlos seguidos es servir dos veces la misma foto.

- [ ] **POLVORÍN** (`polvorin`) — Bomberman (Hudson, 1983). Motor: **medio**.
  - Rejilla 13×11, ladrillos por semilla (sin fichero de niveles), explosión en cruz que se
    corta en el primer obstáculo, **detonación en cadena** y mejoras bajo ladrillos.
  - Marcador nativo con encadenado por explosión múltiple: 100, 200, 400, 800…
  - Controles: 4 flechas + `fire` = las cinco exactas. La patada de bombas sería una sexta
    acción, así que queda fuera de la v1.
  - Reservas: el juego vive del versus a dos, que esta plataforma **no puede puntuar**; y es
    el que peor cumple el criterio de **partida corta** (fases de minutos con la puerta
    escondida bajo un ladrillo al azar). Hay que retocar el diseño del original.

### Tier C — caros, para más adelante

- [ ] **CANTERA** (`cantera`) — Boulder Dash (1984). Motor: **medio-alto**.
  - Rejilla **con simulación**: autómata celular que hace caer y rodar rocas, explosiones
    3×3, muro mágico, y enemigos que giran siguiendo pared. `GameSnapshot` 3/3 nativo (10 por
    diamante, 20 por diamante de explosión, 1 punto por segundo restante, vida extra cada
    500). Lo caro invisible: **pide 5-8 cuevas diseñadas a mano** en fichero hermano.

- [ ] **TOPO** (`topo`) — Dig Dug (Namco, 1982). Motor: **medio-alto**.
  - Marcador y controles impecables (200/300/500 por profundidad, Fygar el doble si revienta
    de lado, verdura hasta 8000; las cinco acciones exactas). Lo que lo frena: **terreno
    destructible sobre máscara de celdas + enemigos que navegan solo por túneles excavados**,
    o sea pathfinding sobre el grafo de celdas abiertas. Liga de `gloton`, no de `vibora`.

- [ ] **VÓRTICE** (`vortice`) — Tempest (Atari, 1981). Motor: **medio-alto**.
  - La simulación es barata (`carril`, `profundidad`), lo caro es **la geometría**: 16
    telarañas distintas en fichero de datos más una función de proyección propia.
  - Marcador nativo (spiker 50, tanker 100, flipper 150, pulsar 200, fuseball 250/500/750; el
    superzapper no puntúa, así que no se puede farmear). Controles: 4 acciones, cero coste.
  - Dos avisos: pide **prototipo de proyección** antes de firmar el spec (con el glow CRT
    puede quedar espectacular o ilegible), y es el único que **roza `MAX_SCORE`** (10 M).

- [ ] **RALLY NOCTURNO** (`rally-nocturno`) — Rally-X (Namco, 1980). Motor: **alto**.
  - Marcador nativo (banderas en escalera 100…1000, la especial dobla el resto) y controles
    perfectos (5 de 5, el humo en `fire`). Pero es **"GLOTÓN con coche"**: mundo mayor que la
    pantalla con scroll **más** radar como segunda vista, rivales que persiguen con criterio,
    combustible, y movimiento continuo dentro de pasillos (ni siquiera se abarata como
    rejilla). Si se paga esa factura, que se pague una sola vez.

- [ ] **BARRILES** (`barriles`) — Donkey Kong (Nintendo, 1981). Motor: **alto**.
  - Marcador nativo inmejorable (100/300/500/800 por saltar barriles encadenados, 500 el
    fuego, bonus decreciente entero al completar). Pero estrena el primer motor de
    plataformas **por la puerta difícil**: vigas inclinadas (se acabó el AABB limpio),
    escaleras que suspenden la gravedad, barriles que deciden al azar si bajan, martillo
    temporizado, y pantallas dibujadas a mano.
  - Controles: cabe **justo** en las cinco acciones, con `fire` = saltar — que es exactamente
    lo que la Fase 5 llama "disfrazar una acción". Cualquier añadido posterior obligaría a
    ampliar `GameAction`.
  - Y el personaje hay que **reinventarlo de verdad**: es la marca más identificable de la lista.

### Descartados de esta ronda — no reabrir sin motivo nuevo

- [x] **ÉXODO** (`exodo`) — Defender (1980). El mejor marcador del bloque shooter y el peor
      encaje: mundo con scroll, **radar como segunda vista obligatoria**, y sobre todo **6-7
      acciones** (subir, bajar, propulsar, invertir, disparar, bomba, hiperespacio) frente a
      las cinco de `GameAction` → coste de plataforma real. Y partidas largas.
- [x] **CAMPO MINADO** (`campo-minado`) — Buscaminas. Motor barato, pero **sin marcador
      nativo**: el original solo cronometra (la métrica competitiva es 3BV/s). Habría que
      fabricar la regla entera, y aun así es "resolver y ya", sin puntuación creciente.
      Encima la bandera obliga a **ampliar `GameAction`**.
- [x] **Pseudo-3D** (Pole Position, Out Run, Night Driver) — proyección de carretera y
      sprites escalados sin una sola imagen en el proyecto, y su resultado natural es un
      **tiempo de vuelta**, no una puntuación. Doble incumplimiento.
- [x] **Golf y bolos** — menos golpes = mejor marca, justo al revés que un récord ascendente.
      Chocaría con `game_leaderboards`.
- [x] **Lode Runner** — excavar a izquierda y a derecha son dos acciones más: **amplía
      `GameAction`**, y encima pide ficheros de niveles.
- [x] **Boxeo / karate 1v1** (Karate Champ, Activision Boxing) — puntuación inventada *y*
      animación de luchador cuadro a cuadro sin sprites. VERSUS sí, pero mucho peor que ESTELAS.

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

Las cuatro fichas maqueta que **repiten una mecánica ya publicada**. Se quedan en el
catálogo como decoración, con su arena decorativa del SPEC 01, pero no vuelven a entrar en
la evaluación: darles motor sería publicar dos veces el mismo juego. Reabrir cualquiera
exige decir qué ha cambiado.

- [x] **BLOQUE BUSTER** (`bloque-buster`) — descartado 2026-08-24: es el mismo juego que
      `arkanoid`, que ya tiene motor (SPEC 09).
- [x] **CAÍDA** (`caida`) — descartado 2026-08-24: es el mismo juego que `tetris`, que ya
      tiene motor (SPEC 08).
- [x] **SERPENTINA** (`serpentina`) — descartado 2026-08-24: es el mismo juego que
      `vibora`, que ya tiene motor (SPEC 10).
- [x] **ROCAS** (`rocas`) — descartado 2026-08-24: es el mismo juego que `asteroides`, que
      ya tiene motor (SPEC 05). El SPEC 05 eligió ficha nueva y dejó `rocas` intacta a
      propósito.

---

## Notas de proceso

- **2026-08-24** — Primera ronda real del agente. Ya no queda ningún original sin portar en
  `references/started-games/`: los tres que había (`02-asteroids`, `03-tetris`,
  `04-arkanoid`) están portados. **A partir de aquí, todo candidato se escribe desde cero**
  sobre `.claude/skills/nuevo-juego/motor-plantilla.ts`, como VÍBORA. Eso sube el suelo de
  coste de cualquier propuesta futura, y hay que tenerlo en cuenta al estimar.
- El inventario de fichas sin motor queda en **cuatro** candidatos vivos (`invasores`,
  `ranaria`, `gloton`, `duelo-pixel`) tras descartar los cuatro duplicados. Cuando se agoten,
  la siguiente propuesta implicará ficha nueva: migración + `FALLBACK_GAMES` + portada CSS,
  o sea las Fases 2 y 3 de `/nuevo-juego` que hasta ahora nos estábamos ahorrando.
