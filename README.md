# Solmara: Streets of the Sun

A 2D top-down open-world crime game that runs offline in a desktop browser from
static files. No build step, no libraries, no network: plain ES modules under
`game/src/`, drawn on one canvas, with sound synthesized live by WebAudio.

## The game

Mara Voss is a courier drawn back into the underworld of Solmara, a sun-soaked
coastal city with a marina, an old town, a harbour, hills, a beach, a park and a
plaza. Walk the streets, steal any of six car types, outrun the police, and work
through five story jobs to take the city back.

- **City** — a grid of streets with named districts, buildings, trees, a beach and
  a coast, traffic lights, crosswalks and street furniture, all generated from a
  seed so the same city is the same every time.
- **On foot and by car** — walk and run, punch, fire a pistol, get in and out of
  cars with E. Six car types (sedan, taxi, pickup, sports Comet, van, police
  cruiser) with distinct speed, acceleration and handling.
- **Traffic and pedestrians** — traffic cars follow the roads, keep their lane,
  brake for the car ahead and stop at red lights; pedestrians walk the sidewalks
  and run from gunfire and crashes.
- **Wanted level** — 0 to 5 stars. Stealing cars, hitting pedestrians, assault and
  killing officers raise it. Police cruisers chase and ram; foot officers chase
  and arrest. Hide out of sight and the heat fades; the safehouse clears it.
- **Missions and story** — five jobs with briefing text, markers, timers and pay:
  First Fare ($120), Borrowed Wheels ($200), Harbor Run ($300), The Informant
  ($350), Sunset Getaway ($500). Take jobs from Mara's phone (M).
- **Combat** — punch (J) and pistol (K, with ammo). Thugs chase and swing; officers
  can be fought, at the cost of two stars.
- **HUD** — cash, health, wanted stars, ammo, job banner, live minimap (player,
  cars, police, job marker), clock and day, speed and car health while driving.
- **Menus and save** — title, pause, job phone, job complete / failed, busted and
  wasted screens. Save with Q, load with L (localStorage).
- **Feel** — a camera that follows with a look-ahead, skid marks, dust, sparks and
  smoke, screen shake, engine hum and a two-tone siren, all synthesized.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move on foot, drive a car |
| Shift | Run |
| E | Enter or leave a car |
| J | Punch |
| K | Fire pistol |
| M | Jobs (Mara's phone) |
| P / Esc | Pause |
| Q | Save |
| L | Load |
| R | Repair car ($40) |
| C | Repaint car ($50) |
| Enter | Confirm / start |

## Play it

Serve `game/` with any static server and open it in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

## Screenshots

The four screenshots in `screenshots/` are real renders of this game's own code,
taken through `?shot=1` to `?shot=4`: the title screen, a three-star chase, the
Informant job on foot, and a wide view of the city.

## Source layout

| File | Job |
| --- | --- |
| `game/src/config.js` | Constants: city, cars, wanted rules, jobs |
| `game/src/random.js` | Seeded RNG |
| `game/src/world.js` | City generation and collision queries |
| `game/src/input.js` | Keyboard state |
| `game/src/vehicles.js` | Car physics, traffic AI, car collisions |
| `game/src/pedestrians.js` | Pedestrian AI |
| `game/src/police.js` | Wanted level, cruisers, officers, arrest |
| `game/src/missions.js` | The five story jobs |
| `game/src/combat.js` | Punch, pistol, bullets, thugs |
| `game/src/render.js` | Drawing the city, cars and people |
| `game/src/hud.js` | HUD, minimap and menus |
| `game/src/audio.js` | Synthesized sound |
| `game/src/shots.js` | Deterministic `?shot=` scenes |
| `game/src/main.js` | State, frame loop, save/load |

## Handing it in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` with the kit's vendored library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Run it twice: the output is byte-identical both times.

## License

MIT. All names, characters, vehicles, story, art and sounds are original.

## Credits

Built for the make.fun gta6-01 bounty ("Make GTA 6"). Solmara, Mara Voss, the
Comet, and every street name are invented for this game; nothing here is taken
from any commercial game.
