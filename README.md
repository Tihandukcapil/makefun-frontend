# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, static make.fun frontend: the live bounty board, bounty pages, leaderboards and public profiles, straight from make.fun's public API. No sign-in, no build step — serve the `app/` directory and it renders live data. Four surfaces, each reachable by link and by its own URL: the board (`#/`), a bounty page (`#/bounty/<slug>`), a leaderboard (`#/bounty/<slug>/leaderboard`) and a public profile (`#/u/<handle>`).

## Surfaces

- Board — `#/` — every open bounty, its live pot, entry fee and time left, with filter and sort.
- Bounty — `#/bounty/<slug>` — one bounty: live pot, reward split, latest entries.
- Leaderboard — `#/bounty/<slug>/leaderboard` — ranked entries with a podium for the top 3.
- Profile — `#/u/<handle>` — an entrant's record, wallet and entries.

## Run it

```sh
npx --yes serve app
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ks2r30ft&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
