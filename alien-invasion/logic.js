// Deterministic rules. World coordinates, inventory, and time never depend on the renderer.
export const WORLD = { width: 960, height: 1060, homeX: 480, homeY: 995 };
export const PREP_SECONDS = 5;
export const THREAT_SECONDS = 30;
export const SUPPLY_SECONDS = 10;
export const WEAPONS = {
  sniper: { name: 'Sniper', label: 'Precision railgun', ammo: 5, range: 265, interval: 1.65, damage: 135, color: '#e5ac4d', description: 'Long reach. Five heavy shots. Picks out the toughest ship in sight.' },
  blaster: { name: 'Blaster', label: 'Laser bazooka', ammo: 3, range: 215, interval: 2.1, damage: 120, radius: 112, color: '#ed806b', description: 'Three laser rockets. Explodes on impact and catches nearby ships.' },
  cannon: { name: 'Light cannon', label: 'Rapid laser gun', ammo: 32, range: 185, interval: .18, damage: 14, color: '#63aaa0', description: '32 quick laser shots. A steady stream of fire against passing ships.' },
  bomb: { name: 'Bomb', label: 'Proximity blast', ammo: 1, range: 76, interval: 0, damage: 300, radius: 145, color: '#b090d3', description: 'One big explosion. Arms on its pad and triggers when a ship gets close.' },
};
export const SHIPS = {
  saucer: { name: 'Scout saucer', hp: 84, speed: 34, size: 23, score: 10 },
  dart: { name: 'Needle scout', hp: 42, speed: 52, size: 17, score: 15 },
  cruiser: { name: 'Armored cruiser', hp: 255, speed: 26, size: 31, score: 30 },
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function random(s) { let n = s.rng = (s.rng + 0x6d2b79f5) | 0; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; }
export function hash(n) { return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1; }
export function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function curve(a, b, c, d, t) { const u = 1 - t; return u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d; }
export function sampledPath(start, curves) {
  const points = [{ x: start[0], y: start[1], d: 0 }]; let a = start, total = 0;
  for (const c of curves) {
    for (let i = 1; i <= 32; i++) {
      const t = i / 32, x = curve(a[0], c[0], c[2], c[4], t), y = curve(a[1], c[1], c[3], c[5], t);
      total += Math.hypot(x - points.at(-1).x, y - points.at(-1).y);
      points.push({ x, y, d: total });
    }
    a = [c[4], c[5]];
  }
  return { points, length: total };
}
export function at(path, d) {
  d = clamp(d, 0, path.length); let lo = 0, hi = path.points.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (path.points[mid].d < d) lo = mid + 1; else hi = mid; }
  const b = path.points[lo], a = path.points[Math.max(0, lo - 1)], t = (d - a.d) / (b.d - a.d || 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
function atY(path, y) { return path.points.reduce((a, b) => Math.abs(a.y - y) < Math.abs(b.y - y) ? a : b); }
export function makeLane(id, version = 0, seed = 1) {
  const x = 100 + id * 190, bend = (hash(seed + id * 17 + version * 73) - .5) * 52;
  const upperY = 280 + Math.round((hash(seed + id * 13 + version * 9) - .5) * 62);
  const lowerY = 625 + Math.round((hash(seed + id * 31 + version * 19) - .5) * 86);
  const exitX = WORLD.homeX + (id - 2) * 20;
  const path = sampledPath([x, 54], [
    [x - 24, 122, x + 38 + bend, 167, x + bend, upperY],
    [x + bend - 28, upperY + 110, x - bend + 30, 400, x - bend, 464],
    [x - bend - 22, 520, x + bend + 25, lowerY - 90, x + bend * .4, lowerY],
    [x + bend * .4 - 35, lowerY + 90, x + 20, 802, x, 846],
    [x, 913, exitX, 936, exitX, 985],
  ]);
  const chambers = [
    { ...atY(path, upperY), rx: 69, ry: 73, capacity: version % 3 === 2 ? 3 : 2 },
    { ...atY(path, lowerY), rx: 72, ry: 78, capacity: (version + id) % 3 === 1 ? 2 : 3 },
  ];
  const slots = [];
  for (let ci = 0; ci < chambers.length; ci++) {
    const c = chambers[ci];
    const positions = c.capacity === 2 ? [[-33, -12], [33, 20]] : [[-34, -25], [34, 0], [-23, 37]];
    for (let si = 0; si < positions.length; si++) slots.push({ id: `${id}:${version}:${ci}:${si}`, laneId: id, x: c.x + positions[si][0], y: c.y + positions[si][1], chamber: ci });
  }
  const reserve = atY(path, 822);
  slots.push({ id: `${id}:${version}:reserve`, laneId: id, x: reserve.x + (id % 2 ? -22 : 22), y: reserve.y, chamber: -1 });
  return { id, version, x, path, chambers, slots, retiring: false, opened: 0 };
}
export function allSlots(s) { return s.lanes.flatMap(l => l.slots); }
export function ammoCount(s, type) { return s.inventory[type].length; }
export function nextSupply(s) {
  const types = ['cannon', 'sniper', 'blaster', 'cannon', 'bomb', 'blaster'];
  const n = s.deliveries, list = [types[n % types.length], types[(n + 2) % types.length]];
  if (s.level >= 3 && n % 2 === 0) list.push(types[(n + 4) % types.length]);
  return list;
}
export function createGame(seed = 1) {
  const s = { seed: seed >>> 0, rng: seed | 0, time: 0, prep: PREP_SECONDS, level: 1, lanes: [], enemies: [], towers: [], projectiles: [], effects: [], inventory: { sniper: [], blaster: [], cannon: [], bomb: [] }, nextId: 1, spawnIn: 1.1, supplyIn: SUPPLY_SECONDS, deliveries: 0, nextMapAt: 30, mapCycle: 0, warning: null, retiring: null, connectors: [], kills: 0, score: 0, placed: 0, spent: 0, over: false, breach: null };
  s.lanes = [0, 2, 4].map(id => makeLane(id, 0, seed));
  for (const [type, count] of Object.entries({ sniper: 2, blaster: 4, cannon: 2, bomb: 2 })) for (let i = 0; i < count; i++) s.inventory[type].push(WEAPONS[type].ammo);
  return s;
}
export function placeWeapon(s, slotId, type, events = []) {
  if (s.over || !WEAPONS[type]) return false;
  const slot = allSlots(s).find(p => p.id === slotId), lane = slot && s.lanes.find(l => l.id === slot.laneId);
  if (!slot || lane.retiring || s.towers.some(t => t.slotId === slotId) || !s.inventory[type].length) return false;
  const ammo = s.inventory[type].shift();
  s.towers.push({ ...slot, id: s.nextId++, slotId, type, ammo, maxAmmo: WEAPONS[type].ammo, cooldown: .35, angle: -Math.PI / 2, recoil: 0 });
  s.placed++; events.push({ type: 'place', x: slot.x, y: slot.y, weapon: type }); return true;
}
export function isInTunnel(lane, x, y, margin = 0) {
  if (lane.chambers.some(c => ((x - c.x) / (c.rx + margin)) ** 2 + ((y - c.y) / (c.ry + margin)) ** 2 <= 1)) return true;
  return lane.path.points.some(p => Math.hypot(p.x - x, p.y - y) <= 39 + margin);
}
function visibleTo(s, tower, enemy) {
  // Walls stop direct fire. A chamber and its connected, curving passage count as one firing region.
  if (tower.laneId !== enemy.laneId) return false;
  const lane = s.lanes.find(l => l.id === tower.laneId);
  if (!lane) return false;
  for (let i = 1; i <= 7; i++) { const t = i / 8; if (!isInTunnel(lane, tower.x + (enemy.x - tower.x) * t, tower.y + (enemy.y - tower.y) * t, 8)) return false; }
  return true;
}
function damage(s, enemy, amount, events) {
  if (enemy.dead) return;
  enemy.hp -= amount; enemy.hit = .13;
  if (enemy.hp <= 0) { enemy.dead = true; s.kills++; s.score += SHIPS[enemy.type].score; events.push({ type: 'kill', x: enemy.x, y: enemy.y, ship: enemy.type }); }
}
function blast(s, x, y, laneId, amount, radius, events, weapon) {
  // Blast is local to the passage; it cannot travel through rock into the next tunnel.
  for (const e of s.enemies) if (!e.dead && e.laneId === laneId && distance(e, { x, y }) <= radius) damage(s, e, amount * (1 - .3 * distance(e, { x, y }) / radius), events);
  events.push({ type: 'blast', x, y, radius, weapon });
}
export function spawnEnemy(s, laneId, type = 'saucer', events = []) {
  const lane = s.lanes.find(l => l.id === laneId);
  if (!lane || lane.retiring || !SHIPS[type]) return null;
  const spec = SHIPS[type], growth = Math.max(0, s.level - 2);
  const e = { id: s.nextId++, laneId, type, d: 0, ...at(lane.path, 0), hp: spec.hp * (1 + growth * .055), maxHp: spec.hp * (1 + growth * .055), speed: spec.speed * (1 + .045 * Math.min(s.level - 1, 12)), hit: 0, dead: false, branchChecked: false, connector: null, phase: random(s) * 6.28 };
  s.enemies.push(e); events.push({ type: 'spawn', x: e.x, y: e.y, ship: type }); return e;
}
function rebuildConnectors(s) {
  const lanes = [...s.lanes].filter(l => !l.retiring).sort((a, b) => a.id - b.id);
  s.connectors = [];
  if (s.level < 3) return;
  const index = Math.floor(s.mapCycle / 2) % (lanes.length - 1), a = lanes[index], b = lanes[index + 1];
  if (!a || !b || b.id - a.id > 1) return;
  const start = atY(a.path, 430), end = atY(b.path, 532);
  const path = sampledPath([start.x, start.y], [[start.x + 65, start.y + 15, end.x - 60, end.y - 15, end.x, end.y]]);
  s.connectors.push({ from: a.id, to: b.id, startD: start.d, endD: end.d, path });
}
function plannedChange(s) {
  const options = [['add', 1], ['add', 3], ['morph', 0], ['remove', 1], ['add', 1], ['morph', 4], ['remove', 3], ['add', 3], ['morph', 2]];
  const [action, id] = options[s.mapCycle % options.length];
  const exists = s.lanes.some(l => l.id === id);
  return { action: action === 'add' && exists ? 'morph' : action === 'remove' && (!exists || s.lanes.length <= 3) ? 'morph' : action, id: exists || action === 'add' ? id : s.lanes[0].id };
}
function updateMap(s, events) {
  if (!s.warning && !s.retiring && s.time >= s.nextMapAt - 8) {
    s.warning = { ...plannedChange(s), at: s.nextMapAt };
    events.push({ type: 'map-warning', ...s.warning });
  }
  if (s.warning && s.time >= s.warning.at) {
    const change = s.warning; s.warning = null; s.mapCycle++;
    if (change.action === 'add') {
      const lane = makeLane(change.id, s.mapCycle, s.seed); lane.opened = s.time; s.lanes.push(lane);
      // A new entrance always brings tools to cover it, independently of the regular supply clock.
      s.inventory.cannon.push(WEAPONS.cannon.ammo); s.inventory.blaster.push(WEAPONS.blaster.ammo);
      events.push({ type: 'map-open', id: change.id }); rebuildConnectors(s);
    } else {
      s.retiring = change; const lane = s.lanes.find(l => l.id === change.id); if (lane) lane.retiring = true;
      rebuildConnectors(s);
    }
    s.nextMapAt += 30;
  }
  if (s.retiring) {
    const id = s.retiring.id;
    const occupied = s.enemies.some(e => !e.dead && (e.laneId === id || e.connector?.to === id));
    const rockets = s.projectiles.some(p => p.laneId === id);
    if (!occupied && !rockets) {
      const lane = s.lanes.find(l => l.id === id);
      for (const t of s.towers.filter(t => t.laneId === id)) if (t.ammo > 0) s.inventory[t.type].push(t.ammo);
      s.towers = s.towers.filter(t => t.laneId !== id); s.lanes = s.lanes.filter(l => l.id !== id);
      if (s.retiring.action === 'morph') { const next = makeLane(id, (lane?.version || 0) + 1, s.seed); next.opened = s.time; s.lanes.push(next); }
      events.push({ type: 'map-change', id, action: s.retiring.action }); s.retiring = null; rebuildConnectors(s);
      s.nextMapAt = Math.max(s.nextMapAt, s.time + 15);
    }
  }
}
function spawnWave(s, events) {
  const lanes = s.lanes.filter(l => !l.retiring && s.time - l.opened >= 2);
  if (!lanes.length || s.enemies.length >= 55) return;
  const n = 1 + (s.level >= 3 && random(s) < Math.min(.65, .16 + s.level * .035) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const lane = lanes[Math.floor(random(s) * lanes.length)], r = random(s);
    const type = s.level >= 3 && r < Math.min(.36, .10 + s.level * .018) ? 'cruiser' : s.level >= 2 && r > .65 ? 'dart' : 'saucer';
    const e = spawnEnemy(s, lane.id, type, events); if (e && i) e.d = -45;
  }
}
function updateEnemies(s, dt, events) {
  for (const e of s.enemies) {
    if (e.dead) continue; e.hit = Math.max(0, e.hit - dt);
    const lane = s.lanes.find(l => l.id === e.laneId); if (!lane) continue;
    if (e.connector) {
      e.connector.d += e.speed * dt; Object.assign(e, at(e.connector.path, e.connector.d));
      if (e.connector.d >= e.connector.path.length) { e.laneId = e.connector.to; e.d = e.connector.endD; e.connector = null; }
    } else {
      const before = e.d; e.d += e.speed * dt; Object.assign(e, at(lane.path, e.d));
      if (!e.branchChecked) {
        const c = s.connectors.find(c => c.from === e.laneId && before < c.startD && e.d >= c.startD);
        if (c) {
          e.branchChecked = true;
          const defense = id => s.towers.filter(t => t.laneId === id && t.y > e.y && t.ammo).reduce((v, t) => v + t.ammo * WEAPONS[t.type].damage, 0);
          if (defense(c.to) < defense(c.from) || random(s) < .3) e.connector = { ...c, d: 0 };
        }
      }
    }
  }
}
function updateWeapons(s, dt, events) {
  for (const t of s.towers) {
    t.cooldown = Math.max(0, t.cooldown - dt); t.recoil = Math.max(0, t.recoil - dt * 5);
    if (t.ammo <= 0) continue;
    const spec = WEAPONS[t.type];
    const targets = s.enemies.filter(e => !e.dead && e.d >= 0 && distance(t, e) <= spec.range && visibleTo(s, t, e));
    targets.sort((a, b) => t.type === 'sniper' ? b.hp - a.hp || b.y - a.y : b.y - a.y);
    const target = targets[0]; if (!target) continue;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    if (t.cooldown > 0) continue;
    t.ammo--; t.cooldown = spec.interval; t.recoil = 1;
    if (t.type === 'bomb') blast(s, t.x, t.y, t.laneId, spec.damage, spec.radius, events, 'bomb');
    else if (t.type === 'blaster') {
      s.projectiles.push({ id: s.nextId++, x: t.x, y: t.y, targetId: target.id, targetX: target.x, targetY: target.y, laneId: t.laneId, life: 2.5, angle: t.angle });
      events.push({ type: 'rocket', x: t.x, y: t.y });
    } else { damage(s, target, spec.damage, events); events.push({ type: 'shot', x: t.x, y: t.y, tx: target.x, ty: target.y, weapon: t.type }); }
    if (!t.ammo) { s.spent++; events.push({ type: 'spent', x: t.x, y: t.y, weapon: t.type }); }
  }
  s.towers = s.towers.filter(t => t.ammo > 0);
  for (const p of s.projectiles) {
    const target = s.enemies.find(e => e.id === p.targetId && !e.dead);
    if (target && target.laneId === p.laneId) { p.targetX = target.x; p.targetY = target.y; }
    const dx = p.targetX - p.x, dy = p.targetY - p.y, d = Math.hypot(dx, dy), move = 375 * dt;
    p.angle = Math.atan2(dy, dx); p.life -= dt;
    if (d <= move || p.life <= 0) { blast(s, p.targetX, p.targetY, p.laneId, WEAPONS.blaster.damage, WEAPONS.blaster.radius, events, 'blaster'); p.done = true; }
    else { p.x += dx / d * move; p.y += dy / d * move; }
  }
  s.projectiles = s.projectiles.filter(p => !p.done);
}
export function stepGame(s, dt = 1 / 60) {
  const events = []; if (s.over || !Number.isFinite(dt) || dt <= 0) return events;
  // Caller advances in fixed substeps; cap accidental tab-sized jumps instead of skipping danger.
  dt = Math.min(dt, .05);
  if (s.prep > 0) { s.prep = Math.max(0, s.prep - dt); if (s.prep < 1e-8) { s.prep = 0; events.push({ type: 'begin' }); } return events; }
  s.time += dt;
  const level = 1 + Math.floor((s.time + 1e-8) / THREAT_SECONDS);
  if (level > s.level) { s.level = level; events.push({ type: 'threat', level }); }
  updateMap(s, events);
  s.supplyIn -= dt;
  if (s.supplyIn <= 0) {
    const supplied = nextSupply(s);
    for (const type of supplied) s.inventory[type].push(WEAPONS[type].ammo);
    s.deliveries++; s.supplyIn += SUPPLY_SECONDS; events.push({ type: 'supply', weapons: supplied });
  }
  s.spawnIn -= dt;
  if (s.spawnIn <= 0) {
    spawnWave(s, events);
    // Breath between groups; denser attacks follow each supply delivery.
    const base = Math.max(.72, 4.4 / (1 + (s.level - 1) * .28));
    s.spawnIn += base * (.85 + random(s) * .3) * (s.supplyIn > 7 ? .82 : 1.08);
  }
  updateEnemies(s, dt, events); updateWeapons(s, dt, events);
  s.enemies = s.enemies.filter(e => !e.dead);
  const breach = s.enemies.find(e => !e.connector && e.d >= s.lanes.find(l => l.id === e.laneId)?.path.length);
  if (breach) { s.over = true; s.breach = { id: breach.id, laneId: breach.laneId, ship: breach.type }; events.push({ type: 'over', x: breach.x, y: breach.y }); }
  return events;
}
