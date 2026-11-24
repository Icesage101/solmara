// Solmara: Streets of the Sun — shared constants.
// One place for every number the rest of the game tunes against: the size of the city,
// how fast feet and cars move, what a crime costs in wanted stars, and the five story
// jobs with their pay. Nothing here knows about the canvas or the keyboard.

// The city is one fixed-size map, drawn top-down. Roads run on a regular grid so traffic
// can follow them; the blocks between them hold buildings, trees, the park and the plaza.
export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 96,
  // West of this line is the sea; the sand strip between sea and first road is the beach.
  seaEdge: 210,
  beachEdge: 300,
  // Vertical road centre lines, west to east.
  roadsX: [420, 820, 1220, 1620, 2020, 2420, 2820, 3220],
  // Horizontal road centre lines, north to south.
  roadsY: [300, 640, 980, 1320, 1660, 2000, 2340],
};

export const DISTRICTS = [
  { name: 'Marina', x0: 210, y0: 0, x1: 1000, y1: 900, tint: '#7fb8c9' },
  { name: 'Old Town', x0: 1000, y0: 0, x1: 2200, y1: 1300, tint: '#c9a86a' },
  { name: 'Hills', x0: 2200, y0: 0, x1: 3600, y1: 1000, tint: '#8fae7d' },
  { name: 'Harbor', x0: 2200, y0: 1300, x1: 3600, y1: 2600, tint: '#7d94a8' },
  { name: 'Southside', x0: 210, y0: 1300, x1: 2200, y1: 2600, tint: '#b98a6a' },
];

// Where the story lives: the plaza, the park, the safehouse and the harbour dock.
export const LANDMARKS = {
  plaza: { x: 1420, y: 1150, w: 360, h: 300, name: 'Solmara Plaza' },
  park: { x: 2220, y: 760, w: 360, h: 380, name: 'Palm Court Park' },
  safehouse: { x: 560, y: 480, name: 'Mara\u2019s Safehouse' },
  harborDock: { x: 3300, y: 2150, name: 'Harbor Dock 7' },
  marinaPier: { x: 420, y: 820, name: 'Marina Pier' },
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 275,
  health: 100,
  punchDamage: 25,
  punchRange: 40,
  punchArc: 1.9,
  punchCooldown: 0.38,
  pistolDamage: 34,
  pistolRange: 430,
  bulletSpeed: 760,
  startCash: 40,
  startAmmo: 24,
};

// Six stealable car types. Each has its own top speed, acceleration, grip and colour
// palette, so a sports car really does outrun a van and a taxi really does feel like one.
export const CAR_TYPES = {
  sedan: { name: 'Sedan', length: 46, width: 22, topSpeed: 430, accel: 260, brake: 520, turn: 2.5, colors: ['#3d6fb4', '#7a4a8a', '#b0b6bd', '#4a7a5a'] },
  taxi: { name: 'Taxi', length: 46, width: 22, topSpeed: 420, accel: 250, brake: 520, turn: 2.5, colors: ['#e8b820'] },
  pickup: { name: 'Pickup', length: 52, width: 24, topSpeed: 400, accel: 230, brake: 480, turn: 2.1, colors: ['#8a4a2a', '#5a6a72', '#a03a3a'] },
  sports: { name: 'Comet', length: 48, width: 22, topSpeed: 620, accel: 380, brake: 640, turn: 3.1, colors: ['#d42a2a', '#e8c820', '#222831'] },
  van: { name: 'Van', length: 56, width: 26, topSpeed: 350, accel: 190, brake: 420, turn: 1.8, colors: ['#d8d2c4', '#6a7a8a', '#8a6a4a'] },
  cruiser: { name: 'Cruiser', length: 48, width: 23, topSpeed: 540, accel: 330, brake: 600, turn: 2.9, colors: ['#1d3a6e'] },
};

export const WANTED = {
  maxStars: 5,
  stealCar: 1,
  hitPedestrian: 1,
  punchPedestrian: 1,
  killOfficer: 2,
  // Seconds with no crime and no officer in sight before one star fades.
  decaySeconds: 9,
  hideSeconds: 14,
};

export const POLICE = {
  cruiserTopSpeed: 560,
  officerSpeed: 205,
  arrestSeconds: 1.2,
  arrestRange: 30,
  spawnDistance: 620,
};

// The five story jobs, in the order Mara takes them. Each pays on completion; the last
// one pays the most because the whole city is after her by then.
export const MISSIONS = [
  { id: 1, name: 'First Fare', pay: 120, blurb: 'A courier job. Pick up the parcel at the Marina pier and drive it to Old Town.' },
  { id: 2, name: 'Borrowed Wheels', pay: 200, blurb: 'A gold Comet is parked by the plaza. Take it, then lose the heat.' },
  { id: 3, name: 'Harbor Run', pay: 300, blurb: 'A timed delivery to Harbor Dock 7. One hundred seconds. Do not stop for anyone.' },
  { id: 4, name: 'The Informant', pay: 350, blurb: 'Meet the informant at Solmara Plaza, on foot. His crew will not let you talk.' },
  { id: 5, name: 'Sunset Getaway', pay: 500, blurb: 'Three stars and the whole city awake. Reach the safehouse alive.' },
];

export const GAME = {
  saveKey: 'solmara-save-v1',
  startTimeMinutes: 9 * 60 + 2,
  minutesPerSecond: 1.6,
  shotSeed: 20261124,
};

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
