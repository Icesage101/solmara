// world.js — builds the city of Solmara from a seed: the street grid, the
// blocks between streets, and everything fixed in the world (buildings,
// parks, the beach, the plaza, trees, lamps, parked-car spots and the
// named places missions point at). One job: know the city's shape.

import { TILE, WORLD, DISTRICTS, PALETTE } from './config.js';
import { makeRng, randInt, randRange, pick } from './random.js';

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD];

// Streets run along the low edge of every block pitch, so a point is on a
// street when either coordinate falls inside a road band.
export function isRoad(x, y) {
  return x % TILE.block < TILE.road || y % TILE.block < TILE.road;
}

export function districtAt(x, y) {
  const fx = x / WORLD.w;
  const fy = y / WORLD.h;
  for (const d of DISTRICTS) {
    if (fx >= d.x0 && fx < d.x1 && fy >= d.y0 && fy < d.y1) return d.name;
  }
  return DISTRICTS[DISTRICTS.length - 1].name;
}

// Center lines of the vertical and horizontal streets, for traffic.
export function streetCenters() {
  const v = [];
  const h = [];
  for (let i = 0; i <= TILE.cols; i++) v.push(i * TILE.block + TILE.road / 2);
  for (let j = 0; j <= TILE.rows; j++) h.push(j * TILE.block + TILE.road / 2);
  return { v, h };
}

function blockKind(col, row) {
  if (row === TILE.rows - 1 && col >= 5) return 'beach';
  if ((col * 7 + row * 3) % 11 === 0) return 'park';
  if ((col + row) % 9 === 4) return 'plaza';
  return 'buildings';
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    buildings: [], trees: [], lamps: [], blocks: [], parkedSpots: [],
    places: {},
  };
  const inner = TILE.block - TILE.road; // buildable square inside a block

  for (let col = 0; col < TILE.cols; col++) {
    for (let row = 0; row < TILE.rows; row++) {
      const bx = col * TILE.block + TILE.road;
      const by = row * TILE.block + TILE.road;
      const kind = blockKind(col, row);
      world.blocks.push({ x: bx, y: by, w: inner, h: inner, kind });
      if (kind === 'buildings') {
        const n = randInt(rng, 2, 4);
        for (let i = 0; i < n; i++) {
          const w = randRange(rng, 44, 74);
          const h = randRange(rng, 44, 74);
          world.buildings.push({
            x: bx + 8 + (i % 2) * (inner / 2) + randRange(rng, 0, 8),
            y: by + 8 + Math.floor(i / 2) * (inner / 2) + randRange(rng, 0, 8),
            w, h,
            color: pick(rng, ROOFS),
            floors: randInt(rng, 2, 9),
          });
        }
      } else {
        const trees = kind === 'buildings' ? 0 : randInt(rng, 3, 7);
        for (let i = 0; i < trees; i++) {
          world.trees.push({
            x: bx + randRange(rng, 14, inner - 14),
            y: by + randRange(rng, 14, inner - 14),
            r: randRange(rng, 9, 15),
          });
        }
      }
    }
  }

  // Lamps along both edges of every street, spaced a block apart.
  const { v, h } = streetCenters();
  for (const x of v) for (let y = 40; y < WORLD.h; y += 190) world.lamps.push({ x: x + TILE.road / 2 + 4, y });
  for (const y of h) for (let x = 40; x < WORLD.w; x += 190) world.lamps.push({ x, y: y + TILE.road / 2 + 4 });

  // Parked-car spots hug the curb on a seeded pick of street segments.
  for (let i = 0; i < 46; i++) {
    const vertical = rng() > 0.5;
    const line = vertical ? pick(rng, v) : pick(rng, h);
    const along = randRange(rng, 80, vertical ? WORLD.h - 80 : WORLD.w - 80);
    world.parkedSpots.push(vertical
      ? { x: line + TILE.road / 2 - 12, y: along, angle: Math.PI / 2 }
      : { x: along, y: line + TILE.road / 2 - 12, angle: 0 });
  }

  // Named places the story points at.
  const at = (col, row) => ({ x: col * TILE.block + TILE.road + inner / 2, y: row * TILE.block + TILE.road + inner / 2 });
  world.places = {
    diner: at(6, 5), // Marina: the Sunspill Diner, mission 1 pickup
    garage: at(1, 1), // Old Town: Voss family garage, mission 2
    dock: at(1, 6), // Harbor: Pier 9, mission 3
    lookout: at(8, 1), // The Hills: the informant's corner, mission 4
    safehouse: at(8, 6), // Marina heights: Mara's safehouse, mission 5
    spray: at(2, 5), // Harbor: Shine & Go respray, clears wanted
    start: at(5, 4), // Plaza edge where Mara starts the day
  };
  return world;
}
