// The HUD and the screens: cash, health, wanted stars, mission banner, a live
// minimap, the clock and speed, plus the title, pause, mission select, game over
// and mission complete screens. Everything is drawn on the canvas so the
// screenshots show the game exactly as the player sees it.
import { WORLD, MISSIONS } from './config.js';

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  function text(str, x, y, size, color, align, bold) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(10,16,26,${alpha === undefined ? 0.72 : alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function stars(x, y, n, size) {
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < n ? '#ffd94a' : 'rgba(255,255,255,0.25)';
      const cx = x + i * (size + 6);
      ctx.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        const a2 = a + Math.PI / 5;
        const r1 = size / 2;
        const r2 = size / 5;
        ctx.lineTo(cx + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a2) * r2, y + Math.sin(a2) * r2);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMinimap(state) {
    const size = 208;
    const x0 = canvas.width - size - 16;
    const y0 = 16;
    const s = size / WORLD;
    panel(x0 - 4, y0 - 4, size + 8, size + 8, 0.78);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#8a7a55';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(x0, y0, 170 * s, size);
    ctx.fillStyle = '#3a3f46';
    for (const st of state.city.streets) {
      ctx.fillRect(x0, y0 + st * s - 2, size, 4);
      ctx.fillRect(x0 + st * s - 2, y0, 4, size);
    }
    ctx.fillStyle = '#5d9448';
    ctx.fillRect(x0 + state.city.park.x0 * s, y0 + state.city.park.y0 * s, (state.city.park.x1 - state.city.park.x0) * s, (state.city.park.y1 - state.city.park.y0) * s);
    const dot = (wx, wy, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + wx * s, y0 + wy * s, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.missionMarker) dot(state.missionMarker.x, state.missionMarker.y, '#ffd94a', 6);
    dot(state.safehouse.x, state.safehouse.y, '#7fd4ff', 4);
    for (const car of state.police.cruisers) dot(car.x, car.y, '#2a6bff', 4);
    for (const c of state.police.footCops) dot(c.x, c.y, '#2a6bff', 3);
    for (const car of state.cars) {
      if (car.traffic) dot(car.x, car.y, 'rgba(255,255,255,0.55)', 2);
    }
    dot(state.player.x, state.player.y, '#ffffff', 5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + state.player.x * s, y0 + state.player.y * s, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text('N', x0 + size / 2, y0 + size + 18, 13, '#ffffff', 'center', true);
    text(state.districtName || '', x0 + size / 2, y0 + size + 36, 13, '#ffd94a', 'center', true);
  }

  function drawHud(state) {
    const w = canvas.width;
    const h = canvas.height;
    // Top-left: cash, health, stars.
    panel(16, 14, 250, 108, 0.72);
    text('$' + state.player.cash, 30, 48, 30, '#7dff8a', 'left', true);
    text('MARA VOSS', 30, 72, 14, '#ffffff', 'left', true);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(30, 82, 180, 12);
    ctx.fillStyle = state.player.health > 30 ? '#4bd97a' : '#e5534b';
    ctx.fillRect(30, 82, 180 * Math.max(0, state.player.health / 100), 12);
    text(Math.round(state.player.health) + ' HP', 218, 94, 12, '#ffffff', 'left');
    stars(30, 112, state.police.stars, 16);
    if (state.player.ammo !== undefined && !state.player.inCar) {
      text('AMMO ' + state.player.ammo, 30, 134, 13, '#ffd94a', 'left', true);
    }

    // Mission banner under the top bar.
    if (state.missionObjective) {
      const label = state.missionObjective;
      ctx.font = `bold 17px ${FONT}`;
      const bw = Math.min(w - 500, 60 + ctx.measureText('JOB: ' + label).width);
      panel((w - bw) / 2, 14, bw, 40, 0.78);
      text('JOB: ' + label, w / 2, 41, 17, '#ffd94a', 'center', true);
    }

    // Clock and date, top centre-right.
    const mins = Math.floor(state.clockMinutes % 60);
    const hrs = Math.floor(state.clockMinutes / 60) % 24;
    const clock = String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
    text(clock + '  DAY 1', w - 250, 48, 18, '#ffffff', 'right', true);

    drawMinimap(state);

    // Speed when driving.
    if (state.player.inCar && state.car) {
      const kmh = Math.round(Math.abs(state.car.speed) * 0.9);
      panel(w - 150, h - 84, 134, 68, 0.72);
      text(kmh + '', w - 84, h - 44, 30, '#ffffff', 'center', true);
      text('km/h  ' + state.car.spec.name, w - 84, h - 26, 12, '#ffd94a', 'center');
      if (state.car.health < 100) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(w - 140, h - 18, 114, 6);
        ctx.fillStyle = state.car.health > 30 ? '#4bd97a' : '#e5534b';
        ctx.fillRect(w - 140, h - 18, 114 * Math.max(0, state.car.health / 100), 6);
      }
    }

    // Controls hint, bottom-left.
    text('WASD drive/walk   E enter car   J punch   K shoot   M jobs   P pause   Q save', 18, h - 16, 13, 'rgba(255,255,255,0.75)', 'left');
    if (state.player.inCar) {
      text('R repair $40   C repaint $50', 18, h - 36, 13, 'rgba(255,255,255,0.75)', 'left');
    }

    // Toast message.
    if (state.toast && state.toastTimer > 0) {
      const tw = ctx.measureText(state.toast).width + 40;
      panel((w - tw) / 2, h - 120, tw, 36, 0.85);
      text(state.toast, w / 2, h - 95, 16, '#ffffff', 'center');
    }
    if (state.police.arrestTimer > 0.4) {
      text('THE POLICE ARE ARRESTING YOU', w / 2, 120, 24, '#ff5a4a', 'center', true);
    }
  }

  function centerPanel(title, lines, prompt, accent) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = 'rgba(6,10,18,0.55)';
    ctx.fillRect(0, 0, w, h);
    const pw = 720;
    const ph = 150 + lines.length * 30 + 70;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    panel(px, py, pw, ph, 0.92);
    text(title, w / 2, py + 64, 44, accent || '#ffd94a', 'center', true);
    lines.forEach((line, i) => {
      text(line, w / 2, py + 116 + i * 30, 18, '#e8e8e8', 'center');
    });
    text(prompt, w / 2, py + ph - 28, 18, '#7fd4ff', 'center', true);
  }

  function drawTitle(state) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = 'rgba(6,10,18,0.35)';
    ctx.fillRect(0, 0, w, h);
    text('SOLMARA', w / 2, h * 0.22, 92, '#ffd94a', 'center', true);
    text('STREETS OF THE SUN', w / 2, h * 0.22 + 52, 34, '#ffffff', 'center', true);
    text('A courier. A city that never cools down. Five jobs to set things right.', w / 2, h * 0.22 + 96, 19, '#e8e8e8', 'center');
    const done = state.missions.completed.filter(Boolean).length;
    const lines = [
      'WASD / arrows: move and drive    E: enter or leave a car    Shift: run',
      'J: punch    K: fire pistol    M: jobs    P: pause    Q: save    L: load',
      done > 0 ? 'Jobs finished: ' + done + ' of 5    Cash: $' + state.player.cash : 'New game: help Mara Voss take back Solmara, one job at a time.',
    ];
    const pw = 720;
    const ph = 40 + lines.length * 30 + 56;
    const px = (w - pw) / 2;
    const py = h * 0.52;
    panel(px, py, pw, ph, 0.88);
    lines.forEach((line, i) => {
      text(line, w / 2, py + 44 + i * 30, 18, '#e8e8e8', 'center');
    });
    text('Press Enter to play', w / 2, py + ph - 20, 18, '#7fd4ff', 'center', true);
  }

  function drawPause(state) {
    centerPanel('PAUSED', [
      'The city waits. Your wanted level does not cool down while paused,',
      'but nothing else moves either. Cash: $' + state.player.cash + '   Jobs done: ' + state.missions.completed.filter(Boolean).length + ' / 5',
    ], 'P to resume    M for jobs    Q to save', '#7fd4ff');
  }

  function drawMissionSelect(state) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = 'rgba(6,10,18,0.6)';
    ctx.fillRect(0, 0, w, h);
    const pw = 780;
    const ph = 170 + MISSIONS.length * 46;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    panel(px, py, pw, ph, 0.94);
    text('MARA\u2019S PHONE \u2014 JOBS', w / 2, py + 58, 30, '#ffd94a', 'center', true);
    MISSIONS.forEach((m, i) => {
      const y = py + 108 + i * 46;
      const done = state.missions.completed[i];
      const sel = state.missions.selected === i;
      if (sel) {
        ctx.fillStyle = 'rgba(255,217,74,0.18)';
        ctx.fillRect(px + 18, y - 26, pw - 36, 38);
      }
      text((i + 1) + '.', px + 36, y, 19, '#ffffff', 'left', true);
      text(m.name + '  \u2014  $' + m.reward, px + 70, y, 19, done ? '#7dff8a' : '#ffffff', 'left', done);
      text(done ? 'DONE' : (state.missions.active && state.missions.active.def.id === m.id ? 'ACTIVE' : ''), px + pw - 90, y, 16, done ? '#7dff8a' : '#ffd94a', 'left', true);
    });
    text('Press 1-5 to start a job, or M / Esc to close', w / 2, py + ph - 24, 16, '#7fd4ff', 'center');
  }

  function drawOver(state, kind) {
    if (kind === 'busted') {
      centerPanel('BUSTED', [
        'The Solmara police took Mara in. The jobs wait, but the city forgets nothing.',
        'Cash: $' + state.player.cash + '   Jobs done: ' + state.missions.completed.filter(Boolean).length + ' / 5',
      ], 'Press Enter to try again', '#ff5a4a');
    } else if (kind === 'wasted') {
      centerPanel('WASTED', [
        'Mara went down in the streets of Solmara. The sun sets, and the city moves on.',
        'Cash: $' + state.player.cash + '   Jobs done: ' + state.missions.completed.filter(Boolean).length + ' / 5',
      ], 'Press Enter to try again', '#ff5a4a');
    } else if (kind === 'complete') {
      centerPanel('ALL JOBS DONE', [
        'Five jobs, one clean slate. Mara Voss owns the sunset now.',
        'Final cash: $' + state.player.cash + '. Solmara is yours to roam.',
      ], 'Press Enter to keep playing', '#7dff8a');
    }
  }

  return { drawHud, drawTitle, drawPause, drawMissionSelect, drawOver, text, panel };
}
