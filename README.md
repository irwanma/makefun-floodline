[![make.fun best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/irwanma/makefun-floodline/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/irwanma/makefun-floodline/reward.svg)](https://make.fun/bounty/best-game-01)

# FLOODLINE

Steer the great rain: dig channels, raise levees, and hold a terraced rice
village through seven nights of flood. A top-down flood-defense game built
with an AI coding agent for the
[make.fun best-game-01](https://make.fun/bounty/best-game-01) bounty.
Pure vanilla JavaScript on a 2D canvas — no libraries, no build step.

## The game

Monsoon season in a terraced valley. Every night the rain swells the ridge
springs and water comes down the paddies toward a village of lantern-lit
houses. You shape the land before each flood — and improvise during it.

- A real cell-to-cell water simulation flowing downhill over a terraced
  heightmap, rendered as animated torrents with foam
- Two phases per night: BUILD (place your works) and FLOOD (the surge,
  gates still in your hands, emergency sandbags at double cost)
- Seven named nights: The First Rain, The Swelling River, The East Ridge
  Breaks, The Night of Debris, The Cloudburst, The River Changes Course,
  The Great Deluge
- Tools: Dig Channel, Raise Levee, Sandbag Wall, Sluice Gate, Reservoir
  Pond, Bamboo Dam, Repair Crew — unlocked night by night
- Protect the houses, the rice terraces, the Granary and the Shrine;
  a dry Shrine earns a choice of 1 of 3 blessings each dawn
- Economy of Labor, harvested rainwater bonuses, and a FLOW grade
  (S/A/B/C) at every dawn
- Synth audio: rain, rising water, thunder, and pentatonic plucks at dawn

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or just open
`game/index.html` directly.

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with `buildDossier` from `vendor/makefun-game.ts`, exactly as
the grader does.

## Layout

- `game/index.html` — the page
- `game/src/` — the game source, one job per file (config, terrain, water,
  tools, buildings, surges, blessings, weather, audio, hud, screens, main)
- `screenshots/` — title, build phase, mid-flood and dawn reckoning,
  1280x720
- `main.ts` — the entrypoint the grader runs (Node 22)
- `serve.ts` — a tiny local server for playing the game

## License

MIT — see `LICENSE`.
