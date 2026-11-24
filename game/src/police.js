// Solmara — the wanted system and the police who answer it.
// Wanted runs 0 to 5 stars. Crimes add stars; hiding sheds them. The police force
// scales with the stars: cruisers chase and ram, foot officers chase and arrest. A
// cruiser is just a car with a police brain; an officer is a person with an arrest
// timer. The safehouse clears the slate.

import { WANTED, POLICE, WORLD, clamp, dist2 } from './config.js';
import { makeCar } from './vehicles.js';
import { rngRange, rngPick } from './random.js';
import { randomRoadPoint } from './world.js';

let nextOfficerId = 1;

export function addWanted(state, stars, reason) {
  if (state.wanted >= WANTED.maxStars) return;
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.lastCrimeAt = state.time;
  state.lastSeenAt = state.time;
  if (reason) state.toast(`${reason} — wanted level ${state.wanted}`);
  state.audio.sirenBlip();
}

export function clearWanted(state, reason) {
  if (state.wanted === 0) return;
  state.wanted = 0;
  state.policeCruisers = [];
  state.officers = [];
  if (reason) state.toast(reason);
}

// How many cruisers the current wanted level calls for.
export function cruisersWanted(level) {
  if (level <= 0) return 0;
  if (level <= 1) return 1;
  if (level <= 2) return 2;
  if (level <= 3) return 3;
  if (level <= 4) return 4;
  return 5;
}

// How many foot officers the current wanted level calls for.
export function officersWanted(level) {
  if (level <= 1) return 0;
  if (level <= 3) return 1;
  return 2;
}

function spawnPointNearPlayer(state, distance) {
  const p = state.player;
  for (let tries = 0; tries < 8; tries += 1) {
    const a = rngRange(state.rng, 0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(a) * distance, 360, WORLD.width - 60);
    const y = clamp(p.y + Math.sin(a) * distance, 60, WORLD.height - 60);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > distance * 0.75) return { x, y };
  }
  return { x: clamp(p.x + distance, 360, WORLD.width - 60), y: p.y };
}

export function spawnCruiser(state) {
  const spot = spawnPointNearPlayer(state, POLICE.spawnDistance);
  const road = randomRoadPoint(state.rng);
  const car = makeCar('cruiser', road.x, road.y, 0, 'police');
  car.x = spot.x;
  car.y = spot.y;
  car.speed = 200;
  state.policeCruisers.push(car);
  state.cars.push(car);
  return car;
}

export function spawnOfficer(state) {
  const spot = spawnPointNearPlayer(state, 420);
  const officer = {
    id: nextOfficerId,
    x: spot.x,
    y: spot.y,
    angle: 0,
    speed: POLICE.officerSpeed,
    arrestTimer: 0,
    shirt: '#1d3a6e',
    skin: '#e8b88a',
    health: 60,
    down: false,
    downTimer: 0,
  };
  state.officers.push(officer);
  return officer;
}

// One cruiser's chase step: steer at the player's car (or at Mara on foot), ram it
// when close, and give up slowly if the player is far ahead and out of sight.
export function updateCruiser(state, car, dt) {
  const p = state.player;
  const target = p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const d = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.2, -1, 1);
  const throttle = d > 60 ? 1 : 0.4;
  car.angle += steer * car.turn * clamp(Math.abs(car.speed) / 220, 0.25, 1) * dt * Math.sign(car.speed || 1);
  car.speed = clamp(car.speed + car.accel * throttle * dt, 0, POLICE.cruiserTopSpeed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, WORLD.beachEdge + 10, WORLD.width - 10);
  car.y = clamp(car.y, 10, WORLD.height - 10);
  if (d < 700) state.lastSeenAt = state.time;
  // Ramming: a hard hit on the player's car damages it and shakes the camera.
  if (p.car && d < 42) {
    const impact = Math.abs(car.speed - p.car.speed);
    if (impact > 120) {
      p.car.health -= impact * 0.05;
      state.shake = Math.max(state.shake, 8);
      state.audio.crash();
      state.spawnParticles(p.car.x, p.car.y, 8, '#ffd27d');
    }
    p.car.speed *= 0.82;
    car.speed *= 0.7;
  }
  // A cruiser that flips onto a building edge gets pushed back to a road.
  if (state.city && Math.abs(car.speed) < 4) {
    car.stuckTimer = (car.stuckTimer || 0) + dt;
    if (car.stuckTimer > 5) {
      const spot = spawnPointNearPlayer(state, POLICE.spawnDistance);
      car.x = spot.x;
      car.y = spot.y;
      car.stuckTimer = 0;
    }
  } else {
    car.stuckTimer = 0;
  }
}

// One officer's step: run at Mara, and if they stay close long enough, the arrest
// lands and the screen goes to BUSTED.
export function updateOfficer(state, officer, dt) {
  if (officer.down) {
    officer.downTimer -= dt;
    if (officer.downTimer <= 0) officer.down = false;
    return;
  }
  const p = state.player;
  const dx = p.x - officer.x;
  const dy = p.y - officer.y;
  const d = Math.hypot(dx, dy) || 1;
  officer.angle = Math.atan2(dy, dx);
  // Officers cannot catch a car; they hold position and wait if Mara is driving.
  if (p.car) {
    officer.arrestTimer = 0;
    return;
  }
  const step = officer.speed * dt;
  officer.x += (dx / d) * step;
  officer.y += (dy / d) * step;
  if (d < POLICE.arrestRange) {
    officer.arrestTimer += dt;
    if (officer.arrestTimer > POLICE.arrestSeconds) {
      state.busted();
    }
  } else {
    officer.arrestTimer = Math.max(0, officer.arrestTimer - dt * 2);
  }
}

// Keep the force at the size the wanted level asks for, and fade stars when Mara has
// been out of sight long enough with no fresh crime.
export function updateWanted(state, dt) {
  const wantCruisers = cruisersWanted(state.wanted);
  while (state.policeCruisers.length < wantCruisers) spawnCruiser(state);
  const wantOfficers = officersWanted(state.wanted);
  while (state.officers.length < wantOfficers) spawnOfficer(state);

  if (state.wanted === 0) return;
  const sinceSeen = state.time - state.lastSeenAt;
  const sinceCrime = state.time - state.lastCrimeAt;
  if (sinceSeen > WANTED.hideSeconds && sinceCrime > WANTED.decaySeconds) {
    state.wanted -= 1;
    state.lastCrimeAt = state.time;
    state.lastSeenAt = state.time;
    state.toast(state.wanted === 0 ? 'You lost them. The heat is off.' : `Wanted level down to ${state.wanted}.`);
    if (state.wanted === 0) {
      state.policeCruisers = state.policeCruisers.filter((c) => false);
      state.cars = state.cars.filter((c) => c.driver !== 'police');
      state.officers = [];
    }
  }
}
