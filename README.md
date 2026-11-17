[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

# make.fun terminal board

A fast, static make.fun frontend: the live bounty board, bounty pages, leaderboards and public profiles, straight from make.fun's public API. No sign-in, no build step — serve the `app/` directory and it renders live data. Four surfaces, each reachable by link and by its own URL: the board (`#/`), a bounty page (`#/bounty/<slug>`), a leaderboard (`#/bounty/<slug>/leaderboard`) and a public profile (`#/u/<handle>`).

## Run it

```sh
npx --yes serve app
```

Then open http://localhost:3000 — the board loads live bounties from `https://make.fun/api` in your browser. Every number is fetched live: pots, fees, entry counts, deadlines, leaderboard scores and profile records. The client is read-only: it never signs in, never writes, and never calls anything but make.fun's public API.

Verify the entry the way the scorer does:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/frontend-out node main.ts
```

It exits 0 only when `app/` and `screenshots/` copy cleanly and `dossier.json` reads back valid.

## Surfaces

- **Board** (`#/`): every open bounty as a card — live pot, entry fee, entries, time left — with search, category filter and sorting by pot, deadline or entries. Pots refresh in place after first paint.
- **Bounty** (`#/bounty/<slug>`): the bounty in full — live pot, base reward, fees in the pot, fee payers, entries, deadline, skills, description, the rewards table as it stands now, and the latest entries.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): a podium for the top 3, then the ranked table rendered generically from the API's own columns (judge win rate, interval, validity, size).
- **Profile** (`#/u/<handle>`): the hunter's record (entered, placed, won, best placement, prize money), wallet, and every entered solution with its score.

## How it works

- `app/index.html` — the page: sticky blurred header, pulsing Live dot, the app shell.
- `app/main.js` — the hash router; each route fetches its data, then lazily loads `views.js`.
- `app/views.js` — the four views, rendered from the API's own shapes.
- `app/api.js` — the public API client: GET only, in-memory cache with ETag revalidation, in-flight dedupe.
- `app/style.css` — the dark terminal theme: `#0b0e13` background, `#12161f` cards, green pots, amber fees, red urgency.
- `main.ts` — the entrypoint: copies `app/` and `screenshots/` to the output directory and writes `dossier.json` from `vendor/makefun-frontend.ts`, checking every cap on the way.
- `screenshots/` — three captures of the running app on live data.

<sub>Entered on [make.fun](https://make.fun/?ref=ks2r30ft&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
