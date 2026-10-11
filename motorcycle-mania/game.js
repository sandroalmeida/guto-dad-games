import { TRACK_GAP, SECTOR_NAMES, DIFFICULTIES, clamp, createGame, stepGame, meters } from "./logic.js";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#game");
const ctx = canvas.getContext("2d");
const W = 1280, RIDER_X = 246;
let H = 650, CENTER_Y = 363, viewZoom = 1, jumpQueued = 0;
const C = { ink: "#101b1e", orange: "#ff7846", teal: "#65e2c4", cream: "#ecede1", dim: "#668579" };
const ui = {
  screen: $("#screen"), intro: $("#intro"), pausePanel: $("#pause-panel"), overPanel: $("#over-panel"),
  fuel: $("#fuel-number"), fuelFill: $("#fuel-fill"), fuelCard: $("#fuel-card"), fuelNote: $("#fuel-note"),
  fuelMeter: $("#fuel-meter"), hearts: $("#hearts"), speed: $("#speed-number"), throttle: $("#throttle"),
  notice: $("#notice"), sector: $("#sector"), tracks: $("#track-count"), distance: $("#distance"), best: $("#best"),
  pause: $("#pause"), sound: $("#sound"), keys: [...document.querySelectorAll("[data-control]")],
  difficulties: [...document.querySelectorAll("[data-difficulty]")], modeDescription: $("#mode-description"),
  grip: $("#grip-status"), gripLabel: $("#grip-label"), gripTime: $("#grip-time"), gripFill: $("#grip-fill"),
};
const storedDifficulty = readStored("motorcycleMania.difficulty", "arcade");
let selectedDifficulty = Object.hasOwn(DIFFICULTIES, storedDifficulty) ? storedDifficulty : "arcade";
let game = createGame(42, selectedDifficulty), mode = "menu", clock = 0, lastFrame = performance.now();
let best = loadBest(selectedDifficulty);
let muted = readStored("motorcycleMania.muted", false);
let noticeTime = 0, shake = 0, flash = 0, particles = [], popups = [];
const held = { up: false, down: false, left: false, right: false };
const touch = { up: false, down: false, left: false, right: false };
const keyMap = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
for (let i = 0; i < 10; i++) $("#speed-bars").append(document.createElement("i"));
const bars = [...document.querySelectorAll("#speed-bars i")];

function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveStored(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ } }
function loadBest(difficulty) {
  const legacy = difficulty === "arcade" ? readStored("motorcycleMania.best", 0) : 0;
  const value = readStored(`motorcycleMania.best.${difficulty}`, legacy);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
function input() { return Object.fromEntries(Object.keys(held).map((k) => [k, held[k] || touch[k]])); }
function clearInput() {
  for (const k of Object.keys(held)) { held[k] = false; touch[k] = false; }
  jumpQueued = 0; game.player.jumpBuffer = null; refreshKeys();
}
function refreshKeys() { const current = input(); for (const key of ui.keys) key.classList.toggle("pressed", current[key.dataset.control]); }

addEventListener("keydown", (event) => {
  const direction = keyMap[event.code];
  if (direction) {
    event.preventDefault();
    if (mode === "playing") {
      held[direction] = true;
      if (!event.repeat && (direction === "up" || direction === "down")) jumpQueued = direction === "up" ? 1 : -1;
    }
    refreshKeys();
  }
  if (event.repeat) return;
  if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
    event.preventDefault();
    if (mode === "menu" || mode === "over") start();
    else if (mode === "paused") pause(false);
  }
  if (event.code === "KeyP" || event.code === "Escape") { event.preventDefault(); pause(mode === "playing"); }
  if (event.code === "KeyM") toggleSound();
});
addEventListener("keyup", (event) => { const dir = keyMap[event.code]; if (dir) { held[dir] = false; refreshKeys(); } });
addEventListener("blur", () => { clearInput(); if (mode === "playing") pause(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "playing") pause(true); });
for (const key of ui.keys) {
  key.addEventListener("pointerdown", (event) => {
    event.preventDefault(); if (mode !== "playing") return;
    const direction = key.dataset.control;
    touch[direction] = true;
    if (direction === "up" || direction === "down") jumpQueued = direction === "up" ? 1 : -1;
    key.setPointerCapture(event.pointerId); refreshKeys();
  });
  const release = () => { touch[key.dataset.control] = false; refreshKeys(); };
  key.addEventListener("pointerup", release); key.addEventListener("pointercancel", release); key.addEventListener("lostpointercapture", release);
}
$("#start").addEventListener("click", () => start());
$("#again").addEventListener("click", () => start());
$("#retry").addEventListener("click", () => start(game.seed, game.difficulty));
$("#resume").addEventListener("click", () => pause(false));
ui.pause.addEventListener("click", () => pause(mode === "playing"));
ui.sound.addEventListener("click", toggleSound);
for (const button of ui.difficulties) button.addEventListener("click", () => {
  if (mode !== "menu" && mode !== "over") return;
  selectedDifficulty = button.dataset.difficulty;
  saveStored("motorcycleMania.difficulty", selectedDifficulty);
  best = loadBest(selectedDifficulty);
  if (mode === "menu") game = createGame(game.seed, selectedDifficulty);
  syncHud(); refreshDifficulty();
});

function refreshDifficulty() {
  for (const button of ui.difficulties) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === selectedDifficulty));
    button.disabled = mode === "playing" || mode === "paused";
  }
  ui.modeDescription.textContent = DIFFICULTIES[selectedDifficulty].description;
}

function start(seed = (Math.random() * 2 ** 31) | 0, difficulty = selectedDifficulty) {
  clearInput(); audio.init();
  game = createGame(seed, difficulty); selectedDifficulty = game.difficulty;
  saveStored("motorcycleMania.difficulty", selectedDifficulty); best = loadBest(selectedDifficulty);
  mode = "playing"; particles = []; popups = []; shake = flash = 0;
  ui.screen.classList.add("hidden"); ui.pausePanel.classList.add("hidden"); ui.overPanel.classList.add("hidden");
  ui.pause.innerHTML = "Ⅱ <span>PAUSE</span>"; ui.pause.setAttribute("aria-label", "Pause game");
  lastFrame = performance.now();
  notice("LET’S RIDE!  ↑ ↓ JUMP · ← BRAKE · → GAS", false, 3.5);
  audio.tone(330, 660, 0.22, "square", 0.04); syncHud(); refreshDifficulty();
}
function pause(paused) {
  if (paused && mode === "playing") {
    clearInput(); mode = "paused";
    ui.screen.classList.remove("hidden"); ui.screen.classList.add("centered");
    ui.intro.classList.add("hidden"); ui.pausePanel.classList.remove("hidden"); ui.overPanel.classList.add("hidden");
    ui.pause.innerHTML = "▶ <span>RESUME</span>"; ui.pause.setAttribute("aria-label", "Resume game");
  } else if (!paused && mode === "paused") {
    mode = "playing"; ui.screen.classList.add("hidden"); ui.pausePanel.classList.add("hidden");
    ui.pause.innerHTML = "Ⅱ <span>PAUSE</span>"; ui.pause.setAttribute("aria-label", "Pause game");
    lastFrame = performance.now(); audio.init();
  }
}
function finish() {
  mode = "over"; clearInput();
  const distance = meters(game), record = distance > best;
  if (record) { best = distance; saveStored(`motorcycleMania.best.${game.difficulty}`, best); }
  $("#final-distance").textContent = `${distance.toLocaleString()} m`;
  $("#final-fuel").textContent = game.stats.bottles;
  $("#final-dodged").textContent = game.stats.dodged;
  $("#final-speed").textContent = `${Math.round(game.stats.topSpeed)} km/h`;
  const label = DIFFICULTIES[game.difficulty].label;
  $("#record-note").textContent = record ? `⚑ NEW ${label.toUpperCase()} BEST. NICE RIDING!` : `${label} best: ${best.toLocaleString()} m`;
  $("#course-code").textContent = `${label.toUpperCase()} · COURSE ${(game.seed >>> 0).toString(36).toUpperCase().padStart(6, "0")}`;
  $("#over-reason").textContent = game.reason === "fuel" ? "OUT OF FUEL. THE ROAD WINS THIS TIME." : "THREE LIVES. ONE BRILLIANT TRY.";
  ui.screen.classList.remove("hidden"); ui.screen.classList.add("centered");
  ui.intro.classList.add("hidden"); ui.pausePanel.classList.add("hidden"); ui.overPanel.classList.remove("hidden");
  noticeTime = 0; ui.notice.classList.remove("visible"); syncHud(); refreshDifficulty();
  audio.tone(220, 65, 0.7, "sawtooth", 0.05);
}
function toggleSound() {
  muted = !muted; saveStored("motorcycleMania.muted", muted); if (!muted) audio.init(); refreshSound();
}
function refreshSound() {
  ui.sound.innerHTML = `${muted ? "♪" : "♫"} <span>SOUND ${muted ? "OFF" : "ON"}</span>`;
  ui.sound.setAttribute("aria-label", `Turn sound ${muted ? "on" : "off"}`);
}
function notice(message, warning = false, duration = 2.5) {
  ui.notice.textContent = message; ui.notice.classList.toggle("warning", warning);
  ui.notice.classList.add("visible"); noticeTime = duration;
}
function syncHud() {
  const fuel = Math.ceil(game.fuel);
  ui.fuel.textContent = `${fuel}%`; ui.fuelFill.style.width = `${game.fuel}%`;
  ui.fuelMeter.setAttribute("aria-valuenow", fuel); ui.fuelCard.classList.toggle("low", game.fuel < 25);
  ui.fuelNote.textContent = game.fuel < 25 ? "LOW FUEL — FIND A TEAL BOTTLE!" : "GRAB THE TEAL FUEL BOTTLES";
  [...ui.hearts.children].forEach((heart, i) => heart.classList.toggle("lost", i >= game.lives));
  ui.hearts.setAttribute("aria-label", `${game.lives} lives remaining`);
  ui.speed.textContent = Math.round(game.speed); ui.throttle.textContent = game.surge ? "SPEED SURGE!" : game.throttle;
  bars.forEach((bar, i) => bar.classList.toggle("active", i < Math.round(game.speed / 32)));
  const surface = game.player.surface;
  ui.grip.classList.toggle("hidden", !surface || mode !== "playing");
  ui.grip.classList.toggle("oil", surface?.kind === "oil");
  const gripLabel = surface ? (surface.kind === "oil" ? "OIL · JUMPS LOCKED" : "WATER · SLOW HANDLING") : "";
  if (ui.gripLabel.textContent !== gripLabel) ui.gripLabel.textContent = gripLabel;
  ui.gripTime.textContent = surface ? `${surface.remaining.toFixed(1)}s` : "";
  ui.gripFill.style.width = surface ? `${surface.remaining / surface.duration * 100}%` : "0%";
  ui.distance.textContent = String(meters(game)).padStart(4, "0"); ui.best.textContent = `${best.toLocaleString()} m`;
  ui.tracks.textContent = `${game.laneCount} TRACKS`;
  ui.sector.textContent = `${String(game.section + 1).padStart(2, "0")} / ${SECTOR_NAMES[game.section % SECTOR_NAMES.length]}`;
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === "jump") { audio.tone(180, 420, 0.15, "sine", 0.045); }
    if (event.type === "fuel") {
      burst(RIDER_X, sy(game.player.y + 26), C.teal, 18);
      popups.push({ x: RIDER_X + 24, y: sy(game.player.y + 58), text: "+30 FUEL", color: C.teal, life: 1.2 });
      audio.tone(660, 1200, 0.15, "sine", 0.07);
    }
    if (event.type === "hurt") {
      shake = 0.5; flash = 0.25; burst(RIDER_X, sy(game.player.y + 23), C.orange, 32);
      notice(event.reason === "fuel" ? "EMPTY TANK! −1 LIFE · RESCUE FUEL ADDED" : "OUCH! −1 LIFE · KEEP GOING", true, 2.4);
      audio.noise(0.24, 0.08);
    }
    if (event.type === "track-warning") notice(`${event.count} TRACKS AHEAD · ${event.count < game.laneCount ? "GETTING CLOSER" : "OPENING UP"}`, true, 3);
    if (event.type === "tracks") notice(`${event.count} TRACKS · FIND YOUR NEW LINE`, false, 2);
    if (event.type === "surge-warning") notice("HOLD ON! SPEED SURGE AHEAD", true, 2);
    if (event.type === "surge") { notice("SPEED SURGE! · BRAKE IF YOU NEED TO", true, 3); audio.tone(140, 550, 0.5, "sawtooth", 0.025); }
    if (event.type === "low-fuel") { notice("LOW FUEL · GRAB A TEAL BOTTLE", true, 2.4); audio.tone(540, 540, 0.16, "triangle", 0.04); }
    if (event.type === "landing") burst(sx(event.x), sy(event.y - 18), "#b5aa83", 10);
    if (event.type === "surface") {
      burst(RIDER_X, sy(game.player.y), event.kind === "oil" ? "#c29bf3" : "#7acfff", 14);
      audio.noise(0.18, 0.025);
    }
    if (event.type === "blast-warning") audio.tone(600, 260, 0.18, "square", 0.025);
    if (event.type === "blast") {
      burst(sx(event.x), sy(event.y), C.orange, 26);
      popups.push({ x: sx(event.x), y: sy(event.y + 65), text: "BOOM!", color: C.orange, life: 0.7 });
      audio.noise(0.28, 0.055);
    }
    if (event.type === "over") finish();
  }
}

function sx(x) { return RIDER_X + x * viewZoom; }
function sy(y) { return CENTER_Y + ((game.viewCount - 1) * TRACK_GAP / 2 - y) * viewZoom; }
function rect(x, y, w, h, fill, radius = 0) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
function path(points, fill, stroke = null, width = 1) {
  ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(points, color, width = 1) { ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke(); }
function circle(x, y, r, fill, stroke = null, width = 1) { ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();} }
function text(value, x, y, size, color, font = "monospace", align = "left") { ctx.fillStyle=color;ctx.font=`700 ${size}px ${font}`;ctx.textAlign=align;ctx.fillText(value,x,y);ctx.textAlign="left"; }
function burst(x,y,color,count) { for(let i=0;i<count;i++) particles.push({x,y,vx:(Math.random()-.5)*250,vy:(Math.random()-.75)*180,life:.45+Math.random()*.5,max:1,color,size:2+Math.random()*4}); }

function drawBackdrop(travel) {
  const floor = sy(0) + 12 * viewZoom;
  const roof = sy((game.viewCount - 1) * TRACK_GAP + 82);
  const background = ctx.createLinearGradient(0,0,0,H); background.addColorStop(0,"#1c3032");background.addColorStop(.5,"#263b39");background.addColorStop(1,"#111f21");
  rect(0,0,W,H,background);
  ctx.save();ctx.beginPath();ctx.rect(0,roof,W,floor-roof);ctx.clip();
  // Distant pillars, windows, and utility pipes move more slowly than the road.
  const columnOffset = -(travel * .27 * viewZoom % 250);
  for(let x=columnOffset-250;x<W+250;x+=250){
    rect(x,roof,25,floor-roof,"#172a2b");rect(x+4,roof,4,floor-roof,"#35504a");
    rect(x+44,roof+26,150,58,"#0f2429",2);rect(x+49,roof+31,140,47,"#204746",1);
    for(let b=0;b<5;b++) rect(x+54+b*26,roof+36,15,34,b%3===0?"#4a7060":"#2b5754");
    rect(x+103,roof+30,4,49,"#142d30");
    line([[x+51,roof+100],[x+51,floor-38],[x+200,floor-38]],"#35524a",3);
    circle(x+51,floor-38,4,"#608574");
  }
  for(let lane=0;lane<game.laneCount;lane++) {
    const y=sy(lane*TRACK_GAP);
    rect(0,y-61*viewZoom,W,1,"#6b826a19");
    const glow = ctx.createLinearGradient(0,y-72*viewZoom,0,y);
    glow.addColorStop(0,"#081c2000");glow.addColorStop(1,"#07151b6b");rect(0,y-72*viewZoom,W,72*viewZoom,glow);
  }
  const signX = ((810-travel*.15) % 1450+1450)%1450-70;
  rect(signX,roof+116,152,58,"#283c36",3);line([[signX,roof+116],[signX+152,roof+116]],"#536a50",2);
  text("NIGHT SHIFT",signX+14,roof+139,16,"#607764");text("RIDE / 01  →",signX+15,roof+161,11,"#536955");
  ctx.restore();

  // Concrete ceiling and floor keep the sketch's enclosed track shape.
  rect(0,0,W,Math.max(0,roof),"#142629");
  for(let y=18;y<roof;y+=29) line([[0,y],[W,y]],"#2b4140",1);
  const beamOffset=-(travel*.65*viewZoom%224);
  for(let x=beamOffset-224;x<W+224;x+=224){
    path([[x,0],[x+24,0],[x+103,roof],[x+79,roof]],"#243c3b");
    line([[x+24,0],[x+103,roof]],"#36534a",2);
    rect(x+98,roof-17,77,5,"#192524",1);rect(x+101,roof-17,69,3,"#d1d590",1);
    const lampGlow=ctx.createRadialGradient(x+135,roof,0,x+135,roof,105);lampGlow.addColorStop(0,"#cfca6322");lampGlow.addColorStop(1,"#cfca6300");rect(x+30,roof-80,210,190,lampGlow);
  }
  rect(0,roof-7,W,7,"#4d634e");
  hazardStripe(roof-7,7,travel);
  rect(0,floor,W,H-floor,"#152526");
  for(let x=beamOffset-224;x<W+224;x+=224){
    path([[x,floor+3],[x+10,floor+3],[x-120,H],[x-134,H]],"#2e4640");
    line([[x+110,floor+4],[x+200,H]],"#203b35",1);
  }
  rect(0,floor,W,6,"#435646");hazardStripe(floor,6,travel);
  const floorGradient=ctx.createLinearGradient(0,floor,0,H);floorGradient.addColorStop(0,"#65e2c411");floorGradient.addColorStop(1,"#10212100");rect(0,floor+8,W,H-floor-8,floorGradient);
}

function hazardStripe(y,height,travel) {
  ctx.save();ctx.beginPath();ctx.rect(0,y,W,height);ctx.clip();
  for(let x=-(travel*viewZoom%48)-48;x<W+48;x+=48) path([[x,y],[x+20,y],[x+12,y+height],[x-8,y+height]],"#b29243");
  ctx.restore();
}
function drawTracks(travel) {
  for(let lane=0;lane<game.laneCount;lane++){
    if(lane>game.viewCount-.05) continue;
    const y=sy(lane*TRACK_GAP);
    rect(0,y,W,12*viewZoom,"#111e21");rect(0,y,W,2*viewZoom,"#74927c");
    rect(0,y+3*viewZoom,W,2*viewZoom,"#293f38");
    const spacing=140*viewZoom, offset=-(travel*viewZoom%spacing);
    for(let x=offset-spacing;x<W+spacing;x+=spacing){
      rect(x,y+6*viewZoom,45*viewZoom,2*viewZoom,"#48634c");
      rect(x+73*viewZoom,y+2*viewZoom,4*viewZoom,7*viewZoom,"#375146");
      rect(x+11*viewZoom,y-3*viewZoom,26*viewZoom,2*viewZoom,"#d4c48b55");
    }
    rect(W-55,y-34*viewZoom,35,23,"#162828cc",3);
    text(String(lane+1).padStart(2,"0"),W-38,y-18*viewZoom,11,"#6e9985","monospace","center");
  }
}

function drawBike(x,y,scale,pose=0) {
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  ctx.fillStyle="#0007";ctx.beginPath();ctx.ellipse(0,3,60,5,0,0,Math.PI*2);ctx.fill();
  ctx.rotate(pose);
  // Headlamp, chain, suspension, and spinning spoked wheels.
  const lamp=ctx.createLinearGradient(40,-32,195,-32);lamp.addColorStop(0,"#efe9b425");lamp.addColorStop(1,"#efe9b400");
  path([[43,-36],[190,-72],[190,12],[43,-28]],lamp);
  for(const wx of [-31,34]){
    circle(wx,-15,15,"#10191c","#4c645b",3);circle(wx,-15,10,"#172b2e","#91a997",1.6);
    for(let i=0;i<6;i++){const a=clock*game.speed*.08+i*Math.PI/3;line([[wx,-15],[wx+Math.cos(a)*9,-15+Math.sin(a)*9]],"#6d8f84",1);}
    circle(wx,-15,3,C.orange);
  }
  line([[-31,-15],[-12,-37],[5,-17],[-31,-15]],C.orange,4);
  line([[-12,-37],[16,-37],[5,-17]],"#afded0",3);
  line([[22,-47],[34,-15]],"#d0dbd0",4);line([[18,-49],[32,-51]],C.orange,3);
  line([[-30,-19],[-20,-40]],"#93b4a3",3);
  rect(-9,-27,22,12,"#708d83",3);rect(-5,-25,14,2,"#b0bba3",1);rect(-5,-21,14,2,"#3a534a",1);
  line([[5,-18],[24,-15],[31,-19]],"#809b88",3);
  path([[-26,-40],[-18,-48],[8,-48],[21,-40],[14,-33],[-8,-33]],C.orange,C.ink,2);
  path([[9,-48],[20,-52],[30,-49],[35,-40],[20,-40]],C.cream,C.ink,2);
  rect(-30,-49,29,6,"#0f2124",2);line([[-39,-39],[-22,-41]],C.orange,5);
  path([[22,-35],[38,-36],[47,-30],[24,-30]],C.orange,C.ink,1);
  rect(36,-43,10,6,"#fff4b4",2);rect(-38,-40,5,4,"#ff5d47",1);
  // Rider: dark jacket, orange racing stripe, cream helmet, teal visor.
  line([[-11,-47],[1,-35],[-5,-24],[8,-22]],"#1b2c31",10);
  line([[-11,-47],[1,-35],[-5,-24]],"#65807a",3);
  line([[8,-22],[16,-22]],C.cream,4);
  path([[-15,-49],[-21,-65],[-9,-73],[3,-58],[0,-48]],"#203d40",C.ink,2);
  path([[-18,-62],[-13,-65],[1,-50],[-4,-48]],C.orange);
  line([[-8,-66],[9,-54],[24,-51]],"#365a56",8);line([[9,-54],[24,-51]],"#86b4a3",3);
  circle(24,-51,3,C.cream);
  ctx.save();ctx.translate(-7,-78);ctx.rotate(.22);
  circle(0,0,12,C.cream,C.ink,2);
  path([[0,-10],[10,-5],[13,2],[-2,1],[-6,-2]],"#213b40",C.ink,1);
  line([[0,-3],[10,-2]],C.teal,3);
  path([[-9,-8],[-6,-11],[-1,-12],[2,-10],[0,8],[-5,8]],C.orange);
  ctx.restore();
  ctx.restore();
}

function drawFuel(e) {
  const x=sx(e.x),y=sy(e.y);
  ctx.save();ctx.translate(x,y);ctx.scale(viewZoom,viewZoom);
  const glow=ctx.createRadialGradient(0,0,1,0,0,48);glow.addColorStop(0,"#65e2c44a");glow.addColorStop(1,"#65e2c400");rect(-48,-48,96,96,glow);
  ctx.save();ctx.rotate(Math.sin(clock*3+e.id)*.06);
  rect(-15,-18,29,35,"#248e7c",4);line([[-13,-16],[11,-16]],"#acffe4",2);
  rect(-7,-28,15,12,"#248e7c",2);rect(-4,-25,9,6,C.ink,1);rect(6,-27,9,5,C.cream,1);
  path([[-1,-10],[-8,3],[-1,3],[-4,12],[8,-2],[1,-2],[4,-10]],"#e0ffe9");
  line([[-11,-10],[-11,10]],"#69d9b5",2);ctx.restore();
  circle(0,0,29,null,"#65e2c455",1);
  text("FUEL",0,-39,9,C.teal,"monospace","center");ctx.restore();
}
function drawCar() {
  ctx.fillStyle="#0005";ctx.beginPath();ctx.ellipse(0,21,49,6,0,0,Math.PI*2);ctx.fill();
  for(const wx of [-26,27]){circle(wx,12,11,"#111d20","#69715f",2);circle(wx,12,5,"#343b34");}
  path([[-44,6],[-39,-9],[-24,-12],[-17,-29],[13,-30],[27,-12],[42,-7],[45,9],[31,13],[-35,13]],"#857b55",C.ink,3);
  path([[-18,-25],[-22,-12],[-4,-12],[-4,-25]],"#294342");path([[1,-25],[11,-25],[21,-12],[1,-12]],"#253e3b");
  line([[-1,-8],[-1,10]],"#59553c",2);rect(-4,-6,7,2,"#c0ae74",1);
  line([[-38,2],[-13,1],[-6,7]],"#5b5540",3);line([[15,2],[32,-2],[33,6]],"#ac9262",2);
  rect(36,-5,7,6,"#d5bd77",1);rect(-44,-3,5,5,"#bb684e",1);line([[-43,10],[43,10]],"#506659",3);
  path([[-20,2],[-14,5],[-20,8],[-29,6]],"#a45e3e");path([[23,7],[29,3],[37,5],[34,9]],"#a45e3e");
}
function drawWheel(e) {
  ctx.save();ctx.rotate(-clock*7-e.x*.025);circle(0,0,22,"#0b171c","#72857b",2);circle(0,0,15,"#30433e","#bed0b1",2);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;line([[0,0],[Math.cos(a)*14,Math.sin(a)*14]],"#839588",3);}
  circle(0,0,5,"#bdaa75");ctx.restore();
  line([[29,-8],[45,-8]],"#91baa665",2);line([[29,5],[51,5]],"#91baa640",2);
}
function drawBarrel(fire=false) {
  if(fire){
    const glow=ctx.createRadialGradient(0,-18,0,0,-18,62);glow.addColorStop(0,"#ffae3645");glow.addColorStop(1,"#ffae3600");rect(-62,-80,124,124,glow);
    for(let i=0;i<5;i++) {
      const x=(i-2)*7,h=25+Math.sin(clock*13+i*3)*9;
      path([[x-9,-15],[x-8,-33],[x+Math.sin(clock*9+i)*5,-35-h],[x+8,-29],[x+8,-15]],i%2?"#ffca5a":"#ff8643");
    }
    path([[-7,-15],[0,-48],[8,-15]],"#ffe498");
  }
  rect(-18,-18,36,40, "#a86342",5);rect(-16,-15,32,5,"#d59c62",1);rect(-17,9,34,5,"#3a3b33",1);
  line([[-10,-9],[-10,7]],"#d59c62",2);line([[9,-8],[9,8]],"#80482e",2);
  path([[-6,-4],[5,-4],[7,5],[-8,5]],"#d5ab6c");text("!",0,5,10,"#79482c","monospace","center");
  ctx.beginPath();ctx.ellipse(0,-18,16,4,0,0,Math.PI*2);ctx.fillStyle="#784932";ctx.fill();
}
function drawSpill(e) {
  const water = e.kind === "water";
  ctx.save();ctx.translate(sx(e.x),sy(e.lane*TRACK_GAP+2));ctx.scale(viewZoom,viewZoom);
  const glow=ctx.createRadialGradient(0,0,2,0,0,65);
  glow.addColorStop(0,water?"#7acfff33":"#d3a8ff33");glow.addColorStop(1,"#7acfff00");rect(-65,-45,130,90,glow);
  ctx.beginPath();ctx.ellipse(0,-3,50,9,0,0,Math.PI*2);ctx.fillStyle=water?"#3a90b0":"#171523";ctx.fill();
  ctx.strokeStyle=water?"#8addff":"#d3a8ff";ctx.lineWidth=2;ctx.stroke();
  for(let i=0;i<3;i++) line([[-32+i*22,-4],[-19+i*22,-4+Math.sin(clock*4+i)*2]],water?"#c6f3ff":"#aa75bb",2);
  // Keep hazard names legible even when the camera pulls back to ten tracks.
  ctx.restore();text(water?"WATER":"OIL",sx(e.x),sy(e.lane*TRACK_GAP+22),10,water?"#7acfff":"#d3a8ff","monospace","center");
}
function drawLauncher(e) {
  if(e.rising) {
    for(let i=0;i<3;i++) path([[-10+i*9,18],[-6+i*9,60+Math.sin(clock*22+i)*12],[2+i*9,18]],i%2?"#ffdb75":"#ff7846");
    ctx.rotate(clock*4);drawBarrel();
  } else {
    const glow=ctx.createRadialGradient(0,0,3,0,0,65);
    glow.addColorStop(0,e.armed?"#ff784688":"#ff784633");glow.addColorStop(1,"#ff784600");rect(-65,-65,130,130,glow);
    drawBarrel();rect(-13,-10,26,4,"#ff653f",1);
    line([[4,-20],[7,-34],[13,-37]],"#e4c58c",2);
    circle(13,-37,3+Math.sin(clock*30)*1.5,"#ffe69a");
  }
}
function drawEntity(e) {
  if(e.kind==="fuel") {drawFuel(e);return;}
  const x=sx(e.x),y=sy(e.y);
  if(x < -130 || x>W+180) return;
  if(e.kind==="water" || e.kind==="oil") {drawSpill(e);return;}
  if(e.kind==="blast" && e.armed) {
    const top=sy((game.viewCount-1)*TRACK_GAP+80),bottom=sy(0);
    rect(x-25*viewZoom,top,50*viewZoom,bottom-top,"#ff784620");
    ctx.save();ctx.setLineDash([5,7]);line([[x,bottom],[x,top]],"#ffb56f88",1.5);ctx.restore();
    if(!e.rising){text("↑",x,y-45*viewZoom,22,C.orange,"monospace","center");text("HOT BARREL!",x,y-75*viewZoom,10,C.orange,"monospace","center");}
  }
  if(e.kind==="fall" && e.armed && !e.landed) {
    const bottom=sy(e.lane*TRACK_GAP);
    rect(x-23*viewZoom,sy((game.laneCount-1)*TRACK_GAP+80),46*viewZoom,bottom-sy((game.laneCount-1)*TRACK_GAP+80),"#ff784618");
    ctx.save();ctx.setLineDash([5,7]);line([[x,bottom],[x,Math.max(20,y)]],"#ff78466b",1.5);ctx.restore();
    if(e.warning>0){text("▼",x,y-32*viewZoom,19,C.orange,"monospace","center");text("LOOK UP!",x,y-51*viewZoom,10,C.orange,"monospace","center");}
  }
  ctx.save();ctx.translate(x,y);ctx.scale(viewZoom,viewZoom);
  if(e.kind==="car") drawCar();
  if(e.kind==="wheel") drawWheel(e);
  if(e.kind==="fire") drawBarrel(true);
  if(e.kind==="fall") {ctx.rotate(e.falling&&!e.landed?clock*3:0);drawBarrel();}
  if(e.kind==="blast") drawLauncher(e);
  ctx.restore();
}

function draw() {
  // Fit the whole tunnel during large zoom changes and short desktop windows.
  viewZoom=Math.min(game.zoom,(H-70)/((game.viewCount-1)*TRACK_GAP+100));
  const halfTracks=(game.viewCount-1)*TRACK_GAP/2;
  CENTER_Y=clamp(H*.56,(halfTracks+82)*viewZoom+22,H-(halfTracks+12)*viewZoom-22);
  ctx.setTransform(canvas.width/W,0,0,canvas.width/W,0,0);
  ctx.clearRect(0,0,W,H);ctx.save();
  if(shake>0) ctx.translate(Math.sin(clock*90)*shake*11,Math.cos(clock*101)*shake*7);
  const travel=mode==="menu"?clock*80:game.distance;
  drawBackdrop(travel);drawTracks(travel);
  if(mode==="playing") {
    const intensity=clamp((game.speed-65)/170,0,1);
    for(let i=0;i<10;i++) {
      const x=((i*167-clock*game.speed*4)%W+W)%W,y=18+(i*71)%(H-35);
      line([[x,y],[x+18+intensity*35,y]],`rgba(176,218,209,${0.025+intensity*0.055})`,1);
    }
  }
  if(mode==="menu") {
    drawEntity({kind:"fire",x:550,lane:2,y:2*TRACK_GAP+22,id:5});
    drawEntity({kind:"wheel",x:830,lane:1,y:TRACK_GAP+22,id:6});
    drawFuel({kind:"fuel",x:490,y:22,id:7});
    drawEntity({kind:"water",x:710,lane:1,y:TRACK_GAP+2,id:8});
    drawEntity({kind:"blast",x:620,lane:0,y:22,id:9,armed:true,warning:0.65});
    drawBike(940,sy(0)-3,2.1,Math.sin(clock*4)*.01);
    text("READY TO ROLL?",1000,sy(0)+65,11,"#799987","monospace","center");
  } else {
    [...game.entities].sort((a,b)=>b.y-a.y).forEach(drawEntity);
    const p=game.player;
    const jumping=p.jump&&!p.jump.transfer;
    if(p.invulnerable>0) {
      const shield=ctx.createRadialGradient(RIDER_X,sy(p.y+30),10,RIDER_X,sy(p.y+30),74*viewZoom);
      shield.addColorStop(0,"#65e2c41a");shield.addColorStop(1,"#65e2c400");rect(RIDER_X-100*viewZoom,sy(p.y+30)-100*viewZoom,200*viewZoom,200*viewZoom,shield);
    }
    ctx.save();if(p.invulnerable>0 && Math.sin(clock*28)<0) ctx.globalAlpha=.45;
    drawBike(RIDER_X,sy(p.y+p.lift)-1+(!p.jump?Math.sin(clock*game.speed*.28)*.7:0),viewZoom,jumping?(p.jump.to>p.jump.from?-.10:.09):0);ctx.restore();
    if(mode==="playing"&&!p.jump){
      for(let i=0;i<3;i++){const x=RIDER_X-50*viewZoom-i*15;line([[x,sy(p.y)-7],[x-10,sy(p.y)-7]],"#c1b48022",2);}
    }
    if(p.invulnerable>0) text("RECOVERING",RIDER_X,sy(p.y+112),10,C.teal,"monospace","center");
  }
  for(const p of particles) rect(p.x,p.y,p.size,p.size,p.color,1);
  for(const p of popups){ctx.globalAlpha=clamp(p.life,0,1);text(p.text,p.x,p.y,14,p.color,"monospace","center");ctx.globalAlpha=1;}
  if(game.surge && mode!=="menu"){
    for(let i=0;i<16;i++){const x=((i*117-clock*750)%W+W)%W,y=45+(i*43)%560;line([[x,y],[x+46,y]],"#ffb07c22",1.5);}
    text("SURGE",W-25,40,13,C.orange,"monospace","right");
  }
  ctx.restore();
  if(flash>0) rect(0,0,W,H,`rgba(255,110,65,${flash*.6})`);
}

const audio = {
  context: null, engine: null, gain: null,
  init() {
    try {
      if(!this.context) {
        this.context=new (window.AudioContext||window.webkitAudioContext)();
        this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);
        this.engine=this.context.createOscillator();this.engine.type="sawtooth";
        const filter=this.context.createBiquadFilter();filter.type="lowpass";filter.frequency.value=200;
        this.engine.connect(filter);filter.connect(this.gain);this.engine.start();
      }
      this.context.resume().catch(()=>{});
    } catch { /* The game remains playable without audio. */ }
  },
  update() {
    if(!this.context||!this.engine) return;
    const t=this.context.currentTime;
    this.engine.frequency.setTargetAtTime(30+game.speed*.55+Math.sin(clock*25)*2,t,.1);
    this.gain.gain.setTargetAtTime(!muted&&mode==="playing"?.012:0,t,.08);
  },
  tone(from,to,duration,type="sine",volume=.04) {
    if(muted||!this.context) return;
    const t=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(Math.max(to,1),t+duration);
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(this.context.destination);osc.start(t);osc.stop(t+duration);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  },
  noise(duration,volume) {
    if(muted||!this.context) return;
    const buffer=this.context.createBuffer(1,this.context.sampleRate*duration,this.context.sampleRate);
    const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=volume;
    source.connect(gain);gain.connect(this.context.destination);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};
  },
};
function resize() {
  const bounds=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(bounds.width*ratio));canvas.height=Math.max(1,Math.round(bounds.height*ratio));
  H=canvas.height/canvas.width*W;CENTER_Y=H*.56;draw();
}
new ResizeObserver(resize).observe(canvas);
function frame(now) {
  const dt=Math.min((now-lastFrame)/1000,.075);lastFrame=now;clock+=dt;
  if(mode==="playing") {
    const controls=input();
    if(jumpQueued) controls.jump=jumpQueued;
    jumpQueued=0;
    handleEvents(stepGame(game,controls,dt));
    noticeTime=Math.max(0,noticeTime-dt);if(noticeTime===0)ui.notice.classList.remove("visible");
    shake=Math.max(0,shake-dt);flash=Math.max(0,flash-dt);
    particles=particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=230*dt;return p.life>0;});
    popups=popups.filter(p=>{p.life-=dt;p.y-=35*dt;return p.life>0;});
    syncHud();
  }
  audio.update();draw();requestAnimationFrame(frame);
}
// Small inspection hook for reproducible local playtests.
window.__motorcycleMania={get state(){return game;},get mode(){return mode;},start,pause};
refreshSound();refreshDifficulty();syncHud();resize();requestAnimationFrame(frame);
