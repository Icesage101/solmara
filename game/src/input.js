// Solmara — keyboard input.
// One object holds every key the game cares about, with two views of each: `down` (held
// right now, for movement and driving) and `pressed` (went down since the last frame,
// for one-shot actions like entering a car or punching). The game clears `pressed` once
// a frame, so a held key never fires its action twice.

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  punch: ['KeyJ'],
  shoot: ['KeyK'],
  jobs: ['KeyM'],
  pause: ['KeyP', 'Escape'],
  save: ['KeyQ'],
  load: ['KeyL'],
  confirm: ['Enter', 'Space'],
  repair: ['KeyR'],
  repaint: ['KeyC'],
};

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  let anyKey = false;
  let firstKeyAt = 0;

  function codeOf(event) {
    return event.code;
  }

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
    anyKey = true;
    if (!firstKeyAt) firstKeyAt = performance.now();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    // Held right now?
    is(action) {
      return KEYS[action].some((code) => held.has(code));
    },
    // Went down since the last frame? (cleared by endFrame)
    wasPressed(action) {
      return KEYS[action].some((code) => pressed.has(code));
    },
    // Any key at all, for "press any key" screens.
    get anyKey() {
      return anyKey;
    },
    get firstKeyAt() {
      return firstKeyAt;
    },
    endFrame() {
      pressed.clear();
      anyKey = false;
    },
    // For the shot scenes and tests: pretend a key is held.
    press(code) {
      if (!held.has(code)) pressed.add(code);
      held.add(code);
    },
    release(code) {
      held.delete(code);
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}

// The movement stick as a unit vector, from whatever keys are held: WASD or arrows,
// normalised so a diagonal is no faster than straight ahead.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.is('left')) x -= 1;
  if (input.is('right')) x += 1;
  if (input.is('up')) y -= 1;
  if (input.is('down')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}
