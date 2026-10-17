import { describe, expect, it } from "vitest";
import { emptyData } from "../domain/model";
import { LocalStudyRepository, readBackup, storageKey } from "./repository";
import { demoData } from "./demo";
function memory() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}
describe("validated local repository", () => {
  it("loads empty without synthetic tasks", () => {
    expect(new LocalStudyRepository(memory()).load()).toMatchObject({
      status: "empty",
      data: { tasks: [] },
    });
  });
  it("round-trips personal data and isolates demo", () => {
    const port = memory(),
      repo = new LocalStudyRepository(port);
    repo.save(emptyData());
    repo.save(demoData("2026-10-15"), true);
    expect(repo.load().data.tasks).toHaveLength(0);
    expect(repo.load(true).data.tasks.length).toBeGreaterThan(0);
    expect(port.map.size).toBe(2);
  });
  it("retains corrupt raw data without overwriting or pretending it was empty", () => {
    const port = memory(),
      raw = "{bad json";
    port.map.set(storageKey(false), raw);
    expect(new LocalStudyRepository(port).load()).toMatchObject({
      status: "corrupt",
      raw,
    });
    expect(port.map.get(storageKey(false))).toBe(raw);
  });
  it("rejects invalid references, unknown versions, and scores over total", () => {
    const data = demoData("2026-10-15");
    expect(() =>
      readBackup(JSON.stringify({ ...data, version: 99 })),
    ).toThrow();
    data.tests[0].score = 201;
    expect(() => readBackup(JSON.stringify(data))).toThrow();
  });
  it("handles disabled and throwing storage safely", () => {
    const repo = new LocalStudyRepository(null);
    expect(repo.load().status).toBe("unavailable");
    expect(() => repo.save(emptyData())).toThrow();
    const broken = new LocalStudyRepository({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(broken.load().status).toBe("unavailable");
    expect(() => broken.save(emptyData())).toThrow();
  });
});
