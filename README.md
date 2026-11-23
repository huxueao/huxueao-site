# Oblique — huxueao.com

A personal publication and playable experiment index for Hu Xueao. English interface; paper, serif typography, a ballpoint Guide mascot, and pixel-dithered artwork. Built for the existing **Cloudflare Pages project `huxueao-site`**.

## Implemented

- Home, writing, experiments, searchable index, about, individual articles, and Guide search (`Ctrl/Cmd K`).
- Owner workspace at `/admin`: articles, fragments, projects, Markdown preview, drafts, publishing, unpublishing, tags, cover uploads, browser recovery, and conflict detection.
- **Strata** at `/play/strata`: three expeditions, private strategy decks, a shared mine made from both 15-card packs, excavation, economy, crew combat, scoring, mulligan, rules, log, and browser saves.
- Cloudflare D1 publication storage. Signed Cloudflare Access JWTs protect the owner workspace. The production handler has no development login bypass.

The live domain is not changed merely by checking out this branch. No fictional articles are seeded. The Pages project, build settings, and separate production/preview D1 databases are provisioned. Owner sign-in still requires the Access application described below; the workspace stays locked until it is configured.

## Local preview

Requires Node 22.13+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4321**. Use **http://127.0.0.1:4321/dev/login** for the local owner workspace. This login only exists in `dev/server.mjs`, binds to loopback, and checks Host/Origin. Local articles are saved to `.local/oblique.sqlite`; games are saved in each browser's local storage. Neither is committed to Git.

## Existing Cloudflare Pages setup

The repository's GitHub deployment check identifies the project as **`huxueao-site`**. Keep its existing custom-domain connection.

1. Sign in with `npx wrangler login`. Inspect and back up the current Pages bindings/variables before adopting `wrangler.jsonc` as the configuration source of truth. Preserve any unrelated settings.
2. The `oblique` production database and `oblique-preview` preview database already exist, with their initial schema applied. Their IDs are in `wrangler.jsonc`. Apply future production migrations with `npm run db:remote`; apply preview migrations with `npx wrangler d1 migrations apply oblique-preview --remote --env preview`. Do not recreate these databases.
3. In Cloudflare Zero Trust, create a **self-hosted Access application** protecting `huxueao.com/admin*` and `huxueao.com/api/admin/*`. Add an Allow policy for your own email only, with email one-time PIN or your preferred identity provider. Configure every hostname that should support owner login, including `www` if used. The Worker independently verifies signature, issuer, audience, expiration, and the exact owner email; alternate unprotected hostnames remain locked.
4. Add these Pages environment variables/secrets for production and any authorized preview:

   | Name | Value |
   | --- | --- |
   | `ACCESS_TEAM_DOMAIN` | `https://YOUR-TEAM.cloudflareaccess.com` |
   | `ACCESS_AUD` | Access application's audience tag |
   | `OWNER_EMAIL` | The exact allowed email address |

   `SITE_URL`, `SITE_NAME`, and `NODE_VERSION` are in `wrangler.jsonc`; `OWNER_EMAIL` is configured as a Pages secret. Never put an API token in public JavaScript or this repository. The preview database is isolated under `env.preview.d1_databases`; enable its workspace only after protecting its hostname with Access.
5. The existing Pages build command is **`npm run build:pages`**, the output directory is **`dist`**, and Node version is **24**. The build bundles `worker/index.js` as the Pages advanced-mode `dist/_worker.js`, copies only `public/`, and routes all requests through the Worker. Development files and credentials are never deployed. Both environments fail closed if their Worker cannot execute.
6. Run `npm run deploy:preview`. Verify public pages, `/play/strata`, owner login, draft privacy, image uploads, and published articles. Then merge into `main` to use the existing Git deployment, or run `npm run deploy:production` after these checks. Missing Access configuration intentionally locks the workspace. Missing D1 is reported by the archive. The game has no server/database dependency.

Cloudflare documentation: [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## Verification

```sh
npm run check
npm test
npm run build:pages
# With the local server running, and Chrome installed:
npm run test:browser
```

`CHROME_PATH` overrides the browser executable. Browser checks cover desktop/mobile overflow, Guide navigation, actual AI turns, save/reload, login, drafting, preview, publishing, reading, unpublishing, and anonymous admin rejection. Screenshots go to `.local/screenshots`.

The engine suite plays 270 seeded matches across all nine faction matchups. It verifies card conservation and resources after each action, plus blocking, summoning sickness, shared progress, final-round scoring, fatigue, and private AI observations. These are correctness checks, not a claim that competitive balance is final.

## Game and AI

Rules and card text are available inside the game. `public/game/cards.js` defines all cards and preconstructed expeditions. `engine.js` is a pure, validated state transition engine. `ai.js` ranks legal actions using the public board and its own hand. Its input excludes both private deck orders, the player's hand, future mine cards, and the random seed. Survey only exposes its user's three-card forecast. There are no LLM or external AI API calls, and no per-move token usage.

Version 0.1 has preconstructed decks, one AI difficulty, and local matches. It does not include multiplayer, cross-device saves, public user registration, or a custom deck editor. Starting another expedition replaces the browser's current match.

## Structure

| Path | Purpose |
| --- | --- |
| `public/` | Website, editor, browser game |
| `worker/` | Authenticated API and Pages routing |
| `migrations/` | D1 schema |
| `dev/` | Loopback-only Node/SQLite preview |
| `tests/` | Rules, security, simulation checks |
| `scripts/` | Build, syntax, browser validation |

Cover artwork was generated for this site. The Guide is an assistant and card-game opponent, not a portrait of the author. The original root `index.html` and `assets/` are legacy files; the new deployment serves only the generated `dist/` output.
