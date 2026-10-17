import { describe, expect, it } from "vitest";
import {
  cameraDistance,
  cameraLimits,
  inZoomArea,
  gardenPositions,
  groupForSubject,
  islandPositions,
  layoutLabels,
} from "./world";
describe("presentation-only world layout", () => {
  it.each([0, 1, 2, 6, 7, 12])("places %i islands without overlap", (count) => {
    const positions = islandPositions(count);
    expect(positions).toHaveLength(count);
    for (let a = 0; a < count; a++)
      for (let b = a + 1; b < count; b++)
        expect(
          Math.hypot(
            positions[a][0] - positions[b][0],
            positions[a][2] - positions[b][2],
          ),
        ).toBeGreaterThanOrEqual(11.99);
  });
  it("finds selected subjects beyond the first island group", () => {
    const ids = Array.from({ length: 26 }, (_, i) => String(i));
    expect(groupForSubject(ids, "25")).toBe(2);
    expect(groupForSubject(ids, "12")).toBe(1);
    expect(groupForSubject(ids, "missing")).toBeNull();
  });
  it("fits a perspective camera on mobile and desktop with responsive framing", () => {
    for (const [width, height] of [
      [320, 844],
      [1440, 1000],
    ])
      for (const count of [1, 6, 12]) {
        expect(cameraDistance(width, height, count, true)).toBeLessThanOrEqual(
          cameraDistance(width, height, count, false),
        );
        expect(cameraDistance(width, height, count, false)).toBeLessThanOrEqual(
          190,
        );
      }
    expect(cameraDistance(0, 0, 0, false)).toBeGreaterThan(0);
    expect(cameraDistance(320, 844, 6, false)).toBeGreaterThan(
      cameraDistance(1440, 1000, 6, false),
    );
  });
  it("caps both zoom directions relative to the fitted world on every viewport", () => {
    for (const [w, h] of [
      [320, 844],
      [390, 844],
      [804, 520],
      [1440, 1000],
    ]) {
      for (const count of [1, 6, 12])
        for (const focused of [true, false]) {
          const fit = cameraDistance(w, h, count, focused),
            limits = cameraLimits(w, h, count, focused);
          expect(limits.min).toBeGreaterThanOrEqual(4.5);
          expect(limits.min).toBeLessThan(fit / 2.5);
          expect(limits.max).toBeGreaterThanOrEqual(fit);
          expect(limits.max).toBeLessThanOrEqual(fit * 1.12);
          expect(limits.max).toBeLessThanOrEqual(200);
        }
    }
  });
  it("only accepts zoom gestures in the central rectangle, including resized and invalid surfaces", () => {
    expect(inZoomArea(500, 500, 1000, 1000)).toBe(true);
    expect(inZoomArea(200, 800, 1000, 1000)).toBe(true);
    for (const [x, y] of [
      [199, 500],
      [801, 500],
      [500, 199],
      [500, 801],
    ])
      expect(inZoomArea(x, y, 1000, 1000)).toBe(false);
    expect(inZoomArea(160, 400, 320, 844)).toBe(true);
    expect(inZoomArea(0, 0, 0, 0)).toBe(false);
  });
  it("keeps six representative topic plots on the island surface", () => {
    const plots = gardenPositions(20);
    expect(plots).toHaveLength(6);
    expect(gardenPositions(0)).toEqual([]);
    for (const [x, y, z] of plots) {
      expect(y).toBe(0.24);
      expect(Math.hypot(x, z)).toBeLessThan(4);
    }
  });
  it("separates mobile labels while keeping camera controls unobstructed", () => {
    const labels = layoutLabels(
      Array.from({ length: 6 }, () => ({
        x: 160,
        y: 190,
        width: 90,
        height: 24,
      })),
      320,
      350,
    );
    for (const l of labels) {
      expect(l.x - l.width / 2).toBeGreaterThanOrEqual(6);
      expect(l.x + l.width / 2).toBeLessThanOrEqual(314);
      expect(l.y + l.height / 2).toBeLessThanOrEqual(265);
    }
    for (let a = 0; a < labels.length; a++)
      for (let b = a + 1; b < labels.length; b++)
        expect(Math.abs(labels[a].y - labels[b].y)).toBeGreaterThanOrEqual(27);
  });
});
