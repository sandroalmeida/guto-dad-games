# Nightfall Run

A responsive, first-person on-rails browser shooter. Choose a survivor, shoot approaching zombies and skeletons, defeat escalating bosses, and solve quick math locks to claim permanent weapons or a one-use sky bomb.

## Play locally

The game has no build step or package dependencies. From this folder, run:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Controls

- Move the mouse or tap the road to aim.
- Press or hold `Space` to fire. Touch players can use the on-screen fire control.
- Press `Ctrl` or use the on-screen bomb control to deploy a collected fall bomb.
- Use the arrow keys to cycle through weapons already unlocked in the current run.
- Press `P` or `Esc` to pause and switch between unlocked weapons.

## Included gameplay

- Zombies, skeletons, oversized bosses, club-wielding ultra zombies, and dual-sword skeleton bosses.
- Difficulty that increases through higher enemy density, speed, and recurring boss encounters.
- A permanent weapon inventory with ordered progression: Machine Gun, then Flamethrower, then Bazooka.
- Road-attached death remains: fallen zombies and shattered skeleton pieces advance toward and pass beneath the player.
- Collectible one-use fall bombs that are not included in the starting loadout.
- Range-specific heavy weapons: flames must physically touch a nearby target, while bazookas only fire into the far half of the road.
- Procedural apocalyptic background music, boss entrance voices, and boss death screams.
- Addition, subtraction, multiplication, and division locks with three shootable answers.
- Desktop, tablet, and touch-friendly mobile layouts.
