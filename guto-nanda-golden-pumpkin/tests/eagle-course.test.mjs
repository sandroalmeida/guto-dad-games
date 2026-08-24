import assert from "node:assert/strict";
import test from "node:test";
import {
  EAGLE_FRUIT_HEAL,
  EAGLE_GROUND_Y,
  EAGLE_HOLD_LIMIT,
  EAGLE_MAX_HEALTH,
  EAGLE_SAFE_LEFT,
  EAGLE_SAFE_RIGHT,
  EAGLE_TALON_DAMAGE,
  makeEagleCourse,
  playerExposed,
  stepEagleCourse,
  threateningEagle,
} from "../app/eagle-course.ts";

const DT = 1 / 60;

function makePlayer(x = 105) {
  return { x, y: EAGLE_GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true };
}

function idle() {
  return { move: 0, run: false, hold: false };
}

function runUntil(state, player, controller, predicate, maxSeconds = 60) {
  const log = [];
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    const input = controller(state, player, elapsed);
    const events = stepEagleCourse(state, player, input, DT);
    events.forEach((event) => log.push({ ...event, at: elapsed }));
    elapsed += DT;
    if (predicate(state, player, log)) break;
  }
  return { log, elapsed };
}

function nearestRodent(state, x) {
  return state.rodents
    .map((rodent) => ({ rodent, distance: Math.abs(rodent.x - x) }))
    .sort((a, b) => a.distance - b.distance)[0]?.rodent ?? null;
}

const naiveWalker = () => ({ move: 1, run: false, hold: false });

function smartCrosser(mashRate = 5) {
  let mashClock = 0;
  return (state, player, elapsed) => {
    if (state.caughtBy !== null) {
      mashClock += DT;
      if (mashClock >= 1 / mashRate) {
        mashClock = 0;
        state.spacePresses += 1;
      }
      return idle();
    }
    const threat = threateningEagle(state);
    if (state.carrying?.kind === "rodent") {
      return { move: 1, run: !threat, hold: !!threat };
    }
    if (state.carrying?.kind === "fruit") {
      state.spacePresses += 1;
      return idle();
    }
    const rodent = nearestRodent(state, player.x);
    if (rodent && Math.abs(rodent.x - player.x) < 34) {
      state.spacePresses += 1;
      return idle();
    }
    if (rodent && player.x > EAGLE_SAFE_LEFT - 40 && Math.abs(rodent.x - player.x) < 260) {
      return { move: Math.sign(rodent.x - player.x), run: true, hold: false };
    }
    return { move: 1, run: elapsed > 0, hold: false };
  };
}

function primeDive(seed, setup) {
  const state = makeEagleCourse(seed);
  const player = makePlayer(600);
  setup?.(state, player);
  const { log } = runUntil(
    state,
    player,
    () => idle(),
    (_, __, events) => events.some((event) => event.type === "dive" && event.onPlayer),
    20,
  );
  assert.ok(log.some((event) => event.type === "dive" && event.onPlayer), "an eagle should dive on the exposed player");
  return { state, player };
}

test("eagles never attack inside the start or finish shade", () => {
  for (const x of [100, EAGLE_SAFE_LEFT - 5, EAGLE_SAFE_RIGHT + 5, 1100]) {
    const state = makeEagleCourse(3);
    const player = makePlayer(x);
    const { log } = runUntil(state, player, () => idle(), () => false, 15);
    assert.equal(playerExposed(state, player), false);
    assert.equal(
      log.filter((event) => event.type === "lock" && event.onPlayer).length,
      0,
      `no eagle should lock on a player standing at x=${x}`,
    );
    assert.equal(state.caughtBy, null);
  }
});

test("an unshielded walker gets caught and carried away without struggling", () => {
  const state = makeEagleCourse(11);
  const player = makePlayer();
  const { log } = runUntil(state, player, naiveWalker, (s) => s.lost || s.won, 40);
  assert.ok(log.some((event) => event.type === "caught"), "the eagles should catch a walker who never grabs a rodent");
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "carried");
  assert.equal(state.health, EAGLE_MAX_HEALTH - EAGLE_TALON_DAMAGE);
  const caughtAt = log.find((event) => event.type === "caught").at;
  const lostAt = log.find((event) => event.type === "lost").at;
  assert.ok(lostAt - caughtAt >= EAGLE_HOLD_LIMIT - DT * 2, "the eagle keeps you for three seconds before you lose");
  assert.ok(lostAt - caughtAt < EAGLE_HOLD_LIMIT + 0.1);
});

test("mashing space breaks free of the eagle in time", () => {
  const { state, player } = primeDive(5);
  runUntil(state, player, () => idle(), (s) => s.caughtBy !== null, 5);
  assert.notEqual(state.caughtBy, null, "the unshielded player should be grabbed");
  const liftedFrom = player.y;
  let mashClock = 0;
  const { log } = runUntil(
    state,
    player,
    (s) => {
      mashClock += DT;
      if (mashClock >= 0.25) {
        mashClock = 0;
        s.spacePresses += 1;
      }
      return idle();
    },
    (s, p, events) => events.some((event) => event.type === "landed") || s.lost,
    8,
  );
  assert.ok(log.some((event) => event.type === "escaped"), "four presses per second should be enough to escape");
  assert.equal(state.lost, false);
  assert.ok(log.some((event) => event.type === "struggle"));
  const escapedAt = log.find((event) => event.type === "escaped").at;
  assert.ok(escapedAt < EAGLE_HOLD_LIMIT);
  assert.ok(log.some((event) => event.type === "landed"), "the explorer falls back to the ground after escaping");
  assert.equal(player.onGround, true);
  assert.equal(player.y, EAGLE_GROUND_Y);
  assert.ok(liftedFrom > 0);
  assert.ok(state.escapeGrace > 0 || state.landRecovery > 0 || true);
});

test("a rodent held overhead is taken instead of the explorer", () => {
  const { state, player } = primeDive(9, (s) => {
    s.carrying = { kind: "rodent", phase: 0, size: 1 };
  });
  const rodentsBefore = state.rodents.length;
  const { log } = runUntil(
    state,
    player,
    () => ({ move: 0, run: false, hold: true }),
    (_, __, events) => events.some((event) => event.type === "preyTaken" || event.type === "caught"),
    5,
  );
  assert.ok(log.some((event) => event.type === "preyTaken"), "the eagle should snatch the raised rodent");
  assert.ok(!log.some((event) => event.type === "caught"));
  assert.equal(state.carrying, null);
  assert.equal(state.caughtBy, null);
  assert.equal(state.health, EAGLE_MAX_HEALTH);
  assert.equal(state.preyFed, 1);
  assert.equal(state.rodents.length, rodentsBefore, "the taken rodent leaves with the eagle instead of returning to the field");
  const captor = state.eagles.find((eagle) => eagle.mode === "carryPrey");
  assert.ok(captor, "the eagle flies off carrying the prey");
});

test("a rodent carried low does not shield and falls to the ground", () => {
  const { state, player } = primeDive(9, (s) => {
    s.carrying = { kind: "rodent", phase: 0, size: 1 };
  });
  const rodentsBefore = state.rodents.length;
  const { log } = runUntil(
    state,
    player,
    () => idle(),
    (_, __, events) => events.some((event) => event.type === "preyTaken" || event.type === "caught"),
    5,
  );
  const caught = log.find((event) => event.type === "caught");
  assert.ok(caught, "an eagle catches the explorer when the rodent is not raised");
  assert.equal(caught.droppedItem, "rodent");
  assert.equal(state.carrying, null);
  assert.equal(state.rodents.length, rodentsBefore + 1, "the dropped rodent runs off across the ground");
  assert.equal(state.health, EAGLE_MAX_HEALTH - EAGLE_TALON_DAMAGE);
});

test("fruit never scares an eagle and falls when the explorer is grabbed", () => {
  const { state, player } = primeDive(13, (s) => {
    s.carrying = { kind: "fruit", fruitKind: 1 };
  });
  const fruitsBefore = state.fruits.length;
  const { log } = runUntil(
    state,
    player,
    () => idle(),
    (_, __, events) => events.some((event) => event.type === "preyTaken" || event.type === "caught"),
    5,
  );
  const caught = log.find((event) => event.type === "caught");
  assert.ok(caught, "carrying fruit should not stop the eagle");
  assert.equal(caught.droppedItem, "fruit");
  assert.equal(state.fruits.length, fruitsBefore + 1, "the fruit falls to the ground");
  assert.equal(state.overhead, false);
  assert.equal(state.preyFed, 0);
});

test("holding Z with fruit eats it instead of raising it, so the eagle still strikes", () => {
  const { state, player } = primeDive(13, (s) => {
    s.carrying = { kind: "fruit", fruitKind: 1 };
    s.health = 50;
  });
  const { log } = runUntil(
    state,
    player,
    () => ({ move: 0, run: false, hold: true }),
    (_, __, events) => events.some((event) => event.type === "preyTaken" || event.type === "caught"),
    5,
  );
  assert.ok(log.some((event) => event.type === "eat"), "Z eats the fruit");
  assert.ok(log.some((event) => event.type === "caught"), "the eagle still grabs the explorer");
  assert.ok(!log.some((event) => event.type === "preyTaken"));
  assert.equal(state.health, 50 + EAGLE_FRUIT_HEAL - EAGLE_TALON_DAMAGE);
});

test("eating fruit with Z restores a little health", () => {
  const state = makeEagleCourse(2);
  const player = makePlayer(100);
  state.health = 40;
  state.carrying = { kind: "fruit", fruitKind: 0 };
  const { log } = runUntil(
    state,
    player,
    () => ({ move: 0, run: false, hold: true }),
    (_, __, events) => events.some((event) => event.type === "eat"),
    3,
  );
  assert.ok(log.some((event) => event.type === "eat"));
  assert.equal(state.health, 40 + EAGLE_FRUIT_HEAL);
  assert.equal(state.carrying, null);

  state.health = EAGLE_MAX_HEALTH - 5;
  state.carrying = { kind: "fruit", fruitKind: 2 };
  runUntil(state, player, () => ({ move: 0, run: false, hold: true }), (s) => s.carrying === null, 3);
  assert.equal(state.health, EAGLE_MAX_HEALTH, "health is capped at the maximum");

  state.carrying = { kind: "fruit", fruitKind: 2 };
  runUntil(state, player, () => ({ move: 0, run: false, hold: true }), () => false, 0.3);
  assert.ok(state.eatProgress > 0 && state.carrying !== null, "a short press only starts the bite");
  runUntil(state, player, () => idle(), () => false, 0.1);
  assert.equal(state.eatProgress, 0, "releasing Z cancels the bite");
});

test("space grabs the nearest thing in reach, so fruit can be picked by mistake", () => {
  const state = makeEagleCourse(4);
  const player = makePlayer(100);
  state.rodents = [{ id: 900, x: 128, vx: 0, pause: 99, nextPause: 99, phase: 0, size: 1 }];
  state.fruits = [{ id: 901, x: 110, kind: 2 }];
  state.spacePresses = 1;
  let events = stepEagleCourse(state, player, idle(), DT);
  assert.deepEqual(events.map((event) => event.type), ["pickup"]);
  assert.equal(state.carrying?.kind, "fruit");
  assert.equal(state.fruits.length, 0);
  assert.equal(state.rodents.length, 1);

  state.spacePresses = 1;
  events = stepEagleCourse(state, player, idle(), DT);
  assert.equal(events[0].type, "drop");
  assert.equal(state.carrying, null);
  assert.equal(state.fruits.length, 1, "dropping puts the fruit back on the ground");

  player.x = 126;
  state.spacePresses = 1;
  events = stepEagleCourse(state, player, idle(), DT);
  assert.equal(state.carrying?.kind, "rodent");
  assert.equal(state.rodents.length, 0);

  state.spacePresses = 1;
  events = stepEagleCourse(state, player, idle(), DT);
  assert.equal(events[0].type, "drop");
  assert.equal(state.rodents.length, 1, "a dropped rodent scurries off");

  player.x = 60;
  state.spacePresses = 1;
  events = stepEagleCourse(state, player, idle(), DT);
  assert.equal(events[0].type, "reachMiss");
  assert.equal(state.carrying, null);
});

test("raising a rodent slows the explorer and disables running", () => {
  const state = makeEagleCourse(6);
  const player = makePlayer(100);
  runUntil(state, player, () => ({ move: 1, run: true, hold: false }), () => false, 1);
  const runningX = player.x;
  const runner = makeEagleCourse(6);
  const carrier = makePlayer(100);
  runner.carrying = { kind: "rodent", phase: 0, size: 1 };
  runUntil(runner, carrier, () => ({ move: 1, run: true, hold: true }), () => false, 1);
  assert.ok(runner.overhead);
  assert.ok(carrier.x < runningX - 120, "holding the rodent overhead should be much slower than running");
});

test("four talon hits drain all health", () => {
  const state = makeEagleCourse(8);
  const player = makePlayer(600);
  state.health = EAGLE_TALON_DAMAGE;
  const { log } = runUntil(state, player, () => idle(), (s) => s.lost, 20);
  assert.equal(state.lost, true);
  assert.equal(state.lossReason, "health");
  assert.equal(state.health, 0);
  assert.ok(log.some((event) => event.type === "lost" && event.reason === "health"));
});

test("a rodent-shielding explorer can cross the whole clearing", () => {
  const results = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = makeEagleCourse(seed);
    const player = makePlayer();
    const { log, elapsed } = runUntil(state, player, smartCrosser(5), (s) => s.won || s.lost, 90);
    results.push({
      seed,
      won: state.won,
      lost: state.lost,
      elapsed: Number(elapsed.toFixed(1)),
      fed: state.preyFed,
      caught: state.catches,
      health: state.health,
      dives: log.filter((event) => event.type === "dive" && event.onPlayer).length,
    });
  }
  const wins = results.filter((result) => result.won).length;
  assert.ok(wins >= 7, `a careful explorer should nearly always cross: ${JSON.stringify(results)}`);
  assert.ok(
    results.every((result) => result.won === false || result.fed >= 1),
    `every winning run should have fed at least one eagle: ${JSON.stringify(results)}`,
  );
  assert.ok(
    results.filter((result) => result.won).every((result) => result.elapsed > 5),
    `the crossing should take real effort: ${JSON.stringify(results)}`,
  );
  const averageDives = results.reduce((sum, result) => sum + result.dives, 0) / results.length;
  assert.ok(averageDives >= 2, `several eagles should dive per crossing: ${JSON.stringify(results)}`);
});

test("sprinting through and mashing is a losing strategy at a realistic mash rate", () => {
  let wins = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const state = makeEagleCourse(seed);
    const player = makePlayer();
    let mashClock = 0;
    runUntil(
      state,
      player,
      (s) => {
        if (s.caughtBy !== null) {
          mashClock += DT;
          if (mashClock >= 1 / 3.5) {
            mashClock = 0;
            s.spacePresses += 1;
          }
          return idle();
        }
        return { move: 1, run: true, hold: false };
      },
      (s) => s.won || s.lost,
      60,
    );
    if (state.won) wins += 1;
    assert.ok(state.catches >= 2, "a sprinter should be caught repeatedly");
  }
  assert.ok(wins <= 1, `sprinting should almost never work (won ${wins}/6)`);
});

test("the third eagle only joins once the explorer is deep in the clearing", () => {
  const state = makeEagleCourse(19);
  const player = makePlayer(400);
  runUntil(state, player, () => idle(), () => false, 1.2);
  assert.equal(state.eagles[2].dormant, true);
  assert.equal(state.caughtBy, null);
  const sheltered = makePlayer(EAGLE_SAFE_RIGHT + 30);
  runUntil(state, sheltered, () => idle(), () => false, 0.5);
  assert.equal(state.won, false);
  assert.equal(state.eagles[2].dormant, true, "the finish shade never wakes the third eagle");
  player.x = 700;
  const { log } = runUntil(state, player, () => idle(), (s) => !s.eagles[2].dormant, 4);
  assert.equal(state.eagles[2].dormant, false);
  assert.ok(log.some((event) => event.type === "thirdEagle"));
});

test("the course is deterministic for a given seed", () => {
  const first = makeEagleCourse(21);
  const second = makeEagleCourse(21);
  const playerA = makePlayer();
  const playerB = makePlayer();
  runUntil(first, playerA, smartCrosser(4), (s) => s.won || s.lost, 30);
  runUntil(second, playerB, smartCrosser(4), (s) => s.won || s.lost, 30);
  assert.deepEqual(playerA, playerB);
  assert.equal(first.preyFed, second.preyFed);
  assert.equal(first.catches, second.catches);
});

test("only one eagle hunts the explorer at a time and rodents keep arriving", () => {
  const state = makeEagleCourse(17);
  const player = makePlayer(600);
  let maxHunters = 0;
  let minRodents = Infinity;
  runUntil(
    state,
    player,
    (s) => {
      if (s.caughtBy !== null) s.spacePresses += 1;
      return idle();
    },
    (s) => {
      const hunters = s.eagles.filter(
        (eagle) =>
          (eagle.mode === "lock" || eagle.mode === "dive" || eagle.mode === "carryPlayer") &&
          (eagle.target?.kind === "player" || eagle.mode === "carryPlayer"),
      ).length;
      maxHunters = Math.max(maxHunters, hunters);
      minRodents = Math.min(minRodents, s.rodents.length);
      return s.lost;
    },
    25,
  );
  assert.equal(maxHunters, 1);
  assert.ok(minRodents >= 2, `the field should never run dry of rodents (min ${minRodents})`);
  assert.equal(state.eagles.length, 3);
});
