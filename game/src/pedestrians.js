// pedestrians.js — the people of Solmara: they stroll the sidewalks,
// cross at corners, run from gunfire and crashes, and fall when hurt.
// One job: move the crowd. Police officers are spawned by police.js but
// share this file's body plan and walking code.

import { TILE } from './config.js';
import { randRange, pick } from './random.js';

const SHIRTS = ['#d96f4e', '#4e7ad9', '#e3c84f', '#7ac74f', '#b45ed9', '#e8e4da', '#4fb8c7'];

let nextPedId = 1;

export function makePed(x, y, rng, kind = 'civil') {
  return {
    id: nextPedId++,
    x, y, angle: randRange(rng, 0, Math.PI * 2),
    speed: 0, hp: kind === 'officer' ? 70 : 40,
    kind, // 'civil' | 'officer' | 'target'
    state: 'walk', // 'walk' | 'flee' | 'down' | 'fight' | 'chase'
    shirt: kind === 'officer' ? '#2c3e70' : pick(rng, SHIRTS),
    tx: x, ty: y, // current walking target
    fleeX: 0, fleeY: 0, timer: 0,
  };
}

// Sidewalks are the rims of the buildable block squares: a stroller picks
// a corner-to-corner path along the rim of the block they are on.
function nextStrollTarget(ped, rng) {
  const bx = Math.floor(ped.x / TILE.block) * TILE.block + TILE.road + 6;
  const by = Math.floor(ped.y / TILE.block) * TILE.block + TILE.road + 6;
  const inner = TILE.block - TILE.road - 12;
  const side = Math.floor(rng() * 4);
  const along = rng() * inner;
  if (side === 0) { ped.tx = bx + along; ped.ty = by; }
  else if (side === 1) { ped.tx = bx + inner; ped.ty = by + along; }
  else if (side === 2) { ped.tx = bx + along; ped.ty = by + inner; }
  else { ped.tx = bx; ped.ty = by + along; }
}

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const block = pick(rng, world.blocks);
    const ped = makePed(block.x + randRange(rng, 8, block.w - 8), block.y + randRange(rng, 8, block.h - 8), rng);
    nextStrollTarget(ped, rng);
    peds.push(ped);
  }
  return peds;
}

// A scare sends every civilian within earshot running from the spot.
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.kind !== 'civil' || ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeX = x; ped.fleeY = y;
      ped.timer = 2.4;
    }
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    let speed = 62;
    let tx = ped.tx;
    let ty = ped.ty;
    if (ped.state === 'flee') {
      speed = 175;
      tx = ped.x + (ped.x - ped.fleeX);
      ty = ped.y + (ped.y - ped.fleeY);
      ped.timer -= dt;
      if (ped.timer <= 0) { ped.state = 'walk'; nextStrollTarget(ped, G.rng); }
    } else if (ped.state === 'chase' || ped.state === 'fight') {
      continue; // police.js and missions.js drive these bodies
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      if (ped.state === 'walk') nextStrollTarget(ped, G.rng);
      ped.speed = 0;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.speed = speed;
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
  }
}
