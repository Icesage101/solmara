// The screenshot scenes behind ?shot=start|chase|mission|city. Each one sets the
// real game up in a fixed state, then plays the real rules forward for a fixed
// number of steps with a small autopilot, so the frame is a moment of genuine
// play and the same seed always gives the same frame.
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { tryPunch } from './combat.js';

const STEP = 1 / 60;

function driveStraight(game, seconds, steerBias) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = game.car;
    let steer = 0;
    if (car) {
      // Stay on the street: steer back toward the road's centre line.
      const street = game.city.nearestStreet(car.x);
      const want = car.angle > 0 ? Math.PI / 2 : -Math.PI / 2;
      const off = car.x - street.pos;
      steer = Math.max(-1, Math.min(1, (want - car.angle) * 2 - off * 0.004 + (steerBias || 0)));
    }
    game.step(STEP, { up: true, down: false, left: steer < -0.15, right: steer > 0.15, run: false });
  }
}

function walkForward(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP, { up: true, down: false, left: false, right: false, run: false });
  }
}

function putPlayerInCar(game, type, x, y, angle, color, owned) {
  const car = makeCar(type, x, y, angle, color);
  if (owned) car.stolen = true; // Mara's own car: no theft, no heat.
  game.cars.push(car);
  game.enterCar(car);
  return car;
}

export function stageShot(name, game) {
  game.resetWorld();
  if (name === 'chase') {
    // Mission 5, the Sunset Getaway: Mara in a gold Comet, three stars, two
    // cruisers on her tail, the safehouse marker on the map.
    startMission(game, 4);
    const car = putPlayerInCar(game, 'sports', 1500, 1900, Math.PI / 2, '#e6b800');
    car.speed = 200;
    game.player.cash = 1240;
    // Clear the road ahead so the chase runs clean, and put two cruisers
    // right on her tail instead of waiting for them to find her.
    game.cars = game.cars.filter((c) => !(c.traffic && Math.abs(c.x - 1500) < 130 && c.y > 1100 && c.y < 3300));
    game.police.spawnTimer = 999;
    for (let i = 0; i < 2; i += 1) {
      const cruiser = makeCar('police', 1500, 1720 - i * 90, Math.PI / 2, '#1d3a5f');
      cruiser.police = true;
      cruiser.speed = 320 + i * 10;
      cruiser.sirenPhase = i * 2;
      game.police.cruisers.push(cruiser);
    }
    driveStraight(game, 5, 0);
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mission 4, the Informant: Mara on foot at Solmara Plaza, the crew closing
    // in, pedestrians scattering, traffic rolling past.
    startMission(game, 3);
    game.player.x = 2400;
    game.player.y = 2920;
    game.player.angle = -Math.PI / 2;
    game.player.cash = 640;
    // Walk up to the informant to trigger the crew, then stand and fight.
    walkForward(game, 0.7);
    const steps = Math.round(2.5 / STEP);
    for (let i = 0; i < steps; i += 1) {
      const thugNear = game.peds.some((p) => p.thug && p.state !== 'down' && Math.hypot(p.x - game.player.x, p.y - game.player.y) < 50);
      if (thugNear) {
        const thug = game.peds.find((p) => p.thug && p.state !== 'down');
        if (thug) game.player.angle = Math.atan2(thug.y - game.player.y, thug.x - game.player.x);
        tryPunch(game);
      }
      game.step(STEP, { up: false, down: false, left: false, right: false, run: false });
    }
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    return { screen: 'play' };
  }
  if (name === 'city') {
    // A wide view from a moving car: Mara cruising the Marina boulevard with
    // the sea on one side and the whole city opening up ahead.
    const car = putPlayerInCar(game, 'sedan', 700, 1500, Math.PI / 2, '#2e5fa3', true);
    car.speed = 170;
    game.zoom = 0.62;
    game.player.cash = 320;
    driveStraight(game, 6, 0);
    game.camera.x = game.player.x;
    game.camera.y = game.player.y - 120;
    return { screen: 'play' };
  }
  // start: the title screen over a living city, traffic rolling and people walking.
  game.player.x = 700;
  game.player.y = 900;
  game.player.angle = Math.PI / 2;
  game.camera.x = 1500;
  game.camera.y = 1500;
  const steps = Math.round(5 / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP, { up: false, down: false, left: false, right: false, run: false }, true);
  }
  game.camera.x = 1500;
  game.camera.y = 1500;
  return { screen: 'title' };
}
