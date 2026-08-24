# Guto & Nanda and the Golden Pumpkin

A modern 2D jungle adventure inspired by the spirit of classic side-scrolling
games. Guto and Nanda must overcome eight animal-guarded courses to recover the
Golden Pumpkin.

## Current build

- Courses 1 through 5 are playable end to end: **The Crocodile Canal**,
  **The Pushing Monkeys**, **The Diving Eagles**, **The Hippo Crossing**, and
  **The Sleeping Snakes**.
- Choose Guto or Nanda as the active explorer; their partner cheers from shore.
- Run, jump, catch any part of a swinging vine, climb it, and reach the far bank.
- Animated crocodiles, water, procedural jungle scenery, sound cues, game-over,
  course-complete, keyboard controls, and touch controls are included.
- Release-quality course art includes state-aware character poses, reactive
  crocodile gaze and jaws, natural pendulum timing, flexible vine rendering,
  layered jungle depth, mist, water reflections, and environmental effects.
- The full eight-course expedition is mapped beneath the game.
- Course 2 adds four three-layer trees, seven patrolling capuchins, directional
  shoves, branch-jumping pursuit, stomp-to-dizzy combat, two route-blocking
  barriers, and a cumulative one-second spike damage meter.
- Course 3 adds a sunny clearing patrolled by three hawk-eagles that lock on,
  dive, and carry the explorer skyward; rodents that scurry across the field
  and serve as shields when raised overhead; decoy fruit that heals but never
  scares an eagle; a health meter; and a three-second mash-to-escape struggle.
- Course 4 adds a sunset river with four drifting hippos, each with a mouth,
  head, and back landing zone on its own patience timer; short hops and
  charged long jumps with an overcharge penalty; one hippo that submerges on
  a cycle; oxpecker birds; and splash, chomp, shake, and dive game-overs.
- Course 5 switches to a top-down view: a seeded, validated maze of twenty
  rows of winding roots and sleeping vipers that look identical, one-row hops,
  walking along roots, an all-snakes-wake reveal with a 0.65-second bite
  timer, and a layout that stays the same while you retry.

## Controls

- `←` / `→` or `A` / `D` — move and steer in the air
- `↑` / `↓` or `W` / `S` — climb while holding a vine
- `Space` — jump from the ground or launch from a vine
- Hold `Z` — grab any part of a vine; releasing it makes you fall
- Hold `X` while moving — run and jump farther

Falling into the canal ends the attempt. Reach the trail sign on the far bank
to complete the course. Every vine catch requires a jump first; dropping by
releasing `Z` does not allow another catch until the explorer lands and jumps.

In Course 2, use the same movement, jump, and run controls. Monkeys chase on
their branch layer and push the explorer downward on contact. Land on a monkey's
head to stun it. Every spike landing adds damage to the same one-second meter;
jumping clear pauses the damage but does not reset it. The barriers at both ends
of the spike bed can only be cleared from the tree branches.

In Course 3, the shade under the trees at both ends of the clearing is safe;
everywhere in between, the eagles hunt. Press `Space` next to a rodent or fruit
to pick up whichever is closest, and press it again to drop what you carry.
Hold `Z` to raise a rodent overhead: a diving eagle takes the raised rodent
instead of you, but raising it slows you to a walk and disables running. A
rodent carried low does not protect you and falls when you are grabbed. Fruit
never scares an eagle — hold `Z` to eat it and restore 15 health. Each catch
costs 25 health, and the eagle carries you back toward the start; mash `Space`
to break free within three seconds or the course is lost. The third, fastest
eagle only joins the hunt once you are past the middle of the field.

In Course 4, only the banks are safe. Each hippo faces you with its mouth,
then head, then back. `Space` is a short hop: from the very edge of the bank it
reaches the first head (from further back, the mouth); from a mouth or head it
reaches that hippo's back; from the rear of a back it reaches the next head
(from the middle, the next mouth). Hold `Z` to charge, then press `Space` for
a long jump that lands on the next back when the meter is green — hold too
long and you overshoot. The mouth opens at once, the head shakes after 0.75
seconds, and the back dives after 2.4 seconds; hopping along the same back
does not reset its patience. The third hippo submerges on a cycle — bubbles
warn you a second before it goes under. Any fall into the river ends the
attempt.

In Course 5, seen from above, every cell of the twenty-row path is part of a
root or a snake, and they look the same. `→` (or `Space`) hops forward one row
onto whatever is there; `←` hops back. `↑` / `↓` walk along the root you are
standing on, and only where that same root continues. Landing on a sleeping
snake wakes every snake in the maze — heads, eyes, and tongues appear — and
you have 0.65 seconds to hop onto a root (or straight back) before it bites.
Landing on any snake while they are awake is an instant bite. Landing on a
root puts them all back to sleep at once. Every maze is generated and checked
so that a safe path exists and never needs two snakes in a row, and no lane is
a straight shot; retrying keeps the same maze so you can use what you
memorized.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm test` to create a production build and run the rendered-page smoke
test.
