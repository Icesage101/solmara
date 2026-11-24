// hud.js — everything drawn over the world: cash, health, wanted stars,
// the clock and district name, the mission objective, the live minimap,
// and the full-screen states (title, pause, busted, wasted, the mission
// phone). One job: tell the player what is happening.

import { WORLD } from './config.js';
import { districtAt } from './world.js';
import { missionMarker } from './missions.js';

function stars(ctx, x, y, wanted) {
  const full = Math.floor(wanted.stars);
  ctx.font = '22px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < full ? '#ffd34d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 24, y);
  }
  if (wanted.bust > 0.1) {
    ctx.fillStyle = '#e33';
    ctx.fillRect(x, y + 8, 112 * Math.min(1, wanted.bust / 1.6), 5);
  }
}

function clockText(G) {
  const mins = Math.floor(G.clock) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function drawMinimap(G, ctx) {
  const w = 212;
  const h = 170;
  const x = 14;
  const y = G.view.h - h - 14;
  const sx = w / WORLD.w;
  const sy = h / WORLD.h;
  ctx.fillStyle = 'rgba(12,16,22,0.78)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  ctx.fillStyle = 'rgba(120,140,160,0.5)';
  for (let i = 0; i <= 10; i++) ctx.fillRect(x + i * 216 * sx, y, 64 * sx, h);
  for (let j = 0; j <= 8; j++) ctx.fillRect(x, y + j * 216 * sy, w, 64 * sy);
  for (const car of G.cars) {
    ctx.fillStyle = car.role === 'police' ? (Math.floor(G.time * 4) % 2 ? '#e33' : '#36c') : car.role === 'target' ? '#ffd34d' : 'rgba(255,255,255,0.75)';
    ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  }
  for (const ped of G.peds) {
    if (ped.kind === 'civil') continue;
    ctx.fillStyle = ped.kind === 'officer' ? '#36c' : '#ffd34d';
    ctx.fillRect(x + ped.x * sx - 1.5, y + ped.y * sy - 1.5, 3, 3);
  }
  const marker = missionMarker(G);
  if (marker) {
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(x + marker.x * sx, y + marker.y * sy, 4.5, 0, 7); ctx.fill();
  }
  // the player: a white arrow that turns with them
  ctx.translate(x + G.player.x * sx, y + G.player.y * sy);
  ctx.rotate(G.player.angle + Math.PI / 2);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(-4.4, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText('N', x + w - 14, y + 14);
}

export function drawHud(G, ctx) {
  const p = G.player;
  // top-left: cash and health
  ctx.fillStyle = 'rgba(12,16,22,0.55)';
  ctx.beginPath(); ctx.roundRect(14, 14, 208, 58, 8); ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText(`$${p.cash}`, 26, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(26, 50, 180, 9);
  ctx.fillStyle = p.hp > 30 ? '#e05252' : '#ff2222';
  ctx.fillRect(26, 50, 180 * Math.max(0, p.hp / 100), 9);
  // top-right: wanted stars, clock, district
  ctx.fillStyle = 'rgba(12,16,22,0.55)';
  ctx.beginPath(); ctx.roundRect(G.view.w - 218, 14, 204, 58, 8); ctx.fill();
  stars(ctx, G.view.w - 138, 40, G.wanted);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(clockText(G), G.view.w - 204, 40);
  ctx.font = '12.5px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(districtAt(p.x, p.y), G.view.w - 204, 62);
  // bottom-right: speed and ammo
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = '#fff';
  if (p.car) ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.24)} mph`, G.view.w - 104, G.view.h - 20);
  else ctx.fillText(`Pistol · ${p.ammo}`, G.view.w - 118, G.view.h - 20);
  // objective line, top center
  if (G.objective) {
    ctx.font = '16px sans-serif';
    const tw = ctx.measureText(G.objective).width;
    ctx.fillStyle = 'rgba(12,16,22,0.6)';
    ctx.beginPath(); ctx.roundRect((G.view.w - tw - 28) / 2, 14, tw + 28, 32, 8); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(G.objective, (G.view.w - tw) / 2, 36);
    if (G.mission && G.mission.timer > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      const t = `${Math.ceil(G.mission.timer)}s`;
      ctx.fillText(t, (G.view.w - ctx.measureText(t).width) / 2, 62);
    }
  }
  // banner: mission briefings and results, center-top under the objective
  if (G.banner && G.time < G.banner.until) {
    ctx.fillStyle = 'rgba(12,16,22,0.72)';
    ctx.beginPath(); ctx.roundRect(G.view.w / 2 - 320, 84, 640, 74, 10); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(G.banner.title, G.view.w / 2 - 300, 112);
    ctx.fillStyle = '#fff';
    ctx.font = '13.5px sans-serif';
    wrapText(ctx, G.banner.text, G.view.w / 2 - 300, 134, 600, 17);
  }
  // toast line: small events (respray, save) at the bottom center
  if (G.toast && G.time < G.toast.until) {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const tw = ctx.measureText(G.toast.text).width;
    ctx.fillText(G.toast.text, (G.view.w - tw) / 2, G.view.h - 46);
  }
  drawMinimap(G, ctx);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    if (ctx.measureText(line + word).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = '';
    }
    line += word + ' ';
  }
  if (line) ctx.fillText(line, x, y);
}

// Full-screen states. The title screen floats over the live city (the
// world renders behind it), which is what the cover screenshot shows.
export function drawTitle(G, ctx) {
  ctx.fillStyle = 'rgba(10,12,20,0.45)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 74px sans-serif';
  ctx.fillText('SOLMARA', G.view.w / 2, 218);
  ctx.fillStyle = '#fff';
  ctx.font = '26px sans-serif';
  ctx.fillText('Streets of the Sun', G.view.w / 2, 258);
  ctx.font = '17px sans-serif';
  ctx.fillText('Mara Voss came home to drive a cab. The city had other plans.', G.view.w / 2, 316);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WASD drive & walk · E enter car · F punch · Click shoot · Shift run · Space handbrake', G.view.w / 2, 380);
  ctx.fillText('Tab: missions · P: pause · Your progress saves itself', G.view.w / 2, 408);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 22px sans-serif';
  if (Math.floor(G.time * 1.6) % 2 === 0) ctx.fillText('Press ENTER to start', G.view.w / 2, 478);
  ctx.textAlign = 'left';
}

export function drawCenterCard(G, ctx, title, lines, color = '#ffd34d') {
  ctx.fillStyle = 'rgba(10,12,20,0.62)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(title, G.view.w / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, G.view.w / 2, 348 + i * 28));
  ctx.textAlign = 'left';
}

export function drawMissionPhone(G, ctx, defs) {
  ctx.fillStyle = 'rgba(10,12,20,0.66)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.fillStyle = 'rgba(16,20,28,0.95)';
  ctx.beginPath(); ctx.roundRect(G.view.w / 2 - 300, 120, 600, 430, 14); ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Mara\'s phone — jobs', G.view.w / 2 - 272, 162);
  ctx.font = '15.5px sans-serif';
  defs.forEach((def, i) => {
    const y = 204 + i * 62;
    const locked = i >= G.progress.unlocked;
    const done = i < G.progress.done;
    ctx.fillStyle = done ? '#7ee787' : locked ? 'rgba(255,255,255,0.35)' : '#fff';
    ctx.fillText(`${i + 1}. ${def.title} — ${def.giver}`, G.view.w / 2 - 272, y);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(done ? 'Done.' : locked ? 'Locked — finish the earlier jobs first.' : `$${def.reward} · press ${i + 1} to take the job`, G.view.w / 2 - 272, y + 22);
    ctx.font = '15.5px sans-serif';
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.fillText('Tab closes the phone.', G.view.w / 2 - 272, 522);
}
