export const RIVER_WORLD_WIDTH = 1200;
export const RIVER_WORLD_HEIGHT = 620;

// The river runs top to bottom on the screen; the crossing is left to right.
// START bank on the left, END bank on the right, water flowing down toward the
// waterfall lip at the bottom. Fall behind the lip and you go over the falls;
// miss a log and you drop among the piranhas.
export const RIVER_LEFT_BANK = 156;
export const RIVER_RIGHT_BANK = 1044;
export const RIVER_TOP = 48;
export const RIVER_WATERFALL_Y = 556;
export const RIVER_BOTTOM = RIVER_WORLD_HEIGHT;

export const RIVER_START_X = 96;
export const RIVER_START_Y = 150;
export const RIVER_STEP_MARGIN = 24;

// The current is the boss of this river. It carries everything downstream fast
// enough that no amount of spin can climb back against it — the best you can do
// on a log is slow your fall. To gain height you have to hop to a fresher log.
export const RIVER_CURRENT = 62;
// Even a perfectly-spun log still sinks this fast — enough that no single log
// carries you across, so you always have to hop to a fresher, higher one.
export const RIVER_MIN_DRIFT = 40;

// Spinning is a managed velocity: an arrow ramps the spin, the opposite arrow
// bleeds it off or reverses it, and letting go lets it wind down on its own.
export const RIVER_SPIN_ACCEL = 5.4;
export const RIVER_SPIN_MAX = 6;
export const RIVER_SPIN_DECAY = 0.55;
export const RIVER_SPIN_THRUST = 17;

export const RIVER_LOG_LENGTH = 120;
export const RIVER_LOG_RADIUS = 15;
export const RIVER_GRAB_RADIUS = 30;

// Standing on the near bank you can walk about with the arrows to line up a
// jump; the arrows only ever spin the log once you are actually on one.
export const RIVER_BANK_WALK = 168;
export const RIVER_BANK_MIN_X = 34;
export const RIVER_BANK_MIN_Y = RIVER_TOP + 24;
export const RIVER_BANK_MAX_Y = RIVER_WATERFALL_Y - 40;

// A hop is a real leap you aim and steer: it launches the way you point and the
// arrows steer the arc toward a capped cruise speed, so a hop travels a
// predictable distance in the direction you hold and lands where you guide it —
// nothing lines it up for you. The current cannot touch you while you are off
// the water. A held direction cruises ~HOP_SPEED*HOP_TIME px that way.
export const RIVER_HOP_TIME = 0.56;
export const RIVER_HOP_SPEED = 342;
export const RIVER_HOP_STEER = 10;
export const RIVER_HOP_ARC = 30;

export const RIVER_MAX_LOGS = 14;
export const RIVER_MIN_LOGS = 11;
export const RIVER_SPAWN_INTERVAL = 0.45;

// Piranhas prowl the whole river and close in on the explorer, hungriest near
// the falls and in a frenzy once someone is in the water.
export const RIVER_PIRANHA_COUNT = 9;
export const RIVER_PIRANHA_SPEED = 52;
export const RIVER_PIRANHA_LURK = 62;

// The mix of logs that float down. Forward spin on a log pushes the rider along
// its `roll` vector, so most logs carry you rightward (toward END). No log lets
// you beat the current, but a climb-cross log slows the fall the most; a
// crosswise brake log only stalls, and the sink-cross log makes things worse.
export const riverRollKinds = [
  { roll: { x: 1, y: 0 }, weight: 3, kind: "cross" },
  { roll: { x: 0.7071, y: -0.7071 }, weight: 5, kind: "climb" },
  { roll: { x: 0, y: -1 }, weight: 1, kind: "brake" },
  { roll: { x: 0.7071, y: 0.7071 }, weight: 1, kind: "sink" },
] as const;

export type RiverRollKind = (typeof riverRollKinds)[number]["kind"];
export type RiverLossReason = "waterfall" | "piranha";
export type BankSide = "start" | "end";

export type RiverVec = { x: number; y: number };

export type RiverLog = {
  id: number;
  x: number;
  y: number;
  roll: RiverVec;
  kind: RiverRollKind;
  spin: number;
  length: number;
  radius: number;
  bob: number;
};

export type Piranha = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
  chomp: number;
};

export type RiverCourseState = {
  seed: number;
  elapsed: number;
  logs: RiverLog[];
  piranhas: Piranha[];
  nextLogId: number;
  ridingLogId: number | null;
  onBank: BankSide | null;
  hopping: boolean;
  hopTime: number;
  hopVX: number;
  hopVY: number;
  hopLift: number;
  spawnTimer: number;
  jumpPresses: number;
  furthestX: number;
  hops: number;
  boards: number;
  splashFlash: number;
  warned: boolean;
  won: boolean;
  lost: boolean;
  lossReason: RiverLossReason | null;
};

export type RiverPlayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
};

export type RiverInput = {
  moveX: number;
  moveY: number;
};

export type RiverEvent =
  | { type: "hop" }
  | { type: "board"; kind: RiverRollKind }
  | { type: "spin"; direction: number }
  | { type: "warn" }
  | { type: "won" }
  | { type: "lost"; reason: RiverLossReason };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nextRandom(state: { seed: number }) {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const rollTotalWeight = riverRollKinds.reduce((sum, kind) => sum + kind.weight, 0);

function pickRoll(state: { seed: number }) {
  let ticket = nextRandom(state) * rollTotalWeight;
  for (const kind of riverRollKinds) {
    ticket -= kind.weight;
    if (ticket <= 0) return kind;
  }
  return riverRollKinds[0];
}

function spawnLog(state: RiverCourseState, y: number): RiverLog {
  const kind = pickRoll(state);
  const x = RIVER_LEFT_BANK + 44 + nextRandom(state) * (RIVER_RIGHT_BANK - RIVER_LEFT_BANK - 88);
  const log: RiverLog = {
    id: state.nextLogId,
    x,
    y,
    roll: { x: kind.roll.x, y: kind.roll.y },
    kind: kind.kind,
    spin: 0,
    length: RIVER_LOG_LENGTH,
    radius: RIVER_LOG_RADIUS,
    bob: nextRandom(state) * Math.PI * 2,
  };
  state.nextLogId += 1;
  return log;
}

export function makeRiverCourse(seed = 7): RiverCourseState {
  const state: RiverCourseState = {
    seed: seed | 0 || 7,
    elapsed: 0,
    logs: [],
    piranhas: [],
    nextLogId: 0,
    ridingLogId: null,
    onBank: "start",
    hopping: false,
    hopTime: 0,
    hopVX: 0,
    hopVY: 0,
    hopLift: 0,
    spawnTimer: RIVER_SPAWN_INTERVAL,
    jumpPresses: 0,
    furthestX: RIVER_START_X,
    hops: 0,
    boards: 0,
    splashFlash: 0,
    warned: false,
    won: false,
    lost: false,
    lossReason: null,
  };

  // A guaranteed boarding log a hop away from the start bank, plus a scatter of
  // logs already drifting down the river.
  state.logs.push({
    id: state.nextLogId,
    x: RIVER_LEFT_BANK + 78,
    y: RIVER_START_Y + 6,
    roll: { x: 0.7071, y: -0.7071 },
    kind: "climb",
    spin: 0,
    length: RIVER_LOG_LENGTH,
    radius: RIVER_LOG_RADIUS,
    bob: nextRandom(state) * Math.PI * 2,
  });
  state.nextLogId += 1;

  const rows = [70, 110, 168, 214, 268, 320, 372, 430, 480, 516];
  for (const row of rows) {
    state.logs.push(spawnLog(state, row));
  }

  for (let i = 0; i < RIVER_PIRANHA_COUNT; i += 1) {
    state.piranhas.push({
      x: RIVER_LEFT_BANK + 40 + nextRandom(state) * (RIVER_RIGHT_BANK - RIVER_LEFT_BANK - 80),
      y: RIVER_TOP + 60 + nextRandom(state) * (RIVER_WATERFALL_Y - RIVER_TOP - 100),
      vx: 0,
      vy: 0,
      phase: nextRandom(state) * Math.PI * 2,
      size: 0.85 + nextRandom(state) * 0.4,
      chomp: 0,
    });
  }
  return state;
}

// A log is a capsule: the segment along its length, thickened by its radius.
export function logAxis(log: RiverLog): RiverVec {
  // The length axis is perpendicular to the roll (propulsion) direction.
  return { x: -log.roll.y, y: log.roll.x };
}

export function logAxisAngle(log: RiverLog) {
  const axis = logAxis(log);
  return Math.atan2(axis.y, axis.x);
}

export function logEndpoints(log: RiverLog): [RiverVec, RiverVec] {
  const axis = logAxis(log);
  const half = log.length / 2;
  return [
    { x: log.x - axis.x * half, y: log.y - axis.y * half },
    { x: log.x + axis.x * half, y: log.y + axis.y * half },
  ];
}

function pointToSegment(px: number, py: number, a: RiverVec, b: RiverVec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / lengthSq, 0, 1);
  const cx = a.x + dx * t;
  const cy = a.y + dy * t;
  return Math.hypot(px - cx, py - cy);
}

export function logContains(log: RiverLog, px: number, py: number, margin = RIVER_GRAB_RADIUS) {
  const [a, b] = logEndpoints(log);
  return pointToSegment(px, py, a, b) <= margin;
}

function findLog(state: RiverCourseState, id: number | null) {
  if (id === null) return null;
  return state.logs.find((log) => log.id === id) ?? null;
}

// A helper for bots (and only bots): the logs a leap could plausibly reach from
// here. The game itself never lines a jump up for the player.
export function reachableLogs(state: RiverCourseState, fromX: number, fromY: number) {
  const reach = RIVER_HOP_SPEED * RIVER_HOP_TIME;
  return state.logs
    .filter((log) => log.id !== state.ridingLogId)
    .map((log) => ({ log, dist: Math.hypot(log.x - fromX, log.y - fromY) }))
    .filter((entry) => entry.dist <= reach)
    .sort((a, b) => a.dist - b.dist)
    .map((entry) => entry.log);
}

function beginHop(state: RiverCourseState, player: RiverPlayer, input: RiverInput, events: RiverEvent[]) {
  let aimX = input.moveX;
  let aimY = input.moveY;
  if (Math.abs(aimX) + Math.abs(aimY) < 0.1) {
    aimX = 1;
    aimY = 0;
  }
  const len = Math.hypot(aimX, aimY) || 1;
  const current = findLog(state, state.ridingLogId);
  if (current) current.spin = 0;
  state.ridingLogId = null;
  state.onBank = null;
  state.hopping = true;
  state.hopTime = 0;
  state.hopLift = 0;
  state.hopVX = (aimX / len) * RIVER_HOP_SPEED;
  state.hopVY = (aimY / len) * RIVER_HOP_SPEED;
  player.facing = state.hopVX >= 0 ? 1 : -1;
  state.hops += 1;
  events.push({ type: "hop" });
}

function boardLog(state: RiverCourseState, player: RiverPlayer, log: RiverLog, events: RiverEvent[]) {
  log.spin = 0;
  state.ridingLogId = log.id;
  state.onBank = null;
  state.hopping = false;
  player.x = log.x;
  player.y = log.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  state.boards += 1;
  events.push({ type: "board", kind: log.kind });
}

function win(state: RiverCourseState, player: RiverPlayer, events: RiverEvent[]) {
  state.won = true;
  state.hopping = false;
  state.onBank = "end";
  state.ridingLogId = null;
  player.x = Math.max(player.x, RIVER_RIGHT_BANK + 12);
  player.y = clamp(player.y, RIVER_TOP, RIVER_WATERFALL_Y - 10);
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  events.push({ type: "won" });
}

function lose(state: RiverCourseState, player: RiverPlayer, reason: RiverLossReason, events: RiverEvent[]) {
  state.lost = true;
  state.lossReason = reason;
  state.hopping = false;
  state.ridingLogId = null;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  if (reason === "piranha") state.splashFlash = 0.6;
  events.push({ type: "lost", reason });
}

function landHop(state: RiverCourseState, player: RiverPlayer, events: RiverEvent[]) {
  // Wherever the leap actually ends is where you come down — no guidance.
  let covering: RiverLog | null = null;
  let coveringDist = Infinity;
  for (const log of state.logs) {
    if (logContains(log, player.x, player.y)) {
      const dist = Math.hypot(log.x - player.x, log.y - player.y);
      if (dist < coveringDist) {
        coveringDist = dist;
        covering = log;
      }
    }
  }
  if (covering) {
    boardLog(state, player, covering, events);
    return;
  }

  if (player.x >= RIVER_RIGHT_BANK - RIVER_STEP_MARGIN && player.y > RIVER_TOP - 20 && player.y < RIVER_WATERFALL_Y) {
    win(state, player, events);
    return;
  }
  if (player.x <= RIVER_LEFT_BANK) {
    // Came down on the near bank — no harm, walk and try again.
    state.onBank = "start";
    state.hopping = false;
    player.x = clamp(player.x, RIVER_BANK_MIN_X, RIVER_LEFT_BANK - 6);
    player.y = clamp(player.y, RIVER_BANK_MIN_Y, RIVER_BANK_MAX_Y);
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    return;
  }
  lose(state, player, "piranha", events);
}

function stepPiranhas(state: RiverCourseState, player: RiverPlayer, dt: number) {
  const frenzy = state.lost && state.lossReason === "piranha";
  const near = riverHeadroom(player.y) < 0.42;
  const targetX = player.x;
  const targetY = player.y;
  state.piranhas.forEach((p, index) => {
    p.chomp = Math.max(0, p.chomp - dt);
    p.phase += dt * (2.4 + p.size);
    const dx = targetX - p.x;
    const dy = targetY - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Orbit the explorer at a lurking distance, closing right in during a frenzy.
    const lurk = frenzy ? 6 : RIVER_PIRANHA_LURK + (index % 3) * 14;
    const pull = (dist - lurk) * 2.4;
    const speed = (frenzy ? 2.2 : near ? 1.45 : 1) * RIVER_PIRANHA_SPEED;
    const ux = dx / dist;
    const uy = dy / dist;
    // Tangential swirl so the shoal circles rather than piling on one point.
    const swirl = frenzy ? 0.2 : 0.7;
    const desiredX = ux * clamp(pull, -speed, speed) + -uy * speed * swirl * Math.sin(p.phase + index);
    const desiredY = uy * clamp(pull, -speed, speed) + ux * speed * swirl * Math.sin(p.phase + index) + RIVER_CURRENT * 0.12;
    p.vx += (desiredX - p.vx) * Math.min(1, dt * 3);
    p.vy += (desiredY - p.vy) * Math.min(1, dt * 3);
    p.x = clamp(p.x + p.vx * dt, RIVER_LEFT_BANK + 6, RIVER_RIGHT_BANK - 6);
    p.y = p.y + p.vy * dt;
    if (p.y > RIVER_WATERFALL_Y - 6) p.y = RIVER_WATERFALL_Y - 6;
    if (p.y < RIVER_TOP + 10) p.y = RIVER_TOP + 10;
    // A snap of the jaws when it gets close enough to threaten.
    if (dist < 40 && p.chomp <= 0) p.chomp = 0.28;
  });
}

export function stepRiverCourse(
  state: RiverCourseState,
  player: RiverPlayer,
  input: RiverInput,
  dt: number,
): RiverEvent[] {
  const events: RiverEvent[] = [];
  state.elapsed += dt;
  state.splashFlash = Math.max(0, state.splashFlash - dt);

  if (state.won || state.lost) {
    state.jumpPresses = 0;
    // The waterfall sweeps you over the edge; the piranhas hold you where you
    // fell so the shoal can close in.
    if (state.lost && state.lossReason === "waterfall" && player.y < RIVER_BOTTOM) {
      player.y = Math.min(RIVER_BOTTOM, player.y + dt * 240);
    }
    driftFreeLogs(state, dt);
    stepPiranhas(state, player, dt);
    return events;
  }

  const presses = state.jumpPresses;
  state.jumpPresses = 0;

  if (state.hopping) {
    state.hopTime += dt;
    // Steer the leap in flight: a held arrow blends the velocity toward cruise
    // speed that way, so the hop tracks where you point and coasts when you let
    // go. It never outruns the cruise speed, so it won't blast past a log.
    if (input.moveX !== 0 || input.moveY !== 0) {
      const len = Math.hypot(input.moveX, input.moveY) || 1;
      const targetVX = (input.moveX / len) * RIVER_HOP_SPEED;
      const targetVY = (input.moveY / len) * RIVER_HOP_SPEED;
      const blend = Math.min(1, dt * RIVER_HOP_STEER);
      state.hopVX += (targetVX - state.hopVX) * blend;
      state.hopVY += (targetVY - state.hopVY) * blend;
    }
    player.x = clamp(player.x + state.hopVX * dt, RIVER_BANK_MIN_X, RIVER_RIGHT_BANK + RIVER_STEP_MARGIN);
    player.y = clamp(player.y + state.hopVY * dt, RIVER_TOP, RIVER_WATERFALL_Y + 4);
    player.vx = state.hopVX;
    player.vy = state.hopVY;
    player.facing = state.hopVX >= 0 ? 1 : -1;
    const t = clamp(state.hopTime / RIVER_HOP_TIME, 0, 1);
    state.hopLift = Math.sin(Math.PI * t) * RIVER_HOP_ARC;
    if (t >= 1) landHop(state, player, events);
    driftFreeLogs(state, dt);
    stepPiranhas(state, player, dt);
    state.furthestX = Math.max(state.furthestX, player.x);
    return events;
  }

  if (state.ridingLogId !== null) {
    const log = findLog(state, state.ridingLogId);
    if (!log) {
      lose(state, player, "piranha", events);
      driftFreeLogs(state, dt);
      stepPiranhas(state, player, dt);
      return events;
    }

    const spinInput = input.moveX;
    const previousSpinSign = Math.sign(log.spin);
    if (spinInput !== 0) {
      log.spin = clamp(log.spin + spinInput * RIVER_SPIN_ACCEL * dt, -RIVER_SPIN_MAX, RIVER_SPIN_MAX);
      if (Math.sign(log.spin) !== previousSpinSign && Math.sign(log.spin) === spinInput) {
        events.push({ type: "spin", direction: spinInput });
      }
    } else {
      log.spin *= Math.pow(RIVER_SPIN_DECAY, dt);
      if (Math.abs(log.spin) < 0.02) log.spin = 0;
    }

    const thrust = log.spin * RIVER_SPIN_THRUST;
    const vx = thrust * log.roll.x;
    // The current always wins: spin can only slow the fall, never reverse it.
    const vy = Math.max(RIVER_MIN_DRIFT, RIVER_CURRENT + thrust * log.roll.y);
    log.x = clamp(log.x + vx * dt, RIVER_LEFT_BANK - 6, RIVER_RIGHT_BANK + RIVER_STEP_MARGIN + 4);
    log.y = Math.max(RIVER_TOP, log.y + vy * dt);

    player.x = log.x;
    player.y = log.y;
    player.vx = vx;
    player.vy = vy;
    player.onGround = true;

    if (presses > 0) {
      beginHop(state, player, input, events);
      driftFreeLogs(state, dt);
      stepPiranhas(state, player, dt);
      state.furthestX = Math.max(state.furthestX, player.x);
      return events;
    }

    if (log.y >= RIVER_WATERFALL_Y) {
      player.y = log.y;
      lose(state, player, "waterfall", events);
      driftFreeLogs(state, dt);
      stepPiranhas(state, player, dt);
      return events;
    }

    if (log.x >= RIVER_RIGHT_BANK - RIVER_STEP_MARGIN) {
      win(state, player, events);
      driftFreeLogs(state, dt);
      stepPiranhas(state, player, dt);
      return events;
    }

    if (!state.warned && log.y >= RIVER_WATERFALL_Y - 78) {
      state.warned = true;
      events.push({ type: "warn" });
    } else if (state.warned && log.y < RIVER_WATERFALL_Y - 130) {
      state.warned = false;
    }
  } else if (state.onBank === "start") {
    // Walk the near bank freely to line up a jump.
    const targetVX = input.moveX * RIVER_BANK_WALK;
    const targetVY = input.moveY * RIVER_BANK_WALK;
    player.vx += (targetVX - player.vx) * Math.min(1, dt * 16);
    player.vy += (targetVY - player.vy) * Math.min(1, dt * 16);
    if (!input.moveX) player.vx *= Math.pow(0.02, dt);
    if (!input.moveY) player.vy *= Math.pow(0.02, dt);
    player.x = clamp(player.x + player.vx * dt, RIVER_BANK_MIN_X, RIVER_LEFT_BANK - 6);
    player.y = clamp(player.y + player.vy * dt, RIVER_BANK_MIN_Y, RIVER_BANK_MAX_Y);
    if (input.moveX) player.facing = input.moveX > 0 ? 1 : -1;
    player.onGround = true;
    if (presses > 0) beginHop(state, player, input, events);
  }

  driftFreeLogs(state, dt);
  stepPiranhas(state, player, dt);
  state.furthestX = Math.max(state.furthestX, player.x);
  return events;
}

function driftFreeLogs(state: RiverCourseState, dt: number) {
  for (const log of state.logs) {
    if (log.id === state.ridingLogId) continue;
    log.y += RIVER_CURRENT * dt;
    log.bob += dt * (1.4 + (log.id % 5) * 0.12);
  }
  // Recycle logs that have gone over the falls or wandered off.
  state.logs = state.logs.filter((log) => log.y < RIVER_WATERFALL_Y + 70 || log.id === state.ridingLogId);

  state.spawnTimer -= dt;
  const wantSpawn = state.spawnTimer <= 0 && state.logs.length < RIVER_MAX_LOGS;
  if (wantSpawn || state.logs.length < RIVER_MIN_LOGS) {
    state.logs.push(spawnLog(state, RIVER_TOP + 6 + nextRandom(state) * 24));
    state.spawnTimer = RIVER_SPAWN_INTERVAL;
  }
}

export function ridingLog(state: RiverCourseState) {
  return findLog(state, state.ridingLogId);
}

export function riverProgress(state: RiverCourseState) {
  const span = RIVER_RIGHT_BANK - RIVER_START_X;
  return clamp((state.furthestX - RIVER_START_X) / span, 0, 1);
}

// How much headroom is left before the falls, 1 at the source, 0 at the lip.
export function riverHeadroom(y: number) {
  return clamp((RIVER_WATERFALL_Y - y) / (RIVER_WATERFALL_Y - RIVER_TOP), 0, 1);
}
