// combat.js — fists, the pistol, bullets and hurt. One job: violence and
// its immediate effects (damage, knockback, muzzle flash, particles).
// The police decide when to chase; this file only lands the blows.

import { PLAYER } from './config.js';
import { commitCrime } from './police.js';
import { scarePeds } from './pedestrians.js';
import { sfx } from './audio.js';

export function burst(G, x, y, color, n, speed = 130) {
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2;
    const s = speed * (0.3 + G.rng() * 0.7);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.35 + G.rng() * 0.4, maxLife: 0.7, color,
      size: 2 + G.rng() * 3,
    });
  }
}

export function hurtPed(G, ped, dmg, angle) {
  ped.hp -= dmg;
  ped.x += Math.cos(angle) * 9;
  ped.y += Math.sin(angle) * 9;
  burst(G, ped.x, ped.y, '#c23b2e', 5, 90);
  if (ped.hp <= 0 && ped.state !== 'down') {
    ped.state = 'down';
    ped.timer = 6;
    if (ped.kind === 'officer') commitCrime(G, 1.4, ped.x, ped.y);
    else if (ped.kind === 'civil') commitCrime(G, 0.8, ped.x, ped.y);
  } else if (ped.kind === 'civil') {
    ped.state = 'flee';
    ped.fleeX = G.player.x; ped.fleeY = G.player.y; ped.timer = 2.2;
  }
}

export function playerPunch(G) {
  const p = G.player;
  if (p.car || G.time - p.lastPunch < 0.32) return;
  p.lastPunch = G.time;
  sfx('punch');
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < PLAYER.punchRange + 10) {
      hurtPed(G, ped, PLAYER.punchDamage, Math.atan2(ped.y - p.y, ped.x - p.x));
      commitCrime(G, 0.45, p.x, p.y);
    }
  }
}

export function playerShoot(G, tx, ty) {
  const p = G.player;
  if (p.car || p.ammo <= 0 || G.time - p.lastShot < 0.19) return;
  p.lastShot = G.time;
  p.ammo -= 1;
  const a = Math.atan2(ty - p.y, tx - p.x);
  p.angle = a;
  G.bullets.push({ x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 0.55, from: 'player' });
  burst(G, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, '#ffd34d', 3, 60);
  sfx('shot');
  scarePeds(G, p.x, p.y, 300);
  commitCrime(G, 0.55, p.x, p.y);
}

export function hurtPlayer(G, dmg) {
  G.player.hp -= dmg;
  G.player.lastHurt = G.time;
  G.shake = Math.min(9, G.shake + 2.5);
  if (G.player.hp <= 0 && G.mode === 'playing') G.mode = 'wasted';
}

function bulletHits(G, b) {
  if (b.from === 'player') {
    for (const ped of G.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
        hurtPed(G, ped, 40, Math.atan2(b.vy, b.vx));
        return true;
      }
    }
    for (const car of G.cars) {
      if (car !== G.player.car && Math.abs(car.x - b.x) < 26 && Math.abs(car.y - b.y) < 16) {
        car.hp -= 12;
        burst(G, b.x, b.y, '#ffb84d', 4, 110);
        return true;
      }
    }
  } else if (Math.hypot(G.player.x - b.x, G.player.y - b.y) < 13 && !G.player.car) {
    hurtPlayer(G, 9);
    return true;
  }
  return false;
}

// Officers open fire at three stars and up when the player is on foot and
// in the open; bullets fly, bodies fall, the player heals slowly when
// nothing has hit them for a while.
export function updateCombat(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (bulletHits(G, b)) b.life = 0;
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);

  if (G.wanted.stars >= 3 && !G.player.car) {
    for (const ped of G.peds) {
      if (ped.kind !== 'officer' || ped.state === 'down') continue;
      const d = Math.hypot(ped.x - G.player.x, ped.y - G.player.y);
      if (d < 300 && G.time - (ped.lastShot || 0) > 1.15) {
        ped.lastShot = G.time;
        const a = Math.atan2(G.player.y - ped.y, G.player.x - ped.x) + (G.rng() - 0.5) * 0.16;
        G.bullets.push({ x: ped.x, y: ped.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 0.5, from: 'officer' });
        sfx('shot');
      }
    }
  }
  if (G.time - G.player.lastHurt > 6 && G.player.hp > 0) {
    G.player.hp = Math.min(PLAYER.maxHp, G.player.hp + dt * 3.2);
  }
  for (const p of G.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
}
