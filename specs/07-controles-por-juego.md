# SPEC 07 — Los controles dejan de ser los de asteroides

> **Estado:** Implementado
> **Depende de:** SPEC 05
> **Fecha:** 2026-08-24
> **Objetivo:** Que cada juego declare sus propios controles en `GAME_ENGINES` y que la leyenda de teclas y la botonera táctil se pinten a partir de ese dato, en vez de estar escritas a mano con las de ASTEROIDES.

---

## 1 — Por qué existe este spec

El SPEC 05 montó el contrato de motores para que añadir un juego fuera «una línea en `GAME_ENGINES`». Lo consiguió a medias: el motor sí entra con una línea, pero **lo que el jugador lee de los controles no**.

Hoy, en `components/game-player.tsx`, la leyenda bajo el marco CRT está escrita a mano:

```tsx
<kbd>◄</kbd><kbd>►</kbd> Girar
<kbd>▲</kbd> Propulsar
<kbd>Espacio</kbd> Disparar
```

Y `components/games/touch-pad.tsx` tiene esos cuatro botones fijos en el JSX, con sus `aria-label` —«Girar a la izquierda», «Propulsar», «Disparar»— y su reparto en dos grupos. Son textos de un juego concreto dentro de dos componentes que se presentan como de la plataforma.

Mientras ASTEROIDES fue el único motor, eso no se notó. Con el segundo juego se rompe de la peor manera posible: **no falla, miente.** Un TETRIS montado hoy diría «Propulsar» debajo de la tecla que rota la pieza, y su botonera táctil anunciaría «Disparar» al lector de pantalla. El SPEC 05 no lo previó porque no tenía con qué verlo.

El tipo `GameAction` arrastra el mismo sesgo: `"left" | "right" | "thrust" | "fire"` son las acciones de una nave. Y son cuatro, cuando TETRIS necesita cinco.

Este spec no añade ningún juego y **no cambia nada de lo que se ve**. Es la mitad que le faltaba al SPEC 05, hecha aparte a propósito: mezclarla con el port de un juego sería meter refactor de plataforma y motor nuevo en la misma spec, que es exactamente lo que las SPEC 05 y 06 hicieron y anotaron como advertencia. Aquí se paga la deuda primero, con ASTEROIDES como único consumidor y con el listón puesto en que nadie note nada.

---

## 2 — Alcance

**Dentro:**

- **`GameAction` gana `"down"`.** Cinco acciones abstractas en vez de cuatro, y un comentario que deja claro que los nombres son los de asteroides pero el significado lo pone cada juego.
- **`GameEngineEntry` gana `keys` y `touch`:** la leyenda de teclas y la botonera que declara cada juego.
- **Dos tipos nuevos en `lib/games/registry.ts`:** `KeyHint` (un renglón de la leyenda) y `TouchButton` (un botón de la botonera, con su glifo, su etiqueta accesible y su color).
- **`components/games/touch-pad.tsx` pasa a recibir los grupos por props** y a pintarlos con `map`. Deja de saber qué juego está corriendo.
- **`components/game-player.tsx` pinta la leyenda desde `entry.keys`.** La tecla `P` de pausa se sigue añadiendo desde el reproductor, porque no es de ningún juego: la gestiona `game-canvas.tsx` y es igual para todos.
- **`ASTEROIDES` declara sus controles** en `GAME_ENGINES`, con exactamente los mismos textos, glifos, colores y reparto en grupos que hoy están escritos a mano.
- **`ACTION_KEYS` de `lib/games/asteroides/engine.ts` pasa a `Partial<Record<GameAction, string>>`**, con su guarda en `setAction`. Asteroides no tiene nada que bajar.

**Fuera de alcance (para specs futuras):**

- **Cualquier juego nuevo.** TETRIS es la **SPEC 08** y es quien estrena esto de verdad.
- **Que `.pad-key` se encoja.** Con cuatro botones no hace falta y no hay forma de comprobar que funcione. Entra en la SPEC 08, que es cuando aparece el quinto.
- **Remapear teclas.** El jugador no elige sus controles. Eso es preferencias, persistencia y una pantalla de ajustes: su propia spec.
- **Que la leyenda salga del mapa de teclas real del motor.** Los glifos de `keys` son presentación y el `KeyboardEvent.code` vive en el motor. Son dos sitios, a sabiendas; unificarlos es más maquinaria de la que esto necesita hoy.
- **Soporte de mando / gamepad.**
- **Que la pausa sea declarable por juego.** `P` y `Escape` son de la plataforma y así se quedan.
- **Los otros ocho juegos sin motor.** Siguen con su arena decorativa y sin leyenda ni botonera, que es lo que ya hacen.
- **Framework de tests.**

---

## 3 — Modelo de datos

### `lib/games/engine.ts`

Una sola línea cambia, más su comentario:

```ts
export type GameAction = "left" | "right" | "thrust" | "fire" | "down";
```

`GameSnapshot`, `GameEngine`, `CreateEngine`, `GAME_KEYS` e `isTextTarget` no se tocan.

### `lib/games/registry.ts`

```ts
/** Color del botón táctil. Reutiliza la semántica del HUD de al lado. */
export type TouchTone = "cyan" | "yellow" | "magenta";

/** Un renglón de la leyenda de teclas bajo el marco CRT. */
export type KeyHint = {
  /** Glifos que se ven: `["◄", "►"]`, `["Espacio"]`. No son `KeyboardEvent.code`. */
  keys: string[];
  /** Qué hace: «Girar», «Rotar». */
  label: string;
};

/** Un botón de la botonera táctil. */
export type TouchButton = {
  action: GameAction;
  glyph: string;
  /** Qué hace, para el lector de pantalla. */
  label: string;
  tone: TouchTone;
};

export type GameEngineEntry = {
  width: number;
  height: number;
  keys: KeyHint[];
  /** Repartida en grupos: el primero bajo el pulgar izquierdo, el segundo bajo el derecho. */
  touch: TouchButton[][];
  load: () => Promise<{ createEngine: CreateEngine }>;
};
```

`keys` y `touch` son **obligatorios**, no opcionales. Un motor sin controles declarados es un motor que el jugador no sabe usar, y el compilador es el sitio barato para descubrirlo.

`touch` es una lista de listas y no una lista plana porque el reparto en dos grupos es la decisión de ergonomía que ya tomó el SPEC 05: una fila centrada obliga a jugar con una mano.

### La entrada de ASTEROIDES

Traslado literal de lo que hoy está en el JSX, sin cambiar un carácter de lo que se lee:

```ts
keys: [
  { keys: ["◄", "►"], label: "Girar" },
  { keys: ["▲"], label: "Propulsar" },
  { keys: ["Espacio"], label: "Disparar" },
],
touch: [
  [
    { action: "left",  glyph: "◄", label: "Girar a la izquierda", tone: "cyan" },
    { action: "right", glyph: "►", label: "Girar a la derecha",   tone: "cyan" },
  ],
  [
    { action: "thrust", glyph: "▲", label: "Propulsar", tone: "yellow" },
    { action: "fire",   glyph: "●", label: "Disparar",  tone: "magenta" },
  ],
],
```

### `lib/games/asteroides/engine.ts`

```ts
const ACTION_KEYS: Partial<Record<GameAction, string>> = { … };
```

Y en `setAction`, una guarda: `if (!code) return;`. Sin ella, `code` es `string | undefined` y no compila.

---

## 4 — Plan de implementación

Cada paso deja la aplicación compilando y navegable.

1. **El contrato.** Añadir `"down"` a `GameAction` en `lib/games/engine.ts`, con el comentario que explica que los nombres son de asteroides y el significado lo pone cada juego. _Verificable:_ `npx tsc --noEmit` falla en `lib/games/asteroides/engine.ts` con `TS2741: Property 'down' is missing`. Ese fallo es el paso siguiente, no un accidente.

2. **Asteroides acepta el contrato nuevo.** `ACTION_KEYS` a `Partial<Record<GameAction, string>>` y guarda en `setAction`. _Verificable:_ `npx tsc --noEmit` pasa y `/jugar/asteroides` se juega igual que antes, botonera incluida.

3. **Los tipos del registro.** Añadir `TouchTone`, `KeyHint` y `TouchButton` a `lib/games/registry.ts`, y los campos `keys` y `touch` a `GameEngineEntry`. Rellenar la entrada de `asteroides` con el traslado literal del §3. _Verificable:_ `npx tsc --noEmit` pasa; todavía no se usa el dato y la pantalla no ha cambiado.

4. **La botonera, por datos.** `components/games/touch-pad.tsx` recibe `clusters: TouchButton[][]` y los pinta con dos `map` anidados; la clave de React de cada botón es su `action`. `game-player.tsx` le pasa `entry.touch`. _Verificable:_ en un viewport de puntero grueso, la botonera de `/jugar/asteroides` tiene los mismos cuatro botones, en el mismo orden, con los mismos colores y los mismos `aria-label`.

5. **La leyenda, por datos.** `game-player.tsx` pinta `entry.keys` con un `map`, y añade al final el renglón de `P` / Pausa, que no sale del registro. _Verificable:_ la leyenda de `/jugar/asteroides` se lee exactamente igual que antes: Girar, Propulsar, Disparar, Pausa.

---

## 5 — Criterios de aceptación

**Que no se note nada**

- [ ] La leyenda de teclas de `/jugar/asteroides` muestra los mismos cuatro renglones, en el mismo orden y con los mismos glifos que antes de este spec.
- [ ] La botonera táctil de `/jugar/asteroides` tiene los mismos cuatro botones, en los mismos dos grupos, con los mismos colores y los mismos `aria-label`.
- [ ] Cada botón táctil sigue moviendo la nave, y soltar el pulgar fuera del botón sigue soltando la acción.
- [ ] `←`, `→`, `↑`, `Espacio`, `P` y `Escape` siguen haciendo lo mismo en ASTEROIDES.
- [ ] `/jugar/caida` y los otros siete juegos sin motor siguen sin leyenda ni botonera, con su arena decorativa.

**Contrato**

- [ ] `GameAction` incluye `"down"`.
- [ ] `GameEngineEntry` declara `keys` y `touch` como campos obligatorios, y `lib/games/registry.ts` exporta `KeyHint`, `TouchButton` y `TouchTone`.
- [ ] `components/games/touch-pad.tsx` no contiene ningún texto de asteroides: ni «Girar», ni «Propulsar», ni «Disparar», ni los glifos `▲` y `●` escritos a mano.
- [ ] `components/game-player.tsx` no contiene ningún `<kbd>` con un glifo de asteroides. El único `<kbd>` literal que queda es el de `P`.
- [ ] Añadir una entrada a `GAME_ENGINES` sin `keys` o sin `touch` no compila.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.

---

## 6 — Decisiones tomadas y descartadas

**Spec propia, antes del juego que la necesita.** Se descartó meter este refactor dentro del port de TETRIS. Las SPEC 05 y 06 ya mezclaron dos dominios cada una y las dos lo dejaron anotado como advertencia asumida. Aquí no hace falta: el refactor se sostiene solo, tiene un consumidor con el que verificarlo —ASTEROIDES— y un criterio de aceptación redondo, que es que nadie note nada. Además deja la SPEC 08 hablando solo de TETRIS.

**`keys` y `touch` obligatorios, no opcionales.** Opcionales habrían evitado tocar la entrada de asteroides en el mismo paso. Pero un motor sin controles declarados se queda sin leyenda y sin botonera en silencio, y eso se descubre jugando. Obligatorios, se descubre compilando.

**Los glifos de la leyenda son presentación, no el mapa de teclas.** `keys: ["◄", "►"]` no son `KeyboardEvent.code`: el mapa real vive dentro de cada motor. Es duplicación, y está asumida. Derivar el glifo del código obligaría a una tabla `code → glifo` que hay que mantener igual, y a que el motor exportase su mapa solo para adornar. Queda anotado en los riesgos.

**`touch` es una lista de grupos, no una lista plana.** El reparto en dos clusters no es maquetación accidental: es la decisión del SPEC 05 de que se juegue con los dos pulgares. Si fuera plana, el componente tendría que inventarse dónde partir.

**`GameAction` gana `"down"` aquí y no en la SPEC 08.** Es el contrato de la plataforma, y este es el spec del contrato. Dejarlo para el port obligaría a TETRIS a tocar `lib/games/engine.ts` y el motor de asteroides, que es justo lo que este spec existe para evitar.

**Los nombres de las acciones se quedan como están.** Renombrar `thrust` a algo neutro tocaría el motor de asteroides, el registro y la botonera para no cambiar nada de lo que se ve. El significado lo pone cada juego y eso queda documentado en el tipo; el nombre es un identificador, no una etiqueta.

**La pausa no se declara por juego.** `P` y `Escape` los engancha `game-canvas.tsx`, no los motores. Si cada juego declarase su renglón de pausa, el primero que se lo olvidara dejaría al jugador sin saber cómo pausar.

**El encogido de `.pad-key` se queda fuera.** Con cuatro botones no hay desbordamiento que arreglar ni forma de comprobar el arreglo. Va en la SPEC 08, con el quinto botón y con un criterio de aceptación que se puede verificar de verdad.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                    | Mitigación                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Los glifos de `keys` se desincronizan del mapa de teclas del motor: la leyenda dice `▲` y el motor lee otra cosa.         | Está declarado como duplicación asumida en el §6. Los dos ficheros de un juego viven en la misma carpeta y el cambio de tecla se hace en el mismo paso.            |
| El traslado de los textos de asteroides introduce una errata y nadie la ve, porque nadie compara letra a letra.           | Los criterios de aceptación piden los mismos textos, y el diff del paso 3 y del 5 enseña las dos versiones juntas.                                                 |
| `Partial<Record<…>>` en `ACTION_KEYS` esconde que a un motor le falte una acción que sí usa.                              | Cada motor solo mapea las acciones que declara en su `touch`, y la botonera no puede pedir otra: el tipo de `TouchButton.action` la obliga a ser una de las suyas. |
| Un componente cliente pasa a depender de `lib/games/registry.ts` para tipos, y ese fichero importa el contrato del motor. | `registry.ts` no importa nada de servidor —ni `next/headers`, ni Supabase—, solo tipos y `import()` diferidos. Ya lo importaba `game-player.tsx` antes del spec.   |

---

## Lo que **no** entra en este spec

Ningún juego nuevo: TETRIS es la SPEC 08. El encogido de `.pad-key` para cinco botones. Remapear teclas. Soporte de mando. Que la leyenda salga del mapa de teclas real. Pausa declarable por juego. Los ocho juegos sin motor. Tests.
