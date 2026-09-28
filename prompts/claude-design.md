Design a gamified, live, two-screen experience for a 30-minute internal team talk.

(Original prompt sent to Claude Design on Sep 27, 2026. The resulting handoff is in `design/`.
The game later moved from "hours saved" to a "pain removed" focus: tasks retired + Tool of the year.)

## Context
The Systems team at Hennessey Digital presents what it built in the last year across five levels,
one per presenter: Taulant (spreadsheets retired, Recipe Card AI), Abenezer (monitoring nobody has
to do), Hikmat (the client in numbers), Roma & Blin (AI Dev, built live on a stopwatch), Martin
(AI Writer and the boss fight against the legacy dashboard).

## Two surfaces
- Projector deck, 1600×900 stage, keyboard-driven, readable from the back of the room.
- Audience phone page from a QR code, 375px, no login.

## Game mechanics
Levels with intro cards, collectible power-up cards with rarity, audience points and badges
(Early Bird, Spreadsheet Slayer, Oracle, Crowd Whisperer, Full Run), live guess questions with a
countdown and podium reveal, the AI Dev live vote with a stopwatch, a boss fight, a final scoreboard.

## Rules
Never invent a number: missing impact values render as a visible [FILL] placeholder.
Plain HTML/CSS/JS, no build step, served from a Cloudflare Worker; state from polling /api/state.
