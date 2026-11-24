// Solmara — the city itself: roads, blocks, buildings, trees, beach and landmarks.
// buildCity(seed) returns a plain data object; nothing here draws anything, and nothing
// here moves. The renderer draws from it, the cars drive on its roads, and the collision
// helpers in this file answer "is this point inside a building?" for everyone else.

import { WORLD, DISTRICTS, LANDMARKS } from './config.js';
import { makeRng, rngRange, rngInt, rngPick, rngChance } from './random.js';

const BUILDING_PALETTE = [
  '#8a6f4d', '#6f7d8a', '#9a8a72', '#7a5a4a', '#5a6a7a', '#a88a5a', '#6a5a72', '#8a7a5a',
];
const ROOF_PALETTE = ['#4a3f35', '#3a4a5a', '#5a4a3a', '#2f3a45'];

function roadAt(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const rx of WORLD.roadsX) if (Math.abs(x - rx) < half) return true;
  for (const ry of WORLD.roadsY) if (Math.abs(y - ry) < half) return true;
  return false;
}

// The block rectangles between the roads: each block is one cell of the grid, inset by
// half a road width on every side so buildings never touch the tarmac.
export function blockRects() {
  const xs = [WORLD.beachEdge, ...WORLD.roadsX, WORLD.width];
  const ys = [0, ...WORLD.roadsY, WORLD.height];
  const blocks = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + WORLD.roadWidth / 2;
      const x1 = xs[i + 1] - WORLD.roadWidth / 2;
      const y0 = ys[j] + WORLD.roadWidth / 2;
      const y1 = ys[j + 1] - WORLD.roadWidth / 2;
      if (x1 - x0 > 40 && y1 - y0 > 40) blocks.push({ x0, y0, x1, y1 });
    }
  }
  return blocks;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function insideLandmark(x, y, w, h) {
  const p = LANDMARKS.plaza;
  if (x + w > p.x - p.w / 2 && x < p.x + p.w / 2 && y + h > p.y - p.h / 2 && y < p.y + p.h / 2) return true;
  const k = LANDMARKS.park;
  if (x + w > k.x - k.w / 2 && x < k.x + k.w / 2 && y + h > k.y - k.h / 2 && y < k.y + k.h / 2) return true;
  return false;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const props = [];
  const blocks = blockRects();

  for (const block of blocks) {
    const bw = block.x1 - block.x0;
    const bh = block.y1 - block.y0;
    // A plaza or a park takes the whole block: no buildings, just open ground.
    if (insideLandmark(block.x0 + bw / 2, block.y0 + bh / 2, 0, 0)) {
      if (block.x0 > LANDMARKS.park.x - LANDMARKS.park.w / 2 - 10) {
        for (let i = 0; i < 26; i += 1) {
          trees.push({ x: rngRange(rng, block.x0 + 14, block.x1 - 14), y: rngRange(rng, block.y0 + 14, block.y1 - 14), r: rngRange(rng, 9, 16) });
        }
      }
      continue;
    }
    const count = rngInt(rng, 1, 3);
    for (let n = 0; n < count; n += 1) {
      const w = rngRange(rng, 70, Math.min(170, bw - 30));
      const h = rngRange(rng, 60, Math.min(150, bh - 30));
      const x = rngRange(rng, block.x0 + 8, block.x1 - w - 8);
      const y = rngRange(rng, block.y0 + 8, block.y1 - h - 8);
      const b = { x, y, w, h, color: rngPick(rng, BUILDING_PALETTE), roof: rngPick(rng, ROOF_PALETTE), tall: rngChance(rng, 0.3) };
      if (buildings.some((o) => rectsOverlap(b, o))) continue;
      buildings.push(b);
    }
    // A few trees in the gaps of every block.
    for (let i = 0; i < 5; i += 1) {
      const tx = rngRange(rng, block.x0 + 10, block.x1 - 10);
      const ty = rngRange(rng, block.y0 + 10, block.y1 - 10);
      if (buildings.some((b) => tx > b.x - 14 && tx < b.x + b.w + 14 && ty > b.y - 14 && ty < b.y + b.h + 14)) continue;
      trees.push({ x: tx, y: ty, r: rngRange(rng, 7, 13) });
    }
    // Street furniture: benches and planters near the block corners.
    if (rngChance(rng, 0.5)) props.push({ kind: 'bench', x: block.x0 + 18, y: block.y0 + 18 });
    if (rngChance(rng, 0.4)) props.push({ kind: 'planter', x: block.x1 - 22, y: block.y1 - 22 });
  }

  // Palm trees along the beach, in a loose line down the sand.
  for (let y = 60; y < WORLD.height - 40; y += rngRange(rng, 70, 130)) {
    trees.push({ x: rngRange(rng, 232, 282), y, r: rngRange(rng, 9, 14), palm: true });
  }
  // Traffic lights at every intersection, cycling on a shared clock.
  const lights = [];
  for (const rx of WORLD.roadsX) {
    for (const ry of WORLD.roadsY) {
      lights.push({ x: rx, y: ry, phase: rngRange(rng, 0, 8) });
    }
  }
  return { seed, buildings, trees, props, lights, blocks, districts: DISTRICTS };
}

// --- Queries the rest of the game asks about the city ---

// True when the point is on a road, on the beach, in the park or on the plaza: open
// ground where a person can walk and a car can drive.
export function isOpenGround(city, x, y) {
  if (x < WORLD.beachEdge || x > WORLD.width || y < 0 || y > WORLD.height) return false;
  if (roadAt(x, y)) return true;
  if (x < WORLD.beachEdge + 90) return true;
  return false;
}

// Push a circle out of every building it overlaps. Returns true when it hit one.
export function collideBuildings(city, circle) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(circle.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(circle.y, b.y + b.h));
    const dx = circle.x - cx;
    const dy = circle.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < circle.r * circle.r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        circle.x = cx + (dx / d) * circle.r;
        circle.y = cy + (dy / d) * circle.r;
      } else {
        circle.x = b.x - circle.r;
      }
    }
  }
  return hit;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmara';
}

// A random point on a road, for spawning traffic and parked cars.
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const x = rngPick(rng, WORLD.roadsX);
    return { x: x + rngRange(rng, -24, 24), y: rngRange(rng, 60, WORLD.height - 60) };
  }
  const y = rngPick(rng, WORLD.roadsY);
  return { x: rngRange(rng, 340, WORLD.width - 60), y: y + rngRange(rng, -24, 24) };
}

// The nearest point on any road centre line to (x, y): where a lost car rejoins the road.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of WORLD.roadsX) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of WORLD.roadsY) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

// Is the light green for traffic travelling along `axis` ('x' or 'y') at this moment?
export function lightGreenFor(light, axis, time) {
  const cycle = (time + light.phase) % 8;
  return axis === 'x' ? cycle < 4 : cycle >= 4;
}
