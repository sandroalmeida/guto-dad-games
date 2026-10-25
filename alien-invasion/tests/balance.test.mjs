import test from 'node:test';
import assert from 'node:assert/strict';
import { play, median } from './bots.mjs';

const seeds=Array.from({length:16},(_,i)=>(i+1)*7919);
const idle=seeds.map(seed=>play(seed,'idle'));
const setup=seeds.map(seed=>play(seed,'setupOnly'));
const careful=seeds.map(seed=>play(seed,'careful'));
const time=runs=>median(runs.map(r=>r.state.time));

test('the opening offers enough time to read, place, and react without becoming a long wait',()=>{
  assert.ok(time(idle)>28&&time(idle)<45,`idle median: ${time(idle).toFixed(1)}s`);
  assert.ok(idle.every(r=>r.state.kills===0&&r.state.over));
});
test('initial defenses help, but replacing spent weapons is essential',()=>{
  assert.ok(time(setup)>time(idle)*1.4,`setup ${time(setup).toFixed(1)}s, idle ${time(idle).toFixed(1)}s`);
  assert.ok(time(careful)>time(setup)*1.6,`careful ${time(careful).toFixed(1)}s, setup ${time(setup).toFixed(1)}s`);
});
test('visible, deliberate placement sustains several minutes of escalating invasion',()=>{
  assert.ok(time(careful)>150&&time(careful)<420,`careful median: ${time(careful).toFixed(1)}s`);
  assert.ok(careful.every(r=>r.state.level>=5));
  assert.ok(careful.every(r=>r.state.spent>15));
  assert.ok(careful.every(r=>r.events.some(e=>e.type==='map-change')));
});
test('all four weapons participate, and pressure eventually exceeds a strong reactive policy',()=>{
  for(const type of['sniper','cannon'])assert.ok(careful.every(r=>r.events.some(e=>e.type==='shot'&&e.weapon===type)));
  for(const type of['blaster','bomb'])assert.ok(careful.every(r=>r.events.some(e=>e.type==='blast'&&e.weapon===type)));
  assert.ok(careful.filter(r=>r.state.over).length>=14);
  assert.ok(careful.every(r=>r.state.enemies.length<56),'bounded on-screen pressure');
});

test('balance summary',()=>{console.log(`Median survival across ${seeds.length} invasions: idle ${time(idle).toFixed(1)}s; setup only ${time(setup).toFixed(1)}s; active defense ${time(careful).toFixed(1)}s.`);});
