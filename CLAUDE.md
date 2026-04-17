# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

EkiTili is a Kazakh-language learning SPA (vanilla JS, ES6 modules, no bundler) served by an Express backend that proxies a **Supabase-hosted PostgreSQL** database for auth, achievements, and leaderboards. README, UI strings, and comments are in Russian — preserve that when editing user-visible text.

## Commands

```bash
npm start                         # node server.js — serves SPA + API on :3000
npm install                       # first-time install (express, cors, pg, dotenv)
./start-server.sh                 # same as npm start, with deps bootstrap (Linux/Mac)
start-server.bat                  # same, Windows

node scripts/apply_supabase.js    # applies database/supabase_setup.sql to Supabase (idempotent)
```

There is **no test runner, no linter, no build step**. Static JS is served as-is; changes are live on reload.

Database credentials live in `.env` (gitignored). Template is [.env.example](.env.example). The server reads `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` via `dotenv`. **Never commit `.env` or hardcode credentials in `server.js`.**

## Architecture

### Runtime topology
- **Single Node/Express process on :3000** serves both static files (`express.static(__dirname)`) and `/api/*` JSON endpoints. There is no separate frontend server in practice, despite what the README says about port 8000 — `server.js` serves everything.
- The SPA **must be loaded over `http://`**. [src/main.js](src/main.js) hard-aborts with an alert if `location.protocol === 'file:'` because ES6 module imports fail under CORS.
- **Database connection is a `pg.Pool` against Supabase's Session pooler.** On free tier, direct IPv4 to `db.<ref>.supabase.co` is disabled — we must use `aws-<n>-<region>.pooler.supabase.com:5432` with user `postgres.<projectref>`. SSL is always required (`ssl: { rejectUnauthorized: false }`). See [server.js](server.js) `pool` initialization.
- **`dbReady` flag** gates every `/api/*` handler (except `/api/health`). If the pool can't reach Supabase on startup, handlers return `503 Database unavailable` — the server still boots so you can debug. When auth/leaderboard "breaks," check this flag first; the symptom is 503s, not crashes.

### Frontend module pattern
Every feature in [src/modules/](src/modules/) is a **logic + renderer pair** (e.g. `flashcards.js` + `flashcardRenderer.js`, `lessons.js` + `lessonRenderer.js`). Logic files own state and event wiring; renderer files own DOM creation and updates. Keep new features in that shape — don't merge the two.

Layering (strict, top-down):
- `src/data/*` — in-memory seed data + `initialize*` functions. Mutated by services, never by renderers.
- `src/services/*` — `storage.js` (localStorage wrapper), `srs.js` (spaced repetition algorithm), `stats.js`, `auth.js` (API client + session), `achievements.js`.
- `src/modules/*/` — feature logic and rendering; the only layer that touches the DOM.
- `src/utils/*` — `dom.js`, `date.js`, `charts.js` (hand-rolled canvas charts, no chart library).
- `src/navigation/router.js` — tab switching (not URL-based routing).

Entry point is [src/main.js](src/main.js) `initializeApp()`. Module init order matters: `initAuth` → data init → renderers → `initRouter` last.

### Auth + achievements data flow
- Passwords are **hashed twice**: client-side in `src/services/auth.js` before POST, then SHA-256 again in `server.js` `hashPassword()`. The hash stored in `user_accounts.password_hash` is `sha256(clientHash)`. Don't "fix" this by removing one side without changing both — it would invalidate every existing account.
- Auth is plain SQL (no stored procedures): `INSERT ... RETURNING user_id` for register, `SELECT ... WHERE username = $1 AND password_hash = $2` for login. Duplicate usernames surface as Postgres error code `23505` and are translated to a 400.
- Achievements are **dual-written**: unlocked locally (localStorage via `src/services/achievements.js`) and mirrored to Supabase via `POST /api/user/achievements`. The `user_accounts.achievements` column is a `jsonb` blob. The atomic grant endpoint (`/api/user/achievement/grant`) uses `SELECT ... FOR UPDATE` inside a transaction to avoid lost updates. The normalized `user_achievements` table exists in the schema but **is not used by the server yet** — treat it as a reserved slot for a future migration.
- Leaderboards have a **static mock** in `src/data/leaderboard.js` that mirrors the shape of `GET /api/leaderboard/{week,month}` — used as fallback when the API is unavailable. Keep the shapes aligned.

### Database layer
- Single schema file: [database/supabase_setup.sql](database/supabase_setup.sql). It's idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING` for seeds) — safe to re-run.
- Tables (all `public` schema, lowercase): `user_accounts`, `test_results`, `achievements_def`, `user_achievements`.
- Apply via `node scripts/apply_supabase.js`. It connects through the same `.env` credentials as the server and verifies the four tables exist on completion.
- All `/api/*` SQL is **inline in `server.js`** — no stored procedures, no PL/pgSQL functions. If you need a new query, add it inline and use `$1, $2, ...` parameterization (node-postgres style).

### API surface (all in [server.js](server.js))
```
POST /api/register                      POST /api/user/achievements
POST /api/login                         POST /api/user/achievement/grant
POST /api/test-result                   GET  /api/user/:userId/achievements
GET  /api/leaderboard/week              GET  /api/health
GET  /api/leaderboard/month             GET  *  → serves index.html (SPA catch-all)
GET  /api/leaderboard/user/:user_id
```

## Knowledge graph (graphify)

This repo has a pre-built graphify knowledge graph at [graphify-out/graph.json](graphify-out/graph.json) — 263 nodes across 48 communities. **Prefer querying it before grep/read for architecture questions** to save tokens:

```bash
py -m graphify query "how does achievements flow from client to the database"
py -m graphify path "initializeApp" "user_accounts table"
py -m graphify explain "renderStats"
```

## Gotchas

- `main.js.old` exists alongside `src/main.js` — ignore it, it's a pre-modularization snapshot.
- `config.example.js` is the committed template; the live `config.js` (if present) is gitignored.
- The SPA uses `localStorage` as the source of truth for progress/streaks/flashcards — server sync is opt-in per-feature, not global. Clearing browser storage wipes user progress even when logged in.
- `src/modules/games/memory.js` is newer than the rest and was added without a renderer split — treat its inline-rendering as the exception, not the pattern to copy.
- **Supabase free tier has no IPv4 direct connection.** If you see `ENOTFOUND db.<ref>.supabase.co`, you're using the wrong host — switch `PGHOST` to the Session pooler (`aws-<n>-<region>.pooler.supabase.com`) and use `postgres.<projectref>` as `PGUSER`.
- **Session pooler vs Transaction pooler:** we use Session (port 5432) because the Node server holds long-lived connections. Transaction pooler (port 6543) recycles per-query and would break `pg.Pool` + `BEGIN/COMMIT` flows.
