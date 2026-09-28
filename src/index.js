import { DurableObject } from "cloudflare:workers";
import {
  SECTORS, VOTE_KEYS, TOOL_IDS, QUESTIONS, WEEKS_PER_YEAR, FTE_HOURS,
  EARLY_BIRDS, MAX_PLAYERS, POINTS, scoreGuess,
} from "./config.js";
import { IMPACT } from "./impact.js";

const SECTOR_SET = new Set(SECTORS);
const newEpoch = () => Math.random().toString(36).slice(2, 10);

const EMPTY = () => ({
  epoch: newEpoch(),
  level: 1,
  players: {}, // id -> { id, name, avatar, points, badges[], joinedAt, hours, rate, vote, tool, guesses{} }
  joined: 0,
  vote: { open: false },
  guessOpen: null,
  reveals: {}, // qid -> actual
  timer: { startedAt: null, stoppedAt: null },
  // Where the projector deck is, as it reports it, and the last order from /remote.
  step: 0,
  stepLabel: "Title",
  stepQid: null,
  cmd: { seq: 0 },
});

const json = (data, status = 200) =>
  new Response(typeof data === "string" ? data : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const cleanName = (v) =>
  typeof v === "string" ? v.replace(/[<>&"]/g, "").trim().slice(0, 20) : "";
const cleanId = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(v) ? v : null);
const cleanAvatar = (v) => (typeof v === "string" && /^a[1-8]$/.test(v) ? v : "a1");

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// A player's AI Dev vote: a list of options (older saves hold a single string).
const votesOf = (p) => (Array.isArray(p.vote) ? p.vote : p.vote ? [p.vote] : []);
// Tool of the year picks: a list (older saves hold a single string).
const toolsOf = (p) => (Array.isArray(p.tool) ? p.tool : p.tool ? [p.tool] : []);

const award = (p, badge) => {
  if (!p.badges.includes(badge)) p.badges.push(badge);
};

export class Room extends DurableObject {
  async load() {
    if (!this.s) {
      const stored = await this.ctx.storage.get("s");
      // Anything saved by the v1 deck has a different shape: start clean.
      this.s = stored && stored.epoch && stored.players ? stored : EMPTY();
    }
    return this.s;
  }

  async save() {
    this.view = null;
    await this.ctx.storage.put("s", this.s);
  }

  // Find the player, or create them if they post before (or without) joining —
  // e.g. the phone kept its identity across a Worker redeploy.
  player(body, create) {
    const s = this.s;
    const id = cleanId(body.id);
    if (!id) return null;
    if (s.players[id]) return s.players[id];
    if (!create || Object.keys(s.players).length >= MAX_PLAYERS) return null;
    const name = cleanName(body.name);
    if (!name) return null;
    const p = {
      id, name, avatar: cleanAvatar(body.avatar), points: POINTS.join, badges: [],
      joinedAt: Date.now(), hours: null, rate: null, vote: null, tool: null, guesses: {},
    };
    s.joined += 1;
    if (s.joined <= EARLY_BIRDS) p.badges.push("early");
    s.players[id] = p;
    return p;
  }

  buildView() {
    const s = this.s;
    const players = Object.values(s.players);

    // "hours" now holds ticked tasks (1 each): perWeek is the count of tasks retired.
    const bySector = {};
    const byTask = {};
    let perWeek = 0;
    let participants = 0;
    for (const p of players) {
      if (!p.hours) continue;
      participants += 1;
      const sectors = p.hours.sectors || { [p.hours.sector]: p.hours.tasks };
      for (const [sector, tasks] of Object.entries(sectors)) {
        const sec = (bySector[sector] ||= { perWeek: 0, perYear: 0, participants: 0 });
        sec.participants += 1;
        for (const [task, h] of Object.entries(tasks)) {
          byTask[task] = (byTask[task] || 0) + h;
          sec.perWeek += h;
          perWeek += h;
        }
      }
    }
    for (const sec of Object.values(bySector)) sec.perYear = sec.perWeek * WEEKS_PER_YEAR;
    const perYear = perWeek * WEEKS_PER_YEAR;

    const counts = Object.fromEntries(VOTE_KEYS.map((k) => [k, 0]));
    for (const p of players) for (const k of votesOf(p)) counts[k] += 1;

    const guesses = {};
    for (const qid of Object.keys(QUESTIONS)) {
      const answers = players.filter((p) => p.guesses[qid] !== undefined);
      const actual = s.reveals[qid] ?? null;
      const g = { count: answers.length, median: median(answers.map((p) => p.guesses[qid])), actual, closest: [] };
      if (actual !== null) {
        g.closest = answers
          .map((p) => ({ name: p.name, value: p.guesses[qid], points: scoreGuess(p.guesses[qid], actual) }))
          .sort((a, b) => b.points - a.points || Math.abs(a.value - actual) - Math.abs(b.value - actual))
          .slice(0, 3);
      }
      guesses[qid] = g;
    }

    const quality = {};
    for (const p of players) {
      if (!p.rate) continue;
      const q = (quality[p.rate.sector] ||= { sum: 0, count: 0 });
      q.sum += p.rate.score;
      q.count += 1;
    }
    const qualityBySector = Object.fromEntries(
      Object.entries(quality).map(([k, v]) => [k, { avg: v.sum / v.count, count: v.count }]),
    );

    const toolCounts = Object.fromEntries(TOOL_IDS.map((k) => [k, 0]));
    for (const p of players) for (const t of toolsOf(p)) toolCounts[t] += 1;

    return {
      epoch: s.epoch,
      tools: { counts: toolCounts, total: players.filter((p) => toolsOf(p).length).length },
      level: s.level,
      hours: { participants, perWeek, perYear, fte: perYear / FTE_HOURS, byTask, bySector },
      vote: { open: s.vote.open, counts, total: players.filter((p) => votesOf(p).length).length },
      guessOpen: s.guessOpen,
      guesses,
      timer: s.timer,
      step: s.step || 0,
      stepLabel: s.stepLabel || "Title",
      stepQid: s.stepQid || null,
      cmd: s.cmd || { seq: 0 },
      players: players
        .map(({ id, name, avatar, points, badges }) => ({ id, name, avatar, points, badges }))
        .sort((a, b) => b.points - a.points),
      impact: IMPACT,
      quality: { bySector: qualityBySector },
    };
  }

  closeVote() {
    const s = this.s;
    if (!s.vote.open) return;
    s.vote.open = false;
    const players = Object.values(s.players);
    const counts = Object.fromEntries(VOTE_KEYS.map((k) => [k, 0]));
    for (const p of players) for (const k of votesOf(p)) counts[k] += 1;
    const winner = VOTE_KEYS.reduce((m, k) => (counts[k] > counts[m] ? k : m), VOTE_KEYS[0]);
    if (counts[winner]) for (const p of players) if (votesOf(p).includes(winner)) award(p, "crowd");
  }

  control(body) {
    const s = this.s;
    const players = Object.values(s.players);
    const now = Date.now();
    switch (body.action) {
      case "openQ":
        if (!(body.id in QUESTIONS)) return "unknown question";
        s.guessOpen = body.id;
        break;
      case "closeQ":
        s.guessOpen = null;
        break;
      case "revealQ": {
        const qid = body.id;
        if (!(qid in QUESTIONS)) return "unknown question";
        if (s.guessOpen === qid) s.guessOpen = null;
        if (s.reveals[qid] !== undefined) break; // points are only paid once
        const actual = QUESTIONS[qid];
        s.reveals[qid] = actual;
        const answered = players.filter((p) => p.guesses[qid] !== undefined);
        for (const p of answered) p.points += scoreGuess(p.guesses[qid], actual);
        const best = answered.sort(
          (a, b) => Math.abs(a.guesses[qid] - actual) - Math.abs(b.guesses[qid] - actual),
        )[0];
        if (best) award(best, "oracle");
        for (const p of players) {
          if (Object.keys(QUESTIONS).every((q) => p.guesses[q] !== undefined)) award(p, "full");
        }
        break;
      }
      case "openVote":
        s.vote.open = true;
        break;
      case "closeVote":
        this.closeVote();
        break;
      case "startT":
        s.timer = { startedAt: now, stoppedAt: null };
        break;
      case "stopT":
        if (s.timer.startedAt && !s.timer.stoppedAt) s.timer.stoppedAt = now;
        break;
      case "resetT":
        s.timer = { startedAt: null, stoppedAt: null };
        break;
      case "level": {
        const level = Number(body.level);
        if (!Number.isInteger(level) || level < 1 || level > 6) return "level must be 1–6";
        s.level = level;
        break;
      }
      case "step": {
        // The deck reports where it is; this also keeps phones on the right level.
        const step = Number(body.step);
        const level = Number(body.level);
        if (!Number.isInteger(step) || step < 0 || step > 60) return "bad step";
        s.step = step;
        s.stepLabel = typeof body.label === "string" ? body.label.slice(0, 40) : "";
        s.stepQid = body.qid in QUESTIONS ? body.qid : null;
        if (Number.isInteger(level) && level >= 1 && level <= 6) s.level = level;
        // Leaving a screen closes what was left open on it, so phones never stay
        // stuck on an old vote or question (they give those priority).
        if (s.vote.open && s.stepLabel !== "AI Dev live") this.closeVote();
        if (s.guessOpen && s.stepQid !== s.guessOpen) s.guessOpen = null;
        break;
      }
      case "goto": {
        const step = Number(body.step);
        if (!Number.isInteger(step) || step < 0 || step > 60) return "bad step";
        s.cmd = { seq: ((s.cmd && s.cmd.seq) || 0) + 1, kind: "goto", value: step };
        // Optimistic: the remote sees the new step at once; the deck confirms when it gets there.
        s.step = step;
        break;
      }
      case "beat": {
        const d = Number(body.d) === -1 ? -1 : 1;
        s.cmd = { seq: ((s.cmd && s.cmd.seq) || 0) + 1, kind: "beat", value: d };
        break;
      }
      case "reset":
        this.s = EMPTY();
        break;
      default:
        return "unknown action";
    }
    return null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    await this.load();
    const s = this.s;

    if (request.method === "GET" && url.pathname === "/api/state") {
      this.view ||= this.buildView();
      return json({ ...this.view, now: Date.now() });
    }
    if (request.method !== "POST") return json({ error: "not found" }, 404);

    const body = await request.json().catch(() => ({}));
    let error = null;

    switch (url.pathname) {
      case "/api/join": {
        const p = this.player(body, true);
        if (!p) error = "need a name";
        else {
          // Re-joining with the same id just refreshes name and avatar.
          p.name = cleanName(body.name) || p.name;
          p.avatar = cleanAvatar(body.avatar);
        }
        break;
      }
      case "/api/hours": {
        const p = this.player(body, true);
        if (!p) { error = "join first"; break; }
        // {sectors: {sector: {task: n}}}; the old {sector, tasks} shape still works.
        // Every ticked task counts as 1, whatever the phone sends (older phones
        // may still hold slider hours in local storage).
        const input = body.sectors && typeof body.sectors === "object"
          ? body.sectors
          : { [body.sector]: body.tasks };
        const sectors = {};
        for (const [sector, rawTasks] of Object.entries(input).slice(0, SECTORS.length)) {
          if (!SECTOR_SET.has(sector)) continue;
          const tasks = {};
          for (const [task, raw] of Object.entries(rawTasks || {}).slice(0, 12)) {
            const n = Number(raw);
            if (task.length > 80 || !Number.isFinite(n) || n <= 0) continue;
            tasks[task.replace(/[<>"]/g, "")] = 1;
          }
          if (Object.keys(tasks).length) sectors[sector] = tasks;
        }
        if (!Object.keys(sectors).length) { error = "add at least one task"; break; }
        if (!p.hours) p.points += POINTS.hours;
        p.hours = { sectors };
        const allTasks = Object.values(sectors).flatMap((t) => Object.keys(t));
        if (allTasks.some((t) => /sheet/i.test(t))) award(p, "slayer");
        break;
      }
      case "/api/rate": {
        const p = this.player(body, true);
        const score = Number(body.score);
        if (!p) error = "join first";
        else if (!SECTOR_SET.has(body.sector) || !Number.isInteger(score) || score < 1 || score > 5) {
          error = "pick a department and a score from 1 to 5";
        } else p.rate = { sector: body.sector, score };
        break;
      }
      case "/api/tool": {
        const p = this.player(body, true);
        if (!p) error = "join first";
        else {
          // {tools: [...]} (multi-select); the old {tool} shape still works.
          const picked = Array.isArray(body.tools) ? body.tools : [body.tool];
          const tools = [...new Set(picked.filter((t) => TOOL_IDS.includes(t)))];
          if (!tools.length) error = "pick at least one tool";
          else {
            if (!toolsOf(p).length) p.points += POINTS.tool;
            p.tool = tools;
          }
        }
        break;
      }
      case "/api/vote": {
        const p = this.player(body, true);
        if (!p) error = "join first";
        else if (!s.vote.open) error = "voting is closed";
        else {
          // {options: [...]} (multi-select); the old {option} shape still works.
          const picked = Array.isArray(body.options) ? body.options : [body.option];
          const options = [...new Set(picked.filter((k) => VOTE_KEYS.includes(k)))];
          if (votesOf(p).length) p.votedOnce = true;
          if (options.length && !votesOf(p).length && !p.votedOnce) {
            p.points += POINTS.vote;
            p.votedOnce = true;
          }
          p.vote = options.length ? options : null;
        }
        break;
      }
      case "/api/guess": {
        const p = this.player(body, true);
        const value = Number(body.value);
        if (!p) error = "join first";
        else if (s.guessOpen !== body.qid) error = "this question is closed";
        else if (!Number.isFinite(value) || value < 0 || value > 10000000) error = "enter a number";
        else p.guesses[body.qid] = Math.round(value);
        break;
      }
      case "/api/control":
        error = this.control(body);
        break;
      default:
        return json({ error: "not found" }, 404);
    }

    if (error) return json({ error }, 400);
    await this.save();
    if (url.pathname === "/api/control") {
      this.view = this.buildView();
      return json({ ...this.view, now: Date.now() });
    }
    return json({ ok: true });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (request.method === "POST") {
      const len = Number(request.headers.get("content-length") || 0);
      if (len > 8192) return json({ error: "payload too large" }, 413);
    }
    if (url.pathname === "/api/control") {
      const key = request.headers.get("x-admin-key") || "";
      if (!env.ADMIN_KEY || !timingSafeEqual(key, env.ADMIN_KEY)) {
        return json({ error: "unauthorized" }, 401);
      }
    }
    const stub = env.ROOM.get(env.ROOM.idFromName("main"));
    return stub.fetch(request);
  },
};
