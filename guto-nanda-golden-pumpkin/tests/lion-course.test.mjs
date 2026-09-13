import assert from "node:assert/strict";
import test from "node:test";
import {
  LION_BRANCH_Y,
  LION_CATCH_RANGE,
  LION_CHASE_SPEED,
  LION_FINISH_X,
  LION_GROUND_Y,
  LION_HANG_REACH,
  LION_ALERT_TIME,
  LION_LEAP_RANGE,
  LION_PATIENCE,
  LION_PATIENCE_JITTER,
  LION_PLAYER_START_X,
  LION_RUN_SPEED,
  LION_SAFE_LEFT,
  LION_SAFE_RIGHT,
  LION_TERRITORY_LEFT,
  LION_TERRITORY_RIGHT,
  branchOf,
  isExposed,
  isSheltered,
  lionFacesPlayer,
  lionSeesPlayer,
  lionTrees,
  makeLionCourse,
  stepLionCourse,
} from "../app/lion-course.ts";

const DT = 1 / 60;

function makePlayer(x = LION_PLAYER_START_X, y = LION_GROUND_Y) {
  return { x, y, vx: 0, vy: 0, facing: 1, onGround: true };
}

const idle = () => ({ move: 0, run: false, up: false, down: false });
const runRight = () => ({ move: 1, run: true, up: false, down: false });

function run(state, player, controller, predicate, maxSeconds = 90) {
  const log = [];
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    const input = controller(state, player, elapsed, log);
    const events = stepLionCourse(state, player, input, DT);
    events.forEach((event) => log.push({ ...event, at: Number(elapsed.toFixed(2)) }));
    elapsed += DT;
    if (predicate(state, player, log)) break;
  }
  return { log, elapsed };
}

function finished(state) {
  return state.won || state.lost;
}

// Pins the lion far away and facing away so a bot can practise the tree moves in peace.
function parkLion(state, x = LION_TERRITORY_RIGHT, facing = 1) {
  state.lion.x = x;
  state.lion.vx = 0;
  state.lion.facing = facing;
  state.lion.mood = "look";
  state.lion.timer = 1e9;
}

// Runs to the next tree, jumps for the branch, climbs, and leaves a perch
// only when `clear(...)` says so. The rules below are the decisions a player
// can make with what is on screen: which way the lion looks, whether it is
// walking or standing, and whether it is between you and the next tree.
function treeHopper(clear) {
  let goingDown = false;
  return (state, player) => {
    const lion = state.lion;
    const nextTree = state.trees.find((tree) => tree.x - 8 > player.x);
    const targetX = nextTree ? nextTree.x - 8 : LION_FINISH_X + 10;
    const distance = targetX - player.x;
    const go = clear({
      lion,
      targetX,
      looksAway: !lionFacesPlayer(lion, player),
      quiet: lion.mood !== "chase" && lion.mood !== "alert",
      walking: lion.mood === "prowl" || lion.mood === "leave",
      behind: lion.x < player.x,
      beyond: lion.x > targetX + 40,
      timeToTree: distance / LION_RUN_SPEED + 0.85 - LION_ALERT_TIME,
      lionTime: Math.abs(lion.x - targetX) / LION_CHASE_SPEED,
    });

    if (state.perch === "perched") {
      goingDown = false;
      if (!go) return idle();
      goingDown = true;
      return { move: 0, run: false, up: false, down: true };
    }
    if (state.perch === "lowering") return idle();
    if (state.perch === "hang") {
      if (goingDown) {
        // ↓ got us hanging; SPACE lets go
        state.jumpPresses += 1;
        return runRight();
      }
      return { move: 0, run: false, up: true, down: false };
    }
    if (state.perch === "climbing") return { move: 0, run: false, up: true, down: false };

    // On the ground
    goingDown = false;
    if (player.x <= LION_SAFE_LEFT && !go) return idle();
    if (!player.onGround) return { move: distance > 12 ? 1 : 0, run: true, up: false, down: false };
    if (nextTree && player.x >= nextTree.x - 30 && player.x <= nextTree.x + 20) {
      state.jumpPresses += 1;
      return idle();
    }
    return runRight();
  };
}

// "Go when the lion is looking away and is not between you and the next tree."
const smartRule = (c) => c.quiet && c.looksAway && (c.behind || c.beyond);
// "Go whenever the lion is looking away" — even if it is heading for your tree.
const gazeOnlyRule = (c) => c.quiet && c.looksAway;
// Leaves the moment the lion is not pacing under the tree, never mind its gaze.
const impatientRule = (c) => c.quiet && c.lion.mood !== "wait";

function crossings(rule, seeds, salt) {
  let wins = 0;
  let hanging = 0;
  let ground = 0;
  const times = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const state = makeLionCourse(seed * salt + 3);
    const player = makePlayer();
    const { elapsed } = run(state, player, treeHopper(rule), finished, 150);
    if (state.won) {
      wins += 1;
      times.push(elapsed);
    } else if (state.lossReason === "hanging") hanging += 1;
    else if (state.lossReason === "ground") ground += 1;
  }
  const average = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
  return { wins, hanging, ground, average };
}

test("the savanna is laid out from the trail-head rocks to the pumpkin shrine", () => {
  assert.equal(lionTrees.length, 3, "three acacia trees give cover");
  assert.ok(LION_SAFE_LEFT < lionTrees[0].x - lionTrees[0].span);
  assert.ok(lionTrees[2].x + lionTrees[2].span < LION_SAFE_RIGHT);
  assert.ok(LION_FINISH_X > LION_SAFE_RIGHT);
  assert.ok(LION_TERRITORY_LEFT > LION_SAFE_LEFT && LION_TERRITORY_RIGHT < LION_SAFE_RIGHT, "the lion never enters the safe rocks");
  assert.ok(LION_CHASE_SPEED > LION_RUN_SPEED, "a charging lion outruns a running explorer");
  const state = makeLionCourse(1);
  assert.equal(state.lion.facing, -1, "the lion starts watching the trail-head");
  assert.ok(state.lion.x > lionTrees[2].x, "the lion starts near the shrine end");
});

test("a standing jump under a branch catches it, and only after a jump", () => {
  const state = makeLionCourse(2);
  parkLion(state);
  const player = makePlayer(lionTrees[0].x - 10);
  // Walk past the trunk without jumping: nothing to catch
  run(state, player, () => ({ move: 1, run: false, up: false, down: false }), (s, p) => p.x > lionTrees[0].x + 20, 3);
  assert.equal(state.perch, "ground");
  player.x = lionTrees[0].x - 6;
  player.vx = 0;
  state.jumpPresses += 1;
  const { log } = run(state, player, idle, (s) => s.perch === "hang", 2);
  assert.ok(log.some((e) => e.type === "jump"));
  assert.ok(log.some((e) => e.type === "catch" && e.tree === 0), "the branch was caught");
  assert.equal(player.y, LION_BRANCH_Y + LION_HANG_REACH, "hands on the branch, feet dangling");
  assert.equal(isExposed(state, player), true, "hanging is not safe");
  assert.equal(isSheltered(state), false);
});

test("hanging + ↑ climbs onto the branch; ↓ + SPACE gets back down", () => {
  const state = makeLionCourse(3);
  parkLion(state);
  const player = makePlayer(lionTrees[1].x);
  state.jumpPresses += 1;
  run(state, player, idle, (s) => s.perch === "hang", 2);
  assert.equal(state.perch, "hang");

  // SPACE alone while hanging drops you, it does not climb
  const dropState = structuredClone(state);
  const dropPlayer = { ...player };
  dropState.jumpPresses += 1;
  const dropped = run(dropState, dropPlayer, idle, (s, p) => p.onGround && s.perch === "ground", 2);
  assert.ok(dropped.log.some((e) => e.type === "drop"));
  assert.equal(dropPlayer.y, LION_GROUND_Y);
  assert.ok(!dropped.log.some((e) => e.type === "catch"), "letting go never re-catches the same branch");

  // ↑ climbs
  const up = run(state, player, () => ({ move: 0, run: false, up: true, down: false }), (s) => s.perch === "perched", 2);
  assert.ok(up.log.some((e) => e.type === "climb" && e.tree === 1));
  assert.equal(player.y, LION_BRANCH_Y, "standing on the branch");
  assert.equal(isSheltered(state), true);
  assert.equal(isExposed(state, player), false);

  // SPACE does nothing on the branch; ↓ lowers you to a hang; SPACE then drops
  state.jumpPresses += 1;
  run(state, player, idle, () => false, 0.5);
  assert.equal(state.perch, "perched", "SPACE on the branch does not jump off");
  const down = run(state, player, () => ({ move: 0, run: false, up: false, down: true }), (s) => s.perch === "hang", 2);
  assert.ok(down.log.some((e) => e.type === "hang" && e.tree === 1));
  assert.equal(isExposed(state, player), true, "back to hanging — exposed again");
  state.jumpPresses += 1;
  const drop = run(state, player, idle, (s, p) => p.onGround && s.perch === "ground", 2);
  assert.ok(drop.log.some((e) => e.type === "drop"));
  assert.equal(player.y, LION_GROUND_Y);
});

test("walking along a branch is bounded by its span", () => {
  const state = makeLionCourse(4);
  parkLion(state);
  const tree = lionTrees[2];
  const player = makePlayer(tree.x);
  state.jumpPresses += 1;
  run(state, player, () => ({ move: 0, run: false, up: true, down: false }), (s) => s.perch === "perched", 2);
  run(state, player, () => ({ move: 1, run: true, up: false, down: false }), () => false, 3);
  assert.equal(Math.round(player.x), tree.x + tree.span, "stopped at the branch tip");
  assert.equal(state.perch, "perched");
  assert.equal(branchOf(state, player.x), 2);
  run(state, player, () => ({ move: -1, run: true, up: false, down: false }), () => false, 3);
  assert.equal(Math.round(player.x), tree.x - tree.span);
});

test("the lion only sees prey it is facing, and never anyone up a tree or on the rocks", () => {
  const state = makeLionCourse(5);
  const player = makePlayer(500);
  state.lion.x = 800;
  state.lion.facing = -1;
  assert.equal(lionSeesPlayer(state, player), true, "facing left, prey to the left");
  state.lion.facing = 1;
  assert.equal(lionSeesPlayer(state, player), false, "looking the other way");
  state.lion.facing = -1;
  player.x = LION_SAFE_LEFT - 10;
  assert.equal(lionSeesPlayer(state, player), false, "the trail-head rocks are safe");
  player.x = LION_SAFE_RIGHT + 10;
  state.lion.facing = 1;
  assert.equal(lionSeesPlayer(state, player), false, "the shrine is safe");
  player.x = 500;
  state.lion.facing = -1;
  state.perch = "perched";
  assert.equal(lionSeesPlayer(state, player), false, "perched on a branch is invisible");
  state.perch = "hang";
  assert.equal(lionSeesPlayer(state, player), true, "hanging is still prey");
});

test("running straight across gets you eaten on the ground", () => {
  let caught = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const state = makeLionCourse(seed * 7);
    const player = makePlayer();
    const { log } = run(state, player, runRight, finished, 30);
    if (state.lost) caught += 1;
    if (state.lost) {
      assert.equal(state.lossReason, "ground");
      assert.ok(log.some((e) => e.type === "alert"), "the lion spots you first");
      assert.ok(log.some((e) => e.type === "chase"), "then charges");
    }
  }
  assert.equal(caught, 12, "a lion that starts watching the trail-head never misses a runner");
});

test("hanging from a branch without climbing is not safe — the lion pulls you down", () => {
  const state = makeLionCourse(9);
  const tree = lionTrees[0];
  const player = makePlayer(tree.x - 4);
  state.lion.x = 700;
  state.lion.facing = -1;
  state.lion.mood = "look";
  state.jumpPresses += 1;
  const { log } = run(state, player, idle, finished, 8);
  assert.ok(log.some((e) => e.type === "catch"), "the branch was caught");
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "hanging");
  assert.ok(Math.abs(state.lion.x - player.x) < LION_LEAP_RANGE + 1);
});

test("climbing the branch in time saves you: the lion waits, roars, then loses interest and leaves", () => {
  const state = makeLionCourse(11);
  const tree = lionTrees[0];
  const player = makePlayer(tree.x - 4);
  state.lion.x = 760;
  state.lion.facing = -1;
  state.lion.mood = "look";
  state.jumpPresses += 1;
  const climb = run(state, player, () => ({ move: 0, run: false, up: true, down: false }), (s) => s.perch === "perched", 3);
  assert.ok(climb.log.some((e) => e.type === "climb"));
  const wait = run(state, player, idle, (s) => s.lion.mood === "wait", 6);
  assert.ok(wait.log.some((e) => e.type === "wait" && e.tree === 0), "the lion paces under the very tree");
  assert.ok(Math.abs(state.lion.x - tree.x) < 60);
  assert.equal(state.lost, false);
  const waitStart = state.elapsed;
  const gone = run(state, player, idle, (s) => s.lion.mood === "leave", 10);
  assert.ok(gone.log.some((e) => e.type === "roar"), "it roars while it waits");
  assert.ok(gone.log.some((e) => e.type === "leave"), "then it gives up");
  assert.ok(gone.log.some((e) => e.type === "escape"));
  const waited = state.elapsed - waitStart;
  assert.ok(waited >= LION_PATIENCE - LION_PATIENCE_JITTER - 0.1 && waited <= LION_PATIENCE + LION_PATIENCE_JITTER + 0.1, `patience ran ${waited.toFixed(2)}s`);
  // While it walks away it faces away from the tree — and it keeps going for a while
  const facingAway = Math.sign(state.lion.facing);
  run(state, player, idle, () => false, 1.5);
  assert.ok(Math.abs(state.lion.x - tree.x) > 100, "the lion has actually wandered off");
  assert.equal(Math.sign(state.lion.facing), facingAway);
  assert.equal(state.lost, false);
});

test("dropping while the lion is still under the tree ends badly", () => {
  const state = makeLionCourse(13);
  const tree = lionTrees[1];
  const player = makePlayer(tree.x);
  state.lion.x = 900;
  state.lion.facing = -1;
  state.jumpPresses += 1;
  run(state, player, () => ({ move: 0, run: false, up: true, down: false }), (s) => s.perch === "perched", 3);
  run(state, player, idle, (s) => s.lion.mood === "wait", 6);
  assert.equal(state.lion.mood, "wait");
  // ↓ to hang: the lion is right there, looking up
  const { log } = run(state, player, () => ({ move: 0, run: false, up: false, down: true }), finished, 4);
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "hanging");
  assert.ok(!log.some((e) => e.type === "climb"));
});

test("retreating to the trail-head rocks is safe and the lion gives up at the edge", () => {
  const state = makeLionCourse(17);
  const player = makePlayer(240);
  state.lion.x = 520;
  state.lion.facing = -1;
  const { log } = run(
    state,
    player,
    () => ({ move: -1, run: true, up: false, down: false }),
    (s) => s.lion.mood === "wait" || s.lost,
    8,
  );
  assert.equal(state.lost, false, "made it back to the rocks");
  assert.ok(player.x <= LION_SAFE_LEFT);
  assert.equal(state.lion.mood, "wait");
  assert.ok(state.lion.x >= LION_TERRITORY_LEFT - 0.01, "the lion stops at the edge of its ground");
  assert.ok(log.some((e) => e.type === "wait" && e.tree === null));
  run(state, player, idle, (s) => s.lion.mood === "leave", 8);
  assert.equal(state.lion.mood, "leave");
});

test("the pounce only lands within reach: a lion still a stride away does not catch you", () => {
  const state = makeLionCourse(19);
  const player = makePlayer(500);
  state.lion.x = 500 + LION_CATCH_RANGE + 30;
  state.lion.facing = -1;
  state.lion.mood = "chase";
  stepLionCourse(state, player, idle(), DT);
  assert.equal(state.lost, false);
  state.lion.x = 500 + LION_CATCH_RANGE - 2;
  stepLionCourse(state, player, idle(), DT);
  assert.equal(state.lost, true);
});

test("reaching the shrine wins, and the lion cannot follow you onto it", () => {
  const state = makeLionCourse(23);
  const player = makePlayer(LION_SAFE_RIGHT + 4);
  state.lion.x = 980;
  state.lion.facing = 1;
  state.lion.mood = "chase";
  const { log } = run(state, player, runRight, finished, 5);
  assert.equal(state.won, true);
  assert.ok(log.some((e) => e.type === "won"));
  assert.ok(state.lion.x <= LION_TERRITORY_RIGHT + 0.01);
});

test("balance: watching the lion's gaze and never running toward it wins most crossings in good time", () => {
  const seeds = 60;
  const result = crossings(smartRule, seeds, 101);
  assert.ok(result.wins >= seeds * 0.85, `smart hopper won ${result.wins}/${seeds}`);
  assert.ok(result.average < 45, `an average crossing takes ${result.average.toFixed(1)}s`);
  assert.ok(result.average > 12, `a crossing should take some patience, not ${result.average.toFixed(1)}s`);
});

test("balance: 'it is looking away' alone is not enough — following the lion to its tree gets you pulled off the branch", () => {
  const seeds = 60;
  const result = crossings(gazeOnlyRule, seeds, 53);
  assert.ok(result.wins <= seeds * 0.4, `gaze-only hopper won ${result.wins}/${seeds} — position has to matter`);
  assert.ok(result.wins > 0, `gaze-only hopper won ${result.wins}/${seeds} — it should not be hopeless`);
  assert.ok(result.hanging > result.ground, "most of those deaths are a lion leaping at a climber who cut it too fine");
});

test("balance: ignoring the lion's gaze entirely never works", () => {
  const seeds = 30;
  const result = crossings(impatientRule, seeds, 71);
  assert.equal(result.wins, 0, `impatient hopper won ${result.wins}/${seeds}`);
});
