// Solmara — the renderer: everything the player sees of the city.
// One canvas, drawn top-down. The camera follows Mara (or her car) with a look-ahead
// in the direction of travel, and the world is drawn in layers: sea and sand, block
// ground, roads with their markings, landmarks, buildings and trees, then cars, people,
// bullets and particles, then the mission marker. Nothing here changes game state.

import { WORLD, LANDMARKS, clamp, lerp } from './config.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1, shake: 0 };
}

// Keep the camera on the player, looking a little way ahead of where they are going.
export function updateCamera(camera, state, dt) {
  const p = state.player;
  const focus = p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
  const lookX = p.car ? Math.cos(p.car.angle) * Math.abs(p.car.speed) * 0.22 : Math.cos(p.angle) * 40;
  const lookY = p.car ? Math.sin(p.car.angle) * Math.abs(p.car.speed) * 0.22 : Math.sin(p.angle) * 40;
  const tx = focus.x + lookX;
  const ty = focus.y + lookY;
  const k = Math.min(1, 5 * dt);
  camera.x = lerp(camera.x, tx, k);
  camera.y = lerp(camera.y, ty, k);
  if (state.shake > 0) {
    camera.shake = state.shake;
    state.shake = Math.max(0, state.shake - dt * 30);
  } else {
    camera.shake = 0;
  }
}

function visible(ctx, camera, view) {
  return {
    x0: camera.x - view.w / 2 / camera.zoom - 80,
    x1: camera.x + view.w / 2 / camera.zoom + 80,
    y0: camera.y - view.h / 2 / camera.zoom - 80,
    y1: camera.y + view.h / 2 / camera.zoom + 80,
  };
}

export function drawWorld(ctx, state, camera, view) {
  const city = state.city;
  const vis = visible(ctx, camera, view);
  const shakeX = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
  const shakeY = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;

  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

  // Sea and sand on the west edge.
  ctx.fillStyle = '#2f7d9a';
  ctx.fillRect(0, -100, WORLD.seaEdge, WORLD.height + 200);
  ctx.fillStyle = '#3d8fa8';
  for (let y = 0; y < WORLD.height; y += 46) {
    ctx.fillRect(0, y, WORLD.seaEdge, 3);
  }
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(WORLD.seaEdge, -100, WORLD.beachEdge - WORLD.seaEdge, WORLD.height + 200);

  // Block ground: warm sun-baked earth, tinted by district.
  for (const block of city.blocks) {
    if (block.x1 < vis.x0 || block.x0 > vis.x1 || block.y1 < vis.y0 || block.y0 > vis.y1) continue;
    ctx.fillStyle = '#c9b183';
    ctx.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
  }
  // The park is green; the plaza is pale stone.
  const park = LANDMARKS.park;
  ctx.fillStyle = '#6aa85e';
  ctx.fillRect(park.x - park.w / 2, park.y - park.h / 2, park.w, park.h);
  const plaza = LANDMARKS.plaza;
  ctx.fillStyle = '#d8cbb0';
  ctx.fillRect(plaza.x - plaza.w / 2, plaza.y - plaza.h / 2, plaza.w, plaza.h);
  ctx.strokeStyle = '#b8a888';
  ctx.lineWidth = 4;
  ctx.strokeRect(plaza.x - plaza.w / 2, plaza.y - plaza.h / 2, plaza.w, plaza.h);

  // Roads: dark tarmac with pale shoulders, dashed centre lines, crosswalks.
  const half = WORLD.roadWidth / 2;
  ctx.fillStyle = '#3a3f46';
  for (const rx of WORLD.roadsX) ctx.fillRect(rx - half, 0, WORLD.roadWidth, WORLD.height);
  for (const ry of WORLD.roadsY) ctx.fillRect(WORLD.beachEdge, ry - half, WORLD.width - WORLD.beachEdge, WORLD.roadWidth);
  ctx.fillStyle = '#565b62';
  for (const rx of WORLD.roadsX) {
    ctx.fillRect(rx - half, 0, 4, WORLD.height);
    ctx.fillRect(rx + half - 4, 0, 4, WORLD.height);
  }
  for (const ry of WORLD.roadsY) {
    ctx.fillRect(WORLD.beachEdge, ry - half, WORLD.width - WORLD.beachEdge, 4);
    ctx.fillRect(WORLD.beachEdge, ry + half - 4, WORLD.width - WORLD.beachEdge, 4);
  }
  ctx.fillStyle = '#e8c832';
  for (const rx of WORLD.roadsX) {
    for (let y = 0; y < WORLD.height; y += 44) {
      if (y % 88 < 44) ctx.fillRect(rx - 2, y, 4, 22);
    }
  }
  for (const ry of WORLD.roadsY) {
    for (let x = WORLD.beachEdge; x < WORLD.width; x += 44) {
      if (x % 88 < 44) ctx.fillRect(x, ry - 2, 22, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = '#d8d8d8';
  for (const rx of WORLD.roadsX) {
    for (const ry of WORLD.roadsY) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(rx - half + 8 + (i + 3) * 12, ry - half - 12, 7, 10);
        ctx.fillRect(rx - half + 8 + (i + 3) * 12, ry + half + 2, 7, 10);
      }
    }
  }

  drawBuildingsAndTrees(ctx, city, vis);
  drawLandmarkLabels(ctx, state, vis);
  ctx.restore();
  return vis;
}

function drawBuildingsAndTrees(ctx, city, vis) {
  // Buildings: a shaded wall, a flat roof, and a taller top for the tall ones, so the
  // city reads as a skyline from above instead of flat boxes.
  for (const b of city.buildings) {
    if (b.x + b.w < vis.x0 || b.x > vis.x1 || b.y + b.h < vis.y0 || b.y > vis.y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.tall) {
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + b.w * 0.28, b.y + b.h * 0.28, b.w * 0.44, b.h * 0.44);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w * 0.28, b.y + b.h * 0.28, b.w * 0.44, 4);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Trees: a soft shadow and a green crown; palms on the beach are taller and thinner.
  for (const t of city.trees) {
    if (t.x < vis.x0 || t.x > vis.x1 || t.y < vis.y0 || t.y > vis.y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.palm ? '#3f9e4d' : '#4d8a3f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#67b354';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Benches and planters.
  for (const prop of city.props) {
    if (prop.x < vis.x0 || prop.x > vis.x1 || prop.y < vis.y0 || prop.y > vis.y1) continue;
    if (prop.kind === 'bench') {
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(prop.x, prop.y, 22, 7);
    } else {
      ctx.fillStyle = '#5a7a4a';
      ctx.fillRect(prop.x, prop.y, 12, 12);
    }
  }
  // Traffic lights: a small post, green or red by the cycle.
  for (const light of city.lights) {
    if (light.x < vis.x0 || light.x > vis.x1 || light.y < vis.y0 || light.y > vis.y1) continue;
    ctx.fillStyle = '#222';
    ctx.fillRect(light.x + 52, light.y - 52, 4, 16);
    const green = (Math.floor(performance.now() / 1000) + light.phase) % 8 < 4;
    ctx.fillStyle = green ? '#3fd45a' : '#e84040';
    ctx.beginPath();
    ctx.arc(light.x + 54, light.y - 54, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLandmarkLabels(ctx, state, vis) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Arial, sans-serif';
  const labels = [
    { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y + 8, text: 'Solmara Plaza' },
    { x: LANDMARKS.park.x, y: LANDMARKS.park.y + 8, text: 'Palm Court Park' },
    { x: 300, y: 1300, text: 'Marina Beach' },
    { x: LANDMARKS.harborDock.x, y: LANDMARKS.harborDock.y - 30, text: 'Harbor Dock 7' },
    { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y - 26, text: "Mara's Safehouse" },
  ];
  for (const label of labels) {
    if (label.x < vis.x0 || label.x > vis.x1 || label.y < vis.y0 || label.y > vis.y1) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(label.text, label.x, label.y);
  }
  // The safehouse itself: a small house with a warm roof.
  const s = LANDMARKS.safehouse;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(s.x - 22, s.y - 14, 48, 36);
  ctx.fillStyle = '#e8d8b0';
  ctx.fillRect(s.x - 24, s.y - 18, 48, 32);
  ctx.fillStyle = '#b04a3a';
  ctx.beginPath();
  ctx.moveTo(s.x - 28, s.y - 18);
  ctx.lineTo(s.x, s.y - 36);
  ctx.lineTo(s.x + 28, s.y - 18);
  ctx.closePath();
  ctx.fill();
}

// --- People and cars ---

function drawPerson(ctx, x, y, angle, shirt, skin, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  if (o.down) {
    // Lying flat.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(14, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(7, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (o.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const halfL = car.length / 2;
  const halfW = car.width / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-halfL + 3, -halfW + 3, car.length, car.width);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-halfL, -halfW, car.length, car.width, 7);
  ctx.fill();
  // Cabin and windows.
  ctx.fillStyle = '#1d2733';
  ctx.beginPath();
  ctx.roundRect(-halfL * 0.45, -halfW + 4, car.length * 0.42, car.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = '#9fc4d8';
  ctx.fillRect(-halfL * 0.45 + 3, -halfW + 6, 8, car.width - 12);
  // Headlights and tail lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(halfL - 3, -halfW + 3, 3, 5);
  ctx.fillRect(halfL - 3, halfW - 8, 3, 5);
  ctx.fillStyle = '#e84040';
  ctx.fillRect(-halfL, -halfW + 3, 3, 5);
  ctx.fillRect(-halfL, halfW - 8, 3, 5);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'cruiser') {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-halfL + 6, -halfW + 2, car.length - 12, 4);
    ctx.fillRect(-halfL + 6, halfW - 6, car.length - 12, 4);
    const on = Math.floor(time * 2.4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#2a6aff';
    ctx.beginPath();
    ctx.arc(-2, -halfW + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = on ? '#2a6aff' : '#ff2a2a';
    ctx.beginPath();
    ctx.arc(-2, halfW - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.health < 40) {
    ctx.fillStyle = 'rgba(40,40,40,0.5)';
    ctx.fillRect(-halfL + 4, -halfW + 4, 12, 8);
  }
  ctx.restore();
}

// Draw every moving thing, in the same camera transform the world used.
export function drawEntities(ctx, state, camera, view) {
  const shakeX = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
  const shakeY = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

  // Skid marks first, so cars draw over them.
  for (const mark of state.skids) {
    ctx.strokeStyle = 'rgba(20,20,20,0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mark.x1, mark.y1);
    ctx.lineTo(mark.x2, mark.y2);
    ctx.stroke();
  }

  for (const car of state.cars) drawCar(ctx, car, state.time);

  // Mara on foot: a courier in a yellow jacket, so she is easy to spot in the crowd.
  const p = state.player;
  if (!p.car) {
    drawPerson(ctx, p.x, p.y, p.angle, '#e8c820', '#e8b88a', { flash: p.hurtFlash || 0 });
    if (p.punchAnim > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(18, 0, 16, -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
    }
    // A ring under Mara so the eye finds her at a glance.
    ctx.strokeStyle = 'rgba(232,200,32,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const ped of state.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, { down: ped.down });
  }
  for (const thug of state.thugs) {
    drawPerson(ctx, thug.x, thug.y, thug.angle, thug.shirt, thug.skin, { down: thug.down, flash: thug.flash });
    if (!thug.down) {
      ctx.fillStyle = '#e84040';
      ctx.fillRect(thug.x - 12, thug.y - 24, 24, 4);
      ctx.fillStyle = '#3fd45a';
      ctx.fillRect(thug.x - 12, thug.y - 24, 24 * clamp(thug.health / 60, 0, 1), 4);
    }
  }
  for (const officer of state.officers) {
    drawPerson(ctx, officer.x, officer.y, officer.angle, '#1d3a6e', officer.skin, { down: officer.down });
    ctx.fillStyle = '#1d3a6e';
    ctx.font = 'bold 8px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', officer.x, officer.y - 16);
    if (!officer.down && officer.arrestTimer > 0) {
      ctx.fillStyle = '#e84040';
      ctx.fillRect(officer.x - 12, officer.y - 30, 24, 4);
      ctx.fillStyle = '#ffd27d';
      ctx.fillRect(officer.x - 12, officer.y - 30, 24 * clamp(officer.arrestTimer / 1.2, 0, 1), 4);
    }
  }

  // Bullets: short bright streaks.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
  }

  // Particles: dust, sparks, smoke.
  for (const part of state.particles) {
    ctx.globalAlpha = clamp(part.life / part.maxLife, 0, 1);
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The mission marker: a pulsing gold diamond with a beam, plus a label.
  const m = state.missions.active;
  if (m && m.marker) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.save();
    ctx.translate(m.marker.x, m.marker.y);
    ctx.fillStyle = 'rgba(232,200,32,0.25)';
    ctx.fillRect(-3, -160, 6, 160);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#e8c820';
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 2;
    const s = 16 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = '#e8c820';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.marker.label, m.marker.x, m.marker.y - 46);
  }
  ctx.restore();
}

// An arrow at the screen edge pointing at the mission marker when it is off-screen.
export function drawOffscreenArrow(ctx, state, camera, view) {
  const m = state.missions.active;
  if (!m || !m.marker) return;
  const sx = (m.marker.x - camera.x) * camera.zoom + view.w / 2;
  const sy = (m.marker.y - camera.y) * camera.zoom + view.h / 2;
  if (sx > 0 && sx < view.w && sy > 0 && sy < view.h) return;
  const cx = clamp(sx, 40, view.w - 40);
  // Keep the arrow clear of the cash panel top-left and the minimap top-right.
  const topClear = cx < 250 || cx > view.w - 230 ? 140 : 90;
  const cy = clamp(sy, topClear, view.h - 40);
  const angle = Math.atan2(sy - cy, sx - cx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = '#e8c820';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
