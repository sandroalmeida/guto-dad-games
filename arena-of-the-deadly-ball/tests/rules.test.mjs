import test from "node:test";
import assert from "node:assert/strict";
import {
  ARENA, LIVES, PLAYER_RADIUS, PLAYER_SPEED, BALL_RADIUS, PARALYZE_TIME, WINDUP_TIME, SPIN_TIME, SPIN_BLADE,
  LASER_BOUNCES, TRIANGLE_LIFETIME, INVULNERABLE_TIME, POWERS,
  createGame, stepGame, laserTrail, stringTips, spinBlades, dangerAt, ballSpeed,
} from "../logic.js";

const DT = 1 / 60;

// A quiet arena: no random pickups unless a test adds them.
function quietGame(seed = 1) {
  const g = createGame(seed);
  g.flameTimer = 1e9;
  g.triangleTimer = 1e9;
  return g;
}

function run(g, seconds, input = {}, onEvents = () => {}) {
  const all = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    const events = stepGame(g, typeof input === "function" ? input(g) : input, DT);
    all.push(...events);
    onEvents(events);
    if (g.over) break;
  }
  return all;
}

// Park the ball far from the player and keep it still (paralyzed is the simplest way).
function parkBall(g, x = 100, y = 100) {
  g.ball.x = x; g.ball.y = y; g.ball.vx = 0; g.ball.vy = 0; g.ball.paralyzed = 1e9;
}

function fire(g, power) {
  g.ball.paralyzed = 0;
  g.ball.windup = 1e-6;
  g.ball.pending = power;
}

test("the same seed plays out the same game", () => {
  const a = createGame(42), b = createGame(42);
  const input = (g) => ({ left: g.time % 3 < 1.5, up: g.time % 2 < 1 });
  run(a, 40, input);
  run(b, 40, input);
  assert.deepEqual(a, b);
});

test("the player starts with 3 lives, facing the ball, far from it", () => {
  const g = createGame(3);
  assert.equal(g.lives, LIVES);
  assert.equal(LIVES, 3);
  assert.ok(g.player.fx < 0, "faces left, toward the ball");
  assert.ok(Math.hypot(g.player.x - g.ball.x, g.player.y - g.ball.y) > 400);
});

test("arrows move the player at a steady speed, diagonals are not faster, walls stop them", () => {
  const g = quietGame();
  parkBall(g);
  const x0 = g.player.x;
  run(g, 1, { right: true });
  assert.ok(Math.abs(g.player.x - Math.min(x0 + PLAYER_SPEED, ARENA.width - PLAYER_RADIUS)) < 1);
  g.player.x = 400; g.player.y = 300;
  run(g, 1, { right: true, down: true });
  assert.ok(Math.abs(Math.hypot(g.player.x - 400, g.player.y - 300) - PLAYER_SPEED) < 1);
  run(g, 10, { left: true, up: true });
  assert.equal(g.player.x, PLAYER_RADIUS);
  assert.equal(g.player.y, PLAYER_RADIUS);
  assert.ok(g.player.fx < 0 && g.player.fy < 0, "faces the way they last moved");
  run(g, 1, {});
  assert.ok(g.player.fx < 0 && g.player.fy < 0, "keeps facing that way when standing still");
});

test("the ball roams the whole arena and never leaves it", () => {
  const g = quietGame(9);
  g.player.invulnerable = 1e9;
  const visited = new Set();
  run(g, 120, {}, () => {
    assert.ok(g.ball.x >= BALL_RADIUS - 1e-6 && g.ball.x <= ARENA.width - BALL_RADIUS + 1e-6);
    assert.ok(g.ball.y >= BALL_RADIUS - 1e-6 && g.ball.y <= ARENA.height - BALL_RADIUS + 1e-6);
    visited.add(`${Math.floor(g.ball.x / 240)},${Math.floor(g.ball.y / 200)}`);
  });
  assert.ok(visited.size >= 10, `ball visited ${visited.size} of 12 arena zones`);
});

test("the ball gets faster as the danger level climbs", () => {
  assert.equal(dangerAt(0), 1);
  assert.ok(dangerAt(60) > dangerAt(20));
  assert.ok(ballSpeed(dangerAt(200)) > ballSpeed(1) * 1.5);
});

test("the player picks up a triangle, carries it, and only one at a time", () => {
  const g = quietGame();
  parkBall(g);
  g.player.x = 500; g.player.y = 300;
  g.triangles.push({ id: 90, x: 540, y: 300, life: TRIANGLE_LIFETIME, age: 0 });
  g.triangles.push({ id: 91, x: 700, y: 300, life: TRIANGLE_LIFETIME, age: 0 });
  const events = run(g, 0.3, { right: true });
  assert.ok(events.some((e) => e.type === "pickup"));
  assert.equal(g.player.holding, true);
  run(g, 1, { right: true }); // walks over the second one
  assert.equal(g.triangles.length, 1, "can't carry two");
});

test("triangles disappear if nobody grabs them in time", () => {
  const g = quietGame();
  parkBall(g);
  g.triangles.push({ id: 90, x: 300, y: 500, life: TRIANGLE_LIFETIME, age: 0 });
  const events = run(g, TRIANGLE_LIFETIME + 0.1);
  assert.equal(g.triangles.length, 0);
  assert.ok(events.some((e) => e.type === "triangleExpire"));
});

test("the ball can't take a triangle and the player can't take a flame", () => {
  const g = quietGame();
  g.player.invulnerable = 1e9;
  g.ball.x = 300; g.ball.y = 300; g.ball.tx = 600; g.ball.ty = 300; g.ball.vx = 200; g.ball.vy = 0; g.ball.retarget = 10;
  g.triangles.push({ id: 90, x: 360, y: 300, life: 100, age: 0 });
  run(g, 0.6);
  assert.equal(g.triangles.length, 1, "triangle is still there after the ball rolled over it");

  const h = quietGame();
  parkBall(h);
  h.player.x = 500; h.player.y = 300;
  h.flames.push({ id: 91, x: 560, y: 300, age: 0 });
  run(h, 0.5, { right: true });
  assert.equal(h.flames.length, 1, "flame is still there after the player walked over it");
  assert.equal(h.player.holding, false);
});

test("Space throws the triangle straight ahead; hitting the ball freezes it for 3 seconds", () => {
  const g = quietGame();
  g.player.x = 700; g.player.y = 300; g.player.fx = -1; g.player.fy = 0; g.player.holding = true;
  g.ball.x = 300; g.ball.y = 300; g.ball.vx = 0; g.ball.vy = 0; g.ball.tx = 300; g.ball.ty = 300; g.ball.retarget = 10;
  const events = stepGame(g, { throw: true }, DT);
  assert.ok(events.some((e) => e.type === "throw"));
  assert.equal(g.player.holding, false);
  assert.equal(g.thrown.length, 1);
  assert.ok(g.thrown[0].vx < 0 && g.thrown[0].vy === 0, "flies the way the player faces");

  let zap = null;
  run(g, 1, {}, (evs) => { zap ??= evs.find((e) => e.type === "zap"); });
  assert.ok(zap, "the ball got hit");
  assert.equal(g.stats.zaps, 1);
  const frozenAt = { x: g.ball.x, y: g.ball.y };
  assert.ok(g.ball.paralyzed > PARALYZE_TIME - 1.1);
  g.flames.push({ id: 5, x: g.ball.x, y: g.ball.y, age: 0 });
  run(g, g.ball.paralyzed - 0.05);
  assert.deepEqual({ x: g.ball.x, y: g.ball.y }, frozenAt, "a frozen ball doesn't move");
  assert.equal(g.flames.length, 1, "or eat flames");
  const wake = run(g, 0.2);
  assert.ok(wake.some((e) => e.type === "wake"));
  run(g, 0.5);
  assert.notDeepEqual({ x: g.ball.x, y: g.ball.y }, frozenAt, "and rolls again after 3 seconds");
});

test("a frozen ball can't hurt the player", () => {
  const g = quietGame();
  parkBall(g, 400, 300);
  g.player.x = 420; g.player.y = 300;
  run(g, 1);
  assert.equal(g.lives, LIVES);
});

test("pressing Space with empty hands does nothing, and a missed throw is gone", () => {
  const g = quietGame();
  parkBall(g, 100, 500);
  assert.deepEqual(stepGame(g, { throw: true }, DT).filter((e) => e.type === "throw"), []);
  g.player.holding = true; g.player.fx = 0; g.player.fy = -1;
  const events = run(g, 1, (gg) => ({ throw: gg.time < 0.05 }));
  assert.ok(events.some((e) => e.type === "miss"));
  assert.equal(g.thrown.length, 0);
});

test("when the ball eats a flame it glows, then fires one of the three secret powers", () => {
  const g = quietGame();
  g.player.x = 900; g.player.y = 560; g.player.invulnerable = 1e9;
  g.ball.x = 300; g.ball.y = 300; g.ball.vx = 150; g.ball.vy = 0; g.ball.tx = 800; g.ball.ty = 300; g.ball.retarget = 10;
  g.flames.push({ id: 5, x: 340, y: 300, age: 0 });
  const eaten = run(g, 0.4).find((e) => e.type === "flameEaten");
  assert.ok(eaten, "the ball ate the flame");
  assert.ok(g.ball.windup > 0 && POWERS.includes(g.ball.pending));
  const power = run(g, WINDUP_TIME).find((e) => e.type === "power");
  assert.ok(power && POWERS.includes(power.power));
});

test("all three powers show up about equally often", () => {
  const counts = { laser: 0, spin: 0, strings: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const g = quietGame(seed);
    g.player.invulnerable = 1e9;
    g.flames.push({ id: 5, x: g.ball.x + 5, y: g.ball.y, age: 0 });
    const e = run(g, 1).find((ev) => ev.type === "power");
    counts[e.power]++;
  }
  for (const p of POWERS) assert.ok(counts[p] > 70, `${p}: ${counts[p]} of 300`);
});

test("the laser bounces off the walls exactly 2 times and then fades", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = quietGame(seed);
    parkBall(g, 200 + seed * 25, 150 + seed * 12);
    g.player.invulnerable = 1e9;
    fire(g, "laser");
    const events = run(g, 8);
    assert.equal(events.filter((e) => e.type === "laserBounce").length, LASER_BOUNCES);
    assert.equal(events.filter((e) => e.type === "laserEnd").length, 1);
    assert.equal(g.lasers.length, 0);
  }
});

test("the laser costs a life when it hits the player", () => {
  const g = quietGame(4);
  g.ball.x = 200; g.ball.y = 300;
  fire(g, "laser");
  stepGame(g, {}, DT);
  const l = g.lasers[0];
  g.ball.paralyzed = 1e9;
  // Stand in its path.
  g.player.x = l.hx + l.dx * 250; g.player.y = l.hy + l.dy * 250;
  const hurt = run(g, 1).find((e) => e.type === "hurt");
  assert.equal(hurt?.cause, "laser");
  assert.equal(g.lives, LIVES - 1);
});

test("the knife spin lasts 3 seconds while the ball keeps moving, and the blades hurt", () => {
  const g = quietGame(2);
  g.player.x = 900; g.player.y = 560; g.player.invulnerable = 1e9;
  g.ball.x = 400; g.ball.y = 300;
  fire(g, "spin");
  stepGame(g, {}, DT);
  assert.ok(g.ball.spin > SPIN_TIME - 0.1);
  const start = { x: g.ball.x, y: g.ball.y };
  const angle0 = g.ball.spinAngle;
  run(g, 1.5);
  assert.ok(Math.hypot(g.ball.x - start.x, g.ball.y - start.y) > 100, "keeps rolling");
  assert.ok(g.ball.spinAngle - angle0 > Math.PI * 2, "spins quickly");
  const blade = spinBlades(g.ball)[0];
  assert.ok(Math.hypot(blade.bx - g.ball.x, blade.by - g.ball.y) >= BALL_RADIUS + SPIN_BLADE - 1e-6);
  const ends = run(g, 1.6);
  assert.ok(ends.some((e) => e.type === "spinEnd"));
  assert.equal(g.ball.spin, 0);

  // Blade tip reaches a player standing just out of the ball's own reach.
  const h = quietGame(2);
  h.ball.x = 400; h.ball.y = 300;
  fire(h, "spin");
  stepGame(h, {}, DT);
  h.ball.paralyzed = 0; h.ball.vx = 0; h.ball.vy = 0; h.ball.tx = 400; h.ball.ty = 300; h.ball.retarget = 10;
  h.player.x = 400 + BALL_RADIUS + PLAYER_RADIUS + 30; h.player.y = 300;
  const hurt = run(h, 1).find((e) => e.type === "hurt");
  assert.equal(hurt?.cause, "spin");
});

test("the metal strings fly in opposite directions until they reach the walls, then pull back", () => {
  for (let seed = 1; seed <= 15; seed++) {
    const g = quietGame(seed);
    g.player.x = 30; g.player.y = 30; g.player.invulnerable = 1e9;
    g.ball.x = 300 + seed * 20; g.ball.y = 200 + seed * 10;
    fire(g, "strings");
    stepGame(g, {}, DT);
    const s = g.strings[0];
    assert.ok(Math.abs(s.dirs[0].dx + s.dirs[1].dx) < 1e-9 && Math.abs(s.dirs[0].dy + s.dirs[1].dy) < 1e-9, "opposite");
    const origin = { x: g.ball.x, y: g.ball.y };
    let tipsAtWall = null;
    const events = run(g, 4, {}, (evs) => { tipsAtWall ??= evs.find((e) => e.type === "stringsWall")?.tips; });
    assert.ok(tipsAtWall, "reached the walls");
    for (const tip of tipsAtWall) {
      const edge = Math.min(tip.x, ARENA.width - tip.x, tip.y, ARENA.height - tip.y);
      assert.ok(edge < 5, `tip at a wall (edge distance ${edge.toFixed(1)})`);
    }
    assert.ok(events.some((e) => e.type === "dodged" && e.power === "strings"));
    assert.equal(g.strings.length, 0, "pulled back in");
    assert.ok(Math.hypot(g.ball.x - origin.x, g.ball.y - origin.y) > 1, "the ball rolls on afterwards");
  }
});

test("a string tip costs a life", () => {
  const g = quietGame(8);
  g.ball.x = 480; g.ball.y = 300;
  fire(g, "strings");
  stepGame(g, {}, DT);
  const d = g.strings[0].dirs[0];
  g.player.x = 480 + d.dx * 180; g.player.y = 300 + d.dy * 180;
  const hurt = run(g, 1).find((e) => e.type === "hurt");
  assert.equal(hurt?.cause, "strings");
  void stringTips;
});

test("freezing the ball while it glows cancels its power", () => {
  const g = quietGame();
  g.player.x = 700; g.player.y = 300; g.player.fx = -1; g.player.fy = 0; g.player.holding = true;
  g.ball.x = 560; g.ball.y = 300; g.ball.vx = 0; g.ball.vy = 0; g.ball.tx = 560; g.ball.ty = 300; g.ball.retarget = 10;
  g.ball.windup = WINDUP_TIME; g.ball.pending = "laser";
  const events = run(g, 1.5, (gg) => ({ throw: gg.time < 0.02 }));
  const zap = events.find((e) => e.type === "zap");
  assert.equal(zap?.cancelled, "windup");
  assert.ok(!events.some((e) => e.type === "power"));
  assert.equal(g.lasers.length, 0);
});

test("touching the ball costs a life, then a short blink keeps the player safe", () => {
  const g = quietGame();
  g.ball.x = 400; g.ball.y = 300; g.ball.vx = 0; g.ball.vy = 0;
  g.player.x = 420; g.player.y = 300;
  const first = stepGame(g, {}, DT);
  assert.equal(first.find((e) => e.type === "hurt")?.cause, "ball");
  assert.equal(g.lives, LIVES - 1);
  assert.ok(g.player.invulnerable > INVULNERABLE_TIME - 0.02);
  run(g, INVULNERABLE_TIME - 0.1, (gg) => { gg.ball.x = gg.player.x; gg.ball.y = gg.player.y; return {}; });
  assert.equal(g.lives, LIVES - 1, "no second hit while blinking");
});

test("losing all 3 hearts ends the game and freezes the clock", () => {
  const g = quietGame();
  let hits = 0;
  run(g, 30, (gg) => { gg.ball.x = gg.player.x - 10; gg.ball.y = gg.player.y; gg.ball.paralyzed = 0; return {}; },
    (evs) => { hits += evs.filter((e) => e.type === "hurt").length; });
  assert.equal(hits, 3);
  assert.equal(g.over, true);
  assert.equal(g.lives, 0);
  const t = g.time;
  assert.deepEqual(stepGame(g, { right: true }, DT), []);
  assert.equal(g.time, t);
});

test("flames and triangles keep appearing during a match, away from the player", () => {
  const g = createGame(11);
  g.player.invulnerable = 1e9;
  const spawns = [];
  run(g, 90, (gg) => { gg.player.invulnerable = 1e9; return {}; }, (evs) => {
    for (const e of evs) if (e.type === "flameSpawn" || e.type === "triangleSpawn") spawns.push({ ...e, px: g.player.x, py: g.player.y });
  });
  const flames = spawns.filter((e) => e.type === "flameSpawn").length;
  const triangles = spawns.filter((e) => e.type === "triangleSpawn").length;
  assert.ok(flames >= 10, `${flames} flames in 90 s`);
  assert.ok(triangles >= 5, `${triangles} triangles in 90 s`);
  for (const e of spawns) assert.ok(Math.hypot(e.x - e.px, e.y - e.py) >= 139, "not on top of the player");
});

test("laser trail is a connected path no longer than its trail length", () => {
  const g = quietGame(6);
  parkBall(g, 300, 300);
  g.player.invulnerable = 1e9;
  fire(g, "laser");
  run(g, 1.2, {}, () => {
    for (const l of g.lasers) {
      const pts = laserTrail(l);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      assert.ok(len <= l.head - l.tail + 1e-6 && len >= Math.min(l.head, 280) - 1 - (l.stopped ? 1e9 : 0));
    }
  });
});
