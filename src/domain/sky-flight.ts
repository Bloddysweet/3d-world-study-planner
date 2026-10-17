import type { Position3 } from "./world";

// View-aware 3D high-sky circuit, deliberately independent of learning state.
export const SKY_ASSET = "/models/aurel_sky_drake_rigged_v1.glb";
export const SKY_FPS = { desktop: 24, compact: 18 } as const;
export const SKY_PERIOD = 48;
export function sampleSkyFlight(seconds: number) {
  const t = Math.max(0, seconds),
    a = (t / SKY_PERIOD) * Math.PI * 2 + 0.25;
  const cycle = t % 36;
  const smooth = (a: number, b: number, x: number) => {
    const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return v * v * (3 - 2 * v);
  };
  return {
    x: 0.5 * Math.sin(a),
    y: 0.58 + 0.006 * Math.sin(2 * a),
    depth: 1 + 0.065 * Math.cos(a),
    bank: 0.12 * Math.sin(a),
    glide: smooth(7, 10, cycle) * (1 - smooth(24, 27, cycle)),
  };
}
export interface SkyRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export function overlapsSky(a: SkyRect, b: SkyRect, padding = 6) {
  return (
    a.left < b.right + padding &&
    a.right > b.left - padding &&
    a.top < b.bottom + padding &&
    a.bottom > b.top - padding
  );
}
export function skyPixelDiameter(width: number, height: number) {
  return Math.max(0, Math.min(230, width * 0.38, height * 0.2));
}
export function skyAnchor(
  positions: Position3[],
  selectedIndex: number,
): Position3 | null {
  return positions.length ? (positions[selectedIndex] ?? [0, 0, 0]) : null;
}

export function skyLane(compact: boolean, focused: boolean) {
  return compact ? (focused ? 0.42 : -0.53) : 0.58;
}
