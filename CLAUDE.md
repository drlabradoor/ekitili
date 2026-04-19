# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

EkiTili is a Kazakh-language learning SPA (vanilla JS, ES6 modules, no bundler) with a separate Express API backend. Frontend is deployed to **Vercel**, backend to **Render**. Database is **Supabase-hosted PostgreSQL**. README, UI strings, and comments are in Russian — preserve that when editing user-visible text.

## Commands

```bash
npm start                         # node server.js — serves SPA + API on :3000 (local dev)
npm run build                     # generates config.js with BACKEND_URL (Vercel build step)
npm install                       # first-time install (express, cors, pg, dotenv, helmet, etc.)

node scripts/apply_supabase.js    # applies database/supabase_setup.sql to Supabase (idempotent)
```

There is **no test runner, no linter**. The only build step is `scripts/build-config.js` which generates `config.js` with the `BACKEND_URL` env var. Static JS is served as-is; changes are live on reload.

Database credentials live in `.env` (gitignored). Template is [.env.example](.env.example). The server reads `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` via `dotenv`. **Never commit `.env` or hardcode credentials.**

## Architecture

### Runtime topology
- **Local dev:** `server.js` creates an HTTP server, attaches socket.io via `battle-server.js`, and imports `app.js` (Express). Serves SPA + API on `:3000`.
- **Production:** Frontend (static files) on **Vercel**. Backend (`app.js` + `battle-server.js`) on **Render** as a long-lived Node process. Static serving and SPA catch-all are disabled in production (`IS_PROD` guard).
- **Config injection:** `config.js` is generated at build time by `scripts/build-config.js` from the `BACKEND_URL` env var. Loaded as `window.__EKITILI_CONFIG__` before ES6 modules. Read by `src/config/env.js`. If missing in production, the SPA shows a config error page (fail-fast, not silent fallback).
- The SPA **must be loaded over `http://`**. [src/main.js](src/main.js) hard-aborts with an alert if `location.protocol === 'file:'`.
- **Database connection is a `pg.Pool` (max: 5) against Supabase's Session pooler.** On free tier, direct IPv4 to `db.<ref>.supabase.co` is disabled — we must use `aws-<n>-<region>.pooler.supabase.com:5432` with user `postgres.<projectref>`. SSL is always required (`ssl: { rejectUnauthorized: false }`). Pool max is 5 to leave room for Supabase Dashboard/Studio (~15 total on free tier).
- **`dbReady` flag** gates every `/api/*` handler (except `/api/health`). If the pool can't reach Supabase on startup, handlers return `503 Database unavailable` — the server still boots so you can debug.

### Frontend module pattern
Every feature in [src/modules/](src/modules/) is a **logic + renderer pair** (e.g. `flashcards.js` + `flashcardRenderer.js`, `lessons.js` + `lessonRenderer.js`). Logic files own state and event wiring; renderer files own DOM creation and updates. Keep new features in that shape — don't merge the two.

Layering (strict, top-down):
- `src/data/*` — in-memory seed data + `initialize*` functions. Mutated by services, never by renderers.
- `src/services/apiClient.js` — **centralized API client**. All fetch calls to the backend go through `apiGet()`, `apiPost()`, `apiGetPublic()`. Handles 401 (session expired) and 503 (backend down) globally via custom DOM events.
- `src/services/*` — `storage.js` (localStorage wrapper), `srs.js` (spaced repetition algorithm), `stats.js`, `auth.js` (auth logic, imports from apiClient), `achievements.js`, `streak.js`.
- `src/modules/*/` — feature logic and rendering; the only layer that touches the DOM.
- `src/utils/*` — `dom.js`, `date.js`, `charts.js` (hand-rolled canvas charts, no chart library).
- `src/navigation/router.js` — tab switching (not URL-based routing).

Entry point is [src/main.js](src/main.js) `initializeApp()`. Module init order matters: `initAuth` → data init → renderers → `initRouter` last. On startup, main.js checks API health with retry (3s, 6s, 12s) and shows an offline banner if the backend is down.

### Auth + achievements data flow
- Passwords are hashed with **bcrypt** in `app.js` (`hashPassword()`). Legacy SHA-256 accounts are auto-migrated on login. Don't remove either path without migrating all accounts.
- Auth is plain SQL (no stored procedures): `INSERT ... RETURNING user_id` for register, `SELECT ... WHERE username = $1` + bcrypt verify for login. Duplicate usernames surface as Postgres error code `23505` and are translated to a 400.
- Sessions use a **signed cookie** (`ekitili_session`): `userId.hmac(sha256, SESSION_SECRET)`. Cross-origin (Vercel→Render) requires `SameSite=None; Secure` in production.
- Achievements are **dual-written**: unlocked locally (localStorage via `src/services/achievements.js`) and mirrored to Supabase via `POST /api/user/achievements`. The `user_accounts.achievements` column is a `jsonb` blob. The atomic grant endpoint (`/api/user/achievement/grant`) uses `SELECT ... FOR UPDATE` inside a transaction to avoid lost updates. The normalized `user_achievements` table exists in the schema but **is not used by the server yet**.
- Leaderboards have a **static mock** in `src/data/leaderboard.js` that mirrors the shape of `GET /api/leaderboard/{week,month}` — used as fallback when the API is unavailable. Keep the shapes aligned.

### Database layer
- Single schema file: [database/supabase_setup.sql](database/supabase_setup.sql). It's idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING` for seeds) — safe to re-run.
- Tables (all `public` schema, lowercase): `user_accounts`, `test_results`, `achievements_def`, `user_achievements`.
- Apply via `node scripts/apply_supabase.js`. It connects through the same `.env` credentials as the server and verifies the four tables exist on completion.
- All `/api/*` SQL is **inline in `app.js`** — no stored procedures, no PL/pgSQL functions. If you need a new query, add it inline and use `$1, $2, ...` parameterization (node-postgres style).

### API surface (all in [app.js](app.js))
```
POST /api/register                      POST /api/user/achievements
POST /api/login                         POST /api/user/achievement/grant
POST /api/logout                        GET  /api/user/achievements
POST /api/test-result                   GET  /api/user/streak
GET  /api/me                            POST /api/user/streak
GET  /api/leaderboard/week              GET  /api/health
GET  /api/leaderboard/month
GET  /api/leaderboard/me
```

### Observability
- **Request logging:** every response logs `[METHOD] /path STATUS Xms uid=Y` to stdout.
- **Helmet:** security headers enabled (CSP disabled for inline scripts compatibility).
- **CORS:** allowed origins from `ALLOWED_ORIGINS` env var + Vercel preview regex (`/^https:\/\/ekitili[a-z0-9-]*\.vercel\.app$/`). Blocked origins are logged with `[CORS] blocked:`.

## Knowledge graph (graphify)

This repo has a pre-built graphify knowledge graph at [graphify-out/graph.json](graphify-out/graph.json) — 263 nodes across 48 communities. **Prefer querying it before grep/read for architecture questions** to save tokens:

```bash
py -m graphify query "how does achievements flow from client to the database"
py -m graphify path "initializeApp" "user_accounts table"
py -m graphify explain "renderStats"
```

## Gotchas

- `main.js.old` exists alongside `src/main.js` — ignore it, it's a pre-modularization snapshot.
- `config.js` is generated by build step and gitignored. `config.example.js` is the committed template.
- The SPA uses `localStorage` as the source of truth for progress/streaks/flashcards — server sync is opt-in per-feature, not global. Clearing browser storage wipes user progress even when logged in.
- `src/modules/games/memory.js` is newer than the rest and was added without a renderer split — treat its inline-rendering as the exception, not the pattern to copy.
- **Supabase free tier has no IPv4 direct connection.** If you see `ENOTFOUND db.<ref>.supabase.co`, you're using the wrong host — switch `PGHOST` to the Session pooler (`aws-<n>-<region>.pooler.supabase.com`) and use `postgres.<projectref>` as `PGUSER`.
- **Session pooler vs Transaction pooler:** we use Session (port 5432) because the Node server holds long-lived connections. Transaction pooler (port 6543) recycles per-query and would break `pg.Pool` + `BEGIN/COMMIT` flows.
- **Render free tier** spins down after 15 min inactivity. Cold start = 30-60 seconds. Use a health-check ping (e.g. UptimeRobot) on `/api/health` to keep it warm, or upgrade to Render Starter ($7/mo).

## Environment variables

### Render (backend)
```
SESSION_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
PGHOST=aws-0-eu-central-1.pooler.supabase.com
PGPORT=5432
PGUSER=postgres.<project_ref>
PGPASSWORD=<password>
PGDATABASE=postgres
ALLOWED_ORIGINS=https://ekitili.vercel.app,https://ekitili.kz,https://test.ekitili.kz
NODE_ENV=production
```

### Vercel (frontend)
```
BACKEND_URL=https://ekitili-api.onrender.com
```
