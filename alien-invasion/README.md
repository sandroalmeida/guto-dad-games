# Alien Invasion

A little house. A very big invasion. An endless browser defense game inspired
by Guto's tunnel-and-chamber sketch, with illustrated cave scenery, piloted alien
saucers, explosive laser bazookas, and a steady stream of replacement defenses.

## Play locally

From this folder:

```sh
npm start
```

Open <http://localhost:4176>. Python 3 serves the game; there is no package
installation, build step, account, or external asset request. Opening the HTML
directly from disk does not work because the game uses JavaScript modules.

## Controls

| Input | Action |
| --- | --- |
| Click / tap a weapon, or `1`–`4` | Select sniper, blaster, light cannon, or bomb |
| Click / tap an empty `+` pad | Deploy the selected weapon |
| Arrow keys, then `Space` / `Enter` | Move keyboard focus between pads and deploy |
| `P` / `Escape` | Pause or resume; Escape also closes the field guide |
| `M` | Toggle sound |
| `Enter` on the title / results screen | Start a new invasion |

Switching tabs or windows pauses the run. Mouse, keyboard, and touch use the
same placement rules. All four weapon cards and the delivery timer remain below
the battlefield on a phone. The field guide is available from the `?` button.

## Rules

- Start with **five seconds to place defenses**, three entrances, and **2
  snipers, 4 blasters, 2 light cannons, and 2 bombs**. Placement continues during
  the invasion. Every weapon aims and fires automatically.
- Ships enter at the **top**, travel down the passages, and head toward the
  house. **One surviving ship reaching the house ends the entire run.**
- Chambers contain two or three fixed defense pads. Each tunnel also has one
  final defense pad. Invalid placements never spend inventory.
- Weapons have finite ammunition. A ring shows remaining ammunition; spent
  weapons disappear and briefly mark their pad **REPLACE**. A replacement is a
  new inventory item, not a free refill.
- Supplies arrive every **10 seconds**. The toolbox shows the exact next
  delivery and the number of each weapon in stock. The mix repeats predictably;
  higher threats sometimes deliver three items instead of two.
- Survival time is the record. The results also show ships destroyed, threat
  reached, and the passage that was breached. Records and the sound preference
  are saved locally in the browser. **Retry the same invasion** keeps its seed;
  a new invasion gets new chamber shapes and a new alien sequence.

### Weapons

| Weapon | Ammunition | Behavior |
| --- | --- | --- |
| Sniper | 5 shots | Long range, heavy damage, favors the toughest visible ship |
| Blaster | 3 rockets | Laser bazooka; traveling rockets explode and damage a nearby group |
| Light cannon | 32 shots | Rapid, individual laser shots fired in sequence |
| Bomb | 1 blast | Waits for a nearby ship, then detonates across its local passage |

Tunnel walls block direct fire. A weapon does not fire into another passage,
and explosions cannot damage ships across a rock wall. No weapon requires
manual aiming or manual firing. Every ship can be damaged by every weapon.

### Endless pressure and changing tunnels

Threat increases every **30 seconds**. There is no final level. Regular saucers
arrive first; fast needle scouts join from threat 2, and armored cruisers from
threat 3. Arrival gaps shorten, groups become more frequent, and later ships
become tougher. A lower bound on spawn intervals and a 55-ship cap keep the
board and frame time manageable; threat and durability continue to increase.

Map changes are announced **eight seconds ahead**. A fourth and fifth passage
open during the first minute, each bringing an extra light cannon and blaster
and a brief arrival grace period. Later changes reshape or retire passages,
then open them again with different chamber positions and capacities.

A retiring passage stops admitting ships. Its existing ships and rockets must
finish before it changes. Weapons on that passage return with **their actual
remaining ammunition**, including partially used weapons. Other passages stay
active throughout. An occupied route never disappears or teleports its ships.

Later maps include a connector between neighboring passages. Aliens can take
the less-defended branch when they reach that junction; they stay on the chosen
connector until it ends. Warning time and starting tools for new entrances make
coverage changes an active decision rather than a surprise leak.

## Design and implementation

All artwork is drawn locally: carved rock strata, cutaway tunnels, chamber
lights, crystals, tiny plants, a lit house and garden, shaded hulls, cockpit
pilots, engines, weapon assemblies, ammunition rings, beams, rockets, debris,
and shockwaves. The title screen shows a larger cruiser illustration.

Audio uses synthesized weapon sounds, supply chimes, and a quiet musical bed.
It starts only after interaction and can be muted. Reduced-motion preferences
reduce ambient animation and debris; gameplay timing remains identical.

- `logic.js`: deterministic game rules, seeded maps, routing, weapons,
  inventory, supplies, and difficulty; no DOM or rendering dependencies.
- `renderer.js`: cached scenery and live Canvas 2D art and effects.
- `game.js`: fixed-step loop, browser input, accessible pad buttons, screens,
  audio, and local records.
- `index.html` / `styles.css`: responsive toolbox, battlefield, guide, and menus.
- `tests/`: rule checks and complete seeded matches played by visible-state bots.

## Validation

Requires a recent Node.js version supporting `node --test`:

```sh
npm test
```

The rule suite checks hundreds of generated routes, preparation, invalid
placements, each weapon, ammunition depletion, splash damage, tunnel isolation,
instant defeat, last-instant saves, supply previews, warnings, route retirement,
ammunition-preserving refunds, connector traffic, and deterministic retries.

Balance tests compare 16 invasions for each policy. The active defender chooses
using only visible ships, pads, stock, and ammunition, and acts at most every
0.8 seconds. Initial measured median survival:

- No placement: **39 seconds**.
- Starting weapons only: **67 seconds**.
- Active placement and replacement: **323 seconds**.

These are regression targets and tuning evidence, not a promise of human
survival time. Browser checks cover actual placement, stock changes, combat,
results, pause, and the desktop and phone layouts.

For local development, `window.__alienInvasion` exposes `state`, `mode`,
`start(seed)`, and `pause(boolean)`.
