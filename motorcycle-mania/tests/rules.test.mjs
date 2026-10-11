import test from "node:test";
import assert from "node:assert/strict";
import { createGame, stepGame, requestJump, changeTracks, spawnWave, TRACK_GAP, JUMP_TIME, SECTION_LENGTH, DIFFICULTIES, worldSpeed, SURFACE_DURATION, TRACK_SEQUENCE } from "../logic.js";

function advance(state, seconds, input = {}) {
  const events = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) events.push(...stepGame(state, input, 1 / 60));
  return events;
}
function emptyCourse() { const s = createGame(73); s.entities = []; s.nextWave = Infinity; s.nextSection = Infinity; return s; }

test("a new ride has four tracks, three lives, a full tank, and forward motion", () => {
  const s = createGame(); assert.equal(s.laneCount, 4); assert.equal(s.lives, 3); assert.equal(s.fuel, 100);
  advance(s, 1); assert.ok(s.distance > 180); assert.ok(s.fuel < 100);
});

test("accelerating and braking change speed gradually; braking never stops the course", () => {
  const fast = emptyCourse(), slow = emptyCourse(), neutral = emptyCourse();
  advance(fast, 2, { right: true }); advance(slow, 2, { left: true }); advance(neutral, 2);
  assert.ok(fast.speed > neutral.speed + 20); assert.ok(slow.speed < neutral.speed - 25);
  assert.ok(slow.distance > 0); assert.ok(slow.speed >= 36);
  const previous = fast.speed; stepGame(fast, { left: true }); assert.ok(fast.speed < previous); assert.ok(fast.speed > 90);
  advance(fast, 2); assert.ok(Math.abs(fast.speed - fast.baseSpeed) < 1);
});

test("a jump takes time, crosses the intervening space, and lands on the adjacent track", () => {
  const s = emptyCourse(); assert.equal(requestJump(s, 1), true);
  advance(s, JUMP_TIME / 2); assert.ok(s.player.y > 0 && s.player.y < TRACK_GAP); assert.ok(s.player.lift > 10);
  assert.equal(requestJump(s, 1), false);
  advance(s, JUMP_TIME); assert.equal(s.player.y, TRACK_GAP); assert.equal(s.player.lift, 0); assert.equal(s.player.jump, null);
  assert.equal(s.stats.jumps, 1);
});

test("holding a direction hops repeatedly but cannot leave the ceiling or floor", () => {
  const s = emptyCourse(); advance(s, 3, { up: true }); assert.equal(s.player.lane, 3); assert.equal(s.player.y, 3 * TRACK_GAP);
  advance(s, 3, { down: true }); assert.equal(s.player.lane, 0); assert.equal(s.player.y, 0);
  advance(s, 1, { up: true, down: true }); assert.equal(s.player.lane, 0);
});

test("a quick jump tap before landing is remembered through the landing cooldown", () => {
  const s = emptyCourse(); requestJump(s, 1); advance(s, 0.33);
  stepGame(s, { jump: 1 });
  advance(s, 0.25);
  assert.equal(s.stats.jumps, 2); assert.equal(s.player.lane, 2);
  advance(s, 1); assert.equal(s.player.y, TRACK_GAP * 2); assert.equal(s.stats.jumps, 2);
});

test("early buffered taps expire, and tapping at the ceiling cannot cause a later phantom jump", () => {
  const s = emptyCourse(); requestJump(s, 1); advance(s, 0.05);
  stepGame(s, { jump: 1 }); advance(s, 1);
  assert.equal(s.stats.jumps, 1); assert.equal(s.player.lane, 1);
  s.player.lane = 3; s.player.y = TRACK_GAP * 3;
  stepGame(s, { jump: 1 }); assert.equal(s.player.jumpBuffer, null);
  advance(s, 1, { down: true }); assert.ok(s.player.lane < 3);
  assert.equal(s.player.jumpBuffer, null);
});

test("the latest buffered direction wins and track transfers clear buffered input", () => {
  const s = emptyCourse(); requestJump(s, 1); advance(s, 0.33);
  stepGame(s, { jump: 1 }); stepGame(s, { jump: -1 }); advance(s, 0.25);
  assert.equal(s.player.lane, 0); assert.equal(s.stats.jumps, 2);
  stepGame(s, { jump: 1 }); changeTracks(s, 2); assert.equal(s.player.jumpBuffer, null);
  advance(s, 2); assert.equal(s.player.lane, 0);
});

test("difficulty changes pace and fuel pressure while preserving the core rules", () => {
  const rides = Object.keys(DIFFICULTIES).map(difficulty => {
    const s = createGame(11, difficulty); s.entities = []; s.nextWave = s.nextSection = Infinity;
    assert.equal(s.lives, 3); assert.equal(s.laneCount, 4); advance(s, 10); return s;
  });
  const [cruise, arcade, mania] = rides;
  assert.ok(cruise.distance < arcade.distance && arcade.distance < mania.distance);
  assert.ok(cruise.fuel > arcade.fuel && arcade.fuel > mania.fuel);
  assert.equal(createGame(11, "bad mode").difficulty, "arcade");
  assert.equal(createGame(11, "toString").difficulty, "arcade");
});

test("every difficulty leaves a safe lane, with denser traffic and fewer fuel stops in Mania", () => {
  const counts = [];
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const s = createGame(29, difficulty); s.entities = []; s.laneCount = 10; s.distance = 20000; s.nextWave = Infinity;
    const totals = { hazards: 0, fuel: 0 };
    for (let i = 0; i < 20; i++) {
      s.entities = []; spawnWave(s);
      const hazards = s.entities.filter(e => e.kind !== "fuel");
      assert.ok(hazards.length < s.laneCount);
      assert.ok(hazards.every(e => e.lane !== s.safeLane));
      totals.hazards += hazards.length;
      totals.fuel += s.entities.filter(e => e.kind === "fuel").length;
    }
    counts.push(totals);
  }
  assert.ok(counts[0].hazards < counts[1].hazards && counts[1].hazards < counts[2].hazards);
  assert.ok(counts[0].fuel > counts[2].fuel);
});

test("fuel is collected by actual contact, capped at 100, and collected only once", () => {
  const s = emptyCourse(); s.fuel = 85;
  s.entities = [{ id: 9, kind: "fuel", x: 0, y: 22, lane: 0 }, { id: 10, kind: "fuel", x: 0, y: TRACK_GAP + 22, lane: 1 }];
  const events = stepGame(s); assert.equal(s.stats.bottles, 1); assert.ok(s.fuel > 99);
  assert.equal(events.filter(e => e.type === "fuel").length, 1);
  advance(s, 0.5); assert.equal(s.stats.bottles, 1);
});

for (const kind of ["car", "wheel", "fire", "fall", "blast"]) {
  test(`${kind} collision costs one life and consecutive hazards cannot consume recovery lives`, () => {
    const s = emptyCourse(); s.entities = [{ id: 10, kind, x: 0, y: 22, lane: 0, falling: true, landed: true }];
    stepGame(s); assert.equal(s.lives, 2); assert.ok(s.player.invulnerable > 2);
    s.entities.push({ id: 11, kind, x: 0, y: 22, lane: 0, falling: true, landed: true });
    stepGame(s); assert.equal(s.lives, 2);
  });
}

test("jumping does not grant invulnerability to a barrel crossing the jump path", () => {
  const s = emptyCourse(); requestJump(s, 1); advance(s, 0.2);
  s.entities = [{ id: 14, kind: "fall", x: 0, y: s.player.y + s.player.lift + 23, lane: 0, falling: true, landed: true }];
  stepGame(s); assert.equal(s.lives, 2);
});

test("exhaustion takes exactly one life and adds rescue fuel; the third loss ends the run", () => {
  const s = emptyCourse();
  for (let expected = 2; expected >= 0; expected--) {
    s.fuel = 0.001; const events = stepGame(s);
    assert.equal(s.lives, expected); assert.equal(events.filter(e => e.type === "hurt").length, 1);
    if (expected) assert.ok(s.fuel > 64.9 && s.fuel <= 65);
  }
  assert.equal(s.over, true); assert.equal(s.reason, "fuel");
  const frozen = structuredClone(s); assert.deepEqual(stepGame(s, { right: true }, 0.1), []); assert.deepEqual(s, frozen);
});

test("falling barrels warn first, descend through space, and settle on their destination track", () => {
  const s = emptyCourse(); s.player.invulnerable = 10;
  s.entities = [{ id: 18, kind: "fall", x: 400, lane: 0, y: 354, armed: false, warning: 0.8 }];
  const events = advance(s, 0.4); assert.ok(events.some(e => e.type === "fall-warning"));
  const barrel = s.entities[0]; assert.equal(barrel.y, 354); assert.equal(barrel.falling, undefined);
  advance(s, 0.6); assert.ok(barrel.y < 354 && barrel.y > 22); assert.equal(barrel.falling, true);
  advance(s, 1.2); assert.equal(barrel.y, 22); assert.equal(barrel.landed, true);
});

test("track changes move removed-track riders safely and scale the entire world smoothly", () => {
  const s = emptyCourse(); s.player.lane = 3; s.player.y = 3 * TRACK_GAP;
  s.entities = [{ id: 9, kind: "car", x: 500, lane: 1, y: 108 }, { id: 10, kind: "fuel", x: 500, lane: 3, y: 280 }];
  changeTracks(s, 2); assert.equal(s.laneCount, 2); assert.equal(s.zoom, 1); assert.equal(s.player.lane, 1);
  assert.ok(s.player.invulnerable >= s.player.jump.duration); assert.equal(s.entities.length, 1); assert.equal(s.entities[0].lane, 1);
  advance(s, 2); assert.equal(s.player.y, TRACK_GAP); assert.ok(s.zoom > 1.6); assert.equal(s.lives, 3);
  changeTracks(s, 5); advance(s, 2); assert.ok(s.zoom < 0.81); assert.equal(s.laneCount, 5);
});

test("section warnings arrive before the automatic track change", () => {
  const s = emptyCourse(); s.distance = SECTION_LENGTH - 300; s.nextSection = SECTION_LENGTH;
  const warning = stepGame(s); assert.ok(warning.some(e => e.type === "track-warning" && e.count === 2)); assert.equal(s.laneCount, 4);
  const events = advance(s, 2); assert.ok(events.some(e => e.type === "tracks" && e.count === 2)); assert.equal(s.section, 1);
});

test("speed surges are announced and expire; the base pace increases with distance", () => {
  const s = emptyCourse(); s.time = 21.99;
  assert.ok(advance(s, 0.1).some(e => e.type === "surge-warning"));
  assert.ok(advance(s, 2).some(e => e.type === "surge")); assert.equal(s.surge, true);
  advance(s, 2); assert.ok(s.speed > s.baseSpeed + 24);
  assert.ok(advance(s, 3).some(e => e.type === "surge-end")); assert.equal(s.surge, false);
  s.distance = 20000; stepGame(s); assert.ok(s.baseSpeed > 120);
});

test("seeded obstacle waves always leave a nearby safe track and place fuel there", () => {
  for (let count = 2; count <= 10; count++) {
    const s = emptyCourse(); s.laneCount = count; s.safeLane = 0; s.level = 12;
    for (let i = 0; i < 150; i++) {
      const old = s.safeLane; s.entities = []; spawnWave(s);
      assert.ok(Math.abs(s.safeLane - old) <= 1); assert.ok(s.safeLane >= 0 && s.safeLane < count);
      for (const e of s.entities) {
        assert.ok(e.lane >= 0 && e.lane < count);
        if (e.kind === "fuel") assert.equal(e.lane, s.safeLane);
        else assert.notEqual(e.lane, s.safeLane);
      }
      assert.ok(s.entities.filter(e => e.kind !== "fuel").length < count);
    }
  }
});

test("identical seeds and inputs reproduce a full run through game over", () => {
  const a = createGame(9981), b = createGame(9981);
  for (let i = 0; i < 60 * 90; i++) {
    const input = { up: i % 180 < 60, down: i % 180 > 120, right: i % 240 < 120, left: i % 240 >= 120 };
    assert.deepEqual(stepGame(a, input), stepGame(b, input));
    if (a.over) break;
  }
  assert.deepEqual(a, b); assert.equal(a.over, true); assert.ok(a.stats.jumps > 10);
});

test("retrying a course at different speeds preserves obstacle and fuel placement in every mode", () => {
  function course(difficulty, input) {
    const s = createGame(44187, difficulty), layout = [];
    for (let frame = 0; frame < 60 * 240 && s.section < 7; frame++) {
      // Isolate course layout from accidents and fuel exhaustion.
      s.fuel = 100; s.player.invulnerable = 1;
      const firstNewId = s.nextId;
      stepGame(s, input);
      for (const e of s.entities.filter(e => e.id >= firstNewId)) {
        layout.push([e.id, e.kind, e.lane, e.courseX, s.laneCount]);
      }
    }
    assert.equal(s.section, 7); assert.ok(layout.some(e => e[4] === 10)); return layout;
  }
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const accelerating = course(difficulty, { right: true, up: true });
    const braking = course(difficulty, { left: true, down: true });
    assert.deepEqual(accelerating, braking); assert.ok(accelerating.length > 15);
  }
});

test("Arcade visibly scrolls almost twice as fast as the previous 72 km/h version", () => {
  const s = createGame(7, "arcade");
  assert.ok(worldSpeed(s) >= 72 * 2.65 * 1.9);
  advance(s, 1); assert.ok(s.distance > 350);
});

test("water slows jumps and throttle response temporarily without taking a life", () => {
  const wet = emptyCourse(), dry = emptyCourse();
  wet.entities = [{ id: 9, kind: "water", x: 0, lane: 0, y: 2 }];
  const events = stepGame(wet);
  assert.equal(wet.lives, 3); assert.equal(wet.player.surface.kind, "water");
  assert.equal(events.filter(e => e.type === "surface").length, 1);
  requestJump(wet, 1); requestJump(dry, 1);
  assert.ok(wet.player.jump.duration > dry.player.jump.duration * 1.5);
  advance(wet, 0.5, { right: true }); advance(dry, 0.5, { right: true });
  assert.ok(wet.speed < dry.speed - 10);
  assert.ok(advance(wet, 1.2).some(e => e.type === "grip-restored"));
  assert.equal(wet.player.surface, null); requestJump(wet, -1);
  assert.equal(wet.player.jump.duration, JUMP_TIME);
});

test("oil briefly locks track changes, keeps braking available, and then releases held input", () => {
  const s = emptyCourse(); s.entities = [{ id: 9, kind: "oil", x: 0, lane: 0, y: 2 }];
  stepGame(s); assert.equal(s.player.surface.kind, "oil"); assert.equal(s.lives, 3);
  assert.equal(requestJump(s, 1), false);
  advance(s, 0.5, { up: true, left: true });
  assert.equal(s.player.lane, 0); assert.ok(s.speed < s.baseSpeed - 25);
  advance(s, 0.5, { up: true });
  assert.equal(s.player.surface, null); assert.equal(s.player.lane, 1); assert.equal(s.stats.jumps, 1);
});

test("airborne wheels clear spills and an early oil-locked tap cannot become a phantom hop", () => {
  const airborne = emptyCourse(); requestJump(airborne, 1);
  airborne.entities = [{ id: 9, kind: "oil", x: 0, lane: 0, y: 2 }];
  advance(airborne, 0.3); assert.equal(airborne.player.surface, null);
  const locked = emptyCourse(); locked.entities = [{ id: 9, kind: "oil", x: 0, lane: 0, y: 2 }];
  stepGame(locked); stepGame(locked, { jump: 1 }); advance(locked, 1.2);
  assert.equal(locked.stats.jumps, 0); assert.equal(locked.player.surface, null);
});

test("a water patch cannot weaken an oil lock; damage and track transfers restore grip", () => {
  const s = emptyCourse();
  s.player.surface = { kind: "oil", remaining: 0.5, duration: SURFACE_DURATION.oil };
  s.entities = [{ id: 9, kind: "water", x: 0, lane: 0, y: 2 }]; stepGame(s);
  assert.equal(s.player.surface.kind, "oil"); assert.ok(s.player.surface.remaining < 0.5);
  s.entities = [{ id: 10, kind: "car", x: 0, lane: 0, y: 22 }]; stepGame(s);
  assert.equal(s.player.surface, null); assert.equal(s.lives, 2);
  s.player.surface = { kind: "water", remaining: 1, duration: SURFACE_DURATION.water };
  changeTracks(s, 10); assert.equal(s.player.surface, null);
});

test("hot barrels warn before exploding, travel upward across tracks, and leave above the ceiling", () => {
  const s = emptyCourse(); s.player.invulnerable = 10;
  const barrel = { id: 9, kind: "blast", x: worldSpeed(s) * 1.1, lane: 0, y: 22, armed: false, warning: 0.65, launchSpeed: 680 };
  s.entities = [barrel];
  assert.ok(stepGame(s).some(e => e.type === "blast-warning"));
  advance(s, 0.3); assert.equal(barrel.y, 22); assert.ok(!barrel.rising);
  const events = advance(s, 0.4); assert.equal(events.filter(e => e.type === "blast").length, 1);
  assert.equal(barrel.rising, true); assert.ok(barrel.y > 22);
  advance(s, 1); assert.ok(barrel.y > TRACK_GAP * 3); assert.ok(!s.entities.includes(barrel));
  assert.equal(s.stats.dodged, 1);
});

test("launched barrels can hit a rider on an upper track", () => {
  const s = emptyCourse(); s.player.lane = 2; s.player.y = TRACK_GAP * 2;
  s.entities = [{ id: 9, kind: "blast", x: 0, lane: 0, y: s.player.y + 22, armed: true, rising: true, launchSpeed: 680 }];
  stepGame(s); assert.equal(s.lives, 2); assert.equal(s.reason, "blast");
});

test("braking after a hot-barrel warning changes whether its upward flight hits the rider", () => {
  function ride(input) {
    const s = emptyCourse(); s.player.lane = 2; s.player.y = TRACK_GAP * 2;
    s.entities = [{ id: 9, kind: "blast", x: worldSpeed(s) * 1.15, lane: 0, y: 22, armed: true, warning: 0.65, launchSpeed: 344 }];
    advance(s, 2, input); return s;
  }
  assert.equal(ride({}).lives, 2); assert.equal(ride({ left: true }).lives, 3);
});

test("the expanding course reaches ten and seven tracks, then safely shrinks again", () => {
  const s = createGame(23), counts = [];
  for (let frame = 0; frame < 60 * 160 && s.section < TRACK_SEQUENCE.length; frame++) {
    s.fuel = 100; s.player.invulnerable = 1;
    for (const e of stepGame(s)) if (e.type === "tracks") counts.push(e.count);
    assert.ok(s.player.lane >= 0 && s.player.lane < s.laneCount);
    assert.ok(s.zoom >= 0.4 && s.zoom <= 1.65);
  }
  assert.deepEqual(counts, [...TRACK_SEQUENCE.slice(1), TRACK_SEQUENCE[0]]);
  changeTracks(s, 10); advance(s, 2); assert.ok(s.zoom < 0.41);
  s.player.lane = 9; s.player.y = TRACK_GAP * 9; changeTracks(s, 2);
  assert.equal(s.player.lane, 1); assert.ok(s.player.invulnerable >= s.player.jump.duration);
});

test("waves include both spills and upward launchers, with launchers always on the floor", () => {
  const s = createGame(14), kinds = new Set(); s.entities = []; s.nextWave = Infinity;
  for (let i = 0; i < 100; i++) {
    s.entities = []; spawnWave(s);
    for (const e of s.entities) { kinds.add(e.kind); if (e.kind === "blast") assert.equal(e.lane, 0); }
  }
  assert.ok(kinds.has("water")); assert.ok(kinds.has("oil")); assert.ok(kinds.has("blast"));
});
