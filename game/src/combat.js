// Combat: fists and the pistol Mara keeps in her courier bag. Punches land in an
// arc in front of the player; bullets fly straight, spark on walls and drop
// whoever they hit. Thugs and officers both go down, and going down is loud.
import { createRandom } from './random.js';

export function createCombat() {
  return {
    bullets: [],
    punchCooldown: 0,
    shootCooldown: 0,
    punchAnim: 0,
    muzzle: 0,
  };
}

export function tryPunch(state, dt) {
  const combat = state.combat;
  if (combat.punchCooldown > 0) return false;
  combat.punchCooldown = 0.42;
  combat.punchAnim = 0.22;
  state.audio.punch();
  const player = state.player;
  const range = 46;
  const arc = 1.1;
  let hitAny = false;
  const targets = [...state.peds, ...state.police.footCops];
  for (const t of targets) {
    if (t.state === 'down') continue;
    const dx = t.x - player.x;
    const dy = t.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > range) continue;
    const ang = Math.atan2(dy, dx);
    let diff = ang - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > arc) continue;
    t.health -= 22;
    t.state = 'flee';
    t.panic = 2;
    t.angle = ang;
    if (t.thug) t.state = 'fight';
    if (t.health <= 0) {
      t.state = 'down';
      if (t.cop) state.police.stars = Math.min(5, state.police.stars + 1);
    }
    state.spawnSparks(t.x, t.y, 4);
    hitAny = true;
  }
  if (hitAny) state.police.stars = Math.max(state.police.stars, 1);
  return hitAny;
}

export function tryShoot(state) {
  const combat = state.combat;
  const player = state.player;
  if (combat.shootCooldown > 0) return false;
  if (player.ammo <= 0) {
    state.message('Out of ammo. Find a gun shop pickup.', 2);
    return false;
  }
  combat.shootCooldown = 0.3;
  combat.muzzle = 0.09;
  player.ammo -= 1;
  state.audio.shoot();
  const bx = player.x + Math.cos(player.angle) * 22;
  const by = player.y + Math.sin(player.angle) * 22;
  combat.bullets.push({ x: bx, y: by, angle: player.angle, speed: 900, life: 0.9 });
  state.police.stars = Math.max(state.police.stars, 1);
  return true;
}

export function updateBullets(state, dt) {
  const combat = state.combat;
  if (combat.punchCooldown > 0) combat.punchCooldown -= dt;
  if (combat.shootCooldown > 0) combat.shootCooldown -= dt;
  if (combat.punchAnim > 0) combat.punchAnim -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  for (const b of combat.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    const wall = state.city.buildingHit(b.x, b.y, 0);
    if (wall) {
      b.life = 0;
      state.spawnSparks(b.x, b.y, 5);
      continue;
    }
    const targets = [...state.peds, ...state.police.footCops];
    for (const t of targets) {
      if (t.state === 'down') continue;
      if (Math.hypot(t.x - b.x, t.y - b.y) < 16) {
        t.health -= 34;
        b.life = 0;
        state.spawnSparks(b.x, b.y, 6);
        if (t.health <= 0) {
          t.state = 'down';
          if (t.cop) state.police.stars = Math.min(5, state.police.stars + 1);
        } else if (t.thug) {
          t.state = 'fight';
        } else {
          t.state = 'flee';
          t.panic = 3;
          t.angle = Math.atan2(t.y - state.player.y, t.x - state.player.x);
        }
        break;
      }
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
}
