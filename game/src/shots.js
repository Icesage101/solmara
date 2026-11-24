// shots.js — the staged scenes behind the screenshots. Each scene is a
// real state of the real game, built from the same seed every time and
// stepped with fixed inputs, so ?shot=chase always renders the same
// frame. One job: set the stage; main.js runs the simulation.

import { WORLD } from './config.js';
import { makePed } from './pedestrians.js';
import { startMission } from './missions.js';

// Snap the camera onto the player so a scene starts already framed; the
// live follow camera takes it from there during the settle steps.
function snapCam(G) {
  G.cam.x = Math.max(0, Math.min(WORLD.w - G.view.w, G.player.x - G.view.w / 2));
  G.cam.y = Math.max(0, Math.min(WORLD.h - G.view.h, G.player.y - G.view.h / 2));
}

function placePlayerInCar(G, typeWanted) {
  // find the nearest car of the wanted type, or any car, and seat Mara
  let car = G.cars.find((c) => c.type === typeWanted && c.role === 'parked');
  if (!car) car = G.cars.find((c) => c.role === 'parked');
  car.role = 'player';
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  return car;
}

function copBehind(G, car, back, side) {
  const cop = G.cars.find((c) => c.role === 'traffic');
  cop.role = 'police';
  cop.type = 'police';
  cop.color = '#20242c';
  cop.x = car.x - Math.cos(car.angle) * back + side;
  cop.y = car.y - Math.sin(car.angle) * back + Math.cos(car.angle) * side;
  cop.angle = car.angle;
  cop.speed = car.speed * 0.94;
  return cop;
}

export function setupShot(G, name) {
  const P = G.world.places;
  G.mode = 'playing';
  if (name === 'start') {
    G.mode = 'title';
    G.player.x = P.start.x;
    G.player.y = P.start.y;
    G.cam.x = G.player.x - G.view.w / 2;
    G.cam.y = G.player.y - G.view.h / 2;
  } else if (name === 'chase') {
    const car = placePlayerInCar(G, 'sports');
    car.x = P.diner.x - 816; car.y = 1099; // the coast road's eastbound lane, a clear straight
    car.angle = 0; car.speed = 330;
    G.player.x = car.x; G.player.y = car.y;
    snapCam(G);
    copBehind(G, car, 130, -34);
    copBehind(G, car, 280, 42);
    G.wanted.stars = 3;
    startMission(G, G.defs[4]); // Sunset Getaway: objective + marker up
    G.banner = null;
  } else if (name === 'mission') {
    G.player.x = P.garage.x + 250;
    G.player.y = P.garage.y + 190;
    G.player.cash = 640;
    startMission(G, G.defs[3]); // The Informant
    // jump straight to the fight stage with Sal squaring up
    G.mission.stage = 1;
    const sal = makePed(G.player.x + 66, G.player.y + 18, G.rng, 'target');
    sal.hp = 90;
    sal.state = 'fight';
    G.peds.push(sal);
    G.mission.targetPed = sal;
    G.objective = G.defs[3].stages[1].label;
    G.banner = null;
    G.wanted.stars = 1;
    G.wanted.spawnTimer = 999; // the star is up, but no cruiser arrives mid-scene
    snapCam(G);
  } else if (name === 'city') {
    const car = placePlayerInCar(G, 'sedan');
    car.x = P.start.x - 108; car.y = P.start.y - 300;
    car.angle = Math.PI / 2; car.speed = 210;
    G.player.x = car.x; G.player.y = car.y;
    G.player.cash = 320;
    startMission(G, G.defs[0]); // First Fare: marker across town
    G.banner = null;
    snapCam(G);
  }
}

// Scripted inputs while a shot scene settles: chase and city roll
// forward, the mission scene lets Sal close in, the title idles.
export function shotInput(name) {
  if (name === 'chase' || name === 'city') {
    return { up: true, down: false, left: false, right: false, handbrake: false };
  }
  return { up: false, down: false, left: false, right: false, handbrake: false };
}

// How long each scene settles, in fixed 30/s steps, before its frame:
// the chase and the city drive are timed so the player's car is still
// mid-frame, mid-action, when the shot is taken.
export const SHOT_STEPS = { start: 110, chase: 55, mission: 110, city: 60 };

// The four scenes, in screenshot order: the cover is the title over the
// live city, then the chase, the on-foot job, and the wide city drive.
export const SHOT_NAMES = ['start', 'chase', 'mission', 'city'];
