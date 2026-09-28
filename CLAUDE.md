# hd-showcase

Live, gamified two-screen deck for the Systems team's HenneHuddle talk (Sep 28, 2026).
The projector shows the deck; the audience plays on their phones from a QR code; the
presenter drives it from a remote on a phone or second tab.

Live: https://hd-showcase.martin-b1c.workers.dev (Cloudflare account of martin@hennessey.com)

## What runs where

| URL | File | Who uses it |
|---|---|---|
| `/` | `public/index.html` | Audience phones (QR target) |
| `/deck` | `public/deck.html` | Projector. 31 steps + HUD |
| `/remote` | `public/remote.html` | Presenter's phone or second tab: Next/Back, question/vote/stopwatch buttons, speech per step |
| `/guide` | `public/guide.html` | Run sheet: every screen, what to press, what to say. Public and `noindex`, so it must never contain quiz answers |
| `/deck?demo` | same | Rehearsal with simulated players; nothing reaches the server or phones |
| `/walkthrough.html` | `public/walkthrough.html` | Local only (refuses to run off localhost): deck + two phones side by side, scripted, used to record `video/walkthrough.mp4` |

Backend: one Cloudflare Worker (`src/index.js`) with static assets and a single Durable
Object `Room` (SQLite-backed) holding the whole game as one JSON document. Every page polls
`GET /api/state` (deck every 0.7 s, phones and remote every 1–1.5 s).

## Source layout

- `src/index.js`: Worker + `Room`. Player endpoints (`/api/join`, `/api/hours`, `/api/tool`,
  `/api/vote`, `/api/guess`, `/api/rate`) and presenter actions on `POST /api/control`
  (needs header `x-admin-key`).
- `src/config.js`: departments, vote keys, Tool of the year ids, **quiz answers**, points.
- `src/impact.js`: numbers for the Client impact and Quality Shield screens. `null` values are
  hidden (a client panel with no data at all is dropped; one without `before` shows only "Now";
  Quality metrics without a number are omitted). **Never invent a number**: leave it null until it has a source.
- `public/dc-runtime.js`: tiny runtime for the Claude Design template syntax (`{{ }}`,
  `<sc-if>`, `<sc-for>`, `onClick`), rendered with `public/morphdom.js`. Each page keeps a
  `class Component extends DCLogic` with `renderVals()`; `window.__dcComponent` is exposed
  for debugging.
- `design/`: the original Claude Design handoff (reference only). The pages were generated
  from it with a patch script, then the project folder was deleted and rebuilt from the live
  deployment, so **`public/*.html` are the source now** and are edited directly.

## The game ("Pain removed" focus)

We deliberately do **not** ask for hours saved (people feel busier, not freer). Instead:
- Join +100 (first 100: Early Bird).
- Mission 1, "Which manual work don't you miss?": tick tasks in any department, +200 once.
  Each tick counts **1** server-side whatever the phone sends. `hours.perWeek` in the API is
  the count of tasks retired (legacy field name). A task mentioning "sheet" → Spreadsheet Slayer.
- Mission 2, Tool of the year: multi-select among 8 tools, +100 once. The deck shows % of voters per tool.
- 4 live guesses: commits 1,798 · Lead Center leads 67,300 · AI DEV PRs 897 · AI Writer
  commits 155. Score `max(0, round(500 × (1 − |guess − actual| / actual)))`, paid once on
  reveal. Closest → Oracle; all four answered → Full Run.
- AI Dev vote: multi-select, +100 once, voters of the winning option get Crowd Whisperer.

Sources for the answers are commented in `src/config.js` (git history of dashboard-2,
dashboard-2-frontend and hd-agent-service; Blin's HenneHuddle deck for Lead Center and AI DEV).

## Things that must stay in sync

- **Run of show**: `STEPS` in `public/deck.html` and `STEPS` / `SAY` / `JUMPS` in
  `public/remote.html` are index-aligned (31 steps; step 2 "Missions results" reuses the Pain removed screen live at level 1). Adding or moving a step means updating
  both, plus the step numbers in `public/guide.html`.
- **Questions**: `QUESTIONS` in `src/config.js` (ids + answers), the `QUESTIONS` array in
  `deck.html` (text + answer for the reveal animation) and the `QUESTIONS` map in
  `index.html` (text on phones). The deck template says "Question N of 4".
- **Tools / departments / tasks**: `TOOL_IDS` + `SECTORS` in `src/config.js` vs `TOOLS`,
  `SECTORS` and `TASKS` in the pages.

## Behaviour worth knowing before changing things

- The deck reports every step to the server (`action: "step"`), which sets the level shown
  on phones. `/remote` sends `goto` / `beat` commands; the deck applies them on its next poll.
- When the deck leaves the AI Dev step, an open vote is closed automatically (awarding
  Crowd Whisperer); when it leaves a question and its reveal, an open question is closed.
  Phones give an open vote or question priority over every other screen, so a forgotten
  open vote used to freeze them.
- **Reset all** starts a new `epoch`: phones drop their local player and go back to Join,
  the deck jumps to the title.
- Phones retry failed POSTs up to 3 times; outside `?demo` the deck never falls back to the
  simulator (a single failed poll used to switch it to DEMO silently).
- Right after `wrangler deploy`, the Worker can serve the previous version for a few
  seconds to a minute. Verify with a probe request before trusting a test.

## Commands (Node 22+, `nvm use 22`)

```bash
npm install
npm run dev        # http://127.0.0.1:8788, reads ADMIN_KEY from .dev.vars
npm run deploy     # wrangler deploy
npx wrangler secret put ADMIN_KEY
```

The presenter key lives in `.admin_key` and `.dev.vars` (both git-ignored; ask Martin).
Pages that need it (`/deck`, `/remote`) are opened once with `?key=…`, which stores it in
that browser and strips it from the URL.

Quick API smoke test (local):

```bash
K=$(cat .admin_key); B=http://127.0.0.1:8788
curl -s -X POST $B/api/control -H 'content-type: application/json' -H "x-admin-key: $K" -d '{"action":"reset"}'
curl -s -X POST $B/api/join -H 'content-type: application/json' -d '{"id":"test1234","name":"Test","avatar":"a1"}'
curl -s $B/api/state | head -c 400
```

Before touching the live game during someone's rehearsal, check `/api/state` first: a reset
wipes every player.

## Open items

- `[FILL]` values in `src/impact.js`: first-response and ticket-resolution times (Zendesk
  export), AI Writer draft time before/after (after = Step Functions execution durations of
  the `*-ai-writer-workflow` state machine), and most Quality Shield metrics. These need
  production data; none of them should be estimated silently.
- Q4 uses AI Writer commit count because pages-generated needs a production query
  (`client_content.Content` with `ai_generation_status="completed"`, added after 2026-05-12).
