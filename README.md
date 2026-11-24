# Solmara: Streets of the Sun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Icesage101/solmara/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Icesage101/solmara/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game that plays in a desktop browser from
static files. No build step, no network, no engine: plain ES modules, a
canvas, and a synthesized soundtrack of engine hum and sirens.

Mara Voss came back to Solmara to drive a cab and keep her head down.
The city had other plans. Run fares, borrow the wrong cars, carry crates
across town against the clock, and stay one street ahead of the Solmara
Police Department.

## The city

Solmara is a sun-soaked coastal city of four districts: the Old Town
plaza blocks, the rich Hills, the working Harbor, and the Marina with
its beach and the Sunspill Diner. Streets carry live traffic that
queues, brakes, and stops at lights; sidewalks carry people who stroll,
cross, and run when things get loud.

## What you can do

- Walk, run, punch, and shoot (pistol, mouse aim), with health that
  recovers when you stay out of trouble.
- Steal and drive six kinds of vehicle: sedan, taxi, pickup, sports
  car, van, and the SPD Interceptor itself, each with its own speed,
  acceleration, grip, and paint.
- Break the law in front of witnesses and earn up to five wanted stars.
  Cruisers ram you, officers chase on foot and arrest you if they hold
  you, and the heat fades when nobody in uniform can see you. A respray
  at Shine & Go in the Harbor clears it for $100.
- Take five story jobs from Mara's phone: First Fare, Borrowed Wheels,
  Harbor Run, The Informant, and Sunset Getaway, with briefings,
  markers, timers, and cash rewards that unlock the next job.
- Live HUD: cash, health, wanted stars, the clock, the district you are
  in, speed or ammo, and a minimap that tracks cars, police, and your
  objective.
- Progress saves itself to the browser: cash, ammo, and finished jobs
  are still there when you come back.

## Controls

- WASD / arrows: walk and drive
- Shift: run · Space: handbrake
- E: get in / out of a car
- F: punch · Mouse: aim, click to shoot
- Tab: Mara's phone (mission select, number keys take a job)
- P / Esc: pause

## Running it

Serve the `game/` folder with any static file server and open
`index.html`, or from this repository root:

```
node serve.ts          # then visit http://localhost:8080
```

Deterministic staged scenes for screenshots live behind a query
parameter: `index.html?shot=start`, `?shot=chase`, `?shot=mission`,
`?shot=city`. Each is seeded and stepped the same way every time, so a
scene always renders the same frame. The manifest is `shots.json`.

## How it is built

One file, one job, all under `game/src/`:

- `config.js` — world geometry, vehicle catalogue, tuning numbers
- `random.js` — the seeded generator the whole city is built from
- `world.js` — generates Solmara: streets, blocks, buildings, beach
- `input.js` — keyboard and mouse state
- `vehicles.js` — car physics, traffic AI, traffic lights
- `pedestrians.js` — the crowd: strolling, fleeing, falling
- `police.js` — wanted level, witnesses, chases, arrests
- `combat.js` — fists, pistol, bullets, damage, particles
- `missions.js` — the five story jobs and their stages
- `render.js` — draws the city and everything moving in it
- `hud.js` — HUD, live minimap, menus, title and end screens
- `audio.js` — WebAudio-synthesized effects, engine hum, sirens
- `shots.js` — the deterministic screenshot scenes
- `main.js` — state, the game loop, collisions, camera, saving

The entry program at the repository root, `main.ts`, hands the game
in: it copies `game/` and `screenshots/` to the output directory and
writes the dossier with the kit's library in `vendor/`.

## License

MIT. Everything in Solmara — the city, the people, the cars, the
story — is original to this repository.
