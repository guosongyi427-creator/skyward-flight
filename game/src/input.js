// Skyward Flight — keyboard + mouse input.
// Arrows / WASD fly the plane, W/S (or Shift/Ctrl) work the throttle,
// Space confirms, P or Esc pauses, R restarts after a crash. Mouse drag on
// the canvas steers pitch and roll; the wheel trims the throttle.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mousePitch = 0, mouseRoll = 0, mouseActive = false;
  let wheelDelta = 0;

  function keyOf(e) { return e.code; }
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(keyOf(e));
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyR') actions |= ACTION_RESTART;
  });
  window.addEventListener('keyup', (e) => keys.delete(keyOf(e)));
  window.addEventListener('blur', () => keys.clear());

  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    mouseRoll = Math.max(-1, Math.min(1, mouseRoll + (e.clientX - lastX) * 0.004));
    mousePitch = Math.max(-1, Math.min(1, mousePitch - (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY; mouseActive = true;
  });
  // Releasing the mouse eases the stick back toward centre instead of snapping.
  function endDrag() { dragging = false; mouseActive = false; mousePitch *= 0.4; mouseRoll *= 0.4; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelDelta += -Math.sign(e.deltaY) * 0.06; }, { passive: false });

  // Read the current stick: -1..1 for pitch/roll/yaw, throttle delta per second.
  function control() {
    const up = keys.has('ArrowUp') || keys.has('KeyI');
    const down = keys.has('ArrowDown') || keys.has('KeyK');
    const left = keys.has('ArrowLeft') || keys.has('KeyJ');
    const right = keys.has('ArrowRight') || keys.has('KeyL');
    const yawL = keys.has('KeyA'), yawR = keys.has('KeyD');
    const thrUp = keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight');
    const thrDown = keys.has('KeyS') || keys.has('ControlLeft') || keys.has('ControlRight');
    let pitch = (up ? 1 : 0) - (down ? 1 : 0);
    let roll = (right ? 1 : 0) - (left ? 1 : 0);
    if (mouseActive) { pitch += mousePitch; roll += mouseRoll; }
    const throttleDelta = (thrUp ? 0.55 : 0) - (thrDown ? 0.55 : 0) + wheelDelta * 8;
    wheelDelta = 0;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw: (yawR ? 1 : 0) - (yawL ? 1 : 0),
      throttleDelta,
    };
  }
  function takeActions() { const a = actions; actions = 0; return a; }
  return { control, takeActions };
}
