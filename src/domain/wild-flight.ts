import type { SkyRect } from "./sky-flight";
import type { SkyCorridor } from "./sky-corridor";
import { findSkyCorridor } from "./sky-corridor";

// Legacy slot/export names are retained for existing route diagnostics/tests.
// The second individual is now Auren, the male of Aurel’s species.
export const WILD_SKY_ASSET = "/models/auren_male_companion_v1.glb";
export const WILD_SKY_PERIOD = 72;
/** A slower, independently phased circuit, with gentle banks and longer glides. */
export function sampleWildFlight(seconds: number) {
  const t = Math.max(0, seconds),
    a = (t / WILD_SKY_PERIOD) * Math.PI * 2 + 2.1;
  const cycle = t % WILD_SKY_PERIOD;
  const smooth = (a: number, b: number, x: number) => {
    const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return v * v * (3 - 2 * v);
  };
  return {
    x: 0.5 * Math.sin(a),
    y: 0.58 + 0.012 * Math.sin(2 * a),
    depth: 1 + 0.05 * Math.cos(a),
    bank: 0.14 * Math.sin(a) + 0.015 * Math.sin(3 * a),
    glide: smooth(9, 15, cycle) * (1 - smooth(50, 57, cycle)),
  };
}
/** Reserve the companion's entire swept route, not just its current wing pose.
 * Aurel has priority; Auren finds another band, avoiding mutual route chasing. */
export function companionSkyEnvelope(
  c: SkyCorridor,
  width: number,
  height: number,
): SkyRect {
  const r = c.diameter * 0.6 + 18,
    y = ((1 - c.lane) * height) / 2;
  return {
    left: Math.max(0, c.left - r),
    right: Math.min(width, c.right + r),
    top: y - r,
    bottom: y + r,
  };
}
export function findWildCorridor(
  width: number,
  height: number,
  diameter: number,
  obstacles: SkyRect[],
) {
  for (const lane of [0.32, 0.16, 0, -0.16, -0.32, -0.48, -0.64]) {
    const c = findSkyCorridor(width, height, diameter, lane, obstacles);
    if (c) return c;
  }
  return null;
}
export function wildPixelDiameter(width: number, height: number) {
  return Math.max(0, Math.min(260, width * 0.44, height * 0.24));
}

/** Two reserved phone/portrait-tablet circuits, leaving the central islands untouched.
 * The larger male silhouette has the right-hand lane; no route chasing. */
export function compactDragonCorridor(
  kind: "aurel" | "wild",
  width: number,
): SkyCorridor {
  return kind === "aurel"
    ? {
        left: width * 0.22,
        right: width * 0.28,
        lane: -0.53,
        diameter: width * 0.22,
      }
    : {
        left: width * 0.71,
        right: width * 0.75,
        // A longer male tail needs extra clearance beneath tablet topic plots.
        lane: width >= 700 ? -0.61 : -0.53,
        diameter: width * 0.3,
      };
}
