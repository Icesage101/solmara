// config.js — every constant the rest of Solmara reads: world geometry,
// vehicle catalogue, district names, palette and tuning numbers. One job:
// hold the numbers so no other file hard-codes them.

export const TILE = {
  block: 216, // pitch of one city block including its road
  road: 64, // width of a street in pixels
  cols: 10, // blocks across
  rows: 8, // blocks down
};

export const WORLD = {
  w: TILE.cols * TILE.block + TILE.road,
  h: TILE.rows * TILE.block + TILE.road,
};

export const PLAYER = {
  walkSpeed: 155,
  runSpeed: 250,
  radius: 11,
  maxHp: 100,
  punchRange: 30,
  punchDamage: 34,
};

export const WANTED = {
  max: 5,
  decayPerSec: 0.045, // stars per second while unseen
  sightRange: 460, // police notice crimes inside this radius
  bustTime: 1.6, // seconds held at gunpoint before arrest
};

// The six drivable kinds. topSpeed in px/s, accel in px/s^2, grip is how
// fast the heading follows the steering, colors are body paints.
export const CAR_TYPES = {
  sedan: { name: 'Meridian Sedan', topSpeed: 330, accel: 210, grip: 3.4, colors: ['#c8ccd4', '#5b7fa6', '#8a4b4b', '#3f4a3a'] },
  taxi: { name: 'Sol Cab Taxi', topSpeed: 315, accel: 200, grip: 3.3, colors: ['#f2b233'] },
  pickup: { name: 'Dune Hauler Pickup', topSpeed: 300, accel: 185, grip: 2.9, colors: ['#7a6a53', '#4d5d53', '#94572f'] },
  sports: { name: 'Vireo GT Sports', topSpeed: 470, accel: 330, grip: 4.1, colors: ['#d8443c', '#e8e4da', '#274b8f', '#f28c28'] },
  van: { name: 'Cargo Mule Van', topSpeed: 265, accel: 160, grip: 2.6, colors: ['#d8d8d2', '#6b7f8c', '#54486b'] },
  police: { name: 'SPD Interceptor', topSpeed: 430, accel: 300, grip: 3.9, colors: ['#20242c'] },
};

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 0.5, y1: 0.45 },
  { name: 'The Hills', x0: 0.5, y0: 0, x1: 1, y1: 0.45 },
  { name: 'Harbor District', x0: 0, y0: 0.45, x1: 0.45, y1: 1 },
  { name: 'Marina', x0: 0.45, y0: 0.45, x1: 1, y1: 1 },
];

export const SAVE_KEY = 'solmara-save-v1';

export const MISSION_REWARD_BASE = 150; // dollars, scaled per mission

export const CLOCK_START = 9 * 60; // 09:00 in game minutes
export const CLOCK_RATE = 2; // game minutes per real second

export const PALETTE = {
  road: '#33373d',
  roadLine: '#c9a227',
  sidewalk: '#9aa0a3',
  grass: '#5d8a4a',
  sand: '#e3cf9e',
  water: '#2e6f8e',
  plaza: '#b8a888',
  roofA: '#b0563a',
  roofB: '#7a6a8f',
  roofC: '#4a6b7a',
  roofD: '#8f7a4a',
};
