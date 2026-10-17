import { describe, expect, it } from "vitest";
import {
  findSkyCorridor,
  skyCorridorClear,
  easeSkyCorridor,
} from "./sky-corridor";
import { overlapsSky, sampleSkyFlight } from "./sky-flight";

describe("swept sky corridor", () => {
  const header = { left: 0, top: 0, right: 1404, bottom: 92 };
  const hero = { left: 30, top: 110, right: 262, bottom: 350 };
  const tools = { left: 1056, top: 112, right: 1374, bottom: 154 };
  it("reserves a complete desktop circuit instead of clipping individual wing poses", () => {
    const obstacles = [header, hero, tools];
    const corridor = findSkyCorridor(1404, 875, 175, 0.58, obstacles)!;
    expect(corridor).not.toBeNull();
    const radius = corridor.diameter * 0.6 + 6;
    for (let t = 0; t < 48; t += 0.05) {
      const pose = sampleSkyFlight(t);
      const x =
        corridor.left + (pose.x + 0.5) * (corridor.right - corridor.left);
      const y = ((1 - corridor.lane - (pose.y - 0.58)) * 875) / 2;
      const envelope = {
        left: x - radius,
        right: x + radius,
        top: y - radius,
        bottom: y + radius,
      };
      expect(obstacles.some((r) => overlapsSky(envelope, r, 0))).toBe(false);
    }
  });
  it("uses lower tablet sky when a two-row header and side panels crowd the upper route", () => {
    const obstacles = [
      { left: 0, top: 0, right: 768, bottom: 134 },
      { left: 20, top: 154, right: 240, bottom: 400 },
      { left: 460, top: 154, right: 748, bottom: 195 },
      { left: 250, top: 360, right: 690, bottom: 710 },
      { left: 560, top: 910, right: 748, bottom: 1010 },
      { left: 30, top: 960, right: 210, bottom: 1010 },
    ];
    const corridor = findSkyCorridor(768, 1024, 204.8, 0.58, obstacles)!;
    expect(corridor).not.toBeNull();
    expect(corridor.lane).toBeLessThan(0);
  });
  it("is deterministic across every wingbeat and glide phase", () => {
    const first = findSkyCorridor(1404, 875, 175, 0.58, [header, hero, tools]);
    for (let i = 0; i < 300; i++)
      expect(
        findSkyCorridor(1404, 875, 175, 0.58, [header, hero, tools]),
      ).toEqual(first);
  });
  it("never creates an inverted flight interval or covers a full-screen dialog", () => {
    expect(
      findSkyCorridor(768, 1024, 200, 0.58, [
        { left: 0, top: 0, right: 768, bottom: 1024 },
      ]),
    ).toBeNull();
    expect(findSkyCorridor(10, 10, 100, 0.58, [])).toBeNull();
  });
});

describe("orbit-safe steering", () => {
  const a = { left: 200, right: 400, lane: 0.5, diameter: 120 },
    b = { left: 400, right: 650, lane: -0.6, diameter: 150 };
  it("moves continuously towards a new corridor instead of snapping", () => {
    const step = easeSkyCorridor(a, b, 1 / 24);
    expect(step.left).toBeGreaterThan(a.left);
    expect(step.left).toBeLessThan(b.left);
    expect(step.left - a.left).toBeLessThanOrEqual(180 / 24);
    expect(Math.abs(step.lane - a.lane)).toBeLessThanOrEqual(0.36 / 24 + 1e-8);
    expect(step.lane).toBeLessThan(a.lane);
    expect(step.lane).toBeGreaterThan(b.lane);
    expect(easeSkyCorridor(a, b, 0)).toEqual(a);
    let current = a;
    for (let i = 0; i < 300; i++) current = easeSkyCorridor(current, b, 1 / 24);
    expect(current.lane).toBeCloseTo(b.lane, 4);
  });
  it("does not mutate either route or overshoot after a long frame", () => {
    const before = JSON.stringify([a, b]);
    const next = easeSkyCorridor(a, b, 20);
    expect(next.left).toBeLessThan(b.left);
    expect(next.lane).toBeGreaterThan(b.lane);
    expect(JSON.stringify([a, b])).toBe(before);
  });
  it("retains a still-safe route but rejects moved plots and opened panels", () => {
    expect(skyCorridorClear(a, 1000, 900, [])).toBe(true);
    expect(
      skyCorridorClear(a, 1000, 900, [
        { left: 250, right: 350, top: 200, bottom: 300 },
      ]),
    ).toBe(false);
    expect(skyCorridorClear(a, 300, 900, [])).toBe(false);
  });
});
