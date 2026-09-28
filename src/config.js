// Game rules. Labels shown to people live in the page code; these are the ids
// the Worker accepts and scores.

export const SECTORS = [
  "SEO", "Content", "Web/WordPress", "Digital PR",
  "Link Building", "Local/GBP", "Paid Media", "Account Management",
];

export const VOTE_KEYS = ["a", "b", "c", "d"];

// Tool of the year (phone mission 2). Ids match TOOLS in the pages.
export const TOOL_IDS = [
  "ai_writer", "ai_dev", "lead_center", "gbp_monitor",
  "recipe_card", "exec_summary", "brand_profiles", "slack_ai",
];

// Live questions and their real answers.
// commits: git history of the three repos, Sep 2025 → Sep 2026.
// leads, aidev_prs: Blin's HenneHuddle deck (Lead Center snapshot Sep 22; AI DEV Sep 9–27).
// ai_writer: commit subjects mentioning the AI Writer since 2025-09-01 (101 backend + 54 frontend).
export const QUESTIONS = { commits: 1798, leads: 67300, aidev_prs: 897, ai_writer: 155 };

export const WEEKS_PER_YEAR = 48;
export const FTE_HOURS = 1880;
export const EARLY_BIRDS = 100;
export const MAX_PLAYERS = 500;

export const POINTS = { join: 100, hours: 200, vote: 100, tool: 100, guessMax: 500 };

export const scoreGuess = (value, actual) =>
  Math.max(0, Math.round(POINTS.guessMax * (1 - Math.abs(value - actual) / actual)));
