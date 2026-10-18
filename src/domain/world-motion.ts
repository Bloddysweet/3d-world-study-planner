// Shared, mutable render-loop state. Camera gestures must not trigger React
// renders or force decorative actors to read DOM attributes every frame.
export interface WorldMotion {
  dragging: boolean;
  moving: boolean;
  quietUntil: number;
}
const states = new WeakMap<object, WorldMotion>();
export function worldMotion(canvas: object): WorldMotion {
  let state = states.get(canvas);
  if (!state) {
    state = { dragging: false, moving: false, quietUntil: 0 };
    states.set(canvas, state);
  }
  return state;
}
export function updateWorldMotion(
  state: WorldMotion,
  changed: boolean,
  now: number,
) {
  if (changed) state.quietUntil = now + 140;
  state.moving = state.dragging || changed || now < state.quietUntil;
  return state.moving;
}
export function isCompactWorld(width: number, height: number, coarse: boolean) {
  return width < 700 || (coarse && height < 500);
}

// Orbit damping can leave sub-pixel floating-point drift while decorative frames
// continue rendering. That is not a reason to relayout every HTML label forever.
export function cameraMatrixChanged(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
) {
  for (let i = 0; i < 16; i++) {
    const tolerance = i >= 12 && i <= 14 ? 1e-3 : 1e-5;
    if (Math.abs(current[i] - previous[i]) > tolerance) return true;
  }
  return false;
}

/** Preserve a caption's settled offset during orbit; never reassign neighbours. */
export function steadyLabel<
  T extends { x: number; y: number; width: number; height: number },
>(
  anchor: T,
  offset: { x: number; y: number },
  width: number,
  height: number,
): T {
  return {
    ...anchor,
    x: Math.max(
      anchor.width / 2 + 6,
      Math.min(width - anchor.width / 2 - 6, anchor.x + offset.x),
    ),
    y: Math.max(
      anchor.height / 2 + 8,
      Math.min(height - 85 - anchor.height / 2, anchor.y + offset.y),
    ),
  };
}
