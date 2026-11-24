// main.js — Solmara's brain: builds the state, runs the loop, moves Mara
// on foot and in cars, resolves collisions, watches the respray and the
// ammo crates, works the camera, and saves progress. Every other file
// owns one system; this file wires them together.

import { WORLD, PLAYER, CLOCK_START, CLOCK_RATE, SAVE_KEY } from './config.js';
import { makeRng, seedFromString } from './random.js';
import { buildWorld } from './world.js';
import { initInput, key, justPressed, moveAxis, mouseState, endFrame } from './input.js';
import { initAudio, sfx, updateAudioLoops } from './audio.js';
import { spawnParked, spawnTraffic, updateTraffic, drivePlayerCar } from './vehicles.js';
import { spawnPeds, updatePeds, scarePeds } from './pedestrians.js';
import { updatePolice, commitCrime } from './police.js';
import { playerPunch, playerShoot, updateCombat, burst, hurtPed, hurtPlayer } from './combat.js';
import { missionDefs, startMission, updateMission } from './missions.js';
import { drawScene } from './render.js';
import { drawHud, drawTitle, drawCenterCard, drawMissionPhone } from './hud.js';
import { setupShot, shotInput, SHOT_STEPS } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = shotName ? seedFromString('solmara-' + shotName) : 20261124;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export function createGame() {
  const rng = makeRng(seed);
  const world = buildWorld(seed);
  const G = {
    mode: shotName ? 'playing' : 'title',
    time: 0,
    clock: CLOCK_START,
    rng: makeRng(seed ^ 0x9e3779b9),
    world,
    view: { w: canvas.width, h: canvas.height },
    cam: { x: 0, y: 0 },
    player: {
      x: world.places.start.x, y: world.places.start.y, angle: -Math.PI / 2,
      hp: PLAYER.maxHp, cash: 120, ammo: 24, car: null, speed: 0,
      lastPunch: -9, lastShot: -9, lastHurt: -9,
    },
    cars: [], peds: [], bullets: [], particles: [],
    wanted: { stars: 0, bust: 0, spawnTimer: 0, lastCrimeAt: -99 },
    mission: null, objective: '', banner: null, toast: null,
    progress: { unlocked: 1, done: 0 },
    shake: 0, showPhone: false,
    crates: [
      { x: world.places.garage.x + 40, y: world.places.garage.y - 30, readyAt: 0 },
      { x: world.places.dock.x - 30, y: world.places.dock.y + 44, readyAt: 0 },
    ],
    sprayReadyAt: 0,
    defs: null,
    saveGame: () => {},
  };
  G.defs = missionDefs(world);
  G.cars = [...spawnParked(world, rng), ...spawnTraffic(world, rng, 15)];
  G.peds = spawnPeds(world, rng, 42);
  return G;
}

// ---- save / load -------------------------------------------------------
function attachSave(G) {
  G.saveGame = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: G.player.cash, ammo: G.player.ammo,
        unlocked: G.progress.unlocked, done: G.progress.done,
      }));
    } catch { /* private mode: play without saving */ }
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw && !shotName) {
      const s = JSON.parse(raw);
      G.player.cash = s.cash ?? G.player.cash;
      G.player.ammo = s.ammo ?? G.player.ammo;
      G.progress.unlocked = s.unlocked ?? 1;
      G.progress.done = s.done ?? 0;
    }
  } catch { /* a corrupt save is ignored, the day starts fresh */ }
}

// ---- entering and leaving cars ----------------------------------------
function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function toggleCar(G) {
  const p = G.player;
  if (p.car) {
    const car = p.car;
    car.role = car.role === 'player' ? 'parked' : car.role;
    car.speed = 0;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    sfx('door');
    return;
  }
  const car = nearestCar(G, 44);
  if (!car) return;
  if (car.role === 'traffic' || car.role === 'police') {
    // dragging a driver out is assault and car theft in one motion
    commitCrime(G, car.role === 'police' ? 1.2 : 0.7, car.x, car.y);
    scarePeds(G, car.x, car.y, 130);
  } else if (!car.stolen) {
    commitCrime(G, 0.5, car.x, car.y);
  }
  car.stolen = true;
  car.role = 'player';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  sfx('door');
}

// ---- collisions ---------------------------------------------------------
function collideBuildings(G, e, r) {
  for (const b of G.world.buildings) {
    const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - nx;
    const dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      e.x = nx + (dx / d) * r;
      e.y = ny + (dy / d) * r;
      if ('speed' in e && e.speed > 170) {
        burst(G, e.x, e.y, '#ffb84d', 8, 150);
        sfx('crash');
        G.shake = Math.min(10, G.shake + 3);
        e.hp -= 8;
      }
      if ('speed' in e) e.speed *= 0.35;
    }
  }
}

function collideWorld(G, dt) {
  const p = G.player;
  collideBuildings(G, p.car || p, p.car ? 24 : PLAYER.radius);
  for (const car of G.cars) {
    if (car.role === 'parked') continue;
    collideBuildings(G, car, 24);
    car.x = Math.max(16, Math.min(WORLD.w - 16, car.x));
    car.y = Math.max(16, Math.min(WORLD.h - 16, car.y));
  }
  // car meets car: a shove, a dent, and noise the law can hear
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i];
      const b = G.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 42) {
        const push = (42 - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (a.role !== 'parked') { a.x -= ux * push; a.y -= uy * push; }
        if (b.role !== 'parked') { b.x += ux * push; b.y += uy * push; }
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120 && G.time - (G.lastCrashAt || 0) > 0.4) {
          G.lastCrashAt = G.time;
          a.hp -= 6; b.hp -= 6;
          burst(G, (a.x + b.x) / 2, (a.y + b.y) / 2, '#ffb84d', 10, 170);
          sfx('crash');
          scarePeds(G, a.x, a.y, 170);
          if (a === p.car || b === p.car) {
            G.shake = Math.min(10, G.shake + 3.5);
            if (!shotName) commitCrime(G, 0.3, p.x, p.y); // staged scenes hold their scripted heat
          }
        }
      }
    }
  }
  // cars meet people
  for (const car of G.cars) {
    if (Math.abs(car.speed) < 60) continue;
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 24) {
        hurtPed(G, ped, 55, Math.atan2(ped.y - car.y, ped.x - car.x));
        if (car === p.car) commitCrime(G, 0.8, ped.x, ped.y);
      }
    }
    if (!p.car && Math.hypot(p.x - car.x, p.y - car.y) < 24 && car.role !== 'parked'
      && G.time - (G.lastCarHitAt || -9) > 0.8) {
      G.lastCarHitAt = G.time;
      hurtPlayer(G, 12);
      p.x += Math.cos(Math.atan2(p.y - car.y, p.x - car.x)) * 20;
      p.y += Math.sin(Math.atan2(p.y - car.y, p.x - car.x)) * 20;
    }
  }
  // wrecked cars are out of the story
  for (const car of G.cars) if (car.hp <= 0 && car.role !== 'gone') {
    car.role = 'gone';
    burst(G, car.x, car.y, '#555', 16, 120);
    if (car === p.car) { p.car = null; hurtPlayer(G, 10); }
  }
  G.cars = G.cars.filter((c) => c.role !== 'gone');
}

// ---- respray, crates, respawn -------------------------------------------
function worldServices(G) {
  const p = G.player;
  const spray = G.world.places.spray;
  if (p.car && G.time > G.sprayReadyAt && Math.hypot(p.x - spray.x, p.y - spray.y) < 58) {
    if (G.wanted.stars > 0 && p.cash >= 100) {
      p.cash -= 100;
      G.wanted.stars = 0;
      p.car.hp = 100;
      p.car.color = ['#5b7fa6', '#8a4b4b', '#3f4a3a', '#e8e4da'][Math.floor(G.rng() * 4)];
      G.toast = { text: 'Shine & Go: fresh paint, clean record. -$100', until: G.time + 3.5 };
      sfx('cash');
    }
    G.sprayReadyAt = G.time + 4;
  }
  if (!p.car) {
    for (const crate of G.crates) {
      if (G.time > crate.readyAt && Math.hypot(p.x - crate.x, p.y - crate.y) < 30) {
        p.ammo += 12;
        crate.readyAt = G.time + 45;
        G.toast = { text: '+12 pistol rounds', until: G.time + 2.5 };
        sfx('door');
      }
    }
  }
}

function respawn(G, fine, text) {
  const p = G.player;
  p.cash = Math.max(0, p.cash - Math.floor(p.cash * fine));
  p.hp = PLAYER.maxHp;
  p.car = null;
  p.x = G.world.places.safehouse.x;
  p.y = G.world.places.safehouse.y;
  G.wanted.stars = 0;
  G.wanted.bust = 0;
  G.mission = null;
  G.objective = '';
  G.cars = G.cars.filter((c) => c.role !== 'police');
  G.peds = G.peds.filter((ped) => ped.kind === 'civil');
  G.mode = 'playing';
  G.toast = { text, until: G.time + 4 };
  G.saveGame();
}

// ---- the per-frame update -------------------------------------------------
function step(G, dt, shot) {
  G.time += dt;
  G.clock += dt * CLOCK_RATE;
  const p = G.player;
  const input = shot
    ? shotInput(shot)
    : {
        up: key('KeyW') || key('ArrowUp'), down: key('KeyS') || key('ArrowDown'),
        left: key('KeyA') || key('ArrowLeft'), right: key('KeyD') || key('ArrowRight'),
        handbrake: key('Space'),
      };

  if (G.mode === 'playing' && !G.showPhone) {
    if (p.car) {
      drivePlayerCar(G, dt, input);
      p.speed = p.car.speed;
    } else {
      const axis = shot ? { x: 0, y: 0 } : moveAxis();
      const run = key('ShiftLeft') || key('ShiftRight');
      const sp = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(axis.x, axis.y) || 1;
      p.x += (axis.x / len) * sp * dt * (axis.x || axis.y ? 1 : 0);
      p.y += (axis.y / len) * sp * dt * (axis.x || axis.y ? 1 : 0);
      if (axis.x || axis.y) p.angle = Math.atan2(axis.y, axis.x);
      p.speed = axis.x || axis.y ? sp : 0;
      if (!shot) {
        if (justPressed('KeyF')) playerPunch(G);
        const m = mouseState();
        if (m.down) playerShoot(G, p.x + (m.x - G.view.w / 2), p.y + (m.y - G.view.h / 2));
        if (justPressed('KeyE')) toggleCar(G);
      }
    }
    if (p.car && !shot && justPressed('KeyE')) toggleCar(G);
    updateMission(G, dt);
    updatePolice(G, dt);
    updateCombat(G, dt);
    worldServices(G);
  }
  if (G.mode === 'playing' || G.mode === 'title') {
    updateTraffic(G, dt);
    updatePeds(G, dt);
  }
  collideWorld(G, dt);

  // camera: follow with a look-ahead along the velocity, clamped to Solmara
  const lead = p.car ? 0.42 : 0.18;
  const tx = p.x + Math.cos(p.angle) * Math.abs(p.speed) * lead - G.view.w / 2;
  const ty = p.y + Math.sin(p.angle) * Math.abs(p.speed) * lead - G.view.h / 2;
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
  G.cam.x = Math.max(0, Math.min(WORLD.w - G.view.w, G.cam.x));
  G.cam.y = Math.max(0, Math.min(WORLD.h - G.view.h, G.cam.y));
  G.shake = Math.max(0, G.shake - dt * 14);
  updateAudioLoops(p.car ? p.car.speed : 0, G.wanted.stars);
}

function render(G) {
  ctx.save();
  if (G.shake > 0.2) ctx.translate((G.rng() - 0.5) * G.shake, (G.rng() - 0.5) * G.shake);
  drawScene(G, ctx);
  ctx.restore();
  if (G.mode === 'title') { drawTitle(G, ctx); return; }
  drawHud(G, ctx);
  if (G.showPhone) drawMissionPhone(G, ctx, G.defs);
  if (G.mode === 'paused') drawCenterCard(G, ctx, 'PAUSED', ['P or Esc to keep driving.']);
  if (G.mode === 'busted') drawCenterCard(G, ctx, 'BUSTED', ['The SPD impound your day and fine you 20% of your cash.', 'Press ENTER to walk out of the station.'], '#7ab5ff');
  if (G.mode === 'wasted') drawCenterCard(G, ctx, 'WASTED', ['You wake up at the Marina clinic, lighter in the wallet.', 'Press ENTER to get back to work.'], '#e05252');
}

// ---- boot -------------------------------------------------------------------
const G = createGame();
attachSave(G);
initInput(canvas);
initAudio();

if (shotName) {
  setupShot(G, shotName);
  const steps = SHOT_STEPS[shotName] || 110;
  for (let i = 0; i < steps; i++) step(G, 1 / 30, shotName);
  render(G);
  window.__shotReady = shotName;
} else {
  addEventListener('keydown', (e) => {
    initAudio();
    if (G.mode === 'title' && e.code === 'Enter') G.mode = 'playing';
    else if ((G.mode === 'busted' || G.mode === 'wasted') && e.code === 'Enter') {
      respawn(G, G.mode === 'busted' ? 0.2 : 0.12, G.mode === 'busted' ? 'Released. The safehouse couch missed you.' : 'Patched up and back on the street.');
    } else if (G.mode === 'playing' && (e.code === 'KeyP' || e.code === 'Escape')) {
      G.mode = 'paused';
    } else if (G.mode === 'paused' && (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter')) {
      G.mode = 'playing';
    } else if (G.mode === 'playing' && e.code === 'Tab') {
      e.preventDefault();
      G.showPhone = !G.showPhone;
    } else if (G.mode === 'playing' && G.showPhone && /^Digit[1-5]$/.test(e.code)) {
      const idx = Number(e.code.slice(5)) - 1;
      if (idx < G.progress.unlocked && !G.mission) {
        startMission(G, G.defs[idx]);
        G.showPhone = false;
      }
    }
  });
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.mode !== 'paused') step(G, dt, null);
    render(G);
    endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
