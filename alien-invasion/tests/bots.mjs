import { createGame, stepGame, placeWeapon, allSlots, WEAPONS } from '../logic.js';

// Policies use only the visible board, stock, and ammunition. No future spawns or RNG inspection.
export function play(seed, policy = 'careful', seconds = 420, reaction = .8) {
  const s = createGame(seed), events = []; let decisions = 0;
  for (let frame = 0; frame < seconds * 60 && !s.over; frame++) {
    if (frame % Math.round(reaction * 60) === 0 && policy !== 'idle' && (policy !== 'setupOnly' || decisions < 10)) {
      const available = allSlots(s).filter(p => !s.towers.some(t => t.slotId === p.id) && !s.lanes.find(l => l.id === p.laneId).retiring);
      let best = null;
      for (const p of available) {
        const incoming = s.enemies.filter(e => e.laneId === p.laneId && e.y < p.y + 90);
        const cover = s.towers.filter(t => t.laneId === p.laneId);
        const score = incoming.reduce((v, e) => v + 300 / (1 + Math.abs(e.y - p.y) / 100), 0) + (cover.length === 0 ? 130 : 0) - p.y * .04 - cover.length * 40;
        if (!best || score > best.score) best = { p, score };
      }
      if (best) {
        const type = ['cannon', 'sniper', 'blaster', 'bomb'].find(t => s.inventory[t].length);
        if (type && placeWeapon(s, best.p.id, type)) decisions++;
      }
    }
    events.push(...stepGame(s));
  }
  return { state: s, events, stock: Object.fromEntries(Object.keys(WEAPONS).map(t => [t, s.inventory[t].length])) };
}
export const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
