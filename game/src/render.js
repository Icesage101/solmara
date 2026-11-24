// Drawing only: the city, the people, the cars and the effects, painted onto the
// canvas from the game's state. The camera follows the player with a look-ahead,
// and the frame is lit like a late Solmara afternoon.
import { WORLD, ROAD_W, DISTRICTS } from './config.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  function font(size, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }
  function text(str, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }

  function drawCarShape(car) {
    const spec = car.spec;
    const L = spec.len;
    const W = spec.wid;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    // Roof and windows.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    roundRect(-L / 2 + 12, -W / 2 + 4, L * 0.42, W - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.5)';
    ctx.fillRect(-L / 2 + 15, -W / 2 + 6, L * 0.16, W - 12);
    // Headlights and tail lights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 6);
    ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 6);
    ctx.fillStyle = '#d43a2a';
    ctx.fillRect(-L / 2, -W / 2 + 2, 3, 6);
    ctx.fillRect(-L / 2, W / 2 - 8, 3, 6);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#222';
      text('TAXI', -2, 4, 9, '#222', 'center', true);
    }
    if (car.police) {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-L / 2 + 8, -W / 2, 10, W);
      ctx.fillStyle = '#d43a2a';
      ctx.fillRect(-L / 2 + 10, -W / 2 + 2, 6, W - 4);
      // Flashing light bar.
      const phase = Math.floor(car.sirenPhase * 6) % 2;
      ctx.fillStyle = phase ? '#ff2a2a' : '#2a6bff';
      ctx.fillRect(-6, -W / 2 - 2, 12, 5);
      ctx.fillStyle = phase ? '#2a6bff' : '#ff2a2a';
      ctx.fillRect(-6, W / 2 - 3, 12, 5);
    }
    if (car.target) {
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-L / 2 - 4, -W / 2 - 4, L + 8, W + 8);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPerson(p, isPlayer) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.angle);
    // Body and head, drawn facing right.
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(8, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.arc(6, -2, 5, Math.PI * 0.6, Math.PI * 1.7);
    ctx.fill();
    // Punching arm.
    if (isPlayer && p.punchAnim > 0) {
      ctx.strokeStyle = p.skin;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(26, -2);
      ctx.stroke();
    }
    ctx.restore();
    if (p.state === 'down') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(0.6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWorld(state, cam, zoom) {
    const city = state.city;
    const vx0 = cam.x - 700 / zoom;
    const vy0 = cam.y - 400 / zoom;
    const vx1 = cam.x + 700 / zoom;
    const vy1 = cam.y + 400 / zoom;
    // Ground: dry grass and sand, with the sea along the west edge.
    ctx.fillStyle = '#b8a06a';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(vx0, vy0, 170 - vx0 > 0 ? 170 - vx0 : 0, vy1 - vy0);
    ctx.fillStyle = '#e8d9a8';
    ctx.fillRect(170, vy0, 60, vy1 - vy0);
    // Park and plaza grass.
    ctx.fillStyle = '#5d9448';
    ctx.fillRect(city.park.x0, city.park.y0, city.park.x1 - city.park.x0, city.park.y1 - city.park.y0);
    ctx.fillStyle = '#c9b18a';
    ctx.fillRect(city.plaza.x0, city.plaza.y0, city.plaza.x1 - city.plaza.x0, city.plaza.y1 - city.plaza.y0);

    // Roads.
    ctx.fillStyle = '#3a3f46';
    const half = ROAD_W / 2;
    for (const s of city.streets) {
      if (s > vy0 - half && s < vy1 + half) ctx.fillRect(vx0, s - half, vx1 - vx0, ROAD_W);
      if (s > vx0 - half && s < vx1 + half) ctx.fillRect(s - half, vy0, ROAD_W, vy1 - vy0);
    }
    // Sidewalks.
    ctx.fillStyle = '#9a938a';
    for (const s of city.streets) {
      if (s > vy0 - half - 16 && s < vy1 + half + 16) {
        ctx.fillRect(vx0, s - half - 14, vx1 - vx0, 14);
        ctx.fillRect(vx0, s + half, vx1 - vx0, 14);
      }
      if (s > vx0 - half - 16 && s < vx1 + half + 16) {
        ctx.fillRect(s - half - 14, vy0, 14, vy1 - vy0);
        ctx.fillRect(s + half, vy0, 14, vy1 - vy0);
      }
    }
    // Centre dashes.
    ctx.strokeStyle = '#e8d94a';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    for (const s of city.streets) {
      if (s > vy0 && s < vy1) {
        ctx.beginPath(); ctx.moveTo(vx0, s); ctx.lineTo(vx1, s); ctx.stroke();
      }
      if (s > vx0 && s < vx1) {
        ctx.beginPath(); ctx.moveTo(s, vy0); ctx.lineTo(s, vy1); ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // District labels on the ground.
    ctx.font = font(34, true);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = (d.x0 + d.x1) / 2;
      const cy = (d.y0 + d.y1) / 2;
      if (cx > vx0 && cx < vx1 && cy > vy0 && cy < vy1) ctx.fillText(d.label, cx, cy);
    }

    // Buildings with a sun-side shadow.
    for (const b of city.buildings) {
      if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 6);
    }
    // Trees, lamps and benches.
    for (const t of city.trees) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7d3a';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5da34e';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#444';
    for (const l of city.lamps) {
      if (l.x < vx0 || l.x > vx1 || l.y < vy0 || l.y > vy1) continue;
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    }
    for (const b of city.benches) {
      if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(-12, -4, 24, 8);
      ctx.restore();
    }

    // Safehouse marker.
    const sh = state.safehouse;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(-26, -26, 52, 52);
    ctx.fillStyle = '#e8d9a8';
    ctx.fillRect(-22, -22, 44, 44);
    ctx.restore();
    text('SAFEHOUSE', sh.x, sh.y - 34, 13, '#ffffff', 'center', true);

    // Mission marker: a gold pillar of light and a bouncing diamond.
    const marker = state.missionMarker;
    if (marker) {
      const bob = Math.sin(state.time * 4) * 6;
      const grad = ctx.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
      grad.addColorStop(0, 'rgba(255,217,74,0)');
      grad.addColorStop(1, 'rgba(255,217,74,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(marker.x - 14, marker.y - 260, 28, 260);
      ctx.save();
      ctx.translate(marker.x, marker.y - 40 + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd94a';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#8a6d00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
      text(marker.label, marker.x, marker.y + 26, 13, '#ffd94a', 'center', true);
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(state) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, w, h);
    const zoom = state.zoom || 1;
    const scale = Math.min(w / 1280, h / 720) * zoom;
    const cam = state.camera;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.setTransform(scale, 0, 0, scale, w / 2 - (cam.x + shakeX) * scale, h / 2 - (cam.y + shakeY) * scale);

    drawWorld(state, cam, zoom);
    for (const car of state.cars) drawCarShape(car);
    for (const car of state.police.cruisers) drawCarShape(car);
    for (const p of state.peds) drawPerson(p, false);
    for (const c of state.police.footCops) drawPerson(c, false);
    if (!state.player.inCar) drawPerson(state.player, true);
    // Bullets and muzzle flash.
    ctx.fillStyle = '#ffd94a';
    for (const b of state.combat.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-8, -1.5, 16, 3);
      ctx.restore();
    }
    if (state.combat.muzzle > 0 && !state.player.inCar) {
      ctx.fillStyle = '#fff2a8';
      ctx.beginPath();
      ctx.arc(state.player.x + Math.cos(state.player.angle) * 26, state.player.y + Math.sin(state.player.angle) * 26, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    drawParticles(state);

    // Off-screen mission arrow at the screen edge.
    const marker = state.missionMarker;
    if (marker) {
      const dx = marker.x - cam.x;
      const dy = marker.y - cam.y;
      const dist = Math.hypot(dx, dy);
      const viewR = 560 / zoom;
      if (dist > viewR) {
        const ang = Math.atan2(dy, dx);
        const ex = cam.x + Math.cos(ang) * viewR;
        const ey = cam.y + Math.sin(ang) * viewR;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        text(Math.round(dist) + 'm', ex, ey + 28, 12, '#ffd94a', 'center', true);
      }
    }

    // Late-afternoon sun wash and vignette.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sun = ctx.createLinearGradient(0, 0, w, h);
    sun.addColorStop(0, 'rgba(255,190,90,0.10)');
    sun.addColorStop(0.5, 'rgba(255,190,90,0.02)');
    sun.addColorStop(1, 'rgba(40,60,120,0.08)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, text, font };
}
