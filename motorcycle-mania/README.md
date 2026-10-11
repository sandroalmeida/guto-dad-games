# Motorcycle Mania

A side-view, endless motorcycle ride inspired by Guto and Dad's sketch. Jump
between tracks, dodge junkyard hazards, collect fuel, and see how far you can ride.

## Play locally

From this folder, run `npm start`, then open <http://127.0.0.1:4175>.
There is no build step or package installation. Python 3 serves the game;
Node.js is only needed to run the tests. Opening the HTML directly from disk
does not work because the game uses JavaScript modules.

## Controls

| Key | Action |
| --- | --- |
| Up / Down (or W / S) | Jump one track; hold to keep hopping |
| Right (or D) | Accelerate |
| Left (or A) | Brake; the road keeps moving |
| Enter | Start, restart, or resume |
| P / Escape | Pause or resume |
| M | Toggle sound |

The four buttons below the game also work with a mouse or touch. Switching
away from the game automatically pauses it and releases all controls.
A quick jump tap just before landing is remembered for 0.22 seconds, so the
next hop can begin as soon as the motorcycle lands and is ready.

## Choose your pace

Choose a difficulty before starting, or after a run:

- **Cruise:** begins at 84 km/h, increases toward 148 km/h, and offers fuel
  in every wave with slower tank consumption. Wide sections add more traffic.
- **Arcade:** begins at 112 km/h, increases toward 190 km/h, and has two
  obstacles per early wave, more traffic on wider tracks, and fuel in alternate waves.
- **Mania:** begins at 140 km/h, increases toward 234 km/h, and has tighter
  gaps, faster rolling wheels, stronger surges, and up to seven obstacles in
  ten-track sections.

Accelerating adds up to 34 km/h; braking subtracts 40 km/h. Surges add
32 / 44 / 52 km/h by mode. Arcade's starting scenery now scrolls about 90%
faster than the previous version, with speed streaks to reinforce the pace.

All modes have three lives and the same track-changing and jumping rules.
Each mode saves its own best distance; existing prototype records carry over
to Arcade. The selected mode is remembered for the next visit.
The results show distance, collected fuel, obstacles passed, and top speed.
Choose **New ride** for a new course or **Retry course** to race the
same obstacle sequence in the same mode. A course code identifies that ride
when you and your son take turns.

## The ride

- Begin with four tracks, three lives, and a full tank. The bike rides right;
  scenery and obstacles move left. Speed rises gradually with distance.
- Touch teal fuel bottles to add 30 fuel, up to 100. Fuel runs down over time,
  faster at higher speed. An empty tank costs one life and supplies 65 rescue
  fuel to continue. A collision costs one life and leaves at least 35 fuel.
- Old cars, oncoming wheels, flaming barrels, and falling barrels all hurt.
  Falling barrels show a drop column and a warning before falling. A jump has
  travel time and can collide with a hazard while crossing tracks.
- Blue **water** patches slow jumps and throttle response for 1.4 seconds.
  Purple **oil** patches lock track changes for 0.9 seconds; braking and
  acceleration remain available. A countdown shows when grip returns.
  Airborne wheels clear spills. Spills do not directly cost a life, and damage
  or a track transfer clears their effects.
- A **hot barrel** on the bottom track heats up, shows an upward warning
  column, and explodes after a 0.65-second fuse. The barrel shoots through
  the upper tracks and exits above the ceiling. Adjust speed or leave its
  path to avoid its flight.
- After damage, blink with protection for 2.6 seconds. Losing the third life
  ends the run. Restart for a new course; your best distance stays in the browser.
- Tracks change more frequently along the sequence 4, 2, 4, 3, 5, 10, 7, 3,
  8, 2, 6, then repeat. Four-track sections last 550 metres; narrow sections
  are shorter and wide sections are longer so their hazards have time to
  reach the rider. Fewer tracks zoom everything closer; more tracks zoom out.
  Changes are announced beforehand, the course is cleared, and a rider on a
  removed track is transferred to the closest remaining track with brief protection.
- Speed surges are announced after 22 seconds of each 30-second cycle, start
  at 24 seconds, and end at 29 seconds. Braking still works during a surge.
- Obstacle waves reserve a clear track within one hop of the previous route.
  Moving barrels can cross that route later, so watch their warning columns.
  Fuel appears along the route. The first bottle is on your starting
  track, followed by a car that teaches the first lane change.

## Files and tests

`logic.js` contains seeded game rules, independent of drawing and browser APIs.
`game.js` draws the tunnel, motorcycle, obstacles, animations, and generated
sound effects. `index.html` and `styles.css` hold the responsive interface.
All art and audio are created locally; the game loads no external assets.

Run `npm test` for rule tests covering jumps, collisions and recovery, fuel,
moving hazards, track changes, speed surges, buffered input, difficulty,
water/oil effects, upward launches, two-to-ten-track layouts, and repeatable
courses at different speeds. Balance tests compare standing
still against a rider that dodges and refuels using only visible obstacles,
across all three modes and multiple courses.
For local inspection, `window.__motorcycleMania` exposes
`state`, `mode`, `start(seed)`, and `pause(boolean)`.
