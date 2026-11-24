// Solmara — combat: fists, the pistol, and the people who fight back.
// Punching is a short arc in front of Mara. The pistol fires a fast bullet toward the
// nearest threat, or the way Mara is facing. Thugs are the mission-4 crew: they chase
// Mara on foot and swing when they get close. Officers can be fought too, but killing
// one costs two stars.

import { PLAYER, clamp, dist2 } from './config.js';
import { rngRange, rngPick } from './random.js';
import { knockPedestrianDown } from './pedestrians.js';
import { addWanted } from './police.js';

let nextThugId = 1;

export function makeThug(x, y, rng) {
  return {
    id: nextThugId,
    x,
    y,
    angle: rngRange(rng, 0, Math.PI * 2),
    speed: rngRange(rng, 150, 185),
    health: 60,
    punchCooldown: 0,
    shirt: rngPick(rng, ['#3a3a3a', '#5a2a2a', '#2a4a5a']),
    skin: rngPick(rng, ['#e8b88a', '#c98a5a', '#8a5a3a']),
    down: false,
    downTimer: 0,
    flash: 0,
  };
}

export function makeBullet(x, y, angle) {
  return {
    x,
    y,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: PLAYER.pistolRange / PLAYER.bulletSpeed,
  };
}

// Mara's punch: anything hostile or unlucky inside the arc takes damage and staggers.
export function playerPunch(state) {
  const p = state.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = PLAYER.punchCooldown;
  p.punchAnim = 0.18;
  state.audio.punch();
  const range = PLAYER.punchRange;
  const arc = PLAYER.punchArc / 2;
  const hit = (target, tx, ty) => {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > range + 12) return false;
    let diff = Math.atan2(dy, dx) - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < arc;
  };
  for (const thug of state.thugs) {
    if (thug.down) continue;
    if (hit(thug, thug.x, thug.y)) damageThug(state, thug, PLAYER.punchDamage, p.angle);
  }
  for (const officer of state.officers) {
    if (officer.down) continue;
    if (hit(officer, officer.x, officer.y)) {
      officer.health -= PLAYER.punchDamage;
      officer.down = officer.health <= 0;
      officer.downTimer = officer.down ? 999 : 0.6;
      if (officer.down) addWanted(state, 2, 'An officer is down');
      state.spawnParticles(officer.x, officer.y, 6, '#ffd27d');
    }
  }
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (hit(ped, ped.x, ped.y)) {
      knockPedestrianDown(ped, 2.5);
      addWanted(state, 1, 'Assault reported');
      state.spawnParticles(ped.x, ped.y, 6, '#ffd27d');
    }
  }
}

export function damageThug(state, thug, amount, fromAngle) {
  thug.health -= amount;
  thug.flash = 0.12;
  thug.x += Math.cos(fromAngle) * 14;
  thug.y += Math.sin(fromAngle) * 14;
  state.spawnParticles(thug.x, thug.y, 6, '#ffd27d');
  if (thug.health <= 0 && !thug.down) {
    thug.down = true;
    thug.downTimer = 999;
    const m = state.missions.active;
    if (m && m.id === 4) m.thugsLeft -= 1;
    state.audio.thugDown();
  }
}

// Mara's pistol: one bullet toward the nearest thug or officer, or the way she faces.
export function playerShoot(state) {
  const p = state.player;
  if (p.shootCooldown > 0 || p.car) return;
  if (p.ammo <= 0) {
    state.toast('Out of ammo. Find a gun shop? There is none. Punch harder.');
    p.shootCooldown = 0.3;
    return;
  }
  p.shootCooldown = 0.22;
  p.ammo -= 1;
  let angle = p.angle;
  let best = null;
  let bestD = 420 * 420;
  for (const thug of state.thugs) {
    if (thug.down) continue;
    const d2 = dist2(p.x, p.y, thug.x, thug.y);
    if (d2 < bestD) { bestD = d2; best = thug; }
  }
  for (const officer of state.officers) {
    if (officer.down) continue;
    const d2 = dist2(p.x, p.y, officer.x, officer.y);
    if (d2 < bestD) { bestD = d2; best = officer; }
  }
  if (best) angle = Math.atan2(best.y - p.y, best.x - p.x);
  const bx = p.x + Math.cos(angle) * 20;
  const by = p.y + Math.sin(angle) * 20;
  state.bullets.push(makeBullet(bx, by, angle));
  state.spawnParticles(bx, by, 4, '#ffe9a8');
  state.audio.gunshot();
  state.shake = Math.max(state.shake, 2);
  // The shot scares the street: peds nearby run.
  state.scare = { x: p.x, y: p.y, radius: 260, ttl: 0.1 };
}

// Move every bullet; a bullet that reaches a thug, an officer or a building stops.
export function updateBullets(state, dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0;
    if (!dead) {
      for (const thug of state.thugs) {
        if (thug.down) continue;
        if (dist2(bullet.x, bullet.y, thug.x, thug.y) < 16 * 16) {
          damageThug(state, thug, PLAYER.pistolDamage, Math.atan2(bullet.vy, bullet.vx));
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const officer of state.officers) {
        if (officer.down) continue;
        if (dist2(bullet.x, bullet.y, officer.x, officer.y) < 16 * 16) {
          officer.health -= PLAYER.pistolDamage;
          officer.down = officer.health <= 0;
          officer.downTimer = officer.down ? 999 : 0.6;
          if (officer.down) addWanted(state, 2, 'An officer is down');
          state.spawnParticles(officer.x, officer.y, 6, '#ffd27d');
          dead = true;
          break;
        }
      }
    }
    if (!dead && state.city) {
      const b = state.city.buildings;
      for (let i = 0; i < b.length; i += 1) {
        if (bullet.x > b[i].x && bullet.x < b[i].x + b[i].w && bullet.y > b[i].y && bullet.y < b[i].y + b[i].h) {
          state.spawnParticles(bullet.x, bullet.y, 3, '#c9c9c9');
          dead = true;
          break;
        }
      }
    }
    bullet.dead = dead;
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

// One thug's step: chase Mara, swing when close enough to reach her.
export function updateThug(state, thug, dt) {
  if (thug.down) return;
  if (thug.flash > 0) thug.flash -= dt;
  const p = state.player;
  const dx = p.x - thug.x;
  const dy = p.y - thug.y;
  const d = Math.hypot(dx, dy) || 1;
  thug.angle = Math.atan2(dy, dx);
  if (d > 26) {
    const step = Math.min(thug.speed * dt, d - 20);
    thug.x += (dx / d) * step;
    thug.y += (dy / d) * step;
  }
  thug.punchCooldown -= dt;
  if (d < 30 && thug.punchCooldown <= 0) {
    thug.punchCooldown = 0.85;
    p.health -= 9;
    state.shake = Math.max(state.shake, 4);
    state.audio.punch();
    state.spawnParticles(p.x, p.y, 5, '#ff9a9a');
    if (p.health <= 0) state.wasted();
  }
}
