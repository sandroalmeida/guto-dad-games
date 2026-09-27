// Balance: bots play full matches from fixed seeds. The bands below are what "fun" was tuned to:
// doing nothing dies quickly, wandering randomly is a short game, and dodging well plus using the
// triangle lasts minutes — but the danger ramp always wins in the end.
import test from "node:test";
import assert from "node:assert/strict";
import { idleBot, wanderBot, smartBot, playGame, median } from "./bots.mjs";

const SEEDS = Array.from({ length: 40 }, (_, i) => (i + 1) * 7919);

function sweep(makeBot) {
  const games = SEEDS.map((seed, i) => playGame(seed, makeBot(i + 1)));
  const times = games.map((g) => g.state.time);
  const causes = {};
  for (const g of games) for (const e of g.events) if (e.type === "hurt") causes[e.cause] = (causes[e.cause] || 0) + 1;
  return { games, times, median: median(times), causes };
}

const idle = sweep(() => idleBot());
const wander = sweep((i) => wanderBot(i));
const smart = sweep(() => smartBot());
const careful = sweep(() => smartBot({ reaction: 0.3 }));
const noThrows = sweep(() => smartBot({ reaction: 0.3, throws: false }));

test("standing still is a short game", () => {
  assert.ok(idle.median > 20 && idle.median < 60, `idle median ${idle.median.toFixed(1)} s`);
});

test("running around at random lasts about a minute", () => {
  assert.ok(wander.median > 45 && wander.median < 100, `wander median ${wander.median.toFixed(1)} s`);
  assert.ok(wander.median > idle.median, "moving beats standing still");
});

test("every one of the dangers hurts players who don't watch out", () => {
  for (const cause of ["ball", "laser", "spin", "strings"]) {
    assert.ok((wander.causes[cause] || 0) >= 5, `${cause} hits: ${wander.causes[cause] || 0}`);
  }
});

test("dodging well survives for minutes", () => {
  assert.ok(careful.median > 150 && careful.median < 420, `careful median ${careful.median.toFixed(1)} s`);
  const early = careful.times.filter((t) => t < 60).length;
  assert.ok(early <= 2, `${early} careful games ended in the first minute`);
});

test("throwing triangles at the ball really helps", () => {
  assert.ok(careful.median > noThrows.median * 1.15, `with ${careful.median.toFixed(0)} s vs without ${noThrows.median.toFixed(0)} s`);
  const zaps = careful.games.reduce((n, g) => n + g.state.stats.zaps, 0);
  assert.ok(zaps / careful.games.length > 5, "the bot actually lands throws");
});

test("the ball's powers, not just bumping into it, are what beat good players", () => {
  const total = Object.values(careful.causes).reduce((a, b) => a + b, 0);
  const fromPowers = total - (careful.causes.ball || 0);
  assert.ok(fromPowers / total > 0.6, `${fromPowers} of ${total} hits came from powers`);
});

test("even a near-perfect player loses eventually", () => {
  const capped = smart.times.filter((t) => t >= 600).length;
  assert.ok(capped <= 8, `${capped} of ${SEEDS.length} perfect-bot games reached the 10-minute cap`);
  assert.ok(smart.median > careful.median * 0.9, "sharper reactions don't do worse");
});
