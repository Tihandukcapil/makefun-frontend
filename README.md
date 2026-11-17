# makefun-frontend
[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A dark, fast frontend for make.fun, built from static files on make.fun's public API — no sign-in, no tracking, no external scripts, fonts or stylesheets.

What you get:

- **Live board** (`#/`): total live pot, open bounties and closing-soon counts up top, then bounty cards in a grid — big green live pot, amber entry fee, red time left when a deadline is under 24 hours. Filter by text, sort by soonest, biggest pot, biggest reward or most entries.
- **Bounty page** (`#/bounty/<slug>`): hero with the live pot front and centre, reward / deadline / entries / opened stat tiles, skill chips, the live rewards table (what each place pays right now, prize + fee split) and the full description rendered safely.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): a top-3 podium with avatars and judge scores, then the full ranked table with gold / silver / bronze rank chips, 50 rows a page.
- **Profile** (`#/u/<handle>`): header card with avatar (or initial fallback), entered / placed / won / best placement / prize money tiles, and the account's solutions table.

Every view works from its own URL and from links inside the app. Data is live from the public API, cached in memory and revalidated with ETag / If-None-Match, with in-flight request dedupe — the board fills each card's live pot and entry fee from detail fetches without rebuilding the page, and time-left labels tick every 30 seconds.

## Run it
```sh
node serve.ts
```
Then open http://localhost:8080 — Board at `#/`, a bounty at `#/bounty/<slug>`, its leaderboard at `#/bounty/<slug>/leaderboard`, a profile at `#/u/<handle>`.

## Screenshots
`screenshots/` holds three 1280×800 shots taken from the running app with live data: `1-board.jpg` (board), `2-bounty.jpg` (bounty page), `3-leaderboard.jpg` (leaderboard).

---
<sub>Entered on [make.fun](https://make.fun/?ref=ks2r30ft&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
