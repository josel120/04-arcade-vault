# Arcade Vault

Una plataforma para jugar a recreativas online y competir por la mayor puntuación.

Doce juegos en el catálogo, cuatro de ellos jugables de verdad, un marcador respaldado por Supabase y una estética CRT hecha entera con CSS: no hay ni una imagen de portada en todo el proyecto.

## Estado

| Juego          | Estado  | Motor                                                                      |
| -------------- | ------- | -------------------------------------------------------------------------- |
| **ASTEROIDES** | Jugable | Portado de `references/started-games/02-asteroids/`                        |
| **TETRIS**     | Jugable | Portado de `references/started-games/03-tetris/`                           |
| **ARKANOID**   | Jugable | Portado de `references/started-games/04-arkanoid/` — con sonido            |
| **VÍBORA**     | Jugable | Escrito desde cero en TypeScript — sonido sintetizado con WebAudio         |
| Los otros ocho | Maqueta | Ficha, portada y marcador reales; el reproductor cae a la arena decorativa |

Toda la plataforma es pública: se puede jugar sin cuenta. Iniciar sesión sirve para que la puntuación entre en el marcador global en vez de quedarse en el navegador.

## Pantallas

| Ruta          | Qué es                                                           |
| ------------- | ---------------------------------------------------------------- |
| `/`           | Landing                                                          |
| `/games`      | Biblioteca: la rejilla de fichas del catálogo                    |
| `/juego/[id]` | Detalle de un juego, con su marcador lateral                     |
| `/jugar/[id]` | Reproductor: el lienzo, el HUD y los controles                   |
| `/salon`      | Salón de la Fama                                                 |
| `/about`      | Acerca de, con formulario de contacto que envía correo de verdad |

## Stack

- **Next.js 16.3.1** (App Router) + **React 19.2.8** + **TypeScript** en modo estricto
- **Tailwind CSS v4**, configurado solo en CSS — sin `tailwind.config.*`
- **Supabase** para autenticación, perfiles, catálogo y puntuaciones
- **Resend** para el correo del formulario de contacto
- Los motores de juego son TypeScript sobre `<canvas>`, sin ninguna librería de juegos

## Puesta en marcha

```bash
npm install
cp .env.template .env.local   # y rellena los valores
npm run dev
```

La aplicación **arranca y se sirve entera sin configurar nada**: sin credenciales de Supabase el catálogo se sirve desde una copia de respaldo en código, los marcadores salen vacíos y el acceso falla, pero se puede navegar y jugar. Las puntuaciones quedan entonces en el navegador.

`.env.template` documenta cada variable. Dos apuntes que conviene no saltarse:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son **públicas a propósito** — acaban en el bundle del navegador. Lo que protege los datos es la RLS, no esconderlas.
- `RESEND_API_KEY` nunca puede salir del servidor. Y ninguna clave de servicio (`service_role` / `sb_secret_...`) pinta nada aquí: ningún camino de código necesita saltarse la RLS.

### Base de datos

Las migraciones están en `supabase/migrations/`. Definen las tablas `profiles`, `scores` y `games` —todas con RLS— y las vistas `game_leaderboards` (la mejor marca de cada jugador, con su alias resuelto) y `game_stats`.

La autenticación es correo y contraseña. **La confirmación por correo está activa** en el proyecto, así que las cuentas nuevas hay que confirmarlas antes de poder entrar.

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción — es también la comprobación de tipos
npm start              # sirve el build de producción
npm run lint           # eslint (flat config: core-web-vitals + typescript)
npm run lint:fix       # eslint con --fix
npm run format         # prettier --write .   (format:check para comprobar)
npm run prueba:tetris  # banco de pruebas del motor de TETRIS
npx tsc --noEmit       # comprobar tipos sin construir
```

No hay framework de tests. `npm run prueba:tetris` es un banco de pruebas artesanal: monta un `canvas`, un `window` y un `requestAnimationFrame` falsos para verificar las reglas del juego y el contrato de la plataforma (que `destroy()` pare el bucle, que dos montajes seguidos no dupliquen la partida). No corre en el build ni en CI.

## Cómo está montado

```
app/                 rutas del App Router y sus Server Actions
components/          UI; components/games/ es el anfitrión del lienzo y la botonera táctil
lib/                 catálogo, marcador, sesión y clientes de Supabase
lib/games/           engine.ts (el contrato), registry.ts (el registro) y un motor por juego
supabase/migrations/ esquema y siembra del catálogo
specs/               las specs, numeradas y fechadas
references/          material de origen, de solo lectura
proxy.ts             refresco del token de sesión (en Next 16 esto ya no es middleware.ts)
```

El corazón es `lib/games/engine.ts`: el contrato entre el reproductor y un motor cualquiera. Es de la plataforma, no de ningún juego, y es lo que permite que el HUD, la pausa, los controles táctiles y el marcador funcionen sin saber a qué se está jugando. Un juego nuevo aporta cuatro cosas —una fila de catálogo, una portada CSS, un motor y una línea en `lib/games/registry.ts`— y hereda el marcador entero sin escribir una línea de más.

## Spec Driven Design

El proyecto se construye con **Spec Driven Design**: cada funcionalidad se define primero como una spec en `specs/`, se implementa en su propia rama `spec-NN-slug` y se integra por PR. Las diez specs actuales, de la maqueta inicial a VÍBORA, están en `specs/` y son el mejor sitio para entender por qué algo está hecho como está.

Sigue las buenas prácticas de [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), con las skills `/spec` y `/spec-impl`:

```bash
npx skills@latest add Klerith/fernando-skills
```

El repo lleva además dos skills propias o instaladas aparte: `/frontend-design` (de `anthropics/skills`) para el diseño de interfaz, y `/nuevo-juego`, la receta destilada de las specs 05 a 10 para añadir un juego jugable de punta a punta. `skills-lock.json` fija las versiones.
