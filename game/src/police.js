// police.js — the law of Solmara: the wanted level, who witnesses a
// crime, the cruisers and officers who answer it, and the arrest when
// they hold the player long enough. One job: consequences.

import { WANTED, WORLD } from './config.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { streetCenters } from './world.js';

export function commitCrime(G, amount, x, y) {
  let witnessed = false;
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < WANTED.sightRange) { witnessed = true; break; }
  }
  if (!witnessed) {
    for (const car of G.cars) {
      if (car.role === 'police' && Math.hypot(car.x - x, car.y - y) < WANTED.sightRange) { witnessed = true; break; }
    }
  }
  G.wanted.stars = Math.min(WANTED.max, G.wanted.stars + amount * (witnessed ? 1 : 0.35));
  G.wanted.lastCrimeAt = G.time;
}

function roadPointNear(G, dist) {
  const { v, h } = streetCenters();
  const a = G.rng() * Math.PI * 2;
  const x = Math.max(30, Math.min(WORLD.w - 30, G.player.x + Math.cos(a) * dist));
  const y = Math.max(30, Math.min(WORLD.h - 30, G.player.y + Math.sin(a) * dist));
  // snap to the nearest street center crossing so cruisers spawn on roads
  const nx = v.reduce((p, c) => (Math.abs(c - x) < Math.abs(p - x) ? c : p), v[0]);
  const ny = h.reduce((p, c) => (Math.abs(c - y) < Math.abs(p - y) ? c : p), h[0]);
  return G.rng() > 0.5 ? { x: nx, y } : { x, y: ny };
}

function spawnCopCar(G) {
  const p = roadPointNear(G, 520);
  const car = makeCar('police', p.x, p.y, Math.atan2(G.player.y - p.y, G.player.x - p.x), 'police', G.rng);
  G.cars.push(car);
}

function spawnOfficer(G) {
  const p = roadPointNear(G, 300);
  const cop = makePed(p.x, p.y, G.rng, 'officer');
  cop.state = 'chase';
  G.peds.push(cop);
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  const stars = Math.floor(w.stars);
  const copCars = G.cars.filter((c) => c.role === 'police');
  const officers = G.peds.filter((p) => p.kind === 'officer' && p.state !== 'down');

  // Reinforce toward the heat: more stars, more cruisers.
  w.spawnTimer -= dt;
  if (stars >= 1 && copCars.length < Math.min(4, stars + 1) && w.spawnTimer <= 0) {
    spawnCopCar(G);
    w.spawnTimer = 2.5;
  }
  if (stars >= 2 && officers.length < stars && w.spawnTimer <= 0 && !G.player.car) {
    spawnOfficer(G);
    w.spawnTimer = 3;
  }
  // Far-away police give up and leave the world.
  for (const car of copCars) {
    if (Math.hypot(car.x - G.player.x, car.y - G.player.y) > 1400 && w.stars < 0.5) car.role = 'gone';
  }
  G.cars = G.cars.filter((c) => c.role !== 'gone');

  // Cruisers hunt: steer at the player, match speed, ram when close.
  for (const car of copCars) {
    const dx = G.player.x - car.x;
    const dy = G.player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const top = 430 * (0.72 + stars * 0.06);
    const target = dist > 60 ? top : Math.min(top, Math.abs(G.player.speed || 0) + 30);
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 300 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }

  // Officers chase on foot and hold the player for an arrest.
  let holding = false;
  for (const cop of officers) {
    const dx = G.player.x - cop.x;
    const dy = G.player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      cop.angle = Math.atan2(dy, dx);
      const sp = G.player.car ? 0 : 205;
      cop.x += Math.cos(cop.angle) * sp * dt;
      cop.y += Math.sin(cop.angle) * sp * dt;
    }
    if (dist < 30 && !G.player.car) holding = true;
  }
  if (holding && stars >= 1) {
    w.bust += dt;
    if (w.bust >= WANTED.bustTime) G.mode = 'busted';
  } else {
    w.bust = Math.max(0, w.bust - dt * 2);
  }

  // Out of sight, out of mind: the heat cools when nobody in uniform is
  // near, and standing at the safehouse cools it at once.
  const nearCop = copCars.some((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 560)
    || officers.some((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 300);
  const atSafe = Math.hypot(G.player.x - G.world.places.safehouse.x, G.player.y - G.world.places.safehouse.y) < 70;
  if ((!nearCop && G.time - w.lastCrimeAt > 4) || atSafe) {
    w.stars = Math.max(0, w.stars - WANTED.decayPerSec * dt * (atSafe ? 14 : 1));
  }
}
