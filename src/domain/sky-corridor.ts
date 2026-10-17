import type { SkyRect } from "./sky-flight";

export interface SkyCorridor {
  left: number;
  right: number;
  lane: number;
  diameter: number;
}

/** Reserve the entire swept flight envelope, not just this frame's wing pose.
 * Deterministic intervals keep a settled scene's route identical throughout its
 * circuit. Tablet may use lower sky when its two-row header crowds the top. */
export function findSkyCorridor(
  width: number,
  height: number,
  diameter: number,
  preferredLane: number,
  obstacles: SkyRect[],
): SkyCorridor | null {
  const upper = [preferredLane, preferredLane - 0.06, preferredLane - 0.12];
  const lower = [-0.53, -0.62, -0.7];
  for (const lanes of [upper, lower])
    for (const factor of [1, 0.85, 0.7]) {
      const d = diameter * factor;
      // Includes perspective expansion, banking, the complete rig's radius,
      // the tiny vertical route bob, and UI/plot safety padding.
      const radius = d * 0.6 + 14;
      for (const lane of lanes) {
        const y = ((1 - lane) * height) / 2;
        if (y - radius < 8 || y + radius > height - 8) continue;
        let intervals: [number, number][] = [[radius + 8, width - radius - 8]];
        for (const r of obstacles) {
          if (r.bottom < y - radius || r.top > y + radius) continue;
          const left = r.left - radius,
            right = r.right + radius;
          intervals = intervals.flatMap(([a, b]) => {
            if (right <= a || left >= b) return [[a, b]];
            const rest: [number, number][] = [];
            if (left > a) rest.push([a, left]);
            if (right < b) rest.push([right, b]);
            return rest;
          });
        }
        const widest = intervals.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
        if (widest && widest[1] - widest[0] >= Math.min(140, width * 0.15))
          return { left: widest[0], right: widest[1], lane, diameter: d };
      }
    }
  return null;
}

/** Keep a still-safe corridor instead of hopping to a newly wider alternative. */
export function skyCorridorClear(
  c: SkyCorridor,
  width: number,
  height: number,
  obstacles: SkyRect[],
) {
  const radius = c.diameter * 0.6 + 10,
    y = ((1 - c.lane) * height) / 2;
  const swept = {
    left: c.left - radius,
    right: c.right + radius,
    top: y - radius,
    bottom: y + radius,
  };
  return (
    swept.left >= 4 &&
    swept.right <= width - 4 &&
    swept.top >= 4 &&
    swept.bottom <= height - 4 &&
    !obstacles.some(
      (r) =>
        swept.left < r.right &&
        swept.right > r.left &&
        swept.top < r.bottom &&
        swept.bottom > r.top,
    )
  );
}
export function easeSkyCorridor(
  current: SkyCorridor,
  target: SkyCorridor,
  seconds: number,
): SkyCorridor {
  const dt = Math.max(0, Math.min(seconds, 0.1));
  const blend = 1 - Math.exp(-dt * 4);
  const ease = (a: number, b: number, speed: number) =>
    a + Math.max(-speed * dt, Math.min(speed * dt, (b - a) * blend));
  return {
    left: ease(current.left, target.left, 180),
    right: ease(current.right, target.right, 180),
    lane: ease(current.lane, target.lane, 0.36),
    diameter: ease(current.diameter, target.diameter, 80),
  };
}
