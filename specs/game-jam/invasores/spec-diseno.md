# SPEC (GAME JAM) — INVASORES: la formación que baja y aprieta, tema y juego son la misma cosa

> Estado: Propuesto — game jam, pendiente de decisión (no implementado)
> Tema: «INVASORES — un Space Invaders clásico (formación alienígena que desciende en bloque y dispara, cañón del jugador en la base)»
> Depende de (si se construye): SPEC 05, SPEC 06, SPEC 07, SPEC 09
> Fecha: 2026-08-24
> Compañero: spec-implementacion.md, en esta misma carpeta

---

## 0 — De dónde sale este spec

Este no es un tema abierto de los que este agente suele recibir: es el resultado ya cerrado
de una ronda de `game-planner` (`references/game-suggestions-todo.md`, sección
«Siguiente», 2026-08-24), que analizó el encaje de `invasores` contra el inventario de
fichas maqueta y lo dejó como el candidato más barato, con cuatro decisiones de diseño
explícitamente aparcadas para un spec: búnkeres, OVNI, progresión de oleadas y sonido.
Este documento toma esas cuatro decisiones y las razona; no repite el análisis de encaje
de `game-planner`, que ya está hecho y no es trabajo de este agente rehacerlo.

La ficha `invasores` **ya existe** en `FALLBACK_GAMES` (`lib/games.ts`) — SHOOTER,
`cover-invaders`, `green`, `sort_order` 50 — y su portada `.cover-invaders` **ya existe**
en `app/globals.css`: filas de puntos verdes y magenta sobre fondo azul oscuro, con un
círculo cian abajo que ya se lee como un OVNI antes de que el juego tenga motor. Las Fases
2 (migración + `FALLBACK_GAMES`) y 3 (portada CSS) de `/nuevo-juego` están hechas. El plan
de implementación de este spec empieza directamente en el motor.

---

## 1 — Por qué este juego, para este tema

El tema no pide traducir una palabra a una mecánica: la nombra directamente. «INVASORES»
**es** la descripción de Space Invaders (Taito, 1978) — formación que desciende en bloque
y dispara, cañón que se mueve en la base — y el trabajo de diseño no es inventar cómo
encaja el tema en el juego, es decidir los números que un original real ya tenía
calibrados y que aquí no hay: no existe `references/started-games/05-invaders/`, así que
cada constante de este documento es una decisión propia, con el mismo reparto de riesgo
que tuvo VÍBORA (SPEC 10, §1) — falla al calibrar, no al traducir.

El tema se nota jugando, no solo en el título: la presión del juego entero es la
formación bajando fila a fila y acelerando cuanto menos quedan, con un cañón que solo
tiene un eje de movimiento y un disparo en pantalla a la vez. Quitar cualquiera de esas
tres cosas — la aceleración por bajas, el eje único, el disparo limitado — deja de ser
Space Invaders y pasa a ser otro shooter cualquiera. Las tres se conservan.

Encaja en los siete criterios que usa `game-planner`, y los cuatro que no salen solos del
original se deciden en el §6:

1. **Marcador nativo.** El original ya puntúa por fila de invasor (10/20/30) y con OVNI
   bonus (50-300): no hay que inventar la regla, solo decidir el rango del OVNI.
2. **Partida corta.** Una partida dura de un par de minutos a diez, según cuánto aguante
   el jugador; se compite por oleada alcanzada y puntuación, igual que el resto del
   catálogo.
3. **Coste de motor bajo-medio.** Rejilla con pasos a intervalo, sin física continua ni
   inercia; colisión rectángulo-rectángulo; sin IA de verdad — los invasores marchan, no
   persiguen. Todo dibujado con primitivas de canvas y matrices booleanas propias, sin
   sprites externos.
4. **Controles dentro de `GameAction`.** `left`, `right`, `fire`. Tres de las cinco
   acciones que ya existen, con sus teclas ya en `GAME_KEYS`. Cero coste de plataforma —
   no hace falta tocar `lib/games/engine.ts` ni `lib/games/registry.ts` más que para
   añadir la entrada.
5. **Nombre propio, sin marca registrada.** `INVASORES` / `invasores` ya está en el
   catálogo desde antes de este spec, en español y sin usar «Space Invaders». Ninguna
   decisión que tomar aquí.
6. **Variedad frente a lo publicado.** El otro SHOOTER con motor real es ASTEROIDES
   (`lib/games/asteroides/engine.ts`, leído para este spec): ahí la nave gira libremente,
   acelera con inercia (`vx *= DRAG`), envuelve los cuatro bordes (`wrap()`) y los
   asteroides flotan con velocidad y rotación propias sin ninguna rejilla. Aquí no hay
   inercia, no hay envoltura, no hay rotación de la nave y el movimiento del enemigo es en
   bloque, a pasos discretos, con dirección que se invierte al tocar un borde y baja una
   fila. No comparten ni una línea de física — ninguna de las dos usa un `wrap()`, un
   `DRAG` o un ángulo libre en el otro motor.
7. **`game-id` libre.** `invasores` no está en `FALLBACK_GAMES` de ningún otro juego
   distinto de sí mismo, y `specs/game-jam/` no tenía ninguna carpeta antes de esta.

---

## 2 — Alcance

**Dentro:**

- **Motor nuevo** en `lib/games/invasores/engine.ts`, sobre el lienzo de 800 × 600 de
  siempre. Nada en `public.games` ni en `app/globals.css`: la ficha y la portada ya
  existen y no se tocan.
- **Formación de 5 × 11 invasores** (55 en total) en tres tipos por fila — calamar arriba
  (30 pts), cangrejo en las dos filas centrales (20 pts), pulpo en las dos de abajo (10
  pts) —, cada uno con dos fotogramas de animación propios, en un fichero hermano
  `lib/games/invasores/sprites.ts`.
- **Marcha en bloque a pasos**: la formación entera se mueve un paso horizontal fijo a
  intervalo, invierte dirección y baja una fila al tocar cualquiera de los dos bordes, y
  el intervalo se acorta cuanto menos invasores quedan vivos **y** cuanto más alta es la
  oleada. Es la aceleración clásica, y sale de una fórmula, no de una tabla.
- **Cañón del jugador**: un eje horizontal, velocidad constante, sin inercia. Un único
  disparo en pantalla a la vez — restricción real del original, no un ahorro de coste —,
  con las teclas `←`/`→` y `Espacio`/`fire`.
- **Disparo alienígena**: hasta tres balas de invasor en pantalla, disparadas al azar
  desde el invasor más bajo de una columna con vía libre, con probabilidad que sube cuanta
  menos formación queda.
- **Búnkeres, versión barata**: cuatro parapetos entre la formación y el cañón, cada uno
  una rejilla de subceldas booleanas (7 × 5) con la silueta clásica del arco con hueco
  inferior. Un impacto de cualquier bala —del jugador o del invasor— apaga la subcelda que
  toca y hasta cuatro vecinas al azar, y la propia bala desaparece. Colisión AABB pura, sin
  destrucción por píxel.
- **OVNI bonus**: aparece por arriba a intervalos aleatorios, cruza la pantalla a velocidad
  constante y, si el disparo del jugador la alcanza, suma una puntuación aleatoria de una
  tabla de cuatro valores entre 50 y 300.
- **Línea de peligro**: si cualquier invasor llega a una fila cercana al cañón, la partida
  termina en el acto, con independencia de cuántas vidas queden — la regla que hace que la
  formación sea una amenaza real y no solo una fuente de disparos.
- **Tres vidas**, con una pausa breve y parpadeo al perder una, reaparición en el centro
  con una ventana corta de invulnerabilidad, y fin de partida al perder la tercera.
- **Oleadas infinitas**: limpiar la formación entera sube el nivel, reinicia la formación
  arriba y acelera la marcha desde una base más alta. Los búnkeres **no** se reparan entre
  oleadas: se degradan durante toda la partida.
- **Botonera táctil** con `left`, `right` y `fire`, reutilizando el reparto de dos grupos
  ya visto en ARKANOID.
- **Sonido sintetizado con WebAudio**, siguiendo el precedente de
  `lib/games/vibora/engine.ts`: la marcha de cuatro tonos que acelera con la formación,
  disparo del jugador, explosión de invasor, muerte del jugador y un aviso distinto para
  el OVNI. `audio: true` y `setMuted` de verdad.

**Fuera de alcance (para specs futuros):**

- **Vida extra por puntuación.** El original la da una vez a los 1.500 puntos. Se deja
  fuera para no complicar el conteo de vidas con un umbral que solo se dispara una vez por
  partida; es un añadido pequeño para un spec posterior, no una decisión reñida.
- **Destrucción de búnkeres por contacto con la formación.** El original también los
  desgasta cuando un invasor pasa por encima al bajar de fila. Aquí solo los desgastan los
  disparos; la línea de peligro hace que ese caso apenas se llegue a ver en la práctica.
- **Tabla de disparo del OVNI basada en el conteo de disparos del jugador.** El original
  liga el premio al número de balas disparadas módulo quince; aquí es una tabla de cuatro
  valores elegida al azar. Ver §6.
- **Modo a dos jugadores**, que el original de recreativa tenía por turnos.
- **Música de fondo, volumen graduable o mezclador.** El interruptor sigue binario.
- **Carteles en el lienzo.** Ni `PAUSA`, ni `GAME OVER`, ni «OLEADA 4». Los pinta React.
- **Guardar la partida a medias.** Cerrar la pestaña pierde la formación y los búnkeres.
- **Anti-trampas ni banco de pruebas.** Mismo criterio que VÍBORA (SPEC 10, §2): todo se
  ve jugando, salvo la fórmula de velocidad, que tiene su propio riesgo en el §7.
- **Tocar el contrato de la plataforma.** Ni una acción nueva en `GameAction`, ni un campo
  nuevo en `GameSnapshot`, ni un botón nuevo en el HUD. `lib/games/engine.ts`,
  `components/game-player.tsx` y `components/games/game-canvas.tsx` no se tocan; de
  `lib/games/registry.ts` solo su entrada nueva.
- **Migración de catálogo y portada CSS.** Ya existen las dos; tocarlas sin motivo es
  reabrir un trabajo ya cerrado.

---

## 6 — Decisiones tomadas y descartadas

**Búnkeres, versión barata, y no destrucción por píxel.** El original marca cada búnker
como un mapa de bits a nivel de píxel: cada disparo borra los píxeles que toca dentro de
un radio, y el resultado son siluetas erosionadas orgánicamente. Eso es collision contra
una máscara de miles de píxeles por búnker, recalculada en cada impacto — el salto de
coste que la ronda de `game-planner` ya identificó como el riesgo del juego. La variante
barata sustituye el mapa de bits por una rejilla de 7 × 5 subceldas booleanas por búnker
(35 celdas, cuatro búnkeres, 140 en total): un impacto localiza la subcelda por división
entera de la posición de la bala, la apaga, y apaga hasta cuatro vecinas al azar para
simular un cráter sin tener que calcular ninguna forma. Es colisión AABB pura, del mismo
coste que cualquier otra bala del juego, y se ve bien porque las subceldas son pequeñas
(8 px) frente al tamaño del búnker (56 × 40 px). **Se incluye en el alcance v1**: sin
búnkeres, el jugador no tiene dónde resguardarse del fuego alienígena y el juego pierde la
mitad de su lectura táctica — es la pieza que separa «disparar hacia arriba» de «Space
Invaders».

**OVNI sí, con tabla de cuatro valores al azar, y no la tabla real del original.** El
arcade original liga el premio al número de disparos que ha hecho el jugador desde el
inicio de la partida, módulo quince, contra una tabla fija: es una regla que casi nadie
conoce jugando y que aquí no hay motivo para copiar, porque no hay un original probado del
que traducirla sin cambiarle el número — cambiarlo un poco ya es decidir, así que se
decide entera. Se sustituye por un sorteo uniforme entre 50, 100, 150 y 300, que cubre el
mismo rango que anunciaba `game-planner` (50-300) sin depender de un contador oculto que
el jugador no puede ver ni aprender.

**Oleadas infinitas con fórmula, y no una tabla de niveles explícita.** ARKANOID (SPEC 09)
usa una tabla de cinco niveles porque el original tenía exactamente cinco muros distintos
y terminaba ahí — portarlo como tabla era portar el juego que había. Aquí no hay niveles
diseñados a mano que portar: la dificultad del original ya salía de una fórmula
(intervalo de paso como función de invasores vivos), y extenderla a «más rápido cada
oleada» es la misma idea aplicada una vez más, no una tabla nueva. Es también la decisión
que sigue el precedente de VÍBORA, que también prefirió fórmula a tabla por el mismo
motivo: no hay contenido que diseñar a mano, solo una curva que calibrar. El techo de
velocidad (`MIN_STEP_MS`) evita el mismo problema que VÍBORA ya resolvió: sin suelo, la
fórmula cruza valores absurdos y el juego deja de ser difícil para pasar a ser una lotería.

**Sonido sí, sintetizado con WebAudio, sin ficheros.** No hay original del que copiar los
`.mp3` de la marcha de cuatro tonos, así que la opción no es «portar o no portar» sino
«sintetizar o buscar audio de terceros con licencia dudosa» — la misma disyuntiva que
resolvió VÍBORA, y se resuelve igual: se sintetiza. La marcha de cuatro tonos es
especialmente barata de sintetizar porque ya existe un evento natural al que engancharla —
el paso de la formación —, así que no hace falta un temporizador aparte: cada paso toca la
siguiente nota del ciclo de cuatro, y la marcha se acelera sola con la misma fórmula que
acelera el movimiento. El contrato de audio de la SPEC 09 (`setMuted`, `audio: boolean`)
se reutiliza tal cual.

**Un solo disparo del jugador en pantalla, y no una cola de disparos.** No es un ahorro de
coste — permitir varios disparos a la vez no es más caro de computar — es una decisión de
diseño heredada del original: es la restricción que hace que el jugador tenga que elegir
el momento del disparo en vez de mantener el dedo en el gatillo, y es la que da sentido a
que perder el disparo contra un búnker o fallar contra el OVNI duela. Quitarla sería
rediseñar el juego, no portarlo, y aquí no hay original que portar pero sí un género cuyas
reglas conocidas hay que respetar si el juego va a leerse como lo que dice ser.

**Línea de peligro con fin de partida instantáneo, independiente de las vidas.** Es la
otra mitad de la tensión del original: si la formación llega abajo, la partida termina
aunque queden vidas, porque la amenaza no es «que te disparen» sino «que te invadan». Sin
esta regla, un jugador podría dejar bajar la formación indefinidamente mientras le queden
vidas, y la presión de la marcha —que es la razón de ser del tema— desaparecería.

**Los búnkeres no se reparan entre oleadas.** Se valoró resetearlos en cada oleada nueva,
que habría dado a cada oleada la misma dificultad de cobertura. Se descarta: el original
los degrada durante toda la partida, y es lo que hace que la oleada 6 se sienta más dura
que la oleada 1 por algo más que la velocidad — llegar lejos también significa jugar sin
resguardo. Si esto resulta ser demasiado duro al calibrar, el número que se ajusta es el
tamaño del cráter por impacto (§7), no la regla de no reparar.

**Los invasores no destruyen búnkeres al pasar por encima.** El original sí lo hace: un
invasor que baja de fila sobre un búnker le come los píxeles que pisa. Se deja fuera
porque, con la línea de peligro ya cerca de esa misma zona del tablero, el caso apenas
llega a darse en la práctica —cuando un invasor está pisando un búnker, la partida está a
una o dos filas de terminar igualmente— y añadir la regla sería peso de implementación sin
peso de juego.

**Sprites propios, no calcados de ningún arcade concreto.** Las matrices booleanas de
calamar, cangrejo, pulpo y OVNI que van en `lib/games/invasores/sprites.ts` son siluetas
dibujadas para este spec, no una copia pixel a pixel de ningún ROM. Es la misma cautela
que ya aplicó el nombre `INVASORES` en vez de «Space Invaders»: aquí no hay ningún fichero
de origen del que copiar legítimamente un asset, así que se dibuja uno propio, igual que
VÍBORA dibujó su propia víbora de rectángulos en vez de buscar un sprite de serpiente.

**Sin vida extra por puntuación.** El original la concede una vez, a los 1.500 puntos. Es
poco código, pero es una regla que solo se dispara una vez por partida y que complica el
conteo de vidas —hay que decidir si puede superar tres, si el HUD lo soporta— para un
beneficio de juego pequeño. Queda fuera de la v1 y anotada como candidata a un spec
posterior si el calibrado de dificultad lo pide.

**Es Space Invaders, no se moderniza.** Ni potenciadores, ni pelotas… digo, balas
múltiples, ni escudo del cañón, ni modo cooperativo. Cada uno de esos es una decisión de
diseño que este spec ya tiene de sobra sin necesidad de inventar más.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No hay original: los números —velocidad base, factor por oleada, probabilidad de disparo alienígena— son inventados y pueden estar mal calibrados.** Es el mismo riesgo mayor que documentó VÍBORA (SPEC 10, §7), y aquí hay más constantes en juego que allí.       | El plan de implementación exige jugar varias oleadas completas antes de dar el motor por bueno. Si hay que mover `BASE_STEP_MS`, `WAVE_SPEED_FACTOR` o la probabilidad de disparo, el número nuevo se escribe en este spec, no solo en el código.                            |
| El cráter de subceldas al azar puede vaciar un búnker en pocos impactos si el sorteo es generoso, o apenas notarse si es tacaño — ninguno de los dos extremos se ve sin jugarlo.                                                                                       | Empezar con «celda impactada + hasta cuatro vecinas al 50 % cada una» y ajustar esa probabilidad, no el tamaño de la rejilla, si el calibrado sale mal.                                                                                                                      |
| La marcha de cuatro tonos, enganchada al paso de la formación, puede solapar demasiadas notas por segundo cuando `MIN_STEP_MS` se alcanza (hasta ~16 pasos/s) y sonar a ruido en vez de a marcha.                                                                      | Cada nota dura menos que el intervalo mínimo entre pasos (80 ms de nota contra 60 ms de paso en el peor caso, así que hay solape leve a propósito, como el rebote de ARKANOID) — comprobarlo de oído en el paso de implementación del sonido y acortar la nota si se satura. |
| La línea de peligro puede sentirse injusta si el margen entre «la formación toca la línea» y «el jugador ya no puede reaccionar» es demasiado estrecho.                                                                                                                | Calibrar `DANGER_Y` con margen suficiente sobre la posición del cañón durante la fase de juego a mano del plan de implementación, con criterio de aceptación explícito sobre cuánto tarda la formación en llegar desde que se hace visible el riesgo.                        |
| Los búnkeres sin reparar entre oleadas pueden dejar la oleada 5 o 6 sin ninguna cobertura, volviendo el juego injugable a partir de cierto punto en vez de solo más difícil.                                                                                           | Es una decisión tomada a sabiendas en el §6. Si el playtesting del plan de implementación lo confirma como un problema, el ajuste es el tamaño del cráter por impacto, no la regla de persistencia.                                                                          |
| Cinco filas por once columnas de invasores, cada uno con colisión contra hasta cuatro balas de invasor y una del jugador por fotograma, más cuatro búnkeres de 35 subceldas cada uno, es más superficie de colisión por fotograma que cualquier otro motor de la casa. | Sigue siendo AABB puro sin raíz cuadrada ni trigonometría por par, y el número de balas vivas está topado (1 + 3). El coste real es una fracción del de ASTEROIDES, que ya corre sin problema con polígonos y distancias euclídeas.                                          |
| El marcador no tiene techo por diseño —oleadas infinitas—, igual que VÍBORA.                                                                                                                                                                                           | Una partida de varias oleadas ronda unos pocos miles de puntos; `MAX_SCORE` sigue en 10.000.000 y no hace falta tocarlo, igual que en VÍBORA.                                                                                                                                |
| Los sprites propios pueden parecerse sin querer a los del arcade original si quien los dibuja se guía de memoria.                                                                                                                                                      | Documentado en el §6 como decisión consciente: siluetas propias, no una copia. Revisar el resultado contra la silueta del arcade original antes de darlo por cerrado, no para copiarla sino para asegurarse de que se diferencia.                                            |

---

## Lo que **no** entra en este spec

Vida extra por puntuación. Destrucción de búnkeres por contacto con la formación. Tabla de
disparo del OVNI basada en el conteo de disparos del jugador. Modo a dos jugadores.
Música de fondo, volumen graduable o mezclador. Carteles en el lienzo. Guardar la partida
a medias. Anti-trampas. Banco de pruebas. Cualquier cambio en `lib/games/engine.ts`,
`components/game-player.tsx` o `components/games/game-canvas.tsx`. Migración de catálogo
y portada CSS — ya existen las dos.

Cada uno de esos, si cae, va en su propio spec.
