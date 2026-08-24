export const HIPPO_WORLD_WIDTH = 1200;
export const HIPPO_WATER_Y = 470;
export const HIPPO_SPLASH_Y = 478;
export const HIPPO_BANK_Y = 440;
export const HIPPO_BANK_LEFT = 150;
export const HIPPO_BANK_RIGHT = 1050;
export const HIPPO_PLAYER_START_X = 95;
export const HIPPO_LENGTH = 190;
export const HIPPO_SPACING = 215;
export const HIPPO_FIRST_X = 185;
export const HIPPO_MOUTH_WIDTH = 45;
export const HIPPO_HEAD_WIDTH = 45;
export const HIPPO_BACK_Y = 408;
export const HIPPO_HEAD_Y = 428;
export const HIPPO_MOUTH_Y = 444;
export const HIPPO_GRAVITY = 1180;
export const HIPPO_SHORT_VY = -430;
export const HIPPO_SHORT_VX = 130;
export const HIPPO_LONG_VY = -520;
export const HIPPO_LONG_VX = 244;
export const HIPPO_CHARGE_TIME = 0.7;
export const HIPPO_OVERCHARGE_START = 1.6;
export const HIPPO_OVERCHARGE_RATE = 0.5;
export const HIPPO_MAX_CHARGE = 1.4;
export const HIPPO_MOUTH_DELAY = 0.4;
export const HIPPO_HEAD_LIMIT = 0.75;
export const HIPPO_BACK_LIMIT = 2.4;
export const HIPPO_BACK_WARNING = 1.6;
export const HIPPO_DIVER_INDEX = 2;
export const HIPPO_DIVE_CYCLE = 8;
export const HIPPO_DIVE_DOWN = 1;
export const HIPPO_DIVE_WARNING = 1;
export const HIPPO_AIR_STEER = 90;

export type HippoZone = "mouth" | "head" | "back";
export type HippoMode = "idle" | "yawn" | "chomp" | "shake" | "dive" | "submerged" | "rising";
export type HippoLossReason = "mouth" | "shake" | "dive" | "water";

export type Hippo = {
  id: number;
  baseX: number;
  x: number;
  bob: number;
  driftPhase: number;
  bobPhase: number;
  mode: HippoMode;
  timer: number;
  yawnTimer: number;
  mouthOpen: number;
  sink: number;
  cycle: number;
  diver: boolean;
  bird: boolean;
  backLimit: number;
};

export type HippoStanding = { hippo: number; zone: HippoZone } | { bank: "left" | "right" };

export type HippoCourseState = {
  seed: number;
  elapsed: number;
  hippos: Hippo[];
  standing: HippoStanding | null;
  zoneTimer: number;
  backTime: number;
  lastHippo: number | null;
  warned: boolean;
  charge: number;
  chargeHeld: number;
  airborne: boolean;
  lastJump: "short" | "long" | null;
  jumpPresses: number;
  jumpWithHold: boolean;
  jumps: number;
  landings: number;
  won: boolean;
  lost: boolean;
  lossReason: HippoLossReason | null;
  lossHippo: number | null;
  splashX: number;
};

export type HippoPlayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
};

export type HippoInput = {
  move: number;
  hold: boolean;
};

export type HippoEvent =
  | { type: "jump"; kind: "short" | "long"; charge: number }
  | { type: "land"; zone: HippoZone; hippo: number }
  | { type: "bank" }
  | { type: "chomp"; hippo: number }
  | { type: "warn"; kind: "head" | "back" | "submerge"; hippo: number }
  | { type: "submerge"; hippo: number }
  | { type: "surface"; hippo: number }
  | { type: "chargeFull" }
  | { type: "overcharge" }
  | { type: "won" }
  | { type: "lost"; reason: HippoLossReason };

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

export function makeHippoCourse(seed = 11): HippoCourseState {
  const state: HippoCourseState = {
    seed,
    elapsed: 0,
    hippos: [],
    standing: { bank: "left" },
    zoneTimer: 0,
    backTime: 0,
    lastHippo: null,
    warned: false,
    charge: 0,
    chargeHeld: 0,
    airborne: false,
    lastJump: null,
    jumpPresses: 0,
    jumpWithHold: false,
    jumps: 0,
    landings: 0,
    won: false,
    lost: false,
    lossReason: null,
    lossHippo: null,
    splashX: 0,
  };
  for (let index = 0; index < 4; index += 1) {
    const baseX = HIPPO_FIRST_X + index * HIPPO_SPACING;
    state.hippos.push({
      id: index,
      baseX,
      x: baseX,
      bob: 0,
      driftPhase: index * 1.7 + nextRandom(state) * 0.8,
      bobPhase: index * 2.3,
      mode: "idle",
      timer: 0,
      yawnTimer: 2 + nextRandom(state) * 4,
      mouthOpen: 0,
      sink: 0,
      cycle: index === HIPPO_DIVER_INDEX ? 0.4 + nextRandom(state) * (HIPPO_DIVE_CYCLE - 2.8) : 0,
      diver: index === HIPPO_DIVER_INDEX,
      bird: index === 1 || index === 3,
      backLimit: index === HIPPO_DIVER_INDEX - 1 ? HIPPO_BACK_LIMIT + 0.4 : HIPPO_BACK_LIMIT,
    });
  }
  return state;
}

export function zoneSpan(hippo: Hippo, zone: HippoZone) {
  if (zone === "mouth") return { start: hippo.x, end: hippo.x + HIPPO_MOUTH_WIDTH, y: HIPPO_MOUTH_Y + hippo.bob };
  if (zone === "head") {
    return {
      start: hippo.x + HIPPO_MOUTH_WIDTH,
      end: hippo.x + HIPPO_MOUTH_WIDTH + HIPPO_HEAD_WIDTH,
      y: HIPPO_HEAD_Y + hippo.bob,
    };
  }
  return {
    start: hippo.x + HIPPO_MOUTH_WIDTH + HIPPO_HEAD_WIDTH,
    end: hippo.x + HIPPO_LENGTH,
    y: HIPPO_BACK_Y + hippo.bob,
  };
}

export function chargeFromHold(held: number) {
  if (held <= 0) return 0;
  if (held <= HIPPO_OVERCHARGE_START) return Math.min(1, held / HIPPO_CHARGE_TIME);
  return Math.min(HIPPO_MAX_CHARGE, 1 + (held - HIPPO_OVERCHARGE_START) * HIPPO_OVERCHARGE_RATE);
}

export function zoneLimit(zone: HippoZone, hippo: Hippo) {
  return zone === "mouth" ? HIPPO_MOUTH_DELAY : zone === "head" ? HIPPO_HEAD_LIMIT : hippo.backLimit;
}

function lose(state: HippoCourseState, player: HippoPlayer, reason: HippoLossReason, hippo: number | null, events: HippoEvent[]) {
  state.lost = true;
  state.lossReason = reason;
  state.lossHippo = hippo;
  state.splashX = player.x;
  state.standing = null;
  state.airborne = false;
  player.onGround = false;
  player.y = HIPPO_SPLASH_Y + 10;
  player.vy = 0;
  player.vx = 0;
  events.push({ type: "lost", reason });
}

function launch(state: HippoCourseState, player: HippoPlayer, kind: "short" | "long", charge: number, events: HippoEvent[]) {
  const scale = kind === "long" ? (100 + 115 * charge) / 215 : 1;
  player.vx = (kind === "long" ? HIPPO_LONG_VX * scale : HIPPO_SHORT_VX) * (player.facing || 1);
  player.vy = kind === "long" ? HIPPO_LONG_VY : HIPPO_SHORT_VY;
  player.onGround = false;
  state.standing = null;
  state.airborne = true;
  state.zoneTimer = 0;
  state.warned = false;
  state.charge = 0;
  state.chargeHeld = 0;
  state.lastJump = kind;
  state.jumps += 1;
  events.push({ type: "jump", kind, charge });
}

function stepHippo(state: HippoCourseState, hippo: Hippo, dt: number, events: HippoEvent[]) {
  hippo.x = hippo.baseX + Math.sin(state.elapsed * 0.5 + hippo.driftPhase) * 12;
  hippo.bob = Math.sin(state.elapsed * 1.3 + hippo.bobPhase) * 3;
  hippo.timer += dt;

  if (hippo.diver && hippo.mode !== "dive") {
    hippo.cycle += dt;
    const phase = hippo.cycle % HIPPO_DIVE_CYCLE;
    const downStart = HIPPO_DIVE_CYCLE - HIPPO_DIVE_DOWN;
    const warnStart = downStart - HIPPO_DIVE_WARNING;
    const occupied = state.standing !== null && "hippo" in state.standing && state.standing.hippo === hippo.id;
    if (phase >= downStart) {
      if (hippo.mode !== "submerged") {
        hippo.mode = "submerged";
        hippo.timer = 0;
        events.push({ type: "submerge", hippo: hippo.id });
      }
      hippo.sink = Math.min(1, hippo.sink + dt * 3.2);
    } else {
      if (hippo.mode === "submerged") {
        hippo.mode = "rising";
        hippo.timer = 0;
        events.push({ type: "surface", hippo: hippo.id });
      }
      hippo.sink = Math.max(0, hippo.sink - dt * 2.4);
      if (hippo.mode === "rising" && hippo.sink <= 0) hippo.mode = "idle";
      if (phase >= warnStart && hippo.mode === "idle") {
        hippo.mode = "yawn";
        hippo.timer = 0;
        events.push({ type: "warn", kind: "submerge", hippo: hippo.id });
      }
      if (hippo.mode === "yawn" && phase < warnStart) hippo.mode = "idle";
    }
    if (occupied && hippo.mode === "submerged" && !state.lost) {
      return "sank";
    }
  }

  if (hippo.mode === "idle") {
    hippo.yawnTimer -= dt;
    if (hippo.yawnTimer <= 0) {
      hippo.mode = "yawn";
      hippo.timer = 0;
      hippo.yawnTimer = 4 + nextRandom(state) * 5;
    }
  } else if (hippo.mode === "yawn" && !hippo.diver && hippo.timer > 1.4) {
    hippo.mode = "idle";
    hippo.timer = 0;
  }

  const wantsOpen =
    hippo.mode === "yawn" || hippo.mode === "chomp"
      ? 1
      : hippo.mode === "shake"
        ? 0.35
        : 0;
  hippo.mouthOpen += (wantsOpen - hippo.mouthOpen) * Math.min(1, dt * (hippo.mode === "chomp" ? 14 : 5));
  if (hippo.mode === "dive") hippo.sink = Math.min(1, hippo.sink + dt * 2.2);
  return null;
}

export function stepHippoCourse(
  state: HippoCourseState,
  player: HippoPlayer,
  input: HippoInput,
  dt: number,
): HippoEvent[] {
  const events: HippoEvent[] = [];
  if (state.won || state.lost) {
    state.jumpPresses = 0;
    state.elapsed += dt;
    state.hippos.forEach((hippo) => {
      if (hippo.mode === "dive") hippo.sink = Math.min(1, hippo.sink + dt * 2.2);
      if (hippo.mode === "chomp") hippo.mouthOpen = Math.min(1, hippo.mouthOpen + dt * 6);
    });
    return events;
  }
  state.elapsed += dt;
  const presses = state.jumpPresses;
  const pressedWithHold = presses > 0 && (input.hold || state.jumpWithHold);
  const chargeAtPress = state.charge;
  state.jumpPresses = 0;
  state.jumpWithHold = false;

  const standingOn = state.standing;
  const onHippo = standingOn && "hippo" in standingOn ? state.hippos[standingOn.hippo] : null;
  const zone = standingOn && "hippo" in standingOn ? standingOn.zone : null;
  const previousHippoX = onHippo ? onHippo.x : 0;

  let sank: number | null = null;
  state.hippos.forEach((hippo) => {
    if (stepHippo(state, hippo, dt, events) === "sank") sank = hippo.id;
  });
  if (sank !== null) {
    lose(state, player, "dive", sank, events);
    return events;
  }

  if (player.onGround && standingOn) {
    if (onHippo) {
      player.x += onHippo.x - previousHippoX;
      player.y = zoneSpan(onHippo, zone!).y;
    } else {
      player.y = HIPPO_BANK_Y;
    }

    const stuck = zone === "mouth";
    if (!stuck) {
      if (input.move) player.facing = input.move;
      const walkSpeed = 150;
      player.vx += (input.move * walkSpeed - player.vx) * Math.min(1, dt * 14);
      if (!input.move) player.vx *= Math.pow(0.01, dt);
      player.x += player.vx * dt;
      if (onHippo && zone) {
        const span = zoneSpan(onHippo, zone);
        const margin = zone === "back" ? 8 : 12;
        player.x = clamp(player.x, span.start + margin, span.end - margin);
      } else if (standingOn && "bank" in standingOn) {
        player.x =
          standingOn.bank === "left"
            ? clamp(player.x, 30, HIPPO_BANK_LEFT)
            : clamp(player.x, HIPPO_BANK_RIGHT, HIPPO_WORLD_WIDTH - 30);
      }
    } else {
      player.vx = 0;
    }

    if (input.hold && !stuck) {
      const before = state.chargeHeld;
      state.chargeHeld += dt;
      state.charge = chargeFromHold(state.chargeHeld);
      if (before < HIPPO_CHARGE_TIME && state.chargeHeld >= HIPPO_CHARGE_TIME) events.push({ type: "chargeFull" });
      if (before < HIPPO_OVERCHARGE_START && state.chargeHeld >= HIPPO_OVERCHARGE_START) events.push({ type: "overcharge" });
    } else {
      state.chargeHeld = 0;
      state.charge = 0;
    }

    if (onHippo && zone) {
      state.zoneTimer += dt;
      if (zone === "back") state.backTime += dt;
      const limit = zoneLimit(zone, onHippo);
      const elapsedOnZone = zone === "back" ? state.backTime : state.zoneTimer;
      if (zone === "back" && !state.warned && elapsedOnZone >= HIPPO_BACK_WARNING) {
        state.warned = true;
        events.push({ type: "warn", kind: "back", hippo: onHippo.id });
      }
      if (zone === "head" && !state.warned && state.zoneTimer >= limit * 0.55) {
        state.warned = true;
        events.push({ type: "warn", kind: "head", hippo: onHippo.id });
      }
      if (elapsedOnZone >= limit) {
        onHippo.mode = zone === "mouth" ? "chomp" : zone === "head" ? "shake" : "dive";
        onHippo.timer = 0;
        lose(state, player, zone === "mouth" ? "mouth" : zone === "head" ? "shake" : "dive", onHippo.id, events);
        return events;
      }
    }

    if (presses > 0 && !stuck) {
      if (player.facing === 0) player.facing = 1;
      if (pressedWithHold) launch(state, player, "long", input.hold ? state.charge : chargeAtPress, events);
      else launch(state, player, "short", 0, events);
    }
  } else if (!player.onGround) {
    if (input.move) player.vx += input.move * HIPPO_AIR_STEER * dt;
    player.vy += HIPPO_GRAVITY * dt;
    player.x = clamp(player.x + player.vx * dt, 20, HIPPO_WORLD_WIDTH - 20);
    player.y += player.vy * dt;
    state.chargeHeld = 0;
    state.charge = 0;

    if (player.vy > 0) {
      if (player.x >= HIPPO_BANK_RIGHT && player.y >= HIPPO_BANK_Y) {
        player.y = HIPPO_BANK_Y;
        player.vy = 0;
        player.vx = 0;
        player.onGround = true;
        state.airborne = false;
        state.standing = { bank: "right" };
        state.lastHippo = null;
        state.backTime = 0;
        state.landings += 1;
        state.won = true;
        events.push({ type: "bank" });
        events.push({ type: "won" });
        return events;
      }
      if (player.x <= HIPPO_BANK_LEFT && player.y >= HIPPO_BANK_Y) {
        player.y = HIPPO_BANK_Y;
        player.vy = 0;
        player.vx = 0;
        player.onGround = true;
        state.airborne = false;
        state.standing = { bank: "left" };
        state.lastHippo = null;
        state.backTime = 0;
        events.push({ type: "bank" });
        return events;
      }
      for (const hippo of state.hippos) {
        if (hippo.sink > 0.15) continue;
        for (const zoneName of ["back", "head", "mouth"] as HippoZone[]) {
          const span = zoneSpan(hippo, zoneName);
          if (player.x >= span.start - 4 && player.x <= span.end + 4 && player.y >= span.y) {
            player.y = span.y;
            player.vy = 0;
            player.vx = 0;
            player.onGround = true;
            state.airborne = false;
            state.standing = { hippo: hippo.id, zone: zoneName };
            state.zoneTimer = 0;
            if (state.lastHippo !== hippo.id) {
              state.backTime = 0;
              state.warned = false;
            }
            state.lastHippo = hippo.id;
            state.landings += 1;
            player.x = clamp(player.x, span.start + (zoneName === "back" ? 8 : 12), span.end - (zoneName === "back" ? 8 : 12));
            events.push({ type: "land", zone: zoneName, hippo: hippo.id });
            if (zoneName === "mouth") {
              hippo.mode = "chomp";
              hippo.timer = 0;
              events.push({ type: "chomp", hippo: hippo.id });
            } else if (hippo.bird && zoneName === "back") {
              hippo.bird = false;
            }
            return events;
          }
        }
      }
      if (player.y >= HIPPO_SPLASH_Y) {
        lose(state, player, "water", null, events);
        return events;
      }
    }
  }

  return events;
}
