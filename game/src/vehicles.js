// Solmara — cars: what they are, how they drive, and how traffic thinks.
// A car is a plain object: a type from config, a position, a heading, a speed, and a
// driver. The driver is 'player', a traffic brain, a police brain, or null (parked).
// Driving is arcade physics on purpose: accelerate, steer, brake, skid a little when
// you turn hard at speed. Collisions are circles against buildings and each other.

import { CAR_TYPES, WORLD, clamp, angleLerp, dist2 } from './config.js';
import { makeRng, rngPick, rngRange } from './random.js';
import { collideBuildings, nearestRoadPoint, lightGreenFor } from './world.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, driver) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId++,
    type,
    name: spec.name,
    x,
    y,
    angle,
    speed: 0,
    color: rngPick(makeRng(nextCarId * 7919 + type.length), spec.colors),
    length: spec.length,
    width: spec.width,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    brake: spec.brake,
    turn: spec.turn,
    driver: driver || null,
    health: 100,
    // Traffic brains keep their route here: which road, which way, where next.
    route: null,
    stuckTimer: 0,
    smokeTimer: 0,
    skid: 0,
  };
}

// A parked car on a roadside, engine off, waiting to be borrowed.
export function spawnParkedCar(city, rng, type) {
  for (let tries = 0; tries < 12; tries += 1) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const rx = rngPick(rng, WORLD.roadsX);
      const y = rngRange(rng, 120, WORLD.height - 120);
      const x = rx + (rng() < 0.5 ? -38 : 38);
      return makeCar(type || rngPick(rng, ['sedan', 'pickup', 'van', 'sports']), x, y, rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, null);
    }
    const ry = rngPick(rng, WORLD.roadsY);
    const x = rngRange(rng, 380, WORLD.width - 120);
    const y = ry + (rng() < 0.5 ? -38 : 38);
    return makeCar(type || rngPick(rng, ['sedan', 'taxi', 'pickup', 'van']), x, y, rng() < 0.5 ? 0 : Math.PI, null);
  }
  return makeCar('sedan', 900, 300, 0, null);
}

// A traffic car already rolling on a road, with a route to follow.
export function spawnTrafficCar(city, rng) {
  const vertical = rng() < 0.5;
  let car;
  if (vertical) {
    const rx = rngPick(rng, WORLD.roadsX);
    const dir = rng() < 0.5 ? 1 : -1;
    car = makeCar(rngPick(rng, ['sedan', 'taxi', 'pickup', 'van']), rx + (dir === 1 ? -22 : 22), rngRange(rng, 120, WORLD.height - 120), dir === 1 ? Math.PI / 2 : -Math.PI / 2, 'traffic');
    car.route = { axis: 'x', road: rx, dir, lane: dir === 1 ? -22 : 22 };
  } else {
    const ry = rngPick(rng, WORLD.roadsY);
    const dir = rng() < 0.5 ? 1 : -1;
    car = makeCar(rngPick(rng, ['sedan', 'taxi', 'pickup', 'van', 'sports']), rngRange(rng, 380, WORLD.width - 120), ry + (dir === 1 ? -22 : 22), dir === 1 ? 0 : Math.PI, 'traffic');
    car.route = { axis: 'y', road: ry, dir, lane: dir === 1 ? -22 : 22 };
  }
  car.speed = rngRange(rng, 140, 220);
  return car;
}

// --- Driving ---

// One step of arcade driving. `control` is { throttle: -1..1, steer: -1..1 }.
export function driveCar(car, control, dt) {
  const spec = car;
  const forward = control.throttle;
  if (forward > 0) {
    car.speed += spec.accel * forward * dt;
  } else if (forward < 0) {
    if (car.speed > 8) car.speed -= spec.brake * dt;
    else car.speed += spec.accel * 0.55 * forward * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 90 * dt;
    if (Math.abs(car.speed) < 6) car.speed = 0;
  }
  car.speed = clamp(car.speed, -160, spec.topSpeed);
  const speedFactor = clamp(Math.abs(car.speed) / 220, 0, 1);
  const steerAmount = control.steer * spec.turn * speedFactor * dt * Math.sign(car.speed || 1);
  car.angle += steerAmount;
  // Hard steering at speed leaves a skid mark and bleeds a little speed.
  if (Math.abs(control.steer) > 0.7 && Math.abs(car.speed) > 300) {
    car.skid = Math.max(car.skid, 0.25);
    car.speed *= 1 - 0.12 * dt;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, WORLD.beachEdge + 10, WORLD.width - 10);
  car.y = clamp(car.y, 10, WORLD.height - 10);
  if (car.skid > 0) car.skid -= dt;
}

// --- Traffic brains ---

// At an intersection, pick the next leg: mostly straight on, sometimes a turn, never
// a U-turn. The car keeps to its lane (right-hand traffic). Straight on is not an
// option at the last intersection before the edge of the map: a car that goes straight
// there pins itself against the world's edge, so it must turn.
function chooseNextLeg(car, rng) {
  const r = car.route;
  if (r.axis === 'x') {
    const roadY = nearestCrossRoadY(car.y);
    const lastRoad = WORLD.roadsY[WORLD.roadsY.length - 1];
    const firstRoad = WORLD.roadsY[0];
    const mustTurn = (r.dir === 1 && roadY >= lastRoad) || (r.dir === -1 && roadY <= firstRoad);
    const roll = rng();
    if (!mustTurn && roll < 0.62) return { axis: 'x', road: r.road, dir: r.dir, lane: r.lane };
    const newDir = rng() < 0.5 ? 1 : -1;
    return { axis: 'y', road: roadY, dir: newDir, lane: newDir === 1 ? -22 : 22 };
  }
  const roadX = nearestCrossRoadX(car.x);
  const lastRoad = WORLD.roadsX[WORLD.roadsX.length - 1];
  const firstRoad = WORLD.roadsX[0];
  const mustTurn = (r.dir === 1 && roadX >= lastRoad) || (r.dir === -1 && roadX <= firstRoad);
  const roll = rng();
  if (!mustTurn && roll < 0.62) return { axis: 'y', road: r.road, dir: r.dir, lane: r.lane };
  const newDir = rng() < 0.5 ? 1 : -1;
  return { axis: 'x', road: roadX, dir: newDir, lane: newDir === 1 ? -22 : 22 };
}

function nearestCrossRoadY(y) {
  let best = WORLD.roadsY[0];
  for (const ry of WORLD.roadsY) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

function nearestCrossRoadX(x) {
  let best = WORLD.roadsX[0];
  for (const rx of WORLD.roadsX) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

// Steer one traffic car along its road for a step. It brakes for the car ahead and for
// a red light, and picks a new leg when it reaches an intersection.
export function updateTrafficCar(state, car, dt) {
  const rng = state.rng;
  const r = car.route;
  if (!r) return;
  const targetAngle = r.axis === 'x' ? (r.dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (r.dir === 1 ? 0 : Math.PI);
  car.angle = angleLerp(car.angle, targetAngle, Math.min(1, 6 * dt));

  // The point the car is aiming at on its current leg.
  const lanePos = r.road + r.lane;
  const ahead = { x: car.x, y: car.y };
  if (r.axis === 'x') {
    ahead.x = lanePos;
    ahead.y = car.y + r.dir * 120;
  } else {
    ahead.y = lanePos;
    ahead.x = car.x + r.dir * 120;
  }
  // Ease back onto the lane line.
  if (r.axis === 'x') car.x += (lanePos - car.x) * Math.min(1, 3 * dt);
  else car.y += (lanePos - car.y) * Math.min(1, 3 * dt);

  let wantSpeed = 190;
  // Brake for the car ahead on the same road.
  for (const other of state.cars) {
    if (other === car || other.speed === 0 && other.driver === null) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = r.axis === 'x' ? dy * r.dir : dx * r.dir;
    const across = r.axis === 'x' ? Math.abs(dx) : Math.abs(dy);
    if (along > 0 && along < 78 && across < 34) { wantSpeed = 0; break; }
  }
  // Brake for a red light at the next intersection.
  const cross = r.axis === 'x' ? nearestCrossRoadY(car.y + r.dir * 90) : nearestCrossRoadX(car.x + r.dir * 90);
  const distToCross = r.axis === 'x' ? (cross - car.y) * r.dir : (cross - car.x) * r.dir;
  if (distToCross > 0 && distToCross < 95) {
    const light = state.city.lights.find((l) => Math.abs(l.x - (r.axis === 'x' ? car.x : cross)) < 60 && Math.abs(l.y - (r.axis === 'x' ? cross : car.y)) < 60);
    if (light && !lightGreenFor(light, r.axis, state.time)) wantSpeed = 0;
  }
  const throttle = car.speed < wantSpeed ? 1 : car.speed > wantSpeed + 12 ? -0.6 : 0;
  driveCar(car, { throttle, steer: 0 }, dt);

  // Reached the next intersection: choose a new leg.
  if (r.axis === 'x') {
    const nextY = nearestCrossRoadY(car.y + r.dir * 30);
    if (Math.abs(car.y - nextY) < 26 && Math.abs(car.x - r.road) < 40) {
      const leg = chooseNextLeg(car, rng);
      if (leg.axis === 'y') { car.y = leg.road + leg.lane; }
      car.route = leg;
    }
  } else {
    const nextX = nearestCrossRoadX(car.x + r.dir * 30);
    if (Math.abs(car.x - nextX) < 26 && Math.abs(car.y - r.road) < 40) {
      const leg = chooseNextLeg(car, rng);
      if (leg.axis === 'x') { car.x = leg.road + leg.lane; }
      car.route = leg;
    }
  }
  // A car that is trying to move but has not actually moved is wedged on something
  // (a building corner, another car): put it back on a road. A car waiting at a red
  // light has no speed, so it is never caught by this.
  if (car.lastX === undefined) {
    car.lastX = car.x;
    car.lastY = car.y;
    car.stillTimer = 0;
  }
  car.stillTimer += dt;
  if (Math.hypot(car.x - car.lastX, car.y - car.lastY) > 12) {
    car.lastX = car.x;
    car.lastY = car.y;
    car.stillTimer = 0;
  }
  if (Math.abs(car.speed) > 50 && car.stillTimer > 4) {
    const p = nearestRoadPoint(car.x, car.y);
    car.x = p.x;
    car.y = p.y;
    car.stillTimer = 0;
  }
}

// --- Collisions ---

// Cars against buildings (circle push-out) and against each other (soft push + damage).
export function collideCars(state, dt) {
  const cars = state.cars;
  for (const car of cars) {
    const circle = { x: car.x, y: car.y, r: car.length * 0.42 };
    if (collideBuildings(state.city, circle)) {
      if (Math.abs(car.speed) > 220) {
        car.health -= Math.abs(car.speed) * 0.06;
        state.shake = Math.min(14, Math.abs(car.speed) * 0.02);
        state.audio.crash();
        state.spawnParticles(car.x, car.y, 10, '#ffb347');
      }
      car.x = circle.x;
      car.y = circle.y;
      car.speed *= -0.25;
    }
  }
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const d2 = dist2(a.x, a.y, b.x, b.y);
      const min = (a.length + b.length) * 0.38;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 140) {
          a.health -= impact * 0.04;
          b.health -= impact * 0.04;
          state.audio.crash();
          state.spawnParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 8, '#ffd27d');
          if (state.player.car === a || state.player.car === b) state.shake = 10;
        }
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.7;
        b.speed = avg * 0.7;
      }
    }
  }
  // Wrecked cars smoke, then stop being drivable trouble.
  for (const car of cars) {
    if (car.health < 35 && car.health > 0) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.12;
        state.spawnParticles(car.x, car.y - 6, 1, '#8a8a8a');
      }
    }
  }
}
