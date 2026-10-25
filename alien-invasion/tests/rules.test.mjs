import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, WEAPONS, SHIPS, createGame, makeLane, sampledPath, at, allSlots, placeWeapon, spawnEnemy, stepGame, nextSupply } from '../logic.js';

function quiet(seed = 1) { const s = createGame(seed); s.prep = 0; s.spawnIn = Infinity; s.nextMapAt = Infinity; return s; }
function tick(s, seconds) { const events = []; for (let i=0;i<Math.round(seconds*60);i++)events.push(...stepGame(s));return events; }
function near(s, type = 'saucer', slot = s.lanes[0].slots[0], yOffset = -15) {
  const lane=s.lanes.find(l=>l.id===slot.laneId),p=lane.path.points.reduce((a,b)=>Math.abs(a.y-slot.y-yOffset)<Math.abs(b.y-slot.y-yOffset)?a:b);
  const e=spawnEnemy(s,lane.id,type);e.d=p.d;Object.assign(e,at(lane.path,e.d));e.speed=0;return e;
}

test('all generated tunnel variants connect the entrance to the house with legal chamber capacity',()=>{
  for(let seed=1;seed<=30;seed++)for(let id=0;id<5;id++)for(let version=0;version<4;version++){
    const l=makeLane(id,version,seed);assert.equal(l.path.points[0].y,54);const end=l.path.points.at(-1);assert.equal(end.y,985);assert.ok(Math.abs(end.x-WORLD.homeX)<=40);
    assert.ok(l.path.points.every(p=>p.x>=0&&p.x<=WORLD.width&&p.y>=0&&p.y<=WORLD.height));
    assert.equal(l.slots.length,l.chambers.reduce((n,c)=>n+c.capacity,1));assert.equal(new Set(l.slots.map(p=>p.id)).size,l.slots.length);
    for(const slot of l.slots.filter(p=>p.chamber>=0)){const c=l.chambers[slot.chamber];assert.ok(((slot.x-c.x)/c.rx)**2+((slot.y-c.y)/c.ry)**2<1);}
    for(let i=1;i<l.path.points.length;i++){assert.ok(l.path.points[i].d>l.path.points[i-1].d);assert.ok(l.path.points[i].y>=l.path.points[i-1].y,'ships never take a backward segment');}
  }
});
test('five seconds of preparation allows placement but freezes ships, supplies, and survival time',()=>{
  const s=createGame(8),slot=allSlots(s)[0];assert.equal(placeWeapon(s,slot.id,'cannon'),true);tick(s,4.9);assert.equal(s.time,0);assert.equal(s.enemies.length,0);assert.equal(s.supplyIn,10);assert.equal(s.towers[0].ammo,32);tick(s,.1);assert.equal(s.prep,0);tick(s,.5);assert.ok(s.time>.4);
});
test('stock is consumed once; occupied, unknown, retiring, empty-stock and game-over placements are rejected',()=>{
  const s=quiet(),slot=allSlots(s)[0];assert.equal(placeWeapon(s,slot.id,'sniper'),true);assert.equal(s.inventory.sniper.length,1);
  assert.equal(placeWeapon(s,slot.id,'sniper'),false);assert.equal(placeWeapon(s,'missing','sniper'),false);assert.equal(placeWeapon(s,allSlots(s)[1].id,'unknown'),false);assert.equal(s.inventory.sniper.length,1);
  s.lanes[0].retiring=true;assert.equal(placeWeapon(s,allSlots(s)[1].id,'sniper'),false);s.lanes[0].retiring=false;s.inventory.bomb=[];assert.equal(placeWeapon(s,allSlots(s)[1].id,'bomb'),false);
  s.over=true;assert.equal(placeWeapon(s,allSlots(s)[1].id,'sniper'),false);
});
test('sniper picks a tougher target and uses exactly one shot per attack',()=>{
  const s=quiet(),slot=allSlots(s)[0];placeWeapon(s,slot.id,'sniper');const little=near(s,'saucer'),big=near(s,'cruiser');tick(s,.4);
  assert.equal(little.hp,SHIPS.saucer.hp);assert.equal(big.hp,SHIPS.cruiser.hp-WEAPONS.sniper.damage);assert.equal(s.towers[0].ammo,4);
});
test('light cannon fires separate sequential laser shots and is spent after 32',()=>{
  const s=quiet(),slot=allSlots(s)[0];placeWeapon(s,slot.id,'cannon');const e=near(s,'cruiser');e.hp=e.maxHp=100000;
  const events=tick(s,6.5),shots=events.filter(e=>e.type==='shot');assert.equal(shots.length,32);assert.ok(shots.every(e=>e.weapon==='cannon'));assert.equal(e.hp,100000-32*14);assert.equal(s.towers.length,0);assert.equal(s.spent,1);assert.equal(placeWeapon(s,slot.id,'cannon'),true);
});
test('blaster launches a traveling rocket whose splash damages a cluster, but not the adjacent passage',()=>{
  const s=quiet(),slot=allSlots(s)[0];placeWeapon(s,slot.id,'blaster');const a=near(s),b=near(s,'saucer',slot,-25),neighbor=near(s,'saucer',s.lanes[1].slots[0]);neighbor.x=a.x;neighbor.y=a.y;
  const launch=tick(s,.38);assert.ok(launch.some(e=>e.type==='rocket'));assert.equal(a.hp,84);assert.ok(s.projectiles.length>0);
  const later=tick(s,.7);assert.ok(later.some(e=>e.type==='blast'&&e.weapon==='blaster'));assert.ok(a.dead&&b.dead);assert.equal(neighbor.hp,84);assert.equal(s.towers[0].ammo,2);
});
test('bomb waits for proximity, detonates once, and frees its pad',()=>{
  const s=quiet(),slot=allSlots(s)[0];placeWeapon(s,slot.id,'bomb');tick(s,1);assert.equal(s.towers.length,1);const enemy=near(s,'cruiser');const events=tick(s,.1);assert.ok(enemy.dead);assert.equal(events.filter(e=>e.type==='blast').length,1);assert.equal(s.towers.length,0);assert.equal(s.spent,1);
});
test('weapons cannot shoot through rock into another passage',()=>{
  const s=quiet(),slot=allSlots(s)[1];s.lanes.push(makeLane(1,0,s.seed));placeWeapon(s,slot.id,'sniper');const e=near(s,'saucer',s.lanes.at(-1).slots[0]);assert.ok(Math.hypot(e.x-slot.x,e.y-slot.y)<WEAPONS.sniper.range,'target is inside the nominal range but in a separate tunnel');tick(s,.5);assert.equal(s.towers[0].ammo,5);assert.equal(e.hp,84);
});
test('a single live ship reaching home ends the game; a last-instant kill does not',()=>{
  const s=quiet();const e=spawnEnemy(s,0);e.d=s.lanes[0].path.length-1;e.speed=120;tick(s,.1);assert.equal(s.over,true);assert.equal(s.breach.id,e.id);const time=s.time,stock=structuredClone(s.inventory);tick(s,20);assert.equal(s.time,time);assert.deepEqual(s.inventory,stock);
  const saved=quiet(),slot=allSlots(saved)[0];placeWeapon(saved,slot.id,'sniper');const tower=saved.towers[0],target=spawnEnemy(saved,0);target.d=saved.lanes[0].path.length-1;target.speed=120;tower.x=at(saved.lanes[0].path,target.d).x;tower.y=984;tower.cooldown=0;tick(saved,.02);assert.equal(saved.over,false);assert.equal(saved.kills,1);
});
test('supplies follow the advertised schedule and continue at higher threat',()=>{
  const s=quiet();const incoming=nextSupply(s),before=Object.fromEntries(Object.keys(WEAPONS).map(t=>[t,s.inventory[t].length]));const events=tick(s,10.1);assert.equal(s.deliveries,1);assert.deepEqual(events.find(e=>e.type==='supply').weapons,incoming);for(const t of incoming)assert.equal(s.inventory[t].length,before[t]+incoming.filter(x=>x===t).length);tick(s,60);assert.equal(s.level,3);assert.equal(s.deliveries,7);
});
test('a new entrance is warned, grants supplies, and never relocates existing ships or weapons',()=>{
  const s=quiet();s.nextMapAt=30;const slot=allSlots(s)[0];placeWeapon(s,slot.id,'bomb');const e=spawnEnemy(s,4);e.speed=0;tick(s,22.1);assert.equal(s.warning.action,'add');assert.equal(s.lanes.length,3);const p={x:e.x,y:e.y,d:e.d};tick(s,8);assert.equal(s.lanes.length,4);assert.ok(s.lanes.some(l=>l.id===1));assert.deepEqual({x:e.x,y:e.y,d:e.d},p);assert.equal(s.towers[0].slotId,slot.id);assert.ok(s.inventory.cannon.length>=3);
});
test('occupied retiring routes stay until drained; returned tools preserve remaining ammo',()=>{
  const s=quiet();s.mapCycle=2;s.nextMapAt=30;const slot=s.lanes[0].slots[0];placeWeapon(s,slot.id,'cannon');s.towers[0].ammo=7;
  const e=spawnEnemy(s,0);e.speed=0;tick(s,30.1);assert.ok(s.lanes.find(l=>l.id===0).retiring);assert.equal(s.lanes.find(l=>l.id===0).version,0);assert.equal(placeWeapon(s,s.lanes[0].slots[1].id,'sniper'),false);assert.equal(spawnEnemy(s,0),null);
  e.dead=true;tick(s,.1);assert.equal(s.lanes.find(l=>l.id===0).version,1);assert.equal(s.retiring,null);assert.ok(s.inventory.cannon.includes(7));assert.equal(s.towers.length,0);
});
test('branch traffic keeps its actual connector until arrival even if the map starts retiring',()=>{
  const s=quiet();s.nextMapAt=30;tick(s,60.1);assert.equal(s.lanes.length,5);assert.ok(s.connectors.length>0);const link=s.connectors[0],e=spawnEnemy(s,link.from);e.d=link.startD-.1;e.speed=60;
  // Defense on the source makes the visible alternate route preferable.
  const slot=s.lanes.find(l=>l.id===link.from).slots.find(p=>p.y>500);placeWeapon(s,slot.id,'bomb');tick(s,.05);assert.ok(e.connector);const destination=link.to;s.lanes.find(l=>l.id===destination).retiring=true;s.retiring={id:destination,action:'morph'};
  tick(s,.1);assert.ok(s.lanes.find(l=>l.id===destination).retiring);assert.ok(e.connector,'ship keeps its in-flight connector');
});
test('fixed seeds and the same inputs produce exactly the same runs',()=>{
  const a=createGame(743),b=createGame(743);for(let i=0;i<6000&&!a.over;i++){if(i%120===0){for(const s of[a,b]){const slot=allSlots(s).find(p=>!s.towers.some(t=>t.slotId===p.id));if(slot)placeWeapon(s,slot.id,i%240?'blaster':'cannon');}}assert.deepEqual(stepGame(a),stepGame(b));}assert.deepEqual(a,b);
});
