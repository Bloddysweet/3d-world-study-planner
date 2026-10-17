import { describe, it, expect } from "vitest";
import {
  sampleSkyFlight,
  SKY_PERIOD,
  skyPixelDiameter,
  skyAnchor,
  overlapsSky,
  skyLane,
} from "./sky-flight";
describe("decorative sky flight", () => {
  it("has a bounded smooth 48-second view-aware circuit", () => {
    for (let t = 0; t < SKY_PERIOD; t += 0.05) {
      const p = sampleSkyFlight(t),
        q = sampleSkyFlight(t + 0.01);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.5);
      expect(p.y).toBeGreaterThan(0.57);
      expect(p.y).toBeLessThan(0.59);
      expect(p.depth).toBeGreaterThan(0.93);
      expect(p.depth).toBeLessThan(1.07);
      expect(Math.abs(p.x - q.x)).toBeLessThan(0.001);
    }
    const a = sampleSkyFlight(0),
      b = sampleSkyFlight(SKY_PERIOD);
    for (const key of ["x", "y", "depth", "bank"] as const)
      expect(a[key]).toBeCloseTo(b[key], 10);
  });
  it("crossfades periodically between wingbeat and glide without jumps", () => {
    expect(sampleSkyFlight(0).glide).toBe(0);
    expect(sampleSkyFlight(16).glide).toBe(1);
    expect(sampleSkyFlight(35).glide).toBe(0);
    for (let t = 0; t < 72; t += 0.02) {
      const p = sampleSkyFlight(t);
      expect(p.glide).toBeGreaterThanOrEqual(0);
      expect(p.glide).toBeLessThanOrEqual(1);
      expect(Math.abs(p.glide - sampleSkyFlight(t + 0.01).glide)).toBeLessThan(
        0.006,
      );
    }
  });
  it("bounds mobile and desktop footprint without adding more actors", () => {
    expect(skyLane(false, false)).toBe(0.58);
    expect(skyLane(true, true)).toBe(0.42);
    expect(skyLane(true, false)).toBe(-0.53);
    for (const width of [320, 390, 430, 1440]) {
      const d = skyPixelDiameter(width, 844);
      expect(d).toBeLessThanOrEqual(width * 0.38);
      expect(d).toBeLessThanOrEqual(230);
      expect(d).toBeGreaterThan(100);
    }
  });
  it("supports arbitrary subject anchors and an empty world without mutation", () => {
    const positions: [number, number, number][] = [
      [0, 0, 0],
      [12, 0, 4],
    ];
    const before = JSON.stringify(positions);
    expect(skyAnchor(positions, 1)).toEqual([12, 0, 4]);
    expect(skyAnchor(positions, -1)).toEqual([0, 0, 0]);
    expect(skyAnchor([], 0)).toBeNull();
    expect(JSON.stringify(positions)).toBe(before);
  });
  it("keeps a padded exclusion region for topics and UI", () => {
    const a = { left: 10, top: 10, right: 40, bottom: 40 };
    expect(overlapsSky(a, { left: 43, top: 10, right: 60, bottom: 40 })).toBe(
      true,
    );
    expect(overlapsSky(a, { left: 50, top: 10, right: 70, bottom: 40 })).toBe(
      false,
    );
  });
});
