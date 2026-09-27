// The Arena of the Deadly Ball — rendering, input, sound and screens.
// All the rules live in logic.js; this file only draws them and reacts to their events.
import {
  ARENA, BALL_RADIUS, PLAYER_RADIUS, SPIN_BLADE, WINDUP_TIME, PARALYZE_TIME, TRIANGLE_LIFETIME, MAX_DANGER, LIVES,
  createGame, stepGame, laserTrail, stringTips, spinBlades,
} from "./logic.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#arena");
const ctx = canvas.getContext("2d");
const ui = {
  wrap: $("#arena-wrap"), topbar: $(".topbar"), cards: $(".cards"), move: $(".move-card"),
  start: $("#start-screen"), pause: $("#pause-screen"), over: $("#over-screen"),
  startButton: $("#start-button"), resumeButton: $("#resume-button"), againButton: $("#again-button"),
  pauseButton: $("#pause-button"), muteButton: $("#mute-button"),
  startBest: $("#start-best"), overKicker: $("#over-kicker"), overTitle: $("#over-title"),
  finalTime: $("#final-time"), finalBest: $("#final-best"), finalZaps: $("#final-zaps"),
  finalDodged: $("#final-dodged"), finalDanger: $("#final-danger"), newRecord: $("#new-record"),
  flameCard: $("#flame-card"), flameStatus: $("#flame-status"),
  triangleCard: $("#triangle-card"), triangleStatus: $("#triangle-status"),
  keys: [...document.querySelectorAll(".key")],
};

const TAU = Math.PI * 2;
const SIDE = 26, TOP = 76, BOTTOM = 26;
const VIEW_W = ARENA.width + SIDE * 2, VIEW_H = ARENA.height + TOP + BOTTOM;
const INK = "#2a1d3a";
const HEART_COLORS = ["#ff4b3e", "#ff9a2e", "#ffd21f"];
const POWER_LABELS = { laser: ["LASER!", "#ff4b5c"], spin: ["KNIFE SPIN!", "#ffffff"], strings: ["METAL STRINGS!", "#9fe0ff"] };
const HURT_LABELS = { ball: "BONK!", laser: "LASER HIT!", spin: "KNIFE HIT!", strings: "STRING HIT!" };
const DANGER_LINES = [
  "The ball is getting faster!", "More flames are coming!", "The ball is hunting you!",
  "Keep moving!", "It's getting wild!", "Don't give up!", "Can you still dodge?", "Maximum danger!",
];

let scale = 1, dpr = 1, background = null;
let mode = "menu"; // menu | playing | paused | over
let game = createGame(12345);
let overTimer = 0, hitstop = 0, shake = 0, flash = 0, clock = 0;
let particles = [], texts = [], rings = [], banner = null, heartLoss = [];
let best = loadNumber("deadlyBall.best", 0);
let firstPickupShown = false, lastSwish = 0;

// ---------- input ----------

const held = { up: false, down: false, left: false, right: false };
const touchHeld = { up: false, down: false, left: false, right: false };
let throwQueued = false;
const KEY_DIRS = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};

addEventListener("keydown", (e) => {
  const dir = KEY_DIRS[e.code];
  if (dir) { held[dir] = true; e.preventDefault(); }
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) {
      if (mode === "playing") throwQueued = true;
      else if (mode === "over" && overTimer > 1.6) startGame();
    }
  }
  if (e.code === "Enter" || e.code === "NumpadEnter") {
    e.preventDefault();
    if (mode === "menu" || (mode === "over" && overTimer > 1.2)) startGame();
    else if (mode === "paused") setPaused(false);
  }
  if (e.code === "KeyP" || e.code === "Escape") { if (mode === "playing" || mode === "paused") setPaused(mode === "playing"); }
  if (e.code === "KeyM") toggleMute();
  refreshKeys();
});
addEventListener("keyup", (e) => {
  const dir = KEY_DIRS[e.code];
  if (dir) { held[dir] = false; refreshKeys(); }
});
addEventListener("blur", () => {
  for (const k in held) held[k] = false;
  if (mode === "playing") setPaused(true);
  refreshKeys();
});

for (const key of ui.keys) {
  const dir = key.dataset.dir;
  const release = () => { touchHeld[dir] = false; refreshKeys(); };
  key.addEventListener("pointerdown", (e) => { e.preventDefault(); touchHeld[dir] = true; key.setPointerCapture?.(e.pointerId); refreshKeys(); });
  key.addEventListener("pointerup", release);
  key.addEventListener("pointercancel", release);
  key.addEventListener("lostpointercapture", release);
}
ui.triangleCard.addEventListener("pointerdown", (e) => { e.preventDefault(); if (mode === "playing") throwQueued = true; });
ui.startButton.addEventListener("click", () => startGame());
ui.againButton.addEventListener("click", () => startGame());
ui.resumeButton.addEventListener("click", () => setPaused(false));
ui.pauseButton.addEventListener("click", () => { if (mode === "playing" || mode === "paused") setPaused(mode === "playing"); });
ui.muteButton.addEventListener("click", () => toggleMute());

function currentInput() {
  return {
    up: held.up || touchHeld.up, down: held.down || touchHeld.down,
    left: held.left || touchHeld.left, right: held.right || touchHeld.right,
  };
}

function refreshKeys() {
  const input = currentInput();
  for (const key of ui.keys) key.classList.toggle("pressed", !!input[key.dataset.dir]);
}

// ---------- screens ----------

function startGame(seed = (Math.random() * 2 ** 31) | 0) {
  sound.init();
  game = createGame(seed);
  mode = "playing";
  overTimer = 0; hitstop = 0; shake = 0; flash = 0;
  particles = []; texts = []; rings = []; heartLoss = [];
  throwQueued = false;
  banner = { title: "GO!", sub: "Survive as long as you can", t: 0, life: 1.6 };
  ui.start.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.over.classList.add("hidden");
  sound.startMusic();
  sound.fanfare();
}

function setPaused(paused) {
  if (paused && mode === "playing") {
    mode = "paused";
    ui.pause.classList.remove("hidden");
    sound.stopMusic();
  } else if (!paused && mode === "paused") {
    mode = "playing";
    ui.pause.classList.add("hidden");
    lastFrame = performance.now();
    sound.startMusic();
  }
}

function showGameOver() {
  const time = game.time;
  const record = time > best;
  if (record) { best = time; saveNumber("deadlyBall.best", best); }
  ui.finalTime.textContent = formatTime(time);
  ui.finalBest.textContent = formatTime(best);
  ui.finalZaps.textContent = game.stats.zaps;
  ui.finalDodged.textContent = game.stats.dodged;
  ui.finalDanger.textContent = game.danger;
  ui.newRecord.classList.toggle("hidden", !record);
  ui.overTitle.textContent = time >= 180 ? "Arena legend!" : time >= 90 ? "What a fight!" : time >= 45 ? "Nice dodging!" : "The ball got you!";
  ui.over.classList.remove("hidden");
  updateBestLine();
}

function updateBestLine() {
  ui.startBest.textContent = best > 0 ? `★ Your best: ${formatTime(best)}` : "";
}

function formatTime(t) {
  if (t < 60) return `${t.toFixed(1)}s`;
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

function toggleMute() {
  sound.setMuted(!sound.muted);
  ui.muteButton.classList.toggle("muted", sound.muted);
}

// ---------- events from the rules ----------

function handleEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case "danger":
        banner = { title: `DANGER ${e.level}!`, sub: DANGER_LINES[Math.min(DANGER_LINES.length - 1, e.level - 2)], t: 0, life: 2.2 };
        sound.fanfare();
        break;
      case "throw":
        sound.whoosh();
        break;
      case "pickup":
        burst(e.x, e.y, 16, ["#ffd21f", "#fff38a", "#ffffff"], 180);
        floatText(firstPickupShown ? "GOT IT!" : "SPACE TO THROW!", e.x, e.y - 30, "#ffd21f", 24);
        firstPickupShown = true;
        sound.pickup();
        break;
      case "triangleSpawn":
        rings.push({ x: e.x, y: e.y, r0: 60, r1: 18, life: 0.6, max: 0.6, color: "#ffd21f", width: 5 });
        sound.chime();
        break;
      case "triangleExpire":
        burst(e.x, e.y, 10, ["#ffd21f", "#c9b27a"], 90);
        break;
      case "flameSpawn":
        burst(e.x, e.y, 12, ["#ff8a1f", "#ffcf4a", "#e5281f"], 120);
        sound.crackle();
        break;
      case "flameEaten":
        burst(e.x, e.y, 22, ["#ff8a1f", "#ffcf4a", "#e5281f"], 220);
        floatText("?!", e.x, e.y - 40, "#ff6b3e", 34);
        sound.charge();
        break;
      case "power": {
        const [label, color] = POWER_LABELS[e.power];
        texts = texts.filter((t) => t.text !== "?!");
        floatText(label, e.x, e.y - 46, color, 30);
        shake = Math.max(shake, 5);
        if (e.power === "laser") sound.laser();
        if (e.power === "spin") sound.knives();
        if (e.power === "strings") sound.twang();
        break;
      }
      case "laserBounce":
        burst(e.x, e.y, 12, ["#ff4b5c", "#ffffff", "#ffb3bb"], 260, "spark");
        sound.ping();
        break;
      case "laserEnd":
        burst(e.x, e.y, 16, ["#ff4b5c", "#ffffff"], 220, "spark");
        break;
      case "stringsWall":
        for (const tip of e.tips) burst(tip.x, tip.y, 10, ["#ffffff", "#dfe6f0", "#ffd21f"], 200, "spark");
        sound.clank();
        break;
      case "zap":
        burst(e.x, e.y, 30, ["#ffd21f", "#fff38a", "#7fd7ff", "#ffffff"], 320, "spark");
        rings.push({ x: e.x, y: e.y, r0: 20, r1: 90, life: 0.45, max: 0.45, color: "#fff36b", width: 6 });
        floatText(e.cancelled ? "ZAP! BLOCKED!" : "ZAP!", e.x, e.y - 48, "#ffd21f", 34);
        shake = Math.max(shake, 7);
        sound.zap();
        break;
      case "miss":
        burst(e.x, e.y, 8, ["#ffd21f", "#c9b27a"], 100);
        sound.thud();
        break;
      case "wake":
        floatText("!", e.x, e.y - 40, "#6ea0ff", 30);
        sound.wake();
        break;
      case "dodged":
        floatText("DODGED!", game.player.x, game.player.y - 34, "#6dff8e", 20);
        sound.dodged();
        break;
      case "hurt":
        shake = 16; flash = 1; hitstop = 0.16;
        heartLoss.push({ index: e.lives, t: 0 });
        burst(e.x, e.y, 26, ["#ff4b3e", "#ff9a2e", "#ffffff"], 280);
        floatText(HURT_LABELS[e.cause], e.x, e.y - 36, "#ff4b3e", 30);
        sound.hurt();
        break;
      case "gameover":
        mode = "over";
        overTimer = 0;
        sound.stopMusic();
        sound.gameOver();
        break;
    }
  }
}

function burst(x, y, count, colors, speed, shape = "dot") {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU, v = speed * (0.35 + Math.random() * 0.75);
    const life = 0.35 + Math.random() * 0.45;
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life,
      color: colors[i % colors.length], size: 2.5 + Math.random() * 3.5, shape,
    });
  }
}

function floatText(text, x, y, color, size) {
  texts.push({ text, x: Math.max(80, Math.min(ARENA.width - 80, x)), y: Math.max(30, y), color, size, life: 1.1, max: 1.1 });
}

function updateEffects(dt) {
  for (const p of particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.04, dt); p.vy *= Math.pow(0.04, dt);
  }
  particles = particles.filter((p) => p.life > 0);
  for (const t of texts) { t.life -= dt; t.y -= 38 * dt; }
  texts = texts.filter((t) => t.life > 0);
  for (const r of rings) r.life -= dt;
  rings = rings.filter((r) => r.life > 0);
  for (const h of heartLoss) h.t += dt;
  if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; }
  shake = Math.max(0, shake - dt * 40);
  flash = Math.max(0, flash - dt * 2.2);
}

// ---------- main loop ----------

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  clock += dt;

  if (mode === "menu") {
    // Attract mode: the ball rolls around, nobody gets hurt.
    if (game.time > 45) game = createGame((Math.random() * 2 ** 31) | 0);
    game.player.invulnerable = 5;
    game.lives = LIVES;
    stepGame(game, {}, dt);
  } else if (mode === "playing") {
    if (hitstop > 0) {
      hitstop -= dt;
    } else {
      const input = currentInput();
      input.throw = throwQueued;
      throwQueued = false;
      handleEvents(stepGame(game, input, dt));
      if (game.ball.spin > 0 && clock - lastSwish > 0.16) { lastSwish = clock; sound.swish(); }
      sound.setTempo(game.danger);
    }
  } else if (mode === "over") {
    const before = overTimer;
    overTimer += dt;
    if (before < 1.2 && overTimer >= 1.2) showGameOver();
  }
  if (mode !== "paused") updateEffects(dt);

  render();
  updateCards();
  requestAnimationFrame(frame);
}

// ---------- layout ----------

function resize() {
  const narrow = innerWidth <= 760;
  const availW = innerWidth - 32 - (narrow ? 0 : ui.move.offsetWidth + 18);
  const availH = innerHeight - 20 - ui.topbar.offsetHeight - 8 - ui.cards.offsetHeight - 12 - (narrow ? ui.move.offsetHeight + 12 : 0);
  scale = Math.max(0.2, Math.min(availW / VIEW_W, availH / VIEW_H));
  dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(VIEW_W * scale), h = Math.round(VIEW_H * scale);
  ui.wrap.style.width = `${w}px`;
  ui.wrap.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  background = renderBackground();
}

// Walls and floor never change, so they are painted once per resize.
function renderBackground() {
  const bg = document.createElement("canvas");
  bg.width = canvas.width; bg.height = canvas.height;
  const g = bg.getContext("2d");
  g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

  // Stone wall.
  g.fillStyle = "#3a2f58";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.strokeStyle = "rgba(20, 12, 40, .55)";
  g.lineWidth = 2;
  for (let y = 0, row = 0; y < VIEW_H; y += 22, row++) {
    for (let x = (row % 2) * -24; x < VIEW_W; x += 48) {
      g.fillStyle = `hsl(${255 + rnd() * 12}, ${22 + rnd() * 8}%, ${24 + rnd() * 8}%)`;
      g.fillRect(x + 1, y + 1, 46, 20);
      g.strokeRect(x + 1, y + 1, 46, 20);
    }
  }
  // Scoreboard strip darkening.
  const sb = g.createLinearGradient(0, 0, 0, TOP);
  sb.addColorStop(0, "rgba(10, 6, 24, .55)");
  sb.addColorStop(1, "rgba(10, 6, 24, .15)");
  g.fillStyle = sb;
  g.fillRect(0, 0, VIEW_W, TOP);

  // Floor.
  g.save();
  g.translate(SIDE, TOP);
  const floor = g.createRadialGradient(ARENA.width / 2, ARENA.height / 2, 60, ARENA.width / 2, ARENA.height / 2, ARENA.width * 0.62);
  floor.addColorStop(0, "#f4e7c6");
  floor.addColorStop(1, "#e2cf9f");
  g.fillStyle = floor;
  g.fillRect(0, 0, ARENA.width, ARENA.height);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() < 0.5 ? "rgba(150, 120, 70, .16)" : "rgba(255, 255, 255, .25)";
    const s = 1 + rnd() * 2.5;
    g.fillRect(rnd() * ARENA.width, rnd() * ARENA.height, s, s);
  }
  // Arena markings.
  g.strokeStyle = "rgba(170, 130, 70, .28)";
  g.lineWidth = 5;
  g.beginPath(); g.arc(ARENA.width / 2, ARENA.height / 2, 110, 0, TAU); g.stroke();
  g.beginPath(); g.arc(ARENA.width / 2, ARENA.height / 2, 14, 0, TAU); g.stroke();
  g.setLineDash([16, 14]);
  g.strokeRect(34, 34, ARENA.width - 68, ARENA.height - 68);
  g.setLineDash([]);
  // Wall shadow on the sand.
  const edge = 26;
  for (const [x, y, w, h, x0, y0, x1, y1] of [
    [0, 0, ARENA.width, edge, 0, 0, 0, edge],
    [0, ARENA.height - edge, ARENA.width, edge, 0, ARENA.height, 0, ARENA.height - edge],
    [0, 0, edge, ARENA.height, 0, 0, edge, 0],
    [ARENA.width - edge, 0, edge, ARENA.height, ARENA.width, 0, ARENA.width - edge, 0],
  ]) {
    const sh = g.createLinearGradient(x0, y0, x1, y1);
    sh.addColorStop(0, "rgba(60, 35, 20, .28)");
    sh.addColorStop(1, "rgba(60, 35, 20, 0)");
    g.fillStyle = sh;
    g.fillRect(x, y, w, h);
  }
  g.restore();
  // Floor rim.
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.strokeRect(SIDE - 2, TOP - 2, ARENA.width + 4, ARENA.height + 4);
  return bg;
}

// ---------- drawing ----------

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#3a2f58";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, sx * scale * dpr, sy * scale * dpr);
  ctx.drawImage(background, 0, 0, VIEW_W, VIEW_H);
  drawScoreboard();

  ctx.save();
  ctx.translate(SIDE, TOP);
  ctx.beginPath();
  ctx.rect(0, 0, ARENA.width, ARENA.height);
  ctx.clip();

  for (const f of game.flames) drawFlame(f);
  for (const t of game.triangles) drawFieldTriangle(t);
  for (const s of game.strings) drawStrings(s);
  drawBall(game.ball);
  if (mode !== "menu") drawPlayer(game.player);
  for (const t of game.thrown) drawThrown(t);
  for (const l of game.lasers) drawLaser(l);
  drawRings();
  drawParticles();
  ctx.restore();

  ctx.save();
  ctx.translate(SIDE, TOP);
  drawTexts();
  drawBanner();
  ctx.restore();

  if (flash > 0) {
    const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.25, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
    v.addColorStop(0, "rgba(255, 40, 40, 0)");
    v.addColorStop(1, `rgba(255, 40, 40, ${0.55 * flash})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawScoreboard() {
  const shown = mode === "menu" ? 0 : game.time;
  ctx.textBaseline = "alphabetic";
  // Time (left).
  ctx.textAlign = "left";
  ctx.fillStyle = "#b9aed6";
  ctx.font = "900 13px Nunito, sans-serif";
  ctx.fillText("TIME", SIDE + 4, 26);
  if (best > 0) {
    ctx.fillStyle = "#ffcf4a";
    ctx.fillText(`BEST ${formatTime(best)}`, SIDE + 50, 26);
  }
  ctx.font = "34px 'Luckiest Guy', Nunito, sans-serif";
  outlinedText(formatTime(shown), SIDE + 4, 62, "#fff8e8", 5);

  // Hearts box (center), like the sketch.
  const bw = 196, bh = 56, bx = VIEW_W / 2 - bw / 2, by = 10;
  roundRect(bx, by, bw, bh, 14);
  ctx.fillStyle = "#fff8e8";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  for (let i = 0; i < LIVES; i++) {
    const hx = bx + 38 + i * 60, hy = by + bh / 2 + 1;
    const alive = mode === "menu" || i < game.lives;
    const loss = heartLoss.find((h) => h.index === i);
    if (alive) {
      const beat = game.lives === 1 && mode === "playing" ? 1 + Math.max(0, Math.sin(clock * 9)) * 0.12 : 1;
      drawHeart(hx, hy, 19 * beat, HEART_COLORS[i], false);
    } else {
      drawHeart(hx, hy, 19, "#d8cfbe", true);
      if (loss && loss.t < 0.7) {
        const k = loss.t / 0.7;
        ctx.globalAlpha = 1 - k;
        drawHeart(hx - 7 - k * 22, hy + k * 30, 19 * (1 + k * 0.3), HEART_COLORS[i], false, -k);
        drawHeart(hx + 7 + k * 22, hy + k * 30, 19 * (1 + k * 0.3), HEART_COLORS[i], false, k);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Danger level (right).
  ctx.textAlign = "right";
  ctx.fillStyle = "#b9aed6";
  ctx.font = "900 13px Nunito, sans-serif";
  ctx.fillText("DANGER", VIEW_W - SIDE - 4, 26);
  const level = mode === "menu" ? 1 : game.danger;
  const pipW = 14, gap = 4, right = VIEW_W - SIDE - 4;
  for (let i = 0; i < MAX_DANGER; i++) {
    const x = right - (MAX_DANGER - i) * (pipW + gap) + gap;
    const lit = i < level;
    const hue = 120 - (i / (MAX_DANGER - 1)) * 120;
    roundRect(x, 38, pipW, 22, 5);
    ctx.fillStyle = lit ? `hsl(${hue}, 85%, 55%)` : "rgba(255,255,255,.1)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = lit ? INK : "rgba(255,255,255,.18)";
    ctx.stroke();
  }
}

function drawHeart(x, y, size, color, empty, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt * 0.5);
  const s = size / 20;
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.bezierCurveTo(-22, 2, -20, -18, -8, -17);
  ctx.bezierCurveTo(-3, -17, 0, -12, 0, -9);
  ctx.bezierCurveTo(0, -12, 3, -17, 8, -17);
  ctx.bezierCurveTo(20, -18, 22, 2, 0, 16);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = empty ? "#b3a893" : INK;
  ctx.stroke();
  if (empty) {
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(-4, -1); ctx.lineTo(3, 4); ctx.lineTo(-1, 12);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.ellipse(-8, -8, 4, 3, -0.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlame(f) {
  const t = clock + f.id;
  const flick = 1 + Math.sin(t * 13) * 0.07 + Math.sin(t * 7.3) * 0.05;
  const glow = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 38);
  glow.addColorStop(0, "rgba(255, 140, 30, .5)");
  glow.addColorStop(1, "rgba(255, 140, 30, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(f.x, f.y, 38, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(f.x, f.y + 12);
  ctx.scale(0.62, 0.62 * flick);
  flamePath(Math.sin(t * 9) * 3);
  const g = ctx.createRadialGradient(0, -10, 2, 0, -14, 30);
  g.addColorStop(0, "#ffe066");
  g.addColorStop(0.45, "#ff8a1f");
  g.addColorStop(1, "#e5281f");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 241, 166, .9)";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.bezierCurveTo(4, -16, 9, -12, 9, -6);
  ctx.bezierCurveTo(9, 0, 4, 3, 0, 3);
  ctx.bezierCurveTo(-4, 3, -9, 0, -9, -6);
  ctx.bezierCurveTo(-9, -12, -2, -16, 0, -24);
  ctx.fill();
  ctx.restore();
}

// A teardrop flame with its base at (0, 0) and its tip up.
function flamePath(sway) {
  ctx.beginPath();
  ctx.moveTo(sway, -52);
  ctx.bezierCurveTo(6 + sway * 0.5, -36, 20, -28, 20, -12);
  ctx.bezierCurveTo(20, 0, 11, 6, 0, 6);
  ctx.bezierCurveTo(-11, 6, -20, 0, -20, -12);
  ctx.bezierCurveTo(-20, -28, -6 + sway * 0.5, -36, sway, -52);
  ctx.closePath();
}

function trianglePath(size) {
  const h = size * 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.62);
  ctx.lineTo(size * 0.55, h * 0.38);
  ctx.lineTo(-size * 0.55, h * 0.38);
  ctx.closePath();
}

function drawYellowTriangle(x, y, size, angle, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  trianglePath(size);
  const g = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.4);
  g.addColorStop(0, "#fff38a");
  g.addColorStop(1, "#ffc400");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2.5, size * 0.1);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 251, 214, .6)";
  ctx.scale(0.45, 0.45);
  ctx.translate(0, size * 0.1);
  trianglePath(size);
  ctx.fill();
  ctx.restore();
}

function drawFieldTriangle(t) {
  if (t.life < 3 && Math.floor(clock * 8) % 2 === 0) return;
  const bob = Math.sin(clock * 4 + t.id) * 3;
  const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
  const glow = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, 44);
  glow.addColorStop(0, `rgba(255, 220, 40, ${0.45 + pulse * 0.25})`);
  glow.addColorStop(1, "rgba(255, 220, 40, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(t.x, t.y, 44, 0, TAU); ctx.fill();
  // Time-left ring.
  ctx.strokeStyle = "rgba(42, 29, 58, .35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, t.life / TRIANGLE_LIFETIME));
  ctx.stroke();
  drawYellowTriangle(t.x, t.y + bob, 34, Math.sin(clock * 2 + t.id) * 0.25);
}

function drawThrown(t) {
  const speed = Math.hypot(t.vx, t.vy) || 1;
  for (let i = 3; i >= 1; i--) {
    drawYellowTriangle(t.x - (t.vx / speed) * i * 14, t.y - (t.vy / speed) * i * 14, 24, t.spin - i * 0.4, 0.18 * (4 - i));
  }
  drawYellowTriangle(t.x, t.y, 26, t.spin);
}

function drawBall(b) {
  let x = b.x, y = b.y;
  if (b.windup > 0) { x += (Math.random() - 0.5) * 5; y += (Math.random() - 0.5) * 5; }
  const R = BALL_RADIUS;

  // Shadow.
  ctx.fillStyle = "rgba(60, 35, 20, .25)";
  ctx.beginPath(); ctx.ellipse(x + 6, y + 10, R, R * 0.55, 0, 0, TAU); ctx.fill();

  if (b.spin > 0) drawBlades(b);

  if (b.windup > 0) {
    const k = 1 - b.windup / WINDUP_TIME;
    const glow = ctx.createRadialGradient(x, y, R * 0.6, x, y, R + 34);
    glow.addColorStop(0, "rgba(255, 60, 40, .75)");
    glow.addColorStop(1, "rgba(255, 60, 40, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, R + 34, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255, 75, 62, ${1 - k})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, R + 6 + k * 40, 0, TAU); ctx.stroke();
  }

  const para = b.paralyzed > 0;
  const body = ctx.createRadialGradient(x - 7, y - 8, 2, x, y, R);
  if (para) {
    body.addColorStop(0, "#f2fdff"); body.addColorStop(0.5, "#8fdcff"); body.addColorStop(1, "#2f82c9");
  } else {
    body.addColorStop(0, "#a8c8ff"); body.addColorStop(0.5, "#2f6bff"); body.addColorStop(1, "#1638a8");
  }
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();

  // Rolling spots show which way it rolls.
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  const heading = Math.atan2(b.vy, b.vx);
  const phase = (b.roll / TAU) % 1;
  for (let k = 0; k < 2; k++) {
    const u = ((phase + k * 0.5) % 1) * 2 - 1; // -1 .. 1 across the ball
    const px = x + Math.cos(heading) * u * R, py = y + Math.sin(heading) * u * R;
    const w = Math.max(0.15, 1 - Math.abs(u)) * R * 0.38;
    ctx.fillStyle = para ? "rgba(20, 90, 150, .28)" : "rgba(8, 24, 100, .38)";
    ctx.beginPath();
    ctx.ellipse(px, py, w, R * 0.3, heading, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.beginPath(); ctx.ellipse(x - 8, y - 9, 6, 4, -0.6, 0, TAU); ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();

  if (b.windup > 0) {
    // A tiny flame dances above the ball: a secret power is coming.
    ctx.save();
    ctx.translate(x, y - R - 6 + Math.sin(clock * 20) * 2);
    ctx.scale(0.36, 0.36);
    flamePath(Math.sin(clock * 25) * 5);
    ctx.fillStyle = "#ff6b1f";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  if (para) drawParalysis(b, x, y);
}

function drawParalysis(b, x, y) {
  const R = BALL_RADIUS;
  const waking = b.paralyzed < 0.8;
  // Countdown ring.
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(42, 29, 58, .35)";
  ctx.beginPath(); ctx.arc(x, y, R + 12, 0, TAU); ctx.stroke();
  ctx.strokeStyle = waking && Math.floor(clock * 10) % 2 ? "#ff4b3e" : "#ffd21f";
  ctx.beginPath(); ctx.arc(x, y, R + 12, -Math.PI / 2, -Math.PI / 2 + TAU * (b.paralyzed / PARALYZE_TIME)); ctx.stroke();
  // Electric sparks.
  ctx.strokeStyle = "#fff36b";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    let a = Math.random() * TAU, r = R - 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    for (let s = 0; s < 4; s++) {
      r += 6 + Math.random() * 5; a += (Math.random() - 0.5) * 0.7;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.stroke();
  }
  // The star from the sketch, spinning above the ball.
  ctx.save();
  ctx.translate(x, y - R - 20);
  ctx.rotate(clock * 3);
  ctx.lineCap = "round";
  for (const [w, c] of [[7, INK], [3.5, "#ffd21f"]]) {
    ctx.lineWidth = w; ctx.strokeStyle = c;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      ctx.moveTo(Math.cos(a) * -9, Math.sin(a) * -9);
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBlades(b) {
  const R = BALL_RADIUS;
  // Motion blur fans.
  for (const offset of [0, Math.PI]) {
    const a = b.spinAngle + offset;
    ctx.fillStyle = "rgba(230, 236, 255, .32)";
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.arc(b.x, b.y, R + SPIN_BLADE, a - 1.1, a);
    ctx.closePath();
    ctx.fill();
  }
  for (const offset of [0, Math.PI]) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spinAngle + offset);
    ctx.lineJoin = "round";
    // Handle and guard.
    ctx.fillStyle = "#7a4520";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.rect(R - 6, -4.5, 20, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#9aa3b5";
    ctx.beginPath(); ctx.rect(R + 13, -9, 6, 18); ctx.fill(); ctx.stroke();
    // Blade: flat back, curved sharp edge, pointed tip.
    const tip = R + SPIN_BLADE;
    const steel = ctx.createLinearGradient(0, -7, 0, 7);
    steel.addColorStop(0, "#ffffff");
    steel.addColorStop(0.5, "#cfd8e6");
    steel.addColorStop(1, "#8793a8");
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.moveTo(R + 19, -6);
    ctx.lineTo(tip - 12, -6);
    ctx.lineTo(tip, 1);
    ctx.quadraticCurveTo(tip - 22, 9, R + 19, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer(p) {
  if (p.invulnerable > 0 && mode === "playing" && Math.floor(clock * 14) % 2 === 0) return;
  const angle = Math.atan2(p.fy, p.fx);
  const swing = p.moving ? Math.sin(p.walk) * 6 : 0;

  // Aim guide: dotted line straight ahead while holding a triangle.
  if (p.holding && mode === "playing") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    for (let i = 0; i < 9; i++) {
      const d = 34 + i * 20;
      ctx.fillStyle = `rgba(42, 29, 58, ${0.55 - i * 0.055})`;
      ctx.beginPath(); ctx.arc(d, 0, 3.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  ctx.fillStyle = "rgba(60, 35, 20, .25)";
  ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 8, 22, 14, angle + Math.PI / 2, 0, TAU); ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;

  // Arms and hands (red gloves) — they swing while walking.
  const hands = [{ side: -1, fwd: 10 + swing }, { side: 1, fwd: 10 - swing }];
  ctx.lineWidth = 3;
  for (const h of hands) {
    ctx.fillStyle = "#2f9a41";
    ctx.beginPath();
    ctx.ellipse(h.fwd / 2, h.side * 17, 8, 5, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e0463a";
    ctx.beginPath(); ctx.arc(h.fwd + 3, h.side * 17, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // Held triangle sits in the right hand.
  if (p.holding) {
    ctx.restore();
    const hx = p.x + Math.cos(angle) * (13 - swing + 6) - Math.sin(angle) * 17;
    const hy = p.y + Math.sin(angle) * (13 - swing + 6) + Math.cos(angle) * 17;
    drawYellowTriangle(hx, hy, 18, angle + Math.PI / 2);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
  }

  // Shoulders: the long green body from the sketch.
  ctx.fillStyle = "#3dbb4f";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 22, 0, 0, TAU);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.beginPath(); ctx.ellipse(-3, -8, 4, 8, 0, 0, TAU); ctx.fill();

  // Head (brown hair from above) with a little nose showing where they face.
  ctx.fillStyle = "#f0bf8a";
  ctx.beginPath(); ctx.arc(10, 0, 4, 0, TAU); ctx.fill(); ctx.stroke();
  const hair = ctx.createRadialGradient(-2, -3, 1, 0, 0, 12);
  hair.addColorStop(0, "#a0663a");
  hair.addColorStop(1, "#6b3d1f");
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(40, 20, 10, .45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-7, -4); ctx.quadraticCurveTo(0, -1, 7, -5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-7, 3); ctx.quadraticCurveTo(0, 5, 7, 2); ctx.stroke();
  ctx.restore();
}

function drawLaser(l) {
  const pts = laserTrail(l);
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [w, c] of [[18, "rgba(255, 40, 70, .18)"], [9, "rgba(255, 50, 80, .6)"], [3.5, "#ffffff"]]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  if (!l.stopped) {
    const glow = ctx.createRadialGradient(l.hx, l.hy, 1, l.hx, l.hy, 18);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(1, "rgba(255,60,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(l.hx, l.hy, 18, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawStrings(s) {
  const tips = stringTips(s);
  ctx.save();
  ctx.lineCap = "round";
  const alpha = s.phase === "back" ? 0.55 : 1;
  ctx.globalAlpha = alpha;
  for (let k = 0; k < 2; k++) {
    const d = s.dirs[k], tip = tips[k];
    const sx = s.ox + d.dx * (BALL_RADIUS - 4), sy = s.oy + d.dy * (BALL_RADIUS - 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = "#aeb8c9"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    // Sharp point.
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(Math.atan2(d.dy, d.dx));
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-16, -8); ctx.lineTo(-11, 0); ctx.lineTo(-16, 8);
    ctx.closePath();
    ctx.fillStyle = "#e9eef6";
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawRings() {
  for (const r of rings) {
    const k = 1 - r.life / r.max;
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = r.width;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
    ctx.fillStyle = p.color;
    if (p.shape === "spark") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.7;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawTexts() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of texts) {
    const k = t.life / t.max;
    const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
    ctx.globalAlpha = Math.min(1, k * 3);
    ctx.font = `${Math.round(t.size * pop)}px 'Luckiest Guy', Nunito, sans-serif`;
    outlinedText(t.text, t.x, t.y, t.color, 6);
  }
  ctx.globalAlpha = 1;
}

function drawBanner() {
  if (!banner) return;
  const { t, life } = banner;
  const appear = Math.min(1, t / 0.25);
  const k = 1 + (1 - appear) * 0.6 + (appear < 1 ? Math.sin(appear * Math.PI) * 0.15 : 0);
  ctx.globalAlpha = Math.min(1, (life - t) / 0.4, appear * 1.5);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(64 * k)}px 'Luckiest Guy', Nunito, sans-serif`;
  outlinedText(banner.title, ARENA.width / 2, ARENA.height / 2 - 20, "#fff8e8", 9);
  if (banner.sub) {
    ctx.font = "900 22px Nunito, sans-serif";
    outlinedText(banner.sub, ARENA.width / 2, ARENA.height / 2 + 30, "#ffcf4a", 6);
  }
  ctx.globalAlpha = 1;
}

function outlinedText(text, x, y, color, width) {
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- power cards ----------

let cardCache = "";
function updateCards() {
  const g = game, b = g.ball, playing = mode === "playing" || mode === "paused";
  let flameClass = "", flameText = "Only the ball can eat flames";
  if (playing) {
    if (b.windup > 0) { flameClass = "alarm"; flameText = "The ball ate a flame — watch out!"; }
    else if (b.spin > 0 || g.lasers.length || g.strings.length) { flameClass = "alarm"; flameText = "Secret power! Dodge it!"; }
    else if (g.flames.length) { flameClass = "warn"; flameText = g.flames.length > 1 ? `${g.flames.length} flames — the ball wants them!` : "A flame — the ball wants it!"; }
    else flameText = "No flames right now";
  }
  let triClass = "", triText = "Grab a yellow triangle";
  if (playing) {
    if (g.player.holding) { triClass = "ready"; triText = "Ready! Press SPACE to throw"; }
    else if (g.thrown.length) triText = "Flying…";
    else if (g.triangles.length) triText = "A triangle appeared — grab it!";
    else triText = "Wait for a yellow triangle…";
  }
  const key = flameClass + flameText + triClass + triText;
  if (key === cardCache) return;
  cardCache = key;
  ui.flameCard.classList.toggle("warn", flameClass === "warn");
  ui.flameCard.classList.toggle("alarm", flameClass === "alarm");
  ui.flameStatus.textContent = flameText;
  ui.triangleCard.classList.toggle("ready", triClass === "ready");
  ui.triangleStatus.textContent = triText;
}

// ---------- sound (all synthesized, no files) ----------

const sound = {
  ctx: null, master: null, musicGain: null, muted: loadNumber("deadlyBall.muted", 0) === 1,
  music: null, tempo: 1,

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },
  setMuted(m) {
    this.muted = m;
    saveNumber("deadlyBall.muted", m ? 1 : 0);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  },
  tone(freq, dur, { type = "sine", vol = 0.2, to = null, delay = 0, out = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(out || this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  },
  noise(dur, { vol = 0.2, freq = 1000, q = 1, type = "bandpass", to = null, delay = 0, out = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const length = Math.ceil(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    src.buffer = buffer;
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t0);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(out || this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  },

  pickup() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.14, { type: "triangle", vol: 0.22, delay: i * 0.06 })); },
  chime() { this.tone(1320, 0.25, { type: "sine", vol: 0.12 }); this.tone(1760, 0.3, { type: "sine", vol: 0.08, delay: 0.07 }); },
  whoosh() { this.noise(0.22, { vol: 0.3, freq: 700, to: 3000, q: 2 }); this.tone(420, 0.15, { type: "triangle", vol: 0.1, to: 900 }); },
  zap() {
    this.tone(1500, 0.35, { type: "sawtooth", vol: 0.16, to: 120 });
    this.tone(90, 0.4, { type: "square", vol: 0.08 });
    this.noise(0.3, { vol: 0.25, freq: 3000, q: 0.8, type: "highpass" });
  },
  thud() { this.tone(160, 0.12, { type: "sine", vol: 0.2, to: 70 }); },
  crackle() { this.noise(0.25, { vol: 0.12, freq: 2200, q: 3 }); },
  charge() { this.tone(180, WINDUP_TIME, { type: "sawtooth", vol: 0.12, to: 720 }); this.tone(184, WINDUP_TIME, { type: "square", vol: 0.05, to: 730 }); },
  laser() { this.tone(2200, 0.3, { type: "square", vol: 0.1, to: 300 }); this.tone(1100, 0.3, { type: "sawtooth", vol: 0.08, to: 200 }); },
  ping() { this.tone(2600, 0.12, { type: "triangle", vol: 0.12, to: 1800 }); },
  knives() { this.noise(0.3, { vol: 0.2, freq: 4000, q: 4, to: 7000 }); this.tone(1900, 0.2, { type: "triangle", vol: 0.08, to: 2600 }); },
  swish() { this.noise(0.12, { vol: 0.12, freq: 2500, q: 3, to: 5000 }); },
  twang() { this.tone(220, 0.5, { type: "sawtooth", vol: 0.1, to: 440 }); this.noise(0.15, { vol: 0.15, freq: 5000, q: 6 }); },
  clank() { this.tone(3100, 0.18, { type: "square", vol: 0.06 }); this.noise(0.12, { vol: 0.2, freq: 6000, type: "highpass" }); },
  wake() { this.tone(300, 0.15, { type: "triangle", vol: 0.12, to: 520 }); },
  dodged() { this.tone(880, 0.08, { type: "triangle", vol: 0.08 }); this.tone(1175, 0.1, { type: "triangle", vol: 0.08, delay: 0.06 }); },
  hurt() {
    this.tone(260, 0.35, { type: "square", vol: 0.16, to: 55 });
    this.noise(0.25, { vol: 0.3, freq: 400, q: 0.7, type: "lowpass" });
  },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { type: "square", vol: 0.07, delay: i * 0.08 })); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, { type: "triangle", vol: 0.2, delay: i * 0.18 })); },

  // A little bouncy loop that speeds up with the danger level.
  setTempo(level) { this.tempo = level; },
  startMusic() {
    if (!this.ctx || this.music) return;
    const bass = [110, 0, 110, 131, 0, 110, 165, 147, 110, 0, 110, 131, 0, 196, 165, 131];
    let step = 0, next = this.ctx.currentTime + 0.05;
    const tick = () => {
      const bpm = 118 + (this.tempo - 1) * 6;
      const sixteenth = 60 / bpm / 4;
      while (next < this.ctx.currentTime + 0.12) {
        const delay = Math.max(0, next - this.ctx.currentTime);
        const n = bass[step % 16];
        if (step % 2 === 0 && n) this.tone(n, sixteenth * 1.8, { type: "triangle", vol: 0.5, delay, out: this.musicGain });
        if (step % 4 === 0) this.tone(120, 0.12, { type: "sine", vol: 0.6, to: 45, delay, out: this.musicGain });
        if (step % 4 === 2) this.noise(0.05, { vol: 0.18, freq: 8000, type: "highpass", delay, out: this.musicGain });
        if (step % 8 === 4) this.noise(0.1, { vol: 0.22, freq: 1800, q: 0.8, delay, out: this.musicGain });
        next += sixteenth;
        step++;
      }
    };
    this.music = setInterval(tick, 30);
    tick();
  },
  stopMusic() {
    if (this.music) clearInterval(this.music);
    this.music = null;
  },
};

// ---------- storage ----------

function loadNumber(key, fallback) {
  try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : fallback; }
  catch { return fallback; }
}
function saveNumber(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* private mode: keep it in memory only */ }
}

// ---------- boot ----------

// Handy for testing from the console or a browser driver.
window.__deadlyBall = {
  get game() { return game; },
  get mode() { return mode; },
  start: (seed) => startGame(seed),
};

ui.muteButton.classList.toggle("muted", sound.muted);
updateBestLine();
addEventListener("resize", resize);
resize();
document.fonts?.ready.then(resize);
requestAnimationFrame((t) => { lastFrame = t; frame(t); });
