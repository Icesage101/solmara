// Solmara configuration: world size, districts, vehicles, missions and tuning.
// Every name, character and place here is original to this game.
export const WORLD = 4800;
export const ROAD_W = 104;
export const STREET_GAP = 400;
export const FIRST_STREET = 300;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const DISTRICTS = [
  { name: 'Marina', x0: 0, y0: 0, x1: 1250, y1: 4800, tint: '#2e7f9e', label: 'MARINA' },
  { name: 'Old Town', x0: 1250, y0: 0, x1: 3250, y1: 2400, tint: '#c98f3d', label: 'OLD TOWN' },
  { name: 'Harbor', x0: 3250, y0: 0, x1: 4800, y1: 2400, tint: '#5a6b7c', label: 'HARBOR' },
  { name: 'Hills', x0: 1250, y0: 2400, x1: 4800, y1: 4800, tint: '#7a9a5a', label: 'THE HILLS' },
  { name: 'Central Park', x0: 2250, y0: 2250, x1: 2550, y1: 2550, tint: '#3f7d3a', label: 'SOLMARA PARK' },
];

export const CAR_TYPES = {
  sedan:   { name: 'Sedan',    top: 330, accel: 240, grip: 2.6, len: 52, wid: 26, colors: ['#c0392b', '#2e5fa3', '#7f8c8d', '#d8d8d8'] },
  taxi:    { name: 'Cab',      top: 320, accel: 230, grip: 2.6, len: 52, wid: 26, colors: ['#f5b301'] },
  pickup:  { name: 'Pickup',   top: 300, accel: 210, grip: 2.4, len: 58, wid: 28, colors: ['#5d6d7e', '#7b2d26'] },
  sports:  { name: 'Comet',    top: 430, accel: 330, grip: 3.4, len: 54, wid: 26, colors: ['#e6b800', '#8e44ad', '#111111'] },
  van:     { name: 'Van',      top: 260, accel: 180, grip: 2.1, len: 62, wid: 30, colors: ['#e8e8e8', '#2c6e49'] },
  police:  { name: 'Cruiser',  top: 390, accel: 300, grip: 3.1, len: 54, wid: 27, colors: ['#1d3a5f'] },
};

export const PLAYER = {
  walkSpeed: 205,
  runSpeed: 330,
  radius: 13,
  health: 100,
  startCash: 50,
  startX: 700,
  startY: 900,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 9,
  copsPerStar: [0, 2, 3, 4, 6, 8],
  footCopsPerStar: [0, 1, 1, 2, 2, 3],
};

export const MISSIONS = [
  {
    id: 1, name: 'First Fare', reward: 120,
    brief: 'Mara is back in Solmara. Old friend Dario needs a courier: pick up the parcel at the Old Town cafe, then drop it at the Harbor gate.',
    pickup: { x: 1500, y: 700, label: 'Old Town Cafe' },
    dropoff: { x: 4300, y: 1100, label: 'Harbor Gate' },
    hint: 'Get in a car with E. Follow the gold marker.',
  },
  {
    id: 2, name: 'Borrowed Wheels', reward: 250,
    brief: 'A gold Comet sports car is parked in the Hills. "Borrow" it, then lose the heat before you bring it home.',
    carSpot: { x: 3500, y: 3900, label: 'Gold Comet' },
    hint: 'Steal the gold Comet, then get your wanted level to zero.',
  },
  {
    id: 3, name: 'Harbor Run', reward: 300, timeLimit: 75,
    brief: 'A crate has to reach the Harbor before the tide turns. Three checkpoints, seventy-five seconds. Drive like the sun is setting.',
    checkpoints: [
      { x: 2300, y: 1500, label: 'Checkpoint 1' },
      { x: 3100, y: 2300, label: 'Checkpoint 2' },
      { x: 4300, y: 1900, label: 'Harbor Dock' },
    ],
    hint: 'Hit every checkpoint before the timer runs out.',
  },
  {
    id: 4, name: 'The Informant', reward: 350,
    brief: 'Meet the informant at Solmara Plaza. He knows who set Mara up, but his old crew is coming to shut him up. On foot, and bring fists.',
    meet: { x: 2400, y: 2800, label: 'Solmara Plaza' },
    hint: 'Walk to the plaza marker, then deal with the crew. J to punch, K to fire.',
  },
  {
    id: 5, name: 'Sunset Getaway', reward: 600,
    brief: 'The whole city is after Mara now. Three stars and counting. Get to the Marina safehouse alive and the slate is clean.',
    safehouse: { x: 620, y: 4300, label: 'Marina Safehouse' },
    hint: 'Reach the safehouse with the police on your tail.',
  },
];

export const SAFEHOUSE = { x: 620, y: 4300 };
export const REPAIR_COST = 40;
export const REPAINT_COST = 50;
export const PISTOL_AMMO_START = 24;
export const SAVE_KEY = 'solmara-save-v1';
