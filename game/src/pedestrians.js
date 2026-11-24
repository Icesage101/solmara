// Solmara — pedestrians: the people on the sidewalks.
// A pedestrian walks a sidewalk from waypoint to waypoint, pauses sometimes, and runs
// when something scary happens nearby (a gunshot, a crash, a car on the pavement). They
// are not traffic: they keep to the edges of the roads, cross at intersections, and
// never walk through buildings.

import { WORLD, clamp } from './config.js';
import { rngRange, rngPick } from './random.js';
import { pointInBuilding } from './world.js';

const SHIRTS = ['#c94f4f', '#4f7dc9', '#4fc98a', '#c9a44f', '#8a5fc9', '#c97d4f', '#4fc9c2', '#d8d8d8'];
const SKINS = ['#e8b88a', '#c98a5a', '#8a5a3a', '#f0c8a0'];

let nextPedId = 1;

export function makePedestrian(x, y, rng) {
  return {
    id: nextPedId,
    x,
    y,
    angle: rngRange(rng, 0, Math.PI * 2),
    speed: rngRange(rng, 42, 68),
    shirt: rngPick(rng, SHIRTS),
    skin: rngPick(rng, SKINS),
    target: null,
    pause: rngRange(rng, 0, 2),
    fleeing: 0,
    health: 40,
    down: false,
    downTimer: 0,
  };
}

export function spawnPedestrian(state, rng) {
  // On a sidewalk: just off a road, on a block edge, not inside a building.
  for (let tries = 0; tries < 10; tries += 1) {
    const vertical = rng() < 0.5;
    let x;
    let y;
    if (vertical) {
      const rx = rngPick(rng, WORLD.roadsX);
      x = rx + (rng() < 0.5 ? -62 : 62);
      y = rngRange(rng, 80, WORLD.height - 80);
    } else {
      const ry = rngPick(rng, WORLD.roadsY);
      x = rngRange(rng, 360, WORLD.width - 80);
      y = ry + (rng() < 0.5 ? -62 : 62);
    }
    if (x < WORLD.beachEdge + 12) continue;
    if (pointInBuilding(state.city, x, y)) continue;
    return makePedestrian(x, y, rng);
  }
  return makePedestrian(900, 640, rng);
}

// Pick a new sidewalk waypoint near the pedestrian: along the same road, or across an
// intersection to the next block.
function pickWaypoint(state, ped, rng) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const rx = rngPick(rng, WORLD.roadsX);
    return { x: rx + (ped.x < rx ? -62 : 62), y: clamp(ped.y + rngRange(rng, -320, 320), 70, WORLD.height - 70) };
  }
  const ry = rngPick(rng, WORLD.roadsY);
  return { x: clamp(ped.x + rngRange(rng, -320, 320), 360, WORLD.width - 70), y: ry + (ped.y < ry ? -62 : 62) };
}

// One step for one pedestrian. `danger` is a point that just made a loud noise, or
// null; `scareRadius` says how far the fear reaches.
export function updatePedestrian(state, ped, dt, danger, scareRadius) {
  if (ped.down) {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) ped.down = false;
    return;
  }
  if (danger) {
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < scareRadius * scareRadius) ped.fleeing = 2.2;
  }
  if (ped.pause > 0) {
    ped.pause -= dt;
    return;
  }
  if (!ped.target || (Math.abs(ped.x - ped.target.x) < 8 && Math.abs(ped.y - ped.target.y) < 8)) {
    if (state.rng() < 0.3) {
      ped.pause = rngRange(state.rng, 1, 3);
      return;
    }
    ped.target = pickWaypoint(state, ped, state.rng);
  }
  const speed = ped.fleeing > 0 ? 190 : ped.speed;
  if (ped.fleeing > 0) ped.fleeing -= dt;
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy) || 1;
  // Fleeing means away from the danger, not toward the waypoint.
  let mx = dx / d;
  let my = dy / d;
  if (ped.fleeing > 0 && danger) {
    const fx = ped.x - danger.x;
    const fy = ped.y - danger.y;
    const fd = Math.hypot(fx, fy) || 1;
    mx = fx / fd;
    my = fy / fd;
  }
  ped.angle = Math.atan2(my, mx);
  const nx = ped.x + mx * speed * dt;
  const ny = ped.y + my * speed * dt;
  if (!pointInBuilding(state.city, nx, ny)) {
    ped.x = clamp(nx, WORLD.beachEdge + 8, WORLD.width - 8);
    ped.y = clamp(ny, 8, WORLD.height - 8);
  } else {
    ped.target = pickWaypoint(state, ped, state.rng);
  }
}

// Knock a pedestrian down (a car hit them, or a punch landed). They get up after a bit.
export function knockPedestrianDown(ped, seconds) {
  ped.down = true;
  ped.downTimer = seconds;
  ped.fleeing = 0;
}
