// render.js — draws the world and everything in it onto the canvas:
// streets, blocks, buildings, beach and water, cars, people, bullets,
// particles, the mission beacon, and the warm end-of-day light over all
// of it. One job: pixels for the simulation. The HUD lives in hud.js.

import { TILE, PALETTE, WORLD } from './config.js';
import { missionMarker } from './missions.js';

function inView(G, x, y, pad = 90) {
  return x > G.cam.x - pad && x < G.cam.x + G.view.w + pad && y > G.cam.y - pad && y < G.cam.y + G.view.h + pad;
}

function drawGround(G, ctx) {
  const { world } = G;
  ctx.fillStyle = PALETTE.sidewalk;
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  // blocks first: grass, plaza stone, beach sand
  for (const b of world.blocks) {
    if (!inView(G, b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
    ctx.fillStyle = b.kind === 'park' ? PALETTE.grass : b.kind === 'plaza' ? PALETTE.plaza : b.kind === 'beach' ? PALETTE.sand : '#8f9597';
    ctx.fillRect(b.x - G.cam.x, b.y - G.cam.y, b.w, b.h);
    if (b.kind === 'beach') {
      // the sea eats the south edge of the beach blocks
      ctx.fillStyle = PALETTE.water;
      const wy = b.y + b.h - 34 - G.cam.y;
      ctx.fillRect(b.x - G.cam.x, wy, b.w, 34);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x - G.cam.x, wy, b.w, 3);
    }
  }
  // streets: asphalt bands along every block edge, with dashed centers
  ctx.fillStyle = PALETTE.road;
  for (let i = 0; i <= TILE.cols; i++) ctx.fillRect(i * TILE.block - G.cam.x, 0 - G.cam.y, TILE.road, WORLD.h);
  for (let j = 0; j <= TILE.rows; j++) ctx.fillRect(0 - G.cam.x, j * TILE.block - G.cam.y, WORLD.w, TILE.road);
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 14]);
  for (let i = 0; i <= TILE.cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE.block + TILE.road / 2 - G.cam.x, -G.cam.y);
    ctx.lineTo(i * TILE.block + TILE.road / 2 - G.cam.x, WORLD.h - G.cam.y);
    ctx.stroke();
  }
  for (let j = 0; j <= TILE.rows; j++) {
    ctx.beginPath();
    ctx.moveTo(-G.cam.x, j * TILE.block + TILE.road / 2 - G.cam.y);
    ctx.lineTo(WORLD.w - G.cam.x, j * TILE.block + TILE.road / 2 - G.cam.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuildings(G, ctx) {
  for (const b of G.world.buildings) {
    if (!inView(G, b.x + b.w / 2, b.y + b.h / 2, 160)) continue;
    const x = b.x - G.cam.x;
    const y = b.y - G.cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; // long afternoon shadow
    ctx.fillRect(x + 7, y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(x, y, b.w, 5);
    // window grid, denser on taller towers
    ctx.fillStyle = 'rgba(20,24,32,0.5)';
    const cols = Math.max(2, Math.floor(b.w / 16));
    const rows = Math.max(2, Math.floor(b.h / 16));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 13 + b.floors) % 3 === 0) ctx.fillRect(x + 5 + i * 16, y + 6 + j * 16, 7, 9);
    }
  }
  for (const t of G.world.trees) {
    if (!inView(G, t.x, t.y, 60)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.arc(t.x - G.cam.x + 4, t.y - G.cam.y + 5, t.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f7031';
    ctx.beginPath(); ctx.arc(t.x - G.cam.x, t.y - G.cam.y, t.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#579148';
    ctx.beginPath(); ctx.arc(t.x - G.cam.x - 3, t.y - G.cam.y - 3, t.r * 0.55, 0, 7); ctx.fill();
  }
}

export function drawCar(G, ctx, car) {
  const x = car.x - G.cam.x;
  const y = car.y - G.cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-20, -8 + 5, 46, 20);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(15,20,28,0.85)'; // cabin glass
  ctx.beginPath();
  ctx.roundRect(-6, -9, 17, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(11, -9, 4, 18); // windshield shine
  ctx.fillStyle = '#14161a'; // wheels
  ctx.fillRect(-17, -13, 11, 4); ctx.fillRect(7, -13, 11, 4);
  ctx.fillRect(-17, 9, 11, 4); ctx.fillRect(7, 9, 11, 4);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-3, -3, 8, 6);
  }
  if (car.role === 'police') {
    const flash = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#e33' : '#36c';
    ctx.fillRect(-4, -8, 9, 16);
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-16, -11, 6, 22);
    ctx.fillRect(16, -11, 6, 22);
  }
  if (car.hp < 45) { // damage smoke stains
    ctx.fillStyle = 'rgba(10,10,10,0.45)';
    ctx.beginPath(); ctx.arc(16, 0, 7, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawPed(G, ctx, ped) {
  const x = ped.x - G.cam.x;
  const y = ped.y - G.cam.y;
  if (ped.state === 'down') {
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.ellipse(x, y, 13, 6, ped.angle, 0, 7); ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(x + 2, y + 3, 8, 0, 7); ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8b98d'; // head
  ctx.beginPath(); ctx.arc(x + Math.cos(ped.angle) * 3, y + Math.sin(ped.angle) * 3, 4.4, 0, 7); ctx.fill();
  if (ped.kind === 'officer') {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(x - 5, y - 9, 10, 3); // cap brim
  }
  if (ped.kind === 'target') {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke();
  }
}

export function drawScene(G, ctx) {
  drawGround(G, ctx);
  drawBuildings(G, ctx);
  // mission beacon: a column of light on the current objective
  const marker = missionMarker(G);
  if (marker && inView(G, marker.x, marker.y, 300)) {
    const x = marker.x - G.cam.x;
    const y = marker.y - G.cam.y;
    const pulse = 26 + Math.sin(G.time * 4) * 6;
    const grad = ctx.createLinearGradient(0, y - 190, 0, y);
    grad.addColorStop(0, 'rgba(255,211,77,0)');
    grad.addColorStop(1, 'rgba(255,211,77,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 5, y - 190, 10, 190);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, pulse, 0, 7); ctx.stroke();
  }
  for (const car of G.cars) if (inView(G, car.x, car.y)) drawCar(G, ctx, car);
  for (const ped of G.peds) if (inView(G, ped.x, ped.y)) drawPed(G, ctx, ped);
  if (!G.player.car) drawPed(G, ctx, { ...G.player, kind: 'player', shirt: '#d8443c', state: G.mode === 'wasted' ? 'down' : 'walk' });
  // bullets as short tracers
  ctx.strokeStyle = '#ffe9a3';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - G.cam.x, b.y - G.cam.y);
    ctx.lineTo(b.x - b.vx * 0.02 - G.cam.x, b.y - b.vy * 0.02 - G.cam.y);
    ctx.stroke();
  }
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - G.cam.x - p.size / 2, p.y - G.cam.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // warm sunlight: a soft glare from the top corner over everything
  const sun = ctx.createRadialGradient(G.view.w - 120, -40, 40, G.view.w - 120, -40, 620);
  sun.addColorStop(0, 'rgba(255,190,90,0.20)');
  sun.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, G.view.w, G.view.h);
}
