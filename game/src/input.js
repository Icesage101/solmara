// input.js — keyboard and mouse state. One job: listen to the window and
// answer "is this key down right now" for the rest of the game.

const down = new Set();
const pressed = new Set(); // keys that went down since the last frame
const mouse = { x: 0, y: 0, down: false };

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', () => { mouse.down = true; });
  addEventListener('mouseup', () => { mouse.down = false; });
}

export function key(code) {
  return down.has(code);
}

export function justPressed(code) {
  return pressed.has(code);
}

export function mouseState() {
  return mouse;
}

// Called once at the end of each frame so justPressed means "this frame".
export function endFrame() {
  pressed.clear();
}

export function moveAxis() {
  return {
    x: (key('KeyD') || key('ArrowRight') ? 1 : 0) - (key('KeyA') || key('ArrowLeft') ? 1 : 0),
    y: (key('KeyS') || key('ArrowDown') ? 1 : 0) - (key('KeyW') || key('ArrowUp') ? 1 : 0),
  };
}
