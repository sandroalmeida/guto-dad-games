// Bot players used by the balance tests. They only use things a player can see on screen
// (where the ball, lasers, strings and pickups are and which way they move) — never the RNG.
import {
  ARENA, BALL_RADIUS, PLAYER_RADIUS, PLAYER_SPEED, SPIN_BLADE, TRIANGLE_SPEED, TRIANGLE_HIT_RADIUS,
  createGame, stepGame, laserTrail, stringTips, distanceToSegment, STRING_SPEED,
} from "../logic.js";

const DIRS = [
  { key: "stay", dx: 0, dy: 0 },
  { key: "r", dx: 1, dy: 0 }, { key: "l", dx: -1, dy: 0 }, { key: "d", dx: 0, dy: 1 }, { key: "u", dx: 0, dy: -1 },
  { key: "dr", dx: Math.SQRT1_2, dy: Math.SQRT1_2 }, { key: "dl", dx: -Math.SQRT1_2, dy: Math.SQRT1_2 },
  { key: "ur", dx: Math.SQRT1_2, dy: -Math.SQRT1_2 }, { key: "ul", dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 },
];

const toInput = (dir) => ({ right: dir.dx > 0.1, left: dir.dx < -0.1, down: dir.dy > 0.1, up: dir.dy < -0.1 });

export function idleBot() {
  return () => ({});
}

export function wanderBot(seed = 7) {
  let s = seed, dir = DIRS[0], timer = 0;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return (state, dt) => {
    timer -= dt;
    if (timer <= 0) { dir = DIRS[Math.floor(rand() * DIRS.length)]; timer = 0.4 + rand() * 1.2; }
    return toInput(dir);
  };
}

// Dodges what it can see and zaps the ball with triangles when it lines up.
// `reaction` is how often it re-decides (seconds); `throws` toggles using the triangle.
export function smartBot({ reaction = 0.12, throws = true, lookahead = 0.22 } = {}) {
  let current = {}, timer = 0, aimDir = null;
  return (state, dt) => {
    timer -= dt;
    if (aimDir) {
      // Last decision turned us toward the ball: now throw.
      const input = { ...toInput(aimDir), throw: true };
      aimDir = null;
      return input;
    }
    if (timer > 0) return current;
    timer = reaction;
    const p = state.player, b = state.ball;

    if (throws && p.holding && b.paralyzed <= 0) {
      const aim = findAim(state);
      if (aim) { aimDir = aim; current = toInput(aim); return current; }
    }

    let best = DIRS[0], bestScore = Infinity;
    for (const dir of DIRS) {
      const x = clamp(p.x + dir.dx * PLAYER_SPEED * lookahead, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      const y = clamp(p.y + dir.dy * PLAYER_SPEED * lookahead, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      const score = threat(state, x, y, lookahead) + (dir === DIRS[0] ? 0 : 0.5);
      if (score < bestScore) { bestScore = score; best = dir; }
    }
    current = toInput(best);
    return current;
  };
}

function findAim(state) {
  const p = state.player, b = state.ball;
  const d = Math.hypot(b.x - p.x, b.y - p.y);
  if (d > 430) return null;
  const travel = d / TRIANGLE_SPEED;
  const bx = b.x + b.vx * travel, by = b.y + b.vy * travel;
  for (const dir of DIRS.slice(1)) {
    const along = (bx - p.x) * dir.dx + (by - p.y) * dir.dy;
    if (along <= 0) continue;
    const off = Math.abs((bx - p.x) * dir.dy - (by - p.y) * dir.dx);
    if (off < BALL_RADIUS + TRIANGLE_HIT_RADIUS - 12) return dir;
  }
  return null;
}

function threat(state, x, y, look) {
  const b = state.ball;
  let score = 0;
  // The ball (and its reach if it is spinning or about to use a power).
  if (b.paralyzed <= 0.3) {
    const bx = b.x + b.vx * look, by = b.y + b.vy * look;
    const reach = BALL_RADIUS + PLAYER_RADIUS + (b.spin > 0 ? SPIN_BLADE + 20 : b.windup > 0 ? SPIN_BLADE + 30 : 40);
    const d = Math.min(Math.hypot(bx - x, by - y), Math.hypot(b.x - x, b.y - y));
    if (d < reach + 90) score += ((reach + 90 - d) / 10) ** 2;
  }
  for (const l of state.lasers) {
    const trail = laserTrail(l);
    if (!l.stopped) trail.push({ x: l.hx + l.dx * l.speed * (look + 0.1), y: l.hy + l.dy * l.speed * (look + 0.1) });
    for (let i = 1; i < trail.length; i++) {
      const d = distanceToSegment(x, y, trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y);
      if (d < 70) score += ((70 - d) / 6) ** 2;
    }
  }
  for (const s of state.strings) {
    if (s.phase === "back") continue;
    const tips = stringTips(s);
    for (let k = 0; k < 2; k++) {
      const dir = s.dirs[k];
      const reach = s.phase === "out" ? Math.min(s.max[k], s.ext[k] + STRING_SPEED * (look + 0.1)) : s.ext[k];
      const d = distanceToSegment(x, y, s.ox, s.oy, s.ox + dir.dx * reach, s.oy + dir.dy * reach);
      if (d < 50) score += ((50 - d) / 5) ** 2;
      void tips;
    }
  }
  // Corners and walls leave nowhere to go.
  const wall = Math.min(x, ARENA.width - x, y, ARENA.height - y);
  if (wall < 90) score += ((90 - wall) / 15) ** 2;
  // Head for a triangle when there is one.
  if (!state.player.holding && state.triangles.length) {
    const t = state.triangles[0];
    score += Math.hypot(t.x - x, t.y - y) / 40;
  }
  return score;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Plays one full game; returns the final state.
export function playGame(seed, bot, { dt = 1 / 60, maxTime = 600 } = {}) {
  const state = createGame(seed);
  const events = [];
  while (!state.over && state.time < maxTime) {
    for (const e of stepGame(state, bot(state, dt), dt)) events.push(e);
  }
  return { state, events };
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
