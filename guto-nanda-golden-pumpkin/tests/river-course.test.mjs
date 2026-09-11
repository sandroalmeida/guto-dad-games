import assert from "node:assert/strict";
import test from "node:test";
import {
  RIVER_CURRENT,
  RIVER_LEFT_BANK,
  RIVER_LOG_LENGTH,
  RIVER_RIGHT_BANK,
  RIVER_SPIN_MAX,
  RIVER_SPIN_THRUST,
  RIVER_START_X,
  RIVER_START_Y,
  RIVER_STEP_MARGIN,
  RIVER_TOP,
  RIVER_WATERFALL_Y,
  chooseHopTarget,
  logAxis,
  logContains,
  logEndpoints,
  makeRiverCourse,
  ridingLog,
  riverHeadroom,
  riverProgress,
  stepRiverCourse,
} from "../app/river-course.ts";

const DT = 1 / 60;

function makePlayer(x = RIVER_START_X, y = RIVER_START_Y) {
  return { x, y, vx: 0, vy: 0, facing: 1, onGround: true };
}

const idle = () => ({ move: 0, aim: 0 });

function run(state, player, controller, predicate, maxSeconds = 40) {
  const log = [];
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    const input = controller(state, player, elapsed, log) ?? idle();
    const events = stepRiverCourse(state, player, input, DT);
    events.forEach((event) => log.push({ ...event, at: Number(elapsed.toFixed(2)) }));
    elapsed += DT;
    if (predicate(state, player, log)) break;
  }
  return { log, elapsed };
}

// Ride the log the bot is on toward the far bank, hopping to a fresh forward log
// whenever the current one is a sinker or a noticeably better log floats within
// reach; aim hops upstream when the falls are getting close.
function crosser() {
  let hopCooldown = 0;
  return (state, player) => {
    if (state.hopping) {
      hopCooldown = 0.15;
      return idle();
    }
    hopCooldown = Math.max(0, hopCooldown - DT);
    const log = ridingLog(state);
    const headroom = riverHeadroom(player.y);
    const aim = headroom < 0.45 ? -1 : 0;
    const target = chooseHopTarget(state, player.x, player.y, aim);

    let wantHop = false;
    if (!log) {
      wantHop = !!target; // on the start bank, board the first log
    } else if (hopCooldown <= 0 && target) {
      const forwardGain = target.x - player.x;
      if (log.kind === "sink") wantHop = true;
      else if (headroom < 0.32 && log.roll.y >= 0) wantHop = true;
      else if (forwardGain > 150 && headroom > 0.3) wantHop = true;
    }

    if (wantHop) {
      state.jumpPresses += 1;
      return { move: 0, aim };
    }
    if (log && log.kind === "sink" && headroom < 0.5) {
      return { move: -1, aim }; // back-spin a sinker to climb (retreating left)
    }
    return { move: 1, aim };
  };
}

test("the river is a real gauntlet: banks apart, a source above the falls", () => {
  assert.ok(RIVER_RIGHT_BANK - RIVER_LEFT_BANK > 700, "the banks are a full river apart");
  assert.ok(RIVER_WATERFALL_Y > RIVER_TOP + 300, "there is real height to lose to the current");
  const state = makeRiverCourse(1);
  assert.equal(state.onBank, "start");
  assert.equal(state.ridingLogId, null);
  assert.ok(state.logs.length >= 5, "the river already has logs drifting");
});

test("a log capsule follows its length, and its axis is perpendicular to the roll", () => {
  const state = makeRiverCourse(1);
  const cross = { ...state.logs[0], x: 500, y: 300, roll: { x: 1, y: 0 }, length: RIVER_LOG_LENGTH };
  const axis = logAxis(cross);
  // roll (1,0) => the log lies vertically on screen, axis (0,1).
  assert.ok(Math.abs(axis.x) < 1e-9 && Math.abs(axis.y - 1) < 1e-9);
  const [a, b] = logEndpoints(cross);
  assert.ok(Math.abs(a.y - (300 - RIVER_LOG_LENGTH / 2)) < 1e-6);
  assert.ok(Math.abs(b.y - (300 + RIVER_LOG_LENGTH / 2)) < 1e-6);
  assert.equal(logContains(cross, 500, 300), true, "the centre is on the log");
  assert.equal(logContains(cross, 500, 300 - RIVER_LOG_LENGTH / 2 + 4), true, "an endpoint is on the log");
  assert.equal(logContains(cross, 500 + 60, 300), false, "a point off to the side is in the water");
});

test("forward spin propels along the log's roll; the current always tugs down", () => {
  // Cross log: forward spin moves the rider straight toward END, still sinking.
  const cross = makeRiverCourse(2);
  cross.logs = [{ id: 0, x: 500, y: 260, roll: { x: 1, y: 0 }, kind: "cross", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  cross.ridingLogId = 0;
  cross.onBank = null;
  const cp = makePlayer(500, 260);
  run(cross, cp, () => ({ move: 1, aim: 0 }), (s) => Math.abs(ridingLog(s)?.spin ?? 0) >= RIVER_SPIN_MAX - 0.2, 3);
  assert.ok(cp.x > 520, `forward spin on a cross log drives toward END (x=${cp.x.toFixed(1)})`);
  assert.ok(cp.vy > 0, "the current keeps pulling the cross log downstream");

  // Climb log: forward spin gains height while still crossing.
  const climb = makeRiverCourse(2);
  climb.logs = [{ id: 0, x: 500, y: 320, roll: { x: 0.7071, y: -0.7071 }, kind: "climb", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  climb.ridingLogId = 0;
  climb.onBank = null;
  const lp = makePlayer(500, 320);
  run(climb, lp, () => ({ move: 1, aim: 0 }), (s) => Math.abs(ridingLog(s)?.spin ?? 0) >= RIVER_SPIN_MAX - 0.2, 3);
  assert.ok(lp.x > 520, "a climb log still carries you toward END");
  assert.ok(lp.y < 320, `a climb log claws back height against the current (y=${lp.y.toFixed(1)})`);

  // Brake log: forward spin is pure upstream, no crossing.
  const brake = makeRiverCourse(2);
  brake.logs = [{ id: 0, x: 500, y: 360, roll: { x: 0, y: -1 }, kind: "brake", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  brake.ridingLogId = 0;
  brake.onBank = null;
  const bp = makePlayer(500, 360);
  run(brake, bp, () => ({ move: 1, aim: 0 }), (s) => Math.abs(ridingLog(s)?.spin ?? 0) >= RIVER_SPIN_MAX - 0.2, 3);
  assert.ok(Math.abs(bp.x - 500) < 4, "a brake log makes no crossing progress");
  assert.ok(bp.y < 360, "a brake log fights the falls");
});

test("the opposite arrow bleeds the spin off and can reverse it", () => {
  const state = makeRiverCourse(3);
  state.logs = [{ id: 0, x: 500, y: 260, roll: { x: 1, y: 0 }, kind: "cross", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  state.ridingLogId = 0;
  state.onBank = null;
  const player = makePlayer(500, 260);
  // Wind up forward for half a second...
  run(state, player, () => ({ move: 1, aim: 0 }), () => false, 0.5);
  const spun = ridingLog(state).spin;
  assert.ok(spun > 1, `the log is spinning forward (${spun.toFixed(2)})`);
  // ...then hold the opposite arrow and watch it cross zero and reverse.
  run(state, player, () => ({ move: -1, aim: 0 }), (s) => (ridingLog(s)?.spin ?? 0) < -1, 2);
  assert.ok(ridingLog(state).spin < -1, "back-spin reverses the log");
});

test("letting go of the arrows lets the spin wind down on its own", () => {
  const state = makeRiverCourse(3);
  state.logs = [{ id: 0, x: 500, y: 260, roll: { x: 1, y: 0 }, kind: "cross", spin: 5, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  state.ridingLogId = 0;
  state.onBank = null;
  const player = makePlayer(500, 260);
  run(state, player, () => idle(), (s) => (ridingLog(s)?.spin ?? 0) < 0.5, 4);
  assert.ok(ridingLog(state).spin < 0.5, "idle spin decays toward a stop");
});

test("sitting on a drifting log is fatal — the current carries you over the falls", () => {
  const state = makeRiverCourse(4);
  state.logs = [{ id: 0, x: 500, y: 300, roll: { x: 1, y: 0 }, kind: "cross", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  state.ridingLogId = 0;
  state.onBank = null;
  const player = makePlayer(500, 300);
  const { log } = run(state, player, () => idle(), (s) => s.won || s.lost, 30);
  assert.equal(state.lost, true, "doing nothing loses");
  assert.equal(state.lossReason, "waterfall");
  assert.ok(log.some((e) => e.type === "warn"), "the falls are announced before they take you");
  const fatal = log.find((e) => e.type === "lost");
  assert.ok(fatal.at > 4, `the current takes a while to reach the lip (over the falls at ${fatal.at}s)`);
});

test("a hop with no log in reach drops you into the piranhas", () => {
  const state = makeRiverCourse(5);
  // Clear the river so nothing can be a landing spot.
  state.logs = [{ id: 0, x: 500, y: 300, roll: { x: 1, y: 0 }, kind: "cross", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  state.ridingLogId = 0;
  state.onBank = null;
  const player = makePlayer(500, 300);
  state.jumpPresses = 1;
  const { log } = run(state, player, () => idle(), (s) => s.won || s.lost, 3);
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "piranha");
  assert.ok(log.some((e) => e.type === "hop"));
});

test("a hop lands squarely on the log it aimed at", () => {
  const state = makeRiverCourse(6);
  state.logs = [
    { id: 0, x: 400, y: 300, roll: { x: 1, y: 0 }, kind: "cross", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 },
    { id: 1, x: 560, y: 300, roll: { x: 0.7071, y: -0.7071 }, kind: "climb", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 },
  ];
  state.ridingLogId = 0;
  state.onBank = null;
  const player = makePlayer(400, 300);
  const target = chooseHopTarget(state, player.x, player.y, 0);
  assert.equal(target?.id, 1, "the forward climb log is the natural hop target");
  state.jumpPresses = 1;
  run(state, player, () => idle(), (s) => s.ridingLogId === 1 || s.lost, 2);
  assert.equal(state.ridingLogId, 1, "the hop boards the forward log");
  assert.equal(state.lost, false);
});

test("riding a cross log into the far bank wins", () => {
  const state = makeRiverCourse(7);
  state.logs = [{ id: 0, x: RIVER_RIGHT_BANK - 90, y: 200, roll: { x: 1, y: 0 }, kind: "cross", spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 }];
  state.ridingLogId = 0;
  state.onBank = null;
  const player = makePlayer(RIVER_RIGHT_BANK - 90, 200);
  run(state, player, () => ({ move: 1, aim: 0 }), (s) => s.won || s.lost, 6);
  assert.equal(state.won, true, "spinning a cross log to the edge steps onto END");
  assert.ok(player.x >= RIVER_RIGHT_BANK, "the winner stands on the far bank");
});

test("a skilled crossing wins on every seed; idling never does", () => {
  const wins = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = makeRiverCourse(seed);
    const player = makePlayer();
    const { elapsed } = run(state, player, crosser(), (s) => s.won || s.lost, 45);
    wins.push({ seed, won: state.won, reason: state.lossReason, hops: state.hops, t: Number(elapsed.toFixed(1)) });
  }
  assert.ok(wins.every((w) => w.won), `a spin-and-hop crossing should clear every seed: ${JSON.stringify(wins)}`);
  assert.ok(wins.every((w) => w.hops >= 2), "a real crossing takes several hops between logs");
});

test("the course is deterministic for a seed", () => {
  const a = makeRiverCourse(9);
  const b = makeRiverCourse(9);
  const pa = makePlayer();
  const pb = makePlayer();
  run(a, pa, crosser(), (s) => s.won || s.lost, 45);
  run(b, pb, crosser(), (s) => s.won || s.lost, 45);
  assert.deepEqual(pa, pb);
  assert.equal(a.won, b.won);
  assert.equal(a.furthestX, b.furthestX);
  assert.deepEqual(a.logs, b.logs);
});

test("progress and headroom read the crossing the way the HUD will", () => {
  const state = makeRiverCourse(1);
  assert.ok(riverProgress(state) < 0.05, "you start pinned to the near bank");
  assert.equal(riverHeadroom(RIVER_TOP), 1);
  assert.equal(riverHeadroom(RIVER_WATERFALL_Y), 0);
  assert.ok(RIVER_SPIN_MAX * RIVER_SPIN_THRUST > RIVER_CURRENT, "a fully spun log outruns the current");
});
