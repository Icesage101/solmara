// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused, mission select, and game over (busted, wasted, or all jobs done).
// ?seed=N fixes the city. ?shot=start|chase|mission|city stages that scene
// instead of running the loop, paints it, and sets window.__shotReady.
import {
  PLAYER, PISTOL_AMMO_START, REPAINT_COST, REPAIR_COST, SAVE_KEY, SAFEHOUSE, WORLD,
} from './config.js';
import { createRandom } from './random.js';
import { createCity, districtAt } from './world.js';
import {
  ACT_CONFIRM, ACT_ENTER, ACT_LOAD, ACT_MISSION, ACT_PAUSE, ACT_PUNCH, ACT_REPAIR,
  ACT_REPAINT, ACT_SAVE, ACT_SHOOT, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { makeCar, spawnParkedCars, spawnTrafficCar, driveCar, separateCars, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePeds, scarePeds } from './pedestrians.js';
import { createPolice, addWanted, clearWanted, updatePolice } from './police.js';
import { createCombat, tryPunch, tryShoot, updateBullets } from './combat.js';
import {
  createMissions, startMission, updateMissions, missionObjective, missionMarker,
} from './missions.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SEED = 20261124;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
const input = createInput(canvas);

function makePlayer() {
  return {
    x: PLAYER.startX, y: PLAYER.startY, angle: Math.PI / 2,
    health: PLAYER.health, cash: PLAYER.startCash, ammo: PISTOL_AMMO_START,
    inCar: false, hurt: 0, punchAnim: 0,
    shirt: '#d95f4b', skin: '#c98d5f', hair: '#222222', state: 'walk',
  };
}

const game = {
  seed,
  rng: createRandom(seed),
  city: null,
  player: makePlayer(),
  car: null,
  cars: [],
  peds: [],
  police: createPolice(),
  missions: createMissions(),
  combat: createCombat(),
  particles: [],
  camera: { x: PLAYER.startX, y: PLAYER.startY },
  zoom: 1,
  time: 0,
  clockMinutes: 9 * 60,
  shake: 0,
  toast: '',
  toastTimer: 0,
  screen: 'title',
  overKind: null,
  celebrated: false,
  safehouse: SAFEHOUSE,
  districtName: 'Marina',
  missionMarker: null,
  missionObjective: null,
  audio,
  trafficTimer: 0,
  pedTimer: 0,
};

game.message = function (text, secs) {
  game.toast = text;
  game.toastTimer = secs || 3;
};

game.spawnSparks = function (x, y, n) {
  for (let i = 0; i < n; i += 1) {
    const a = game.rng.range(0, Math.PI * 2);
    const sp = game.rng.range(60, 260);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5, maxLife: 0.5, size: game.rng.range(2, 4.5), color: '#ffd94a',
    });
  }
};

game.spawnDust = function (x, y) {
  game.particles.push({
    x, y,
    vx: game.rng.range(-30, 30), vy: game.rng.range(-30, 30),
    life: 0.7, maxLife: 0.7, size: game.rng.range(4, 8), color: 'rgba(180,160,130,0.7)',
  });
};

game.spawnSmoke = function (x, y) {
  game.particles.push({
    x, y,
    vx: game.rng.range(-15, 15), vy: game.rng.range(-50, -20),
    life: 1.1, maxLife: 1.1, size: game.rng.range(6, 11), color: 'rgba(60,60,60,0.55)',
  });
};

game.enterCar = function (car) {
  if (car.police) {
    game.message('That cruiser is locked.', 2);
    return false;
  }
  if (car.health <= 0) {
    game.message('That wreck will not run.', 2);
    return false;
  }
  game.player.inCar = true;
  game.car = car;
  car.traffic = false;
  car.parked = false;
  if (!car.stolen) {
    car.stolen = true;
    addWanted(game.police, 1);
    game.message('That is grand theft, Mara. The police noticed.', 3);
  }
  audio.click();
  return true;
};

game.exitCar = function () {
  const car = game.car;
  if (!car) return;
  game.player.x = car.x - Math.sin(car.angle) * 34;
  game.player.y = car.y + Math.cos(car.angle) * 34;
  game.player.angle = car.angle;
  game.player.inCar = false;
  game.car = null;
};

game.resetWorld = function () {
  game.rng = createRandom(seed);
  game.city = createCity(seed);
  game.player = makePlayer();
  game.car = null;
  game.cars = spawnParkedCars(game.city, game.rng, 24);
  game.peds = spawnPeds(game.city, game.rng, 42, game.player.x, game.player.y);
  game.police = createPolice();
  game.missions = createMissions();
  game.combat = createCombat();
  game.particles = [];
  game.camera = { x: game.player.x, y: game.player.y };
  game.zoom = 1;
  game.time = 0;
  game.clockMinutes = 9 * 60;
  game.shake = 0;
  game.toast = '';
  game.toastTimer = 0;
  game.trafficTimer = 0;
  game.pedTimer = 0;
  game.celebrated = false;
  // A few traffic cars on the roads from the start.
  for (let i = 0; i < 12; i += 1) {
    game.cars.push(spawnTrafficCar(game.city, game.rng, game.player.x, game.player.y));
  }
};

game.saveGame = function () {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.player.cash,
      health: game.player.health,
      ammo: game.player.ammo,
      completed: game.missions.completed,
      x: game.player.x,
      y: game.player.y,
    }));
  } catch { /* Storage can be off: the save then lasts this visit only. */ }
};

game.loadGame = function () {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      game.message('No save found.', 2);
      return false;
    }
    const data = JSON.parse(raw);
    game.player.cash = data.cash;
    game.player.health = data.health;
    game.player.ammo = data.ammo;
    game.player.x = data.x;
    game.player.y = data.y;
    game.missions.completed = data.completed || game.missions.completed;
    game.message('Save loaded.', 2);
    return true;
  } catch {
    game.message('Save could not be read.', 2);
    return false;
  }
};

function respawn() {
  const p = game.player;
  p.x = SAFEHOUSE.x;
  p.y = SAFEHOUSE.y;
  p.angle = Math.PI / 2;
  p.health = PLAYER.health;
  p.cash = Math.floor(p.cash / 2);
  p.inCar = false;
  game.car = null;
  clearWanted(game.police);
  game.camera.x = p.x;
  game.camera.y = p.y;
  game.screen = 'play';
}

function nearestCar(maxDist) {
  let best = null;
  let bd = maxDist;
  for (const car of game.cars) {
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bd) { bd = d; best = car; }
  }
  for (const car of game.police.cruisers) {
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

game.step = function (dt, keys, harmless) {
  const p = game.player;
  game.time += dt;
  game.clockMinutes += dt;
  if (game.toastTimer > 0) game.toastTimer -= dt;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 26);

  // The player, on foot or behind the wheel.
  if (p.inCar && game.car) {
    const car = game.car;
    const prevSpeed = car.speed;
    driveCar(car, dt, keys.up ? 1 : keys.down ? -1 : 0, (keys.right ? 1 : 0) - (keys.left ? 1 : 0));
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (game.city.pushOutOfBuildings(car, 26)) {
      if (Math.abs(prevSpeed) > 120 && !harmless && car.buildingCooldown <= 0) {
        car.buildingCooldown = 0.8;
        car.health -= 8;
        game.shake = Math.max(game.shake, 8);
        audio.crash();
        game.spawnSparks(car.x, car.y, 10);
      }
      car.speed *= 0.45;
    }
    if (Math.abs(car.speed) > 200 && (keys.left || keys.right) && game.rng.chance(0.3)) {
      game.spawnDust(car.x - Math.cos(car.angle) * 26, car.y - Math.sin(car.angle) * 26);
    }
    if (car.health < 45 && game.rng.chance(0.25)) game.spawnSmoke(car.x, car.y - 10);
    if (car.hitCooldown > 0) car.hitCooldown -= dt;
    if (car.buildingCooldown > 0) car.buildingCooldown -= dt;
    if (car.health <= 0) {
      game.message('The car is wrecked.', 3);
      game.exitCar();
    }
    // Running over a pedestrian is a crime the whole street sees.
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 50 && !harmless) {
        ped.state = 'down';
        ped.health = 0;
        addWanted(game.police, 1);
        game.shake = Math.max(game.shake, 6);
        audio.crash();
        game.spawnSparks(ped.x, ped.y, 8);
        scarePeds(game.peds, ped.x, ped.y, 260);
        car.speed *= 0.7;
      }
    }
    audio.engine(Math.abs(car.speed) / car.spec.top, true);
  } else {
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      const speed = keys.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.angle = Math.atan2(my, mx);
    }
    p.x = Math.max(60, Math.min(WORLD - 60, p.x));
    p.y = Math.max(60, Math.min(WORLD - 60, p.y));
    game.city.pushOutOfBuildings(p, PLAYER.radius);
    audio.engine(0, false);
  }

  // Car-to-car bumps.
  const allCars = [...game.cars, ...game.police.cruisers];
  for (let i = 0; i < allCars.length; i += 1) {
    for (let j = i + 1; j < allCars.length; j += 1) {
      const a = allCars[i];
      const b = allCars[j];
      if (Math.abs(a.x - b.x) > 90 || Math.abs(a.y - b.y) > 90) continue;
      if (separateCars(a, b) && (a === game.car || b === game.car)) {
        const other = a === game.car ? b : a;
        if (Math.abs(game.car.speed) > 90 && game.car.hitCooldown <= 0) {
          game.car.hitCooldown = 0.7;
          game.car.health -= 4;
          game.shake = Math.max(game.shake, 5);
          audio.crash();
          game.spawnSparks(game.car.x, game.car.y, 6);
        }
        if (other.traffic) other.speed *= 0.5;
      }
    }
  }

  // Traffic and crowds keep the streets alive.
  game.trafficTimer -= dt;
  if (game.trafficTimer <= 0) {
    game.trafficTimer = 0.8;
    const traffic = game.cars.filter((c) => c.traffic).length;
    if (traffic < 14) game.cars.push(spawnTrafficCar(game.city, game.rng, p.x, p.y));
    game.cars = game.cars.filter((c) => {
      if (c === game.car) return true;
      if (c.traffic && Math.hypot(c.x - p.x, c.y - p.y) > 2100) return false;
      return true;
    });
  }
  game.pedTimer -= dt;
  if (game.pedTimer <= 0) {
    game.pedTimer = 1.5;
    const alive = game.peds.filter((ped) => ped.state !== 'down').length;
    if (alive < 34) game.peds.push(...spawnPeds(game.city, game.rng, 4, p.x, p.y));
    game.peds = game.peds.filter((ped) => ped.state === 'down' || Math.hypot(ped.x - p.x, ped.y - p.y) < 1900 || ped.thug);
  }
  for (const car of game.cars) {
    if (car.traffic) {
      // Traffic cars drive their street; parked ones stay put.
      updateTraffic(car, dt, game.city, allCars, game.rng);
    }
  }
  updatePeds(game.peds, dt, game.city, p, game.rng);
  updateBullets(game, dt);

  // The police, the missions and the player's health.
  if (!harmless) {
    const result = updatePolice(game.police, dt, game, game.city, game.rng);
    if (result === 'busted') {
      game.screen = 'over';
      game.overKind = 'busted';
      audio.busted();
      game.saveGame();
    }
    updateMissions(game, dt);
    if (p.hurt > 0) {
      p.health -= p.hurt;
      p.hurt = 0;
      game.shake = Math.max(game.shake, 4);
    }
    if (p.health < PLAYER.health && game.police.stars === 0) p.health = Math.min(PLAYER.health, p.health + 2 * dt);
    if (p.health <= 0) {
      p.health = 0;
      game.screen = 'over';
      game.overKind = 'wasted';
      audio.busted();
      game.saveGame();
    }
    // The safehouse clears the heat when Mara slips inside its door.
    if (game.police.stars > 0 && Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) < 120) {
      clearWanted(game.police);
      game.message('Safehouse: the heat is off. Breathe, Mara.', 3);
    }
    if (!game.celebrated && game.missions.completed.every(Boolean)) {
      game.celebrated = true;
      game.screen = 'over';
      game.overKind = 'complete';
      audio.missionDone();
    }
  }

  // Particles.
  for (const part of game.particles) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.life -= dt;
  }
  game.particles = game.particles.filter((part) => part.life > 0);

  // Camera follows with a look-ahead in the direction of travel.
  const look = p.inCar && game.car ? Math.min(120, Math.abs(game.car.speed) * 0.35) : 40;
  const tx = p.x + Math.cos(p.angle) * look;
  const ty = p.y + Math.sin(p.angle) * look;
  game.camera.x += (tx - game.camera.x) * Math.min(1, dt * 4);
  game.camera.y += (ty - game.camera.y) * Math.min(1, dt * 4);
  const zoomTarget = game.zoomOverride !== undefined ? game.zoomOverride : (p.inCar ? 0.92 : 1);
  game.zoom += (zoomTarget - game.zoom) * Math.min(1, dt * 2);
  p.punchAnim = game.combat.punchAnim;
  game.districtName = districtAt(p.x, p.y).name;
  game.missionMarker = missionMarker(game);
  game.missionObjective = missionObjective(game);
  audio.siren(game.police.stars > 0 && game.police.cruisers.length > 0, dt);
};

function handleActions() {
  const actions = input.takeActions();
  if (game.screen === 'title' || game.screen === 'over') {
    if (actions & ACT_CONFIRM) {
      audio.unlock();
      if (game.screen === 'over' && (game.overKind === 'busted' || game.overKind === 'wasted')) respawn();
      else if (game.screen === 'over' && game.overKind === 'complete') game.screen = 'play';
      else {
        game.resetWorld();
        game.screen = 'play';
      }
    }
    return;
  }
  if (actions & ACT_PAUSE) {
    game.screen = game.screen === 'paused' ? 'play' : 'paused';
    return;
  }
  if (game.screen === 'mission') {
    if (actions & (ACT_MISSION | ACT_PAUSE)) game.screen = 'play';
    return;
  }
  if (actions & ACT_MISSION) {
    game.screen = 'mission';
    return;
  }
  if (actions & ACT_SAVE) {
    game.saveGame();
    game.message('Game saved.', 2);
  }
  if (actions & ACT_LOAD) game.loadGame();
  if (game.screen !== 'play') return;
  if (actions & ACT_ENTER) {
    audio.unlock();
    if (game.player.inCar) game.exitCar();
    else {
      const car = nearestCar(80);
      if (car) game.enterCar(car);
    }
  }
  if (actions & ACT_PUNCH && !game.player.inCar) tryPunch(game, STEP);
  if (actions & ACT_SHOOT && !game.player.inCar) tryShoot(game);
  if (actions & ACT_REPAIR && game.player.inCar && game.car) {
    if (game.car.health >= 100) game.message('The car is already in good shape.', 2);
    else if (game.player.cash >= REPAIR_COST) {
      game.player.cash -= REPAIR_COST;
      game.car.health = 100;
      game.message('Repaired. -$' + REPAIR_COST, 2);
      audio.pickup();
    } else game.message('Not enough cash to repair ($' + REPAIR_COST + ').', 2);
  }
  if (actions & ACT_REPAINT && game.player.inCar && game.car) {
    if (Math.hypot(game.player.x - SAFEHOUSE.x, game.player.y - SAFEHOUSE.y) > 120) {
      game.message('Repaint is done at the Marina safehouse.', 2.5);
    } else if (game.player.cash >= REPAINT_COST) {
      game.player.cash -= REPAINT_COST;
      const colors = game.car.spec.colors;
      const next = colors[(colors.indexOf(game.car.color) + 1) % colors.length];
      game.car.color = next;
      game.message('Repainted. -$' + REPAINT_COST, 2);
      audio.pickup();
    } else game.message('Not enough cash to repaint ($' + REPAINT_COST + ').', 2);
  }
}

window.addEventListener('keydown', (event) => {
  if (game.screen === 'mission' && /^Digit[1-5]$/.test(event.code)) {
    const index = Number(event.code.slice(5)) - 1;
    if (startMission(game, index)) game.screen = 'play';
  }
  if (game.screen === 'mission' && (event.code === 'ArrowUp' || event.code === 'ArrowDown')) {
    const dir = event.code === 'ArrowUp' ? -1 : 1;
    game.missions.selected = (game.missions.selected + dir + 5) % 5;
  }
  if (game.screen === 'mission' && event.code === 'Enter') {
    if (startMission(game, game.missions.selected)) game.screen = 'play';
  }
});

function runShot(name) {
  game.resetWorld();
  const scene = stageShot(name, game);
  game.screen = scene.screen;
  game.shake = 0; // A staged frame must be the same frame every time.
  if (name === 'city') game.zoom = 0.62;
  let painted = 0;
  function paint() {
    renderer.draw(game);
    if (game.screen === 'title') hud.drawTitle(game);
    else hud.drawHud(game);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  game.resetWorld();
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (game.screen === 'title') {
      // The city lives behind the title screen.
      while (accumulator >= STEP) {
        game.step(STEP, { up: false, down: false, left: false, right: false, run: false }, true);
        accumulator -= STEP;
      }
    } else if (game.screen === 'play') {
      while (accumulator >= STEP) {
        game.step(STEP, {
          up: input.up(), down: input.down(), left: input.left(), right: input.right(), run: input.run(),
        }, false);
        accumulator -= STEP;
        if (game.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game);
    if (game.screen === 'title') hud.drawTitle(game);
    else if (game.screen === 'paused') { hud.drawHud(game); hud.drawPause(game); }
    else if (game.screen === 'mission') { hud.drawHud(game); hud.drawMissionSelect(game); }
    else if (game.screen === 'over') { hud.drawHud(game); hud.drawOver(game, game.overKind); }
    else hud.drawHud(game);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') game.screen = 'paused';
  });

  status.textContent = 'Solmara: Streets of the Sun. Press Enter to play.';
  requestAnimationFrame(frame);
}

// A handle for play-testing and debugging in the browser console.
window.__solmara = game;

if (shot) runShot(shot);
else runGame();
