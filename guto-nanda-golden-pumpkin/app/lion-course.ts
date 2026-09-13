export const LION_WORLD_WIDTH = 1200;

// The savanna: open golden grass between the rocky trail-head on the left and
// the pumpkin shrine on the right. Three acacia trees stand between them, each
// with one low branch — the only cover from the lion.
export const LION_GROUND_Y = 548;
export const LION_BRANCH_HEIGHT = 128;
export const LION_BRANCH_Y = LION_GROUND_Y - LION_BRANCH_HEIGHT;
// Where the explorer's hands are while hanging, measured up from the feet.
export const LION_HANG_REACH = 76;
export const LION_CATCH_WINDOW = 18;

export const LION_PLAYER_START_X = 84;
export const LION_SAFE_LEFT = 150;
export const LION_SAFE_RIGHT = 1058;
export const LION_FINISH_X = 1104;
export const LION_LEFT_BOUND = 40;
export const LION_RIGHT_BOUND = LION_WORLD_WIDTH - 44;
export const LION_TERRITORY_LEFT = 196;
export const LION_TERRITORY_RIGHT = 1024;

export const LION_WALK_SPEED = 182;
export const LION_RUN_SPEED = 262;
export const LION_BRANCH_WALK_SPEED = 118;
export const LION_AIR_STEER = 170;
export const LION_GRAVITY = 1500;
export const LION_JUMP_VY = -480;
export const LION_JUMP_BOOST = 50;
export const LION_CLIMB_TIME = 0.3;
export const LION_TO_HANG_TIME = 0.2;

// The lion: slow while it prowls, faster than a running explorer once it
// charges. It only charges what it can see — something on the ground or
// hanging from a branch, in front of its nose — and once its prey is up a tree
// it paces beneath, roars, and after a while loses interest and wanders off.
export const LION_PROWL_SPEED = 66;
export const LION_LEAVE_SPEED = 98;
export const LION_CHASE_SPEED = 318;
export const LION_SIGHT = 560;
export const LION_NOSE = 44;
export const LION_ALERT_TIME = 0.5;
export const LION_WAIT_ALERT_TIME = 0.16;
export const LION_CATCH_RANGE = 38;
export const LION_LEAP_RANGE = 52;
export const LION_PATIENCE = 3.6;
export const LION_PATIENCE_JITTER = 0.8;
export const LION_LOOK_MIN = 0.9;
export const LION_LOOK_MAX = 2.0;
export const LION_ROAM_MIN_LEG = 170;
export const LION_ROAM_AWAY_BIAS = 0.62;
export const LION_PACE_SPAN = 26;
export const LION_PACE_SPEED = 130;
export const LION_ARRIVE_RANGE = 30;
export const LION_START_X = 905;
export const LION_LOW_AIR = 64;

export const lionTrees = [
  { x: 338, span: 72, crown: 96 },
  { x: 604, span: 76, crown: 104 },
  { x: 866, span: 72, crown: 98 },
] as const;

export type LionTree = { x: number; span: number; crown: number };
export type LionMood = "prowl" | "look" | "alert" | "chase" | "wait" | "leave" | "pounce";
export type PerchMode = "ground" | "hang" | "climbing" | "perched" | "lowering";
export type LionLossReason = "ground" | "hanging";

export type Lion = {
  x: number;
  vx: number;
  facing: number;
  mood: LionMood;
  timer: number;
  targetX: number;
  waitX: number;
  patience: number;
  roarTimer: number;
  roarFlash: number;
  alertFlash: number;
  stride: number;
  leapT: number;
};

export type LionCourseState = {
  seed: number;
  elapsed: number;
  trees: LionTree[];
  lion: Lion;
  perch: PerchMode;
  perchTree: number | null;
  perchTimer: number;
  canGrab: boolean;
  jumpPresses: number;
  furthest: number;
  seen: boolean;
  seenTimer: number;
  exposedTimer: number;
  safeTimer: number;
  climbs: number;
  chases: number;
  escapes: number;
  landFlash: number;
  won: boolean;
  lost: boolean;
  lossReason: LionLossReason | null;
  celebrate: number;
};

export type LionPlayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
};

export type LionInput = {
  move: number;
  run: boolean;
  up: boolean;
  down: boolean;
};

export type LionEvent =
  | { type: "jump" }
  | { type: "catch"; tree: number }
  | { type: "climb"; tree: number }
  | { type: "hang"; tree: number }
  | { type: "drop" }
  | { type: "land"; safe: boolean }
  | { type: "alert" }
  | { type: "chase" }
  | { type: "wait"; tree: number | null }
  | { type: "roar" }
  | { type: "leave"; direction: number }
  | { type: "escape" }
  | { type: "won" }
  | { type: "lost"; reason: LionLossReason };

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

export function makeLionCourse(seed = 8): LionCourseState {
  return {
    seed,
    elapsed: 0,
    trees: lionTrees.map((tree) => ({ ...tree })),
    lion: {
      x: LION_START_X,
      vx: 0,
      facing: -1,
      mood: "look",
      timer: 1.4,
      targetX: LION_START_X,
      waitX: LION_START_X,
      patience: 0,
      roarTimer: 0,
      roarFlash: 0,
      alertFlash: 0,
      stride: 0,
      leapT: 0,
    },
    perch: "ground",
    perchTree: null,
    perchTimer: 0,
    canGrab: false,
    jumpPresses: 0,
    furthest: LION_PLAYER_START_X,
    seen: false,
    seenTimer: 0,
    exposedTimer: 0,
    safeTimer: 0,
    climbs: 0,
    chases: 0,
    escapes: 0,
    landFlash: 0,
    won: false,
    lost: false,
    lossReason: null,
    celebrate: 0,
  };
}

export function inSafeZone(x: number) {
  return x <= LION_SAFE_LEFT || x >= LION_SAFE_RIGHT;
}

// Standing on a branch is the only real safety; hanging beneath one is not.
export function isSheltered(state: LionCourseState) {
  return state.perch === "perched";
}

export function isExposed(state: LionCourseState, player: LionPlayer) {
  if (state.won || state.lost) return false;
  if (isSheltered(state)) return false;
  return !inSafeZone(player.x);
}

export function lionFacesPlayer(lion: Lion, player: LionPlayer) {
  const dx = player.x - lion.x;
  return Math.abs(dx) < LION_NOSE || Math.sign(dx) === Math.sign(lion.facing);
}

export function lionSeesPlayer(state: LionCourseState, player: LionPlayer) {
  if (!isExposed(state, player)) return false;
  const dx = player.x - state.lion.x;
  return Math.abs(dx) < LION_SIGHT && lionFacesPlayer(state.lion, player);
}

export function branchOf(state: LionCourseState, x: number) {
  for (let index = 0; index < state.trees.length; index += 1) {
    const tree = state.trees[index];
    if (Math.abs(x - tree.x) <= tree.span) return index;
  }
  return null;
}

export function nearestTreeIndex(state: LionCourseState, x: number) {
  let best = 0;
  state.trees.forEach((tree, index) => {
    if (Math.abs(tree.x - x) < Math.abs(state.trees[best].x - x)) best = index;
  });
  return best;
}

export function lionProgress(state: LionCourseState) {
  return clamp((state.furthest - LION_PLAYER_START_X) / (LION_FINISH_X - LION_PLAYER_START_X), 0, 1);
}

export function patienceLeft(state: LionCourseState) {
  return state.lion.mood === "wait" ? Math.max(0, state.lion.patience) : 0;
}

function startWait(state: LionCourseState, waitX: number, events: LionEvent[]) {
  const lion = state.lion;
  lion.mood = "wait";
  lion.waitX = clamp(waitX, LION_TERRITORY_LEFT, LION_TERRITORY_RIGHT);
  lion.targetX = lion.waitX;
  lion.patience = LION_PATIENCE + (nextRandom(state) - 0.5) * 2 * LION_PATIENCE_JITTER;
  lion.roarTimer = 0.25;
  const tree = branchOf(state, waitX);
  events.push({ type: "wait", tree });
}

function startChase(state: LionCourseState, events: LionEvent[]) {
  const lion = state.lion;
  if (lion.mood !== "chase") {
    state.chases += 1;
    events.push({ type: "chase" });
  }
  lion.mood = "chase";
}

function startAlert(state: LionCourseState, player: LionPlayer, delay: number, events: LionEvent[]) {
  const lion = state.lion;
  lion.mood = "alert";
  lion.timer = delay;
  lion.alertFlash = 0.8;
  lion.facing = player.x >= lion.x ? 1 : -1;
  events.push({ type: "alert" });
}

function startLeave(state: LionCourseState, player: LionPlayer, events: LionEvent[]) {
  const lion = state.lion;
  // Wanders off to some other spot on its ground, mostly away from its prey.
  lion.mood = "leave";
  lion.targetX = pickRoamTarget(state, player.x);
  lion.facing = lion.targetX >= lion.x ? 1 : -1;
  events.push({ type: "leave", direction: lion.facing });
  if (isSheltered(state)) {
    state.escapes += 1;
    events.push({ type: "escape" });
  }
}

// A prowling lion never spins round mid-stride: it picks a spot on its
// ground, walks there, stops to look about, and only then sets off somewhere
// else — so a lion that has stopped is the one about to look your way.
function pickRoamTarget(state: LionCourseState, awayFrom: number | null) {
  const lion = state.lion;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const x = LION_TERRITORY_LEFT + nextRandom(state) * (LION_TERRITORY_RIGHT - LION_TERRITORY_LEFT);
    if (Math.abs(x - lion.x) < LION_ROAM_MIN_LEG) continue;
    if (awayFrom !== null && Math.sign(x - lion.x) === Math.sign(awayFrom - lion.x) && nextRandom(state) < LION_ROAM_AWAY_BIAS) continue;
    return x;
  }
  return lion.x < (LION_TERRITORY_LEFT + LION_TERRITORY_RIGHT) / 2 ? LION_TERRITORY_RIGHT - 40 : LION_TERRITORY_LEFT + 40;
}

function startProwl(state: LionCourseState, awayFrom: number | null) {
  const lion = state.lion;
  lion.mood = "prowl";
  lion.targetX = pickRoamTarget(state, awayFrom);
  lion.facing = lion.targetX >= lion.x ? 1 : -1;
}

function startLook(state: LionCourseState) {
  const lion = state.lion;
  lion.mood = "look";
  lion.timer = LION_LOOK_MIN + nextRandom(state) * (LION_LOOK_MAX - LION_LOOK_MIN);
}

function stepLion(state: LionCourseState, player: LionPlayer, dt: number, events: LionEvent[]) {
  const lion = state.lion;
  lion.roarFlash = Math.max(0, lion.roarFlash - dt);
  lion.alertFlash = Math.max(0, lion.alertFlash - dt);

  if (state.won) {
    // The prize is gone; the lion slinks back to its shade.
    const target = LION_TERRITORY_RIGHT - 120;
    const dir = Math.sign(target - lion.x);
    if (Math.abs(target - lion.x) > 6) {
      lion.facing = dir;
      lion.vx += (LION_PROWL_SPEED * dir - lion.vx) * Math.min(1, dt * 4);
    } else {
      lion.vx *= Math.pow(0.001, dt);
    }
    lion.x += lion.vx * dt;
    lion.stride += dt * (4 + Math.abs(lion.vx) * 0.05);
    return;
  }
  if (state.lost) {
    lion.leapT = Math.min(1, lion.leapT + dt * 2.2);
    lion.vx *= Math.pow(0.001, dt);
    return;
  }

  const sees = lionSeesPlayer(state, player);
  const exposed = isExposed(state, player);

  switch (lion.mood) {
    case "prowl": {
      if (sees) {
        startAlert(state, player, LION_ALERT_TIME, events);
        break;
      }
      const remaining = lion.targetX - lion.x;
      if (Math.abs(remaining) < 6) {
        lion.vx *= 0.5;
        startLook(state);
        break;
      }
      lion.facing = remaining >= 0 ? 1 : -1;
      lion.vx += (LION_PROWL_SPEED * lion.facing - lion.vx) * Math.min(1, dt * 5);
      break;
    }
    case "look": {
      if (sees) {
        startAlert(state, player, LION_ALERT_TIME, events);
        break;
      }
      lion.timer -= dt;
      lion.vx *= Math.pow(0.002, dt);
      // Halfway through the pause it may glance the other way
      if (lion.timer <= 0) startProwl(state, null);
      break;
    }
    case "alert": {
      lion.vx *= Math.pow(0.001, dt);
      lion.timer -= dt;
      if (!exposed || lion.timer <= 0) {
        // Even prey that vanished up a tree gets investigated.
        startChase(state, events);
      }
      break;
    }
    case "chase": {
      // Prey that went up a tree or onto the rocks still gets run down to the
      // spot where it vanished; the lion paces there once it arrives.
      const goal = exposed
        ? player.x
        : isSheltered(state)
          ? state.trees[state.perchTree ?? nearestTreeIndex(state, player.x)].x
          : clamp(player.x, LION_TERRITORY_LEFT, LION_TERRITORY_RIGHT);
      const dx = goal - lion.x;
      if (!exposed && Math.abs(dx) < LION_ARRIVE_RANGE) {
        startWait(state, goal, events);
        break;
      }
      const dir = Math.sign(dx) || lion.facing;
      lion.facing = dir;
      const target = LION_CHASE_SPEED * dir;
      lion.vx += (target - lion.vx) * Math.min(1, dt * 6);
      break;
    }
    case "wait": {
      if (exposed && lionFacesPlayer(lion, player)) {
        startAlert(state, player, LION_WAIT_ALERT_TIME, events);
        break;
      }
      lion.patience -= dt;
      lion.roarTimer -= dt;
      if (lion.roarTimer <= 0) {
        lion.roarTimer = 1.1 + nextRandom(state) * 0.7;
        lion.roarFlash = 0.5;
        events.push({ type: "roar" });
      }
      // Pace beneath the branch, always glancing up at the prey.
      const pace = lion.waitX + Math.sin(state.elapsed * 2.1) * LION_PACE_SPAN;
      const pull = clamp((pace - lion.x) * 6, -LION_PACE_SPEED, LION_PACE_SPEED);
      lion.vx += (pull - lion.vx) * Math.min(1, dt * 8);
      lion.facing = player.x >= lion.x ? 1 : -1;
      if (lion.patience <= 0) startLeave(state, player, events);
      break;
    }
    case "leave": {
      if (sees) {
        startAlert(state, player, LION_ALERT_TIME, events);
        break;
      }
      const remaining = lion.targetX - lion.x;
      if (Math.abs(remaining) < 6) {
        lion.vx *= 0.5;
        startLook(state);
        break;
      }
      lion.facing = remaining >= 0 ? 1 : -1;
      lion.vx += (LION_LEAVE_SPEED * lion.facing - lion.vx) * Math.min(1, dt * 4);
      break;
    }
    case "pounce":
      break;
  }

  lion.x += lion.vx * dt;
  if (lion.x < LION_TERRITORY_LEFT) {
    lion.x = LION_TERRITORY_LEFT;
    lion.vx = Math.max(0, lion.vx) * 0.3;
  } else if (lion.x > LION_TERRITORY_RIGHT) {
    lion.x = LION_TERRITORY_RIGHT;
    lion.vx = Math.min(0, lion.vx) * 0.3;
  }
  lion.stride += dt * (4 + Math.abs(lion.vx) * 0.05);
}

function lose(state: LionCourseState, player: LionPlayer, reason: LionLossReason, events: LionEvent[]) {
  state.lost = true;
  state.lossReason = reason;
  state.lion.mood = "pounce";
  state.lion.leapT = 0;
  state.lion.facing = player.x >= state.lion.x ? 1 : -1;
  state.perch = "ground";
  state.perchTree = null;
  player.vx = 0;
  player.vy = 0;
  player.y = LION_GROUND_Y;
  player.onGround = true;
  events.push({ type: "lost", reason });
}

function tryCatchBranch(state: LionCourseState, player: LionPlayer, events: LionEvent[]) {
  if (!state.canGrab || player.onGround) return false;
  const handsY = player.y - LION_HANG_REACH;
  if (Math.abs(handsY - LION_BRANCH_Y) > LION_CATCH_WINDOW) return false;
  const tree = branchOf(state, player.x);
  if (tree === null) return false;
  state.perch = "hang";
  state.perchTree = tree;
  state.canGrab = false;
  player.y = LION_BRANCH_Y + LION_HANG_REACH;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  events.push({ type: "catch", tree });
  return true;
}

export function stepLionCourse(
  state: LionCourseState,
  player: LionPlayer,
  input: LionInput,
  dt: number,
): LionEvent[] {
  const events: LionEvent[] = [];
  state.elapsed += dt;
  state.landFlash = Math.max(0, state.landFlash - dt);

  if (state.won || state.lost) {
    state.jumpPresses = 0;
    if (state.won) state.celebrate = Math.min(1, state.celebrate + dt * 0.5);
    stepLion(state, player, dt, events);
    return events;
  }

  const presses = state.jumpPresses;
  state.jumpPresses = 0;

  switch (state.perch) {
    case "ground": {
      if (player.onGround) {
        const speed = input.run ? LION_RUN_SPEED : LION_WALK_SPEED;
        player.vx += (input.move * speed - player.vx) * Math.min(1, dt * 14);
        if (!input.move) player.vx *= Math.pow(0.02, dt);
        if (input.move) player.facing = input.move;
        player.x = clamp(player.x + player.vx * dt, LION_LEFT_BOUND, LION_RIGHT_BOUND);
        if (presses > 0) {
          player.vy = LION_JUMP_VY;
          player.vx += player.facing * (input.move ? LION_JUMP_BOOST : 0);
          player.onGround = false;
          state.canGrab = true;
          events.push({ type: "jump" });
        }
      } else {
        if (input.move) {
          player.vx += input.move * LION_AIR_STEER * dt;
          player.vx = clamp(player.vx, -LION_RUN_SPEED - 40, LION_RUN_SPEED + 40);
          player.facing = input.move;
        }
        player.vy += LION_GRAVITY * dt;
        player.x = clamp(player.x + player.vx * dt, LION_LEFT_BOUND, LION_RIGHT_BOUND);
        player.y += player.vy * dt;
        if (!tryCatchBranch(state, player, events) && player.y >= LION_GROUND_Y) {
          player.y = LION_GROUND_Y;
          player.vy = 0;
          player.vx *= 0.7;
          player.onGround = true;
          state.canGrab = false;
          state.landFlash = 0.25;
          events.push({ type: "land", safe: inSafeZone(player.x) });
        }
      }
      break;
    }
    case "hang": {
      player.onGround = false;
      player.vx = 0;
      player.vy = 0;
      player.y = LION_BRANCH_Y + LION_HANG_REACH;
      if (input.move) player.facing = input.move;
      if (presses > 0) {
        // Let go: a short drop to the grass, no catching on the way down.
        state.perch = "ground";
        state.perchTree = null;
        state.canGrab = false;
        player.vy = 40;
        events.push({ type: "drop" });
      } else if (input.up) {
        state.perch = "climbing";
        state.perchTimer = LION_CLIMB_TIME;
      }
      break;
    }
    case "climbing": {
      // Still hanging (and still catchable) until the climb finishes.
      player.onGround = false;
      player.vx = 0;
      player.vy = 0;
      state.perchTimer -= dt;
      const t = 1 - Math.max(0, state.perchTimer) / LION_CLIMB_TIME;
      player.y = LION_BRANCH_Y + LION_HANG_REACH * (1 - t);
      if (state.perchTimer <= 0) {
        state.perch = "perched";
        player.y = LION_BRANCH_Y;
        state.climbs += 1;
        events.push({ type: "climb", tree: state.perchTree ?? 0 });
      }
      break;
    }
    case "perched": {
      const tree = state.trees[state.perchTree ?? 0];
      player.onGround = true;
      player.vy = 0;
      player.y = LION_BRANCH_Y;
      player.vx += (input.move * LION_BRANCH_WALK_SPEED - player.vx) * Math.min(1, dt * 14);
      if (!input.move) player.vx *= Math.pow(0.02, dt);
      if (input.move) player.facing = input.move;
      player.x = clamp(player.x + player.vx * dt, tree.x - tree.span, tree.x + tree.span);
      if (input.down) {
        state.perch = "lowering";
        state.perchTimer = LION_TO_HANG_TIME;
        player.vx = 0;
        player.onGround = false;
      }
      break;
    }
    case "lowering": {
      player.onGround = false;
      player.vx = 0;
      player.vy = 0;
      state.perchTimer -= dt;
      const t = 1 - Math.max(0, state.perchTimer) / LION_TO_HANG_TIME;
      player.y = LION_BRANCH_Y + LION_HANG_REACH * t;
      if (state.perchTimer <= 0) {
        state.perch = "hang";
        player.y = LION_BRANCH_Y + LION_HANG_REACH;
        events.push({ type: "hang", tree: state.perchTree ?? 0 });
      }
      break;
    }
  }

  state.furthest = Math.max(state.furthest, player.x);

  stepLion(state, player, dt, events);

  const exposed = isExposed(state, player);
  state.exposedTimer = exposed ? state.exposedTimer + dt : 0;
  state.safeTimer = exposed ? 0 : state.safeTimer + dt;
  state.seen = lionSeesPlayer(state, player) || state.lion.mood === "chase" || state.lion.mood === "alert";
  state.seenTimer = state.seen ? state.seenTimer + dt : 0;

  // The pounce: prey on the grass within reach, or dangling within a leap.
  if (exposed && state.lion.mood === "chase") {
    const dx = Math.abs(player.x - state.lion.x);
    const hanging = state.perch === "hang" || state.perch === "climbing" || state.perch === "lowering";
    if (hanging && dx < LION_LEAP_RANGE) {
      lose(state, player, "hanging", events);
      return events;
    }
    if (!hanging && dx < LION_CATCH_RANGE && player.y >= LION_GROUND_Y - LION_LOW_AIR) {
      lose(state, player, "ground", events);
      return events;
    }
  }

  if (state.perch === "ground" && player.onGround && player.x >= LION_FINISH_X) {
    state.won = true;
    state.lion.mood = "look";
    events.push({ type: "won" });
  }

  return events;
}
