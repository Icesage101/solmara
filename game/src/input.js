// Keyboard and pointer input for Solmara. Held keys steer and drive; one-shot
// presses (enter car, punch, shoot, pause, menus) are queued as flags and taken
// once by the loop, so a press between frames is never lost or counted twice.
export const ACT_ENTER = 1;
export const ACT_PUNCH = 2;
export const ACT_SHOOT = 4;
export const ACT_PAUSE = 8;
export const ACT_CONFIRM = 16;
export const ACT_SAVE = 32;
export const ACT_LOAD = 64;
export const ACT_MISSION = 128;
export const ACT_REPAIR = 256;
export const ACT_REPAINT = 512;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false };

  function codeAction(code) {
    if (code === 'KeyE') return ACT_ENTER;
    if (code === 'KeyJ') return ACT_PUNCH;
    if (code === 'KeyK') return ACT_SHOOT;
    if (code === 'Escape' || code === 'KeyP') return ACT_PAUSE;
    if (code === 'Enter' || code === 'Space') return ACT_CONFIRM;
    if (code === 'KeyQ') return ACT_SAVE;
    if (code === 'KeyL') return ACT_LOAD;
    if (code === 'KeyM') return ACT_MISSION;
    if (code === 'KeyR') return ACT_REPAIR;
    if (code === 'KeyC') return ACT_REPAINT;
    return 0;
  }

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    const act = codeAction(event.code);
    if (act && !event.repeat) actions |= act;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointermove', (event) => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - r.left, y: event.clientY - r.top, down: mouse.down };
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    actions |= ACT_PUNCH;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });

  const has = (set) => {
    for (const c of set) if (held.has(c)) return true;
    return false;
  };

  return {
    up: () => has(UP),
    down: () => has(DOWN),
    left: () => has(LEFT),
    right: () => has(RIGHT),
    run: () => has(RUN),
    // Steering: -1 left, 1 right. Throttle: -1 brake/reverse, 1 accelerate.
    steer: () => (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
    throttle: () => (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0),
    mouse: () => mouse,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Test/autopilot hook: queue an action without a real key press.
    queue(action) { actions |= action; },
    press(code) { held.add(code); },
    release(code) { held.delete(code); },
  };
}
