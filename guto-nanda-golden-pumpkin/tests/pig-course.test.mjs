import assert from "node:assert/strict";
import test from "node:test";
import {
  PIG_BITE_CHUNK,
  PIG_BITE_GRACE,
  PIG_CLIMB_LENGTH,
  PIG_COUNT,
  PIG_FLOOR_Y,
  PIG_LEDGE_Y,
  PIG_PLAYER_START_X,
  PIG_SAFE_LEFT,
  PIG_SAFE_RIGHT,
  PIG_STILT_FULL,
  PIG_STILT_SNAP,
  PIG_TIP_MARGIN,
  PIG_VALLEY_DEPTH,
  PIG_VALLEY_LEFT,
  PIG_VALLEY_RIGHT,
  boulderTop,
  canClimbOut,
  chunksBitten,
  makePigCourse,
  pigPens,
  stepPigCourse,
} from "../app/pig-course.ts";

const DT = 1 / 60;

function makePlayer(x = PIG_PLAYER_START_X, y = PIG_LEDGE_Y) {
  return { x, y, vx: 0, vy: 0, facing: 1, onGround: true };
}

function floorPlayer(x) {
  return makePlayer(x, PIG_FLOOR_Y);
}

const idle = () => ({ move: 0, run: false, hold: false });

function run(state, player, controller, predicate, maxSeconds = 40) {
  const log = [];
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    const input = controller(state, player, elapsed, log);
    const events = stepPigCourse(state, player, input, DT);
    events.forEach((event) => log.push({ ...event, at: Number(elapsed.toFixed(2)) }));
    elapsed += DT;
    if (predicate(state, player, log)) break;
  }
  return { log, elapsed };
}

// Sprints right, vaulting each boulder as it comes into range.
function runner(sprint = true) {
  return (state, player) => {
    if (!player.onGround) return { move: 1, run: sprint, hold: false };
    const gaps = state.boulders
      .map((boulder) => boulder.x - PIG_TIP_MARGIN - player.x)
      .filter((gap) => gap > -6)
      .sort((a, b) => a - b);
    const next = gaps[0];
    if (next !== undefined && next <= 78 && next > 30) {
      state.jumpPresses += 1;
      state.jumpWithHold = true;
      return { move: 1, run: sprint, hold: true };
    }
    return { move: 1, run: sprint, hold: false };
  };
}

test("the valley is a real drop: the ledges sit a wall's height above the floor", () => {
  assert.equal(PIG_FLOOR_Y - PIG_LEDGE_Y, PIG_VALLEY_DEPTH);
  assert.ok(PIG_STILT_FULL > PIG_VALLEY_DEPTH, "fresh stilts are taller than the valley wall, plus some");
  assert.ok(PIG_CLIMB_LENGTH <= PIG_VALLEY_DEPTH, "the climb threshold is at the wall height (minus a scramble)");
  assert.ok(PIG_STILT_SNAP < PIG_CLIMB_LENGTH, "stilts become too short to climb before they snap");
  const state = makePigCourse(1);
  assert.equal(state.stilt, PIG_STILT_FULL);
  assert.equal(canClimbOut(state), true);
});

test("walking off the start ledge drops the walker onto the valley floor", () => {
  const state = makePigCourse(2);
  state.pigs = [];
  const player = makePlayer();
  const { log } = run(state, player, () => ({ move: 1, run: false, hold: false }), (_, __, events) => events.some((e) => e.type === "land"), 4);
  const landing = log.find((event) => event.type === "land");
  assert.ok(landing, "the walker lands");
  assert.equal(landing.on, "floor");
  assert.equal(player.y, PIG_FLOOR_Y);
  assert.ok(player.x > PIG_SAFE_LEFT, `the drop happens past the cliff edge (x=${player.x.toFixed(1)})`);
});

test("the runner crosses the valley and climbs out on every seed", () => {
  const results = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = makePigCourse(seed);
    const player = makePlayer();
    const { log, elapsed } = run(state, player, runner(), (s) => s.won || s.lost, 30);
    results.push({ seed, won: state.won, reason: state.lossReason, bites: state.bites, t: Number(elapsed.toFixed(1)) });
    if (state.won) {
      assert.ok(log.some((event) => event.type === "climb" && event.side === "right"), "the win comes from climbing the far wall");
      assert.equal(player.y, PIG_LEDGE_Y, "the winner stands on the high ground");
    }
  }
  assert.ok(results.every((result) => result.won), `a quick stilt-walker should cross: ${JSON.stringify(results)}`);
  assert.ok(results.every((result) => result.bites <= 1), `running keeps the bites away: ${JSON.stringify(results)}`);
});

test("a walker who never runs still makes it, at most lightly chewed", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const state = makePigCourse(seed);
    const player = makePlayer();
    run(state, player, runner(false), (s) => s.won || s.lost, 30);
    assert.equal(state.won, true, `seed ${seed} should still cross at a walk`);
    assert.ok(state.bites <= 2, `seed ${seed} took ${state.bites} bites at a walk`);
  }
});

test("standing on the valley floor lets the pigs chew the stilts down until they snap", () => {
  const state = makePigCourse(3);
  const player = makePlayer();
  // Drop into the first stretch, then freeze.
  const controller = (s, p) => (p.x < 300 ? { move: 1, run: false, hold: false } : idle());
  const { log } = run(state, player, controller, (s) => s.won || s.lost, 40);
  assert.equal(state.lost, true, "dawdling on the floor should be fatal");
  assert.ok(log.some((event) => event.type === "bite"));
  assert.ok(log.some((event) => event.type === "warn"), "a warning fires two bites before the wall height");
  assert.ok(log.some((event) => event.type === "trapped"), "the walker learns when the stilts are too short to climb out");
  assert.ok(state.stilt <= PIG_STILT_SNAP);
  const firstBite = log.find((event) => event.type === "bite");
  assert.ok(firstBite.at > 1.2, `the pigs take a moment to get going (first bite at ${firstBite.at}s)`);
});

test("each bite chews one chunk off the stilts and lowers the walker", () => {
  const state = makePigCourse(4);
  const player = floorPlayer(300);
  state.pigs = [state.pigs[0]];
  state.pigs[0].x = 300;
  state.pigs[0].biteCooldown = 0;
  state.pigs[0].state = "chase";
  const { log } = run(state, player, () => idle(), (_, __, events) => events.some((e) => e.type === "bite"), 3);
  const bite = log.find((event) => event.type === "bite");
  assert.ok(bite, "the adjacent pig bites");
  assert.equal(state.stilt, PIG_STILT_FULL - PIG_BITE_CHUNK);
  assert.equal(chunksBitten(state), 1);
  assert.equal(bite.stilt, state.stilt);
});

test("pigs never land more than one bite per grace window", () => {
  const state = makePigCourse(5);
  const player = floorPlayer(300);
  state.pigs.forEach((pig) => {
    pig.x = 300;
    pig.pen = { left: PIG_VALLEY_LEFT, right: PIG_VALLEY_RIGHT };
    pig.biteCooldown = 0;
  });
  const { log } = run(state, player, () => idle(), (s) => s.bites >= 3, 8);
  const bites = log.filter((event) => event.type === "bite").map((event) => event.at);
  assert.ok(bites.length >= 3, "three pigs on top of the walker still bite in turn");
  for (let index = 1; index < bites.length; index += 1) {
    assert.ok(bites[index] - bites[index - 1] >= PIG_BITE_GRACE - DT, `bites are spaced out (${bites.join(", ")})`);
  }
});

test("a pig that has just bitten stops to chew instead of chasing", () => {
  const state = makePigCourse(4);
  const player = floorPlayer(300);
  state.pigs = [state.pigs[0]];
  state.pigs[0].x = 300;
  state.pigs[0].biteCooldown = 0;
  state.pigs[0].state = "chase";
  run(state, player, () => idle(), (_, __, events) => events.some((e) => e.type === "bite"), 3);
  assert.equal(state.pigs[0].state, "chew");
  assert.ok(state.pigs[0].chewTimer > 0);
});

test("the top of a boulder is out of the pigs' reach", () => {
  const state = makePigCourse(6);
  const boulder = state.boulders[0];
  const player = makePlayer(boulder.x + boulder.width / 2, boulderTop(boulder));
  state.pigs.forEach((pig) => {
    pig.x = boulder.x - 20;
    pig.pen = { left: PIG_VALLEY_LEFT, right: PIG_VALLEY_RIGHT };
    pig.biteCooldown = 0;
  });
  run(state, player, () => idle(), () => false, 4);
  assert.equal(state.bites, 0, "nobody bites a walker resting on a rock");
  assert.equal(player.y, boulderTop(boulder));
  assert.ok(state.pigs.every((pig) => pig.state !== "chase"), "pigs lose interest in a walker they cannot reach");
});

test("each pig keeps to its own stretch of floor between the boulders", () => {
  const state = makePigCourse(7);
  const pens = pigPens(state.boulders);
  assert.equal(pens.length, state.boulders.length + 1);
  assert.equal(state.pigs.length, PIG_COUNT);
  state.pigs.forEach((pig, index) => {
    assert.equal(pig.pen.left, pens[index].left);
  });
  assert.equal(state.pigs[PIG_COUNT - 1].pen.right, PIG_VALLEY_RIGHT, "the last pig patrols all the way to the far wall");
  const player = floorPlayer(600);
  run(state, player, () => idle(), () => false, 12);
  state.pigs.forEach((pig) => {
    assert.ok(pig.x >= pig.pen.left - 0.01 && pig.x <= pig.pen.right + 0.01, `pig ${pig.id} stayed in its stretch (x=${pig.x.toFixed(1)})`);
  });
});

test("stilts at least as tall as the wall climb out; shorter stilts bump it", () => {
  const tall = makePigCourse(8);
  tall.pigs = [];
  tall.stilt = PIG_CLIMB_LENGTH;
  const climber = floorPlayer(PIG_SAFE_RIGHT - 80);
  const { log: tallLog } = run(tall, climber, () => ({ move: 1, run: true, hold: false }), (s) => s.won, 4);
  assert.equal(tall.won, true, "stilts exactly as tall as the climb length still get out");
  assert.ok(tallLog.some((event) => event.type === "climb" && event.side === "right"));
  assert.equal(climber.y, PIG_LEDGE_Y);
  assert.ok(climber.x >= PIG_SAFE_RIGHT);

  const short = makePigCourse(8);
  short.pigs = [];
  short.stilt = PIG_CLIMB_LENGTH - 1;
  const bumper = floorPlayer(PIG_SAFE_RIGHT - 80);
  const { log: shortLog } = run(short, bumper, () => ({ move: 1, run: true, hold: false }), (_, __, events) => events.filter((e) => e.type === "tooShort").length >= 2, 6);
  assert.equal(short.won, false, "one chunk too short and there is no way up");
  assert.ok(shortLog.some((event) => event.type === "tooShort" && event.side === "right"));
  assert.equal(bumper.y, PIG_FLOOR_Y, "the walker stays down on the floor");
  assert.ok(bumper.x < PIG_SAFE_RIGHT, `the wall holds (x=${bumper.x.toFixed(1)})`);
  assert.ok(short.tooShortBumps >= 2, "bump reminders are rate-limited but repeat");
});

test("a vault into the wall with short stilts is thrown back, never up", () => {
  const state = makePigCourse(9);
  state.pigs = [];
  state.stilt = PIG_STILT_SNAP + PIG_BITE_CHUNK;
  const player = floorPlayer(PIG_SAFE_RIGHT - 60);
  player.vx = 200;
  state.jumpPresses = 1;
  state.jumpWithHold = true;
  run(state, player, () => ({ move: 1, run: true, hold: true }), (_, p, events) => p.onGround && events.some((e) => e.type === "land"), 4);
  assert.equal(state.won, false);
  assert.equal(player.y, PIG_FLOOR_Y);
  assert.ok(player.x < PIG_SAFE_RIGHT, `the tips never land on the ledge (x=${player.x.toFixed(1)})`);
});

test("once the stilts are too short the whole herd is loose", () => {
  const state = makePigCourse(10);
  const player = floorPlayer(300);
  state.stilt = PIG_CLIMB_LENGTH;
  state.pigs[0].x = 300;
  state.pigs[0].biteCooldown = 0;
  state.pigs[0].state = "chase";
  const { log } = run(state, player, () => idle(), (_, __, events) => events.some((e) => e.type === "trapped"), 4);
  assert.ok(log.some((event) => event.type === "trapped"));
  assert.equal(state.trapped, true);
  assert.equal(canClimbOut(state), false);
  state.pigs.forEach((pig) => {
    assert.deepEqual(pig.pen, { left: PIG_VALLEY_LEFT, right: PIG_VALLEY_RIGHT });
  });
});

test("being trapped ends as a 'trapped' loss once the walker has bumped the wall", () => {
  const state = makePigCourse(11);
  state.stilt = PIG_CLIMB_LENGTH - PIG_BITE_CHUNK;
  state.trapped = true;
  state.pigs.forEach((pig) => {
    pig.pen = { left: PIG_VALLEY_LEFT, right: PIG_VALLEY_RIGHT };
  });
  const player = floorPlayer(PIG_SAFE_RIGHT - 60);
  run(state, player, () => ({ move: 1, run: true, hold: false }), (s) => s.lost, 30);
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "trapped");
});

test("a hop cannot clear a boulder but a running vault can", () => {
  const boulder = makePigCourse(1).boulders[0];
  const left = boulder.x - PIG_TIP_MARGIN;
  const right = boulder.x + boulder.width + PIG_TIP_MARGIN;

  const hopState = makePigCourse(1);
  hopState.pigs = [];
  const hopper = { x: left - 46, y: PIG_FLOOR_Y, vx: 240, vy: 0, facing: 1, onGround: true };
  hopState.jumpPresses = 1;
  hopState.jumpWithHold = false;
  run(hopState, hopper, () => ({ move: 1, run: true, hold: false }), (_, p) => p.onGround && p.vy === 0 && Math.abs(p.vx) < 30, 3);
  assert.ok(hopper.x < right, `a hop should be stopped by the boulder (x=${hopper.x.toFixed(1)}, right=${right})`);

  const vaultState = makePigCourse(1);
  vaultState.pigs = [];
  const vaulter = { x: left - 46, y: PIG_FLOOR_Y, vx: 240, vy: 0, facing: 1, onGround: true };
  vaultState.jumpPresses = 1;
  vaultState.jumpWithHold = true;
  run(vaultState, vaulter, () => ({ move: 1, run: true, hold: true }), (_, p) => p.onGround && p.x > right + 10, 3);
  assert.ok(vaulter.x > right, `a vault should carry the walker past the boulder (x=${vaulter.x.toFixed(1)}, right=${right})`);
});

test("a standing vault at a boulder lands on top of it, even with no direction held", () => {
  for (const move of [1, 0]) {
    const state = makePigCourse(1);
    state.pigs = [];
    const boulder = state.boulders[1];
    const left = boulder.x - PIG_TIP_MARGIN;
    const player = { x: left, y: PIG_FLOOR_Y, vx: 0, vy: 0, facing: 1, onGround: true };
    state.jumpPresses = 1;
    state.jumpWithHold = true;
    const { log } = run(state, player, () => ({ move, run: false, hold: true }), (_, __, events) => events.some((e) => e.type === "land"), 3);
    const landing = log.find((event) => event.type === "land");
    assert.equal(landing.on, "boulder", `move=${move}: a vault from the rock face should end on the rock`);
    assert.equal(player.y, boulderTop(boulder));
  }
});

test("a late running vault from the rock face still clears the boulder", () => {
  const state = makePigCourse(1);
  state.pigs = [];
  const boulder = state.boulders[0];
  const left = boulder.x - PIG_TIP_MARGIN;
  const right = boulder.x + boulder.width + PIG_TIP_MARGIN;
  // Launched only 24px before the face: the pole scrapes the rock on the way up,
  // then the run-up speed carries the tips over once they clear the top.
  const player = { x: left - 24, y: PIG_FLOOR_Y, vx: 250, vy: 0, facing: 1, onGround: true };
  state.jumpPresses = 1;
  state.jumpWithHold = true;
  const { log } = run(state, player, () => ({ move: 1, run: true, hold: true }), (_, __, events) => events.some((e) => e.type === "land"), 3);
  const landing = log.find((event) => event.type === "land");
  assert.equal(landing.on, "floor");
  assert.ok(player.x > right, `the walker comes down past the rock (x=${player.x.toFixed(1)}, right=${right})`);
});

test("a boulder-side bonk emits a blocked event and stops forward progress", () => {
  const state = makePigCourse(1);
  state.pigs = [];
  const boulder = state.boulders[0];
  const left = boulder.x - PIG_TIP_MARGIN;
  const player = { x: left - 120, y: PIG_FLOOR_Y, vx: 0, vy: 0, facing: 1, onGround: true };
  const { log } = run(state, player, () => ({ move: 1, run: true, hold: false }), (_, __, entries) => entries.some((e) => e.type === "blocked"), 3);
  assert.ok(Math.abs(player.x - left) < 1.5, `the walker halts at the boulder face (x=${player.x.toFixed(1)})`);
  assert.ok(log.some((event) => event.type === "blocked"));
});

test("pigs only bite down in the valley, never on the high ground", () => {
  const state = makePigCourse(2);
  const player = makePlayer(PIG_PLAYER_START_X);
  state.pigs = [state.pigs[0]];
  state.pigs[0].x = PIG_VALLEY_LEFT;
  state.pigs[0].pen = { left: PIG_VALLEY_LEFT, right: PIG_VALLEY_RIGHT };
  run(state, player, () => idle(), () => false, 3);
  assert.equal(state.stilt, PIG_STILT_FULL, "the start ledge is safe");
  assert.equal(state.bites, 0);
  assert.equal(state.pigs[0].state, "roam");
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
    // Hop apex ~62px, vault apex ~141px above the floor.
    assert.ok(PIG_FLOOR_Y - top > 62, "a hop cannot clear the boulder");
    assert.ok(PIG_FLOOR_Y - top < 141, "a vault can clear the boulder");
  }
});
