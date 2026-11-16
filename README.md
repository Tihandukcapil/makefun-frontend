# makefun-frontend
[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Tihandukcapil/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, tiny frontend for make.fun: the live bounty board with each bounty's live pot, entry fee and time left, a bounty's page with its rewards and rules, its leaderboard, and an account's public profile — all as static files on make.fun's public API, with a ~4 KB first load, cached + ETag-revalidated answers, and no sign-in.

## Run it
```sh
node serve.ts
```
Then open http://localhost:8080 — Board at `#/`, a bounty at `#/bounty/<slug>`, its leaderboard at `#/bounty/<slug>/leaderboard`, a profile at `#/u/<handle>`.

---
<sub>Entered on [make.fun](https://make.fun/?ref=ks2r30ft&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
