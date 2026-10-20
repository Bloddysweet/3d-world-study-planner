import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { saveStreak, streakStatus } from "./streak";

describe("study streak", () => {
  it("starts at 1 for the first studied day", () => {
    const next = saveStreak(emptyData(), "2026-10-19");
    expect(next.streak).toEqual({ count: 1, lastOn: "2026-10-19" });
  });

  it("is idempotent for the same day", () => {
    const once = saveStreak(emptyData(), "2026-10-19");
    const twice = saveStreak(once, "2026-10-19");
    expect(twice).toBe(once);
  });

  it("extends on consecutive days and resets after a gap", () => {
    let data = emptyData();
    for (const day of ["2026-10-17", "2026-10-18", "2026-10-19"])
      data = saveStreak(data, day);
    expect(data.streak.count).toBe(3);
    data = saveStreak(data, "2026-10-21");
    expect(data.streak).toEqual({ count: 1, lastOn: "2026-10-21" });
  });

  it("caps the count at 20000", () => {
    let data = saveStreak(emptyData(), "2026-10-18");
    data = {
      ...data,
      streak: { count: 20000, lastOn: "2026-10-18" },
    };
    data = saveStreak(data, "2026-10-19");
    expect(data.streak.count).toBe(20000);
  });

  it("reports status for the UI", () => {
    const data = saveStreak(emptyData(), "2026-10-19");
    expect(streakStatus(data, "2026-10-19")).toEqual({
      count: 1,
      studiedToday: true,
    });
    expect(streakStatus(data, "2026-10-20")).toEqual({
      count: 1,
      studiedToday: false,
    });
    expect(streakStatus(emptyData(), "2026-10-19")).toEqual({
      count: 0,
      studiedToday: false,
    });
  });
});
