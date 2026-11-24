// vehicles.js — everything about cars as physical things: how they are
// made, how traffic drives itself along the streets, and how the player's
// car answers the keys. Police behaviour lives in police.js; this file
// only moves metal.

import { CAR_TYPES, WORLD } from './config.js';
import { streetCenters } from './world.js';
import { pick, randRange } from './random.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, role, rng) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId++,
    type, x, y, angle, speed: 0,
    color: pick(rng, spec.colors),
    role, // 'parked' | 'traffic' | 'police' | 'player' | 'target'
    hp: 100,
    axis: angle === 0 || angle === Math.PI ? 'h' : 'v',
    dir: angle === Math.PI || angle === -Math.PI / 2 ? -1 : 1,
    cruise: spec.topSpeed * randRange(rng, 0.42, 0.58),
    skid: 0,
  };
}

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'pickup', 'van', 'sports'];

export function spawnParked(world, rng) {
  return world.parkedSpots.map((s) =>
    makeCar(pick(rng, TRAFFIC_TYPES), s.x, s.y, s.angle, 'parked', rng));
}

export function spawnTraffic(world, rng, count) {
  const { v, h } = streetCenters();
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() > 0.5;
    const line = vertical ? pick(rng, v) : pick(rng, h);
    const along = randRange(rng, 60, vertical ? WORLD.h - 120 : WORLD.w - 120);
    const angle = vertical ? (rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() > 0.5 ? 0 : Math.PI);
    const car = makeCar(pick(rng, TRAFFIC_TYPES), vertical ? line : along, vertical ? along : line, angle, 'traffic', rng);
    snapToLane(car);
    cars.push(car);
  }
  return cars;
}

// Right-hand traffic: a car sits a little to the right of its street's
// center line for the direction it travels.
export function snapToLane(car) {
  const { v, h } = streetCenters();
  if (car.axis === 'v') {
    const line = nearest(v, car.x);
    car.x = line + (car.dir > 0 ? 13 : -13);
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const line = nearest(h, car.y);
    car.y = line + (car.dir > 0 ? -13 : 13);
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
}

function nearest(list, value) {
  let best = list[0];
  for (const item of list) if (Math.abs(item - value) < Math.abs(best - value)) best = item;
  return best;
}

// Traffic lights run on one city-wide cycle: vertical streets get the
// green for half of it, horizontal streets for the other half.
export function lightGreenFor(axis, t) {
  const phase = Math.floor(t / 6) % 2;
  return axis === 'v' ? phase === 0 : phase === 1;
}

function distToNextIntersection(car) {
  const pitch = 216;
  const along = car.axis === 'v' ? car.y : car.x;
  const into = ((along % pitch) + pitch) % pitch;
  return car.dir > 0 ? pitch - into : into;
}

// Traffic drives itself: hold a cruise speed, brake for the car ahead,
// stop at red lights, and sometimes turn at intersections.
export function updateTraffic(G, dt) {
  const { v, h } = streetCenters();
  for (const car of G.cars) {
    if (car.role !== 'traffic') continue;
    let target = car.cruise;
    // brake for whoever is ahead in the same lane and direction
    for (const other of G.cars) {
      if (other === car || other.role === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = car.axis === 'v' ? (Math.abs(dx) < 20 && dy * car.dir > 0 && dy * car.dir < 74)
        : (Math.abs(dy) < 20 && dx * car.dir > 0 && dx * car.dir < 74);
      if (ahead) target = Math.min(target, other.speed * 0.9);
    }
    const gap = distToNextIntersection(car);
    if (gap > 26 && gap < 62 && !lightGreenFor(car.axis, G.time)) target = 0;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 190 * dt);
    if (car.axis === 'v') car.y += car.dir * car.speed * dt;
    else car.x += car.dir * car.speed * dt;
    // at an intersection, sometimes turn onto the crossing street
    if (gap < 30 && car.speed > 4 && G.rng() < dt * 0.55) {
      car.axis = car.axis === 'v' ? 'h' : 'v';
      car.dir = G.rng() > 0.5 ? 1 : -1;
      if (car.axis === 'h') car.y = nearest(h, car.y); else car.x = nearest(v, car.x);
      snapToLane(car);
    }
    // wrap around the world edge so traffic never runs out
    if (car.x < -60) car.x = WORLD.w + 40; if (car.x > WORLD.w + 60) car.x = -40;
    if (car.y < -60) car.y = WORLD.h + 40; if (car.y > WORLD.h + 60) car.y = -40;
  }
}

// The player's car: throttle, brake/reverse, speed-sensitive steering,
// and a handbrake that breaks the rear loose (skid marks + dust).
export function drivePlayerCar(G, dt, input) {
  const car = G.player.car;
  if (!car) return;
  const spec = CAR_TYPES[car.type];
  if (input.up) car.speed += spec.accel * dt;
  else if (input.down) car.speed -= (car.speed > 6 ? 320 : spec.accel * 0.55) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 60 * dt);
  car.speed = Math.max(-spec.topSpeed * 0.38, Math.min(spec.topSpeed, car.speed));
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const grip = spec.grip * Math.min(1, Math.abs(car.speed) / 120) * (input.handbrake ? 1.7 : 1);
  if (steer !== 0 && car.speed !== 0) car.angle += steer * grip * dt * Math.sign(car.speed);
  car.skid = input.handbrake && Math.abs(car.speed) > 130 ? 1 : Math.max(0, car.skid - dt * 3);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;
}
