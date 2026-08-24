import assert from "node:assert/strict";
import test from "node:test";
import {
  HIPPO_BACK_LIMIT,
  HIPPO_BANK_LEFT,
  HIPPO_BANK_Y,
  HIPPO_CHARGE_TIME,
  HIPPO_DIVE_CYCLE,
  HIPPO_DIVE_DOWN,
  HIPPO_DIVE_WARNING,
  HIPPO_HEAD_LIMIT,
  HIPPO_MOUTH_DELAY,
  HIPPO_PLAYER_START_X,
  chargeFromHold,
  makeHippoCourse,
  stepHippoCourse,
  zoneSpan,
} from "../app/hippo-course.ts";

const DT = 1 / 60;

function makePlayer(x = HIPPO_PLAYER_START_X) {
  return { x, y: HIPPO_BANK_Y, vx: 0, vy: 0, facing: 1, onGround: true };
}

const idle = () => ({ move: 0, hold: false });

function run(state, player, controller, predicate, maxSeconds = 60) {
  const log = [];
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    const input = controller(state, player, elapsed);
    const events = stepHippoCourse(state, player, input, DT);
    events.forEach((event) => log.push({ ...event, at: Number(elapsed.toFixed(2)) }));
    elapsed += DT;
    if (predicate(state, player, log)) break;
  }
  return { log, elapsed };
}

function standingZone(state) {
  return state.standing && "hippo" in state.standing ? state.standing.zone : state.standing?.bank ?? null;
}

// A bot that walks to a launch x, waits `settle` seconds, optionally charges Z for `hold` seconds, then jumps once.
function scriptedJump({ walkTo, hold = 0, facing = 1 }) {
  let phase = "walk";
  let held = 0;
  return (state, player) => {
    if (!player.onGround || state.airborne) return idle();
    if (phase === "walk") {
      if (Math.abs(player.x - walkTo) > 3) return { move: Math.sign(walkTo - player.x), hold: false };
      phase = "charge";
    }
    if (phase === "charge") {
      if (held < hold) {
        held += DT;
        return { move: 0, hold: true };
      }
      phase = "done";
      player.facing = facing;
      state.jumpPresses += 1;
      return { move: 0, hold: hold > 0 };
    }
    return idle();
  };
}

// Full-course bot: long jumps from back to back, charging to full (and pre-charging while it waits for the diver).
function longJumper(waitForDiver = true) {
  return (state, player) => {
    if (!player.onGround) return idle();
    const zone = standingZone(state);
    if (zone === "mouth") return idle();
    const nextIndex = state.standing && "hippo" in state.standing ? state.standing.hippo + 1 : 0;
    const next = state.hippos[nextIndex];
    const blocked = waitForDiver && next && (next.sink > 0.15 || next.mode === "submerged" || (next.diver && next.mode === "yawn"));
    if (blocked) return { move: 0, hold: true };
    if (state.charge < 1) return { move: 0, hold: true };
    state.jumpPresses += 1;
    return { move: 0, hold: true };
  };
}

// Full-course bot using only short jumps: bank edge -> head -> back -> walk to the rear -> head -> ...
function hopper() {
  return (state, player) => {
    if (!player.onGround) return idle();
    const standing = state.standing;
    if (!standing) return idle();
    if ("bank" in standing) {
      if (player.x < HIPPO_BANK_LEFT - 1) return { move: 1, hold: false };
      state.jumpPresses += 1;
      return idle();
    }
    const hippo = state.hippos[standing.hippo];
    if (standing.zone === "head") {
      state.jumpPresses += 1;
      return idle();
    }
    if (standing.zone === "back") {
      const span = zoneSpan(hippo, "back");
      const next = state.hippos[standing.hippo + 1];
      if (next && (next.sink > 0 || (next.diver && next.mode === "yawn"))) return idle();
      if (next?.diver && next.cycle % HIPPO_DIVE_CYCLE > HIPPO_DIVE_CYCLE - HIPPO_DIVE_DOWN - HIPPO_DIVE_WARNING - 2.4) return idle();
      if (player.x < span.end - 9) return { move: 1, hold: false };
      state.jumpPresses += 1;
      return idle();
    }
    return idle();
  };
}

test("the charge meter fills in 0.7s and overshoots when held too long", () => {
  assert.equal(chargeFromHold(0), 0);
  assert.ok(Math.abs(chargeFromHold(HIPPO_CHARGE_TIME / 2) - 0.5) < 1e-9);
  assert.equal(chargeFromHold(HIPPO_CHARGE_TIME), 1);
  assert.equal(chargeFromHold(1.2), 1, "a short grace window keeps a full charge");
  assert.ok(chargeFromHold(2.4) > 1.3, "holding far too long overcharges");
  assert.ok(chargeFromHold(5) <= 1.4);
});

test("a short jump from the back of the bank lands in the mouth and the hippo chomps", () => {
  const state = makeHippoCourse(1);
  const player = makePlayer(110);
  const { log } = run(state, player, scriptedJump({ walkTo: 118 }), (s) => s.lost || s.won, 6);
  const land = log.find((event) => event.type === "land");
  assert.equal(land?.zone, "mouth");
  assert.ok(log.some((event) => event.type === "chomp"));
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "mouth");
  const lostAt = log.find((event) => event.type === "lost").at;
  assert.ok(lostAt - land.at <= HIPPO_MOUTH_DELAY + 0.05, "the mouth opens almost immediately");
});

test("a short jump from the very edge of the bank reaches the head, which must be left quickly", () => {
  const state = makeHippoCourse(1);
  const player = makePlayer(120);
  const { log } = run(state, player, scriptedJump({ walkTo: HIPPO_BANK_LEFT }), (s) => s.lost || s.won, 6);
  const land = log.find((event) => event.type === "land");
  assert.equal(land?.zone, "head");
  assert.equal(state.lossReason, "shake");
  const lostAt = log.find((event) => event.type === "lost").at;
  assert.ok(Math.abs(lostAt - land.at - HIPPO_HEAD_LIMIT) < 0.05, "the head shakes after the head limit");
  assert.ok(log.some((event) => event.type === "warn" && event.kind === "head"));
});

test("a short hop from the head reaches the back, where you can rest but not forever", () => {
  const state = makeHippoCourse(1);
  const player = makePlayer(120);
  run(state, player, scriptedJump({ walkTo: HIPPO_BANK_LEFT }), (s) => standingZone(s) === "head", 4);
  assert.equal(standingZone(state), "head");
  state.jumpPresses += 1;
  const { log } = run(state, player, () => idle(), (s) => s.lost || s.won, 8);
  const land = log.find((event) => event.type === "land");
  assert.equal(land?.zone, "back");
  assert.equal(land.hippo, 0);
  assert.equal(state.lossReason, "dive");
  const lostAt = log.find((event) => event.type === "lost").at;
  assert.ok(Math.abs(lostAt - land.at - HIPPO_BACK_LIMIT) < 0.05, "the hippo dives after the back limit");
  assert.ok(log.some((event) => event.type === "warn" && event.kind === "back"));
  assert.equal(state.hippos[0].mode, "dive");
});

test("from the back, a short jump only reaches the next head when you stand at the rear", () => {
  const results = {};
  for (const offset of [20, 45, 70, 92]) {
    const state = makeHippoCourse(1);
    const player = makePlayer(120);
    run(state, player, scriptedJump({ walkTo: 118, hold: HIPPO_CHARGE_TIME + 0.05 }), (s) => standingZone(s) === "back", 4);
    assert.equal(standingZone(state), "back", "a full long jump from the bank lands on the first back");
    const span = zoneSpan(state.hippos[0], "back");
    const { log } = run(state, player, scriptedJump({ walkTo: span.start + offset }), (s, _, events) => events.some((event) => event.type === "land" || event.type === "lost"), 6);
    const land = log.find((event) => event.type === "land");
    results[offset] = land ? `${land.zone}@${land.hippo}` : state.lossReason;
  }
  assert.equal(results[92], "head@1", `rear of the back → next head: ${JSON.stringify(results)}`);
  assert.equal(results[70], "head@1", `rear third of the back → next head: ${JSON.stringify(results)}`);
  assert.equal(results[45], "mouth@1", `middle of the back → next mouth: ${JSON.stringify(results)}`);
  assert.equal(results[20], "mouth@1", `front of the back → next mouth: ${JSON.stringify(results)}`);
});

test("a fully charged long jump goes back to back; an overcharged one overshoots", () => {
  const outcomes = {};
  for (const hold of [0.06, HIPPO_CHARGE_TIME + 0.05, 2.4]) {
    const state = makeHippoCourse(1);
    const player = makePlayer(120);
    run(state, player, scriptedJump({ walkTo: 118, hold: HIPPO_CHARGE_TIME + 0.05 }), (s) => standingZone(s) === "back", 4);
    const span = zoneSpan(state.hippos[0], "back");
    const { log } = run(state, player, scriptedJump({ walkTo: span.end - 30, hold }), (s, _, events) => events.some((event) => event.type === "land" || event.type === "lost"), 8);
    const land = log.find((event) => event.type === "land");
    outcomes[hold] = land ? `${land.zone}@${land.hippo}` : state.lossReason;
  }
  assert.equal(outcomes[HIPPO_CHARGE_TIME + 0.05], "back@1", JSON.stringify(outcomes));
  assert.notEqual(outcomes[0.06], "back@1", `a barely charged long jump should fall short: ${JSON.stringify(outcomes)}`);
  assert.notEqual(outcomes[2.4], "back@1", `an overcharged long jump should overshoot: ${JSON.stringify(outcomes)}`);
});

test("the third hippo submerges on a cycle and sinks anyone still on its back", () => {
  const state = makeHippoCourse(3);
  const player = makePlayer();
  const diver = state.hippos[2];
  assert.equal(diver.diver, true);
  const { log } = run(state, player, () => idle(), (_, __, events) => events.some((event) => event.type === "surface"), 20);
  assert.ok(log.some((event) => event.type === "warn" && event.kind === "submerge"));
  assert.ok(log.some((event) => event.type === "submerge"));
  assert.ok(log.some((event) => event.type === "surface"));
  const warnAt = log.find((event) => event.type === "warn" && event.kind === "submerge").at;
  const downAt = log.find((event) => event.type === "submerge").at;
  assert.ok(downAt - warnAt > HIPPO_DIVE_WARNING - 0.1 && downAt - warnAt < HIPPO_DIVE_WARNING + 0.1, "the bubbles warn before the dive");

  const sinking = makeHippoCourse(3);
  const rider = { x: zoneSpan(sinking.hippos[2], "back").start + 40, y: 416, vx: 0, vy: 0, facing: 1, onGround: true };
  sinking.standing = { hippo: 2, zone: "back" };
  sinking.hippos[2].cycle = HIPPO_DIVE_CYCLE - HIPPO_DIVE_DOWN - 0.4;
  const ride = run(sinking, rider, () => idle(), (s) => s.lost, 3);
  assert.equal(sinking.lost, true);
  assert.equal(sinking.lossReason, "dive");
  assert.ok(ride.log.some((event) => event.type === "submerge"));
});

test("landing on a submerged hippo is a splash", () => {
  const state = makeHippoCourse(3);
  state.hippos[2].sink = 1;
  state.hippos[2].mode = "submerged";
  state.hippos[2].cycle = HIPPO_DIVE_CYCLE - HIPPO_DIVE_DOWN + 0.2;
  const player = { x: zoneSpan(state.hippos[2], "back").start + 30, y: 300, vx: 0, vy: 100, facing: 1, onGround: false };
  state.standing = null;
  state.airborne = true;
  run(state, player, () => idle(), (s) => s.lost || s.won, 2);
  assert.equal(state.lossReason, "water");
});

test("a patient long jumper who waits for the diver crosses every seed", () => {
  const results = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = makeHippoCourse(seed);
    const player = makePlayer();
    const { log, elapsed } = run(state, player, longJumper(), (s) => s.won || s.lost, 40);
    results.push({ seed, won: state.won, reason: state.lossReason, t: Number(elapsed.toFixed(1)), jumps: state.jumps, zones: log.filter((e) => e.type === "land").map((e) => e.zone).join(">") });
  }
  assert.ok(results.every((result) => result.won), `long jumps from back to back should cross: ${JSON.stringify(results)}`);
  assert.ok(results.every((result) => result.jumps >= 5));
});

test("a hopper using only short jumps can also cross by leaving heads quickly", () => {
  const results = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const state = makeHippoCourse(seed);
    const player = makePlayer();
    const { log, elapsed } = run(state, player, hopper(), (s) => s.won || s.lost, 40);
    results.push({ seed, won: state.won, reason: state.lossReason, t: Number(elapsed.toFixed(1)), zones: log.filter((e) => e.type === "land").map((e) => e.zone).join(">") });
  }
  const wins = results.filter((result) => result.won).length;
  assert.ok(wins >= 3, `short-jump route should be viable most of the time: ${JSON.stringify(results)}`);
  assert.ok(results.some((result) => result.zones.includes("head>back")));
});

test("an impatient long jumper who ignores the diver sinks or splashes at some point in its cycle", () => {
  let losses = 0;
  for (const cycle of [0, 1, 2, 3, 4, 5, 6]) {
    const state = makeHippoCourse(4);
    state.hippos[2].cycle = cycle;
    const player = makePlayer();
    run(state, player, longJumper(false), (s) => s.won || s.lost, 40);
    if (state.lost) {
      losses += 1;
      assert.ok(state.lossReason === "water" || state.lossReason === "dive", state.lossReason);
    }
  }
  assert.ok(losses >= 2, `ignoring the submerging hippo should be punished (${losses}/7 lost)`);
});

test("re-landing on the same back does not reset the hippo's patience", () => {
  const state = makeHippoCourse(2);
  const player = makePlayer(120);
  const { log } = run(state, player, scriptedJump({ walkTo: 118, hold: HIPPO_CHARGE_TIME + 0.05 }), (s) => standingZone(s) === "back", 4);
  const landedAt = log.find((event) => event.type === "land").at;
  run(state, player, () => idle(), () => false, 1.5);
  assert.equal(standingZone(state), "back");
  assert.ok(state.backTime >= 1.4);
  // Simulate a hop that comes back down on the rear of the same back.
  const span = zoneSpan(state.hippos[0], "back");
  player.x = span.end - 20;
  player.y = 400;
  player.vy = 60;
  player.onGround = false;
  state.standing = null;
  state.airborne = true;
  const rest = run(state, player, () => idle(), (s) => s.lost, 5);
  const reland = rest.log.find((event) => event.type === "land");
  assert.equal(reland?.zone, "back");
  assert.equal(reland?.hippo, 0);
  assert.equal(state.lossReason, "dive");
  const lostAt = rest.log.find((event) => event.type === "lost").at;
  assert.ok(landedAt >= 0);
  assert.ok(lostAt < HIPPO_BACK_LIMIT - 1, `only the remaining patience is left after re-landing (dove ${lostAt}s after the hop)`);
});

test("a long jump keeps its charge even if Z is released in the same instant as Space", () => {
  const state = makeHippoCourse(2);
  const player = makePlayer(120);
  run(state, player, () => ({ move: 1, hold: false }), (_, p) => p.x >= HIPPO_BANK_LEFT - 1, 2);
  run(state, player, () => ({ move: 0, hold: true }), () => false, HIPPO_CHARGE_TIME + 0.05);
  assert.equal(state.charge, 1);
  state.jumpPresses = 1;
  state.jumpWithHold = true;
  const events = stepHippoCourse(state, player, { move: 0, hold: false }, DT);
  const jump = events.find((event) => event.type === "jump");
  assert.equal(jump?.kind, "long");
  assert.equal(jump?.charge, 1);
});

test("the course is deterministic for a seed", () => {
  const a = makeHippoCourse(9);
  const b = makeHippoCourse(9);
  const pa = makePlayer();
  const pb = makePlayer();
  run(a, pa, longJumper(), (s) => s.won || s.lost, 40);
  run(b, pb, longJumper(), (s) => s.won || s.lost, 40);
  assert.deepEqual(pa, pb);
  assert.equal(a.won, b.won);
});
