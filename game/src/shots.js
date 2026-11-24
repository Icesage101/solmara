// Solmara — the screenshot scenes behind ?shot=1..4.
// Each scene builds the city from the fixed shot seed, places the people and cars by
// hand at fixed coordinates, and sets the camera and the HUD exactly where the shot
// needs them. Nothing is simulated forward and nothing reads the clock, so the same
// URL always renders the same frame. Every scene is a real render of the game's own
// code: the same world builder, the same cars, the same HUD the player sees.
//
//   ?shot=1  title screen over the Marina, traffic rolling past
//   ?shot=2  a three-star chase: Mara in the gold Comet, cruisers behind, job banner up
//   ?shot=3  the Informant job on foot at the plaza, crew closing in
//   ?shot=4  a wide view of the city from a sedan, beach on the left

import { GAME, LANDMARKS } from './config.js';
import { buildCity } from './world.js';
import { makeCar, spawnParkedCar, spawnTrafficCar } from './vehicles.js';
import { makePedestrian } from './pedestrians.js';
import { makeThug } from './combat.js';
import { makeRng, rngRange } from './random.js';
import { startMission } from './missions.js';

function baseState(state) {
  state.city = buildCity(GAME.shotSeed);
  state.rng = makeRng(GAME.shotSeed + 7);
  state.cars = [];
  state.peds = [];
  state.thugs = [];
  state.officers = [];
  state.bullets = [];
  state.particles = [];
  state.skids = [];
  state.wanted = 0;
  state.clockMinutes = GAME.startTimeMinutes;
  state.day = 1;
}

function scatterTraffic(state, count, cx, cy, radius) {
  for (let i = 0; i < count; i += 1) {
    const car = spawnTrafficCar(state.city, state.rng);
    car.x = cx + rngRange(state.rng, -radius, radius);
    car.y = cy + rngRange(state.rng, -radius, radius);
    state.cars.push(car);
  }
}

function scatterPeds(state, count, cx, cy, radius) {
  for (let i = 0; i < count; i += 1) {
    const ped = makePedestrian(cx + rngRange(state.rng, -radius, radius), cy + rngRange(state.rng, -radius, radius), state.rng);
    state.peds.push(ped);
  }
}

// The title screen: the city alive behind the menu, Mara waiting by the pier.
export function stageShot1(state) {
  baseState(state);
  state.screen = 'title';
  state.player.x = 470;
  state.player.y = 820;
  state.player.angle = Math.PI / 2;
  state.camera.x = 820;
  state.camera.y = 640;
  state.camera.zoom = 1;
  scatterTraffic(state, 6, 820, 640, 420);
  scatterPeds(state, 8, 820, 640, 380);
  const parked = spawnParkedCar(state.city, state.rng, 'sedan');
  parked.x = 560;
  parked.y = 700;
  state.cars.push(parked);
}

// The chase: Mara in the gold Comet at speed, two cruisers on her bumper, three
// stars, the Sunset Getaway banner and the minimap all on screen.
export function stageShot2(state) {
  baseState(state);
  state.screen = 'play';
  state.player.cash = 1240;
  state.player.health = 100;
  state.player.ammo = 24;
  const comet = makeCar('sports', 1620, 980, -Math.PI / 2, 'player');
  comet.color = '#e8c820';
  comet.speed = 430;
  state.cars.push(comet);
  state.player.car = comet;
  state.player.x = comet.x;
  state.player.y = comet.y;
  const cruiser1 = makeCar('cruiser', 1620, 1120, -Math.PI / 2, 'police');
  cruiser1.speed = 420;
  const cruiser2 = makeCar('cruiser', 1660, 1180, -Math.PI / 2, 'police');
  cruiser2.speed = 400;
  state.cars.push(cruiser1, cruiser2);
  state.policeCruisers = [cruiser1, cruiser2];
  scatterTraffic(state, 5, 1620, 980, 420);
  scatterPeds(state, 6, 1620, 980, 420);
  startMission(state, 5);
  state.camera.x = 1620;
  state.camera.y = 980;
  state.camera.zoom = 1;
  state.toastText = '';
}

// The Informant job on foot at the plaza: Mara, three thugs closing in, a cruiser at
// the corner, peds scattering.
export function stageShot3(state) {
  baseState(state);
  state.screen = 'play';
  state.player.cash = 640;
  state.player.health = 61;
  state.player.ammo = 24;
  state.player.x = LANDMARKS.plaza.x + 40;
  state.player.y = LANDMARKS.plaza.y + 30;
  state.player.angle = -Math.PI / 2;
  state.wanted = 1;
  startMission(state, 4);
  const m = state.missions.active;
  m.step = 1;
  m.objective = 'Deal with the crew (3 left)';
  m.marker = null;
  for (let i = 0; i < 3; i += 1) {
    const thug = makeThug(LANDMARKS.plaza.x - 90 + i * 70, LANDMARKS.plaza.y - 90, state.rng);
    thug.angle = Math.PI / 2;
    state.thugs.push(thug);
  }
  m.thugsLeft = 3;
  const cruiser = makeCar('cruiser', 1220, 980, Math.PI / 4, 'police');
  state.cars.push(cruiser);
  state.policeCruisers = [cruiser];
  scatterTraffic(state, 4, LANDMARKS.plaza.x, LANDMARKS.plaza.y, 420);
  scatterPeds(state, 7, LANDMARKS.plaza.x, LANDMARKS.plaza.y, 380);
  state.camera.x = LANDMARKS.plaza.x;
  state.camera.y = LANDMARKS.plaza.y;
  state.camera.zoom = 1;
  state.toastText = 'The informant is here. His crew is coming. Fight!';
  state.toastUntil = 999999;
}

// The wide city view: a sedan rolling through the Marina with the beach, the blocks,
// the traffic and the minimap all in frame.
export function stageShot4(state) {
  baseState(state);
  state.screen = 'play';
  state.player.cash = 320;
  state.player.health = 100;
  const sedan = makeCar('sedan', 1220, 1320, -Math.PI / 2, 'player');
  sedan.color = '#3d6fb4';
  sedan.speed = 380;
  state.cars.push(sedan);
  state.player.car = sedan;
  state.player.x = sedan.x;
  state.player.y = sedan.y;
  state.wanted = 1;
  scatterTraffic(state, 9, 1220, 1320, 560);
  scatterPeds(state, 8, 1220, 1320, 520);
  const parked = spawnParkedCar(state.city, state.rng, 'taxi');
  parked.x = 820;
  parked.y = 640;
  state.cars.push(parked);
  state.camera.x = 1220;
  state.camera.y = 1320;
  state.camera.zoom = 0.62;
  state.toastText = '';
}

// Pick a scene by its ?shot= number (1 to 4; anything else is the title scene).
export function stageShot(name, state) {
  if (name === '2') stageShot2(state);
  else if (name === '3') stageShot3(state);
  else if (name === '4') stageShot4(state);
  else stageShot1(state);
}
