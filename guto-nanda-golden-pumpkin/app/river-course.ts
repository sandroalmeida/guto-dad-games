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

// The current carries everything downstream at a steady crawl. Only a log spun
// the right way on the right angle can claw back the height it takes.
export const RIVER_CURRENT = 40;

// Spinning is a managed velocity: an arrow ramps the spin, the opposite arrow
// bleeds it off or reverses it, and letting go lets it wind down on its own.
export const RIVER_SPIN_ACCEL = 6.4;
export const RIVER_SPIN_MAX = 6.2;
export const RIVER_SPIN_DECAY = 0.5;
export const RIVER_SPIN_THRUST = 24;

export const RIVER_LOG_LENGTH = 120;
export const RIVER_LOG_RADIUS = 15;
export const RIVER_GRAB_RADIUS = 27;

// A hop is a short fixed arc; the current cannot touch you while you are in the
// air, but the log you are aiming for keeps drifting until you land on it.
export const RIVER_HOP_TIME = 0.42;
export const RIVER_HOP_ARC = 26;
export const RIVER_HOP_MIN_DX = 34;
export const RIVER_HOP_MAX_DX = 216;
export const RIVER_HOP_MAX_DY = 156;
export const RIVER_HOP_BLIND_DX = 150;
export const RIVER_HOP_BLIND_DY = 96;

export const RIVER_MAX_LOGS = 7;
export const RIVER_MIN_LOGS = 5;
export const RIVER_SPAWN_INTERVAL = 0.85;

// The mix of logs that float down. Forward spin on a log pushes the rider along
// its `roll` vector, so most logs carry you rightward (toward END); the
// climb-cross logs also fight the falls, the lone sink-cross log is a trap.
export const riverRollKinds = [
  { roll: { x: 1, y: 0 }, weight: 4, kind: "cross" },
  { roll: { x: 0.7071, y: -0.7071 }, weight: 4, kind: "climb" },
  { roll: { x: 0, y: -1 }, weight: 2, kind: "brake" },
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

export type RiverCourseState = {
  seed: number;
  elapsed: number;
  logs: RiverLog[];
  nextLogId: number;
  ridingLogId: number | null;
  onBank: BankSide | null;
  hopping: boolean;
  hopTime: number;
  hopFrom: RiverVec;
  hopTo: RiverVec;
  hopTargetId: number | null;
  hopLift: number;
  spawnTimer: number;
  jumpPresses: number;
  targetLogId: number | null;
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
  move: number;
  aim: number;
};

export type RiverEvent =
  | { type: "hop" }
  | { type: "board"; kind: RiverRollKind }
  | { type: "spin"; direction: number }
  | { type: "reach"; x: number }
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
    nextLogId: 0,
    ridingLogId: null,
    onBank: "start",
    hopping: false,
    hopTime: 0,
    hopFrom: { x: RIVER_START_X, y: RIVER_START_Y },
    hopTo: { x: RIVER_START_X, y: RIVER_START_Y },
    hopTargetId: null,
    hopLift: 0,
    spawnTimer: RIVER_SPAWN_INTERVAL,
    jumpPresses: 0,
    targetLogId: null,
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
    x: RIVER_LEFT_BANK + 82,
    y: RIVER_START_Y + 8,
    roll: { x: 0.7071, y: -0.7071 },
    kind: "climb",
    spin: 0,
    length: RIVER_LOG_LENGTH,
    radius: RIVER_LOG_RADIUS,
    bob: nextRandom(state) * Math.PI * 2,
  });
  state.nextLogId += 1;

  const rows = [90, 210, 300, 400, 470];
  for (const row of rows) {
    state.logs.push(spawnLog(state, row));
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

// The best log to hop onto: ahead of you and within a hop's reach, biased by the
// aim (up = upstream, down = downstream) so you can choose to climb or press on.
export function chooseHopTarget(state: RiverCourseState, fromX: number, fromY: number, aim: number) {
  let best: RiverLog | null = null;
  let bestScore = -Infinity;
  for (const log of state.logs) {
    if (log.id === state.ridingLogId) continue;
    const dx = log.x - fromX;
    const dy = log.y - fromY;
    if (dx < RIVER_HOP_MIN_DX || dx > RIVER_HOP_MAX_DX) continue;
    if (Math.abs(dy) > RIVER_HOP_MAX_DY) continue;
    // Prefer forward reach; reward matching the aim, punish being swept lower.
    let score = dx * 0.6 - Math.abs(dy) * 0.5;
    if (aim < 0) score -= dy * 1.2;
    else if (aim > 0) score += dy * 0.6;
    else score -= Math.max(0, dy) * 0.6;
    if (score > bestScore) {
      bestScore = score;
      best = log;
    }
  }
  return best;
}

function beginHop(state: RiverCourseState, player: RiverPlayer, aim: number, events: RiverEvent[]) {
  const target = chooseHopTarget(state, player.x, player.y, aim);
  const current = findLog(state, state.ridingLogId);
  // On the near bank with nothing in reach, a jump would only feed the piranhas
  // — hold your ground and wait for a log to drift into range instead.
  if (!current && !target) return;
  if (current) current.spin = 0;
  state.ridingLogId = null;
  state.onBank = null;
  state.hopping = true;
  state.hopTime = 0;
  state.hopLift = 0;
  state.hopFrom = { x: player.x, y: player.y };
  state.hopTargetId = target ? target.id : null;
  if (target) {
    state.hopTo = { x: target.x, y: target.y };
  } else {
    const aimY = aim === 0 ? 20 : aim * RIVER_HOP_BLIND_DY;
    state.hopTo = { x: player.x + RIVER_HOP_BLIND_DX, y: player.y + aimY };
  }
  state.hops += 1;
  player.facing = 1;
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
  const landing = state.hopTo;
  player.x = landing.x;
  player.y = landing.y;
  state.hopLift = 0;

  // The aimed-at log (still drifting) takes priority; then any log that happens
  // to sit under the landing point.
  const target = findLog(state, state.hopTargetId);
  if (target && logContains(target, landing.x, landing.y, RIVER_GRAB_RADIUS + 6)) {
    boardLog(state, player, target, events);
    return;
  }
  let covering: RiverLog | null = null;
  let coveringDist = Infinity;
  for (const log of state.logs) {
    if (logContains(log, landing.x, landing.y)) {
      const dist = Math.hypot(log.x - landing.x, log.y - landing.y);
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

  if (landing.x >= RIVER_RIGHT_BANK - RIVER_STEP_MARGIN && landing.y > RIVER_TOP - 20 && landing.y < RIVER_WATERFALL_Y) {
    win(state, player, events);
    return;
  }
  if (landing.x <= RIVER_LEFT_BANK + RIVER_STEP_MARGIN) {
    // Fell back to the start bank — no progress, but the piranhas missed.
    state.onBank = "start";
    state.hopping = false;
    player.x = clamp(landing.x, RIVER_START_X, RIVER_LEFT_BANK);
    player.y = clamp(landing.y, RIVER_TOP + 20, RIVER_WATERFALL_Y - 30);
    player.onGround = true;
    return;
  }
  lose(state, player, "piranha", events);
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
    state.logs.push(spawnLog(state, RIVER_TOP + 6 + nextRandom(state) * 26));
    state.spawnTimer = RIVER_SPAWN_INTERVAL;
  }
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
    if (state.lost && player.y < RIVER_BOTTOM) {
      player.y = Math.min(RIVER_BOTTOM, player.y + dt * 220);
    }
    driftFreeLogs(state, dt);
    return events;
  }

  const presses = state.jumpPresses;
  state.jumpPresses = 0;

  if (state.hopping) {
    state.hopTime += dt;
    // Keep tracking the target as it drifts downstream.
    const target = findLog(state, state.hopTargetId);
    if (target) {
      state.hopTo = { x: target.x, y: target.y };
    } else if (state.hopTargetId !== null) {
      state.hopTargetId = null;
    }
    const t = clamp(state.hopTime / RIVER_HOP_TIME, 0, 1);
    state.hopLift = Math.sin(Math.PI * t) * RIVER_HOP_ARC;
    player.x = state.hopFrom.x + (state.hopTo.x - state.hopFrom.x) * t;
    player.y = state.hopFrom.y + (state.hopTo.y - state.hopFrom.y) * t;
    player.facing = state.hopTo.x >= state.hopFrom.x ? 1 : -1;
    if (t >= 1) {
      landHop(state, player, events);
    }
    driftFreeLogs(state, dt);
    state.furthestX = Math.max(state.furthestX, player.x);
    state.targetLogId = null;
    return events;
  }

  if (state.ridingLogId !== null) {
    const log = findLog(state, state.ridingLogId);
    if (!log) {
      // Should not happen, but never leave the rider in limbo.
      lose(state, player, "piranha", events);
      driftFreeLogs(state, dt);
      return events;
    }

    const spinInput = input.move;
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
    const vy = RIVER_CURRENT + thrust * log.roll.y;
    log.x = clamp(log.x + vx * dt, RIVER_LEFT_BANK - 6, RIVER_RIGHT_BANK + RIVER_STEP_MARGIN + 4);
    log.y = Math.max(RIVER_TOP, log.y + vy * dt);

    player.x = log.x;
    player.y = log.y;
    player.vx = vx;
    player.vy = vy;
    player.onGround = true;

    if (jumpWanted(presses)) {
      beginHop(state, player, input.aim, events);
      driftFreeLogs(state, dt);
      state.furthestX = Math.max(state.furthestX, player.x);
      return events;
    }

    if (log.y >= RIVER_WATERFALL_Y) {
      player.y = log.y;
      lose(state, player, "waterfall", events);
      driftFreeLogs(state, dt);
      return events;
    }

    if (log.x >= RIVER_RIGHT_BANK - RIVER_STEP_MARGIN) {
      win(state, player, events);
      driftFreeLogs(state, dt);
      return events;
    }

    if (!state.warned && log.y >= RIVER_WATERFALL_Y - 70) {
      state.warned = true;
      events.push({ type: "warn" });
    } else if (state.warned && log.y < RIVER_WATERFALL_Y - 120) {
      state.warned = false;
    }
  } else if (state.onBank === "start") {
    player.x = RIVER_START_X;
    player.y = clamp(player.y, RIVER_TOP + 20, RIVER_WATERFALL_Y - 30);
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    if (jumpWanted(presses)) {
      beginHop(state, player, input.aim, events);
    }
  }

  driftFreeLogs(state, dt);
  state.furthestX = Math.max(state.furthestX, player.x);

  // A quiet hint for the renderer: which log a hop would grab right now.
  const preview = chooseHopTarget(state, player.x, player.y, input.aim);
  state.targetLogId = preview ? preview.id : null;

  return events;
}

function jumpWanted(presses: number) {
  return presses > 0;
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
