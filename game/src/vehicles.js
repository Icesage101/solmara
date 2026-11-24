// Vehicles: the player's car physics and the traffic that fills Solmara's streets.
// Traffic cars follow a street, keep their lane, brake for the car ahead and turn
// at intersections; parked cars wait to be stolen.
import { CAR_TYPES } from './config.js';
import { createRandom } from './random.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, color, parked) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId += 1,
    type, spec,
    x, y, angle,
    speed: 0,
    color: color || spec.colors[0],
    parked: !!parked,
    traffic: false,
    // Traffic AI state: which street axis it follows and which way.
    axis: 'x', street: 0, dir: 1, lane: 26,
    health: 100,
    smoke: 0,
    sirenPhase: 0,
    ramCooldown: 0,
    hitCooldown: 0,
    buildingCooldown: 0,
    brake: false,
  };
}

export function resetCarIds() { nextCarId = 1; }

export function spawnParkedCars(city, rng, count) {
  const cars = [];
  const types = ['sedan', 'taxi', 'pickup', 'sports', 'van'];
  for (let i = 0; i < count; i += 1) {
    const p = city.roadPoint(rng);
    const vertical = rng.chance(0.5);
    const type = rng.pick(types);
    const car = makeCar(type, p.x, p.y, vertical ? Math.PI / 2 : 0, undefined, true);
    car.angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    // Park at the road edge, out of the driving lane.
    if (vertical) car.x += rng.chance(0.5) ? 40 : -40;
    else car.y += rng.chance(0.5) ? 40 : -40;
    cars.push(car);
  }
  return cars;
}

export function spawnTrafficCar(city, rng, nearX, nearY) {
  const types = ['sedan', 'taxi', 'pickup', 'van', 'sedan', 'taxi'];
  const type = rng.pick(types);
  const vertical = rng.chance(0.5);
  let street = rng.pick(city.streets);
  let along = rng.range(120, 4800 - 120);
  // Bias spawns toward the player's neighbourhood so the streets feel busy.
  if (nearX !== undefined && rng.chance(0.6)) {
    along = (vertical ? nearY : nearX) + rng.range(-700, 700);
    along = Math.max(140, Math.min(4660, along));
    const list = city.streets.filter((s) => Math.abs(s - (vertical ? nearX : nearY)) < 900);
    if (list.length) street = rng.pick(list);
  }
  const dir = rng.chance(0.5) ? 1 : -1;
  const lane = 26;
  const x = vertical ? street + (dir > 0 ? lane : -lane) : along;
  const y = vertical ? along : street + (dir > 0 ? lane : -lane);
  const car = makeCar(type, x, y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
  car.traffic = true;
  car.axis = vertical ? 'y' : 'x';
  car.street = street;
  car.dir = dir;
  car.lane = lane;
  car.speed = rng.range(110, 165);
  car.cruise = car.speed;
  return car;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function driveCar(car, dt, throttle, steer) {
  const spec = car.spec;
  const target = spec.top;
  if (throttle > 0) car.speed += spec.accel * dt;
  else if (throttle < 0) {
    if (car.speed > 8) car.speed -= spec.accel * 1.6 * dt;
    else car.speed -= spec.accel * 0.55 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 60 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-120, Math.min(target, car.speed));
  const turnRate = spec.grip * (0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 160));
  car.angle += steer * turnRate * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(60, Math.min(4740, car.x));
  car.y = Math.max(60, Math.min(4740, car.y));
}

export function updateTraffic(car, dt, city, cars, rng) {
  if (!car.traffic) return;
  const ahead = car.speed > 0 ? 62 : 0;
  let blocked = false;
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 70 && dist > 1) {
      const fwd = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      if (fwd > 0 && Math.abs(Math.sin(car.angle) * dx - Math.cos(car.angle) * dy) < 34) blocked = true;
    }
  }
  const want = blocked ? 0 : car.cruise;
  car.speed += Math.sign(want - car.speed) * 130 * dt;
  if (Math.abs(car.speed) < 2 && want === 0) car.speed = 0;

  // Drift back onto the lane, then roll forward; turn at a random intersection.
  const alongPos = car.axis === 'y' ? car.y : car.x;
  const near = city.nearestStreet(car.axis === 'y' ? car.x : car.y);
  const target = car.axis === 'y'
    ? (car.dir > 0 ? car.street + car.lane : car.street - car.lane)
    : (car.dir > 0 ? car.street + car.lane : car.street - car.lane);
  const cross = car.axis === 'y' ? car.x : car.y;
  const pull = (target - cross) * 2.2;
  const desiredAngle = car.axis === 'y'
    ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.max(-0.5, Math.min(0.5, pull / 60))
    : (car.dir > 0 ? 0 : Math.PI) + Math.max(-0.5, Math.min(0.5, pull / 60));
  let diff = angleDiff(desiredAngle, car.angle);
  car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // At an intersection, sometimes turn onto the crossing street.
  const crossNear = city.nearestStreet(car.axis === 'y' ? car.y : car.x);
  if (crossNear.dist < 12 && rng.chance(0.012)) {
    const turnLeft = rng.chance(0.5);
    if (car.axis === 'y') {
      car.axis = 'x';
      car.street = crossNear.pos;
      car.dir = turnLeft ? (car.dir > 0 ? -1 : 1) : (car.dir > 0 ? 1 : -1);
      car.lane = 26;
    } else {
      car.axis = 'y';
      car.street = crossNear.pos;
      car.dir = turnLeft ? (car.dir > 0 ? 1 : -1) : (car.dir > 0 ? -1 : 1);
      car.lane = 26;
    }
  }
  if (alongPos < 80 || alongPos > 4720) {
    car.dir *= -1;
    car.angle += Math.PI;
  }
}

export function carOverlaps(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  return dist < (a.spec.len + b.spec.len) / 2 - 6;
}

export function separateCars(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  let dist = Math.hypot(dx, dy);
  if (dist < 1) { dist = 1; }
  const min = (a.spec.len + b.spec.len) / 2 - 6;
  if (dist >= min) return false;
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x += nx * push;
  a.y += ny * push;
  b.x -= nx * push;
  b.y -= ny * push;
  const exchange = (a.speed - b.speed) * 0.4;
  a.speed -= exchange;
  b.speed += exchange;
  return true;
}
