---
description: Implementa un spec aprobado de game jam (specs/game-jam/<game-id>/spec-diseno.md + spec-implementacion.md). Valida el estado, crea la rama juego-<game-id>, implementa el plan completo sin pausas, y encadena skin-designer y mobile-porter en serie al terminar.
disable-model-invocation: true
argument-hint: <game-id>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — implementador de specs de game jam

Es la misma idea que `/spec-impl`, adaptada al formato de dos ficheros que produce el
agente `game-jam` en vez de al de `specs/NN-slug.md`. Dos diferencias deliberadas frente
a `/spec-impl`: aquí el plan de implementación se ejecuta completo y seguido, sin pausar
a pedir confirmación tras cada paso (se revisa todo junto al final), y al terminar se
encadenan automáticamente dos agentes del proyecto, uno detrás del otro.

## Contexto de sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs de game jam disponibles:
!`ls specs/game-jam/ 2>/dev/null || echo "No existe specs/game-jam/"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (valor por defecto, no hay fichero de config)"`

---

## Instrucciones

Sigue estas cinco fases en orden estricto. **No avances a la siguiente fase si la
anterior no se completó correctamente.**

---

### Fase 1 — Identificar el spec de game jam

El argumento recibido es: `$ARGUMENTS`

Es un `game-id` (el slug de la carpeta, p. ej. `invasores`), no un número.

Si `$ARGUMENTS` está vacío:

- Lista las carpetas disponibles en `specs/game-jam/` (ya las tienes arriba).
- Pide al usuario el `game-id` exacto.
- Detente y espera respuesta. No continúes.

Si `$ARGUMENTS` tiene valor:

- Busca la carpeta `specs/game-jam/<game-id>/`.
- Dentro, comprueba que existan **ambos** ficheros con nombre exacto: `spec-diseno.md` y
  `spec-implementacion.md`. Este comando solo sabe leer ese formato de dos ficheros — el
  que produce el agente `game-jam` — no cualquier spec que viva bajo `specs/game-jam/`.
  Si la carpeta existe pero tiene otro formato (por ejemplo un único fichero numerado, al
  estilo `specs/game-jam/frogger/01-frogger-core.md`), detente y dilo explícitamente: ese
  spec no es compatible con este comando.
- Si no encuentras la carpeta, muestra las disponibles y pide al usuario que corrija el
  nombre.
- Si la encuentras con los dos ficheros correctos, continúa a la Fase 2.

---

### Fase 2 — Validar el estado del spec

Lee `spec-diseno.md` con la herramienta Read o `cat`.

Busca la línea de estado, con este formato (nota el `>` de cita y los dos puntos):

```
> Estado: <valor> — <resto de la línea>
```

El guion largo y el resto son opcionales; el valor de estado es el texto entre `Estado:`
y el primer `—` (o el final de la línea si no hay guion largo). Recorta espacios.

**Regla absoluta:** solo puedes continuar si ese valor **significa "Aprobado"** — en
cualquier idioma en que esté escrito el spec.

Trata como estado **Aprobado** (y continúa): `Aprobado`, `Approved`, `Aprovado`,
`Approuvé`, `Genehmigt`, `Approvato`, o el equivalente evidente en otro idioma.

Cualquier otro valor — incluido el estado con el que nace todo spec de `game-jam`,
`Propuesto — game jam, pendiente de decisión (no implementado)`, o `En revisión`,
`Implementado`, `Obsoleto`, o un valor que no reconozcas — significa **detenerse** y
mostrar:

```
❌ No puedo implementar este spec de game jam.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado signifique "Aprobado" (p. ej. `Aprobado`, `Approved`,
o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si el spec está listo para implementarse, abre specs/game-jam/<game-id>/spec-diseno.md
     y cambia el estado a "Aprobado" (o el término equivalente que use tu equipo) a mano.
     Ese cambio lo hace una persona, no el agente.
  2. Si el spec todavía necesita trabajo, pide al agente game-jam o a /spec que lo revise.
```

No ofrezcas alternativas ni sugieras "puedo empezar igual si quieres". Es un bloqueo
intencional.

Si no encuentras la línea de estado, o el valor no es reconocible con confianza, no
asumas: detente y pide al usuario que aclare o normalice la línea.

---

### Fase 3 — Crear la rama y mostrar el resumen

Una vez confirmado que el estado significa `Aprobado`:

0. **Revisa primero el working tree.** Mira `git status --short` del contexto de sesión.
   Si **no está vacío**, detente, muestra los cambios pendientes y pregunta:

   ```
   ⚠️ Hay cambios sin commitear en el working tree.
   Cambiar de rama los arrastraría. ¿Qué quieres hacer?
     1. Commitearlos o guardarlos en stash tú mismo y volver a lanzar este comando (recomendado)
     2. Continuar igualmente — los cambios viajan a la rama nueva
   ```

   Espera respuesta. **No hagas stash ni commit por tu cuenta** salvo que el usuario lo
   pida explícitamente. Si el working tree está limpio, salta directo al paso 1 sin
   mencionarlo.

1. El nombre de rama es `juego-<game-id>` (ej. `specs/game-jam/invasores/` →
   `juego-invasores`).

2. Lee el flag `AutoCreateBranch` del contexto de sesión (mismo fichero y misma política
   que usa `/spec-impl` — no es una config nueva).

   - Si el fichero no existe, el valor falta, o es irreconocible → trátalo como `true`
     (el valor por defecto).
   - Solo un `false` explícito (en cualquier capitalización) desactiva la creación
     automática.

   **Si `AutoCreateBranch` es `true` (por defecto):** procede sin preguntar.

   - Si la rama **no existe**: créala con `git checkout -b juego-<game-id>`.
   - Si **ya existe**: se está retomando trabajo previo. Cámbiate a ella, lee
     `git log --oneline` sobre la rama, y cuenta al usuario qué pasos del plan ya parecen
     hechos y desde cuál propones retomar. Espera confirmación del punto de retoma antes
     de implementar nada.
   - En ambos casos: cambia a la rama con `git checkout juego-<game-id>` y confirma el
     cambio antes de seguir.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de tocar git. Muestra:

   ```
   AutoCreateBranch está en false.
   ¿Creo y cambio a la rama juego-<game-id>? [y/N]
   ```

   - Si el usuario responde **sí**: crea/cambia a la rama exactamente igual que en el
     caso `true`.
   - Si responde **no** o deja vacío: **no crees ninguna rama.** Dile que implementarás
     en la rama actual (la del contexto de sesión) y pide confirmación explícita para
     continuar ahí. No lo des por hecho — espera la respuesta.

3. Confirma visualmente al usuario que el spec está listo y qué rama está activa:

   ```
   ✅ Listo para implementar.

   Spec:   specs/game-jam/<game-id>/ (spec-diseno.md + spec-implementacion.md)
   Rama:   juego-<game-id>  (activa)   (← o la rama actual, si no se creó una nueva)
   Estado: Aprobado   (← el valor real encontrado en spec-diseno.md)
   ```

4. **Todavía no empieces a implementar.** Muestra primero el resumen combinado de los
   dos ficheros:
   - El **porqué** — `spec-diseno.md` §1.
   - El **alcance** — `spec-diseno.md` §2.
   - El **plan de implementación** — `spec-implementacion.md` §4 (los pasos numerados).
   - Los **criterios de aceptación** — `spec-implementacion.md` §5 (el checklist).

---

### Fase 4 — Implementar el plan completo, sin pausas por paso

Tras mostrar el resumen, dile al usuario:

```
Voy a implementar el §4 completo del spec, paso por paso y sin pausar entre pasos.
Al terminar todos los pasos te muestro el resumen y reviso los criterios de aceptación
del §5 contigo.

¿Empiezo?
```

Espera confirmación explícita ("sí", "adelante", "va", o equivalente). No empieces sin
ella.

Confirmado, sigue estas reglas durante toda la implementación:

- **Ejecuta todos los pasos del §4 seguidos, sin detenerte a pedir confirmación entre
  uno y el siguiente.** A diferencia de `/spec-impl`, aquí no hay pausa por paso — es la
  forma en que ya se usa `/spec-impl` en este proyecto, adoptada de entrada para este
  comando.
- **Nunca commitees automáticamente.** Ni por paso, ni al final. Escribes el código y lo
  dejas ahí; commitear es decisión del usuario y orden del usuario.
- **Una regla por encima de todas:** implementa lo que dice el spec. Si algo del spec te
  parece mejorable, anótalo como observación pero implementa lo acordado. Los cambios al
  spec van al spec, no al código por sorpresa.
- **Si durante la implementación encuentras una ambigüedad real** que el spec no
  resuelve: detente, descríbela con precisión, presenta dos o tres opciones concretas, y
  espera la decisión del usuario. No improvises.
- **Si el usuario pide algo fuera del alcance del spec:** recuérdale que está fuera de
  alcance, sugiere anotarlo para otro spec, y no lo implementes en esta rama.
- A medida que completas cada paso, guarda internamente un resumen breve de qué ficheros
  tocaste y qué hiciste — lo necesitas para el resumen final, no para mostrarlo paso a
  paso.

Al terminar el último paso del §4:

```
✅ Todos los pasos del plan están implementados.
```

Muestra el resumen fichero por fichero de los pasos, y **repasa el §5 (criterios de
aceptación) uno por uno contra lo implementado**, marcando cada uno como cumplido o no
cumplido. Si algo no se cumple, dilo explícitamente — no lo des por bueno.

---

### Fase 5 — Encadena skin-designer y mobile-porter, en serie

Automático: no hace falta pedir confirmación adicional para lanzar esta fase — ya la
pidió el usuario al definir este comando. Pero respeta el orden: **nunca lances los dos
agentes en el mismo mensaje ni en paralelo.** Un `Agent` por turno, esperando el
resultado del primero antes de invocar el segundo.

**Paso A — `skin-designer`.** Invoca la herramienta `Agent` con `subagent_type:
"skin-designer"` (agente nuevo, no fork — necesita hacer su propio barrido del código).
El prompt debe ser autocontenido, con contexto que el agente no tiene por defecto:

- Qué juego se acaba de implementar: `game-id`, título, ruta `/jugar/<game-id>`.
- Qué motor y ficheros creó la Fase 4 (p. ej. `lib/games/<game-id>/engine.ts` y la
  entrada correspondiente en `lib/games/registry.ts`).
- Que construya y/o audite el sistema de tres skins (clásico/retro/neón) para este juego
  siguiendo su proceso habitual — chrome vía `data-skin` en `.av-player` más, si el motor
  es uno de los reales, la paleta en canvas vía `GameEngine.setSkin`.

Espera a que termine y lee su informe final antes de seguir.

**Paso B — `mobile-porter`.** Solo después de que el Paso A haya terminado, invoca
`Agent` con `subagent_type: "mobile-porter"` (agente nuevo, no fork). El prompt debe
incluir:

- El `game-id` y que `/juego/<game-id>` y `/jugar/<game-id>` son rutas nuevas que hay que
  cubrir en su barrido, además de las rutas que ya audita siempre.
- Que siga su proceso habitual completo (Pasos 0 a 4 de su propia definición): levantar
  el sitio, recorrer viewports, corregir, verificar con `npm run build`/`lint`.

Espera a que termine y lee su informe final.

---

## Cierre

En el chat, en español, un resumen corto:

1. Spec usado (`specs/game-jam/<game-id>/`) y rama activa (`juego-<game-id>`).
2. Pasos del §4 implementados, fichero por fichero.
3. Resultado del repaso de criterios de aceptación (§5): cumplidos / no cumplidos.
4. Resumen de lo que hizo `skin-designer`.
5. Resumen de lo que hizo `mobile-porter`, incluyendo cualquier limitación que haya
   avisado que no pudo verificar de verdad (típicamente `(pointer: coarse)`).
6. Recordatorio final: falta actualizar el estado de `spec-diseno.md` a "Implementado" y
   hacer el commit — eso lo decide el usuario, este comando nunca commitea.
