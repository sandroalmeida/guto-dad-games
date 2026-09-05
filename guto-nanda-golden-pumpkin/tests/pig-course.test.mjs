import assert from "node:assert/strict";
import test from "node:test";
import {
  PIG_BITE_DAMAGE,
  PIG_FINISH_X,
  PIG_GROUND_Y,
  PIG_MAX_STILT,
  PIG_PLAYER_START_X,
  PIG_SAFE_LEFT,
  PIG_TIP_MARGIN,
  boulderTop,
  makePigCourse,
  stepPigCourse,
} from "../app/pig-course.ts";

const DT = 1 / 60;

function makePlayer(x = PIG_PLAYER_START_X) {
  return { x, y: PIG_GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true };
}

const idle = () => ({ move: 0, run: false, hold: false });

function run(state, player, controller, predicate, maxSeconds = 40) {
  const log = [];
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    const input = controller(state, player, elapsed);
    const events = stepPigCourse(state, player, input, DT);
    events.forEach((event) => log.push({ ...event, at: Number(elapsed.toFixed(2)) }));
    elapsed += DT;
    if (predicate(state, player, log)) break;
  }
  return { log, elapsed };
}

// Sprints right, vaulting each boulder as it comes into range.
function runner() {
  return (state, player) => {
    if (!player.onGround) return { move: 1, run: true, hold: false };
    const gaps = state.boulders
      .map((boulder) => boulder.x - PIG_TIP_MARGIN - player.x)
      .filter((gap) => gap > -6)
      .sort((a, b) => a - b);
    const next = gaps[0];
    if (next !== undefined && next <= 78 && next > 30) {
      state.jumpPresses += 1;
      state.jumpWithHold = true;
      return { move: 1, run: true, hold: true };
    }
    return { move: 1, run: true, hold: false };
  };
}

test("the runner crosses the valley on every seed", () => {
  const results = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = makePigCourse(seed);
    const player = makePlayer();
    const { elapsed } = run(state, player, runner(), (s) => s.won || s.lost, 30);
    results.push({ seed, won: state.won, reason: state.lossReason, bites: state.bites, t: Number(elapsed.toFixed(1)) });
  }
  assert.ok(results.every((result) => result.won), `a quick stilt-walker should cross: ${JSON.stringify(results)}`);
});

test("standing in the valley lets the pigs chew through the stilts", () => {
  const state = makePigCourse(3);
  const player = makePlayer();
  // Walk into the valley (past the safe ledge, before the first boulder), then freeze.
  const controller = (s, p) => (p.x < 300 ? { move: 1, run: false, hold: false } : idle());
  const { log } = run(state, player, controller, (s) => s.won || s.lost, 25);
  assert.equal(state.lost, true, "dawdling in the valley should be fatal");
  assert.equal(state.lossReason, "stilts");
  assert.ok(log.some((event) => event.type === "bite"));
  assert.ok(log.some((event) => event.type === "warn"), "a warning fires as the stilts get low");
  assert.ok(state.stilt <= 0);
});

test("a hop cannot clear a boulder but a vault can", () => {
  const boulder = makePigCourse(1).boulders[0];
  const left = boulder.x - PIG_TIP_MARGIN;
  const right = boulder.x + boulder.width + PIG_TIP_MARGIN;

  const hopState = makePigCourse(1);
  hopState.pigs = [];
  const hopper = { x: left - 46, y: PIG_GROUND_Y, vx: 240, vy: 0, facing: 1, onGround: true };
  hopState.jumpPresses = 1;
  hopState.jumpWithHold = false;
  run(hopState, hopper, () => ({ move: 1, run: true, hold: false }), (_, p) => p.onGround && p.vy === 0 && Math.abs(p.vx) < 30, 3);
  assert.ok(hopper.x < right, `a hop should be stopped by the boulder (x=${hopper.x.toFixed(1)}, right=${right})`);

  const vaultState = makePigCourse(1);
  vaultState.pigs = [];
  const vaulter = { x: left - 46, y: PIG_GROUND_Y, vx: 240, vy: 0, facing: 1, onGround: true };
  vaultState.jumpPresses = 1;
  vaultState.jumpWithHold = true;
  run(vaultState, vaulter, () => ({ move: 1, run: true, hold: true }), (_, p) => p.onGround && p.x > right + 10, 3);
  assert.ok(vaulter.x > right, `a vault should carry the walker past the boulder (x=${vaulter.x.toFixed(1)}, right=${right})`);
});

test("a boulder-side bonk emits a blocked event and stops forward progress", () => {
  const state = makePigCourse(1);
  state.pigs = [];
  const boulder = state.boulders[0];
  const left = boulder.x - PIG_TIP_MARGIN;
  const player = { x: left - 120, y: PIG_GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true };
  const { log } = run(state, player, () => ({ move: 1, run: true, hold: false }), (_, __, entries) => entries.some((e) => e.type === "blocked"), 3);
  assert.ok(Math.abs(player.x - left) < 1.5, `the walker halts at the boulder face (x=${player.x.toFixed(1)})`);
  assert.ok(log.some((event) => event.type === "blocked"));
});

test("pigs only bite while the walker is off the safe ledge", () => {
  const state = makePigCourse(2);
  const player = makePlayer(PIG_PLAYER_START_X);
  // A pig parked right under the start ledge should not be able to bite.
  state.pigs = [state.pigs[0]];
  state.pigs[0].x = PIG_SAFE_LEFT - 20;
  run(state, player, () => idle(), () => false, 3);
  assert.equal(state.stilt, PIG_MAX_STILT, "the start ledge is safe");
  assert.equal(state.bites, 0);
});

test("a single bite removes exactly one chunk of stilt integrity", () => {
  const state = makePigCourse(4);
  const player = makePlayer(320);
  state.pigs = [state.pigs[0]];
  state.pigs[0].x = 320;
  state.pigs[0].biteCooldown = 0;
  const { log } = run(state, player, () => idle(), (_, __, events) => events.some((e) => e.type === "bite"), 2);
  const bite = log.find((event) => event.type === "bite");
  assert.ok(bite, "the adjacent pig bites");
  assert.ok(Math.abs(state.stilt - (PIG_MAX_STILT - PIG_BITE_DAMAGE)) < 1e-9);
});

test("reaching the far ledge wins", () => {
  const state = makePigCourse(5);
  state.pigs = [];
  const player = makePlayer(PIG_FINISH_X - 40);
  const { log } = run(state, player, () => ({ move: 1, run: true, hold: false }), (s) => s.won, 4);
  assert.equal(state.won, true);
  assert.ok(log.some((event) => event.type === "won"));
});

test("the course is deterministic for a seed", () => {
  const a = makePigCourse(7);
  const b = makePigCourse(7);
  const pa = makePlayer();
  const pb = makePlayer();
  run(a, pa, runner(), (s) => s.won || s.lost, 30);
  run(b, pb, runner(), (s) => s.won || s.lost, 30);
  assert.deepEqual(pa, pb);
  assert.equal(a.won, b.won);
  assert.equal(a.stilt, b.stilt);
  assert.deepEqual(a.pigs, b.pigs);
});

test("boulders sit high enough that only a vault clears them", () => {
  for (const boulder of makePigCourse(1).boulders) {
    const top = boulderTop(boulder);
    // Hop apex ~62px, vault apex ~141px above the ground line.
    assert.ok(PIG_GROUND_Y - top > 62, "a hop cannot clear the boulder");
    assert.ok(PIG_GROUND_Y - top < 141, "a vault can clear the boulder");
  }
});
