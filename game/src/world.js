// The city of Solmara: a street grid, blocks, buildings, trees and props, all grown
// from one seed so the map is identical on every load. Also answers road queries
// the traffic, pedestrians and police all use.
import { WORLD, ROAD_W, STREET_GAP, FIRST_STREET, DISTRICTS } from './config.js';
import { createRandom } from './random.js';

export function streetPositions() {
  const list = [];
  for (let p = FIRST_STREET; p < WORLD; p += STREET_GAP) list.push(p);
  return list;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[0];
}

export function createCity(seed) {
  const rng = createRandom(seed);
  const streets = streetPositions();
  const half = ROAD_W / 2;
  const buildings = [];
  const trees = [];
  const lamps = [];
  const benches = [];

  const park = { x0: 2250, y0: 2250, x1: 2550, y1: 2550 };
  const plaza = { x0: 2250, y0: 2650, x1: 2550, y1: 2950 };
  const inPark = (x0, y0, x1, y1) => x0 < park.x1 && x1 > park.x0 && y0 < park.y1 && y1 > park.y0;
  const inPlaza = (x0, y0, x1, y1) => x0 < plaza.x1 && x1 > plaza.x0 && y0 < plaza.y1 && y1 > plaza.y0;

  const palettes = {
    Marina: ['#e8d9b0', '#f2e6c9', '#cfe3e8', '#e8b48a'],
    'Old Town': ['#d9a066', '#c98f5f', '#e0b183', '#b87a4a'],
    Harbor: ['#8a97a3', '#6e7d8c', '#a3aeb8', '#5d6d7e'],
    Hills: ['#e6dcc3', '#d5c9a8', '#f0e8d5', '#cbb98f'],
    'Central Park': ['#7fae6a'],
  };

  for (let si = 0; si < streets.length; si += 1) {
    for (let sj = 0; sj < streets.length; sj += 1) {
      const bx0 = streets[si] + half + 14;
      const by0 = streets[sj] + half + 14;
      const bx1 = (si + 1 < streets.length ? streets[si + 1] : WORLD) - half - 14;
      const by1 = (sj + 1 < streets.length ? streets[sj + 1] : WORLD) - half - 14;
      if (bx1 - bx0 < 90 || by1 - by0 < 90) continue;
      if (inPark(bx0, by0, bx1, by1) || inPlaza(bx0, by0, bx1, by1)) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: rng.range(bx0 + 20, bx1 - 20), y: rng.range(by0 + 20, by1 - 20), r: rng.range(9, 15) });
        }
        continue;
      }
      const d = districtAt((bx0 + bx1) / 2, (by0 + by1) / 2);
      const palette = palettes[d.name] || palettes.Hills;
      const count = rng.int(2, 4);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(70, 150);
        const h = rng.range(70, 150);
        const x = rng.range(bx0, Math.max(bx0, bx1 - w));
        const y = rng.range(by0, Math.max(by0, by1 - h));
        buildings.push({
          x, y, w, h,
          color: rng.pick(palette),
          roof: rng.pick(['#7a5a3a', '#5a6b7c', '#8a6d4b', '#4a4a4a']),
          height: rng.int(1, 4),
          district: d.name,
        });
      }
      const treeCount = rng.int(2, 6);
      for (let t = 0; t < treeCount; t += 1) {
        trees.push({ x: rng.range(bx0, bx1), y: rng.range(by0, by1), r: rng.range(8, 14) });
      }
    }
  }

  // Street lamps along every street, benches in the park and plaza.
  for (const s of streets) {
    for (let p = FIRST_STREET; p < WORLD; p += STREET_GAP) {
      lamps.push({ x: s + half + 8, y: p });
      lamps.push({ x: s - half - 8, y: p + STREET_GAP / 2 });
    }
  }
  for (let i = 0; i < 10; i += 1) {
    benches.push({ x: rng.range(2280, 2520), y: rng.range(2280, 2520), angle: rng.range(0, Math.PI) });
    benches.push({ x: rng.range(2280, 2520), y: rng.range(2680, 2920), angle: rng.range(0, Math.PI) });
  }

  function nearestStreet(v) {
    let best = streets[0];
    let bd = Math.abs(v - best);
    for (const s of streets) {
      const d = Math.abs(v - s);
      if (d < bd) { bd = d; best = s; }
    }
    return { pos: best, dist: bd };
  }

  function onRoad(x, y) {
    return nearestStreet(x).dist < half || nearestStreet(y).dist < half;
  }

  function roadPoint(rnd) {
    const vertical = rnd.chance(0.5);
    const street = rnd.pick(streets);
    const along = rnd.range(120, WORLD - 120);
    return vertical ? { x: street, y: along } : { x: along, y: street };
  }

  function sidewalkPoint(rnd) {
    const p = roadPoint(rnd);
    const off = half + 18;
    if (rnd.chance(0.5)) p.x += rnd.chance(0.5) ? off : -off;
    else p.y += rnd.chance(0.5) ? off : -off;
    return p;
  }

  function buildingHit(x, y, pad) {
    for (const b of buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  }

  function pushOutOfBuildings(ent, radius) {
    const b = buildingHit(ent.x, ent.y, radius);
    if (!b) return false;
    const left = ent.x - (b.x - radius);
    const right = b.x + b.w + radius - ent.x;
    const top = ent.y - (b.y - radius);
    const bottom = b.y + b.h + radius - ent.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) ent.x = b.x - radius;
    else if (m === right) ent.x = b.x + b.w + radius;
    else if (m === top) ent.y = b.y - radius;
    else ent.y = b.y + b.h + radius;
    return true;
  }

  return {
    seed, streets, buildings, trees, lamps, benches, park, plaza,
    nearestStreet, onRoad, roadPoint, sidewalkPoint, buildingHit, pushOutOfBuildings,
  };
}
