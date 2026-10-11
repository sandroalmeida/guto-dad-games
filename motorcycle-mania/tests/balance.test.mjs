import test from "node:test";
import assert from "node:assert/strict";
import { createGame, stepGame, worldSpeed } from "../logic.js";

// A simple rider reacts only to entities inside the visible road ahead.
// It chooses fuel when needed and leaves a track with approaching traffic.
function visibleDodger(state) {
  let target = state.player.lane, bestScore = -Infinity;
  const visibleDistance = (1280 - 246) / state.zoom;
  for (let lane = 0; lane < state.laneCount; lane++) {
    let score = -Math.abs(lane - state.player.lane) * 3;
    for (const e of state.entities) {
      if (e.x > visibleDistance || (e.kind === "fall" && !e.armed)) continue;
      const arrival = e.x / (worldSpeed(state) + (e.extraSpeed || 0));
      if (arrival < -0.2 || arrival > 3.2 || e.lane !== lane) continue;
      if (e.kind === "fuel") score += (100 - state.fuel) * 0.9 / (arrival + 1);
      else if (arrival < 2.2) score -= 150 / (arrival + 1);
    }
    if (score > bestScore) { bestScore = score; target = lane; }
  }
  return { up: target > state.player.lane, down: target < state.player.lane };
}

function batch(difficulty, policy) {
  return Array.from({ length: 20 }, (_, i) => {
    const state = createGame(i + 1, difficulty);
    // Cruise riders can now survive beyond a minute without moving. Use a
    // longer window so the survival cap does not hide the reward for steering.
    for (let frame = 0; frame < 60 * 180 && !state.over; frame++) stepGame(state, policy(state));
    return state;
  });
}
const averageTime = rides => rides.reduce((total, state) => total + state.time, 0) / rides.length;

test("standing still is progressively less forgiving in Cruise, Arcade, and Mania", () => {
  const times = ["cruise", "arcade", "mania"].map(mode => averageTime(batch(mode, () => ({}))));
  assert.ok(times[0] > times[1] + 5, `Cruise ${times[0]}s; Arcade ${times[1]}s`);
  assert.ok(times[1] > times[2] + 5, `Arcade ${times[1]}s; Mania ${times[2]}s`);
});

test("visible dodging and refueling reward active play without inevitable fuel starvation", () => {
  for (const mode of ["cruise", "arcade", "mania"]) {
    const idle = batch(mode, () => ({})), active = batch(mode, visibleDodger);
    assert.ok(averageTime(active) > averageTime(idle) * 1.8, `${mode}: active riding must outlast staying still`);
    assert.ok(active.every(s => !(s.over && s.reason === "fuel")), `${mode}: reachable fuel must support an active rider`);
    assert.ok(active.every(s => s.stats.bottles >= 4), `${mode}: refueling must be possible throughout the ride`);
  }
});
