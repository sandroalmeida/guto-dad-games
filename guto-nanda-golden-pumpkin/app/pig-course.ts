export const PIG_WORLD_WIDTH = 1200;

// The valley: high ground (the ledges) on both sides, a floor full of pigs below.
export const PIG_FLOOR_Y = 548;
export const PIG_VALLEY_DEPTH = 126;
export const PIG_LEDGE_Y = PIG_FLOOR_Y - PIG_VALLEY_DEPTH;

// Pea-leg stilts are measured in wood: taller than the valley wall, plus some.
// Every bite chews a chunk off the bottom. Shorter than the wall and you can't
// climb out; shorter than the snap length and the splintered legs give way.
export const PIG_STILT_FULL = 192;
export const PIG_CLIMB_REACH = 12;
export const PIG_CLIMB_LENGTH = PIG_VALLEY_DEPTH - PIG_CLIMB_REACH;
export const PIG_STILT_SNAP = 70;
export const PIG_BITE_CHUNK = 11;
export const PIG_LOW_STILT = PIG_CLIMB_LENGTH + PIG_BITE_CHUNK * 2;

export const PIG_PLAYER_START_X = 96;
export const PIG_SAFE_LEFT = 158;
export const PIG_SAFE_RIGHT = 1046;
export const PIG_FINISH_X = PIG_SAFE_RIGHT;
export const PIG_CLIFF_MARGIN = 10;
export const PIG_VALLEY_LEFT = 172;
export const PIG_VALLEY_RIGHT = 1032;
export const PIG_LEFT_BOUND = 44;
export const PIG_RIGHT_BOUND = PIG_WORLD_WIDTH - 40;

export const PIG_WALK_SPEED = 176;
export const PIG_RUN_SPEED = 258;
export const PIG_AIR_STEER = 150;
export const PIG_GRAVITY = 1500;
export const PIG_HOP_VY = -430;
export const PIG_HOP_BOOST = 64;
// A vault is a pole-plant: high, but it never carries faster than a jog, so a
// run-up clears one boulder and lands with room to run at the next.
export const PIG_VAULT_VY = -650;
export const PIG_VAULT_BOOST = 40;
export const PIG_VAULT_MAX_VX = 240;
export const PIG_TIP_MARGIN = 15;
export const PIG_CLIMB_TIME = 0.35;

// Pigs: one boar per stretch of floor between the boulders (the last one
// patrols past the final rock to the cliff). They trot about, charge a walker
// who drops into their stretch, and bite planted stilts — but only one bite
// lands per grace window, each pig needs a moment to line up, and after a bite
// it stops to chew the splinter. Once the stilts are too short to climb out,
// the whole herd is loose.
export const PIG_TROT_SPEED = 56;
export const PIG_CHASE_SPEED = 210;
export const PIG_AGGRO = 200;
export const PIG_COUNT = 3;
export const PIG_BITE_RANGE = 30;
export const PIG_BITE_INTERVAL = 1.2;
export const PIG_BITE_WINDUP = 0.35;
export const PIG_BITE_GRACE = 0.5;
export const PIG_PLANT_GRACE = 0.2;
export const PIG_CHEW_TIME = 0.8;
export const PIG_STAGGER = 0.1;
export const PIG_PEN_GAP = 10;

export const pigBoulders = [
  { x: 415, width: 56, height: 98 },
  { x: 675, width: 60, height: 106 },
  { x: 915, width: 56, height: 98 },
] as const;

export type PigState = "roam" | "chase" | "chew";
export type PigLossReason = "stilts" | "trapped";
export type LedgeSide = "left" | "right";
export type Landing = "floor" | "boulder" | "ledge";

export type Pig = {
  id: number;
  x: number;
  vx: number;
  facing: number;
  state: PigState;
  pen: { left: number; right: number };
  biteCooldown: number;
  chewTimer: number;
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
  biteGrace: number;
  plantedTimer: number;
  staggerTimer: number;
  warned: boolean;
  trapped: boolean;
  tooShortBumps: number;
  bumpTimer: number;
  bumpNag: number;
  climbTimer: number;
  climbFrom: { x: number; y: number } | null;
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
  | { type: "land"; on: Landing }
  | { type: "blocked" }
  | { type: "bite"; pig: number; stilt: number }
  | { type: "warn" }
  | { type: "trapped" }
  | { type: "tooShort"; side: LedgeSide }
  | { type: "climb"; side: LedgeSide }
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

// The stretches of valley floor between the boulders; each one is home to a pig.
export function pigPens(boulders: readonly Boulder[]) {
  const edges = [
    PIG_VALLEY_LEFT,
    ...boulders.flatMap((boulder) => [boulder.x - PIG_PEN_GAP, boulder.x + boulder.width + PIG_PEN_GAP]),
    PIG_VALLEY_RIGHT,
  ];
  const pens: { left: number; right: number }[] = [];
  for (let index = 0; index + 1 < edges.length; index += 2) {
    pens.push({ left: edges[index], right: edges[index + 1] });
  }
  return pens;
}

export function makePigCourse(seed = 6): PigCourseState {
  const state: PigCourseState = {
    seed,
    elapsed: 0,
    pigs: [],
    boulders: pigBoulders.map((boulder) => ({ ...boulder })),
    stilt: PIG_STILT_FULL,
    bites: 0,
    biteFlash: 0,
    biteGrace: 0,
    plantedTimer: 0,
    staggerTimer: 0,
    warned: false,
    trapped: false,
    tooShortBumps: 0,
    bumpTimer: 0,
    bumpNag: 0,
    climbTimer: 0,
    climbFrom: null,
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

  const pens = pigPens(state.boulders);
  for (let index = 0; index < PIG_COUNT; index += 1) {
    const pen = { ...pens[Math.min(index, pens.length - 1)] };
    if (index === PIG_COUNT - 1) pen.right = pens[pens.length - 1].right;
    const span = pen.right - pen.left - 60;
    state.pigs.push({
      id: index,
      x: pen.left + 30 + nextRandom(state) * span,
      vx: 0,
      facing: nextRandom(state) < 0.5 ? -1 : 1,
      state: "roam",
      pen,
      biteCooldown: 0.4 + nextRandom(state) * 0.6,
      chewTimer: 0,
      turnTimer: 0.8 + nextRandom(state) * 2.4,
      trotPhase: nextRandom(state) * Math.PI * 2,
      size: 0.9 + nextRandom(state) * 0.28,
      tint: nextRandom(state),
      chompTimer: 0,
    });
  }
  return state;
}

// The stilt tips rest on whatever is under them; the explorer's feet ride
// `state.stilt` pixels above the tips. player.y tracks the tip line: the floor
// or a boulder top down in the valley, the ledge line up on the high ground.
export function boulderTop(boulder: Boulder) {
  return PIG_FLOOR_Y - boulder.height;
}

export function stiltFeetY(state: PigCourseState, tipY: number) {
  return tipY - state.stilt;
}

export function canClimbOut(state: PigCourseState) {
  return state.stilt >= PIG_CLIMB_LENGTH;
}

export function chunksBitten(state: PigCourseState) {
  return Math.round((PIG_STILT_FULL - state.stilt) / PIG_BITE_CHUNK);
}

function onLeftLedge(x: number) {
  return x <= PIG_SAFE_LEFT + PIG_CLIFF_MARGIN;
}

function onRightLedge(x: number) {
  return x >= PIG_SAFE_RIGHT - PIG_CLIFF_MARGIN;
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
    // On the ground the rock stops you dead; in the air the pole only scrapes
    // the side, so a vault keeps its forward speed for when the tips clear the top.
    if (previousX <= left && player.x > left && player.x < right + 40) {
      if (player.x > left) {
        player.x = left;
        if (player.onGround && player.vx > 40) events.push({ type: "blocked" });
        if (player.onGround) player.vx = Math.min(player.vx, 0);
      }
    } else if (previousX >= right && player.x < right && player.x > left - 40) {
      if (player.x < right) {
        player.x = right;
        if (player.onGround) player.vx = Math.max(player.vx, 0);
      }
    } else if (player.x > left && player.x < right) {
      const center = boulder.x + boulder.width / 2;
      player.x = player.x < center ? left : right;
      player.vx = 0;
    }
  }
}

function climbLedge(state: PigCourseState, player: PigPlayer, side: LedgeSide, events: PigEvent[]) {
  state.climbFrom = { x: player.x, y: player.y };
  state.climbTimer = PIG_CLIMB_TIME;
  player.x = side === "right" ? PIG_SAFE_RIGHT + 12 : PIG_SAFE_LEFT - 12;
  player.y = PIG_LEDGE_Y;
  player.vy = 0;
  player.vx = 0;
  player.onGround = true;
  state.airborne = false;
  events.push({ type: "climb", side });
}

// The cliff faces at both ends of the valley. Stilts at least as tall as the
// wall let the explorer step up onto the high ground; shorter stilts just bump
// the rock, on the ground or in the air.
function meetCliffs(
  state: PigCourseState,
  player: PigPlayer,
  previousX: number,
  move: number,
  events: PigEvent[],
) {
  const standingUpTop = player.onGround && player.y <= PIG_LEDGE_Y + 0.5;
  if (standingUpTop && (onLeftLedge(player.x) || onRightLedge(player.x))) return;
  const belowTop = player.y > PIG_LEDGE_Y + 0.5;
  const climbable = canClimbOut(state);
  const grounded = player.onGround;

  const rightLine = PIG_SAFE_RIGHT - PIG_CLIFF_MARGIN;
  const leftLine = PIG_SAFE_LEFT + PIG_CLIFF_MARGIN;
  const intoRight = (previousX <= rightLine && player.x > rightLine) || (grounded && player.x > rightLine && move > 0);
  const intoLeft = (previousX >= leftLine && player.x < leftLine) || (grounded && player.x < leftLine && move < 0);
  if (!intoRight && !intoLeft) return;
  const side: LedgeSide = intoRight ? "right" : "left";

  if (climbable) {
    if (belowTop) climbLedge(state, player, side, events);
    return;
  }

  // Thrown back off the rock face, a step inside the valley so the tips can
  // never come down on the ledge.
  player.x = side === "right" ? rightLine - 1 : leftLine + 1;
  player.vx = side === "right" ? Math.min(player.vx, 0) : Math.max(player.vx, 0);
  if (grounded && state.bumpNag <= 0) {
    state.bumpNag = 1.4;
    state.bumpTimer = 0.9;
    state.tooShortBumps += 1;
    events.push({ type: "tooShort", side });
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

function landOnLedge(state: PigCourseState, player: PigPlayer, previousTipY: number) {
  const overLedge = onLeftLedge(player.x) || onRightLedge(player.x);
  if (overLedge && player.vy > 0 && previousTipY <= PIG_LEDGE_Y && player.y >= PIG_LEDGE_Y) {
    player.y = PIG_LEDGE_Y;
    player.vy = 0;
    player.vx *= 0.6;
    player.onGround = true;
    state.airborne = false;
    return true;
  }
  return false;
}

function lose(state: PigCourseState, player: PigPlayer, pig: number | null, events: PigEvent[]) {
  state.lost = true;
  state.lossReason = state.tooShortBumps > 0 ? "trapped" : "stilts";
  state.catcher = pig;
  state.airborne = false;
  state.staggerTimer = 0;
  player.onGround = false;
  player.vx = 0;
  player.vy = 0;
  events.push({ type: "lost", reason: state.lossReason, pig });
}

function stepPig(
  state: PigCourseState,
  player: PigPlayer,
  pig: Pig,
  dt: number,
  chaseable: boolean,
  bitable: boolean,
) {
  pig.biteCooldown = Math.max(0, pig.biteCooldown - dt);
  pig.chompTimer = Math.max(0, pig.chompTimer - dt);

  if (pig.chewTimer > 0) {
    pig.chewTimer = Math.max(0, pig.chewTimer - dt);
    pig.state = "chew";
    pig.vx *= Math.pow(0.001, dt);
  } else {
    const distance = player.x - pig.x;
    const overPen = player.x > pig.pen.left - 24 && player.x < pig.pen.right + 24;
    const chasing = chaseable && overPen && Math.abs(distance) < PIG_AGGRO;
    if (chasing) {
      if (pig.state !== "chase") pig.biteCooldown = Math.max(pig.biteCooldown, PIG_BITE_WINDUP);
      pig.state = "chase";
      const dir = Math.sign(distance) || pig.facing;
      // Charge, then pull up beside the stilts and snap at them
      const arrived = Math.abs(distance) < PIG_BITE_RANGE * 0.8;
      const target = arrived ? 0 : PIG_CHASE_SPEED * dir;
      pig.vx += (target - pig.vx) * Math.min(1, dt * (arrived ? 10 : 4));
      pig.facing = arrived ? dir : Math.abs(pig.vx) > 12 ? (pig.vx > 0 ? 1 : -1) : pig.facing;
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
  }

  pig.x += pig.vx * dt;
  if (pig.x < pig.pen.left) {
    pig.x = pig.pen.left;
    pig.vx = Math.abs(pig.vx) * 0.5;
    pig.facing = 1;
  } else if (pig.x > pig.pen.right) {
    pig.x = pig.pen.right;
    pig.vx = -Math.abs(pig.vx) * 0.5;
    pig.facing = -1;
  }
  pig.trotPhase += dt * (6 + Math.abs(pig.vx) * 0.03);

  const lined = bitable && pig.state === "chase" && state.biteGrace <= 0 && state.plantedTimer >= PIG_PLANT_GRACE;
  if (lined && pig.biteCooldown <= 0 && Math.abs(player.x - pig.x) < PIG_BITE_RANGE) {
    pig.biteCooldown = PIG_BITE_INTERVAL;
    pig.chewTimer = PIG_CHEW_TIME;
    pig.chompTimer = 0.3;
    pig.state = "chew";
    pig.facing = player.x >= pig.x ? 1 : -1;
    state.biteGrace = PIG_BITE_GRACE;
    state.stilt = Math.max(0, state.stilt - PIG_BITE_CHUNK);
    state.bites += 1;
    state.biteFlash = 0.4;
    state.staggerTimer = PIG_STAGGER;
    return true;
  }
  return false;
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
  state.biteGrace = Math.max(0, state.biteGrace - dt);
  state.bumpNag = Math.max(0, state.bumpNag - dt);
  state.bumpTimer = Math.max(0, state.bumpTimer - dt);
  state.climbTimer = Math.max(0, state.climbTimer - dt);

  if (state.won || state.lost) {
    state.jumpPresses = 0;
    state.jumpWithHold = false;
    if (state.lost) {
      state.fallProgress = Math.min(1, state.fallProgress + dt * 2.4);
      if (player.y < PIG_FLOOR_Y) player.y = Math.min(PIG_FLOOR_Y, player.y + dt * 460);
    }
    state.pigs.forEach((pig) => stepPig(state, player, pig, dt, false, false));
    return events;
  }

  state.staggerTimer = Math.max(0, state.staggerTimer - dt);
  const presses = state.jumpPresses;
  const withHold = presses > 0 && (input.hold || state.jumpWithHold);
  state.jumpPresses = 0;
  state.jumpWithHold = false;

  const previousX = player.x;
  const previousTipY = player.y;
  const staggered = state.staggerTimer > 0;
  const move = staggered ? 0 : input.move;

  if (player.onGround) {
    const speed = input.run ? PIG_RUN_SPEED : PIG_WALK_SPEED;
    player.vx += (move * speed - player.vx) * Math.min(1, dt * 14);
    if (!move) player.vx *= Math.pow(0.02, dt);
    if (move) player.facing = move;
    player.x = clamp(player.x + player.vx * dt, PIG_LEFT_BOUND, PIG_RIGHT_BOUND);
    blockBoulders(state, player, previousX, events);
    meetCliffs(state, player, previousX, move, events);

    if (player.y <= PIG_LEDGE_Y + 0.5) {
      if (!onLeftLedge(player.x) && !onRightLedge(player.x)) {
        player.onGround = false;
        state.airborne = true;
      }
    } else if (player.y < PIG_FLOOR_Y - 0.5) {
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
        const forward = Math.max(0, player.vx * player.facing);
        player.vy = PIG_VAULT_VY;
        player.vx = player.facing * Math.min(forward + PIG_VAULT_BOOST, PIG_VAULT_MAX_VX);
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
    meetCliffs(state, player, previousX, move, events);

    if (!player.onGround) {
      player.y += player.vy * dt;
      if (player.vy > 0 && landOnLedge(state, player, previousTipY)) {
        events.push({ type: "land", on: "ledge" });
      } else if (player.vy > 0 && landOnBoulder(state, player, previousTipY)) {
        events.push({ type: "land", on: "boulder" });
      } else if (player.y >= PIG_FLOOR_Y) {
        player.y = PIG_FLOOR_Y;
        player.vy = 0;
        player.vx *= 0.6;
        player.onGround = true;
        state.airborne = false;
        events.push({ type: "land", on: "floor" });
      }
    }
  }

  state.furthest = Math.max(state.furthest, player.x);

  const inValley = player.x > PIG_SAFE_LEFT && player.x < PIG_SAFE_RIGHT;
  const planted = player.onGround && player.y >= PIG_FLOOR_Y - 0.5;
  const onRock = player.onGround && !planted && inValley;
  const chaseable = inValley && !onRock;
  const bitable = inValley && planted;
  state.plantedTimer = bitable ? state.plantedTimer + dt : 0;

  let biter: number | null = null;
  state.pigs.forEach((pig) => {
    if (stepPig(state, player, pig, dt, chaseable, bitable) && biter === null) biter = pig.id;
  });

  if (biter !== null) {
    events.push({ type: "bite", pig: biter, stilt: state.stilt });
    if (!state.warned && state.stilt <= PIG_LOW_STILT && canClimbOut(state)) {
      state.warned = true;
      events.push({ type: "warn" });
    }
    if (!state.trapped && !canClimbOut(state) && state.stilt > PIG_STILT_SNAP) {
      state.trapped = true;
      // The herd knows: every pig leaves its stretch and closes in.
      state.pigs.forEach((pig) => {
        pig.pen = { left: PIG_VALLEY_LEFT, right: PIG_VALLEY_RIGHT };
      });
      events.push({ type: "trapped" });
    }
    if (state.stilt <= PIG_STILT_SNAP) {
      lose(state, player, biter, events);
      return events;
    }
  }

  if (player.onGround && player.y <= PIG_LEDGE_Y + 0.5 && player.x >= PIG_FINISH_X) {
    state.won = true;
    events.push({ type: "won" });
  }

  return events;
}
