import { describe, it, expect } from "vitest";
import { seededData as emptyData } from "../data/demo";
import { islandPositions } from "./world";
import {
  sampleVillager,
  villagerSeed,
  villagerSites,
  VILLAGER_LANES,
} from "./villagers";

describe("decorative villagers", () => {
  it("uses deterministic subject identity, not study progress", () => {
    expect(villagerSeed("custom-subject")).toBe(villagerSeed("custom-subject"));
    expect(villagerSeed("another-subject")).not.toBe(
      villagerSeed("custom-subject"),
    );
  });
  it("budgets a whole scene, not an unbounded crowd on every island", () => {
    const data = emptyData();
    const s = data.subjects,
      p = islandPositions(s.length);
    expect(villagerSites(s, p, null, false)).toHaveLength(3);
    expect(villagerSites(s, p, null, true)).toHaveLength(1);
    expect(villagerSites(s, p, s[2].id, false)).toHaveLength(2);
    expect(villagerSites(s, p, s[2].id, true)).toHaveLength(1);
    expect(villagerSites([], [], null, false)).toEqual([]);
  });
  it("supports any custom subject and leaves source data unchanged", () => {
    const data = emptyData(),
      before = JSON.stringify(data);
    const custom = {
      ...data.subjects[0],
      id: "my-new-subject",
      theme: "generic" as const,
    };
    const a = villagerSites([custom], [[0, 0, 0]], custom.id, false);
    expect(a.map((v) => v.lane)).toEqual([0, 1]);
    expect(a[0].id).toBe("my-new-subject-villager-0");
    expect(JSON.stringify(data)).toBe(before);
  });
  it("keeps every sampled route on the two clear corridors, outside all six plots", () => {
    for (const lane of [0, 1])
      for (let t = 0; t < 84; t += 0.025) {
        const p = sampleVillager(t, lane);
        expect(p.x).toBeGreaterThanOrEqual(-2.550001);
        expect(p.x).toBeLessThanOrEqual(2.550001);
        expect(p.z).toBe(VILLAGER_LANES[lane]);
        expect([p.x, p.z, p.yaw, p.speed].every(Number.isFinite)).toBe(true);
        for (const z of [1, 2.9])
          for (const x of [-2.35, 0, 2.35])
            expect(Math.hypot(p.x - x, p.z - z)).toBeGreaterThan(0.839);
      }
  });
  it("walks, looks around, studies and turns smoothly without jumping at the loop seam", () => {
    expect(sampleVillager(5).state).toBe("Walk");
    expect(sampleVillager(15.5).state).toBe("LookAround");
    expect(sampleVillager(18).state).toBe("Study");
    expect(sampleVillager(21).yaw).toBeCloseTo(-Math.PI / 2);
    for (const t of [15, 21, 36, 42]) {
      const a = sampleVillager(t - 1e-6),
        b = sampleVillager(t + 1e-6);
      expect(Math.abs(a.x - b.x)).toBeLessThan(0.0001);
      expect(Math.abs(a.yaw - b.yaw)).toBeLessThan(0.0001);
    }
  });
  it("is periodic and starts/stops with zero translational speed", () => {
    for (const t of [0, 2, 14, 17, 25, 40])
      expect(sampleVillager(t)).toEqual(sampleVillager(t + 42));
    expect(sampleVillager(0).speed).toBe(0);
    expect(sampleVillager(15).speed).toBe(0);
  });
});
