// Solmara: Streets of the Sun — the game itself.
// This file owns the state object and the frame loop, and wires the other modules
// together: the city from world.js, the cars from vehicles.js, the people from
// pedestrians.js, the law from police.js, the story from missions.js, the fighting from
// combat.js, the picture from render.js, the HUD from hud.js and the noise from
// audio.js. The loop is the same on every machine: update with a clamped step, draw,
// and repeat. A ?shot= URL stages one fixed scene and draws it once, for screenshots.

import { WORLD, PLAYER, GAME, LANDMARKS, clamp, dist2 } from './config.js';
import { makeRng, rngRange } from './random.js';
import { buildCity, collideBuildings, pointInBuilding, districtAt } from './world.js';
import { createInput, moveVector } from './input.js';
import { makeCar, spawnParkedCar, spawnTrafficCar, driveCar, updateTrafficCar, collideCars } from './vehicles.js';
import { makePedestrian, spawnPedestrian, updatePedestrian, knockPedestrianDown } from './pedestrians.js';
import { addWanted, clearWanted, updateCruiser, updateOfficer, updateWanted } from './police.js';
import { createMissionState, startMission, updateMission } from './missions.js';
import { playerPunch, playerShoot, updateBullets, updateThug } from './combat.js';
import { createAudio } from './audio.js';
import { createCamera, updateCamera, drawWorld, drawEntities, drawOffscreenArrow } from './render.js';
import { drawHud, drawTitle, drawPause, drawJobs, drawEndScreen } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- State ---

function createState() {
  const state = {
    screen: 'title',
    time: 0,
    clockMinutes: GAME.startTimeMinutes,
    day: 1,
    city: null,
    rng: makeRng(20261124),
    player: {
      x: LANDMARKS.safehouse.x,
      y: LANDMARKS.safehouse.y + 40,
      angle: Math.PI / 2,
      health: PLAYER.health,
      cash: PLAYER.startCash,
      ammo: PLAYER.startAmmo,
      car: null,
      punchCooldown: 0,
      shootCooldown: 0,
      punchAnim: 0,
      hurtFlash: 0,
    },
    cars: [],
    peds: [],
    thugs: [],
    officers: [],
    policeCruisers: [],
    bullets: [],
    particles: [],
    skids: [],
    wanted: 0,
    lastCrimeAt: -999,
    lastSeenAt: -999,
    missions: createMissionState(),
    missionCompleteAt: 0,
    camera: createCamera(),
    shake: 0,
    toastText: '',
    toastUntil: 0,
    scare: null,
    jobCursor: 0,
    saveExists: false,
    audio: createAudio(),
    input: createInput(),
    shotMode: null,
  };
  state.toast = (text) => {
    state.toastText = text;
    state.toastUntil = state.time + 4;
  };
  state.spawnParticles = (x, y, count, color) => {
    for (let i = 0; i < count; i += 1) {
      const a = state.rng() * Math.PI * 2;
      const speed = rngRange(state.rng, 30, 160);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: rngRange(state.rng, 0.3, 0.8),
        maxLife: 0.8,
        color,
        size: rngRange(state.rng, 2, 5),
      });
    }
  };
  state.busted = () => {
    state.player.cash = Math.max(0, state.player.cash - 100);
    state.player.health = PLAYER.health;
    clearWanted(state);
    leaveCar(state);
    state.player.x = LANDMARKS.safehouse.x;
    state.player.y = LANDMARKS.safehouse.y + 40;
    state.screen = 'busted';
    state.audio.busted();
  };
  state.wasted = () => {
    state.player.cash = Math.max(0, state.player.cash - 100);
    state.player.health = PLAYER.health;
    clearWanted(state);
    leaveCar(state);
    state.player.x = LANDMARKS.safehouse.x;
    state.player.y = LANDMARKS.safehouse.y + 40;
    state.screen = 'wasted';
    state.audio.busted();
  };
  return state;
}

const state = createState();
window.__solmara = state;

// --- World setup ---

function populateWorld() {
  state.city = buildCity(20261124);
  state.rng = makeRng(20261124);
  state.cars = [];
  state.peds = [];
  state.thugs = [];
  state.officers = [];
  state.policeCruisers = [];
  state.bullets = [];
  state.particles = [];
  state.skids = [];
  // A few parked cars near the safehouse so Mara can get moving at once.
  for (let i = 0; i < 8; i += 1) state.cars.push(spawnParkedCar(state.city, state.rng));
  for (let i = 0; i < 12; i += 1) state.cars.push(spawnTrafficCar(state.city, state.rng));
  for (let i = 0; i < 22; i += 1) state.peds.push(spawnPedestrian(state, state.rng));
  // The gold Comet for job 2 waits by the plaza from the start, parked and tempting.
  const comet = makeCar('sports', 1620, 1150, 0, null);
  comet.color = '#e8c820';
  state.cars.push(comet);
}

function topUpPopulation() {
  const p = state.player;
  state.cars = state.cars.filter((car) => {
    if (car === p.car) return true;
    if (car.driver === 'police') return true;
    const m = state.missions.active;
    if (m && m.targetCar === car) return true;
    return dist2(car.x, car.y, p.x, p.y) < 1400 * 1400;
  });
  let traffic = state.cars.filter((c) => c.driver === 'traffic').length;
  while (traffic < 12) {
    const car = spawnTrafficCar(state.city, state.rng);
    state.cars.push(car);
    traffic += 1;
  }
  state.peds = state.peds.filter((ped) => dist2(ped.x, ped.y, p.x, p.y) < 1200 * 1200);
  while (state.peds.length < 20) state.peds.push(spawnPedestrian(state, state.rng));
}

// --- Getting in and out of cars ---

function nearestCar(maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.health <= 0) continue;
    const d2 = dist2(p.x, p.y, car.x, car.y);
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}

function enterCar(state) {
  const car = nearestCar(64);
  if (!car) {
    state.toast('No car close enough. Walk up to one and press E.');
    return;
  }
  // A traffic car has a driver: they get out, upset, and the theft is a crime.
  if (car.driver === 'traffic') {
    const driver = makePedestrian(car.x + 30, car.y + 30, state.rng);
    driver.fleeing = 2;
    state.peds.push(driver);
    addWanted(state, 1, 'Car stolen in broad daylight');
  } else if (car.driver === null) {
    addWanted(state, 1, 'Car stolen');
  } else if (car.driver === 'police') {
    addWanted(state, 2, 'You stole a police cruiser');
  }
  car.driver = 'player';
  car.route = null;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.audio.pickup();
  state.toast(`Driving the ${car.name}. W to go, S to brake, A and D to steer.`);
}

function leaveCar(state) {
  const car = state.player.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  state.player.car = null;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  const circle = { x: state.player.x, y: state.player.y, r: PLAYER.radius };
  collideBuildings(state.city, circle);
  state.player.x = circle.x;
  state.player.y = circle.y;
}

// --- Save and load ---

function saveGame() {
  const p = state.player;
  const data = {
    cash: p.cash,
    health: p.health,
    ammo: p.ammo,
    completed: state.missions.completed,
    x: p.x,
    y: p.y,
    day: state.day,
    clockMinutes: state.clockMinutes,
  };
  try {
    localStorage.setItem(GAME.saveKey, JSON.stringify(data));
    state.saveExists = true;
    state.toast('Game saved.');
  } catch {
    state.toast('Could not save.');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(GAME.saveKey);
    if (!raw) {
      state.toast('No save found.');
      return;
    }
    const data = JSON.parse(raw);
    const p = state.player;
    leaveCar(state);
    p.cash = data.cash;
    p.health = data.health;
    p.ammo = data.ammo;
    p.x = data.x;
    p.y = data.y;
    state.day = data.day || 1;
    state.clockMinutes = data.clockMinutes || GAME.startTimeMinutes;
    state.missions.completed = data.completed || [];
    state.camera.x = p.x;
    state.camera.y = p.y;
    state.toast('Save loaded.');
  } catch {
    state.toast('That save would not load.');
  }
}

// --- The frame ---

function updatePlayerOnFoot(dt) {
  const p = state.player;
  const input = state.input;
  const move = moveVector(input);
  const speed = input.is('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (move.x !== 0 || move.y !== 0) {
    p.angle = Math.atan2(move.y, move.x);
    const nx = p.x + move.x * speed * dt;
    const ny = p.y + move.y * speed * dt;
    const circle = { x: nx, y: ny, r: PLAYER.radius };
    if (!collideBuildings(state.city, circle)) {
      p.x = nx;
      p.y = ny;
    } else {
      // Try sliding along one axis when the diagonal is blocked.
      const cx = { x: nx, y: p.y, r: PLAYER.radius };
      if (!collideBuildings(state.city, cx)) p.x = nx;
      const cy = { x: p.x, y: ny, r: PLAYER.radius };
      if (!collideBuildings(state.city, cy)) p.y = ny;
    }
    p.x = clamp(p.x, WORLD.beachEdge + 8, WORLD.width - 8);
    p.y = clamp(p.y, 8, WORLD.height - 8);
    if (input.is('run') && state.rng() < 0.25) {
      state.spawnParticles(p.x, p.y + 10, 1, '#d8c9a0');
    }
  }
  // Cars are solid to a pedestrian: push Mara out of them.
  for (const car of state.cars) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d2 = dx * dx + dy * dy;
    const min = car.length * 0.42;
    if (d2 < min * min && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = car.x + (dx / d) * min;
      p.y = car.y + (dy / d) * min;
    }
  }
  if (input.wasPressed('punch')) playerPunch(state);
  if (input.is('shoot')) playerShoot(state);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.punchAnim = Math.max(0, p.punchAnim - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
}

function updatePlayerDriving(dt) {
  const p = state.player;
  const car = p.car;
  const input = state.input;
  const throttle = input.is('up') ? 1 : input.is('down') ? -1 : 0;
  const steer = input.is('left') ? -1 : input.is('right') ? 1 : 0;
  driveCar(car, { throttle, steer }, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Skid marks when the tyres let go.
  if (car.skid > 0 && Math.abs(car.speed) > 200) {
    const bx = car.x - Math.cos(car.angle) * car.length * 0.4;
    const by = car.y - Math.sin(car.angle) * car.length * 0.4;
    state.skids.push({ x1: bx, y1: by, x2: bx + Math.cos(car.angle) * 6, y2: by + Math.sin(car.angle) * 6 });
    if (state.skids.length > 240) state.skids.splice(0, state.skids.length - 240);
  }
  // Running a pedestrian over is a crime, and it knocks them flat.
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (dist2(car.x, car.y, ped.x, ped.y) < 30 * 30 && Math.abs(car.speed) > 90) {
      knockPedestrianDown(ped, 3);
      addWanted(state, 1, 'Pedestrian hit');
      state.spawnParticles(ped.x, ped.y, 8, '#ffd27d');
      state.shake = Math.max(state.shake, 5);
    }
  }
  // A wrecked car dies under Mara: she is left standing beside it.
  if (car.health <= 0) {
    state.spawnParticles(car.x, car.y, 16, '#8a8a8a');
    state.toast('The car is wrecked. Find another one.');
    leaveCar(state);
  }
  // Repairs and a new coat of paint, bought with cash while driving.
  if (input.wasPressed('repair') && car.health < 100 && p.cash >= 40) {
    p.cash -= 40;
    car.health = 100;
    state.toast('Car repaired — $40.');
    state.audio.pickup();
  }
  if (input.wasPressed('repaint') && p.cash >= 50) {
    p.cash -= 50;
    const colors = ['#d42a2a', '#3d6fb4', '#e8c820', '#4a7a5a', '#222831', '#e8e8e8'];
    car.color = colors[Math.floor(state.rng() * colors.length)];
    state.toast('New paint job — $50.');
    state.audio.pickup();
  }
}

function updatePlay(dt) {
  const input = state.input;
  state.time += dt;
  state.clockMinutes += dt * GAME.minutesPerSecond;
  if (state.clockMinutes >= 24 * 60) {
    state.clockMinutes -= 24 * 60;
    state.day += 1;
  }

  if (input.wasPressed('pause')) {
    state.screen = 'pause';
    return;
  }
  if (input.wasPressed('jobs')) {
    state.screen = 'jobs';
    return;
  }
  if (input.wasPressed('save')) saveGame();
  if (input.wasPressed('load')) loadGame();

  if (state.player.car) updatePlayerDriving(dt);
  else updatePlayerOnFoot(dt);
  if (input.wasPressed('enterCar')) {
    if (state.player.car) leaveCar(state);
    else enterCar(state);
  }

  for (const car of state.cars) {
    if (car.driver === 'traffic') updateTrafficCar(state, car, dt);
    if (car.driver === 'police') updateCruiser(state, car, dt);
  }
  collideCars(state, dt);

  const danger = state.scare && state.scare.ttl > 0 ? state.scare : null;
  for (const ped of state.peds) updatePedestrian(state, ped, dt, danger, danger ? danger.radius : 0);
  if (state.scare) state.scare.ttl -= dt;
  for (const thug of state.thugs) updateThug(state, thug, dt);
  for (const officer of state.officers) updateOfficer(state, officer, dt);
  updateBullets(state, dt);
  updateMission(state, dt);
  updateWanted(state, dt);
  topUpPopulation();

  // Safehouse: stepping inside with heat on clears it.
  if (state.wanted > 0 && dist2(state.player.x, state.player.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 60 * 60) {
    clearWanted(state, 'Safehouse. The heat is off.');
  }

  // Particles drift and fade.
  for (const part of state.particles) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vx *= 0.96;
    part.vy *= 0.96;
    part.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  // Engine and siren follow the action.
  const car = state.player.car;
  state.audio.engine(car ? car.speed : 0, car ? car.topSpeed : 1);
  state.audio.siren(dt, state.wanted);

  updateCamera(state.camera, state, dt);
}

function updateMenuScreens() {
  const input = state.input;
  if (state.screen === 'title') {
    state.time += 1 / 60;
    updateCamera(state.camera, state, 1 / 60);
    if (input.wasPressed('confirm') || input.anyKey) {
      state.audio.unlock();
      state.screen = 'play';
      state.toast('Welcome to Solmara. Press M for jobs.');
    }
    return;
  }
  if (state.screen === 'pause') {
    if (input.wasPressed('pause') || input.wasPressed('confirm')) state.screen = 'play';
    if (input.wasPressed('jobs')) state.screen = 'jobs';
    if (input.wasPressed('save')) saveGame();
    return;
  }
  if (state.screen === 'jobs') {
    if (input.wasPressed('up')) state.jobCursor = (state.jobCursor + 4) % 5;
    if (input.wasPressed('down')) state.jobCursor = (state.jobCursor + 1) % 5;
    if (input.wasPressed('confirm')) {
      if (startMission(state, state.jobCursor + 1)) state.screen = 'play';
    }
    if (input.wasPressed('jobs') || input.wasPressed('pause')) state.screen = 'play';
    return;
  }
  // busted, wasted, complete, failed: one keypress returns to the street.
  if (input.wasPressed('confirm') || input.anyKey) {
    state.screen = 'play';
    state.missions.failed = null;
  }
}

function render() {
  const view = { w: canvas.width, h: canvas.height };
  ctx.clearRect(0, 0, view.w, view.h);
  // The sun-soaked sky the city sits on, for the edges of the map.
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(0, 0, view.w, view.h);
  drawWorld(ctx, state, state.camera, view);
  drawEntities(ctx, state, state.camera, view);
  drawOffscreenArrow(ctx, state, state.camera, view);
  if (state.screen === 'play' || state.screen === 'pause' || state.screen === 'jobs') {
    drawHud(ctx, state, view);
  }
  if (state.screen === 'title') drawTitle(ctx, state, view);
  else if (state.screen === 'pause') drawPause(ctx, view);
  else if (state.screen === 'jobs') drawJobs(ctx, state, view);
  else if (state.screen === 'busted') drawEndScreen(ctx, view, 'busted');
  else if (state.screen === 'wasted') drawEndScreen(ctx, view, 'wasted');
  else if (state.screen === 'complete') {
    const done = state.missions.completed[state.missions.completed.length - 1];
    drawEndScreen(ctx, view, 'complete', done ? `Job ${done} done. ${state.missions.completed.length} of 5 jobs finished.` : '');
  } else if (state.screen === 'failed') {
    const failed = state.missions.failed;
    drawEndScreen(ctx, view, 'failed', failed ? failed.reason : '');
  }
}

let lastNow = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
  lastNow = now;
  if (state.screen === 'play') updatePlay(dt);
  else updateMenuScreens();
  render();
  state.input.endFrame();
  if (!state.shotMode) requestAnimationFrame(frame);
}

// --- Boot ---

function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  populateWorld();
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  try {
    state.saveExists = !!localStorage.getItem(GAME.saveKey);
  } catch {
    state.saveExists = false;
  }
  if (shot) {
    // A screenshot scene: stage it exactly, draw it once, and stop. No loop, no
    // clock, no input — the frame is the same every time the URL is opened.
    state.shotMode = shot;
    stageShot(shot, state);
    state.camera.x = state.camera.x;
    render();
    return;
  }
  requestAnimationFrame(frame);
}

boot();
