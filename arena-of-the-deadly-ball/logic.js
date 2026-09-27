// The Arena of the Deadly Ball — game rules.
// Pure and deterministic for a given seed: no DOM, no timers, no Math.random.
// game.js renders it; tests/*.test.mjs drive it with bot players.

export const ARENA = { width: 960, height: 600 };

export const LIVES = 3;
export const PLAYER_RADIUS = 18;
export const PLAYER_SPEED = 260;
export const INVULNERABLE_TIME = 2;

export const BALL_RADIUS = 22;
export const BALL_BASE_SPEED = 150;
export const BALL_SPEED_PER_DANGER = 22;
export const BALL_MAX_SPEED = 330;
export const BALL_STEER = 2.6;

export const DANGER_STEP = 25; // seconds per danger level
export const MAX_DANGER = 10;

export const PICKUP_RADIUS = 15;
export const TRIANGLE_LIFETIME = 12;
export const TRIANGLE_SPEED = 780;
export const TRIANGLE_HIT_RADIUS = 18; // plus BALL_RADIUS
export const PARALYZE_TIME = 3;

export const WINDUP_TIME = 0.55; // the ball glows before its secret power goes off
export const POWERS = ["laser", "spin", "strings"];

export const LASER_BOUNCES = 2;
export const LASER_TRAIL = 280;
export const LASER_BASE_SPEED = 600;
export const LASER_SPEED_PER_DANGER = 30;

export const SPIN_TIME = 3;
export const SPIN_BLADE = 70; // blade length past the ball's edge
export const SPIN_RATE = 12; // radians per second
export const SPIN_SPEED_BOOST = 1.15;

export const STRING_SPEED = 620;
export const STRING_HOLD = 0.45;
export const STRING_RETRACT_SPEED = 1100;

const WALL_MARGIN = 3;
const SUBSTEP = 1 / 120;

// ---------- random ----------

export function random(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const between = (state, lo, hi) => lo + random(state) * (hi - lo);

// ---------- geometry ----------

export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Distance along (dx, dy) from (x, y) until the arena wall (inset by margin).
export function distanceToWall(x, y, dx, dy, margin = WALL_MARGIN) {
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (ARENA.width - margin - x) / dx);
  if (dx < -1e-9) t = Math.min(t, (margin - x) / dx);
  if (dy > 1e-9) t = Math.min(t, (ARENA.height - margin - y) / dy);
  if (dy < -1e-9) t = Math.min(t, (margin - y) / dy);
  return Math.max(0, t);
}

// A direction that is never close to straight up/down/left/right, so bounces zigzag.
function randomDiagonalAngle(state) {
  const quarter = Math.floor(random(state) * 4);
  return quarter * (Math.PI / 2) + between(state, 0.3, Math.PI / 2 - 0.3);
}

// ---------- difficulty ----------

export const dangerAt = (time) => Math.min(MAX_DANGER, 1 + Math.floor(time / DANGER_STEP));
export const ballSpeed = (danger) => Math.min(BALL_MAX_SPEED, BALL_BASE_SPEED + BALL_SPEED_PER_DANGER * (danger - 1));
export const laserSpeed = (danger) => LASER_BASE_SPEED + LASER_SPEED_PER_DANGER * (danger - 1);
export const flameInterval = (danger) => Math.max(1.4, 4.8 - 0.4 * (danger - 1));
export const maxFlames = (danger) => (danger >= 6 ? 3 : danger >= 3 ? 2 : 1);
// Most of the time the ball rolls to random spots; sometimes a flame, and more often
// as the match goes on, wherever the player happens to be standing.
export const chaseChance = (danger) => Math.min(0.5, 0.08 * (danger - 1));
export const FLAME_SEEK_CHANCE = 0.55;

// ---------- setup ----------

export function createGame(seed = 1) {
  const state = {
    seed,
    rng: seed | 0,
    time: 0,
    danger: 1,
    lives: LIVES,
    over: false,
    player: {
      x: ARENA.width * 0.75, y: ARENA.height * 0.5,
      fx: -1, fy: 0, // facing: toward the ball at the start
      moving: false, walk: 0,
      holding: false, invulnerable: 0,
    },
    ball: {
      x: ARENA.width * 0.25, y: ARENA.height * 0.5,
      vx: 0, vy: 0, tx: 0, ty: 0, retarget: 0,
      roll: 0,
      paralyzed: 0,
      windup: 0, pending: null,
      spin: 0, spinAngle: 0, spinHit: false,
      anchored: false,
    },
    flames: [],
    triangles: [],
    thrown: [],
    lasers: [],
    strings: [],
    flameTimer: 3,
    triangleTimer: 2.5,
    nextId: 1,
    stats: { zaps: 0, throws: 0, dodged: 0, powers: { laser: 0, spin: 0, strings: 0 } },
  };
  pickBallTarget(state);
  const a = Math.atan2(state.ball.ty - state.ball.y, state.ball.tx - state.ball.x);
  state.ball.vx = Math.cos(a) * ballSpeed(1);
  state.ball.vy = Math.sin(a) * ballSpeed(1);
  return state;
}

// ---------- step ----------

// input: { up, down, left, right, throw } — booleans; `throw` is edge-triggered (one press = one throw).
export function stepGame(state, input = {}, dt = 1 / 60) {
  const events = [];
  if (state.over) return events;
  dt = Math.min(Math.max(dt, 0), 0.1);
  let throwPressed = !!input.throw;
  while (dt > 1e-9 && !state.over) {
    const h = Math.min(SUBSTEP, dt);
    substep(state, input, throwPressed, h, events);
    throwPressed = false;
    dt -= h;
  }
  return events;
}

function substep(state, input, throwPressed, dt, events) {
  state.time += dt;
  const danger = dangerAt(state.time);
  if (danger !== state.danger) {
    state.danger = danger;
    events.push({ type: "danger", level: danger });
  }

  movePlayer(state, input, dt);
  if (throwPressed) throwTriangle(state, events);
  moveBall(state, dt, events);
  updateThrown(state, dt, events);
  updateLasers(state, dt, events);
  updateStrings(state, dt, events);
  updatePickups(state, dt, events);
  spawnPickups(state, dt, events);
  checkDamage(state, events);
}

function movePlayer(state, input, dt) {
  const p = state.player;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const length = Math.hypot(dx, dy);
    dx /= length; dy /= length;
    p.fx = dx; p.fy = dy;
    p.x = clamp(p.x + dx * PLAYER_SPEED * dt, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    p.y = clamp(p.y + dy * PLAYER_SPEED * dt, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    p.walk += dt * 9;
  }
  if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
}

function throwTriangle(state, events) {
  const p = state.player;
  if (!p.holding) return;
  p.holding = false;
  state.stats.throws++;
  const start = PLAYER_RADIUS + 6;
  state.thrown.push({
    id: state.nextId++,
    x: p.x + p.fx * start, y: p.y + p.fy * start,
    vx: p.fx * TRIANGLE_SPEED, vy: p.fy * TRIANGLE_SPEED,
    spin: 0,
  });
  events.push({ type: "throw", x: p.x, y: p.y, fx: p.fx, fy: p.fy });
}

export function ballBusy(ball) {
  return ball.windup > 0 || ball.spin > 0 || ball.anchored;
}

function pickBallTarget(state) {
  const b = state.ball, p = state.player;
  const roll = random(state);
  const margin = 60;
  if (state.flames.length && roll < FLAME_SEEK_CHANCE) {
    let best = state.flames[0];
    for (const f of state.flames) if (Math.hypot(f.x - b.x, f.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y)) best = f;
    b.tx = best.x; b.ty = best.y;
  } else if (roll < FLAME_SEEK_CHANCE + chaseChance(state.danger)) {
    b.tx = clamp(p.x + between(state, -40, 40), margin, ARENA.width - margin);
    b.ty = clamp(p.y + between(state, -40, 40), margin, ARENA.height - margin);
  } else {
    b.tx = between(state, margin, ARENA.width - margin);
    b.ty = between(state, margin, ARENA.height - margin);
  }
  b.retarget = between(state, 1.4, 3.6);
}

function moveBall(state, dt, events) {
  const b = state.ball;

  if (b.spin > 0) {
    b.spin = Math.max(0, b.spin - dt);
    b.spinAngle += SPIN_RATE * dt;
    if (b.spin === 0) {
      if (!b.spinHit) { state.stats.dodged++; events.push({ type: "dodged", power: "spin" }); }
      events.push({ type: "spinEnd" });
    }
  }

  if (b.paralyzed > 0) {
    b.paralyzed = Math.max(0, b.paralyzed - dt);
    if (b.paralyzed === 0) events.push({ type: "wake", x: b.x, y: b.y });
    return;
  }

  if (b.windup > 0) {
    b.windup = Math.max(0, b.windup - dt);
    if (b.windup === 0) firePower(state, events);
  }

  if (b.anchored) { b.vx = 0; b.vy = 0; return; }

  b.retarget -= dt;
  if (b.retarget <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < 40) pickBallTarget(state);

  let speed = ballSpeed(state.danger);
  if (b.windup > 0) speed *= 0.35;
  if (b.spin > 0) speed *= SPIN_SPEED_BOOST;
  const dist = Math.hypot(b.tx - b.x, b.ty - b.y) || 1;
  const wantX = ((b.tx - b.x) / dist) * speed, wantY = ((b.ty - b.y) / dist) * speed;
  const k = Math.min(1, BALL_STEER * dt);
  b.vx += (wantX - b.vx) * k;
  b.vy += (wantY - b.vy) * k;
  // Never let steering bleed away all the speed.
  const v = Math.hypot(b.vx, b.vy);
  if (v < speed * 0.6 && v > 1e-6) { b.vx *= (speed * 0.6) / v; b.vy *= (speed * 0.6) / v; }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.roll += (Math.hypot(b.vx, b.vy) * dt) / BALL_RADIUS;

  let bounced = false;
  if (b.x < BALL_RADIUS) { b.x = BALL_RADIUS; b.vx = Math.abs(b.vx); bounced = true; }
  if (b.x > ARENA.width - BALL_RADIUS) { b.x = ARENA.width - BALL_RADIUS; b.vx = -Math.abs(b.vx); bounced = true; }
  if (b.y < BALL_RADIUS) { b.y = BALL_RADIUS; b.vy = Math.abs(b.vy); bounced = true; }
  if (b.y > ARENA.height - BALL_RADIUS) { b.y = ARENA.height - BALL_RADIUS; b.vy = -Math.abs(b.vy); bounced = true; }
  if (bounced) { pickBallTarget(state); events.push({ type: "ballBounce", x: b.x, y: b.y }); }

  if (!ballBusy(b)) {
    const index = state.flames.findIndex((f) => Math.hypot(f.x - b.x, f.y - b.y) < BALL_RADIUS + PICKUP_RADIUS);
    if (index >= 0) {
      const [flame] = state.flames.splice(index, 1);
      b.windup = WINDUP_TIME;
      b.pending = POWERS[Math.floor(random(state) * POWERS.length)];
      events.push({ type: "flameEaten", x: flame.x, y: flame.y });
    }
  }
}

function firePower(state, events) {
  const b = state.ball;
  const power = b.pending;
  b.pending = null;
  if (!power) return;
  state.stats.powers[power]++;
  if (power === "laser") {
    const angle = randomDiagonalAngle(state);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    state.lasers.push({
      id: state.nextId++,
      points: [{ x: b.x, y: b.y, d: 0 }],
      hx: b.x, hy: b.y, dx, dy,
      head: 0, tail: 0, bounces: 0, stopped: false,
      speed: laserSpeed(state.danger), hit: false,
    });
    events.push({ type: "power", power, x: b.x, y: b.y, angle });
  } else if (power === "spin") {
    b.spin = SPIN_TIME;
    b.spinAngle = random(state) * Math.PI * 2;
    b.spinHit = false;
    events.push({ type: "power", power, x: b.x, y: b.y });
  } else {
    const angle = random(state) * Math.PI * 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    b.anchored = true;
    b.vx = 0; b.vy = 0;
    state.strings.push({
      id: state.nextId++,
      ox: b.x, oy: b.y,
      dirs: [{ dx, dy }, { dx: -dx, dy: -dy }],
      ext: [BALL_RADIUS, BALL_RADIUS],
      max: [distanceToWall(b.x, b.y, dx, dy), distanceToWall(b.x, b.y, -dx, -dy)],
      phase: "out", hold: 0, hit: false,
    });
    events.push({ type: "power", power, x: b.x, y: b.y, angle });
  }
}

function updateThrown(state, dt, events) {
  const b = state.ball;
  for (let i = state.thrown.length - 1; i >= 0; i--) {
    const t = state.thrown[i];
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.spin += dt * 14;
    if (Math.hypot(t.x - b.x, t.y - b.y) < BALL_RADIUS + TRIANGLE_HIT_RADIUS) {
      state.thrown.splice(i, 1);
      const cancelled = b.windup > 0 ? "windup" : b.spin > 0 ? "spin" : null;
      if (b.spin > 0 && !b.spinHit) { state.stats.dodged++; events.push({ type: "dodged", power: "spin" }); }
      b.paralyzed = PARALYZE_TIME;
      b.windup = 0; b.pending = null; b.spin = 0;
      b.vx = 0; b.vy = 0;
      state.stats.zaps++;
      events.push({ type: "zap", x: b.x, y: b.y, cancelled });
      continue;
    }
    if (t.x < -20 || t.x > ARENA.width + 20 || t.y < -20 || t.y > ARENA.height + 20) {
      state.thrown.splice(i, 1);
      events.push({ type: "miss", x: clamp(t.x, 0, ARENA.width), y: clamp(t.y, 0, ARENA.height) });
    }
  }
}

function updateLasers(state, dt, events) {
  for (let i = state.lasers.length - 1; i >= 0; i--) {
    const l = state.lasers[i];
    if (!l.stopped) {
      let move = l.speed * dt;
      while (move > 1e-9 && !l.stopped) {
        const toWall = distanceToWall(l.hx, l.hy, l.dx, l.dy);
        if (toWall > move) {
          l.hx += l.dx * move; l.hy += l.dy * move; l.head += move; move = 0;
        } else {
          l.hx += l.dx * toWall; l.hy += l.dy * toWall; l.head += toWall; move -= toWall;
          l.points.push({ x: l.hx, y: l.hy, d: l.head });
          if (l.bounces >= LASER_BOUNCES) {
            l.stopped = true;
            events.push({ type: "laserEnd", x: l.hx, y: l.hy });
          } else {
            const eps = 0.01;
            if (l.hx <= WALL_MARGIN + eps || l.hx >= ARENA.width - WALL_MARGIN - eps) l.dx = -l.dx;
            if (l.hy <= WALL_MARGIN + eps || l.hy >= ARENA.height - WALL_MARGIN - eps) l.dy = -l.dy;
            l.bounces++;
            events.push({ type: "laserBounce", x: l.hx, y: l.hy });
          }
        }
      }
      l.tail = Math.max(0, l.head - LASER_TRAIL);
    } else {
      l.tail = Math.min(l.head, l.tail + l.speed * dt);
    }
    if (l.stopped && l.tail >= l.head) {
      state.lasers.splice(i, 1);
      if (!l.hit) { state.stats.dodged++; events.push({ type: "dodged", power: "laser" }); }
    }
  }
}

// The visible, deadly part of a laser: a polyline from its tail to its head.
export function laserTrail(l) {
  const path = [...l.points, { x: l.hx, y: l.hy, d: l.head }];
  const at = (d) => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if (d <= b.d) {
        const t = b.d === a.d ? 0 : (d - a.d) / (b.d - a.d);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    return { x: l.hx, y: l.hy };
  };
  const pts = [at(l.tail)];
  for (const p of l.points) if (p.d > l.tail && p.d < l.head) pts.push({ x: p.x, y: p.y });
  pts.push({ x: l.hx, y: l.hy });
  return pts;
}

function updateStrings(state, dt, events) {
  for (let i = state.strings.length - 1; i >= 0; i--) {
    const s = state.strings[i];
    if (s.phase === "out") {
      for (let k = 0; k < 2; k++) s.ext[k] = Math.min(s.max[k], s.ext[k] + STRING_SPEED * dt);
      if (s.ext[0] >= s.max[0] && s.ext[1] >= s.max[1]) {
        s.phase = "hold";
        s.hold = STRING_HOLD;
        events.push({ type: "stringsWall", tips: stringTips(s) });
      }
    } else if (s.phase === "hold") {
      s.hold -= dt;
      if (s.hold <= 0) s.phase = "back";
    } else {
      for (let k = 0; k < 2; k++) s.ext[k] = Math.max(0, s.ext[k] - STRING_RETRACT_SPEED * dt);
      if (s.ext[0] <= BALL_RADIUS && s.ext[1] <= BALL_RADIUS) {
        state.strings.splice(i, 1);
        state.ball.anchored = false;
        state.ball.retarget = 0;
        if (!s.hit) { state.stats.dodged++; events.push({ type: "dodged", power: "strings" }); }
      }
    }
  }
}

export function stringTips(s) {
  return s.dirs.map((d, k) => ({ x: s.ox + d.dx * s.ext[k], y: s.oy + d.dy * s.ext[k] }));
}

export function spinBlades(ball) {
  return [0, Math.PI].map((offset) => {
    const a = ball.spinAngle + offset;
    return {
      ax: ball.x + Math.cos(a) * (BALL_RADIUS - 4), ay: ball.y + Math.sin(a) * (BALL_RADIUS - 4),
      bx: ball.x + Math.cos(a) * (BALL_RADIUS + SPIN_BLADE), by: ball.y + Math.sin(a) * (BALL_RADIUS + SPIN_BLADE),
    };
  });
}

function updatePickups(state, dt, events) {
  const p = state.player;
  for (let i = state.triangles.length - 1; i >= 0; i--) {
    const t = state.triangles[i];
    t.life -= dt;
    t.age += dt;
    if (!p.holding && Math.hypot(t.x - p.x, t.y - p.y) < PLAYER_RADIUS + PICKUP_RADIUS) {
      state.triangles.splice(i, 1);
      p.holding = true;
      events.push({ type: "pickup", x: t.x, y: t.y });
    } else if (t.life <= 0) {
      state.triangles.splice(i, 1);
      events.push({ type: "triangleExpire", x: t.x, y: t.y });
    }
  }
  for (const f of state.flames) f.age += dt;
}

function spawnSpot(state, minFromPlayer, minFromBall) {
  const margin = 50;
  let spot = null;
  for (let tries = 0; tries < 40; tries++) {
    const x = between(state, margin, ARENA.width - margin);
    const y = between(state, margin, ARENA.height - margin);
    spot = { x, y };
    if (Math.hypot(x - state.player.x, y - state.player.y) >= minFromPlayer &&
        Math.hypot(x - state.ball.x, y - state.ball.y) >= minFromBall) return spot;
  }
  return spot;
}

function spawnPickups(state, dt, events) {
  state.triangleTimer -= dt;
  if (state.triangleTimer <= 0) {
    if (!state.player.holding && state.triangles.length === 0) {
      const spot = spawnSpot(state, 150, 150);
      state.triangles.push({ id: state.nextId++, ...spot, life: TRIANGLE_LIFETIME, age: 0 });
      events.push({ type: "triangleSpawn", ...spot });
      state.triangleTimer = between(state, 8, 13);
    } else {
      state.triangleTimer = 1.5;
    }
  }

  state.flameTimer -= dt;
  if (state.flameTimer <= 0) {
    if (state.flames.length < maxFlames(state.danger)) {
      const spot = spawnSpot(state, 140, 170);
      state.flames.push({ id: state.nextId++, ...spot, age: 0 });
      events.push({ type: "flameSpawn", ...spot });
    }
    state.flameTimer = flameInterval(state.danger) * between(state, 0.75, 1.25);
  }
}

// What would hurt a player standing at (x, y) right now, or null.
export function dangerAtPoint(state, x, y, radius = PLAYER_RADIUS) {
  const b = state.ball;
  if (b.paralyzed <= 0 && Math.hypot(b.x - x, b.y - y) < radius + BALL_RADIUS - 4) return "ball";
  if (b.spin > 0) {
    for (const blade of spinBlades(b)) {
      if (distanceToSegment(x, y, blade.ax, blade.ay, blade.bx, blade.by) < radius + 3) return "spin";
    }
  }
  for (const l of state.lasers) {
    const trail = laserTrail(l);
    for (let i = 1; i < trail.length; i++) {
      if (distanceToSegment(x, y, trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y) < radius + 3) return "laser";
    }
  }
  for (const s of state.strings) {
    if (s.phase === "back") continue;
    const tips = stringTips(s);
    for (let k = 0; k < 2; k++) {
      const d = s.dirs[k];
      const sx = s.ox + d.dx * BALL_RADIUS, sy = s.oy + d.dy * BALL_RADIUS;
      if (distanceToSegment(x, y, sx, sy, tips[k].x, tips[k].y) < radius + 2) return "strings";
    }
  }
  return null;
}

function checkDamage(state, events) {
  const p = state.player;
  if (p.invulnerable > 0) return;
  const cause = dangerAtPoint(state, p.x, p.y);
  if (!cause) return;

  state.lives--;
  p.invulnerable = INVULNERABLE_TIME;
  const b = state.ball;
  if (cause === "spin") b.spinHit = true;
  if (cause === "laser") for (const l of state.lasers) l.hit = true;
  if (cause === "strings") for (const s of state.strings) s.hit = true;
  if (cause === "ball" || cause === "spin") {
    // Knock the ball away so it doesn't sit on top of the player.
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    const speed = ballSpeed(state.danger) * 1.6;
    b.vx = (dx / d) * speed; b.vy = (dy / d) * speed;
    b.tx = clamp(b.x + (dx / d) * 400, 60, ARENA.width - 60);
    b.ty = clamp(b.y + (dy / d) * 400, 60, ARENA.height - 60);
    b.retarget = 1.5;
  }
  events.push({ type: "hurt", cause, lives: state.lives, x: p.x, y: p.y });
  if (state.lives <= 0) {
    state.over = true;
    events.push({ type: "gameover", time: state.time });
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
