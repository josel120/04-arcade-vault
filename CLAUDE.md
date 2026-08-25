# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**Arcade Vault** — a platform to play arcade games online and compete for the high score (see `README.md`). Twelve games are in the catalog; four have a real engine (`asteroides`, `tetris`, `arkanoid`, `vibora`) and the other eight are still visual mock-ups that fall back to the decorative arena.

The project follows **Spec Driven Design**. Every feature so far landed as a numbered spec in `specs/` (01 → 10, all `Estado: Implementado`), implemented on its own `spec-NN-slug` branch and merged by PR. Specs, code comments and UI copy are written **in Spanish** — match that language when adding to them. Only the top-level agent docs (`CLAUDE.md`, `AGENTS.md`) are in English.

`specs/.spec-config.yml` sets `AutoCreateBranch: true`, so `/spec-impl` creates and switches to the branch without asking.

### Commands

```bash
npm run dev            # dev server (also rewrites the AGENTS.md rules block)
npm run build          # production build — this is the type check
npm run lint           # eslint flat config; lint:fix to autofix
npm run format         # prettier --write .  (format:check to verify)
npm run prueba:tetris  # ad-hoc Tetris engine harness (see below)
npx tsc --noEmit       # type check without building
```

There is no test framework. `scripts/prueba-tetris.mjs` is a hand-rolled harness that fakes `canvas`/`window`/`requestAnimationFrame` to check the Tetris engine's rules and its `destroy()`/remount contract; it runs via `node --experimental-strip-types` with `scripts/alias-loader.mjs` resolving `@/*`. It is not wired into build, lint or CI. If real tests are needed, ask which runner to add before wiring one up.

## Stack and conventions

- **Next.js 16.3.1 (App Router) + React 19.2.8 + TypeScript strict**. This Next version predates most training data — per `AGENTS.md`, read the relevant page under `node_modules/next/dist/docs/` (`01-app/` for App Router, `03-api-reference/` for APIs) before writing framework code.
- Next 16 injects **global route-typed props**: `app/layout.tsx` uses `LayoutProps<"/">` with no import. Use these generated types (`LayoutProps`, `PageProps`, …) instead of hand-written prop interfaces; they come from `.next/types` and require a dev/build run to exist.
- **Middleware is `proxy.ts` at the repo root**, not `middleware.ts` — that convention is deprecated in Next 16. All Supabase SSR docs still say `middleware.ts`; translate as you read. `proxy.ts` only refreshes the auth token; no route is gated, the whole platform is playable without an account.
- **Tailwind CSS v4**, configured entirely in CSS — no `tailwind.config.*`. Theme tokens live in the `@theme inline` block of `app/globals.css`; PostCSS wires it up via `@tailwindcss/postcss`. That file is ~3.4k lines and holds the whole CRT/arcade look, including every `.cover-*` class (each game's cover art is pure CSS, no images).
- **Prettier + ESLint run automatically**: a `PostToolUse` hook (`.claude/hooks/format-file.mjs`, registered in `.claude/settings.json`) formats and `eslint --fix`es every file Write/Edit touches, and feeds back unfixable errors. Don't hand-format; do read the hook's output. Prettier config: `printWidth: 100`, `trailingComma: "all"`.
- `references/` and installed skills are excluded from lint and format — never reformat them.
- Import alias `@/*` maps to the repo root.
- `next dev` rewrites the `nextjs-agent-rules` block in `AGENTS.md`. If it shows up dirty in `git status`, commit it with your work rather than reverting it.

## Architecture

### Routes (`app/`)

`/` landing · `/games` library · `/juego/[id]` game detail · `/jugar/[id]` player · `/salon` hall of fame · `/about` about + contact form · `not-found`. Server Actions live next to their route: `app/about/actions.ts` (Resend email) and `app/jugar/[id]/actions.ts` (score saving — validates against the catalog, resolves `user_id` server-side, inserts, computes rank/record, revalidates).

### Data layer (`lib/`)

Server-only readers: `catalog.ts` (reads `public.games`, falls back to `FALLBACK_GAMES` with zeroed stats when Supabase is unconfigured), `leaderboard.ts` (reads the `game_leaderboards` / `game_stats` views — never groups in TypeScript, never throws, degrades to an empty board). Shared types in `games.ts` and `scores.ts`. Client-side: `session.ts` (guest sessions under `av_guest`, legacy `av_user` migration), `preferences.ts` (`av_muted`), `supabase/{client,server,env,proxy}.ts`, `database.types.ts` (generated).

There is no `server-only` package: the barrier is that these modules import `lib/supabase/server.ts` → `next/headers`, which Next refuses to compile into a client component.

### Game engine contract (`lib/games/`)

`engine.ts` is the platform-side contract, owned by no game: `GameEngine` (`pause`/`resume`/`restart`/`finish`/`setAction`/`setMuted`/`destroy`), `GameSnapshot`, `GameAction`, `GAME_KEYS`, `isTextTarget`. `registry.ts` maps a catalog `id` to a `GameEngineEntry`: internal resolution, declared `keys` legend, `touch` button groups, an `audio` flag, and a dynamic `load: () => import(...)` so engines stay out of the library bundle. An id absent from `GAME_ENGINES` renders the decorative arena from SPEC 01.

Note the deliberate duplication documented in `registry.ts`: the on-screen key glyphs live in the registry, the real `KeyboardEvent.code` map lives in each engine. Change a key and you change both.

`components/games/game-canvas.tsx` hosts the canvas (mounts the engine, scales by `devicePixelRatio` capped at 2, handles `P`/`Escape` and pause-on-hidden, unmounts clean). `components/game-player.tsx` runs in two modes — real engine + HUD, or the mock arena.

### Supabase

Tables `profiles`, `scores`, `games`, all with RLS; views `game_leaderboards` (best mark per player, alias resolved) and `game_stats`. Migrations are in `supabase/migrations/`; a new game ships one migration adding its catalog row. An MCP server is configured in `.mcp.json` for the project.

Auth is Supabase email + password. **Email confirmation is still enabled on the project**, which blocks creating throwaway test accounts.

Secrets: copy `.env.template` → `.env.local`. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public by design (RLS is what protects the data); `RESEND_API_KEY` must never reach the client, and no service-role key belongs in this app.

## Skills

- **`/frontend-design`** — always use it when designing or reshaping UI.
- **`/nuevo-juego`** (project skill, `.claude/skills/nuevo-juego/`) — the end-to-end recipe for making a game playable: catalog row + migration, CSS cover, TypeScript engine, registry entry, controls. The leaderboard is generic and needs no new code. Ships `motor-plantilla.ts`, a contract-shaped engine skeleton for games written from scratch. If the new game has real scope decisions, send the user to `/spec` first.
- **`/spec` and `/spec-impl`** from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) are installed (see `skills-lock.json`); `frontend-design` comes from `anthropics/skills`. Installed skills are duplicated into `.agents/skills/` and `.claude/skills/` by the installer — don't edit them, re-run `npx skills@latest add …` instead.
- `/spec-impl` is launched by the user, never by me; when running it, chain all the steps and review at the end.

## Agents

Project subagents live in `.claude/agents/`.

- **`game-planner`** — decides _which_ game should be next in the catalog, the step before `/spec` and `/nuevo-juego`. It reads the catalog, the engine contract and the `nuevo-juego` phases to price each candidate, researches the classic on the web, and returns 2-3 candidates with one recommendation. It has no `Bash` and no MCP: it plans, it never implements, and the only file it writes is its own ledger.
- Its memory across cold starts is `references/game-suggestions-todo.md` — a to-do of every game it has suggested, with a state (`siguiente` / `pendiente` / `implementado` / `descartado`) and why. It reads that file first thing and updates it last thing; without it the agent would re-suggest the same game forever.
- **`game-jam`** — given a theme, designs one brand-new game end to end and writes its full spec, unsupervised: no candidates, no questions, one game per run. It writes `specs/game-jam/<game-id>/spec-diseno.md` (why, scope, decisions, risks) and `spec-implementacion.md` (data model, implementation steps, acceptance criteria), styled after `specs/08-juego-tetris.md`, `specs/09-juego-arkanoid.md` and `specs/10-juego-vibora.md`. It reads `references/game-suggestions-todo.md` to avoid duplicating a game `game-planner` already tracked, but never writes to it — that ledger stays `game-planner`'s alone. Like `game-planner`, it never implements anything and never touches `/spec-impl`.
- **`skin-designer`** — the one agent here that implements directly instead of only planning. Builds and audits a three-skin system (`clasico` default = today's look untouched, `retro`, `neon`), selectable and persisted per game. Chrome (CRT bezel, HUD, buttons) is CSS custom-property overrides scoped by a `data-skin` attribute on `.av-player` in `components/game-player.tsx`, which covers all twelve games since mock arenas render there too. The four real engines (`asteroides`, `tetris`, `arkanoid`, `vibora`) additionally get an in-canvas palette: an extension to the engine contract (`GameSkin`, `GameEngine.setSkin` in `lib/games/engine.ts`, mirroring `setMuted`) plus a `skins.ts` sibling file per engine, precedented by `lib/games/tetris/pieces.ts`. Persistence is `lib/skins.ts` (new, sibling of `lib/preferences.ts`). It has `Edit`/`Write`/`Bash` for exactly this reason; it never touches the catalog row, Supabase, or `specs/`.
- **`mobile-porter`** — audits and fixes the responsive/touch experience. There is no native app in this repo — "web" and "mobile app" are the same Next.js site, so this is `app/globals.css` breakpoint work, not a packaging effort. Implements directly like `skin-designer`, but unlike it actually drives a browser: launches the site with the `run` skill and inspects it across viewport widths with Playwright MCP tools before and after each fix. Preserves the `(pointer: coarse)` touch-detection convention already used for `TouchPad` (never swaps it for a `max-width` check), and never touches the engine contract or a game's logical canvas resolution — screen fit is a CSS scaling problem, not a motor problem.

## Reference material

`references/` is read-only source material, excluded from lint/format: `templates/` and `home-about/` are the original React UMD mock-ups the UI was ported from, and `started-games/` holds the vanilla-JS originals (`02-asteroids`, `03-tetris`, `04-arkanoid`) that the first three engines were ported from. `vibora` had no original — it was written from scratch.

The one exception to "read-only" is `references/game-suggestions-todo.md`, which is not source material at all: it is the live ledger the `game-planner` agent keeps. That agent is expected to write to it — don't "fix" it for doing so.
