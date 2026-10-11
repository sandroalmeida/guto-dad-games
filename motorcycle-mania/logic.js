// World coordinates stay independent of camera zoom. Positive y is upward.
export const TRACK_GAP = 86;
export const JUMP_TIME = 0.42;
export const SECTION_LENGTH = 2200;
export const RECOVERY_TIME = 2.6;
export const JUMP_BUFFER_TIME = 0.22;
export const SPEED_SCALE = 3.25;
export const ACCELERATION_BOOST = 34;
export const BRAKE_REDUCTION = 40;
export const SURFACE_DURATION = { water: 1.4, oil: 0.9 };
export const DIFFICULTIES = {
  cruise: { label: "Cruise", description: "84 km/h. A brisk ride with extra breathing room.", startSpeed: 84, maxSpeed: 148, speedStep: 6, levelDistance: 2400, waveGap: 740, reactionTime: 1.9, fuelEvery: 1, fuelDrain: 0.82, wheelSpeed: 75, surgeSpeed: 32 },
  arcade: { label: "Arcade", description: "112 km/h. More traffic, slippery tracks, bigger thrills.", startSpeed: 112, maxSpeed: 190, speedStep: 9, levelDistance: 2000, waveGap: 570, reactionTime: 1.3, fuelEvery: 2, fuelDrain: 1, wheelSpeed: 100, surgeSpeed: 44 },
  mania: { label: "Mania", description: "140 km/h. Fast, crowded, and ready to explode.", startSpeed: 140, maxSpeed: 234, speedStep: 11, levelDistance: 1800, waveGap: 470, reactionTime: 0.95, fuelEvery: 2, fuelDrain: 1.12, wheelSpeed: 125, surgeSpeed: 52 },
};
export const TRACK_SEQUENCE = [4, 2, 4, 3, 5, 10, 7, 3, 8, 2, 6];
export const SECTOR_NAMES = ["THE UNDERPASS", "THE SQUEEZE", "AFTERBURN", "NARROW ESCAPE", "WIDE OPEN", "MEGA MOTORWAY", "SEVEN HEAVENS", "CLOSE CALL", "SKYLINE RUN", "PINCH POINT", "NIGHT SHIFT"];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const zoomForTracks = (count) => clamp(4 / count, 0.4, 1.65);
// Wide layouts need enough distance for hazards to reach the zoomed-out rider.
export const sectionLengthForTracks = (count) => SECTION_LENGTH / zoomForTracks(count);
export const meters = (state) => Math.floor(state.distance / 4);
export const worldSpeed = (state) => state.speed * SPEED_SCALE;

export function random(state) {
  let n = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

export function createGame(seed = 1, difficulty = "arcade") {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) difficulty = "arcade";
  const settings = DIFFICULTIES[difficulty];
  return {
    seed, rng: seed | 0, difficulty, time: 0, distance: 0, lives: 3, fuel: 100,
    speed: settings.startSpeed, baseSpeed: settings.startSpeed, throttle: "CRUISING", level: 1,
    laneCount: 4, viewCount: 4, zoom: 1, section: 0,
    sectionStart: 0, nextSection: SECTION_LENGTH, sectionWarned: false, transition: 0,
    surge: false, surgeWarned: false, lowFuelWarned: false,
    player: { lane: 0, y: 0, lift: 0, jump: null, jumpBuffer: null, cooldown: 0, invulnerable: 0, surface: null },
    entities: [
      { id: 1, kind: "fuel", x: 690, lane: 0, y: 22, taken: false },
      { id: 2, kind: "car", x: 1100, lane: 0, y: 22, taken: false },
    ],
    nextId: 3, nextWave: 320, wave: 0, safeLane: 1,
    stats: { bottles: 0, jumps: 0, dodged: 0, topSpeed: settings.startSpeed },
    over: false, reason: "",
  };
}

export function requestJump(state, direction, events = []) {
  const p = state.player;
  if (state.over || p.jump || p.cooldown > 0 || p.surface?.kind === "oil" || !direction) return false;
  const lane = clamp(p.lane + Math.sign(direction), 0, state.laneCount - 1);
  if (lane === p.lane) return false;
  p.jump = { from: p.y, to: lane * TRACK_GAP, elapsed: 0, duration: JUMP_TIME * (p.surface?.kind === "water" ? 1.6 : 1), transfer: false };
  p.lane = lane;
  state.stats.jumps++;
  events.push({ type: "jump" });
  return true;
}

export function changeTracks(state, count, events = []) {
  count = clamp(Math.round(count), 2, 10);
  state.laneCount = count;
  state.transition = 1.25;
  const p = state.player;
  p.lane = Math.min(p.lane, count - 1);
  p.jump = { from: p.y, to: p.lane * TRACK_GAP, elapsed: 0, duration: 0.85, transfer: true };
  p.jumpBuffer = null;
  p.surface = null;
  p.invulnerable = Math.max(p.invulnerable, 1.5);
  // Clear the course during the perspective change; keep collectible fuel.
  state.entities = state.entities.filter((e) => e.kind === "fuel" && !e.taken);
  for (const e of state.entities) { e.lane = Math.min(e.lane, count - 1); e.y = e.lane * TRACK_GAP + 22; }
  state.safeLane = Math.min(state.safeLane, count - 1);
  state.nextWave = state.distance + 220;
  events.push({ type: "tracks", count });
}

export function spawnWave(state) {
  const settings = DIFFICULTIES[state.difficulty];
  const anchor = Number.isFinite(state.nextWave) ? Math.min(state.distance, state.nextWave) : state.distance;
  const overshoot = state.distance - anchor;
  const waveLevel = Math.min(12, 1 + Math.floor(anchor / settings.levelDistance));
  const nominalSpeed = Math.min(settings.maxSpeed, settings.startSpeed + (waveLevel - 1) * settings.speedStep);
  const count = state.laneCount;
  const choices = [-1, 0, 1].map((d) => clamp(state.safeLane + d, 0, count - 1));
  state.safeLane = choices[Math.floor(random(state) * choices.length)];
  // Anchor course generation to distance, so replaying at a different pace
  // keeps the same lanes, obstacle types, and fuel positions.
  const horizon = 1110 / zoomForTracks(count);
  const lanes = Array.from({ length: count }, (_, i) => i).filter((i) => i !== state.safeLane);
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  const extraLanes = Math.max(0, count - 4);
  const blockers = state.difficulty === "cruise" ? 1 + Math.floor(extraLanes / 3)
    : state.difficulty === "mania" ? 3 + Math.floor(extraLanes / 2) + (waveLevel >= 5 ? 1 : 0)
    : 2 + Math.floor(extraLanes / 2) + (waveLevel >= 5 ? 1 : 0);
  const total = Math.min(count - 1, blockers);
  const kinds = ["wheel", "water", "blast", "fire", "oil", "fall", "car"];
  for (let i = 0; i < total; i++) {
    let kind = kinds[(state.wave + i) % kinds.length];
    // Launchers sit on the bottom track. Keep the reserved route clear at spawn.
    if (kind === "blast") {
      const floorIndex = lanes.indexOf(0, i);
      if (floorIndex < 0) kind = "car";
      else [lanes[i], lanes[floorIndex]] = [lanes[floorIndex], lanes[i]];
    }
    const lane = lanes[i];
    const extraSpeed = kind === "wheel" ? settings.wheelSpeed : 0;
    const startX = horizon * (1 + extraSpeed / (nominalSpeed * SPEED_SCALE));
    // Wheels approach independently; accelerating or braking changes their timing.
    state.entities.push({ id: state.nextId++, kind, lane,
      x: startX - overshoot, courseX: anchor + startX, born: state.time,
      y: kind === "fall" ? (count - 1) * TRACK_GAP + 96 : lane * TRACK_GAP + (kind === "water" || kind === "oil" ? 2 : 22),
      extraSpeed, armed: false, warning: kind === "blast" ? 0.65 : 0.8,
      launchSpeed: Math.max(180, Math.ceil((count - 1) / 2) * TRACK_GAP * 2), dropSpeed: 300 + count * 35,
      rising: false, falling: false, landed: false, taken: false,
    });
  }
  if (state.wave % settings.fuelEvery === 0) {
    state.entities.push({ id: state.nextId++, kind: "fuel", lane: state.safeLane,
      x: horizon - 170 - overshoot, courseX: anchor + horizon - 170, born: state.time,
      y: state.safeLane * TRACK_GAP + 22, taken: false });
  }
  state.wave++;
  const fastestPace = (nominalSpeed + ACCELERATION_BOOST + settings.surgeSpeed) * SPEED_SCALE;
  state.nextWave = anchor + Math.max(settings.waveGap, fastestPace * settings.reactionTime);
}

function hurt(state, reason, events) {
  if (reason !== "fuel" && state.player.invulnerable > 0) return;
  state.lives--;
  state.reason = reason;
  events.push({ type: "hurt", reason, lives: state.lives });
  if (state.lives <= 0) { state.over = true; events.push({ type: "over" }); return; }
  state.player.invulnerable = RECOVERY_TIME;
  state.player.surface = null;
  state.player.jumpBuffer = null;
  state.fuel = reason === "fuel" ? 65 : Math.max(state.fuel, 35);
  state.speed = Math.max(42, state.speed - 20);
  for (const e of state.entities) {
    if (e.kind !== "fuel" && e.x > -140 && e.x < 220) e.taken = true;
  }
}

export function entityBounds(entity) {
  if (entity.kind === "car") return { w: 40, h: 20 };
  if (entity.kind === "fire") return { w: 19, h: 32 };
  if (entity.kind === "fuel") return { w: 19, h: 24 };
  if (entity.kind === "water" || entity.kind === "oil") return { w: 48, h: 6 };
  return { w: 20, h: 21 };
}

export function stepGame(state, input = {}, dt = 1 / 60) {
  const events = [];
  if (state.over) return events;
  let remaining = clamp(dt, 0, 0.15);
  // `jump` is a one-press input; held up/down still allow repeated hops.
  if (input.jump && remaining > 0) state.player.jumpBuffer = { direction: Math.sign(input.jump), remaining: JUMP_BUFFER_TIME };
  while (remaining > 1e-9 && !state.over) {
    const h = Math.min(remaining, 1 / 120);
    update(state, input, h, events);
    remaining -= h;
  }
  return events;
}

function update(state, input, dt, events) {
  const settings = DIFFICULTIES[state.difficulty];
  const p = state.player;
  if (p.surface) {
    p.surface.remaining = Math.max(0, p.surface.remaining - dt);
    if (p.surface.remaining === 0) { p.surface = null; events.push({ type: "grip-restored" }); }
  }
  state.time += dt;
  state.level = Math.min(12, 1 + Math.floor(state.distance / settings.levelDistance));
  state.baseSpeed = Math.min(settings.maxSpeed, settings.startSpeed + (state.level - 1) * settings.speedStep);
  const phase = state.time % 30;
  if (phase > 22 && phase < 24 && !state.surgeWarned) {
    state.surgeWarned = true; events.push({ type: "surge-warning" });
  }
  const surge = phase >= 24 && phase < 29;
  if (surge !== state.surge) events.push({ type: surge ? "surge" : "surge-end" });
  state.surge = surge;
  if (phase < 2) state.surgeWarned = false;
  const throttle = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  state.throttle = throttle > 0 ? "ACCELERATING" : throttle < 0 ? "BRAKING" : "CRUISING";
  const targetSpeed = Math.max(44, state.baseSpeed + throttle * (throttle < 0 ? BRAKE_REDUCTION : ACCELERATION_BOOST) + (surge ? settings.surgeSpeed : 0));
  state.speed += (targetSpeed - state.speed) * (1 - Math.exp(-dt * (p.surface?.kind === "water" ? 0.8 : 3)));
  state.stats.topSpeed = Math.max(state.stats.topSpeed, state.speed);
  const travel = worldSpeed(state) * dt;
  state.distance += travel;

  if (!state.sectionWarned && state.nextSection - state.distance < worldSpeed(state) * 1.8) {
    state.sectionWarned = true;
    const count = TRACK_SEQUENCE[(state.section + 1) % TRACK_SEQUENCE.length];
    events.push({ type: "track-warning", count });
  }
  if (state.distance >= state.nextSection) {
    state.section++;
    state.sectionStart = state.nextSection;
    state.sectionWarned = false;
    changeTracks(state, TRACK_SEQUENCE[state.section % TRACK_SEQUENCE.length], events);
    state.nextSection = state.sectionStart + sectionLengthForTracks(state.laneCount);
    state.nextWave = state.sectionStart + 220;
  }
  state.transition = Math.max(0, state.transition - dt);
  const ease = 1 - Math.exp(-dt * 2.7);
  state.viewCount += (state.laneCount - state.viewCount) * ease;
  state.zoom += (zoomForTracks(state.laneCount) - state.zoom) * ease;

  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  if (p.jumpBuffer) {
    p.jumpBuffer.remaining -= dt;
    if (p.jumpBuffer.remaining <= 0) p.jumpBuffer = null;
  }
  if (!p.jump && p.cooldown === 0) {
    const direction = p.jumpBuffer?.direction ?? ((input.up ? 1 : 0) - (input.down ? 1 : 0));
    requestJump(state, direction, events);
    p.jumpBuffer = null;
  }
  if (p.jump) {
    const jump = p.jump;
    jump.elapsed += dt;
    const t = clamp(jump.elapsed / jump.duration, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    p.y = jump.from + (jump.to - jump.from) * smooth;
    p.lift = jump.transfer ? 0 : Math.sin(t * Math.PI) * 17;
    if (t >= 1) { p.y = jump.to; p.lift = 0; p.jump = null; p.cooldown = 0.08; }
  }

  if (state.distance >= state.nextWave && state.nextWave <= state.nextSection - 400 / zoomForTracks(state.laneCount)) spawnWave(state);
  for (const e of state.entities) {
    if (e.taken) continue;
    if (e.born !== state.time) e.x -= travel + (e.extraSpeed || 0) * dt;
    if (e.kind === "fall" && !e.landed) {
      if (!e.armed && e.x < worldSpeed(state) * 2.1) {
        e.armed = true; events.push({ type: "fall-warning", id: e.id });
      }
      if (e.armed) {
        e.warning -= dt;
        if (e.warning <= 0) {
          e.falling = true;
          e.y = Math.max(e.lane * TRACK_GAP + 22, e.y - (e.dropSpeed ?? 300) * dt);
          if (e.y <= e.lane * TRACK_GAP + 22) { e.landed = true; events.push({ type: "landing", x: e.x, y: e.y }); }
        }
      }
    }
    if (e.kind === "blast") {
      if (!e.armed && e.x < worldSpeed(state) * 1.15) {
        e.armed = true; events.push({ type: "blast-warning", id: e.id });
      }
      if (e.armed && !e.rising) {
        e.warning -= dt;
        if (e.warning <= 0) {
          e.rising = true;
          events.push({ type: "blast", x: e.x, y: e.y });
        }
      }
      if (e.rising) {
        e.y += e.launchSpeed * dt;
        if (e.y > (state.laneCount - 1) * TRACK_GAP + 150) {
          e.taken = true; state.stats.dodged++; continue;
        }
      }
    }
    const bounds = entityBounds(e);
    const closeX = Math.abs(e.x) < bounds.w + 27;
    const closeY = Math.abs(e.y - (p.y + p.lift + 23)) < bounds.h + 16;
    const active = e.kind !== "fall" || e.falling;
    const surface = e.kind === "water" || e.kind === "oil";
    if (surface) {
      // Airborne wheels clear a puddle; splashes never cost a life by themselves.
      if (closeX && !p.jump && p.invulnerable <= 0 && Math.abs(p.y - e.lane * TRACK_GAP) < 8) {
        e.taken = true;
        if (p.surface?.kind !== "oil" || e.kind === "oil") {
          p.surface = { kind: e.kind, remaining: SURFACE_DURATION[e.kind], duration: SURFACE_DURATION[e.kind] };
          p.jumpBuffer = null;
          events.push({ type: "surface", kind: e.kind });
        }
      }
    } else if (closeX && closeY && active) {
      if (e.kind === "fuel") {
        e.taken = true; state.fuel = Math.min(100, state.fuel + 30); state.stats.bottles++;
        events.push({ type: "fuel", x: e.x, y: e.y });
      } else if (p.invulnerable <= 0) {
        e.taken = true; hurt(state, e.kind, events);
        if (state.over) break;
      }
    }
    if (!e.passed && e.x < -85 && e.kind !== "fuel") { e.passed = true; state.stats.dodged++; }
  }
  state.entities = state.entities.filter((e) => !e.taken && e.x > -400);
  if (state.over) return;
  state.fuel = Math.max(0, state.fuel - dt * (2.6 + state.speed / 105) * settings.fuelDrain);
  if (state.fuel < 25 && !state.lowFuelWarned) { state.lowFuelWarned = true; events.push({ type: "low-fuel" }); }
  if (state.fuel > 35) state.lowFuelWarned = false;
  if (state.fuel <= 0) hurt(state, "fuel", events);
}
