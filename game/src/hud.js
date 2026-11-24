// Solmara — the HUD and the menus.
// The HUD is drawn on the same canvas as the world, in screen space: cash and health
// top-left, the job banner top-centre, the clock and the live minimap top-right, speed
// bottom-right when driving, and a toast line for what just happened. The menus are
// full-screen overlays drawn the same way: title, pause, the phone's job list, busted,
// wasted, job complete and job failed.

import { WORLD, LANDMARKS, clamp } from './config.js';
import { districtAt } from './world.js';
import { missionList } from './missions.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12,18,26,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function clockText(state) {
  const total = state.clockMinutes % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = Math.floor(total % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}  DAY ${state.day}`;
}

export function drawHud(ctx, state, view) {
  const p = state.player;
  // Cash, name, health, wanted stars, ammo.
  panel(ctx, 12, 12, 218, 108);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.fillText(`$${p.cash}`, 24, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillText('MARA VOSS', 24, 66);
  ctx.fillStyle = '#3a3f46';
  ctx.fillRect(24, 74, 150, 10);
  ctx.fillStyle = p.health > 30 ? '#3fd45a' : '#e84040';
  ctx.fillRect(24, 74, 150 * clamp(p.health / 100, 0, 1), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(`${Math.max(0, Math.ceil(p.health))} HP`, 180, 84);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText('★', 24 + i * 24, 108);
  }
  if (!p.car) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(`AMMO ${p.ammo}`, 150, 108);
  }

  // The job banner: what Mara is supposed to be doing right now.
  const m = state.missions.active;
  if (m) {
    const text = `JOB: ${m.objective}`;
    ctx.font = 'bold 16px Arial, sans-serif';
    const w = ctx.measureText(text).width + 28;
    panel(ctx, view.w / 2 - w / 2, 12, w, 36);
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(text, view.w / 2, 36);
  }

  // Clock, day and district, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText(clockText(state), view.w - 214, 34);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillText(districtAt(p.x, p.y).toUpperCase(), view.w - 214, 54);

  drawMinimap(ctx, state, view);

  // Speed, bottom-right, when driving.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.42);
    panel(ctx, view.w - 150, view.h - 78, 138, 66);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText(String(kmh), view.w - 81, view.h - 42);
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#9aa4ae';
    ctx.fillText(`km/h  ${p.car.name}`, view.w - 81, view.h - 24);
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(view.w - 138, view.h - 18, 114, 6);
    ctx.fillStyle = p.car.health > 30 ? '#3fd45a' : '#e84040';
    ctx.fillRect(view.w - 138, view.h - 18, 114 * clamp(p.car.health / 100, 0, 1), 6);
  }

  // Controls reminder, bottom-left, small and out of the way.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('WASD drive / walk   E enter car   J punch   K shoot   M jobs   P pause   Q save', 12, view.h - 12);

  // The toast: one line about what just happened, fading out.
  if (state.toastText && state.toastUntil > state.time) {
    const alpha = clamp((state.toastUntil - state.time) / 1.2, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.font = '15px Arial, sans-serif';
    const w = ctx.measureText(state.toastText).width + 24;
    panel(ctx, view.w / 2 - w / 2, view.h - 64, w, 30);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.toastText, view.w / 2, view.h - 44);
    ctx.globalAlpha = 1;
  }
}

// The live minimap: the whole city shrunk to a corner, with the sea, the roads, Mara,
// her car, the police, the traffic and the job marker, all moving in real time.
export function drawMinimap(ctx, state, view) {
  const mw = 190;
  const mh = 132;
  const mx = view.w - mw - 12;
  const my = 64;
  const sx = mw / WORLD.width;
  const sy = mh / WORLD.height;
  panel(ctx, mx, my, mw, mh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#2f7d9a';
  ctx.fillRect(mx, my, WORLD.seaEdge * sx, mh);
  ctx.fillStyle = '#c9b183';
  ctx.fillRect(mx + WORLD.seaEdge * sx, my, mw - WORLD.seaEdge * sx, mh);
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = 3;
  for (const rx of WORLD.roadsX) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of WORLD.roadsY) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const m = state.missions.active;
  if (m && m.marker) dot(m.marker.x, m.marker.y, 5, '#e8c820');
  for (const car of state.cars) {
    if (car.driver === 'police') dot(car.x, car.y, 3, '#2a6aff');
    else if (car.driver === 'traffic') dot(car.x, car.y, 2, '#d8d8d8');
  }
  for (const officer of state.officers) dot(officer.x, officer.y, 2, '#2a6aff');
  const p = state.player;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2);
  ctx.stroke();
  dot(p.x, p.y, 3, '#ffffff');
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', mx + mw / 2, my + mh + 14);
}

// --- Menus ---

function overlay(ctx, view, alpha) {
  ctx.fillStyle = `rgba(8,12,18,${alpha})`;
  ctx.fillRect(0, 0, view.w, view.h);
}

function bigTitle(ctx, view, title, subtitle, y) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c820';
  ctx.font = 'bold 84px Arial, sans-serif';
  ctx.fillText(title, view.w / 2, y);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.fillText(subtitle, view.w / 2, y + 48);
}

export function drawTitle(ctx, state, view) {
  overlay(ctx, view, 0.55);
  bigTitle(ctx, view, 'SOLMARA', 'STREETS OF THE SUN', 210);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('A courier. A city that never cools down. Five jobs to set things right.', view.w / 2, 300);
  panel(ctx, view.w / 2 - 330, 340, 660, 130);
  ctx.fillStyle = '#d8d8d8';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('WASD / arrows: move and drive      E: enter or leave a car      Shift: run', view.w / 2, 378);
  ctx.fillText('J: punch      K: fire pistol      M: jobs      P: pause      Q: save      L: load', view.w / 2, 406);
  ctx.fillText('Steal cars, lose the cops, finish all five jobs. The city is yours.', view.w / 2, 434);
  ctx.fillStyle = '#7ec8e8';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText(state.saveExists ? 'Press Enter to play — a save is waiting (L loads it)' : 'Press Enter to play', view.w / 2, 520);
}

export function drawPause(ctx, view) {
  overlay(ctx, view, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.fillText('PAUSED', view.w / 2, 300);
  ctx.font = '18px Arial, sans-serif';
  ctx.fillStyle = '#d8d8d8';
  ctx.fillText('P or Esc: resume      Q: save      M: jobs      Enter: resume', view.w / 2, 350);
}

export function drawJobs(ctx, state, view) {
  overlay(ctx, view, 0.72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c820';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText("MARA'S PHONE — JOBS", view.w / 2, 130);
  const list = missionList(state);
  let y = 190;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const selected = state.jobCursor === i;
    const w = 640;
    ctx.fillStyle = selected ? 'rgba(232,200,32,0.22)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(view.w / 2 - w / 2, y, w, 76);
    ctx.strokeStyle = selected ? '#e8c820' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(view.w / 2 - w / 2 + 0.5, y + 0.5, w, 76);
    ctx.textAlign = 'left';
    ctx.fillStyle = item.done ? '#7ee787' : '#ffffff';
    ctx.font = 'bold 19px Arial, sans-serif';
    const status = item.done ? 'DONE' : item.active ? 'ACTIVE' : `$${item.def.pay}`;
    ctx.fillText(`${i + 1}. ${item.def.name}`, view.w / 2 - w / 2 + 18, y + 30);
    ctx.fillStyle = '#d8d8d8';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(item.def.blurb, view.w / 2 - w / 2 + 18, y + 56);
    ctx.textAlign = 'right';
    ctx.fillStyle = item.done ? '#7ee787' : '#ffd23e';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(status, view.w / 2 + w / 2 - 18, y + 30);
    y += 88;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8d8d8';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('Up / Down to choose, Enter to start the job, M or Esc to close', view.w / 2, y + 10);
  ctx.fillText(`${state.missions.completed.length} of 5 jobs done — finish them all to take back Solmara.`, view.w / 2, y + 38);
}

export function drawEndScreen(ctx, view, kind, detail) {
  overlay(ctx, view, 0.66);
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#7ec8e8';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.fillText('BUSTED', view.w / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('The Solmara police took you in. You lost $100 and the heat is off.', view.w / 2, 350);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#e84040';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.fillText('WASTED', view.w / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('Mara went down. The city keeps moving without her. You lost $100.', view.w / 2, 350);
  } else if (kind === 'complete') {
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.fillText('JOB COMPLETE', view.w / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(detail || '', view.w / 2, 350);
  } else if (kind === 'failed') {
    ctx.fillStyle = '#e8a020';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.fillText('JOB FAILED', view.w / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(detail || '', view.w / 2, 350);
  }
  ctx.fillStyle = '#7ec8e8';
  ctx.font = 'bold 19px Arial, sans-serif';
  ctx.fillText('Press Enter to keep playing', view.w / 2, 420);
}
