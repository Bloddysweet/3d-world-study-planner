import { describe, it, expect } from "vitest";
import {
  sampleWildFlight,
  compactDragonCorridor,
  WILD_SKY_PERIOD,
  wildPixelDiameter,
  companionSkyEnvelope,
  findWildCorridor,
} from "./wild-flight";
import { sampleSkyFlight } from "./sky-flight";
import { skyCorridorClear } from "./sky-corridor";

describe("larger same-species male companion", () => {
  it("uses a slower, independently phased smooth periodic circuit", () => {
    for (let t = 0; t < 144; t += 0.1) {
      const p = sampleWildFlight(t),
        q = sampleWildFlight(t + 0.01);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(p.y - 0.58)).toBeLessThanOrEqual(0.0121);
      expect(Math.abs(p.bank)).toBeLessThan(0.23);
      expect(Math.abs(q.x - p.x)).toBeLessThan(0.001);
      expect(p.glide).toBeGreaterThanOrEqual(0);
      expect(p.glide).toBeLessThanOrEqual(1);
    }
    expect(sampleWildFlight(-5)).toEqual(sampleWildFlight(0));
    const a = sampleWildFlight(0),
      b = sampleWildFlight(WILD_SKY_PERIOD);
    for (const key of ["x", "y", "depth", "bank", "glide"] as const)
      expect(a[key]).toBeCloseTo(b[key], 10);
    expect(a.x).not.toBe(sampleSkyFlight(0).x);
    expect(sampleWildFlight(25).glide).toBe(1);
    expect(sampleWildFlight(65).glide).toBe(0);
  });
  it("bounds the heavier silhouette on narrow and large screens", () => {
    for (const width of [320, 390, 430, 768, 1440]) {
      const d = wildPixelDiameter(width, 844);
      expect(d).toBeGreaterThan(100);
      expect(d).toBeLessThanOrEqual(width * 0.44);
      expect(d).toBeLessThanOrEqual(260);
      expect(d).toBeLessThanOrEqual(844 * 0.24);
    }
    expect(wildPixelDiameter(0, 0)).toBe(0);
  });
  it("reserves the entire companion route without mutating it", () => {
    const c = { left: 100, right: 500, lane: -0.53, diameter: 120 },
      before = JSON.stringify(c),
      r = companionSkyEnvelope(c, 600, 844);
    expect(r.left).toBeLessThan(c.left);
    expect(r.right).toBeGreaterThan(c.right);
    expect(r.top).toBeLessThan(((1 - c.lane) * 844) / 2);
    expect(r.bottom).toBeGreaterThan(((1 - c.lane) * 844) / 2);
    expect(JSON.stringify(c)).toBe(before);
  });
  it("keeps complete compact companion envelopes separated and within the screen", () => {
    for (const width of [320, 390, 430, 640, 768]) {
      const a = companionSkyEnvelope(
          compactDragonCorridor("aurel", width),
          width,
          844,
        ),
        w = companionSkyEnvelope(
          compactDragonCorridor("wild", width),
          width,
          844,
        );
      expect(a.left).toBeGreaterThanOrEqual(0);
      expect(a.right).toBeLessThan(w.left);
      expect(w.right).toBeLessThanOrEqual(width);
      expect(compactDragonCorridor("wild", width).diameter).toBeGreaterThan(
        compactDragonCorridor("aurel", width).diameter,
      );
    }
  });
  it("finds a separate corridor on desktop/tablet/phones and refuses a full obstruction", () => {
    for (const width of [320, 390, 430, 768, 1440]) {
      const obstacles = [
        { left: 0, right: width, top: 0, bottom: 180 },
        companionSkyEnvelope(
          {
            left: width * 0.25,
            right: width * 0.75,
            lane: -0.53,
            diameter: 110,
          },
          width,
          844,
        ),
      ];
      const before = JSON.stringify(obstacles);
      const c = findWildCorridor(
        width,
        844,
        wildPixelDiameter(width, 844),
        obstacles,
      );
      expect(c).not.toBeNull();
      expect(skyCorridorClear(c!, width, 844, obstacles)).toBe(true);
      expect(JSON.stringify(obstacles)).toBe(before);
    }
    expect(
      findWildCorridor(320, 844, 140, [
        { left: 0, top: 0, right: 320, bottom: 844 },
      ]),
    ).toBeNull();
  });
});
