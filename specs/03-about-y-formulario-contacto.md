# SPEC 03 — Página Acerca de y formulario de contacto con Resend

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-19
> **Objetivo:** Portar `references/home-about/about.jsx` a la ruta `/about` y hacer que su formulario envíe correo de verdad con Resend mediante un Server Action.

---

## 1 — Por qué existe este spec

El SPEC 02 dejó la página **Acerca de** explícitamente fuera de su alcance, junto con su enlace en la nav: _"La página Acerca de (`references/home-about/about.jsx`) y su formulario de contacto con terminal. Spec propio."_ Este es ese spec propio.

Hoy la nav tiene tres enlaces (`Inicio`, `Juegos`, `Salón de la Fama`) y la referencia tiene cuatro: falta `Acerca de`. Falta también la única pantalla del proyecto donde alguien puede explicar qué es Arcade Vault y por qué es gratis, y la única vía de contacto de toda la plataforma.

En `references/home-about/about.jsx` está la maqueta completa (190 líneas) con el mismo enfoque que el resto de templates: React UMD con routing por hash. Su CSS vive en `references/home-about/styles.css`, bloque `ABOUT PAGE` (líneas 1071–1146), y **ninguna de sus clases está todavía en `app/globals.css`** — se contrastaron los selectores contra las 1298 líneas actuales y solo aparece `.field` (líneas 838–849), que ya vino con el SPEC 01 y es idéntica, y `@keyframes blink`, que ya existe. Ni `.about-hero`, ni `.highlight`, ni `.about-divider`, ni `.contact-form`, ni `.terminal-success`, ni `.term-body` están.

La diferencia de fondo con los dos specs anteriores: **este es el primer spec que ejecuta código en el servidor**. Hasta ahora todo era maqueta con datos mock. El formulario del template simula el envío (`setSent(form.name)` y ya está); aquí el correo sale de verdad, hay una clave de API, hay variables de entorno y hay estados de fallo que el template no contempla.

---

## 2 — Alcance

**Dentro:**

- Nueva ruta `/about` con la página completa portada del template: hero con misión, fila de tres destacados con icono pixel, banda divisoria animada y sección de contacto con formulario.
- Cuarto enlace **Acerca de** (`/about`) en la nav de escritorio y en el panel lateral móvil, con su estado activo.
- Envío de correo real con **Resend** desde un **Server Action**. El formulario es cliente; la clave de API nunca sale del servidor y no se expone ningún endpoint público.
- **Dos correos por envío:** uno al equipo (obligatorio) y un acuse de recibo al visitante (best-effort, ver §6).
- Ambos correos en **HTML con la estética retro** del proyecto: fondo oscuro, acentos neón, tipografía monoespaciada.
- Revalidación en servidor de los tres campos (obligatorios, formato de correo, límites de longitud). La validación de cliente del template —la sacudida— se conserva tal cual.
- Tres variables de entorno: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` y `CONTACT_TO_EMAIL`, más un `.env.example` que las documenta.
- **Dos estados nuevos que el template no tiene:** `enviando` (botón deshabilitado) y `error` (terminal en rojo con `[ERROR]` y botón `REINTENTAR`).
- Portar a `app/globals.css` el bloque `ABOUT PAGE` de `references/home-about/styles.css` (1071–1146), más el CSS **nuevo** de los dos estados anteriores.
- Añadir `<HighlightIcon kind={...} />` a `components/pixel-art.tsx` con los tres iconos `HEART`, `BROWSER` y `PLANT`.

**Fuera de alcance (para specs futuras):**

- Verificar un dominio propio en Resend. Se trabaja con `onboarding@resend.dev` en `CONTACT_FROM_EMAIL` y se cambia el valor de la variable cuando exista dominio, **sin tocar código**.
- Honeypot, captcha, límite por IP o cualquier otra defensa antispam más allá de la revalidación de campos. Decisión explícita del usuario; ver §6.
- Guardar los mensajes en ninguna parte. No hay base de datos, no hay `localStorage`, no hay registro de envíos más allá del log del servidor.
- Zod o cualquier librería de validación. La única dependencia nueva de este spec es `resend`.
- `useActionState` de React 19. El formulario mantiene el estado manual del template.
- Adjuntos, campo de asunto o selector de motivo del mensaje. El template tiene tres campos y se quedan tres.
- Enlace a `Acerca de` en el pie de página. El pie sigue siendo la línea de copyright del SPEC 01.
- Metadatos SEO, Open Graph, `sitemap.ts` o `robots.ts`. Siguen fuera, como en el SPEC 02.
- El CSS del gamepad (`.gp*`, líneas 1151–1619 de la referencia). La página Acerca de tampoco lo usa.
- El desbordamiento del botón `≡` de la nav a 375 px. Deuda conocida del SPEC 01; este spec añade un cuarto enlace a `.links`, que a esa anchura ya está oculta, así que no lo empeora ni lo arregla.
- Framework de tests.

---

## 3 — Modelo de datos

No hay persistencia. Lo que este spec introduce son un tipo de formulario, un tipo de resultado y la configuración por entorno.

### `lib/contact.ts`

```ts
export type ContactInput = {
  name: string;
  email: string;
  msg: string;
};

export type ContactResult =
  | { ok: true }
  | { ok: false; reason: "validation" | "config" | "send" };

// Límites revalidados en servidor. El cliente no los impone.
export const LIMITS = {
  name: 80,
  email: 160,
  msg: 2000,
} as const;

/** Devuelve null si el input es válido, o el motivo del rechazo. */
export function validateContact(input: ContactInput): "validation" | null;

/** Cuerpo HTML retro del correo que recibe el equipo. */
export function teamEmailHtml(input: ContactInput): string;

/** Cuerpo HTML retro del acuse de recibo que recibe el visitante. */
export function replyEmailHtml(input: ContactInput): string;
```

`validateContact` comprueba, en este orden: los tres campos no vacíos tras `trim()`, cada uno dentro de su límite de `LIMITS`, y `email` contra un patrón simple (`algo@algo.algo`, sin espacios). Ningún otro criterio: un correo tipográficamente válido pero inexistente se acepta, porque el único juez real de eso es el propio envío.

`ContactResult` distingue tres motivos de fallo porque llevan a mensajes distintos en el terminal rojo: `validation` (el visitante puede arreglarlo), `config` (falta `RESEND_API_KEY` o una dirección: no es culpa suya) y `send` (Resend respondió con error o la red falló).

### Variables de entorno

```bash
# .env.example — se versiona; .env.local no
RESEND_API_KEY=
CONTACT_FROM_EMAIL=onboarding@resend.dev
CONTACT_TO_EMAIL=
```

Las tres se leen **dentro del Server Action**, nunca en el ámbito de módulo. Si faltan, la app compila y arranca igual y solo falla el envío, con `reason: "config"`. Ninguna lleva el prefijo `NEXT_PUBLIC_`: el navegador no debe verlas.

### Los dos correos

|                       | Al equipo                          | Al visitante (acuse)                       |
| --------------------- | ---------------------------------- | ------------------------------------------ |
| `to`                  | `CONTACT_TO_EMAIL`                 | `input.email`                              |
| `from`                | `CONTACT_FROM_EMAIL`               | `CONTACT_FROM_EMAIL`                       |
| `replyTo`             | `input.email`                      | —                                          |
| `subject`             | `[Arcade Vault] Mensaje de {name}` | `Hemos recibido tu mensaje — Arcade Vault` |
| `html`                | `teamEmailHtml(input)`             | `replyEmailHtml(input)`                    |
| ¿Decide el resultado? | **Sí**                             | No                                         |

El `replyTo` del correo al equipo es la dirección del visitante: responder desde el cliente de correo va directo a quien escribió, sin copiar direcciones a mano.

Las dos plantillas HTML son estáticas y se escriben a mano en `lib/contact.ts` con estilos **en línea** (los clientes de correo ignoran las hojas externas y buena parte de `<style>`): fondo `#0a0a0f`, borde y titulares en cian `#00f5ff`, acentos en magenta `#ff00e5`, cuerpo en monoespaciada. El mensaje del visitante se inserta escapado (`&`, `<`, `>`, `"`) y con `white-space: pre-wrap` para conservar sus saltos de línea.

---

## 4 — Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.example` con las tres variables y `CONTACT_FROM_EMAIL=onboarding@resend.dev` como valor por defecto. Verificar que `.env.local` está ignorado por git (el `.gitignore` del scaffold ya cubre `.env*`). Verificación: `npm run build` pasa sin ningún `.env.local` presente.

2. **CSS.** Insertar en `app/globals.css` el bloque `ABOUT PAGE` de `references/home-about/styles.css` (líneas 1071–1146) **antes** de `/* ===== accessibility floor ===== */`, igual que hizo el SPEC 02, para que las reglas de movimiento reducido sigan ganando por orden de fuente. Se porta entero salvo `.field`, que ya existe idéntica en las líneas 838–849. Incluye `@keyframes pxblink` y `@keyframes shake`, ninguno presente hoy. A continuación, las reglas **nuevas** de los estados que el template no tiene: `.terminal-success.error` (borde y sombra en rojo en vez de verde), `.term-body .line.err`, y `.btn:disabled` (opacidad reducida, `cursor: not-allowed`, sin sombra). Verificación: `npm run build` pasa y los selectores portados no colisionan con ninguno existente.

3. **Iconos.** Añadir a `components/pixel-art.tsx` la exportación `<HighlightIcon kind={...} />` con `HighlightKind = "HEART" | "BROWSER" | "PLANT"`, portando literalmente los tres SVG de 16×16 de `about.jsx` (`<rect>` sobre `currentColor`, `image-rendering: pixelated` vía la clase `.hl-icon`). Verificación: `npx tsc --noEmit` pasa.

4. **Página estática.** Crear `components/about.tsx` como componente cliente que llama a `useReveal()` y renderiza **sin formulario todavía**: el hero (`▸ ACERCA DE`, título `ACERCA DE ARCADE VAULT`, párrafo de misión), la fila de tres destacados con su `transitionDelay` escalonado de 80 ms, la banda `.about-divider` con sus 24 píxeles parpadeantes, y la columna izquierda de contacto (`▸ CONTACTO`, `CONTÁCTANOS`, subtítulo y los tres `tip` con su LED de color). Crear `app/about/page.tsx` como Server Component que renderiza `<About />`. Verificación: `/about` se ve completa salvo la columna del formulario, en escritorio y a 375 px.

5. **Formulario sin envío.** Añadir a `about.tsx` el `<form>` con los tres campos controlados, el botón `▶ ENVIAR MENSAJE`, la sacudida al enviar con algún campo vacío (`setShake(true)` + `setTimeout(400)`) y el terminal verde de éxito con su botón `ENVIAR OTRO MENSAJE`. El envío sigue siendo falso: `setSent(name)` directo, como en el template. Verificación: enviar vacío sacude; enviar relleno pinta el terminal verde con el nombre en mayúsculas; `ENVIAR OTRO MENSAJE` vuelve al formulario limpio.

6. **Lógica de contacto.** Crear `lib/contact.ts` con los tipos, `LIMITS`, `validateContact`, `teamEmailHtml` y `replyEmailHtml`, incluido el escapado de HTML del contenido del visitante. Este archivo no importa `resend` ni lee `process.env`: es puro y no arrastra nada al cliente. Verificación: `npx tsc --noEmit` pasa.

7. **Server Action.** Crear `app/about/actions.ts` con `"use server"` y `export async function sendContactMessage(input: ContactInput): Promise<ContactResult>`. Secuencia: revalidar con `validateContact`; leer las tres variables de entorno y devolver `{ ok: false, reason: "config" }` si falta alguna; instanciar `new Resend(key)`; enviar el correo al equipo dentro de un `try/catch` y devolver `{ ok: false, reason: "send" }` si falla o si la respuesta trae `error`; **después**, enviar el acuse en su propio `try/catch` cuyo fallo solo se registra con `console.error` y nunca cambia el resultado; devolver `{ ok: true }`. Verificación: `npx tsc --noEmit` pasa y `grep -rn "RESEND_API_KEY" components/` no devuelve nada.

8. **Conectar el formulario.** Sustituir el envío falso del paso 5 por la llamada al Server Action. El estado del formulario pasa a `"idle" | "sending" | "sent" | "error"` más el motivo del fallo. Durante `sending` el botón se deshabilita y dice `◌ ENVIANDO…`. Con `ok: true` se pinta el terminal verde ya existente. Con `ok: false` se pinta el terminal en rojo: mismas tres líneas de proceso, la última `[ERROR]` con el texto propio de cada `reason`, y un botón `REINTENTAR` que devuelve el formulario a `idle` **conservando lo que el visitante escribió**. Verificación: con `RESEND_API_KEY` vacía sale el terminal rojo de configuración y el texto del mensaje no se pierde al reintentar.

9. **Envío real.** Con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` puestas en `.env.local`, enviar un mensaje de prueba. Verificación: llega el correo al equipo con el asunto y el HTML retro correctos, responder desde el cliente de correo escribe a la dirección del visitante, y el fallo del acuse (403 de `onboarding@resend.dev` a un tercero) aparece en el log del servidor sin alterar el terminal verde.

10. **Nav.** Añadir el cuarto enlace `Acerca de` → `/about` en `components/nav.tsx`, en la barra de escritorio y en el panel lateral móvil, con `aboutActive = pathname === "/about"`. Va después de `Salón de la Fama`, como en `references/home-about/nav.jsx`. Verificación: cada ruta marca en cian exactamente un enlace, y `/about` marca `Acerca de`.

11. **Repaso.** Recorrer `/about` comparándola contra `references/home-about/arcade-vault-standalone.html` abierto al lado, en 1440×900 y 375×812, y comprobar que `/`, `/games`, `/juego/caida`, `/jugar/caida`, `/auth` y `/salon` siguen igual tras el cambio de nav.

---

## 5 — Criterios de aceptación

**Compilación**

- [ ] `npm run build` termina sin errores de tipos ni de compilación **sin ningún `.env.local` presente**.
- [ ] `npm run lint` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/about`.
- [ ] `resend` es la única dependencia nueva en `package.json`.

**Ruta y nav**

- [ ] `/about` renderiza la página completa.
- [ ] La barra de escritorio muestra cuatro enlaces: `Inicio`, `Juegos`, `Salón de la Fama` y `Acerca de`.
- [ ] En `/about` se marca en cian `Acerca de`, y en las demás rutas no se marca.
- [ ] Por debajo de 840 px el panel lateral muestra los mismos cuatro enlaces más el de sesión.
- [ ] Las cinco pantallas del SPEC 01 y la landing del SPEC 02 se ven exactamente igual que antes.

**Página — contenido estático**

- [ ] El hero muestra el kicker `▸ ACERCA DE` en amarillo, el título `ACERCA DE ARCADE VAULT` con degradado blanco→cian, y el párrafo de misión.
- [ ] La fila de destacados muestra tres tarjetas con su icono pixel y su color: corazón en magenta, navegador en cian, planta en verde.
- [ ] Al pasar el ratón, cada destacado se eleva 3 px y su borde toma su propio color.
- [ ] La banda divisoria muestra 24 píxeles parpadeando con retardo escalonado de 80 ms entre barras magenta.
- [ ] La columna de contacto muestra los tres avisos con su LED: verde `RESPUESTA EN 24-48H`, amarillo `SUGERENCIAS BIENVENIDAS`, magenta `SIN SPAM, JAMÁS`.

**Formulario — validación**

- [ ] Enviar con cualquiera de los tres campos vacío o solo con espacios sacude el formulario 400 ms y no llama al servidor.
- [ ] Un correo sin `@` o con espacios se rechaza y sale el terminal rojo de validación.
- [ ] Un mensaje de más de 2000 caracteres se rechaza en el servidor.

**Formulario — estados**

- [ ] Durante el envío el botón está deshabilitado y dice `◌ ENVIANDO…`; no se puede enviar dos veces con doble clic.
- [ ] Al terminar bien, el terminal verde muestra las tres líneas `[OK]` y `> MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE}.` con el guion parpadeante.
- [ ] `ENVIAR OTRO MENSAJE` devuelve al formulario con los tres campos vacíos.
- [ ] Al fallar, el terminal sale en rojo con la línea `[ERROR]` y un texto distinto según sea configuración, red o validación.
- [ ] `REINTENTAR` devuelve al formulario **con el texto que había escrito el visitante intacto**.

**Correo**

- [ ] El equipo recibe el correo en `CONTACT_TO_EMAIL` con el asunto `[Arcade Vault] Mensaje de {name}`.
- [ ] El cuerpo llega con la estética retro y muestra nombre, correo y mensaje, con los saltos de línea del original conservados.
- [ ] Responder a ese correo desde el cliente escribe a la dirección del visitante, no a `CONTACT_FROM_EMAIL`.
- [ ] Un mensaje que contenga `<script>` llega escapado como texto, no como marcado.
- [ ] Si el acuse al visitante falla, el envío al equipo llega igual y el visitante sigue viendo el terminal verde.
- [ ] Con `RESEND_API_KEY` sin definir, `/about` carga con normalidad y solo el envío devuelve el terminal rojo.

**Seguridad**

- [ ] `RESEND_API_KEY` no aparece en ningún archivo de `components/` ni en el bundle del cliente.
- [ ] No existe ningún endpoint HTTP público de contacto: el envío solo se alcanza por el Server Action.
- [ ] `.env.local` no está versionado.

**Responsive y accesibilidad**

- [ ] A 375 px la fila de destacados pasa a una columna y la rejilla de contacto también.
- [ ] A 375 px no hay scroll horizontal en ninguna sección de `/about` (salvo el desbordamiento conocido de la nav, deuda del SPEC 01).
- [ ] Con `prefers-reduced-motion: reduce`, la banda divisoria y la sección de contacto son visibles desde el primer render y los píxeles no parpadean.
- [ ] Los tres campos tienen su `<label>` asociado y el foco se ve con el contorno cian de `:focus-visible`.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** la ruta es `/about` y el enlace de la nav dice `Acerca de`. Sigue el patrón ya establecido: ruta en inglés como `/games` y `/auth`, etiqueta en español como el resto de la barra.
- **No:** `/acerca-de`. Coincidiría con `/juego`, `/jugar` y `/salon`, pero el SPEC 02 ya decidió el inglés para las rutas nuevas y cambiar de criterio en cada spec es peor que cualquiera de los dos criterios.
- **Sí:** el envío es un **Server Action**. La clave de API se queda en el servidor, no hay endpoint público que un bot pueda encontrar y golpear, y es lo idiomático en Next 16.
- **No:** un Route Handler `POST /api/contact`. Más código, un `fetch` manual y un endpoint expuesto a spam directo, a cambio de una reutilización desde fuera que nadie ha pedido.
- **No:** `useActionState` de React 19. Habría reestructurado el formulario del template; con el estado manual el marcado se queda como está y solo cambia el manejador.
- **Sí:** `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` y `CONTACT_TO_EMAIL` como variables de entorno, las tres leídas dentro del Server Action. **El usuario facilitará los valores después de escribir el spec**, así que el código tiene que compilar, arrancar y servir `/about` sin ellas. Leerlas en el ámbito de módulo tumbaría el build en limpio.
- **No:** romper el arranque si falta la clave. Dejaría el repo sin poder compilarse hasta tener credenciales, y el resto de la app no depende de ellas para nada.
- **No:** modo simulado que registra en consola y devuelve éxito cuando falta la clave. Cómodo para maquetar, pero convierte una mala configuración en producción en un correo perdido en silencio, que es exactamente el fallo que este spec quiere evitar.
- **Sí:** los correos van en **HTML con la estética retro**, con estilos en línea. Decisión explícita del usuario. Los estilos van en línea porque los clientes de correo descartan las hojas externas y buena parte de `<style>`.
- **No:** texto plano, ni la combinación de texto y HTML. Lo primero es lo que el usuario descartó; lo segundo duplica el contenido a mantener sin que nadie lo vaya a leer en el formato alternativo.
- **Sí:** **acuse de recibo automático al visitante**, decisión explícita del usuario, implementado como **best-effort**: se intenta siempre, y si falla solo se registra en el log. Lo que ve el visitante lo decide únicamente el correo al equipo.
- **Motivo del best-effort:** `onboarding@resend.dev`, el remitente de pruebas de Resend, **solo puede enviar a la dirección de la propia cuenta**; a cualquier otro destinatario devuelve 403. El correo al equipo funciona desde el primer día porque va a esa dirección; el acuse al visitante empezará a llegar en cuanto haya un dominio verificado en `CONTACT_FROM_EMAIL`, **sin tocar una línea de código**.
- **No:** hacer obligatorios los dos envíos. El visitante vería un terminal rojo con el mensaje ya entregado en la bandeja del equipo, y reenviaría duplicados mientras no hubiera dominio.
- **No:** esconder el acuse tras una variable apagada por defecto. Añade una cuarta variable y un camino de código que nadie ejercita; el `console.error` del 403 es información útil, no ruido.
- **Sí:** **solo revalidación en servidor**, sin honeypot, sin captcha y sin límite por IP. Decisión explícita del usuario. El riesgo asumido queda registrado en §7.
- **No:** Zod. El proyecto no tiene hoy ninguna dependencia aparte de Next y React; tres campos con tres límites y una expresión regular no justifican la primera.
- **Sí:** dos estados nuevos que el template no tiene, `enviando` y `error`, con su CSS propio. Sin ellos un fallo de Resend pintaría el terminal verde y el mensaje se perdería sin que nadie se enterase; y sin `enviando`, un doble clic manda el correo dos veces.
- **Sí:** el terminal de error reutiliza el marcado de `.terminal-success` con una clase `error` que solo cambia los colores. Mismo componente visual, cero marcado duplicado.
- **Sí:** `REINTENTAR` conserva lo escrito. Perder un mensaje de 2000 caracteres por un fallo del servidor es la forma más rápida de que nadie vuelva a escribir.
- **Sí:** el CSS se copia de `references/home-about/styles.css` a `app/globals.css` sin traducir a Tailwind, con la misma decisión y por las mismas razones que los SPEC 01 y 02.
- **Sí:** `HighlightIcon` vive en `components/pixel-art.tsx`, junto a `FeatureIcon` y `FloatingSilhouettes`. Es exactamente la misma clase de cosa y el archivo ya existe por el SPEC 02.
- **No:** añadir `Acerca de` al pie de página. El pie es una sola línea de copyright y convertirlo en un mapa del sitio es otro trabajo.
- **Sí:** los textos de la página se copian literalmente del template, misión y avisos incluidos. El usuario pidió seguir el template exactamente.

---

## 7 — Riesgos identificados

| Riesgo                                                                                                                                                                         | Mitigación                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El acuse al visitante falla en el 100% de los casos hasta que haya dominio verificado.** `onboarding@resend.dev` solo entrega a la dirección de la cuenta.                   | Asumido y decidido: es best-effort, no altera lo que ve el visitante y se arregla cambiando el valor de `CONTACT_FROM_EMAIL`. Queda un `console.error` por envío en el log del servidor hasta entonces.                                     |
| **Sin honeypot ni límite de envíos, el formulario es spameable.** Un bot puede vaciar la cuota gratuita de Resend en minutos, y con el acuse activado cada envío cuenta doble. | Decisión explícita del usuario. Mitigación disponible si aparece el problema: honeypot (cinco líneas) o límite por IP, cada uno en su propio spec. La revalidación de campos frena el ruido más torpe, no un bot que rellene el formulario. |
| El correo del visitante va en `replyTo`; un valor manipulado puede usarse para suplantar a alguien al responder.                                                               | El campo se valida en formato y los correos solo los lee el equipo, que ve el remitente real en el cuerpo del mensaje además del `replyTo`.                                                                                                 |
| Contenido del visitante inyectado como HTML en el correo.                                                                                                                      | `teamEmailHtml` escapa `&`, `<`, `>` y `"` antes de interpolar. Hay criterio de aceptación explícito con `<script>`.                                                                                                                        |
| La clave de API se filtra al bundle del cliente.                                                                                                                               | Se lee solo dentro del Server Action, ninguna variable lleva `NEXT_PUBLIC_`, y el paso 7 cierra con un `grep -rn "RESEND_API_KEY" components/` que debe salir vacío.                                                                        |
| El HTML retro se ve roto en Gmail o en Outlook, que descartan buena parte del CSS.                                                                                             | Estilos en línea, tabla de un solo bloque y sin `flex` ni `grid`. Si aun así se degrada, degrada a texto legible sobre fondo blanco, que sigue siendo utilizable.                                                                           |
| El CSS portado arrastra defectos que solo se ven al montarlo, como pasó en el SPEC 02 con cuatro reglas.                                                                       | El paso 11 compara contra `arcade-vault-standalone.html` abierto al lado. Cualquier regla nueva se acota a la página Acerca de y se registra en §6 al implementar.                                                                          |
| `npm run build` en un entorno limpio sin `.env.local`.                                                                                                                         | Es criterio de aceptación explícito y es la razón de leer las variables dentro del Server Action.                                                                                                                                           |
| Los tipos de props de ruta de Next 16 en `app/about/page.tsx`.                                                                                                                 | La ruta no tiene parámetros dinámicos y `app/games/page.tsx` es el precedente exacto. Antes de escribirla se lee la documentación en `node_modules/next/dist/docs/01-app/`, como exige `AGENTS.md`.                                         |

---

## Lo que **no** entra en este spec

- Verificar un dominio propio en Resend.
- Honeypot, captcha o límite de envíos por IP.
- Guardar los mensajes en base de datos o en cualquier otro sitio.
- Zod o cualquier librería de validación.
- Campo de asunto, adjuntos o selector de motivo.
- Enlace a `Acerca de` en el pie de página.
- Metadatos SEO, Open Graph, sitemap o robots.
- El CSS del gamepad (`.gp*`).
- El desbordamiento de la nav a 375 px.
- Framework de tests.

Cada uno de ellos, si llega, va en su propia spec.
