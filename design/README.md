# Handoff: Systems Team Talk — gamified live two-screen experience

## Overview
A 30-minute internal talk by the Systems team at Hennessey Digital, presented as a game with 5 levels (one per presenter). It has two surfaces that share one live state:
- **Projector** (1600×900 stage, scaled to fit, keyboard-driven): 12 screens plus a persistent HUD showing the Time Bank and Quality Score.
- **Audience phone** (375px, opened from a QR code, no login): join, missions, live questions/votes, points, badges.

## About the design files
The `.dc.html` files are **design references built in HTML**. They show the intended look and behavior; they are not production code. The job is to **rebuild them as plain HTML/CSS/JS with no build step**, served as static files from a **Cloudflare Worker** (the brief's technical constraint). The prototypes already contain complete logic: polling, a demo simulator, scoring and tweens. Read the logic class in each file (`class Component`) and port it.

Open them in a browser to see them working. If `/api/state` doesn't respond, they switch to **DEMO** mode with simulated data.

## Fidelity
**High-fidelity.** Colors, type, sizes, spacing and copy are final unless marked `[FILL]`. Reproduce them exactly.

## Global rules
- **Never invent a number.** Every missing impact value renders as a dashed amber `[FILL]` box (`border:2px dashed #ffb547; color:#ffb547; font-weight:900`).
- Zero border radius everywhere except the countdown ring. 2px dividers `#232a38`. Labels and buttons flush left.
- Tabular numerals throughout (`font-variant-numeric: tabular-nums`).
- `prefers-reduced-motion`: animations to 1ms, no confetti, counters jump straight to their value.

## Design tokens
| Token | Value |
|---|---|
| Background | `#0b0d12` (outside the stage `#05060a`) |
| Panel | `#141821` · HUD `#0f1219` · track `#1c2230` |
| Rule / border | `#232a38` · control border `#2a3242` |
| Text | `#f4f5f8` · secondary `#aab2c2` · muted `#9aa3b5` · dim `#5b6477` |
| Purple (current, primary) | `#7c5cff` (pressed `#6a4cf0`) |
| Teal (live, success, real data) | `#22d3a6` |
| Pink (alert, boss, <6s) | `#ff5c8a` |
| Amber (points, legendary, [FILL]) | `#ffb547` |
| Common rarity | `#8b93a7` |
| Font | Inter 400–900 (Google Fonts); numbers 800–900, letter-spacing −0.04 to −0.06em |
| Kicker | 20px / 800 / uppercase / letter-spacing .16em (projector); 12–13px on the phone |
| Badge | clip-path octagon `polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)`, 3px inset rim |
| Legendary glow | `0 0 0 6px rgba(255,181,71,.12), 0 30px 80px rgba(255,181,71,.18)` |

## Motion
- `pop` (badges, toasts, milestone): scale .4→1.08→1, 500ms `cubic-bezier(.34,1.56,.64,1)`.
- Counters: ease-out cubic; 900–1400ms (reveal 2200ms). They roll from 0 when their slide becomes active. **Always schedule a `setTimeout` fallback** so a stalled rAF can't leave a number at 0.
- Milestone (1,000 / 2,500 / 5,000 h/yr): purple banner + 70 confetti pieces, total ≤1.5s. Only fires when the value goes **up** past a milestone, not on page load.
- Bars: `transition: width .6s cubic-bezier(.2,.8,.2,1)`.

## Projector — layout
Stage 1600×900, centered, `transform: scale(min(vw/1600, vh/900))`. Content area 1600×824, padding `52px 72px 40px`. HUD 76px at the bottom.

**Standard header:** kicker in teal on the left, 22px/800 muted meta on the right, 18px padding-bottom + 2px bottom rule.

**HUD** (grid `1fr 360px 170px 250px`):
- Time Bank: teal bar 14px, scale 0–5,000 h/yr, ticks at 20% / 50% / 100% (1k / 2.5k / 5k), value 34px/900 "h / yr".
- Quality: 5 purple segments, `avg/5`.
- Players count.
- Level: 5 squares 18px (done teal, current purple).
- LIVE (teal) / DEMO (amber) chip.

### Screens (keys ←/→; Space/↓ = next "beat" within a slide; beat resets on slide change)
1. **Title + QR.** Title 164px/900 "Five levels. / One year." (second line purple). Year stats in 5 columns: 1,798 commits · 1,240 pull requests merged · 672 features · 35 backend apps · 1 AI bot teammate. Right-hand panel 420px: real QR code (qrcode-generator library) pointing at the phone page, the URL, "N players in" at 88px, and the remaining Early Bird spots.
2. **Level map.** 5 equal columns. States: current = purple fill + glow + "Now playing" chip; done = teal border + ✓ + "Cleared"; locked = opacity .7; level 5 locked = "Boss level" chip in pink. Number 150px.
3. **Level intro.** Left 600px: level number 440px purple. Right: presenter, title 108px, list of power-ups with a rarity square.
4. **Power-ups.** Row of cards (rarity band on top, #NN / 17, name 38px, effect 24px, "Built by"). If the level has a single card (AI Dev, legendary), a large 520px card plus "Built live. On a stopwatch."
5. **Live question.** Question 88px. "Answers in" and "Room median" at 136px. Countdown ring 400px (conic-gradient; purple, pink under 6s). Default duration 30s.
6. **Reveal + podium.** Real answer 280px teal, rolling up. Median and "% off". Podium in 2-1-3 order, heights 230/320/170; 1st place is purple with the "Oracle" tag.
7. **AI Dev.** Phase 1 (timer not started): 4 bars A–D, the leader in teal, percentage at 72px. Phase 2 (timer running or stopped): the winning change, stopwatch `mm:ss.d` at 300px, steps "Slack message → AI developer → Pull request".
8. **Hours per department.** 3 headline cells: Estimated (FILL until data arrives) / Live h/yr / FTE (= perYear ÷ 1,880). Two ranked bar charts of 8 rows: estimated (dashed amber, with drivers) and live (teal, h/week + h/yr). h/yr = h/week × 48 (configurable).
9. **Client impact.** 2×2 panels: Before → After, badge "X% faster" (dashed "—% faster" when data is missing). The AI Dev "after" value is the stage stopwatch; before it starts, it shows "Measured live on stage".
10. **Quality Shield.** Shield 360×420 (clip-path) with 8 segments; each beat lights one in teal. List of 8 safeguards: the active one expands with "Prevents" and its metrics (before → after or a single value). Bottom strip: room average /5 for each department.
11. **Boss fight.** "Legacy Dashboard" 120px, HP 160px pink. 5-segment bar; each beat is a hit (−20%): Random charts → real data · One-click login · Credentials checklist · Campaign updates · What's next (always stays standing, amber).
12. **Final.** Top-3 podium, ranks 4–10, Time Bank + FTE, Quality Score, total points, total badges.

**Overlays:** achievement toasts at top-right (4.2s), milestone celebration, presenter bar (**C**) with: slides, go-to, level 1–5, question Q1–Q3 + Open/Close/Reveal, Vote Open/Close, Stopwatch Start/Stop/Reset, Test (milestone/badge), Reset all. **F** = fullscreen. Keys 1–5 = set level. Persist slide/beat/question in localStorage.

## Phone — states
Column max-width 480px (375px in preview), header with avatar 40px, name, "Rank #N of M", points in amber. All tap targets ≥44px; primary buttons are 60px, purple, label on the left and reward on the right.
1. **Join:** name + auto-picked avatar (8 color + glyph combinations; tap to shuffle). "Join game +100".
2. **Missions:** two cards. Mission 1: hours (+200). Mission 2: "Rate the change" (Quality Score). Footer "Next up".
3. **Hours:** step 1, pick a department (2-column grid); step 2, tasks with a −/+ stepper in 0.5h steps, total h/week ≈ h/year, "Submit hours +200". Any task containing "sheet" earns *Spreadsheet Slayer*.
4. **Rate:** department chips + options 5→1 (Far fewer … No change).
5. **Question** (takes over the screen whenever `guessOpen` is set): timer bar, question, display, 3×4 keypad, "Lock in guess" → "Locked in" state.
6. **Vote** (takes over whenever `vote.open`): 4 options, +100, confirmation with ✓.
7. **Waiting:** points, rank, 5-badge grid, next level.
8. **Final:** large position (purple if in the top 3), points, badges earned.
**Badge pop:** modal with spring, 2.2s.

View priority: not joined → Join; final → Final; vote open → Vote; question open → Question; mission in progress → that mission; otherwise Missions (or Waiting if both are done).

## Data / API
Poll `GET /api/state` every 1.5s. Shape:
```
{ hours:{participants, perWeek, perYear, fte, byTask{}, bySector{[sector]:{perWeek, perYear, participants}}},
  vote:{open, counts{a,b,c,d}, total}, guessOpen: "commits"|"prs"|"features"|null,
  guesses:{[id]:{count, median, actual, closest:[{name,value,points}]}},
  timer:{startedAt, stoppedAt}, now, level,
  players:[{name, avatar, points, badges[]}],
  impact:{ sectors:[{sector,hoursPerWeek,drivers[]}], client:[{id,sub,label,before,after}], quality:[{name,prevents,metrics:[{label,before,after}|{label,value}]}] },
  quality:{ bySector:{[sector]:{avg,count}} } }
```
`null` in impact → `[FILL]`. Client times are in **minutes**. `actual` stays null until the reveal.

**Endpoints assumed by the prototype (to implement in the Worker):**
- `POST /api/control {action}`, where action is one of `openQ|closeQ|revealQ {id}`, `openVote|closeVote`, `startT|stopT|resetT`, `level {level}`, `reset`
- `POST /api/join {name, avatar}` · `/api/hours {sector, tasks}` · `/api/rate {sector, score}` · `/api/guess {qid, value}` · `/api/vote {option}`

**Scoring:** join +100, hours +200, vote +100, guess `max(0, round(500 × (1 − |guess − actual| / actual)))`.
**Badges:** Early Bird (first 10 to join), Oracle (closest guess), Crowd Whisperer (voted for the winner), Full Run (answered everything), Spreadsheet Slayer.
**Streak bonus:** amount not defined yet.

## Content to confirm (placeholders)
- The 3 questions (actual answers 1,798 / 1,240 / 672) and the 4 AI Dev vote options.
- Departments, drivers and tasks for each department.
- All `[FILL]` values in impact and quality.

## Assets
- Icons: Lucide paths inlined as SVG data URIs (sheet, sunrise, eye, users, flag).
- QR: `qrcode-generator@1.4.4` (jsDelivr CDN).
- Font: Inter (Google Fonts). No images.

## Files
- `Projector Deck.dc.html`: the 12 screens, HUD, presenter controls, demo simulator.
- `Audience Phone.dc.html`: every phone state (its `previewState` setting lets you view each one).
- `Component Sheet.dc.html`: meters, badge, power-up card, shield, podium, ring, before/after.
