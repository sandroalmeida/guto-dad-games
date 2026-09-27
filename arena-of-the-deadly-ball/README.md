# The Arena of the Deadly Ball

A top-down browser survival game. You and a deadly blue ball are locked in an
arena. You have three hearts (red, orange and yellow). Stay alive as long as you
can: the clock is your score.

## Play locally

No build step and no dependencies. From this folder, run:

```sh
python3 -m http.server 4174
```

Then open `http://localhost:4174`. (Opening `index.html` straight from disk won't
work because the game is split into JavaScript modules.)

## Controls

- Arrow keys or `WASD`: move. You face the way you last moved.
- `Space`: throw the triangle you're carrying, straight ahead.
- `P` or `Esc`: pause. `M`: sound on or off. `Enter`: start or play again.
- On a touch screen, the Move pad and the "Your power" card are buttons.

## Rules

- **The ball** rolls around the arena at random. It sometimes heads for a flame,
  and later in the match it sometimes heads for wherever you're standing. If it
  touches you, you lose a heart and blink for 2 seconds, and nothing can hurt
  you while you blink.
- **Yellow triangles** (your power) appear at random. Only you can pick them up,
  and you carry one at a time in your hand. A dotted line shows where it will go.
  Press `Space` to throw it straight ahead. If it hits the ball, the ball freezes
  for **3 seconds** and can't move, hurt you, eat flames or use a power. A
  triangle you don't pick up disappears after 12 seconds.
- **Flames** (the ball's power) appear at random, and only the ball can eat
  them. After eating one, the ball glows and shakes for about half a second,
  then fires one of three powers. The power is picked at random, and nothing
  tells you which one is coming:
  - **Laser**: a beam shoots out in a random direction, bounces off the walls
    exactly 2 times, then fades.
  - **Knife spin**: two knife arms come out of the ball and spin fast for 3
    seconds while the ball keeps rolling.
  - **Metal strings**: two sharp-pointed strings shoot out in opposite
    directions until they hit the walls, then pull back in. The ball holds
    still while it throws them.
- If a triangle freezes the ball while it's glowing, the power is cancelled.
- **Danger level** goes up every 25 seconds, up to 10. Each level makes the
  ball faster, brings flames more often (up to 3 at once), and makes the ball
  more likely to come after you.
- Your best time is saved in the browser.

## Files

- `logic.js` has all the rules. It's pure and deterministic for a given seed,
  with no DOM and no `Math.random`, so it runs the same in Node and the browser.
- `game.js` handles the canvas drawing, input, synthesized sound effects and
  music, and the screens. It only draws the rules and reacts to their events.
- `index.html` and `styles.css` hold the page layout from the sketch: the arena
  with the hearts box on top, the Move pad on the right, and the two power
  cards below.
- `tests/` holds the rule tests and the balance tests, played by bots.

## Tests

```sh
npm test
```

This runs `node --test` over `tests/*.test.mjs`. It needs Node 22 or newer and
no packages.

- `rules.test.mjs` checks each rule from the spec: movement, pickups, the throw
  and the 3-second freeze, the 3 powers (2 laser bounces, a 3-second spin while
  moving, strings reaching opposite walls), losing hearts and game over.
- `balance.test.mjs` plays 40 full matches for each bot. The bots only use what
  a player can see on screen. The balance targets are:
  - A player who stands still lasts about 40 seconds.
  - A player who runs around at random lasts about a minute.
  - A careful dodger who throws triangles lasts several minutes.
  - Even a near-perfect bot eventually loses to the danger ramp.

The balance knobs are at the top of `logic.js`: `DANGER_STEP`, the ball speed
constants, `flameInterval`, `chaseChance`, `WINDUP_TIME`, `SPIN_BLADE` and
`LASER_TRAIL`.

For debugging, `window.__deadlyBall` exposes `game` (the live state), `mode` and
`start(seed)`.
