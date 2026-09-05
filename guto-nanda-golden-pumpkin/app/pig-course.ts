export const PIG_WORLD_WIDTH = 1200;
export const PIG_GROUND_Y = 548;
export const PIG_STILT_HEIGHT = 84;
export const PIG_PLAYER_START_X = 96;
export const PIG_FINISH_X = 1122;
export const PIG_SAFE_LEFT = 158;
export const PIG_SAFE_RIGHT = 1046;
export const PIG_VALLEY_LEFT = 168;
export const PIG_VALLEY_RIGHT = 1034;
export const PIG_LEFT_BOUND = 44;
export const PIG_RIGHT_BOUND = PIG_WORLD_WIDTH - 40;

export const PIG_WALK_SPEED = 176;
export const PIG_RUN_SPEED = 258;
export const PIG_AIR_STEER = 150;
export const PIG_GRAVITY = 1500;
export const PIG_HOP_VY = -430;
export const PIG_HOP_BOOST = 64;
export const PIG_VAULT_VY = -650;
export const PIG_VAULT_BOOST = 118;
export const PIG_TIP_MARGIN = 15;

export const PIG_MAX_STILT = 1;
export const PIG_BITE_DAMAGE = 0.16;
export const PIG_BITE_INTERVAL = 0.55;
export const PIG_BITE_RANGE = 34;
export const PIG_STAGGER = 0.16;
export const PIG_LOW_STILT = 0.34;

export const PIG_TROT_SPEED = 74;
export const PIG_CHASE_SPEED = 214;
export const PIG_AGGRO = 306;
export const PIG_COUNT = 5;

export const pigBoulders = [
  { x: 356, width: 56, height: 98 },
  { x: 606, width: 60, height: 106 },
  { x: 858, width: 56, height: 98 },
] as const;

export type PigState = "roam" | "chase";
export type PigLossReason = "stilts";

export type Pig = {
  id: number;
  x: number;
  vx: number;
  facing: number;
  state: PigState;
  biteCooldown: number;
  turnTimer: number;
  trotPhase: number;
  size: number;
  tint: number;
  chompTimer: number;
};

export type Boulder = { x: number; width: number; height: number };

export type PigCourseState = {
  seed: number;
  elapsed: number;
  pigs: Pig[];
  boulders: Boulder[];
  stilt: number;
  bites: number;
  biteFlash: number;
  staggerTimer: number;
  warned: boolean;
  furthest: number;
  jumpPresses: number;
  jumpWithHold: boolean;
  airborne: boolean;
  lastJump: "hop" | "vault" | null;
  hops: number;
  vaults: number;
  fallProgress: number;
  won: boolean;
  lost: boolean;
  lossReason: PigLossReason | null;
  catcher: number | null;
};

export type PigPlayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
};

export type PigInput = {
  move: number;
  run: boolean;
  hold: boolean;
};

export type PigEvent =
  | { type: "hop" }
  | { type: "vault" }
  | { type: "land"; onBoulder: boolean }
  | { type: "blocked" }
  | { type: "bite"; pig: number; stilt: number }
  | { type: "warn" }
  | { type: "won" }
  | { type: "lost"; reason: PigLossReason; pig: number | null };

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

export function makePigCourse(seed = 6): PigCourseState {
  const state: PigCourseState = {
    seed,
    elapsed: 0,
    pigs: [],
    boulders: pigBoulders.map((boulder) => ({ ...boulder })),
    stilt: PIG_MAX_STILT,
    bites: 0,
    biteFlash: 0,
    staggerTimer: 0,
    warned: false,
    furthest: PIG_PLAYER_START_X,
    jumpPresses: 0,
    jumpWithHold: false,
    airborne: false,
    lastJump: null,
    hops: 0,
    vaults: 0,
    fallProgress: 0,
    won: false,
    lost: false,
    lossReason: null,
    catcher: null,
  };

  const lanes = PIG_VALLEY_RIGHT - PIG_VALLEY_LEFT;
  for (let index = 0; index < PIG_COUNT; index += 1) {
    const spot = PIG_VALLEY_LEFT + lanes * ((index + 0.5) / PIG_COUNT);
    state.pigs.push({
      id: index,
      x: spot + (nextRandom(state) - 0.5) * 60,
      vx: 0,
      facing: nextRandom(state) < 0.5 ? -1 : 1,
      state: "roam",
      biteCooldown: 0.3 + nextRandom(state) * 0.6,
      turnTimer: 0.8 + nextRandom(state) * 2.4,
      trotPhase: nextRandom(state) * Math.PI * 2,
      size: 0.9 + nextRandom(state) * 0.28,
      tint: nextRandom(state),
      chompTimer: 0,
    });
  }
  return state;
}

// The stilt tips rest on the ground; the body rides PIG_STILT_HEIGHT above them.
// player.y tracks the tip line: PIG_GROUND_Y when grounded, lifting as the rig jumps.
export function boulderTop(boulder: Boulder) {
  return PIG_GROUND_Y - boulder.height;
}

function blockBoulders(
  state: PigCourseState,
  player: PigPlayer,
  previousX: number,
  events: PigEvent[],
) {
  for (const boulder of state.boulders) {
    const top = boulderTop(boulder);
    const standingOnThis = player.onGround && Math.abs(player.y - top) < 0.6;
    const solid = !standingOnThis && (player.onGround || player.y > top + 0.5);
    if (!solid) continue;
    const left = boulder.x - PIG_TIP_MARGIN;
    const right = boulder.x + boulder.width + PIG_TIP_MARGIN;
    if (previousX <= left && player.x > left && player.x < right + 40) {
      if (player.x > left) {
        player.x = left;
        if (player.onGround && player.vx > 40) events.push({ type: "blocked" });
        player.vx = Math.min(player.vx, 0);
      }
    } else if (previousX >= right && player.x < right && player.x > left - 40) {
      if (player.x < right) {
        player.x = right;
        player.vx = Math.max(player.vx, 0);
      }
    } else if (player.x > left && player.x < right) {
      const center = boulder.x + boulder.width / 2;
      player.x = player.x < center ? left : right;
      player.vx = 0;
    }
  }
}

function landOnBoulder(state: PigCourseState, player: PigPlayer, previousTipY: number) {
  for (const boulder of state.boulders) {
    const top = boulderTop(boulder);
    const withinX = player.x > boulder.x - PIG_TIP_MARGIN && player.x < boulder.x + boulder.width + PIG_TIP_MARGIN;
    if (withinX && player.vy > 0 && previousTipY <= top && player.y >= top) {
      player.y = top;
      player.vy = 0;
      player.vx *= 0.5;
      player.onGround = true;
      state.airborne = false;
      return true;
    }
  }
  return false;
}

function lose(state: PigCourseState, player: PigPlayer, pig: number | null, events: PigEvent[]) {
  state.lost = true;
  state.lossReason = "stilts";
  state.catcher = pig;
  state.airborne = false;
  state.staggerTimer = 0;
  player.onGround = false;
  player.vx = 0;
  player.vy = 0;
  events.push({ type: "lost", reason: "stilts", pig });
}

function stepPig(state: PigCourseState, player: PigPlayer, pig: Pig, dt: number, vulnerable: boolean) {
  pig.biteCooldown = Math.max(0, pig.biteCooldown - dt);
  pig.chompTimer = Math.max(0, pig.chompTimer - dt);
  const distance = player.x - pig.x;
  const chasing = vulnerable && Math.abs(distance) < PIG_AGGRO;

  if (chasing) {
    pig.state = "chase";
    const dir = Math.sign(distance) || pig.facing;
    const target = PIG_CHASE_SPEED * dir;
    pig.vx += (target - pig.vx) * Math.min(1, dt * 6);
    if (Math.abs(pig.vx) > 12) pig.facing = pig.vx > 0 ? 1 : -1;
  } else {
    pig.state = "roam";
    pig.turnTimer -= dt;
    if (pig.turnTimer <= 0) {
      pig.facing = nextRandom(state) < 0.5 ? -1 : 1;
      pig.turnTimer = 1.4 + nextRandom(state) * 2.6;
    }
    const target = PIG_TROT_SPEED * pig.facing;
    pig.vx += (target - pig.vx) * Math.min(1, dt * 3);
  }

  pig.x += pig.vx * dt;
  if (pig.x < PIG_VALLEY_LEFT) {
    pig.x = PIG_VALLEY_LEFT;
    pig.vx = Math.abs(pig.vx);
    pig.facing = 1;
  } else if (pig.x > PIG_VALLEY_RIGHT) {
    pig.x = PIG_VALLEY_RIGHT;
    pig.vx = -Math.abs(pig.vx);
    pig.facing = -1;
  }
  pig.trotPhase += dt * (6 + Math.abs(pig.vx) * 0.03);

  const planted = player.onGround && player.y >= PIG_GROUND_Y - 0.5;
  if (vulnerable && planted && pig.biteCooldown <= 0 && Math.abs(player.x - pig.x) < PIG_BITE_RANGE) {
    pig.biteCooldown = PIG_BITE_INTERVAL;
    pig.chompTimer = 0.24;
    state.stilt = Math.max(0, state.stilt - PIG_BITE_DAMAGE);
    state.bites += 1;
    state.biteFlash = 0.4;
    state.staggerTimer = PIG_STAGGER;
    return { bit: true, stilt: state.stilt };
  }
  return { bit: false, stilt: state.stilt };
}

export function stepPigCourse(
  state: PigCourseState,
  player: PigPlayer,
  input: PigInput,
  dt: number,
): PigEvent[] {
  const events: PigEvent[] = [];
  state.elapsed += dt;
  state.biteFlash = Math.max(0, state.biteFlash - dt);

  if (state.won || state.lost) {
    state.jumpPresses = 0;
    state.jumpWithHold = false;
    if (state.lost) {
      state.fallProgress = Math.min(1, state.fallProgress + dt * 2.4);
      if (player.y < PIG_GROUND_Y) player.y = Math.min(PIG_GROUND_Y, player.y + dt * 460);
    }
    state.pigs.forEach((pig) => stepPig(state, player, pig, dt, false));
    return events;
  }

  state.staggerTimer = Math.max(0, state.staggerTimer - dt);
  const presses = state.jumpPresses;
  const withHold = presses > 0 && (input.hold || state.jumpWithHold);
  state.jumpPresses = 0;
  state.jumpWithHold = false;

  const previousX = player.x;
  const previousTipY = player.y;

  if (player.onGround) {
    const staggered = state.staggerTimer > 0;
    const move = staggered ? 0 : input.move;
    const speed = input.run ? PIG_RUN_SPEED : PIG_WALK_SPEED;
    player.vx += (move * speed - player.vx) * Math.min(1, dt * 14);
    if (!move) player.vx *= Math.pow(0.02, dt);
    if (move) player.facing = move;
    player.x = clamp(player.x + player.vx * dt, PIG_LEFT_BOUND, PIG_RIGHT_BOUND);
    blockBoulders(state, player, previousX, events);

    if (player.y < PIG_GROUND_Y - 0.5) {
      const supported = state.boulders.some((boulder) => {
        const top = boulderTop(boulder);
        return (
          Math.abs(player.y - top) < 0.6 &&
          player.x > boulder.x - PIG_TIP_MARGIN &&
          player.x < boulder.x + boulder.width + PIG_TIP_MARGIN
        );
      });
      if (!supported) {
        player.onGround = false;
        state.airborne = true;
      }
    }

    if (presses > 0 && !staggered && player.onGround) {
      if (player.facing === 0) player.facing = 1;
      if (withHold) {
        player.vy = PIG_VAULT_VY;
        player.vx += player.facing * PIG_VAULT_BOOST;
        state.lastJump = "vault";
        state.vaults += 1;
        events.push({ type: "vault" });
      } else {
        player.vy = PIG_HOP_VY;
        player.vx += player.facing * PIG_HOP_BOOST;
        state.lastJump = "hop";
        state.hops += 1;
        events.push({ type: "hop" });
      }
      player.onGround = false;
      state.airborne = true;
    }
  } else {
    if (input.move) {
      player.vx += input.move * PIG_AIR_STEER * dt;
      player.vx = clamp(player.vx, -PIG_RUN_SPEED - 40, PIG_RUN_SPEED + 40);
      player.facing = input.move;
    }
    player.vy += PIG_GRAVITY * dt;
    player.x = clamp(player.x + player.vx * dt, PIG_LEFT_BOUND, PIG_RIGHT_BOUND);
    blockBoulders(state, player, previousX, events);
    player.y += player.vy * dt;

    if (player.vy > 0 && landOnBoulder(state, player, previousTipY)) {
      events.push({ type: "land", onBoulder: true });
    } else if (player.y >= PIG_GROUND_Y) {
      player.y = PIG_GROUND_Y;
      player.vy = 0;
      player.vx *= 0.6;
      player.onGround = true;
      state.airborne = false;
      events.push({ type: "land", onBoulder: false });
    }
  }

  state.furthest = Math.max(state.furthest, player.x);

  const onSafeLedge = player.x <= PIG_SAFE_LEFT || player.x >= PIG_SAFE_RIGHT;
  const vulnerable = !state.won && !state.lost && !onSafeLedge;

  let biter: number | null = null;
  state.pigs.forEach((pig) => {
    const result = stepPig(state, player, pig, dt, vulnerable);
    if (result.bit && biter === null) biter = pig.id;
  });

  if (biter !== null) {
    events.push({ type: "bite", pig: biter, stilt: state.stilt });
    if (!state.warned && state.stilt <= PIG_LOW_STILT && state.stilt > 0) {
      state.warned = true;
      events.push({ type: "warn" });
    }
    if (state.stilt <= 0) {
      lose(state, player, biter, events);
      return events;
    }
  }

  if (player.onGround && player.y >= PIG_GROUND_Y - 0.5 && player.x >= PIG_FINISH_X) {
    state.won = true;
    events.push({ type: "won" });
  }

  return events;
}
