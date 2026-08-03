(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    start: $("#start-screen"), hud: $("#hud"), pause: $("#pause-screen"), gameover: $("#gameover-screen"),
    startButton: $("#start-button"), pauseButton: $("#pause-button"), resumeButton: $("#resume-button"), fireButton: $("#fire-button"),
    quitButton: $("#quit-button"), retryButton: $("#retry-button"), menuButton: $("#menu-button"), bombButton: $("#bomb-button"),
    healthBar: $("#health-bar"), healthValue: $("#health-value"), distance: $("#distance-value"), threat: $("#threat-label"),
    score: $("#score-value"), combo: $("#combo-value"), weaponName: $("#weapon-name"), weaponAmmo: $("#weapon-ammo"),
    weaponTimer: $("#weapon-timer"), weaponIcon: $("#weapon-icon"), bombState: $("#bomb-state"), portrait: $("#hud-portrait"),
    crosshair: $("#crosshair"), announcement: $("#announcement"), damage: $("#damage-flash"),
    finalDistance: $("#final-distance"), finalKills: $("#final-kills"), finalScore: $("#final-score"),
    inventoryButtons: [...document.querySelectorAll(".inventory-slot")]
  };

  const TAU = Math.PI * 2;
  const ROAD_HORIZON = .325;
  const TRACK_BOTTOM = 1.11;
  const lanes = [-0.66, -0.33, 0, 0.33, 0.66];
  const colors = { mint: "#6dffb2", orange: "#ff7849", dark: "#071b24", bone: "#d9d7c0" };
  const roadImage = new Image(); roadImage.src = "assets/nightfall-gameplay-road.png";
  let width = innerWidth, height = innerHeight, dpr = 1, raf = 0, lastTime = 0, audio = null, music = null;

  const state = {
    running: false, paused: false, character: "augusto", health: 100, score: 0, distance: 0, elapsed: 0,
    kills: 0, combo: 1, comboTimer: 0, weapon: "Sidearm", inventory: ["Sidearm"],
    bombs: 0, skyBomb: null, spawnTimer: 0, nextReward: 15, enemies: [], particles: [], tracers: [], rings: [],
    question: null, roadOffset: 0, shake: 0, flash: 0, invulnerable: 0, fireHeld: false, aimX: width / 2, aimY: height / 2,
    nextShot: 0, bossIndex: 0, nextBoss: 280, announcementTimer: null
  };

  const weaponData = {
    Sidearm: { icon: "⌁", cooldown: 0.22, damage: 1, label: "INFINITE" },
    "Machine Gun": { icon: "≋", cooldown: 0.075, damage: 0.62, label: "FULL AUTO" },
    Flamethrower: { icon: "♨", cooldown: 0.055, damage: 0.2, label: "MID-RANGE FLAME" },
    Bazooka: { icon: "➤", cooldown: 0.72, damage: 8, label: "FAR-RANGE ONLY" }
  };
  const weaponUnlockOrder = ["Machine Gun", "Flamethrower", "Bazooka"];

  function resize() {
    width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.running) drawAttract();
  }

  function resetGame() {
    Object.assign(state, {
      running: true, paused: false, health: 100, score: 0, distance: 0, elapsed: 0, kills: 0,
      combo: 1, comboTimer: 0, weapon: "Sidearm", inventory: ["Sidearm"],
      bombs: 0, skyBomb: null, spawnTimer: 1.4, nextReward: 13, enemies: [], particles: [], tracers: [], rings: [],
      question: null, roadOffset: 0, shake: 0, flash: 0, invulnerable: 0, fireHeld: false, nextShot: 0,
      bossIndex: 0, nextBoss: 280
    });
    ui.start.classList.add("hidden"); ui.pause.classList.add("hidden"); ui.gameover.classList.add("hidden");
    ui.hud.classList.remove("hidden"); ui.portrait.classList.toggle("san", state.character === "san");
    initAudio(); startMusic(); refreshInventory(); updateHUD(); announce("Sector 01", `${state.character === "augusto" ? "Augusto" : "San"}, clear the dead road`);
  }

  function returnToMenu() {
    state.running = false; state.paused = false; state.fireHeld = false;
    stopMusic();
    ui.hud.classList.add("hidden"); ui.pause.classList.add("hidden"); ui.gameover.classList.add("hidden"); ui.start.classList.remove("hidden");
  }

  function start() { resetGame(); lastTime = performance.now(); if (!raf) raf = requestAnimationFrame(loop); }

  function togglePause(force) {
    if (!state.running) return;
    state.paused = typeof force === "boolean" ? force : !state.paused; state.fireHeld = false;
    ui.pause.classList.toggle("hidden", !state.paused);
    if (state.paused) refreshInventory();
    if (music) music.gain.gain.setTargetAtTime(state.paused ? .025 : .12, audio.currentTime, .12);
    if (!state.paused) lastTime = performance.now();
  }

  function gameOver() {
    state.running = false; state.fireHeld = false; ui.hud.classList.add("hidden"); ui.gameover.classList.remove("hidden");
    ui.finalDistance.textContent = `${Math.floor(state.distance)}m`; ui.finalKills.textContent = state.kills; ui.finalScore.textContent = Math.floor(state.score).toLocaleString();
    stopMusic(); sfx("down");
  }

  function initAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  }

  function startMusic() {
    if (!audio || music) return;
    const gain = audio.createGain(), filter = audio.createBiquadFilter();
    gain.gain.setValueAtTime(.001, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.12, audio.currentTime + 1.2);
    filter.type = "lowpass"; filter.frequency.value = 880; filter.Q.value = 1.35; filter.connect(gain); gain.connect(audio.destination);
    const drones = [55, 82.4, 110].map((frequency, index) => {
      const osc = audio.createOscillator(), oscGain = audio.createGain(); osc.type = index ? "triangle" : "sawtooth";
      osc.frequency.value = frequency; osc.detune.value = [-8, 5, -3][index]; oscGain.gain.value = [.22, .13, .065][index];
      osc.connect(oscGain); oscGain.connect(filter); osc.start(); return osc;
    });
    music = { gain, filter, drones, step: 0, timer: setInterval(scheduleMusicBeat, 760) };
    scheduleMusicBeat();
  }

  function scheduleMusicBeat() {
    if (!audio || !music || !state.running || state.paused) return;
    const now = audio.currentTime, notes = [55, 55, 49, 41.2, 55, 65.4, 49, 36.7], note = notes[music.step++ % notes.length];
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = "square"; osc.frequency.value = note;
    gain.gain.setValueAtTime(.34, now); gain.gain.exponentialRampToValueAtTime(.001, now + .5); osc.connect(gain); gain.connect(music.filter); osc.start(now); osc.stop(now + .52);
    const hit = audio.createOscillator(), hitGain = audio.createGain(); hit.type = "sine"; hit.frequency.setValueAtTime(72, now); hit.frequency.exponentialRampToValueAtTime(31, now + .16);
    hitGain.gain.setValueAtTime(.3, now); hitGain.gain.exponentialRampToValueAtTime(.001, now + .24); hit.connect(hitGain); hitGain.connect(music.gain); hit.start(now); hit.stop(now + .26);
    if (music.step % 4 === 1) {
      const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .16), audio.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      const noise = audio.createBufferSource(), noiseGain = audio.createGain(); noise.buffer = buffer; noiseGain.gain.value = .12;
      noise.connect(noiseGain); noiseGain.connect(music.filter); noise.start(now);
    }
  }

  function stopMusic() {
    if (!music || !audio) return;
    const active = music; music = null; clearInterval(active.timer); active.gain.gain.setTargetAtTime(.001, audio.currentTime, .08);
    setTimeout(() => active.drones.forEach(osc => { try { osc.stop(); } catch {} }), 350);
  }

  function bossVoice(type) {
    if (!audio) return;
    const now = audio.currentTime, duration = type === "appear" ? 1.65 : 1.35;
    const master = audio.createGain(), filter = audio.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = type === "appear" ? 1.4 : 2.1;
    filter.frequency.setValueAtTime(type === "appear" ? 420 : 880, now); filter.frequency.exponentialRampToValueAtTime(type === "appear" ? 95 : 170, now + duration);
    master.gain.setValueAtTime(.001, now); master.gain.linearRampToValueAtTime(type === "appear" ? .42 : .34, now + .08); master.gain.exponentialRampToValueAtTime(.001, now + duration);
    filter.connect(master); master.connect(audio.destination);
    if (music) {
      music.gain.gain.cancelScheduledValues(now); music.gain.gain.setTargetAtTime(.035, now, .04); music.gain.gain.setTargetAtTime(.12, now + duration, .25);
    }
    const lfo = audio.createOscillator(), lfoGain = audio.createGain(); lfo.frequency.value = type === "appear" ? 23 : 17; lfoGain.gain.value = type === "appear" ? 15 : 22; lfo.connect(lfoGain);
    for (const detune of [-18, 0, 14]) {
      const osc = audio.createOscillator(), voiceGain = audio.createGain(); osc.type = type === "appear" ? "sawtooth" : "square"; osc.detune.value = detune; voiceGain.gain.value = .22;
      osc.frequency.setValueAtTime(type === "appear" ? 118 : 245, now); osc.frequency.exponentialRampToValueAtTime(type === "appear" ? 34 : 52, now + duration); lfoGain.connect(osc.frequency); osc.connect(voiceGain); voiceGain.connect(filter); osc.start(now); osc.stop(now + duration);
    }
    lfo.start(now); lfo.stop(now + duration);
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, type === "appear" ? .42 : .75);
    const noise = audio.createBufferSource(); noise.buffer = buffer; noise.connect(filter); noise.start(now);
  }

  function sfx(type) {
    if (!audio) return;
    const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    osc.connect(gain); gain.connect(audio.destination); osc.type = type === "hit" ? "square" : "sawtooth";
    const cfg = {
      shot: [125, 62, .04, .055], hit: [95, 48, .035, .035], kill: [220, 90, .08, .06],
      reward: [480, 860, .22, .08], wrong: [140, 65, .25, .08], hurt: [62, 38, .2, .13],
      rocket: [75, 26, .35, .15], bomb: [48, 19, .7, .18], down: [105, 28, .8, .1]
    }[type] || [180, 90, .1, .05];
    osc.frequency.setValueAtTime(cfg[0], now); osc.frequency.exponentialRampToValueAtTime(cfg[1], now + cfg[2]);
    gain.gain.setValueAtTime(cfg[3], now); gain.gain.exponentialRampToValueAtTime(.001, now + cfg[2]);
    osc.start(now); osc.stop(now + cfg[2]);
  }

  function announce(title, sub = "") {
    ui.announcement.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ""}`;
    ui.announcement.classList.remove("show"); void ui.announcement.offsetWidth; ui.announcement.classList.add("show");
  }

  function updateHUD() {
    ui.healthBar.style.width = `${Math.max(0, state.health)}%`; ui.healthValue.textContent = Math.max(0, Math.ceil(state.health));
    ui.distance.textContent = Math.floor(state.distance); ui.score.textContent = Math.floor(state.score).toString().padStart(6, "0");
    ui.combo.textContent = `×${state.combo} COMBO`; ui.weaponName.textContent = state.weapon; ui.weaponIcon.textContent = weaponData[state.weapon].icon;
    ui.weaponAmmo.textContent = weaponData[state.weapon].label;
    ui.weaponTimer.style.width = `${(state.inventory.length / Object.keys(weaponData).length) * 100}%`;
    const threat = state.elapsed < 30 ? "Rising" : state.elapsed < 75 ? "Severe" : state.elapsed < 130 ? "Brutal" : "Cataclysmic";
    ui.threat.textContent = `Threat: ${threat}`;
    ui.bombButton.disabled = state.bombs < 1; ui.bombButton.classList.toggle("locked", state.bombs < 1); ui.bombButton.classList.toggle("ready", state.bombs > 0);
    ui.bombState.textContent = state.bombs ? `×${state.bombs} ready` : "Find one";
  }

  function refreshInventory() {
    for (const button of ui.inventoryButtons) {
      const unlocked = state.inventory.includes(button.dataset.weapon), active = state.weapon === button.dataset.weapon;
      button.disabled = !unlocked; button.classList.toggle("locked", !unlocked); button.classList.toggle("unlocked", unlocked); button.classList.toggle("active", active);
      button.querySelector("b").textContent = active ? "Equipped" : unlocked ? "Select" : "Locked";
    }
  }

  function enemyStats(kind, boss) {
    const base = {
      zombie: { hp: 1.45, speed: .052, reward: 80 }, skeleton: { hp: 1.2, speed: .056, reward: 100 },
      club: { hp: 58, speed: .044, reward: 1800 }, dualist: { hp: 76, speed: .046, reward: 2700 }
    }[kind];
    let hp = base.hp, reward = base.reward;
    if (boss) {
      const durability = 1 + Math.max(0, state.bossIndex - 1) * .1;
      hp = { zombie: 30, skeleton: 27, club: 58, dualist: 76 }[kind] * durability;
      reward *= kind === "club" || kind === "dualist" ? 1.25 : 4;
    }
    return { hp, speed: base.speed, reward };
  }

  function spawnEnemy(kind, lane, boss = false) {
    const stats = enemyStats(kind, boss);
    state.enemies.push({
      id: Math.random(), kind, boss, lane: lane ?? lanes[(Math.random() * lanes.length) | 0], z: -.02 - Math.random() * .06,
      hp: stats.hp, maxHp: stats.hp, speed: stats.speed, reward: stats.reward, phase: Math.random() * TAU,
      hit: 0, attack: .6 + Math.random() * .4, dead: false, dying: 0, screen: null, deathParts: null, corpse: false,
      deathDuration: boss ? 8 : 6
    });
  }

  function spawnBoss() {
    const cycle = state.bossIndex++ % 4;
    const kind = cycle < 2 ? (cycle === 0 ? "zombie" : "skeleton") : (cycle === 2 ? "club" : "dualist");
    const boss = cycle < 2 ? true : "ultra";
    spawnEnemy(kind, 0, boss);
    bossVoice("appear");
    state.nextBoss += 390 + state.bossIndex * 55;
  }

  function spawnWave(dt) {
    state.spawnTimer -= dt;
    const maxEnemies = Math.min(11, 3 + Math.floor(state.elapsed / 24));
    if (state.spawnTimer <= 0 && state.enemies.filter(e => !e.dead).length < maxEnemies && !state.question) {
      const difficulty = Math.min(1, state.elapsed / 120);
      const count = Math.random() < .08 + difficulty * .12 ? 2 : 1;
      for (let i = 0; i < count; i++) spawnEnemy(Math.random() < .37 + difficulty * .18 ? "skeleton" : "zombie");
      state.spawnTimer = Math.max(.85, 1.85 - state.elapsed * .0045) * (.9 + Math.random() * .38);
    }
    if (state.distance >= state.nextBoss) spawnBoss();
  }

  function makeProblem() {
    const op = ["+", "−", "×", "÷"][(Math.random() * 4) | 0];
    let a, b, answer;
    if (op === "+") { a = rand(4, 38); b = rand(3, 29); answer = a + b; }
    if (op === "−") { a = rand(18, 59); b = rand(2, a - 2); answer = a - b; }
    if (op === "×") { a = rand(2, 11); b = rand(2, 10); answer = a * b; }
    if (op === "÷") { b = rand(2, 10); answer = rand(2, 10); a = b * answer; }
    const answers = [answer];
    while (answers.length < 3) {
      const wrong = Math.max(1, answer + rand(-9, 9)); if (!answers.includes(wrong)) answers.push(wrong);
    }
    answers.sort(() => Math.random() - .5);
    state.question = { a, b, op, answer, answers, age: 0, life: 10, balloons: [] };
    announce("Supply lock", "Shoot the correct answer");
  }

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function rewardPlayer() {
    const roll = Math.random(); let item;
    if (roll < .22) item = "Fall Bomb";
    else {
      const nextWeapon = weaponUnlockOrder.find(name => !state.inventory.includes(name));
      item = nextWeapon || weaponUnlockOrder[(Math.random() * weaponUnlockOrder.length) | 0];
    }
    if (item === "Fall Bomb") {
      state.bombs++; announce("Fall bomb secured", "Press Ctrl when surrounded");
    } else unlockWeapon(item);
    sfx("reward"); updateHUD();
  }

  function unlockWeapon(name) {
    const isNew = !state.inventory.includes(name);
    if (isNew) state.inventory.push(name); else state.score += 500;
    equip(name);
    announce(isNew ? `${name} unlocked` : `${name} reinforced`, isNew ? "Permanent armory addition" : "+500 duplicate bonus");
  }

  function equip(name) {
    if (!state.inventory.includes(name)) return;
    state.weapon = name; refreshInventory(); updateHUD(); updateAimValidity();
  }

  function cycleWeapon(direction) {
    if (!state.running || !state.inventory.length) return;
    const current = Math.max(0, state.inventory.indexOf(state.weapon)), next = (current + direction + state.inventory.length) % state.inventory.length;
    equip(state.inventory[next]); announce(state.inventory[next], `${next + 1} of ${state.inventory.length} unlocked weapons`);
  }

  function update(dt) {
    state.elapsed += dt; state.distance += dt * (7.5 + Math.min(4, state.elapsed * .018)); state.roadOffset = (state.roadOffset + dt * .34) % 1;
    state.nextShot = Math.max(0, state.nextShot - dt); state.comboTimer -= dt; state.shake *= Math.pow(.02, dt);
    state.invulnerable = Math.max(0, state.invulnerable - dt);
    if (state.comboTimer <= 0) state.combo = 1;
    if (state.fireHeld) shoot(state.aimX, state.aimY, true);
    spawnWave(dt);
    if (!state.question && state.elapsed >= state.nextReward) { makeProblem(); state.nextReward += 18 + Math.random() * 9; }
    if (state.question) { state.question.age += dt; if (state.question.age >= state.question.life) { state.question = null; announce("Supply lost", "Too slow"); } }
    if (state.skyBomb) {
      state.skyBomb.time += dt;
      if (!state.skyBomb.exploded && state.skyBomb.time >= .58) explodeBomb();
      if (state.skyBomb.time >= 1.35) state.skyBomb = null;
    }

    for (const enemy of state.enemies) {
      if (enemy.dead) {
        enemy.dying += dt;
        if (enemy.corpse) enemy.z += dt * (enemy.boss ? .28 : .34);
        updateDeathParts(enemy, dt); continue;
      }
      enemy.hit = Math.max(0, enemy.hit - dt * 4); enemy.phase += dt * (4 + enemy.speed * 30);
      const speedScale = 1 + Math.min(.45, state.elapsed / 240);
      enemy.z += enemy.speed * speedScale * dt;
      if (enemy.z > .9) {
        enemy.attack -= dt;
        if (enemy.attack <= 0) {
          const armed = enemy.kind === "club" || enemy.kind === "dualist";
          hurtPlayer(armed ? (enemy.kind === "dualist" ? 22 : 18) : enemy.boss ? 15 : 8);
          enemy.attack = armed ? 1.25 : .85;
          if (!enemy.boss && !armed) { enemy.dead = true; enemy.escaped = true; enemy.deathDuration = .55; enemy.dying = .35; }
        }
      }
      if (enemy.z > 1.11) { enemy.dead = true; enemy.escaped = true; enemy.deathDuration = .35; }
    }
    state.enemies = state.enemies.filter(e => !e.dead || (e.dying < e.deathDuration && (!e.corpse || e.z < 1.18)));
    updateEffects(dt); updateHUD();
  }

  function updateEffects(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.life -= dt;
      if (p.blood && p.y >= p.ground) { p.y = p.ground; p.vy = 0; p.vx *= Math.pow(.04, dt); p.size *= Math.pow(.82, dt); }
      else p.size *= Math.pow(.36, dt);
    }
    state.particles = state.particles.filter(p => p.life > 0);
    for (const t of state.tracers) t.life -= dt; state.tracers = state.tracers.filter(t => t.life > 0);
    for (const r of state.rings) { r.radius += dt * r.speed; r.life -= dt; } state.rings = state.rings.filter(r => r.life > 0);
    state.flash = Math.max(0, state.flash - dt * 2.4);
  }

  function hurtPlayer(amount) {
    if (state.invulnerable > 0) return;
    state.health -= amount; state.shake = Math.max(state.shake, 10); state.combo = 1;
    ui.damage.classList.remove("hit"); void ui.damage.offsetWidth; ui.damage.classList.add("hit"); sfx("hurt");
    if (state.health <= 0) { state.health = 0; updateHUD(); gameOver(); }
  }

  function shoot(x, y, automatic = false) {
    if (!state.running || state.paused || state.nextShot > 0) return;
    const data = weaponData[state.weapon]; state.nextShot = data.cooldown;
    ui.crosshair.classList.remove("firing"); void ui.crosshair.offsetWidth; ui.crosshair.classList.add("firing");
    if (answerQuestion(x, y)) return;
    if (state.weapon === "Bazooka") fireRocket(x, y);
    else if (state.weapon === "Flamethrower") fireFlame(x, y);
    else fireBullet(x, y, data.damage, automatic);
  }

  function answerQuestion(x, y) {
    if (!state.question) return false;
    const hit = state.question.balloons.find(b => Math.hypot(x - b.x, y - b.y) < b.r * 1.08);
    if (!hit) return false;
    burst(hit.x, hit.y, hit.value === state.question.answer ? colors.mint : colors.orange, 22);
    if (hit.value === state.question.answer) rewardPlayer(); else { sfx("wrong"); announce("Wrong answer", "Supply destroyed"); }
    state.question = null; return true;
  }

  function fireBullet(x, y, damage, automatic) {
    sfx("shot"); state.shake = Math.max(state.shake, automatic ? 1.8 : 3);
    const muzzle = playerMuzzle();
    state.tracers.push({ x1: muzzle.x, y1: muzzle.y, x2: x, y2: y, life: .075, max: .075, color: colors.mint });
    const target = getTarget(x, y);
    if (target) damageEnemy(target, damage, x, y); else spark(x, y, "#d7fff0", 4);
  }

  function fireFlame(x, y) {
    state.shake = Math.max(state.shake, 2); sfx("shot");
    const muzzle = playerMuzzle(), dx = x - muzzle.x, dy = y - muzzle.y, distance = Math.max(1, Math.hypot(dx, dy));
    const flameRange = height * .58, reach = Math.min(flameRange, distance), end = { x: muzzle.x + dx / distance * reach, y: muzzle.y + dy / distance * reach };
    state.tracers.push({ x1: muzzle.x, y1: muzzle.y, x2: end.x, y2: end.y, life: .11, max: .11, color: colors.orange, flame: true });
    for (const e of state.enemies) {
      if (e.dead || !e.screen) continue;
      const radius = 20 + e.screen.scale * (e.boss ? 44 : 28);
      if (e.screen.y >= height * .39 && distanceToSegment(e.screen.x, e.screen.y - 30 * e.screen.scale, muzzle.x, muzzle.y, end.x, end.y) <= radius) {
        damageEnemy(e, weaponData.Flamethrower.damage, e.screen.x, e.screen.y, true);
      }
    }
    for (let i = 0; i < 5; i++) state.particles.push({ x: end.x + rand(-22, 22), y: end.y + rand(-22, 22), vx: rand(-30, 30), vy: rand(-75, -20), gravity: -30, size: rand(8, 18), life: .3 + Math.random() * .3, color: Math.random() < .5 ? "#ffb33b" : "#ff5038", fire: true });
  }

  function fireRocket(x, y) {
    const farLimit = height * .61;
    if (y > farLimit) { sfx("wrong"); announce("Target too close", "Bazooka fires only into the far road"); return; }
    sfx("rocket"); state.shake = 14; state.flash = .35; state.rings.push({ x, y, radius: 15, life: .42, max: .42, speed: 390, color: colors.orange });
    burst(x, y, colors.orange, 34);
    for (const e of state.enemies) {
      if (!e.dead && e.screen && e.screen.y <= farLimit && Math.hypot(x - e.screen.x, y - e.screen.y) < 190 + e.screen.scale * 20) damageEnemy(e, weaponData.Bazooka.damage, e.screen.x, e.screen.y, true);
    }
  }

  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq)) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function useBomb() {
    if (!state.running || state.paused || state.bombs < 1) return;
    state.bombs--; state.invulnerable = 1.1; state.skyBomb = { time: 0, exploded: false }; announce("Skyfall", "Payload inbound"); updateHUD();
  }

  function explodeBomb() {
    if (!state.skyBomb || state.skyBomb.exploded) return;
    state.skyBomb.exploded = true; state.flash = 1; state.shake = 25; sfx("bomb");
    let count = 0;
    for (const e of state.enemies) if (!e.dead) { count++; damageEnemy(e, 999, e.screen?.x || width / 2, e.screen?.y || height / 2, true); }
    state.score += count * 35; state.question = null;
    for (let i = 0; i < 5; i++) state.rings.push({ x: width * (i + 1) / 6, y: height * (.28 + Math.random() * .45), radius: 10, life: .7, max: .7, speed: 530, color: i % 2 ? colors.orange : "#ffffff" });
    updateHUD();
  }

  function getTarget(x, y) {
    return state.enemies.filter(e => !e.dead && e.screen).sort((a, b) => b.z - a.z).find(e => {
      const s = e.screen, rx = (e.boss ? 56 : 34) * s.scale, ry = (e.boss ? 92 : 63) * s.scale;
      return ((x - s.x) / rx) ** 2 + ((y - (s.y - ry * .48)) / ry) ** 2 <= 1;
    });
  }

  function damageEnemy(enemy, amount, x, y, quiet = false) {
    if (enemy.dead) return;
    enemy.hp -= amount; enemy.hit = 1; spark(x, y, enemy.kind === "skeleton" || enemy.kind === "dualist" ? "#efe9c8" : "#74c967", quiet ? 2 : 7);
    if (!quiet) sfx("hit");
    if (enemy.hp <= 0) {
      enemy.dead = true; enemy.dying = 0; beginEnemyDeath(enemy); state.kills++; state.combo = Math.min(9, state.combo + 1); state.comboTimer = 2.4;
      state.score += enemy.reward * state.combo; sfx("kill");
      if (enemy.boss) bossVoice("death");
    }
  }

  function beginEnemyDeath(enemy) {
    enemy.corpse = true;
    const skeletal = enemy.kind === "skeleton" || enemy.kind === "dualist";
    if (skeletal) {
      const pieces = [
        ["skull",0,-101],["ribcage",0,-62],["pelvis",0,-34],["bone",-28,-66],["bone",28,-66],
        ["bone",-39,-42],["bone",39,-42],["bone",-15,-22],["bone",15,-22],["bone",-21,-2],["bone",21,-2]
      ];
      enemy.deathParts = pieces.map((part,index) => ({ type:part[0], x:part[1], y:part[2], vx:(index%2?-1:1)*(25+index*7)+rand(-20,20), vy:rand(-150,-55), rotation:rand(-30,30)/10, spin:rand(-55,55)/10, size:index<3?1:rand(8,13)/10 }));
      burst(enemy.screen?.x || width/2, enemy.screen?.y || height/2, colors.bone, enemy.boss ? 38 : 20);
    } else {
      const sx = enemy.screen?.x || width/2, sy = enemy.screen?.y || height/2;
      for (let i=0;i<(enemy.boss?30:18);i++) state.particles.push({x:sx+rand(-15,15),y:sy-rand(20,70),vx:rand(-120,120),vy:rand(-190,-40),gravity:310,size:rand(4,10),life:1.3+Math.random()*1.2,color:Math.random()<.45?"#b53cff":"#6e178f",blood:true,ground:sy+8});
    }
  }

  function updateDeathParts(enemy, dt) {
    if (!enemy.deathParts) return;
    for (const part of enemy.deathParts) {
      part.x += part.vx * dt; part.y += part.vy * dt; part.vy += 240 * dt; part.rotation += part.spin * dt;
      if (part.y > 0) { part.y = 0; part.vy *= -.28; part.vx *= .72; part.spin *= .7; }
    }
  }

  function spark(x, y, color, count) {
    for (let i = 0; i < count; i++) state.particles.push({ x, y, vx: rand(-100, 100), vy: rand(-120, 40), gravity: 280, size: rand(2, 5), life: .18 + Math.random() * .25, color });
  }
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) { const a = Math.random() * TAU, speed = rand(45, 260); state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, gravity: 210, size: rand(3, 10), life: .35 + Math.random() * .5, color }); }
  }

  function roadHalfAt(y) {
    const horizon = height * ROAD_HORIZON, t = Math.max(0, Math.min(1, (y - horizon) / (height * (1 - ROAD_HORIZON))));
    return width * (.026 + t * .534);
  }

  function projectEnemy(e) {
    const horizon = height * ROAD_HORIZON, depth = Math.max(0, e.z), curve = Math.pow(depth, 1.5);
    const y = horizon + curve * height * .62; const scale = .13 + curve * 1.5 + (e.boss ? .18 : 0);
    const laneSway = Math.sin(e.phase) * (e.boss ? 3 : 7) * scale;
    const x = width / 2 + e.lane * roadHalfAt(y) * 1.25 + laneSway;
    return { x, y, scale };
  }

  function drawAttract() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = colors.dark; ctx.fillRect(0, 0, width, height);
  }

  function drawWorld() {
    const shakeX = state.shake ? (Math.random() - .5) * state.shake : 0, shakeY = state.shake ? (Math.random() - .5) * state.shake : 0;
    ctx.save(); ctx.translate(shakeX, shakeY);
    drawBackdrop();
    for (const e of state.enemies.sort((a, b) => a.z - b.z)) { e.screen = projectEnemy(e); drawEnemy(e); }
    if (state.question) drawQuestion(state.question);
    if (state.skyBomb) drawSkyBomb();
    drawEffects(); drawPlayer();
    if (state.flash > 0) { ctx.fillStyle = `rgba(255,245,214,${Math.min(.8, state.flash)})`; ctx.fillRect(-20, -20, width + 40, height + 40); }
    ctx.restore();
  }

  function drawBackdrop() {
    const horizon = height * ROAD_HORIZON;
    if (roadImage.complete && roadImage.naturalWidth) {
      const imageRatio = roadImage.naturalWidth / roadImage.naturalHeight, viewRatio = width / height;
      let sx = 0, sy = 0, sw = roadImage.naturalWidth, sh = roadImage.naturalHeight;
      if (viewRatio > imageRatio) { sh = sw / viewRatio; sy = (roadImage.naturalHeight - sh) / 2; }
      else { sw = sh * viewRatio; sx = (roadImage.naturalWidth - sw) / 2; }
      const distantSourceHeight = sh * .397;
      ctx.drawImage(roadImage, sx, sy, sw, distantSourceHeight, 0, 0, width, horizon + height * .01);
    } else drawSky();

    const abyss = ctx.createLinearGradient(0, horizon, 0, height);
    abyss.addColorStop(0, "rgba(19,83,78,.12)"); abyss.addColorStop(.09, "rgba(8,49,50,.92)"); abyss.addColorStop(.45, "#071d24"); abyss.addColorStop(1, "#030b10");
    ctx.fillStyle = abyss; ctx.fillRect(0, horizon, width, height - horizon);
    const fog = ctx.createRadialGradient(width / 2, horizon, 0, width / 2, horizon, width * .42);
    fog.addColorStop(0, "rgba(78,255,195,.3)"); fog.addColorStop(.42, "rgba(23,140,127,.12)"); fog.addColorStop(1, "rgba(4,21,27,0)");
    ctx.fillStyle = fog; ctx.fillRect(0, horizon - height * .04, width, height * .3);
    drawMovingTrack();
  }

  function trackPoint(depth, side = 0) {
    const curve = Math.pow(Math.max(0, Math.min(1, depth)), 1.62), y = height * ROAD_HORIZON + curve * height * (TRACK_BOTTOM - ROAD_HORIZON);
    const half = width * (.026 + curve * .544);
    return { depth, curve, y, x: width / 2 + side * half, half };
  }

  function sceneHash(value) { return Math.abs(Math.sin(value * 78.233) * 43758.5453) % 1; }

  function movingSample(index, count, rate = 1) {
    const raw = index / count + state.elapsed * .34 * rate;
    return { depth: ((raw % 1) + 1) % 1, id: index + Math.floor(raw) * count };
  }

  function drawMovingTrack() {
    const horizon = height * ROAD_HORIZON, bottom = height * TRACK_BOTTOM, phase = state.roadOffset;
    const road = ctx.createLinearGradient(0, horizon, 0, height);
    road.addColorStop(0, "#33464c"); road.addColorStop(.34, "#27363f"); road.addColorStop(1, "#151f2b");
    ctx.fillStyle = road; ctx.beginPath(); ctx.moveTo(width * .474, horizon); ctx.lineTo(width * .526, horizon); ctx.lineTo(width * 1.08, bottom); ctx.lineTo(-width * .08, bottom); ctx.closePath(); ctx.fill();

    for (const side of [-1,1]) {
      const shoulder=ctx.createLinearGradient(0,horizon,0,height);shoulder.addColorStop(0,"rgba(31,43,44,.65)");shoulder.addColorStop(1,"rgba(11,17,23,.96)");ctx.fillStyle=shoulder;
      ctx.beginPath();ctx.moveTo(width/2+side*width*.028,horizon);ctx.lineTo(width/2+side*width*.036,horizon);ctx.lineTo(width/2+side*width*.59,bottom);ctx.lineTo(width/2+side*width*.53,bottom);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle = "rgba(91,123,117,.22)"; ctx.lineWidth = 2;
    ctx.beginPath();ctx.moveTo(width*.474,horizon);ctx.lineTo(-width*.08,bottom);ctx.moveTo(width*.526,horizon);ctx.lineTo(width*1.08,bottom);ctx.stroke();

    // Broad, irregular repairs drift with the asphalt and avoid readable repeating bands.
    for (let i=0;i<15;i++) {
      const sample=movingSample(i,15,.83),seed=sceneHash(sample.id),seed2=sceneHash(sample.id+31),p=trackPoint(sample.depth);
      const x=width/2+(seed*1.35-.675)*p.half,w=2+p.curve*(24+seed2*42),h=1+p.curve*(7+seed*13);
      ctx.fillStyle=`rgba(9,18,25,${.025+p.curve*.12})`;ctx.beginPath();ctx.ellipse(x,p.y,w,h,(seed-.5)*.65,0,TAU);ctx.fill();
      ctx.strokeStyle=`rgba(92,104,101,${.018+p.curve*.08})`;ctx.lineWidth=.5+p.curve;ctx.beginPath();ctx.arc(x,p.y-h*.18,w*.7,Math.PI*.96,TAU*.96);ctx.stroke();
    }

    // These are the road's actual painted lane marks, sharing the same advancing depth as the slabs and fences.
    ctx.shadowColor = "rgba(255,221,112,.4)"; ctx.shadowBlur = 5;
    for (let i = 0; i < 10; i++) {
      const sample=movingSample(i,10),t1=sample.depth,t2=Math.min(1,t1+.025+t1*.075*(.8+sceneHash(sample.id)*.35)),p1=trackPoint(t1),p2=trackPoint(t2);
      const w1 = .7 + p1.curve * 7.5, w2 = .8 + p2.curve * 9.5;
      ctx.fillStyle = `rgba(188,165,86,${.36 + p2.curve * .38})`; ctx.beginPath(); ctx.moveTo(width/2-w1,p1.y);ctx.lineTo(width/2+w1,p1.y);ctx.lineTo(width/2+w2,p2.y);ctx.lineTo(width/2-w2,p2.y);ctx.closePath();ctx.fill();
      if (p2.curve > .24) { ctx.fillStyle=`rgba(38,49,52,${.3+p2.curve*.32})`;ctx.beginPath();ctx.moveTo(width/2-w2*.72,p1.y+(p2.y-p1.y)*.55);ctx.lineTo(width/2+w2*.18,p1.y+(p2.y-p1.y)*.46);ctx.lineTo(width/2+w2*.52,p1.y+(p2.y-p1.y)*.62);ctx.lineTo(width/2-w2*.44,p1.y+(p2.y-p1.y)*.69);ctx.closePath();ctx.fill(); }
    }
    ctx.shadowBlur = 0;

    // World-space crack clusters get a new deterministic shape only when they recycle at the portal.
    for (let i = 0; i < 26; i++) {
      const sample=movingSample(i,26),seed=sceneHash(sample.id),seed2=sceneHash(sample.id+19),seed3=sceneHash(sample.id+47),p=trackPoint(sample.depth);
      const lane=seed*1.45-.725,x=width/2+lane*p.half,size=1+p.curve*(16+seed2*33),direction=(seed3-.5)*size*.58;
      ctx.strokeStyle=`rgba(3,9,15,${.09+p.curve*.58})`;ctx.lineWidth=.45+p.curve*(1.8+seed2*1.8);ctx.lineCap="round";ctx.lineJoin="round";
      ctx.beginPath();ctx.moveTo(x,p.y);ctx.lineTo(x+direction*.22,p.y+size*.23);ctx.lineTo(x-direction*.18,p.y+size*.51);ctx.lineTo(x+direction,p.y+size);ctx.stroke();
      if(seed2>.3){ctx.lineWidth*=.62;ctx.beginPath();ctx.moveTo(x+direction*.02,p.y+size*.43);ctx.lineTo(x-direction*.48,p.y+size*(.58+seed*.14));ctx.lineTo(x-direction*.64,p.y+size*(.72+seed3*.13));ctx.stroke()}
      if(seed3>.56){ctx.beginPath();ctx.moveTo(x+direction*.5,p.y+size*.72);ctx.lineTo(x+direction*.95,p.y+size*(.8+seed*.1));ctx.stroke()}
    }

    for (let i = 0; i < 12; i++) {
      const sample=movingSample(i,12,.91),seed=sceneHash(sample.id),lane=seed*1.38-.69,p=trackPoint(sample.depth),rockW=1+p.curve*(10+sceneHash(sample.id+9)*18),rockH=1+p.curve*(3+seed*7);
      const x = width/2 + lane*p.half;
      ctx.fillStyle=`rgba(5,13,18,${.13+p.curve*.48})`;ctx.beginPath();ctx.ellipse(x,p.y,rockW,rockH,lane*.42,0,TAU);ctx.fill();
      ctx.strokeStyle=`rgba(100,112,103,${.06+p.curve*.2})`;ctx.lineWidth=.5+p.curve;ctx.beginPath();ctx.arc(x,p.y-rockH*.15,rockW*.72,Math.PI,TAU);ctx.stroke();
    }

    drawTrackFence(-1, phase); drawTrackFence(1, phase);
  }

  function drawTrackFence(side, phase) {
    const anchor=trackPoint(0,side*.985),posts=[anchor];anchor.id=-1;anchor.tilt=0;anchor.height=8;anchor.width=3;
    for (let i = 0; i < 8; i++) {
      const sample=movingSample(i,8),p=trackPoint(sample.depth,side*.985),variation=sceneHash(sample.id+side*13);
      p.id=sample.id;p.tilt=(variation-.5)*p.curve*14;p.height=(11+p.curve*164)*(.9+sceneHash(sample.id+7)*.15);p.width=5+p.curve*31;posts.push(p);
    }
    posts.sort((a,b) => a.depth - b.depth);

    // Rails are individual advancing spans between posts, so they stretch and pass the player with the posts.
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i+1];
      for (const level of [.76,.42]) {
        const thickness = 3 + ((a.curve+b.curve)/2) * 18;
        if (level === .76 && sceneHash(a.id+side*31) > .76 && b.curve > .25) continue;
        drawWeatheredRail(a,b,level,thickness,side,i);
      }
    }

    for (const p of posts) {
      const w=p.width,h=p.height,topX=p.x+p.tilt;
      ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(p.x+side*w*.4,p.y+2,w*1.25,2+p.curve*7,0,0,TAU);ctx.fill();
      ctx.fillStyle="#131a1e";ctx.beginPath();ctx.moveTo(p.x-w*.74,p.y);ctx.lineTo(topX-w*.5,p.y-h);ctx.lineTo(topX+w*.39,p.y-h-p.curve*4);ctx.lineTo(p.x+w*.7,p.y);ctx.closePath();ctx.fill();
      ctx.fillStyle=`rgba(59,49,43,${.82+p.curve*.12})`;ctx.beginPath();ctx.moveTo(p.x-side*w*.18,p.y);ctx.lineTo(topX-side*w*.16,p.y-h);ctx.lineTo(topX+side*w*.38,p.y-h-p.curve*4);ctx.lineTo(p.x+side*w*.48,p.y);ctx.closePath();ctx.fill();
      ctx.fillStyle="#0b1114";ctx.beginPath();ctx.moveTo(topX-w*.63,p.y-h-3-p.curve*6);ctx.lineTo(topX+w*.5,p.y-h-5-p.curve*3);ctx.lineTo(topX+w*.62,p.y-h+2+p.curve*2);ctx.lineTo(topX-w*.57,p.y-h+4+p.curve*2);ctx.closePath();ctx.fill();
      ctx.strokeStyle=`rgba(153,112,74,${.2+p.curve*.3})`;ctx.lineWidth=.5+p.curve*2;ctx.beginPath();ctx.moveTo(topX-side*w*.08,p.y-h*.88);ctx.lineTo(p.x-side*w*.02,p.y-h*.14);ctx.stroke();
      ctx.fillStyle=`rgba(255,111,51,${.15+p.curve*.4})`;ctx.shadowColor="#ff5e2d";ctx.shadowBlur=p.curve*10;ctx.beginPath();ctx.arc(p.x-side*w*.1,p.y-h*.55,1+p.curve*2.5,0,TAU);ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle="#263238";for(const rockSide of[-1,1])for(let r=0;r<2;r++){ctx.beginPath();ctx.ellipse(p.x+rockSide*w*(.78+p.curve*(.42+r*.4)),p.y-r*p.curve*2,1+p.curve*(8+r*4),1+p.curve*(4+r*2),rockSide*.25,0,TAU);ctx.fill()}
    }
  }

  function drawWeatheredRail(a,b,level,thickness,side,seed) {
    const ax=a.x+a.tilt*.68,ay=a.y-a.height*level,bx=b.x+b.tilt*.68,by=b.y-b.height*level;
    const bend=Math.sin((seed+1)*2.19+side)*thickness*.55,mx=(ax+bx)/2+side*bend,my=(ay+by)/2+bend*.28;
    ctx.lineCap="square";ctx.lineJoin="bevel";ctx.strokeStyle="#0a1114";ctx.lineWidth=thickness*1.85;ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo(mx,my,bx,by);ctx.stroke();
    ctx.strokeStyle=`rgba(61,51,44,${.86+b.curve*.1})`;ctx.lineWidth=thickness;ctx.beginPath();ctx.moveTo(ax,ay-thickness*.08);ctx.quadraticCurveTo(mx,my-thickness*.16,bx,by-thickness*.08);ctx.stroke();
    ctx.strokeStyle=`rgba(139,119,91,${.13+b.curve*.23})`;ctx.lineWidth=Math.max(.5,thickness*.16);ctx.beginPath();ctx.moveTo(ax,ay-thickness*.38);ctx.quadraticCurveTo(mx,my-thickness*.42,bx,by-thickness*.38);ctx.stroke();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, height * .64); g.addColorStop(0, "#06141f"); g.addColorStop(.55, "#0e3941"); g.addColorStop(1, "#2a6962"); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * .5, height * .22, 0, width * .5, height * .22, width * .36); glow.addColorStop(0, "rgba(76,255,188,.25)"); glow.addColorStop(1, "rgba(28,142,126,0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height * .65);
    ctx.fillStyle = "rgba(218,255,237,.68)"; ctx.beginPath(); ctx.arc(width * .82, height * .1, Math.min(width, height) * .032, 0, TAU); ctx.fill();
    ctx.fillStyle = "#0a2731"; ctx.beginPath(); ctx.moveTo(0, height * .25); for (let x = 0; x <= width; x += width / 10) ctx.lineTo(x, height * (.12 + Math.random() * .1)); ctx.lineTo(width, height * .33); ctx.lineTo(0, height * .33); ctx.fill();
  }

  function drawRoad() {
    const hy = height * .23, roadBottom = height * 1.04;
    ctx.fillStyle = "#0d252a"; ctx.beginPath(); ctx.moveTo(width * .445, hy); ctx.lineTo(width * 1.07, roadBottom); ctx.lineTo(-width * .07, roadBottom); ctx.lineTo(width * .555, hy); ctx.closePath(); ctx.fill();
    const roadG = ctx.createLinearGradient(0, hy, 0, height); roadG.addColorStop(0, "#1e3c3e"); roadG.addColorStop(.55, "#173034"); roadG.addColorStop(1, "#10252a");
    ctx.fillStyle = roadG; ctx.beginPath(); ctx.moveTo(width * .455, hy); ctx.lineTo(width * .95, roadBottom); ctx.lineTo(width * .05, roadBottom); ctx.lineTo(width * .545, hy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(109,255,178,.34)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(width*.455,hy);ctx.lineTo(width*.05,roadBottom);ctx.moveTo(width*.545,hy);ctx.lineTo(width*.95,roadBottom);ctx.stroke();
    for (let i = -1; i < 12; i++) {
      const t1 = ((i / 11 + state.roadOffset * .095) % 1 + 1) % 1, t2 = Math.min(1, t1 + .045 + t1 * .1);
      const y1 = hy + Math.pow(t1, 1.85) * (height - hy), y2 = hy + Math.pow(t2, 1.85) * (height - hy);
      ctx.fillStyle = `rgba(197,220,194,${.22 + t1 * .35})`;
      for (const lane of [-.33, .33]) {
        const x1 = width / 2 + lane * roadHalfAt(y1) * 1.45, x2 = width / 2 + lane * roadHalfAt(y2) * 1.45;
        const w1 = 1 + t1 * 5, w2 = 1 + t2 * 7;
        ctx.beginPath(); ctx.moveTo(x1-w1,y1);ctx.lineTo(x1+w1,y1);ctx.lineTo(x2+w2,y2);ctx.lineTo(x2-w2,y2);ctx.fill();
      }
    }
    for (let i = 0; i < 9; i++) {
      const t = ((i / 8 + state.roadOffset * .12) % 1); const y = hy + Math.pow(t,1.7)*(height-hy);
      ctx.strokeStyle=`rgba(8,19,22,${.12+t*.25})`;ctx.lineWidth=1+t*3;ctx.beginPath();ctx.moveTo(width/2-roadHalfAt(y)*.82,y);ctx.lineTo(width/2+roadHalfAt(y)*.82,y);ctx.stroke();
    }
  }

  function drawScenery() {
    const hy = height * .23;
    ctx.fillStyle = "rgba(6,27,31,.72)";
    for (let side of [-1, 1]) for (let i = 0; i < 8; i++) {
      const t = i / 8, y = hy + Math.pow(t,1.5)*height*.69, x = width/2 + side*(roadHalfAt(y)+35+t*60), s = 10+t*55;
      ctx.beginPath();ctx.moveTo(x,y-s*2);ctx.lineTo(x-s,y);ctx.lineTo(x-s*.42,y);ctx.lineTo(x-s*1.2,y+s*.7);ctx.lineTo(x+s*1.2,y+s*.7);ctx.lineTo(x+s*.4,y);ctx.lineTo(x+s,y);ctx.closePath();ctx.fill();
    }
  }

  function drawEnemy(e) {
    const {x, y, scale} = e.screen; if (y < height * (ROAD_HORIZON - .035) || y > height * 1.13) return;
    const fadeStart = e.deathDuration * .78, timeFade = e.dead && e.dying > fadeStart ? Math.max(0, 1 - (e.dying - fadeStart) / (e.deathDuration - fadeStart)) : 1;
    const roadFade = e.corpse && e.z > 1.04 ? Math.max(0, 1 - (e.z - 1.04) / .14) : 1, fade = Math.min(timeFade, roadFade);
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.scale(scale, scale);
    const bossScale = e.boss ? (e.kind === "club" || e.kind === "dualist" ? 1.55 : 1.28) : 1; ctx.scale(bossScale, bossScale);
    ctx.fillStyle = "rgba(0,0,0,.31)"; ctx.beginPath(); ctx.ellipse(0, 3, 38, 11, 0, 0, TAU); ctx.fill();
    if (e.dead) {
      if (e.escaped) { ctx.globalAlpha *= Math.max(0, 1 - e.dying / e.deathDuration); }
      else if (e.kind === "skeleton" || e.kind === "dualist") { drawSkeletonDeath(e); ctx.restore(); return; }
      else { drawZombieDeath(e); ctx.restore(); return; }
    }
    if (e.kind === "skeleton" || e.kind === "dualist") drawSkeleton(e); else drawZombie(e);
    if (e.hit > 0) { ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = e.hit * .7; ctx.fillStyle="#fff";ctx.beginPath();ctx.ellipse(0,-48,34,62,0,0,TAU);ctx.fill(); }
    if (e.boss && !e.dead) drawEnemyHealth(e);
    ctx.restore();
  }

  function drawZombieDeath(e) {
    const fall = Math.min(1, e.dying / .72), direction = e.id > .5 ? 1 : -1;
    ctx.fillStyle = `rgba(111,18,144,${.24 + Math.min(.35,e.dying*.14)})`; ctx.beginPath(); ctx.ellipse(direction * 17 * fall, 3, 18 + fall * 39, 5 + fall * 11, direction * .12, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(190,49,255,${.25 * (1-fall*.35)})`; ctx.beginPath(); ctx.ellipse(direction * 5, 1, 9 + fall * 18, 3 + fall * 5, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(direction * fall * 17, 0); ctx.rotate(direction * fall * 1.48); drawZombie(e); ctx.restore();
  }

  function drawSkeletonDeath(e) {
    if (!e.deathParts) return;
    for (const part of e.deathParts) {
      ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(part.rotation); ctx.scale(part.size,part.size); drawBonePiece(part.type, e.boss); ctx.restore();
    }
  }

  function drawBonePiece(type, boss) {
    const bone = boss ? "#f2edcf" : "#d9d7c0", shade = "#9d9d8b";
    if (type === "skull") {
      ctx.fillStyle=bone;ctx.beginPath();ctx.arc(0,0,22,0,TAU);ctx.fill();ctx.fillStyle="#142127";ctx.beginPath();ctx.ellipse(-8,-3,5,7,0,0,TAU);ctx.ellipse(8,-3,5,7,0,0,TAU);ctx.fill();ctx.strokeStyle=shade;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-13,12);ctx.lineTo(13,12);ctx.stroke();
    } else if (type === "ribcage") {
      ctx.strokeStyle=bone;ctx.lineWidth=4;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-19,-12+i*7);ctx.quadraticCurveTo(0,4+i*2,19,-12+i*7);ctx.stroke()}ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,18);ctx.stroke();
    } else if (type === "pelvis") {
      ctx.strokeStyle=bone;ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,-2,18,.15,Math.PI-.15);ctx.lineTo(0,10);ctx.closePath();ctx.stroke();
    } else {
      ctx.strokeStyle=shade;ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(15,0);ctx.stroke();ctx.fillStyle=bone;ctx.beginPath();ctx.arc(-15,0,6,0,TAU);ctx.arc(15,0,6,0,TAU);ctx.fill();ctx.strokeStyle=bone;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(13,0);ctx.stroke();
    }
  }

  function drawJointedLimb(ax,ay,bx,by,cx,cy,outer,inner,outerWidth,innerWidth,jointSize=0) {
    ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=outer;ctx.lineWidth=outerWidth;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.lineTo(cx,cy);ctx.stroke();
    ctx.strokeStyle=inner;ctx.lineWidth=innerWidth;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.lineTo(cx,cy);ctx.stroke();
    if(jointSize){ctx.fillStyle=inner;ctx.beginPath();ctx.arc(bx,by,jointSize,0,TAU);ctx.arc(cx,cy,jointSize*.85,0,TAU);ctx.fill()}
  }

  function drawZombie(e) {
    const gait=e.phase,step=Math.sin(gait),drag=Math.sin(gait*.5+1.1),bob=Math.max(0,step)*2.5,attack=e.z>.9&&e.attack<.42?Math.sin((.42-e.attack)*7):0;
    const skin=e.kind==="club"?"#789456":"#628554",skinDark="#314738",shirt=e.kind==="club"?"#45322c":"#54313f";
    ctx.save();ctx.translate(step*1.8,-bob);ctx.rotate(-.045+step*.022);
    const leftLift=Math.max(0,step),rightLift=Math.max(0,-step)*.28;
    drawJointedLimb(-14,-47,-18-step*7,-25-leftLift*5,-24-step*14,-2-leftLift*5,"#111a1c","#263433",17,10,5);
    drawJointedLimb(14,-47,19+drag*3,-24-rightLift*2,22+drag*7,-1-rightLift*2,"#111a1c","#263433",17,10,5);
    ctx.fillStyle="#0a1114";ctx.beginPath();ctx.roundRect(-36-step*14,-8-leftLift*5,25,10,4);ctx.roundRect(9+drag*7,-7-rightLift*2,27,10,4);ctx.fill();

    ctx.fillStyle="#1b2527";ctx.beginPath();ctx.moveTo(-31,-58);ctx.lineTo(31,-58);ctx.lineTo(25,-39);ctx.lineTo(7,-43);ctx.lineTo(-6,-37);ctx.lineTo(-27,-42);ctx.closePath();ctx.fill();
    ctx.fillStyle=shirt;ctx.beginPath();ctx.moveTo(-31,-91);ctx.lineTo(-15,-96);ctx.lineTo(-5,-87);ctx.lineTo(8,-97);ctx.lineTo(20,-86);ctx.lineTo(33,-91);ctx.lineTo(29,-49);ctx.lineTo(10,-53);ctx.lineTo(-1,-46);ctx.lineTo(-15,-54);ctx.lineTo(-30,-49);ctx.closePath();ctx.fill();
    ctx.fillStyle="#742c5e";ctx.beginPath();ctx.moveTo(-28,-82);ctx.lineTo(-7,-91);ctx.lineTo(2,-77);ctx.lineTo(17,-88);ctx.lineTo(30,-78);ctx.lineTo(27,-66);ctx.lineTo(-29,-66);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#a44d82";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-22,-72);ctx.lineTo(-8,-67);ctx.moveTo(5,-73);ctx.lineTo(20,-69);ctx.stroke();
    ctx.fillStyle="#281a22";ctx.beginPath();ctx.ellipse(17,-61,8,11,.35,0,TAU);ctx.fill();ctx.strokeStyle="#a63f8f";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(11,-58);ctx.lineTo(24,-65);ctx.moveTo(14,-67);ctx.lineTo(23,-56);ctx.stroke();

    for(const side of[-1,1]){
      const clubArm=e.kind==="club"&&side===1,shoulderX=side*27,shoulderY=-83;
      const elbowX=clubArm?39:side*(38+step*2),elbowY=clubArm?-72:-67+side*step*2;
      const handX=clubArm?45:side*(27+attack*9),handY=clubArm?-56:-42-attack*8;
      drawJointedLimb(shoulderX,shoulderY,elbowX,elbowY,handX,handY,skinDark,skin,17,11,6);
      ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(handX,handY,clubArm?8:11,clubArm?8:10,side*.16,0,TAU);ctx.fill();
      if(!clubArm){ctx.strokeStyle=skinDark;ctx.lineWidth=2;for(let f=-1;f<=1;f++){ctx.beginPath();ctx.moveTo(handX+side*3,handY+f*3);ctx.lineTo(handX+side*(10+Math.abs(f)*2),handY+f*5);ctx.stroke()}}
    }

    ctx.fillStyle=skinDark;ctx.fillRect(-8,-103,17,16);
    ctx.save();ctx.translate(step*2.8,-1);ctx.rotate(step*.055+drag*.025);
    ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(-24,-124);ctx.quadraticCurveTo(-30,-106,-20,-91);ctx.quadraticCurveTo(0,-82,22,-93);ctx.quadraticCurveTo(30,-108,22,-125);ctx.quadraticCurveTo(0,-137,-24,-124);ctx.fill();
    ctx.fillStyle="#455e43";ctx.beginPath();ctx.arc(-23,-108,7,0,TAU);ctx.arc(22,-106,6,0,TAU);ctx.fill();
    ctx.fillStyle="#362238";ctx.beginPath();ctx.ellipse(-17,-116,8,5,-.35,0,TAU);ctx.fill();ctx.strokeStyle="#7b3990";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-23,-119);ctx.lineTo(-11,-113);ctx.stroke();
    ctx.fillStyle="#e5ff94";ctx.shadowColor="#b7ff6f";ctx.shadowBlur=e.boss?10:4;ctx.beginPath();ctx.ellipse(-9,-113,5,4,-.1,0,TAU);ctx.ellipse(11,-111,4,5,.2,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#172019";ctx.beginPath();ctx.arc(-8,-113,2,0,TAU);ctx.arc(11,-111,2,0,TAU);ctx.fill();
    ctx.fillStyle="#28151f";ctx.beginPath();ctx.moveTo(-13,-99);ctx.quadraticCurveTo(1,-88,15,-99);ctx.lineTo(11,-87);ctx.lineTo(-8,-88);ctx.closePath();ctx.fill();ctx.fillStyle="#d6c4a4";for(let i=0;i<5;i++){const toothX=-10+i*5;ctx.beginPath();ctx.moveTo(toothX,-98);ctx.lineTo(toothX+3,-98);ctx.lineTo(toothX+1,-92-(i%3));ctx.fill()}
    ctx.strokeStyle="#314c37";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(3,-126);ctx.lineTo(-2,-116);ctx.lineTo(5,-119);ctx.moveTo(17,-103);ctx.lineTo(8,-98);ctx.stroke();ctx.restore();
    if(e.boss){ctx.fillStyle="#24343a";for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(side*23,-92);ctx.lineTo(side*49,-87);ctx.lineTo(side*31,-67);ctx.closePath();ctx.fill()}ctx.fillStyle=colors.orange;ctx.beginPath();ctx.moveTo(-4,-133);ctx.lineTo(0,-145);ctx.lineTo(5,-133);ctx.fill()}
    if (e.kind === "club") {
      ctx.save();ctx.translate(45,-55);ctx.rotate(-.55+attack*1.65);ctx.strokeStyle="#4a2a1b";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-74);ctx.stroke();ctx.fillStyle="#73513a";ctx.beginPath();ctx.roundRect(-13,-88,27,50,7);ctx.fill();ctx.fillStyle="#aa7a50";for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-12+i*12,-80);ctx.lineTo(-20+i*17,-90);ctx.lineTo(-7+i*12,-85);ctx.fill()}ctx.restore();
    }
    ctx.restore();
  }

  function drawSkeleton(e) {
    const gait=e.phase*.92,step=Math.sin(gait),bob=Math.abs(Math.sin(gait))*1.7,headSway=Math.sin(e.phase*1.37)*7,headTilt=Math.sin(e.phase*1.37+.7)*.14,attack=e.z>.9&&e.attack<.5?Math.sin((.5-e.attack)*6):0;
    const bone=e.boss?"#f0ead0":"#d8d7c2",shadow="#737d78",armed=e.kind==="dualist";
    ctx.save();ctx.translate(0,-bob);ctx.rotate(step*.012);
    const leftKneeX=-13+step*8,rightKneeX=13-step*8,leftFootX=-19+step*14,rightFootX=19-step*14;
    drawJointedLimb(-10,-35,leftKneeX,-18,leftFootX,0,shadow,bone,10,5,5);
    drawJointedLimb(10,-35,rightKneeX,-18,rightFootX,0,shadow,bone,10,5,5);
    ctx.fillStyle=bone;ctx.beginPath();ctx.ellipse(leftFootX-3,0,11,4,-.06,0,TAU);ctx.ellipse(rightFootX+3,0,11,4,.06,0,TAU);ctx.fill();
    ctx.fillStyle=bone;ctx.beginPath();ctx.moveTo(-18,-39);ctx.quadraticCurveTo(-22,-28,-10,-24);ctx.lineTo(0,-29);ctx.lineTo(10,-24);ctx.quadraticCurveTo(22,-28,18,-39);ctx.quadraticCurveTo(0,-31,-18,-39);ctx.fill();ctx.fillStyle="#142027";ctx.beginPath();ctx.arc(0,-33,8,0,Math.PI);ctx.fill();
    ctx.strokeStyle=shadow;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,-76);ctx.lineTo(0,-32);ctx.stroke();ctx.strokeStyle=bone;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-78);ctx.lineTo(0,-31);ctx.stroke();
    for(let i=0;i<6;i++){const y=-73+i*6,w=23-i*1.5;ctx.strokeStyle=shadow;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-w,y);ctx.quadraticCurveTo(0,y+15,w,y);ctx.stroke();ctx.strokeStyle=bone;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w,y);ctx.quadraticCurveTo(0,y+15,w,y);ctx.stroke()}
    ctx.strokeStyle=bone;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-24,-76);ctx.quadraticCurveTo(0,-84,24,-76);ctx.stroke();
    for(const side of[-1,1]){
      const swing=-side*step,shoulderX=side*24,shoulderY=-75;
      const elbowX=armed?side*(32+attack*4):side*(29+swing*5),elbowY=armed?-57:-53+Math.abs(swing)*2;
      const handX=armed?side*(41+attack*5):side*(27+swing*11),handY=armed?-43:-30+swing*3;
      drawJointedLimb(shoulderX,shoulderY,elbowX,elbowY,handX,handY,shadow,bone,9,4.5,4.5);
      if(armed){ctx.save();ctx.translate(handX,handY);ctx.rotate(side*(-.55+attack*1.5));ctx.strokeStyle="#d4fff3";ctx.shadowColor=colors.mint;ctx.shadowBlur=7;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,5);ctx.lineTo(0,-76);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle="#4d6d6a";ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(11,-4);ctx.stroke();ctx.fillStyle="#202d31";ctx.fillRect(-5,2,10,18);ctx.restore()}
    }
    ctx.fillStyle=bone;for(const [jx,jy] of [[-24,-75],[24,-75],[-10,-35],[10,-35]]){ctx.beginPath();ctx.arc(jx,jy,5,0,TAU);ctx.fill()}
    if(e.boss){ctx.fillStyle="#28383c";for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(side*20,-82);ctx.lineTo(side*42,-85);ctx.lineTo(side*27,-65);ctx.closePath();ctx.fill()}}
    ctx.save();ctx.translate(headSway,-105);ctx.rotate(headTilt);
    ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(0,0,29,28,0,0,TAU);ctx.fill();ctx.fillStyle=bone;ctx.beginPath();ctx.moveTo(-24,-12);ctx.quadraticCurveTo(-27,11,-16,19);ctx.lineTo(-12,29);ctx.lineTo(14,27);ctx.lineTo(17,18);ctx.quadraticCurveTo(28,8,23,-13);ctx.quadraticCurveTo(0,-28,-24,-12);ctx.fill();
    ctx.fillStyle="#101a20";ctx.beginPath();ctx.ellipse(-10,-3,8,10,-.16,0,TAU);ctx.ellipse(10,-2,8,10,.16,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(-5,10);ctx.lineTo(0,2);ctx.lineTo(6,10);ctx.fill();
    if(e.boss){ctx.fillStyle=colors.orange;ctx.shadowColor=colors.orange;ctx.shadowBlur=11;ctx.beginPath();ctx.arc(-10,-3,3,0,TAU);ctx.arc(10,-2,3,0,TAU);ctx.fill();ctx.shadowBlur=0}
    ctx.fillStyle="#b8b8a7";ctx.beginPath();ctx.moveTo(-16,18);ctx.quadraticCurveTo(0,32,17,18);ctx.lineTo(14,29);ctx.quadraticCurveTo(0,36,-13,28);ctx.closePath();ctx.fill();ctx.strokeStyle="#5f6662";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-15,20);ctx.lineTo(15,20);for(let i=0;i<5;i++){ctx.moveTo(-11+i*6,20);ctx.lineTo(-10+i*6,28)}ctx.stroke();
    ctx.strokeStyle="#68706b";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(6,-20);ctx.lineTo(-1,-7);ctx.lineTo(8,-10);ctx.moveTo(-20,8);ctx.lineTo(-12,12);ctx.stroke();ctx.fillStyle="#315246";ctx.beginPath();ctx.ellipse(19,8,5,3,.4,0,TAU);ctx.fill();ctx.restore();ctx.restore();
  }

  function drawEnemyHealth(e) {
    const w=76,y=-145;ctx.fillStyle="rgba(2,10,12,.8)";ctx.fillRect(-w/2,y,w,7);ctx.fillStyle=e.hp/e.maxHp<.35?colors.orange:colors.mint;ctx.fillRect(-w/2+1,y+1,(w-2)*Math.max(0,e.hp/e.maxHp),5);
  }

  function drawQuestion(q) {
    const centerX=width/2, baseY=Math.min(height*.49,330), spacing=Math.min(145,width*.25), bob=Math.sin(q.age*3)*6;
    q.balloons=[];
    ctx.save();ctx.textAlign="center";
    ctx.fillStyle="rgba(5,25,31,.9)";ctx.strokeStyle="rgba(109,255,178,.65)";ctx.lineWidth=2;roundRect(centerX-86,baseY+82,172,72,8,true,true);
    ctx.fillStyle="#87aaa0";ctx.font="700 9px DM Sans";ctx.letterSpacing="2px";ctx.fillText("SOLVE TO UNLOCK",centerX,baseY+105);ctx.fillStyle="#f1fff8";ctx.font="800 34px Barlow Condensed";ctx.fillText(`${q.a} ${q.op} ${q.b} = ?`,centerX,baseY+140);
    for(let i=0;i<3;i++){
      const x=centerX+(i-1)*spacing,y=baseY+bob+Math.sin(q.age*4+i)*5,r=Math.min(48,width*.085);q.balloons.push({x,y,r,value:q.answers[i]});
      ctx.strokeStyle="rgba(232,255,245,.5)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y+r);ctx.quadraticCurveTo(x+14,baseY+75,x,baseY+82);ctx.stroke();
      const g=ctx.createRadialGradient(x-r*.25,y-r*.35,3,x,y,r);g.addColorStop(0,i===1?"#9affcf":"#ffab86");g.addColorStop(1,i===1?"#15986b":"#b7432d");ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r*.8,r,0,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(x-6,y+r*.85);ctx.lineTo(x,y+r+9);ctx.lineTo(x+6,y+r*.85);ctx.fill();
      ctx.fillStyle="#071b24";ctx.font=`900 ${Math.max(20,r*.62)}px Barlow Condensed`;ctx.fillText(q.answers[i],x,y+8);
    }
    const remain=Math.max(0,q.life-q.age)/q.life;ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(centerX-86,baseY+152,172,3);ctx.fillStyle=remain<.3?colors.orange:colors.mint;ctx.fillRect(centerX-86,baseY+152,172*remain,3);ctx.restore();
  }

  function drawSkyBomb() {
    const bomb = state.skyBomb, fall = Math.min(1, bomb.time / .58), x = width * .72 + Math.sin(fall * 8) * 9;
    const y = -70 + fall * height * .67;
    ctx.save(); ctx.translate(x, y); ctx.rotate(fall * 2.3);
    ctx.shadowColor = colors.orange; ctx.shadowBlur = 18;
    ctx.fillStyle = "#16272b"; ctx.beginPath(); ctx.ellipse(0, 0, 22, 35, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = colors.orange; ctx.beginPath(); ctx.moveTo(-18, -17); ctx.lineTo(-35, -30); ctx.lineTo(-24, 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, -17); ctx.lineTo(35, -30); ctx.lineTo(24, 2); ctx.fill();
    ctx.fillStyle = "#f7d46a"; ctx.beginPath(); ctx.arc(0, 14, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill)ctx.fill();if(stroke)ctx.stroke()}

  function drawEffects() {
    for(const t of state.tracers){ctx.save();ctx.globalAlpha=t.life/t.max;if(t.flame){const g=ctx.createLinearGradient(t.x1,t.y1,t.x2,t.y2);g.addColorStop(0,"rgba(255,238,102,.2)");g.addColorStop(.7,"#ff8a2b");g.addColorStop(1,"rgba(255,50,30,.1)");ctx.strokeStyle=g;ctx.lineWidth=18+Math.random()*12;ctx.lineCap="round"}else{ctx.strokeStyle=t.color;ctx.lineWidth=2;ctx.shadowColor=t.color;ctx.shadowBlur=12}ctx.beginPath();ctx.moveTo(t.x1,t.y1);ctx.lineTo(t.x2,t.y2);ctx.stroke();ctx.restore()}
    for(const r of state.rings){ctx.save();ctx.globalAlpha=r.life/r.max;ctx.strokeStyle=r.color;ctx.lineWidth=8*r.life/r.max;ctx.shadowColor=r.color;ctx.shadowBlur=22;ctx.beginPath();ctx.arc(r.x,r.y,r.radius,0,TAU);ctx.stroke();ctx.restore()}
    for(const p of state.particles){ctx.save();ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;if(p.fire){ctx.shadowColor=p.color;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill()}else if(p.blood){ctx.shadowColor="#8c20b2";ctx.shadowBlur=5;ctx.beginPath();ctx.ellipse(p.x,p.y,p.size*1.4,p.size*.65,0,0,TAU);ctx.fill()}else{ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size)}ctx.restore()}
  }

  function playerGeometry() {
    const scale = Math.max(.66, Math.min(1.08, height / 760, width / 560));
    const x = width / 2 + Math.max(-42, Math.min(42, (state.aimX - width / 2) * .075));
    const y = height - 14, shoulderX = x + 13 * scale, shoulderY = y - 111 * scale;
    const angle = Math.atan2(state.aimY - shoulderY, state.aimX - shoulderX);
    const length = ({Sidearm: 58, "Machine Gun": 88, Flamethrower: 82, Bazooka: 105})[state.weapon] * scale;
    return { scale, x, y, shoulderX, shoulderY, angle, length };
  }

  function playerMuzzle() {
    const p = playerGeometry();
    return { x: p.shoulderX + Math.cos(p.angle) * p.length, y: p.shoulderY + Math.sin(p.angle) * p.length };
  }

  function drawPlayer() {
    const p = playerGeometry(), recoil = state.nextShot > 0 ? state.nextShot / weaponData[state.weapon].cooldown * 4 : 0;
    const stride = Math.sin(state.elapsed * 9) * 3, stepBob = Math.abs(Math.sin(state.elapsed * 9)) * 2.4;
    ctx.save(); ctx.translate(p.x, p.y + recoil + stepBob); ctx.scale(p.scale, p.scale);

    ctx.fillStyle = "rgba(0,0,0,.46)"; ctx.beginPath(); ctx.ellipse(0, -3, state.character === "san" ? 50 : 42, 13, 0, 0, TAU); ctx.fill();
    ctx.lineCap = "round";
    if (state.character === "augusto") drawAugusto(stride, p.angle);
    else drawSan(stride, p.angle);
    drawPlayerWeapon(p.angle);
    ctx.restore();
  }

  function drawAugusto(stride, aimAngle) {
    ctx.strokeStyle = "#111d23"; ctx.lineWidth = 17;
    ctx.beginPath(); ctx.moveTo(-14, -56); ctx.lineTo(-18 - stride, -7); ctx.moveTo(14, -56); ctx.lineTo(18 + stride, -7); ctx.stroke();
    ctx.fillStyle = "#29414a"; ctx.fillRect(-27 - stride, -15, 22, 11); ctx.fillRect(5 + stride, -15, 22, 11);
    ctx.fillStyle = "#13242c"; ctx.beginPath(); ctx.roundRect(-39, -121, 78, 73, 18); ctx.fill();
    ctx.strokeStyle = "#42616a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-23, -112); ctx.lineTo(18, -55); ctx.moveTo(23, -112); ctx.lineTo(-18, -55); ctx.stroke();
    ctx.fillStyle = colors.mint; ctx.fillRect(-39, -68, 78, 8); ctx.fillStyle = "#081216"; ctx.fillRect(-4, -71, 15, 14);
    ctx.fillStyle = "#b98164"; ctx.beginPath(); ctx.arc(0, -148, 28, 0, TAU); ctx.fill();
    ctx.fillStyle = "#10191e"; ctx.beginPath(); ctx.arc(0, -154, 31, Math.PI, TAU); ctx.lineTo(25, -140); ctx.lineTo(14, -145); ctx.lineTo(5, -136); ctx.lineTo(-5, -146); ctx.lineTo(-19, -137); ctx.lineTo(-27, -145); ctx.closePath(); ctx.fill();
    ctx.fillStyle = colors.mint; ctx.fillRect(-30, -159, 60, 6); ctx.fillStyle = "#1f3740"; ctx.beginPath(); ctx.roundRect(-28, -141, 56, 18, 6); ctx.fill();
    ctx.strokeStyle = "#1a2e36"; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-29, -108); ctx.lineTo(-48, -79); ctx.stroke();
    ctx.fillStyle = "#34535d"; ctx.beginPath(); ctx.roundRect(-54, -87, 18, 26, 6); ctx.fill(); ctx.fillStyle = colors.mint; ctx.fillRect(-53, -74, 16, 3);
    ctx.fillStyle = "#23404a"; ctx.beginPath(); ctx.moveTo(29, -119); ctx.lineTo(55, -110); ctx.lineTo(34, -96); ctx.fill();
  }

  function drawSan(stride, aimAngle) {
    ctx.strokeStyle = "#090e11"; ctx.lineWidth = 20;
    ctx.beginPath(); ctx.moveTo(-17, -59); ctx.lineTo(-21 - stride, -7); ctx.moveTo(17, -59); ctx.lineTo(21 + stride, -7); ctx.stroke();
    ctx.fillStyle = "#1d2a2f"; ctx.fillRect(-32 - stride, -16, 27, 12); ctx.fillRect(5 + stride, -16, 27, 12);
    ctx.fillStyle = "#0a1014"; ctx.beginPath(); ctx.roundRect(-47, -126, 94, 79, 16); ctx.fill();
    ctx.strokeStyle = "#405157"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-35, -120, 70, 61, 9); ctx.stroke();
    ctx.fillStyle = "#18262b"; ctx.fillRect(-29, -100, 25, 27); ctx.fillRect(5, -100, 25, 27); ctx.strokeStyle = "#526269"; ctx.lineWidth = 2; ctx.strokeRect(-29, -100, 25, 27); ctx.strokeRect(5, -100, 25, 27);
    ctx.strokeStyle = "#52615d"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-31, -122); ctx.lineTo(23, -57); ctx.stroke();
    ctx.fillStyle = "#b47d62"; ctx.beginPath(); ctx.arc(0, -151, 29, 0, TAU); ctx.fill();
    ctx.fillStyle = "#11191d"; ctx.beginPath(); ctx.arc(0, -157, 31, Math.PI, TAU); ctx.lineTo(27, -145); ctx.lineTo(-26, -145); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -184, 13, 0, TAU); ctx.fill(); ctx.fillRect(-7, -180, 14, 15);
    ctx.strokeStyle = "#0a1013"; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-37, -109); ctx.lineTo(-54, -77); ctx.stroke();
    ctx.fillStyle = "#080c0e"; ctx.beginPath(); ctx.roundRect(-61, -86, 21, 28, 6); ctx.fill();
    ctx.fillStyle = colors.orange; ctx.fillRect(35, -111, 5, 33);
  }

  function drawPlayerWeapon(angle) {
    ctx.save(); ctx.translate(13, -111); ctx.rotate(angle);
    ctx.strokeStyle = state.character === "augusto" ? "#1a3038" : "#090f12"; ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(32, 1); ctx.stroke();
    if (state.weapon === "Bazooka") {
      ctx.fillStyle = "#526a5e"; ctx.beginPath(); ctx.roundRect(19, -11, 91, 22, 8); ctx.fill(); ctx.fillStyle = colors.orange; ctx.fillRect(84, -12, 10, 24); ctx.fillStyle = "#17282a"; ctx.fillRect(28, 8, 18, 24);
    } else if (state.weapon === "Flamethrower") {
      ctx.fillStyle = "#3a5053"; ctx.beginPath(); ctx.roundRect(21, -10, 67, 20, 7); ctx.fill(); ctx.fillStyle = "#70898a"; ctx.fillRect(72, -7, 24, 14); ctx.fillStyle = colors.orange; ctx.fillRect(91, -5, 13, 10); ctx.fillStyle = "#17282b"; ctx.fillRect(31, 8, 16, 23);
    } else {
      const machine = state.weapon === "Machine Gun", length = machine ? 83 : 54;
      ctx.fillStyle = "#31474d"; ctx.beginPath(); ctx.roundRect(21, -7, length, 15, 5); ctx.fill(); ctx.fillStyle = colors.mint; ctx.fillRect(24, 5, length - 7, 3);
      ctx.fillStyle = "#111c20"; ctx.beginPath(); ctx.moveTo(33, 7); ctx.lineTo(50, 7); ctx.lineTo(45, 29); ctx.lineTo(34, 27); ctx.closePath(); ctx.fill();
      if (machine) { ctx.fillStyle = "#152329"; ctx.fillRect(52, 8, 17, 28); ctx.fillStyle = "#657c7d"; ctx.fillRect(72, -5, 19, 5); }
    }
    ctx.restore();
  }

  function loop(time) {
    raf = requestAnimationFrame(loop); const dt = Math.min(.034, Math.max(0,(time-lastTime)/1000)); lastTime=time;
    if(!state.running || state.paused) return;
    update(dt); drawWorld();
  }

  function aimAt(event) {
    const rect=canvas.getBoundingClientRect(), point=event.touches?.[0]||event;state.aimX=point.clientX-rect.left;state.aimY=point.clientY-rect.top;
    ui.crosshair.style.left=`${state.aimX}px`;ui.crosshair.style.top=`${state.aimY}px`;
    updateAimValidity();
  }

  function updateAimValidity() { ui.crosshair.classList.toggle("out-of-range", state.weapon === "Bazooka" && state.aimY > height * .61); }

  document.querySelectorAll(".character-card").forEach(card => card.addEventListener("click", () => {
    document.querySelectorAll(".character-card").forEach(c => { c.classList.remove("selected"); c.setAttribute("aria-checked","false"); });
    card.classList.add("selected");card.setAttribute("aria-checked","true");state.character=card.dataset.character;sfx("hit");
  }));
  ui.inventoryButtons.forEach(button => button.addEventListener("click", () => {
    if (state.paused && state.inventory.includes(button.dataset.weapon)) equip(button.dataset.weapon);
  }));
  ui.startButton.addEventListener("click", start);ui.pauseButton.addEventListener("click",()=>togglePause());ui.resumeButton.addEventListener("click",()=>togglePause(false));
  ui.quitButton.addEventListener("click",returnToMenu);ui.menuButton.addEventListener("click",returnToMenu);ui.retryButton.addEventListener("click",start);ui.bombButton.addEventListener("click",useBomb);
  canvas.addEventListener("pointermove",aimAt); canvas.addEventListener("pointerdown", aimAt);
  ui.fireButton.addEventListener("pointerdown",e=>{e.preventDefault();initAudio();state.fireHeld=true;shoot(state.aimX,state.aimY)});
  window.addEventListener("pointerup",()=>state.fireHeld=false);
  window.addEventListener("keydown",e=>{
    if(e.code==="Space"){e.preventDefault();state.fireHeld=true;shoot(state.aimX,state.aimY)}
    if((e.code==="ControlLeft"||e.code==="ControlRight")&&!e.repeat){e.preventDefault();useBomb()}
    if(["ArrowLeft","ArrowUp"].includes(e.code)&&!e.repeat){e.preventDefault();cycleWeapon(-1)}
    if(["ArrowRight","ArrowDown"].includes(e.code)&&!e.repeat){e.preventDefault();cycleWeapon(1)}
    if((e.key.toLowerCase()==="p"||e.code==="Escape")&&!e.repeat)togglePause();
  });
  window.addEventListener("keyup",e=>{if(e.code==="Space")state.fireHeld=false});
  window.addEventListener("blur",()=>{if(state.running&&!state.paused)togglePause(true)});window.addEventListener("resize",resize);
  resize();
})();
