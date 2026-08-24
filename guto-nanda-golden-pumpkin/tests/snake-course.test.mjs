import assert from "node:assert/strict";
import test from "node:test";
import {
  SNAKE_BITE_DELAY,
  SNAKE_COLS,
  SNAKE_LANES,
  bandAt,
  generateLayout,
  legalTargets,
  makeSnakeCourse,
  snakeFraction,
  solve,
  stepSnakeCourse,
  straightLaneWorks,
} from "../app/snake-course.ts";

const DT = 1 / 60;

function run(state, controller, predicate, maxSeconds = 120) {
  const log = [];
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    controller?.(state, elapsed);
    const events = stepSnakeCourse(state, DT);
    events.forEach((event) => log.push({ ...event, at: Number(elapsed.toFixed(2)) }));
    elapsed += DT;
    if (predicate(state, log)) break;
  }
  return { log, elapsed };
}

function settle(state) {
  return run(state, null, (s) => !s.motion, 2);
}

function move(state, direction) {
  state.pendingMove = direction;
  return settle(state);
}

test("every generated layout is solvable, needs lateral walking, and defeats straight lanes", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const layout = generateLayout(seed);
    const solution = solve(layout);
    assert.equal(solution.solvable, true, `seed ${seed}`);
    assert.ok(solution.lateral >= 3, `seed ${seed} needs lateral moves (${solution.lateral})`);
    assert.ok(solution.moves >= SNAKE_COLS + 6, `seed ${seed} shortest ${solution.moves}`);
    const fraction = snakeFraction(layout);
    assert.ok(fraction >= 0.42 && fraction <= 0.6, `seed ${seed} snake fraction ${fraction}`);
    for (let lane = 0; lane < SNAKE_LANES; lane += 1) {
      assert.equal(straightLaneWorks(layout, lane), false, `seed ${seed} lane ${lane} should not be a straight shot`);
    }
    assert.equal(layout.grid.length, SNAKE_COLS * SNAKE_LANES);
    assert.ok(layout.grid.every((id) => id >= 0), "every cell is a root or a snake");
    for (const band of layout.bands) {
      for (let i = 1; i < band.cells.length; i += 1) {
        const a = band.cells[i - 1];
        const b = band.cells[i];
        assert.equal(Math.abs(a.col - b.col) + Math.abs(a.lane - b.lane), 1, "band cells are connected");
      }
    }
  }
});

test("no solution ever requires two snakes in sequence", () => {
  const layout = generateLayout(3);
  // The BFS forbids snake→snake, so solvability already proves it; check the rule directly too.
  const from = { col: 4, lane: 2, onSnake: true };
  const targets = legalTargets(layout, from);
  for (const target of targets) {
    if (target.state === "goal" || target.state === "bite" || target.state === "blocked") continue;
    assert.equal(target.state.onSnake, false, "from an awake snake you may only land on roots");
  }
});

test("hopping onto a sleeping snake wakes it; staying gets you bitten after the delay", () => {
  const state = makeSnakeCourse(2);
  let snakeLane = null;
  for (let lane = 0; lane < SNAKE_LANES; lane += 1) if (bandAt(state, 0, lane).kind === "snake") snakeLane = lane;
  assert.notEqual(snakeLane, null);
  state.lane = snakeLane;
  const { log } = move(state, "forward");
  assert.ok(log.some((event) => event.type === "hop"));
  assert.ok(log.some((event) => event.type === "wake"));
  assert.equal(state.awake, true);
  assert.equal(state.reveals, 1);
  const wait = run(state, null, (s) => s.lost, 3);
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "bite");
  const lostAt = wait.log.find((event) => event.type === "lost").at;
  assert.ok(Math.abs(lostAt - SNAKE_BITE_DELAY) < 0.05, `bite comes after the delay (${lostAt})`);
});

test("hopping back to the bank before the bite puts every snake to sleep instantly", () => {
  const state = makeSnakeCourse(2);
  let snakeLane = null;
  for (let lane = 0; lane < SNAKE_LANES; lane += 1) if (bandAt(state, 0, lane).kind === "snake") snakeLane = lane;
  state.lane = snakeLane;
  move(state, "forward");
  assert.equal(state.awake, true);
  const { log } = move(state, "back");
  assert.ok(log.some((event) => event.type === "sleep"));
  assert.equal(state.awake, false);
  assert.equal(state.lost, false);
  assert.equal(state.col, -1);
});

test("hopping from an awake snake onto another snake is an instant bite", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = makeSnakeCourse(seed);
    let found = false;
    for (let lane = 0; lane < SNAKE_LANES && !found; lane += 1) {
      if (bandAt(state, 0, lane).kind === "snake" && bandAt(state, 1, lane).kind === "snake") {
        state.lane = lane;
        move(state, "forward");
        assert.equal(state.awake, true);
        const { log } = move(state, "forward");
        assert.equal(state.lost, true);
        assert.equal(state.lossReason, "instant");
        assert.ok(log.some((event) => event.type === "lost" && event.reason === "instant"));
        found = true;
      }
    }
    if (found) return;
  }
  assert.fail("expected some seed to have two snakes in a row at the start");
});

test("you can walk up and down a root but not off it, and never sideways on a snake", () => {
  const state = makeSnakeCourse(4);
  // find a root in column 0 with a vertical neighbour in the same band
  let placed = false;
  for (let lane = 0; lane < SNAKE_LANES && !placed; lane += 1) {
    const band = bandAt(state, 0, lane);
    if (band.kind !== "root") continue;
    const neighbour = band.cells.find((cell) => cell.col === 0 && Math.abs(cell.lane - lane) === 1);
    if (!neighbour) continue;
    state.lane = lane;
    move(state, "forward");
    assert.equal(state.col, 0);
    const direction = neighbour.lane > lane ? "down" : "up";
    const { log } = move(state, direction);
    assert.ok(log.some((event) => event.type === "walk"), "moving along the same root is a walk, not a hop");
    assert.equal(state.lane, neighbour.lane);
    placed = true;
  }
  assert.ok(placed, "seed 4 should have a walkable root in column 0");

  const other = makeSnakeCourse(4);
  for (let lane = 0; lane < SNAKE_LANES; lane += 1) {
    const band = bandAt(other, 0, lane);
    const above = lane > 0 ? bandAt(other, 0, lane - 1) : null;
    if (band.kind === "root" && above && above.id !== band.id) {
      other.lane = lane;
      move(other, "forward");
      const { log } = move(other, "up");
      assert.ok(log.some((event) => event.type === "blocked"), "cannot step sideways onto a different band");
      assert.equal(other.lane, lane);
      break;
    }
  }

  const snaky = makeSnakeCourse(4);
  for (let lane = 0; lane < SNAKE_LANES; lane += 1) {
    if (bandAt(snaky, 0, lane).kind === "snake") {
      snaky.lane = lane;
      move(snaky, "forward");
      assert.equal(snaky.awake, true);
      const { log } = move(snaky, lane > 0 ? "up" : "down");
      assert.ok(log.some((event) => event.type === "blocked"), "no sideways moves while standing on a snake");
      break;
    }
  }
});

test("an omniscient solver crosses all twenty rows and wins on the far bank", () => {
  for (const seed of [1, 2, 3]) {
    const state = makeSnakeCourse(seed);
    // BFS plan over the same rules used by the game.
    const plan = (() => {
      const queue = [];
      const seen = new Set();
      for (let lane = 0; lane < SNAKE_LANES; lane += 1) {
        const start = { col: -1, lane, onSnake: false };
        queue.push({ state: start, path: [] , startLane: lane });
        seen.add(`${start.col}:${start.lane}:0`);
      }
      while (queue.length) {
        const { state: current, path, startLane } = queue.shift();
        for (const target of legalTargets(state, current)) {
          if (target.state === "goal") return { startLane, moves: [...path, target.move] };
          if (target.state === "bite" || target.state === "blocked") continue;
          const key = `${target.state.col}:${target.state.lane}:${target.state.onSnake ? 1 : 0}`;
          if (seen.has(key)) continue;
          seen.add(key);
          queue.push({ state: target.state, path: [...path, target.move], startLane });
        }
      }
      return null;
    })();
    assert.ok(plan, `seed ${seed} has a plan`);
    state.lane = plan.startLane;
    for (const step of plan.moves) {
      move(state, step);
      assert.equal(state.lost, false, `seed ${seed} plan step ${step} should be safe`);
    }
    assert.equal(state.won, true);
    assert.equal(state.col, SNAKE_COLS);
    assert.equal(state.hops + 0, state.hops);
  }
});

// A human-like explorer: no map knowledge. Hops forward; on a snake, retreats and remembers what it saw
// (every snake head is visible while awake); walks along roots to find a lane whose next cell is known safe.
// A human-like explorer with no map knowledge and a short memory: when the snakes wake it only
// remembers the bands within a few rows ahead, and it plans over what it knows.
function explorer(state, memoryRows = 4) {
  const known = new Map(); // "col:lane" -> kind
  const peeked = new Set(); // snakes already used for a peek
  const key = (col, lane) => `${col}:${lane}`;
  const learnBand = (band) => band.cells.forEach((cell) => known.set(key(cell.col, cell.lane), band.kind));
  const kindOf = (col, lane) => (col >= SNAKE_COLS ? "goal" : col < 0 ? "bank" : known.get(key(col, lane)) ?? null);
  let plan = [];
  const replan = () => {
    // BFS over known-safe states; exploring an unknown forward cell ends a plan.
    const startState = { col: state.col, lane: state.lane };
    const queue = [{ node: startState, path: [] }];
    const seen = new Set([key(startState.col, startState.lane)]);
    let goalPath = null;
    let bestExplore = null;
    let bestPeek = null;
    let bestBackExplore = null;
    while (queue.length && !goalPath) {
      const { node, path } = queue.shift();
      const onBank = node.col < 0;
      const band = !onBank ? bandAt(state, node.col, node.lane) : null;
      const ahead = kindOf(node.col + 1, node.lane);
      if (ahead === "goal" || ahead === "root") {
        const next = { col: node.col + 1, lane: node.lane };
        if (ahead === "goal") { goalPath = [...path, "forward"]; break; }
        if (!seen.has(key(next.col, next.lane))) { seen.add(key(next.col, next.lane)); queue.push({ node: next, path: [...path, "forward"] }); }
      } else if (ahead === "snake") {
        const beyond = kindOf(node.col + 2, node.lane);
        if (beyond === "goal") { goalPath = [...path, "forward", "forward"]; break; }
        if (beyond === "root") {
          const next = { col: node.col + 2, lane: node.lane };
          if (!seen.has(key(next.col, next.lane))) { seen.add(key(next.col, next.lane)); queue.push({ node: next, path: [...path, "forward", "forward"] }); }
        } else if (beyond === null && !peeked.has(key(node.col + 1, node.lane))) {
          // Peek: hop onto the known snake to see what lies beyond it, then retreat if needed.
          if (!bestPeek || node.col > bestPeek.col) bestPeek = { col: node.col, path: [...path, "forward"] };
        }
      } else if (ahead === null) {
        if (!bestExplore || node.col > bestExplore.col || (node.col === bestExplore.col && path.length < bestExplore.path.length)) {
          bestExplore = { col: node.col, path: [...path, "forward"] };
        }
      }
      const behind = node.col >= 0 ? kindOf(node.col - 1, node.lane) : null;
      if (behind === "root" || behind === "bank") {
        const next = { col: node.col - 1, lane: node.lane };
        if (!seen.has(key(next.col, next.lane))) { seen.add(key(next.col, next.lane)); queue.push({ node: next, path: [...path, "back"] }); }
      } else if (behind === null && node.col >= 1) {
        // Backward peek onto an unexplored band.
        if (!bestBackExplore || node.col > bestBackExplore.col) bestBackExplore = { col: node.col, path: [...path, "back"] };
      } else if (behind === "snake" && node.col >= 1) {
        // Retreat through a snake: wake it, then hop back again onto the root behind it.
        const twoBack = kindOf(node.col - 2, node.lane);
        if (twoBack === "root" || twoBack === "bank") {
          const next = { col: node.col - 2, lane: node.lane };
          if (!seen.has(key(next.col, next.lane))) { seen.add(key(next.col, next.lane)); queue.push({ node: next, path: [...path, "back", "back"] }); }
        }
      }
      for (const step of ["up", "down"]) {
        const lane = node.lane + (step === "up" ? -1 : 1);
        if (lane < 0 || lane >= SNAKE_LANES) continue;
        const nextBand = !onBank ? bandAt(state, node.col, lane) : null;
        const walkable = onBank ? true : nextBand && band && nextBand.id === band.id;
        if (!walkable || seen.has(key(node.col, lane))) continue;
        seen.add(key(node.col, lane));
        queue.push({ node: { col: node.col, lane }, path: [...path, step] });
      }
    }
    plan = goalPath ?? bestExplore?.path ?? bestPeek?.path ?? bestBackExplore?.path ?? [];
  };
  return () => {
    if (state.motion || state.pendingMove) return;
    if (state.awake) {
      peeked.add(key(state.col, state.lane));
      state.bands.forEach((band) => {
        if (band.cells.some((cell) => cell.col >= state.col && cell.col <= state.col + memoryRows)) learnBand(band);
      });
      const ahead = kindOf(state.col + 1, state.lane);
      const wantsBack = plan[0] === "back";
      if (wantsBack) state.pendingMove = "back";
      else state.pendingMove = ahead === "root" || ahead === "goal" ? "forward" : "back";
      plan = [];
      return;
    }
    if (state.col >= 0 && state.col < SNAKE_COLS) learnBand(bandAt(state, state.col, state.lane));
    if (!plan.length) replan();
    if (!plan.length) {
      state.pendingMove = "back";
      return;
    }
    state.pendingMove = plan.shift();
  };
}

test("a memorising explorer with no map can beat the course in a reasonable time", () => {
  const results = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = makeSnakeCourse(seed);
    const { elapsed } = run(state, explorer(state), (s) => s.won || s.lost, 180);
    results.push({ seed, won: state.won, lost: state.lost, t: Number(elapsed.toFixed(1)), reveals: state.reveals, hops: state.hops, furthest: state.furthest });
  }
  const wins = results.filter((result) => result.won).length;
  assert.ok(wins >= 7, `explorer should usually win: ${JSON.stringify(results)}`);
  for (const result of results.filter((r) => r.won)) {
    assert.ok(result.reveals >= 3, `winning with a short memory should take several peeks: ${JSON.stringify(result)}`);
    assert.ok(result.t < 90, JSON.stringify(result));
  }
  const averagePeeks = results.reduce((sum, result) => sum + result.reveals, 0) / results.length;
  assert.ok(averagePeeks >= 3 && averagePeeks <= 12, `peeks per run should be in a fun range: ${averagePeeks}`);
});

test("retrying keeps the same layout for the same seed", () => {
  const a = makeSnakeCourse(77);
  const b = makeSnakeCourse(77);
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.bands.map((band) => band.kind), b.bands.map((band) => band.kind));
  const c = makeSnakeCourse(78);
  assert.notDeepEqual(a.grid, c.grid);
});
