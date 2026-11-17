// Keyboard and mouse input, read as a plain object the world steps with. Keys are
// tracked by code so layouts do not matter; Enter/click confirms, P pauses, M mutes,
// E enters or steals a car, F punches, Shift runs.
export function createInput() {
  const keys = new Set();
  const input = {
    up: false, down: false, left: false, right: false,
    run: false, handbrake: false,
    enter: false, punch: false, confirm: false, pause: false, mute: false,
    mouseX: 0, mouseY: 0, clicked: false,
  };
  const update = () => {
    input.up = keys.has('ArrowUp') || keys.has('KeyW');
    input.down = keys.has('ArrowDown') || keys.has('KeyS');
    input.left = keys.has('ArrowLeft') || keys.has('KeyA');
    input.right = keys.has('ArrowRight') || keys.has('KeyD');
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.handbrake = keys.has('Space');
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyE') input.enter = true;
    if (e.code === 'KeyF') input.punch = true;
    if (e.code === 'Enter') input.confirm = true;
    if (e.code === 'KeyP' || e.code === 'Escape') input.pause = true;
    if (e.code === 'KeyM') input.mute = true;
    update();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    update();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    update();
  });
  window.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });
  window.addEventListener('mousedown', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    input.clicked = true;
    input.punch = true;
  });
  return input;
}
