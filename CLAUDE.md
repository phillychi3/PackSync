# PackSync — CLAUDE.md

## Project Overview

PackSync 是一個旅行管理 PWA，讓旅伴能共同管理行程、分帳、打包清單與重要物品確認。

## Tech Stack

| Layer           | Technology                                      |
| --------------- | ----------------------------------------------- |
| Framework       | SvelteKit 2 + Svelte 5 (runes mode)             |
| Language        | TypeScript                                      |
| Styling         | TailwindCSS v4 (no `<style>` tags)              |
| Database        | LibSQL (SQLite-compatible) via `@libsql/client` |
| ORM             | Drizzle ORM                                     |
| Auth            | better-auth                                     |
| PWA             | vite-plugin-pwa + Workbox                       |
| Package Manager | pnpm (workspace)                                |

## Commands

```bash
pnpm dev          # dev server with PWA enabled
pnpm build        # production build
pnpm preview      # preview production build
pnpm check        # svelte-check type check
pnpm lint         # prettier + eslint check
pnpm format       # auto-format

pnpm db:push      # push schema to DB (dev)
pnpm db:generate  # generate drizzle migration files
pnpm db:migrate   # run migrations
pnpm db:studio    # open Drizzle Studio

pnpm auth:schema  # regenerate better-auth schema file
pnpm pwa-gen      # regenerate PWA icon assets
```

## Environment Variables

Required in `.env`:

```
DATABASE_URL=        # libsql connection string (file:./local.db for local dev)
BETTER_AUTH_SECRET=  # random secret for better-auth session signing
ORIGIN=              # base URL (e.g. http://localhost:5173)
```

## Architecture

```
src/
  routes/           # SvelteKit file-based routing
  lib/
    server/
      auth.ts       # better-auth config
      db/
        index.ts    # drizzle client
        schema.ts   # app schema (re-exports auth.schema)
        auth.schema.ts  # generated better-auth tables
  app.html          # HTML shell
  app.d.ts          # global type augmentations
  hooks.server.ts   # server hooks (auth middleware)
```

## Code Conventions

- 2-space indent
- `camelCase` for variables and functions
- `PascalCase` for Svelte components
- `kebab-case` for file names
- No `<style>` tags — use TailwindCSS classes only
- No inline comments unless the WHY is non-obvious
- API endpoints in English
- Git commit messages in English

## Svelte 5 Notes

Runes mode is enforced for all non-library files (`$state`, `$derived`, `$effect`, `$props`). Do not use legacy reactive syntax (`$:`, `export let`).

## Database

Schema lives in `src/lib/server/db/schema.ts`. The auth tables are generated separately (`auth.schema.ts`) and re-exported. Use Drizzle query builder; do not write raw SQL unless necessary.

## Auth

better-auth handles session management via HTTP-only cookies. The `sveltekitCookies` plugin integrates with SvelteKit's event system. Check `src/hooks.server.ts` for the auth middleware wiring.

## PWA

The service worker caches all static assets. `/api/*` routes are excluded from the navigation fallback. Push notifications are planned for trip reminders and item confirmations.
