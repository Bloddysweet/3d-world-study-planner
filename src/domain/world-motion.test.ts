import { describe, expect, it } from "vitest";
import {
  isCompactWorld,
  updateWorldMotion,
  worldMotion,
  cameraMatrixChanged,
  steadyLabel,
} from "./world-motion";
describe("phone world interaction budget", () => {
  it("covers portrait phones and coarse landscape phones without downgrading tablet/desktop", () => {
    expect(isCompactWorld(390, 844, true)).toBe(true);
    expect(isCompactWorld(320, 720, false)).toBe(true);
    expect(isCompactWorld(844, 390, true)).toBe(true);
    expect(isCompactWorld(768, 1024, true)).toBe(false);
    expect(isCompactWorld(1024, 768, true)).toBe(false);
    expect(isCompactWorld(1440, 390, false)).toBe(false);
  });
  it("ignores sub-pixel camera drift but catches meaningful translation/rotation", () => {
    const original = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const next = [...original];
    next[12] = 0.00005;
    next[0] += 0.000001;
    expect(cameraMatrixChanged(next, original)).toBe(false);
    next[12] = 0.01;
    expect(cameraMatrixChanged(next, original)).toBe(true);
    next[12] = 0;
    next[0] += 0.01;
    expect(cameraMatrixChanged(next, original)).toBe(true);
  });
  it("keeps a caption's relative offset stable while its projected anchor moves", () => {
    const anchor = { x: 140, y: 160, width: 100, height: 26 };
    const offset = { x: -8, y: 20 };
    const before = steadyLabel(anchor, offset, 390, 844);
    const after = steadyLabel({ ...anchor, x: 155, y: 180 }, offset, 390, 844);
    expect(after.x - before.x).toBe(15);
    expect(after.y - before.y).toBe(20);
    expect(anchor).toEqual({ x: 140, y: 160, width: 100, height: 26 });
    const edge = steadyLabel({ ...anchor, x: -999, y: 999 }, offset, 320, 600);
    expect(edge.x - edge.width / 2).toBe(6);
    expect(edge.y + edge.height / 2).toBe(515);
  });
  it("shares motion state only within one renderer", () => {
    const a = {},
      b = {};
    expect(worldMotion(a)).toBe(worldMotion(a));
    expect(worldMotion(a)).not.toBe(worldMotion(b));
  });
  it("holds camera priority through a gesture and damping, then resumes decorations", () => {
    const state = worldMotion({});
    state.dragging = true;
    expect(updateWorldMotion(state, true, 100)).toBe(true);
    expect(updateWorldMotion(state, false, 1000)).toBe(true);
    state.dragging = false;
    expect(updateWorldMotion(state, true, 1001)).toBe(true);
    expect(updateWorldMotion(state, false, 1140)).toBe(true);
    expect(updateWorldMotion(state, false, 1141)).toBe(false);
    expect(updateWorldMotion(state, false, 9000)).toBe(false);
  });
});
