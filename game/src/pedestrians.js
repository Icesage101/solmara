// Pedestrians: the people of Solmara. They stroll the sidewalks, cross streets,
// and run when they hear a gunshot or see a crash. A few wear the colours of
// the crew Mara crossed, and those ones fight back.
import { createRandom } from './random.js';

const SHIRTS = ['#d95f4b', '#4b7fd9', '#4bd97a', '#d9a44b', '#9b59b6', '#e8e8e8', '#2c3e50', '#e67e22'];
const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
const HAIRS = ['#222222', '#5a3a1a', '#8a8a8a', '#c9a227', '#4a2a1a'];

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(45, 75),
    state: 'walk', // walk | flee | down | fight
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    targetX: x,
    targetY: y,
    wait: rng.range(0, 2),
    panic: 0,
    health: 40,
    thug: false,
    attackCooldown: 0,
  };
}

export function spawnPeds(city, rng, count, nearX, nearY) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    let p;
    if (nearX !== undefined && rng.chance(0.55)) {
      p = { x: nearX + rng.range(-650, 650), y: nearY + rng.range(-650, 650) };
      p.x = Math.max(140, Math.min(4660, p.x));
      p.y = Math.max(140, Math.min(4660, p.y));
    } else {
      p = city.sidewalkPoint(rng);
    }
    peds.push(makePed(p.x, p.y, rng));
  }
  return peds;
}

export function scarePeds(peds, x, y, radius) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.state = 'flee';
      p.panic = 3.5;
      p.angle = Math.atan2(p.y - y, p.x - x);
    }
  }
}

export function updatePeds(peds, dt, city, player, rng) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.state === 'flee') {
      p.panic -= dt;
      const sp = 240;
      p.x += Math.cos(p.angle) * sp * dt;
      p.y += Math.sin(p.angle) * sp * dt;
      p.x = Math.max(80, Math.min(4720, p.x));
      p.y = Math.max(80, Math.min(4720, p.y));
      if (p.panic <= 0) p.state = 'walk';
      continue;
    }
    if (p.state === 'fight') {
      const d = Math.hypot(player.x - p.x, player.y - p.y);
      if (d > 26) {
        p.angle = Math.atan2(player.y - p.y, player.x - p.x);
        p.x += Math.cos(p.angle) * 150 * dt;
        p.y += Math.sin(p.angle) * 150 * dt;
      } else if (p.attackCooldown <= 0) {
        p.attackCooldown = 0.9;
        player.hurt = (player.hurt || 0) + 8;
      }
      continue;
    }
    // Strolling: pick a nearby sidewalk point, walk to it, pause, repeat.
    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      p.wait -= dt;
      if (p.wait <= 0) {
        const next = city.sidewalkPoint(rng);
        // Keep the wander local so the crowd stays spread across the city.
        if (Math.hypot(next.x - p.x, next.y - p.y) > 900) {
          p.targetX = p.x + rng.range(-300, 300);
          p.targetY = p.y + rng.range(-300, 300);
        } else {
          p.targetX = next.x;
          p.targetY = next.y;
        }
        p.wait = rng.range(0, 3);
      }
    } else {
      p.angle = Math.atan2(dy, dx);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      city.pushOutOfBuildings(p, 12);
    }
  }
}
