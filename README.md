# Janus — huxueao.com

Hu Xueao's personal website: writing, projects, and the playable Strata card game. A paper background, readable serif headings, a pixelated Janus silver coin, and a floating hand-drawn face. Built for the existing Cloudflare Pages project **`huxueao-site`**.

## Features

- Home, Writing, Projects, and individual posts. Old `/experiments`, `/index`, and `/about` links redirect to their replacements.
- English/Chinese interface toggle, remembered in this browser. Article text stays in the language its author wrote it.
- A draggable floating face, with hover and drag expressions. Arrow keys also move it. It has no chat or search function.
- Owner editor at `/admin`: Markdown, preview, drafts, publishing, tags, cover uploads, local recovery, and conflict detection. Switching interface language preserves unsaved edits.
- **Strata** at `/play/strata`: three preset decks, private hands and decks, a shared 30-card mine, digging, crew combat, scoring, mulligan, and local saves.
- An interactive practice match teaches digging, playing crew, turn order, and combat without replacing a saved match. Card categories have names and colors; original pixel sprites and short particles accompany actions. Reduced-motion preferences are respected.
- Cloudflare D1 stores publication content. Signed Cloudflare Access JWTs protect the editor and its API. Production has no development login bypass.

## Local preview

Requires Node 22.13+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4321**. The local owner login is **http://127.0.0.1:4321/dev/login**. It exists only in `dev/server.mjs`, binds to loopback, and checks Host and Origin. Local content is in `.local/oblique.sqlite`; its original name is retained to preserve content. `PORT` selects another local port.

## Existing Cloudflare deployment

The existing Pages project is `huxueao-site`, connected to GitHub and **huxueao.com**. A push to `main` triggers production deployment. Other branches create previews.

- Build command: `npm run build:pages`; output: `dist`; Node: 24.
- The build bundles `worker/index.js` as `dist/_worker.js`, copies only `public/`, and routes requests through the Worker. Development credentials are never deployed.
- Production D1 is `oblique`; preview D1 is `oblique-preview`. Both databases and the initial schema already exist. Keep their names and bindings in `wrangler.jsonc`; do not recreate them. Future migrations: `npm run db:remote`, or `npx wrangler d1 migrations apply oblique-preview --remote --env preview` for preview.
- Owner login uses Cloudflare Access at `https://huxueao.cloudflareaccess.com`. Its self-hosted application protects `huxueao.com/admin*` and `huxueao.com/api/admin/*` with an Allow policy for the owner's email. The Worker independently verifies signature, issuer, audience, expiration, and owner email. Unprotected alternate hostnames cannot bypass this verification.

The following values must be stored as **Pages secrets (`secret_text`)**, not plaintext dashboard variables. Wrangler is the configuration source of truth and can remove plaintext variables absent from its configuration during deployment.

| Secret | Value |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | Full HTTPS URL, such as `https://huxueao.cloudflareaccess.com` |
| `ACCESS_AUD` | The Access application's audience tag |
| `OWNER_EMAIL` | The exact permitted email address |

Production owner login is configured. Preview has a separate database and remains locked unless its own Access hostname and all required secrets are configured. Never expose API tokens or secrets in public JavaScript. `SITE_URL`, `SITE_NAME`, and `NODE_VERSION` remain in `wrangler.jsonc`.

Run `npm run deploy:preview` for a manual preview, or merge a verified branch into `main` for the existing Git deployment. `npm run deploy:production` is also available for explicitly authorized manual releases. Verify public pages, game, content API, and the owner login redirect after publishing. Both environments fail closed if their Worker cannot execute.

## Verification

```sh
npm run check
npm test
npm run build:pages
# With the local server running and Chrome installed:
npm run test:browser
```

`TEST_BASE` overrides the local URL; `CHROME_PATH` overrides the Chrome executable. Browser checks cover English/Chinese persistence, hover and drag, the complete tutorial on desktop and mobile, tutorial save isolation, real AI turns, reload, rules, reduced motion, and drafting/publishing/unpublishing. Browser tests create draft posts with the prefix `janus-browser-check-` in the local database. Screenshots go to `.local/screenshots`.

The engine suite plays 270 seeded matches across all nine deck matchups, checks card conservation and resources after every action, and covers blocking, new crew, shared progress, final-round scoring, fatigue, and hidden information. Additional checks cover the tutorial's legal action sequence and translated game logs. These verify correctness, not final competitive balance.

## Game and AI

### Candle Flight

/play/candle-flight is a pixel arcade game with four annual courses: NVIDIA, Tesla, Apple, and Bitcoin. Each new course covers the past year ending today in Singapore time. A GitHub Actions job retrieves the latest completed daily candles from Yahoo Finance (equities) and Coinbase Exchange (BTC-USD) after daily closes (00:17, 20:17, and 21:17 UTC, covering US daylight saving changes). It validates every course before committing the refreshed snapshot; the existing Pages Git integration deploys it. The public /api/flight/market?symbol=NVDA endpoint reads that snapshot, rebases the annual range to today in Singapore, allows only four assets, and caches each asset/date for five minutes. Visitors never query the finance providers. Stock sessions must be closed; Bitcoin UTC days must be complete. Holidays and weekends are not filled with invented candles.

The candle body (open to close) is the passable window. Its midpoint follows the historical price, scaled to the playfield; window heights are widened to 142–194 game units so even dojis remain playable. Wicks are visual markers. The original dates and OHLC values remain in the data and readout. Tap, click, Space, or Up to flap; P or Escape pauses. Losing focus pauses automatically. Language changes preserve the run.

Each flight freezes its full dataset. The latest unfinished run is saved in this browser on progress, pause, and exit; continuing it restores the same course even if the feed has since changed. Best scores are separate for each asset and annual date range. No account or cross-device saves are required. Finishing a year takes roughly 7–11 minutes.

Failed sync jobs leave the last valid snapshot in place. Updates older than 26 hours are explicitly labelled as delayed, with their actual dates and an update button. Provider URLs and sync time are preserved in public/flight/market-data.json. Refresh manually with npm run data:flight or the Update flight data workflow. Scheduled jobs can run late, and public-repository schedules can be disabled after prolonged inactivity; the visible sync date remains the source of truth. The game is a historical replay, not a live quote feed.

The game uses original generated pixel caricatures and Silkscreen, distributed under the SIL Open Font License in public/assets/fonts/OFL.txt. Gameplay runs locally, with no model API calls or per-move token usage. Loading a course reads the synced data; flapping makes no network requests. The test controller verifies all four annual courses are finishable; automatic play is not included in the game.

Run npm run test:flight-browser against the local server (TEST_BASE overrides its URL) for full-year victory via real inputs, crash/retry, saving and continuing after reload, dates, fallback notices, language switching, mobile touch, and navigation. Browser tests use a pinned market snapshot for repeatability. Deployment checks separately exercise the actual deployed API; the sync workflow exercises the external providers. Unit tests cover complete annual geometry, physics, save validation, date boundaries, completed-session filtering, and cache/fallback behavior.

### Strata

`public/game/cards.js` defines card mechanics and preset decks. `catalog.js` supplies simple English/Chinese names and descriptions. `engine.js` validates state transitions. `ai.js` chooses legal moves using the public board and its own hand; it cannot see the player's hand, private deck orders, future mine cards, or seed. Survey reveals only its user's forecast.

The AI runs in the browser. **No LLM API calls or per-move token usage.** This version has one AI difficulty and local matches, with no multiplayer, cross-device saves, public user registration, or custom deck editor. New games replace the browser's saved match; tutorials never do. Existing `oblique-strata-v1` saves are read and migrated to `janus-strata-v1` on the next successful save.

## Source layout

| Path | Purpose |
| --- | --- |
| `public/` | Website, owner editor, browser game |
| `worker/` | Authenticated API and Pages routing |
| `migrations/` | D1 schema |
| `dev/` | Loopback-only Node/SQLite server |
| `tests/` | Game, translation, and security checks |
| `scripts/` | Build and browser validation |

The coin and project cover were generated for this site; the pixel game sprites are original. The original root `index.html` and `assets/` are legacy files. Only the generated `dist/` directory is deployed.
