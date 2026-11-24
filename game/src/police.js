// The Solmara police: wanted stars, cruisers that chase and ram, foot officers
// who run the player down and make an arrest. Heat fades when the player stays
// out of sight, and the Marina safehouse clears it outright.
import { WANTED } from './config.js';
import { makeCar } from './vehicles.js';

export function createPolice() {
  return {
    stars: 0,
    decayTimer: 0,
    arrestTimer: 0,
    cruisers: [],
    footCops: [],
    spawnTimer: 0,
  };
}

export function addWanted(police, n) {
  police.stars = Math.max(0, Math.min(WANTED.maxStars, police.stars + n));
  if (n > 0) police.decayTimer = WANTED.decaySeconds;
}

export function clearWanted(police) {
  police.stars = 0;
  police.decayTimer = 0;
  police.arrestTimer = 0;
  police.cruisers = [];
  police.footCops = [];
}

function spawnCruiser(police, city, rng, px, py, angle) {
  // Spawn on a road near the player, so the chase actually finds them instead
  // of appearing two districts away and being culled as too far.
  const vertical = rng.chance(0.5);
  const nearStreets = city.streets.filter((s) => Math.abs(s - (vertical ? px : py)) < 900);
  const street = nearStreets.length ? rng.pick(nearStreets) : rng.pick(city.streets);
  const along = Math.max(140, Math.min(4660, (vertical ? py : px) + rng.range(-700, 700)));
  const car = makeCar('police', vertical ? street : along, vertical ? along : street, angle || rng.range(0, Math.PI * 2), '#1d3a5f');
  car.traffic = false;
  car.police = true;
  car.sirenPhase = rng.range(0, 6);
  police.cruisers.push(car);
  return car;
}

function spawnFootCop(police, city, rng, px, py) {
  const p = city.sidewalkPoint(rng);
  const cop = {
    x: px + (rng.chance(0.5) ? 420 : -420),
    y: py + rng.range(-420, 420),
    angle: 0, speed: 250, state: 'chase', shirt: '#1d3a5f', skin: '#e8b98a', hair: '#222222',
    targetX: px, targetY: py, wait: 0, panic: 0, health: 60, thug: false, attackCooldown: 0, cop: true,
  };
  cop.x = Math.max(140, Math.min(4660, cop.x));
  cop.y = Math.max(140, Math.min(4660, cop.y));
  police.footCops.push(cop);
}

export function updatePolice(police, dt, state, city, rng) {
  const player = state.player;
  const px = player.x;
  const py = player.y;
  const wantCruisers = WANTED.copsPerStar[police.stars] || 0;
  const wantFoot = player.inCar ? 0 : (WANTED.footCopsPerStar[police.stars] || 0);

  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    police.spawnTimer = 1.2;
    if (police.cruisers.length < wantCruisers) spawnCruiser(police, city, rng, px, py);
    if (police.footCops.length < wantFoot) spawnFootCop(police, city, rng, px, py);
  }

  // Cruisers: steer at the player, ram to slow them, keep some distance apart.
  for (const car of police.cruisers) {
    const dx = px - car.x;
    const dy = py - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const speed = player.inCar ? Math.min(car.spec.top + 30, 400) : 300;
    if (dist > 46) {
      car.speed += car.spec.accel * 1.15 * dt;
      if (car.speed > speed) car.speed = speed;
    } else {
      car.speed -= 220 * dt;
    }
    car.angle += steer * car.spec.grip * dt * (car.speed > 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.sirenPhase += dt;
    if (car.ramCooldown > 0) car.ramCooldown -= dt;
    // Ram: if the cruiser touches the player's car, shove it and hurt it.
    // A short cooldown keeps one long shove from draining the whole car.
    if (player.inCar && state.car) {
      const cd = Math.hypot(state.car.x - car.x, state.car.y - car.y);
      if (cd < 52 && Math.abs(car.speed) > 60 && car.ramCooldown <= 0) {
        car.ramCooldown = 0.9;
        state.car.speed *= 0.55;
        state.car.health -= 6;
        state.shake = Math.max(state.shake, 7);
        state.audio.crash();
        state.spawnSparks(state.car.x, state.car.y, 8);
      }
    }
  }

  // Foot officers: run the player down on foot. Close in for a second and a half
  // and the arrest sticks.
  let copClose = false;
  for (const cop of police.footCops) {
    const dx = px - cop.x;
    const dy = py - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (dist > 30) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    if (dist < 42) copClose = true;
    city.pushOutOfBuildings(cop, 12);
  }
  if (copClose && !player.inCar && police.stars > 0) {
    police.arrestTimer += dt;
    if (police.arrestTimer > 1.4) return 'busted';
  } else {
    police.arrestTimer = Math.max(0, police.arrestTimer - dt * 2);
  }

  // Wanted decay: no cruiser nearby and no foot cop nearby means out of sight.
  let seen = false;
  for (const car of police.cruisers) {
    if (Math.hypot(car.x - px, car.y - py) < 520) { seen = true; break; }
  }
  if (!seen) {
    for (const cop of police.footCops) {
      if (Math.hypot(cop.x - px, cop.y - py) < 420) { seen = true; break; }
    }
  }
  if (police.stars > 0 && !seen) {
    police.decayTimer -= dt;
    if (police.decayTimer <= 0) {
      police.stars -= 1;
      police.decayTimer = WANTED.decaySeconds;
      state.message('The heat is cooling off...', 2.5);
    }
  } else {
    police.decayTimer = WANTED.decaySeconds;
  }

  // Despawn cruisers that fell far behind so the chase stays close.
  police.cruisers = police.cruisers.filter((c) => Math.hypot(c.x - px, c.y - py) < 1900);
  police.footCops = police.footCops.filter((c) => Math.hypot(c.x - px, c.y - py) < 1500);
  return null;
}
