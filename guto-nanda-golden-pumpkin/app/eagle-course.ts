export const EAGLE_WORLD_WIDTH = 1200;
export const EAGLE_GROUND_Y = 536;
export const EAGLE_SAFE_LEFT = 215;
export const EAGLE_SAFE_RIGHT = 985;
export const EAGLE_FINISH_X = 1112;
export const EAGLE_HOLD_LIMIT = 3;
export const EAGLE_MAX_HEALTH = 100;
export const EAGLE_TALON_DAMAGE = 25;
export const EAGLE_FRUIT_HEAL = 15;
export const EAGLE_REACH = 40;
export const EAGLE_EAT_TIME = 0.6;
export const EAGLE_STRUGGLE_PER_PRESS = 0.2;
export const EAGLE_STRUGGLE_DECAY = 0.22;
export const EAGLE_MAX_RODENTS = 8;
export const EAGLE_LAND_DAZE = 0.6;
export const EAGLE_THIRD_EAGLE_X = 560;

export type EagleMode =
  | "circle"
  | "lock"
  | "dive"
  | "carryPrey"
  | "carryPlayer"
  | "retreat"
  | "away";

export type EagleTarget = { kind: "player" } | { kind: "rodent"; id: number } | null;

export type Eagle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  mode: EagleMode;
  timer: number;
  cooldown: number;
  awayTime: number;
  fedByPlayer: boolean;
  homeX: number;
  anchorX: number;
  anchorY: number;
  orbit: number;
  orbitDir: number;
  spread: number;
  approach: number;
  lockTime: number;
  diveSpeed: number;
  scale: number;
  tint: number;
  phase: number;
  target: EagleTarget;
  dormant: boolean;
};

export type Rodent = {
  id: number;
  x: number;
  vx: number;
  pause: number;
  nextPause: number;
  phase: number;
  size: number;
};

export type Fruit = {
  id: number;
  x: number;
  kind: number;
};

export type Carried =
  | { kind: "rodent"; phase: number; size: number }
  | { kind: "fruit"; fruitKind: number };

export type EagleLossReason = "carried" | "health";

export type EagleCourseState = {
  seed: number;
  nextId: number;
  eagles: Eagle[];
  rodents: Rodent[];
  fruits: Fruit[];
  carrying: Carried | null;
  overhead: boolean;
  eatProgress: number;
  health: number;
  caughtBy: number | null;
  holdTime: number;
  struggle: number;
  escapeGrace: number;
  landRecovery: number;
  spacePresses: number;
  spawnTimer: number;
  spawnSide: number;
  diveRest: number;
  preyFed: number;
  catches: number;
  won: boolean;
  lost: boolean;
  lossReason: EagleLossReason | null;
};

export type EaglePlayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
};

export type EagleInput = {
  move: number;
  run: boolean;
  hold: boolean;
};

export type EagleEvent =
  | { type: "pickup"; item: "rodent" | "fruit" }
  | { type: "drop"; item: "rodent" | "fruit" }
  | { type: "reachMiss" }
  | { type: "eat" }
  | { type: "lock"; eagle: number; onPlayer: boolean }
  | { type: "dive"; eagle: number; onPlayer: boolean }
  | { type: "preyTaken"; eagle: number }
  | { type: "rodentHunted"; eagle: number }
  | { type: "caught"; eagle: number; droppedItem: "rodent" | "fruit" | null }
  | { type: "struggle" }
  | { type: "escaped" }
  | { type: "landed" }
  | { type: "miss"; eagle: number }
  | { type: "thirdEagle"; eagle: number }
  | { type: "won" }
  | { type: "lost"; reason: EagleLossReason };

export const EAGLE_WALK_SPEED = 175;
export const EAGLE_RUN_SPEED = 250;
export const EAGLE_BURDENED_SPEED = 100;
export const EAGLE_CARRY_DRIFT = 260;

const eagleProfiles = [
  { homeX: 360, anchorY: 104, spread: -190, lockTime: 0.85, diveSpeed: 600, scale: 1, tint: 0, orbitDir: 1, cooldown: 0.6 },
  { homeX: 840, anchorY: 128, spread: 210, lockTime: 0.72, diveSpeed: 660, scale: 0.92, tint: 1, orbitDir: -1, cooldown: 1.9 },
  { homeX: 590, anchorY: 150, spread: 20, lockTime: 0.62, diveSpeed: 720, scale: 1.08, tint: 2, orbitDir: 1, cooldown: 3.3 },
] as const;

function leadTarget(
  eagle: Eagle,
  target: { x: number; vx: number },
  aimY: number,
) {
  const flight = Math.hypot(target.x - eagle.x, aimY - eagle.y) / eagle.diveSpeed;
  return target.x + target.vx * clamp(flight, 0, 0.9);
}

function nextRandom(state: { seed: number }) {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function makeEagleCourse(seed = 7): EagleCourseState {
  const state: EagleCourseState = {
    seed,
    nextId: 1,
    eagles: [],
    rodents: [],
    fruits: [],
    carrying: null,
    overhead: false,
    eatProgress: 0,
    health: EAGLE_MAX_HEALTH,
    caughtBy: null,
    holdTime: 0,
    struggle: 0,
    escapeGrace: 0,
    landRecovery: 0,
    spacePresses: 0,
    spawnTimer: 1.2,
    spawnSide: 1,
    diveRest: 0,
    preyFed: 0,
    catches: 0,
    won: false,
    lost: false,
    lossReason: null,
  };

  state.eagles = eagleProfiles.map((profile, index) => ({
    id: index,
    x: profile.homeX,
    y: profile.anchorY,
    vx: 0,
    vy: 0,
    facing: profile.orbitDir,
    mode: "circle",
    timer: 0,
    cooldown: profile.cooldown,
    awayTime: 0,
    fedByPlayer: false,
    homeX: profile.homeX,
    anchorX: profile.homeX,
    anchorY: profile.anchorY,
    orbit: index * 2.1,
    orbitDir: profile.orbitDir,
    spread: profile.spread,
    approach: 1,
    lockTime: profile.lockTime,
    diveSpeed: profile.diveSpeed,
    scale: profile.scale,
    tint: profile.tint,
    phase: index * 1.9,
    target: null,
    dormant: index === 2,
  }));

  for (let i = 0; i < 7; i += 1) {
    const direction = nextRandom(state) < 0.5 ? -1 : 1;
    const speed = 60 + nextRandom(state) * 60;
    state.rodents.push({
      id: state.nextId++,
      x: i === 0 ? 180 : 300 + (i - 1) * 118 + nextRandom(state) * 40,
      vx: i === 0 ? 45 : direction * speed,
      pause: 0,
      nextPause: 1 + nextRandom(state) * 2.5,
      phase: nextRandom(state) * Math.PI * 2,
      size: 0.9 + nextRandom(state) * 0.25,
    });
  }

  [372, 512, 655, 790, 918].forEach((x, index) => {
    state.fruits.push({ id: state.nextId++, x, kind: index % 3 });
  });

  return state;
}

export function playerExposed(state: EagleCourseState, player: EaglePlayer) {
  return (
    player.x > EAGLE_SAFE_LEFT &&
    player.x < EAGLE_SAFE_RIGHT &&
    player.onGround &&
    state.caughtBy === null &&
    state.escapeGrace <= 0 &&
    state.landRecovery <= 0
  );
}

export function eagleHunting(eagle: Eagle) {
  return eagle.mode === "lock" || eagle.mode === "dive" || eagle.mode === "carryPlayer";
}

export function threateningEagle(state: EagleCourseState) {
  return (
    state.eagles.find(
      (eagle) =>
        (eagle.mode === "lock" || eagle.mode === "dive") &&
        eagle.target?.kind === "player",
    ) ?? null
  );
}

function seek(
  eagle: Eagle,
  targetX: number,
  targetY: number,
  maxSpeed: number,
  accel: number,
  dt: number,
) {
  const dx = targetX - eagle.x;
  const dy = targetY - eagle.y;
  const distance = Math.hypot(dx, dy) || 1;
  const desiredSpeed = Math.min(maxSpeed, distance * 2.2);
  const desiredVx = (dx / distance) * desiredSpeed;
  const desiredVy = (dy / distance) * desiredSpeed;
  eagle.vx += (desiredVx - eagle.vx) * Math.min(1, dt * accel);
  eagle.vy += (desiredVy - eagle.vy) * Math.min(1, dt * accel);
  eagle.x += eagle.vx * dt;
  eagle.y += eagle.vy * dt;
}

function settleFacing(eagle: Eagle) {
  if (Math.abs(eagle.vx) > 14) eagle.facing = eagle.vx > 0 ? 1 : -1;
}

function startCircling(state: EagleCourseState, eagle: Eagle, cooldown: number) {
  eagle.mode = "circle";
  eagle.timer = 0;
  eagle.target = null;
  eagle.cooldown = cooldown;
  eagle.orbit = 0;
  eagle.anchorX = clamp(eagle.x - 105, 130, 1070);
}

function startRetreat(eagle: Eagle) {
  eagle.mode = "retreat";
  eagle.timer = 0;
  eagle.target = null;
  eagle.vy = Math.min(eagle.vy, -220);
}

function dropCarried(state: EagleCourseState, player: EaglePlayer) {
  const carried = state.carrying;
  if (!carried) return null;
  state.carrying = null;
  state.overhead = false;
  state.eatProgress = 0;
  if (carried.kind === "rodent") {
    state.rodents.push({
      id: state.nextId++,
      x: player.x + player.facing * 22,
      vx: player.facing * 110,
      pause: 0,
      nextPause: 1.4 + nextRandom(state) * 1.5,
      phase: carried.phase,
      size: carried.size,
    });
  } else {
    state.fruits.push({
      id: state.nextId++,
      x: clamp(player.x + player.facing * 20, 40, EAGLE_WORLD_WIDTH - 40),
      kind: carried.fruitKind,
    });
  }
  return carried.kind;
}

function releasePlayer(state: EagleCourseState, player: EaglePlayer, eagle: Eagle) {
  state.caughtBy = null;
  state.holdTime = 0;
  state.struggle = 0;
  state.escapeGrace = 0.9;
  state.diveRest = Math.max(state.diveRest, 0.8);
  eagle.vx = eagle.facing * 220;
  eagle.vy = -240;
  startRetreat(eagle);
  state.eagles.forEach((other) => {
    if (other !== eagle && other.mode === "circle") {
      other.cooldown = Math.min(other.cooldown, 0.25);
    }
  });
  player.vy = 30;
  player.vx = eagle.vx * 0.4;
  player.onGround = false;
}

function targetPosition(
  state: EagleCourseState,
  player: EaglePlayer,
  target: EagleTarget,
) {
  if (!target) return null;
  if (target.kind === "player") {
    if (!playerExposed(state, player)) return null;
    return { x: player.x, vx: player.vx };
  }
  const rodent = state.rodents.find((candidate) => candidate.id === target.id);
  if (!rodent) return null;
  return { x: rodent.x, vx: rodent.pause > 0 ? 0 : rodent.vx };
}

function stepEagle(
  state: EagleCourseState,
  player: EaglePlayer,
  eagle: Eagle,
  dt: number,
  events: EagleEvent[],
) {
  if (eagle.dormant) {
    if (player.x > EAGLE_THIRD_EAGLE_X && playerExposed(state, player)) {
      eagle.dormant = false;
      eagle.x = player.x + eagle.spread;
      eagle.y = -70;
      eagle.vx = 0;
      eagle.vy = 160;
      startCircling(state, eagle, 0.9);
      events.push({ type: "thirdEagle", eagle: eagle.id });
    }
    return;
  }
  eagle.timer += dt;

  if (eagle.mode === "circle") {
    eagle.cooldown = Math.max(0, eagle.cooldown - dt);
    eagle.orbit += dt * 0.75 * eagle.orbitDir;
    const exposed = playerExposed(state, player);
    const desiredAnchor = exposed
      ? clamp(player.x + eagle.spread, 270, 930)
      : eagle.homeX;
    eagle.anchorX += (desiredAnchor - eagle.anchorX) * Math.min(1, dt * 0.9);
    seek(
      eagle,
      eagle.anchorX + Math.cos(eagle.orbit) * 105,
      eagle.anchorY + Math.sin(eagle.orbit * 2) * 16,
      250,
      2.6,
      dt,
    );
    settleFacing(eagle);

    const someoneHuntingPlayer = state.eagles.some(
      (other) =>
        other.mode === "carryPlayer" ||
        (eagleHunting(other) && other.target?.kind === "player"),
    );
    if (eagle.cooldown > 0 || state.diveRest > 0 || someoneHuntingPlayer) return;

    if (exposed) {
      eagle.mode = "lock";
      eagle.timer = 0;
      eagle.target = { kind: "player" };
      eagle.approach = eagle.x < player.x ? 1 : -1;
      events.push({ type: "lock", eagle: eagle.id, onPlayer: true });
      return;
    }

    const playerSheltered =
      player.x <= EAGLE_SAFE_LEFT || player.x >= EAGLE_SAFE_RIGHT;
    const someoneHuntingRodents = state.eagles.some(
      (other) => other !== eagle && other.target?.kind === "rodent",
    );
    const openRodents = state.rodents.filter(
      (rodent) => rodent.x > 260 && rodent.x < 940,
    );
    if (
      playerSheltered &&
      !someoneHuntingRodents &&
      openRodents.length >= 4 &&
      nextRandom(state) < 0.55
    ) {
      const prey = openRodents[Math.floor(nextRandom(state) * openRodents.length)];
      eagle.mode = "lock";
      eagle.timer = 0;
      eagle.target = { kind: "rodent", id: prey.id };
      eagle.approach = eagle.x < prey.x ? 1 : -1;
      events.push({ type: "lock", eagle: eagle.id, onPlayer: false });
      return;
    }
    eagle.cooldown = 0.25;
    return;
  }

  if (eagle.mode === "lock") {
    if (
      eagle.target?.kind === "rodent" &&
      playerExposed(state, player) &&
      !state.eagles.some(
        (other) =>
          other.mode === "carryPlayer" ||
          (eagleHunting(other) && other.target?.kind === "player"),
      )
    ) {
      eagle.target = { kind: "player" };
      eagle.timer = 0;
      eagle.approach = eagle.x < player.x ? 1 : -1;
      events.push({ type: "lock", eagle: eagle.id, onPlayer: true });
    }
    const target = targetPosition(state, player, eagle.target);
    if (!target) {
      startRetreat(eagle);
      return;
    }
    const hoverX = clamp(target.x - eagle.approach * 240, 40, EAGLE_WORLD_WIDTH - 40);
    const hoverY = 112 + eagle.id * 14;
    seek(eagle, hoverX, hoverY, 470, 5, dt);
    eagle.facing = eagle.approach;
    if (eagle.timer >= eagle.lockTime) {
      const onPlayer = eagle.target?.kind === "player";
      eagle.mode = "dive";
      eagle.timer = 0;
      const aimY = onPlayer ? EAGLE_GROUND_Y - 62 : EAGLE_GROUND_Y - 12;
      const dx = leadTarget(eagle, target, aimY) - eagle.x;
      const dy = aimY - eagle.y;
      const distance = Math.hypot(dx, dy) || 1;
      eagle.vx = (dx / distance) * eagle.diveSpeed * 0.6;
      eagle.vy = (dy / distance) * eagle.diveSpeed * 0.6;
      events.push({ type: "dive", eagle: eagle.id, onPlayer });
    }
    return;
  }

  if (eagle.mode === "dive") {
    const target = targetPosition(state, player, eagle.target);
    if (!target) {
      startRetreat(eagle);
      return;
    }
    const onPlayer = eagle.target?.kind === "player";
    const aimY = onPlayer
      ? state.overhead
        ? EAGLE_GROUND_Y - 100
        : EAGLE_GROUND_Y - 62
      : EAGLE_GROUND_Y - 12;
    const aimX = leadTarget(eagle, target, aimY);
    const dx = aimX - eagle.x;
    const dy = aimY - eagle.y;
    const distance = Math.hypot(dx, dy) || 1;
    const committed = clamp((eagle.y - (EAGLE_GROUND_Y - 230)) / 170, 0, 1);
    const homing = 4.2 - committed * 3.5;
    eagle.vx += ((dx / distance) * eagle.diveSpeed - eagle.vx) * Math.min(1, dt * homing);
    eagle.vy += ((dy / distance) * eagle.diveSpeed - eagle.vy) * Math.min(1, dt * homing);
    eagle.x += eagle.vx * dt;
    eagle.y += eagle.vy * dt;
    settleFacing(eagle);

    const talonX = eagle.x;
    const talonY = eagle.y + 18;
    if (onPlayer) {
      const hit = Math.hypot(talonX - player.x, talonY - (player.y - 58)) < 48;
      if (hit) {
        state.diveRest = 0.5 + nextRandom(state) * 0.6;
        if (state.overhead && state.carrying?.kind === "rodent") {
          state.carrying = null;
          state.overhead = false;
          state.preyFed += 1;
          eagle.mode = "carryPrey";
          eagle.fedByPlayer = true;
          eagle.timer = 0;
          eagle.target = null;
          eagle.vy = -300;
          eagle.vx = eagle.approach * 240;
          events.push({ type: "preyTaken", eagle: eagle.id });
        } else {
          const droppedItem = dropCarried(state, player);
          state.health = Math.max(0, state.health - EAGLE_TALON_DAMAGE);
          state.catches += 1;
          state.caughtBy = eagle.id;
          state.holdTime = 0;
          state.struggle = 0;
          eagle.mode = "carryPlayer";
          eagle.timer = 0;
          eagle.target = null;
          eagle.vy = -200;
          eagle.vx = eagle.approach * 140;
          player.onGround = false;
          events.push({ type: "caught", eagle: eagle.id, droppedItem });
          if (state.health <= 0) {
            state.lost = true;
            state.lossReason = "health";
            events.push({ type: "lost", reason: "health" });
          }
        }
        return;
      }
    } else {
      const rodent = state.rodents.find((candidate) => candidate.id === (eagle.target as { id: number }).id);
      if (rodent && Math.hypot(talonX - rodent.x, talonY - (EAGLE_GROUND_Y - 8)) < 42) {
        state.rodents = state.rodents.filter((candidate) => candidate !== rodent);
        eagle.mode = "carryPrey";
        eagle.fedByPlayer = false;
        eagle.timer = 0;
        eagle.target = null;
        eagle.vy = -300;
        eagle.vx = eagle.approach * 240;
        events.push({ type: "rodentHunted", eagle: eagle.id });
        return;
      }
    }

    if (eagle.y >= EAGLE_GROUND_Y - 26 || eagle.timer > 1.5) {
      state.diveRest = 0.35 + nextRandom(state) * 0.4;
      if (onPlayer) events.push({ type: "miss", eagle: eagle.id });
      startRetreat(eagle);
    }
    return;
  }

  if (eagle.mode === "retreat") {
    seek(eagle, eagle.x + eagle.facing * 380, 96, 400, 3, dt);
    settleFacing(eagle);
    if ((eagle.y < 150 && eagle.timer > 0.5) || eagle.timer > 2.2) {
      startCircling(state, eagle, 1.7 + nextRandom(state) * 1.3);
    }
    return;
  }

  if (eagle.mode === "carryPrey") {
    seek(eagle, eagle.x + eagle.approach * 500, -160, 340, 2.5, dt);
    settleFacing(eagle);
    if (eagle.y < -110) {
      eagle.mode = "away";
      eagle.timer = 0;
      eagle.awayTime = eagle.fedByPlayer
        ? 2.6 + nextRandom(state) * 2
        : 0.8 + nextRandom(state) * 0.8;
    }
    return;
  }

  if (eagle.mode === "away") {
    if (eagle.timer >= eagle.awayTime) {
      eagle.x = 200 + nextRandom(state) * 800;
      eagle.y = -60;
      eagle.vx = 0;
      eagle.vy = 140;
      eagle.anchorY = 90 + nextRandom(state) * 60;
      startCircling(state, eagle, 1.4 + nextRandom(state) * 1.2);
    }
    return;
  }

  if (eagle.mode === "carryPlayer") {
    const targetY = 150;
    eagle.vy += ((targetY - eagle.y) * 2.4 - eagle.vy) * Math.min(1, dt * 3);
    eagle.vy = clamp(eagle.vy, -380, 200);
    const drift = eagle.x < 110 ? EAGLE_CARRY_DRIFT : -EAGLE_CARRY_DRIFT;
    eagle.vx += (drift - eagle.vx) * Math.min(1, dt * 1.8);
    eagle.x = clamp(eagle.x + eagle.vx * dt, 60, EAGLE_WORLD_WIDTH - 60);
    eagle.y = Math.max(100, eagle.y + eagle.vy * dt);
    settleFacing(eagle);
    player.x = eagle.x + eagle.facing * 2;
    player.y = eagle.y + 96;
    player.vx = eagle.vx;
    player.vy = eagle.vy;
    player.facing = eagle.facing;
    player.onGround = false;
  }
}

export function stepEagleCourse(
  state: EagleCourseState,
  player: EaglePlayer,
  input: EagleInput,
  dt: number,
): EagleEvent[] {
  const events: EagleEvent[] = [];
  if (state.won || state.lost) {
    state.spacePresses = 0;
    return events;
  }

  state.escapeGrace = Math.max(0, state.escapeGrace - dt);
  state.diveRest = Math.max(0, state.diveRest - dt);
  state.landRecovery = Math.max(0, state.landRecovery - dt);
  const presses = state.spacePresses;
  state.spacePresses = 0;

  if (state.caughtBy !== null) {
    const captor = state.eagles.find((eagle) => eagle.id === state.caughtBy)!;
    if (presses > 0) {
      state.struggle += presses * EAGLE_STRUGGLE_PER_PRESS;
      events.push({ type: "struggle" });
    }
    state.struggle = Math.max(0, state.struggle - EAGLE_STRUGGLE_DECAY * dt);
    state.holdTime += dt;
    if (state.struggle >= 1) {
      releasePlayer(state, player, captor);
      events.push({ type: "escaped" });
    } else if (state.holdTime >= EAGLE_HOLD_LIMIT) {
      state.lost = true;
      state.lossReason = "carried";
      events.push({ type: "lost", reason: "carried" });
      return events;
    }
  } else {
    const carrying = state.carrying;
    state.overhead = input.hold && carrying?.kind === "rodent";
    const slow = input.hold && carrying !== null;

    if (player.onGround) {
      const dazed = state.landRecovery > 0;
      const move = dazed ? 0 : input.move;
      const speed = slow
        ? EAGLE_BURDENED_SPEED
        : input.run
          ? EAGLE_RUN_SPEED
          : EAGLE_WALK_SPEED;
      player.vx += (move * speed - player.vx) * Math.min(1, dt * 14);
      if (!move) player.vx *= Math.pow(0.018, dt);
      if (move) player.facing = move;
      player.x = clamp(player.x + player.vx * dt, 22, EAGLE_WORLD_WIDTH - 22);
      player.y = EAGLE_GROUND_Y;
      player.vy = 0;
    } else {
      if (input.move) {
        player.vx = clamp(player.vx + input.move * 600 * dt, -300, 300);
        player.facing = input.move;
      }
      player.vy += 1150 * dt;
      player.x = clamp(player.x + player.vx * dt, 22, EAGLE_WORLD_WIDTH - 22);
      player.y += player.vy * dt;
      if (player.y >= EAGLE_GROUND_Y) {
        player.y = EAGLE_GROUND_Y;
        player.vy = 0;
        player.vx *= 0.4;
        player.onGround = true;
        state.landRecovery = EAGLE_LAND_DAZE;
        events.push({ type: "landed" });
      }
    }

    if (presses > 0 && player.onGround && state.landRecovery <= 0) {
      if (carrying) {
        const dropped = dropCarried(state, player);
        if (dropped) events.push({ type: "drop", item: dropped });
      } else {
        const candidates: { distance: number; pick: () => Carried }[] = [];
        state.rodents.forEach((rodent) => {
          const distance = Math.abs(rodent.x - player.x);
          if (distance < EAGLE_REACH) {
            candidates.push({
              distance,
              pick: () => {
                state.rodents = state.rodents.filter((candidate) => candidate !== rodent);
                return { kind: "rodent", phase: rodent.phase, size: rodent.size };
              },
            });
          }
        });
        state.fruits.forEach((fruit) => {
          const distance = Math.abs(fruit.x - player.x);
          if (distance < EAGLE_REACH) {
            candidates.push({
              distance,
              pick: () => {
                state.fruits = state.fruits.filter((candidate) => candidate !== fruit);
                return { kind: "fruit", fruitKind: fruit.kind };
              },
            });
          }
        });
        candidates.sort((a, b) => a.distance - b.distance);
        if (candidates.length > 0) {
          state.carrying = candidates[0].pick();
          state.eatProgress = 0;
          events.push({ type: "pickup", item: state.carrying.kind });
        } else {
          events.push({ type: "reachMiss" });
        }
      }
    }

    if (input.hold && state.carrying?.kind === "fruit" && player.onGround) {
      state.eatProgress += dt / EAGLE_EAT_TIME;
      if (state.eatProgress >= 1) {
        state.carrying = null;
        state.eatProgress = 0;
        state.health = Math.min(EAGLE_MAX_HEALTH, state.health + EAGLE_FRUIT_HEAL);
        events.push({ type: "eat" });
      }
    } else {
      state.eatProgress = 0;
    }
  }

  state.rodents = state.rodents.filter((rodent) => {
    rodent.pause = Math.max(0, rodent.pause - dt);
    if (rodent.pause > 0) return true;
    rodent.nextPause -= dt;
    if (rodent.nextPause <= 0) {
      rodent.pause = 0.35 + nextRandom(state) * 0.6;
      rodent.nextPause = 1.6 + nextRandom(state) * 2.4;
      return true;
    }
    rodent.x += rodent.vx * dt;
    return rodent.x > -50 && rodent.x < EAGLE_WORLD_WIDTH + 50;
  });

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 1.3 + nextRandom(state) * 0.9;
    if (state.rodents.length < EAGLE_MAX_RODENTS) {
      const side = nextRandom(state) < 0.5 ? -1 : 1;
      state.spawnSide = side;
      const speed = 60 + nextRandom(state) * 60;
      state.rodents.push({
        id: state.nextId++,
        x: side < 0 ? -28 : EAGLE_WORLD_WIDTH + 28,
        vx: -side * speed,
        pause: 0,
        nextPause: 1.2 + nextRandom(state) * 2.4,
        phase: nextRandom(state) * Math.PI * 2,
        size: 0.9 + nextRandom(state) * 0.25,
      });
    }
  }

  state.eagles.forEach((eagle) => stepEagle(state, player, eagle, dt, events));

  if (
    !state.won &&
    !state.lost &&
    state.caughtBy === null &&
    player.onGround &&
    player.x > EAGLE_FINISH_X
  ) {
    state.won = true;
    events.push({ type: "won" });
  }

  return events;
}
