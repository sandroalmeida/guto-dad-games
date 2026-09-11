import assert from "node:assert/strict";
import test from "node:test";
import {
  RIVER_BANK_MIN_Y,
  RIVER_CURRENT,
  RIVER_HOP_SPEED,
  RIVER_HOP_STEER,
  RIVER_HOP_TIME,
  RIVER_LEFT_BANK,
  RIVER_LOG_LENGTH,
  RIVER_MIN_DRIFT,
  RIVER_RIGHT_BANK,
  RIVER_SPIN_MAX,
  RIVER_START_X,
  RIVER_START_Y,
  RIVER_TOP,
  RIVER_WATERFALL_Y,
  logAxis,
  logContains,
  logEndpoints,
  makeRiverCourse,
  reachableLogs,
  ridingLog,
  riverHeadroom,
  riverProgress,
  stepRiverCourse,
} from "../app/river-course.ts";

const DT = 1 / 60;

function makePlayer(x = RIVER_START_X, y = RIVER_START_Y) {
  return { x, y, vx: 0, vy: 0, facing: 1, onGround: true };
}
const idle = () => ({ moveX: 0, moveY: 0 });
const dir = (d) => (d > 16 ? 1 : d < -16 ? -1 : 0);

function makeLog(id, x, y, kind, rollX, rollY) {
  return { id, x, y, roll: { x: rollX, y: rollY }, kind, spin: 0, length: RIVER_LOG_LENGTH, radius: 15, bob: 0 };
}

function run(state, player, controller, predicate, maxSeconds = 60) {
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

// A skilled-player proxy. It plays the crossing as a stepping-stone puzzle:
// spin forward to make ground, but keep hopping up-and-forward to fresher logs
// before the current drags it under. Crucially it *judges each jump first* —
// simulating the leap and only committing to hops it can actually land — the
// way a person eyes a gap before jumping. Nothing in the game lines it up.
function hopLands(px, py, target) {
  let x = px;
  let y = py;
  const drift = (t) => ({ x: target.x, y: target.y + RIVER_CURRENT * t });
  const a = drift(0.2);
  let ax = dir(a.x - x);
  let ay = dir(a.y - y);
  if (!ax && !ay) ax = 1;
  let len = Math.hypot(ax, ay) || 1;
  let vx = (ax / len) * RIVER_HOP_SPEED;
  let vy = (ay / len) * RIVER_HOP_SPEED;
  let t = 0;
  while (t < RIVER_HOP_TIME) {
    const g = drift(Math.min(RIVER_HOP_TIME, t + 0.15));
    const mx = dir(g.x - x);
    const my = dir(g.y - y);
    if (mx || my) {
      len = Math.hypot(mx, my) || 1;
      const blend = Math.min(1, DT * RIVER_HOP_STEER);
      vx += ((mx / len) * RIVER_HOP_SPEED - vx) * blend;
      vy += ((my / len) * RIVER_HOP_SPEED - vy) * blend;
    }
    x += vx * DT;
    y += vy * DT;
    t += DT;
  }
  const landed = drift(RIVER_HOP_TIME);
  return logContains({ ...target, x: landed.x, y: landed.y }, x, y);
}

function crosser() {
  let targetId = null;
  const kindBonus = (k) => (k === "climb" ? 24 : k === "cross" ? 12 : k === "brake" ? -16 : -90);
  return (state, player) => {
    if (state.hopping) {
      const t = state.logs.find((l) => l.id === targetId);
      if (!t) return { moveX: 1, moveY: 0 };
      return { moveX: dir(t.x - player.x), moveY: dir(t.y + RIVER_CURRENT * 0.22 - player.y) };
    }
    const log = ridingLog(state);
    const hr = riverHeadroom(player.y);
    if (log && player.x > 900 && hr > 0.34 && log.roll.x > 0.25) return { moveX: 1, moveY: 0 };

    const landable = reachableLogs(state, player.x, player.y)
      .filter((l) => hopLands(player.x, player.y, l))
      .map((l) => ({ l, v: (l.x - player.x) * 0.5 + (player.y - l.y) * 0.85 + kindBonus(l.kind) - Math.hypot(l.x - player.x, l.y - player.y) * 0.15 }))
      .sort((a, b) => b.v - a.v);
    const best = landable[0]?.l ?? null;
    const up = landable.filter((e) => e.l.y < player.y - 8)[0]?.l ?? null;

    let hop = null;
    if (!log) hop = best; // on the bank, board the first log
    else if (log.kind === "sink") hop = best;
    else if (hr < 0.6 && up) hop = up; // climb before the falls
    else if (hr < 0.3 && best) hop = best;
    else if (up && (up.x - player.x) + (player.y - up.y) > 70) hop = up;

    if (hop) {
      targetId = hop.id;
      state.jumpPresses += 1;
      return { moveX: dir(hop.x - player.x), moveY: dir(hop.y - player.y) };
    }
    return { moveX: 1, moveY: 0 };
  };
}

test("the river is a real gauntlet: banks apart, a source above the falls", () => {
  assert.ok(RIVER_RIGHT_BANK - RIVER_LEFT_BANK > 700, "the banks are a full river apart");
  assert.ok(RIVER_WATERFALL_Y > RIVER_TOP + 300, "there is real height to lose to the current");
  const state = makeRiverCourse(1);
  assert.equal(state.onBank, "start");
  assert.equal(state.ridingLogId, null);
  assert.ok(state.logs.length >= 7, "the river already has logs drifting");
  assert.ok(state.piranhas.length >= 8, "and a shoal of piranhas");
});

test("a log capsule follows its length, and its axis is perpendicular to the roll", () => {
  const cross = makeLog(0, 500, 300, "cross", 1, 0);
  const axis = logAxis(cross);
  assert.ok(Math.abs(axis.x) < 1e-9 && Math.abs(axis.y - 1) < 1e-9);
  const [a, b] = logEndpoints(cross);
  assert.ok(Math.abs(a.y - (300 - RIVER_LOG_LENGTH / 2)) < 1e-6);
  assert.ok(Math.abs(b.y - (300 + RIVER_LOG_LENGTH / 2)) < 1e-6);
  assert.equal(logContains(cross, 500, 300), true);
  assert.equal(logContains(cross, 500 + 60, 300), false, "a point off to the side is in the water");
});

test("spin drives you along the roll, but the current always tugs you down", () => {
  const distances = {};
  for (const [kind, rx, ry] of [["cross", 1, 0], ["climb", 0.7071, -0.7071], ["brake", 0, -1]]) {
    const state = makeRiverCourse(2);
    state.logs = [makeLog(0, 500, 240, kind, rx, ry)];
    state.piranhas = [];
    state.ridingLogId = 0;
    state.onBank = null;
    const p = makePlayer(500, 240);
    run(state, p, () => ({ moveX: 1, moveY: 0 }), () => false, 2);
    distances[kind] = { dx: p.x - 500, dy: p.y - 240 };
    assert.ok(p.y > 240, `${kind}: the current still pulls you down (never rises)`);
  }
  assert.ok(distances.cross.dx > 40, "a cross log carries you toward END");
  assert.ok(distances.climb.dx > 30, "a climb log crosses too");
  assert.ok(Math.abs(distances.brake.dx) < 8, "a brake log makes no crossing progress");
  assert.ok(distances.climb.dy < distances.cross.dy, "a climb log slows the fall more than a cross log");
});

test("no spin can climb against the current — the best log only slows the fall", () => {
  const state = makeRiverCourse(3);
  state.logs = [makeLog(0, 500, 300, "brake", 0, -1)];
  state.piranhas = [];
  state.ridingLogId = 0;
  state.onBank = null;
  const p = makePlayer(500, 300);
  run(state, p, () => ({ moveX: 1, moveY: 0 }), () => false, 3);
  assert.ok(p.y > 300, "even a fully-spun brake log keeps sinking");
  const perSecond = (p.y - 300) / 3;
  assert.ok(perSecond >= RIVER_MIN_DRIFT - 3, "it never falls slower than the minimum drift");
  assert.ok(perSecond < RIVER_CURRENT, "but the best log does slow the fall below the raw current");
});

test("the opposite arrow bleeds the spin off and can reverse it", () => {
  const state = makeRiverCourse(4);
  state.logs = [makeLog(0, 500, 200, "cross", 1, 0)];
  state.piranhas = [];
  state.ridingLogId = 0;
  state.onBank = null;
  const p = makePlayer(500, 200);
  run(state, p, () => ({ moveX: 1, moveY: 0 }), () => false, 0.6);
  assert.ok(ridingLog(state).spin > 1, "the log winds up forward");
  run(state, p, () => ({ moveX: -1, moveY: 0 }), (s) => (ridingLog(s)?.spin ?? 0) < -1, 2);
  assert.ok(ridingLog(state).spin < -1, "back-spin reverses it");
});

test("you can walk the near bank with the arrows before you ever touch a log", () => {
  const state = makeRiverCourse(5);
  state.piranhas = [];
  const p = makePlayer(96, 300);
  run(state, p, () => ({ moveX: 1, moveY: -1 }), () => false, 1);
  assert.ok(p.y < 300, "up walks you upstream along the bank");
  assert.ok(p.x > 96 && p.x <= RIVER_LEFT_BANK - 5, "right walks you to the water's edge, not past it");
  run(state, p, () => ({ moveX: 0, moveY: -1 }), () => p.y <= RIVER_BANK_MIN_Y + 1, 4);
  assert.ok(p.y <= RIVER_BANK_MIN_Y + 1, "the bank has a top edge you can't walk past");
  assert.equal(state.ridingLogId, null);
  assert.equal(state.hops, 0, "walking is not jumping");
});

test("a hop is aimed and steered onto a log — nothing lines it up for you", () => {
  const state = makeRiverCourse(6);
  state.piranhas = [];
  state.logs = [makeLog(0, 260, 300, "cross", 1, 0)];
  const p = makePlayer(100, 300);
  // Steer the leap toward the drifting log by hand.
  let targetId = 0;
  const { log } = run(
    state,
    p,
    (s, pl) => {
      if (!s.hopping && s.ridingLogId === null && s.onBank === "start") { s.jumpPresses += 1; const t = s.logs.find((l) => l.id === targetId); return { moveX: dir(t.x - pl.x), moveY: dir(t.y - pl.y) }; }
      if (s.hopping) { const t = s.logs.find((l) => l.id === targetId); return t ? { moveX: dir(t.x - pl.x), moveY: dir(t.y - pl.y) } : idle(); }
      return idle();
    },
    (s) => s.ridingLogId === 0 || s.lost,
    3,
  );
  assert.equal(state.ridingLogId, 0, "the steered hop boards the log");
  assert.ok(log.some((e) => e.type === "board"));
});

test("a hop into open water drops you to the piranhas — there is no auto-catch", () => {
  const state = makeRiverCourse(7);
  state.piranhas = [];
  state.logs = [makeLog(0, 500, 300, "cross", 1, 0)];
  state.ridingLogId = 0;
  state.onBank = null;
  const p = makePlayer(500, 300);
  state.jumpPresses = 1;
  const { log } = run(state, p, () => ({ moveX: 1, moveY: 0 }), (s) => s.won || s.lost, 3);
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "piranha");
  assert.ok(log.some((e) => e.type === "hop"));
});

test("sitting on a drifting log is fatal — the current carries you over the falls", () => {
  const state = makeRiverCourse(8);
  state.logs = [makeLog(0, 500, 260, "cross", 1, 0)];
  state.piranhas = [];
  state.ridingLogId = 0;
  state.onBank = null;
  const p = makePlayer(500, 260);
  const { log } = run(state, p, () => idle(), (s) => s.won || s.lost, 30);
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "waterfall");
  assert.ok(log.some((e) => e.type === "warn"), "the falls are announced first");
});

test("riding a cross log into the far bank wins", () => {
  const state = makeRiverCourse(9);
  state.logs = [makeLog(0, RIVER_RIGHT_BANK - 70, 180, "cross", 1, 0)];
  state.piranhas = [];
  state.ridingLogId = 0;
  state.onBank = null;
  const p = makePlayer(RIVER_RIGHT_BANK - 70, 180);
  run(state, p, () => ({ moveX: 1, moveY: 0 }), (s) => s.won || s.lost, 6);
  assert.equal(state.won, true);
  assert.ok(p.x >= RIVER_RIGHT_BANK, "the winner stands on the far bank");
});

test("piranhas hunt the explorer and swarm in once someone falls", () => {
  const state = makeRiverCourse(10);
  const p = makePlayer(500, 300);
  state.logs = [makeLog(0, 500, 300, "cross", 1, 0)];
  state.ridingLogId = 0;
  state.onBank = null;
  run(state, p, () => idle(), () => false, 3);
  const near = state.piranhas.filter((f) => Math.hypot(f.x - p.x, f.y - p.y) < 160).length;
  assert.ok(near >= 4, `the shoal closes in on the explorer (${near} near)`);
  // Now drop the player in and watch them converge.
  state.lost = true;
  state.lossReason = "piranha";
  run(state, p, () => idle(), () => false, 1.2);
  const swarm = state.piranhas.filter((f) => Math.hypot(f.x - p.x, f.y - p.y) < 60).length;
  assert.ok(swarm >= 4, `they frenzy onto a fallen explorer (${swarm} on top)`);
});

test("a skilled crossing wins most seeds, and every win takes real hopping", () => {
  const wins = [];
  for (let seed = 1; seed <= 24; seed += 1) {
    const state = makeRiverCourse(seed);
    const player = makePlayer();
    run(state, player, crosser(), (s) => s.won || s.lost, 70);
    wins.push({ seed, won: state.won, hops: state.hops });
  }
  const won = wins.filter((w) => w.won);
  // Winnable with skill (~80% for this proxy), but never trivial.
  assert.ok(won.length >= 16, `a skilled spin-and-hop crossing should clear most seeds: ${won.length}/24`);
  assert.ok(won.every((w) => w.hops >= 3), "no single log carries you across — every win is a chain of hops");
});

test("greedily riding a fresh log with no hopping never gets you across", () => {
  // Board the first log and just spin forward: the current always wins.
  let lost = 0;
  for (let seed = 1; seed <= 8; seed += 1) {
    const state = makeRiverCourse(seed);
    const player = makePlayer();
    run(
      state,
      player,
      (s) => {
        if (s.onBank === "start") { s.jumpPresses += 1; return { moveX: 1, moveY: 0 }; }
        return { moveX: 1, moveY: 0 };
      },
      (s) => s.won || s.lost,
      70,
    );
    if (!state.won) lost += 1;
  }
  assert.equal(lost, 8, "spinning one log forever always ends in the water or the falls");
});

test("the course is deterministic for a seed", () => {
  const a = makeRiverCourse(12);
  const b = makeRiverCourse(12);
  const pa = makePlayer();
  const pb = makePlayer();
  run(a, pa, crosser(), (s) => s.won || s.lost, 60);
  run(b, pb, crosser(), (s) => s.won || s.lost, 60);
  assert.deepEqual(pa, pb);
  assert.equal(a.won, b.won);
  assert.equal(a.furthestX, b.furthestX);
  assert.deepEqual(a.logs, b.logs);
  assert.deepEqual(a.piranhas, b.piranhas);
});

test("progress and headroom read the crossing the way the HUD will", () => {
  const state = makeRiverCourse(1);
  assert.ok(riverProgress(state) < 0.05, "you start pinned to the near bank");
  assert.equal(riverHeadroom(RIVER_TOP), 1);
  assert.equal(riverHeadroom(RIVER_WATERFALL_Y), 0);
  assert.ok(RIVER_MIN_DRIFT > 0 && RIVER_MIN_DRIFT < RIVER_CURRENT, "the best log slows the fall but never beats the current");
});
