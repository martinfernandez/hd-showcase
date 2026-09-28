# hd-showcase

Gamified two-screen deck for the Systems team's HenneHuddle talk (Sep 28, 2026).
A Cloudflare Worker serves the pages plus one Durable Object (`Room`) holding the
live game state.

Live: https://hd-showcase.martin-b1c.workers.dev

| URL | What |
|---|---|
| `/` | Phone page (QR target): join, two missions, live questions, AI Dev vote |
| `/?preview` | Phone page with the design's state tabs, framed at 375px (desktop only) |
| `/deck` | Projector deck: 28 steps + HUD |
| `/deck?key=<ADMIN_KEY>` | Open once on the presenting laptop so the presenter bar can control the game |
| `/deck?demo` | Rehearse with simulated players (nothing reaches phones or the server) |

## The game ("Pain removed" focus)

- Join +100 (first 10: Early Bird).
- Mission 1, "Which manual work don't you miss?": tick tasks in any department, +200.
  Every tick is one task retired and fills the HUD bar (milestones 30 / 75 / 150).
  A task mentioning "sheet" gives Spreadsheet Slayer.
- Mission 2, "Tool of the year": pick one of 8 tools, +100.
- Three live guesses (commits 1,798 · Lead Center leads 67,300 · AI DEV PRs 897):
  `max(0, round(500 × (1 − |guess − actual| / actual)))`, closest gets Oracle, all three gets Full Run.
- AI Dev vote +100; voters of the winner get Crowd Whisperer.

## Presenting

- `→` / PageDown next step · `←` back · `Space` next beat (Quality Shield, boss) · `C` presenter bar · `F` fullscreen.
- Presenter bar: Question (Q1–Q3 · Open · Close · Reveal), Vote (Open · Close),
  Stopwatch (Start · Stop · Reset), Level 1–5 and "Final (phones)", Go to jumps, Reset all.
- The HUD chip bottom right must say **LIVE**. DEMO means `?demo` is in the URL.

## Source layout

The project was rebuilt on Sep 28 after the folder was deleted. `public/deck.html` and
`public/index.html` are the source now (downloaded from the live deployment, then edited
directly). `design/` keeps the original Claude Design handoff for reference;
`public/dc-runtime.js` renders its template syntax (`{{ }}`, `sc-if`, `sc-for`) with morphdom.

- Game rules and answers: `src/config.js`. Impact numbers (`[FILL]` boxes): `src/impact.js`.
- Worker + Durable Object: `src/index.js`.

## Commands (Node 22+)

```bash
npm run dev      # local on :8788, reads ADMIN_KEY from .dev.vars
npm run deploy
npx wrangler secret put ADMIN_KEY
```

The presenter key lives in `.admin_key` (git-ignored).
