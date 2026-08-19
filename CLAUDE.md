# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**Arcade Vault** — a platform to play games online and compete for the highest score (see `README.md`). The repo is currently at the `create-next-app` scaffold stage: `app/page.tsx` is still the generated template, and no game/leaderboard code exists yet.

The README states the project follows **Spec Driven Design**, driven by the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (installed with `npx skills@latest add Klerith/fernando-skills`). Those skills are not installed in this checkout — if they are unavailable, say so rather than improvising a substitute spec workflow.

## Commands

```bash
npm run dev     # dev server (also regenerates the AGENTS.md rules block)
npm run build   # production build
npm start       # serve the production build
npm run lint    # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

Type checking has no dedicated script — `npm run build` type-checks, or run `npx tsc --noEmit`.

There is no test framework configured. If tests are needed, ask which runner to add before wiring one up.

## Stack and conventions

- **Next.js 16.3.1 (App Router) + React 19.2.8 + TypeScript strict**. This Next version predates most training data — per `AGENTS.md`, read the relevant page under `node_modules/next/dist/docs/` (`01-app/` for App Router, `03-api-reference/` for APIs) before writing framework code.
- Next 16 injects **global route-typed props**: `app/layout.tsx` uses `LayoutProps<"/">` with no import. Use these generated types (`LayoutProps`, `PageProps`, …) instead of hand-written prop interfaces; they come from `.next/types` and require a dev/build run to exist.
- **Tailwind CSS v4**, configured entirely in CSS — no `tailwind.config.*`. Theme tokens live in the `@theme inline` block of `app/globals.css`; PostCSS wires it up via `@tailwindcss/postcss`.
- Import alias `@/*` maps to the repo root.
- `next dev` rewrites the `nextjs-agent-rules` block in `AGENTS.md`. If it shows up dirty in `git status`, commit it with your work rather than reverting it.
