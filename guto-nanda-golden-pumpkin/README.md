# Guto & Nanda and the Golden Pumpkin

A modern 2D jungle adventure inspired by the spirit of classic side-scrolling
games. Guto and Nanda must overcome eight animal-guarded courses to recover the
Golden Pumpkin.

## Current build

- Course 1, **The Crocodile Canal**, is playable end to end.
- Choose Guto or Nanda as the active explorer; their partner cheers from shore.
- Run, jump, catch any part of a swinging vine, climb it, and reach the far bank.
- Animated crocodiles, water, procedural jungle scenery, sound cues, game-over,
  course-complete, keyboard controls, and touch controls are included.
- Release-quality course art includes state-aware character poses, reactive
  crocodile gaze and jaws, natural pendulum timing, flexible vine rendering,
  layered jungle depth, mist, water reflections, and environmental effects.
- The full eight-course expedition is mapped beneath the game.

## Controls

- `←` / `→` or `A` / `D` — move and steer in the air
- `↑` / `↓` or `W` / `S` — climb while holding a vine
- `Space` — jump from the ground or launch from a vine
- Hold `Z` — grab any part of a vine; releasing it makes you fall
- Hold `X` while moving — run and jump farther

Falling into the canal ends the attempt. Reach the trail sign on the far bank
to complete the course. Every vine catch requires a jump first; dropping by
releasing `Z` does not allow another catch until the explorer lands and jumps.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm test` to create a production build and run the rendered-page smoke
test.
