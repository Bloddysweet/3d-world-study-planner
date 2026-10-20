import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { saveSleep, sleepError, sleepFor, sleepMinutes, sleepTrend } from "./sleep";

describe("sleep tracking", () => {
  it("computes minutes across midnight", () => {
    expect(sleepMinutes("23:00", "07:00")).toBe(480);
    expect(sleepMinutes("22:15", "06:45")).toBe(510);
    expect(sleepMinutes("01:00", "08:30")).toBe(450);
  });

  it("rejects equal times and impossible spans", () => {
    expect(sleepMinutes("22:15", "22:15")).toBeNull();
    expect(sleepMinutes("23:55", "00:00")).toBeNull();
    expect(sleepMinutes("07:00", "23:30")).toBeNull();
    expect(sleepMinutes("xx", "07:00")).toBeNull();
  });

  it("saves one entry per date and updates it on re-save", () => {
    const saved = saveSleep(emptyData(), {
      date: "2026-10-19",
      bedtime: "23:00",
      wake: "07:00",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(sleepFor(saved.data, "2026-10-18")).toBeUndefined();
    expect(sleepFor(saved.data, "2026-10-19")?.minutes).toBe(480);
    const updated = saveSleep(saved.data, {
      date: "2026-10-19",
      bedtime: "22:30",
      wake: "06:30",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.sleep).toHaveLength(1);
    expect(sleepFor(updated.data, "2026-10-19")?.minutes).toBe(480);
    expect(sleepFor(updated.data, "2026-10-19")?.bedtime).toBe("22:30");
  });

  it("returns the same data on a no-op save and an error for bad spans", () => {
    const first = saveSleep(emptyData(), {
      date: "2026-10-19",
      bedtime: "23:00",
      wake: "07:00",
    });
    if (!first.ok) throw new Error("expected save");
    const again = saveSleep(first.data, {
      date: "2026-10-19",
      bedtime: "23:00",
      wake: "07:00",
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toBe(first.data);
    const bad = saveSleep(first.data, {
      date: "2026-10-19",
      bedtime: "23:00",
      wake: "23:10",
    });
    expect(bad).toEqual({ ok: false, error: sleepError });
  });

  it("averages the trailing 7-night window", () => {
    let data = emptyData();
    const nights: [string, string, string][] = [
      ["2026-10-14", "23:00", "07:00"],
      ["2026-10-15", "22:00", "06:00"],
      ["2026-10-16", "23:30", "06:30"],
      ["2026-10-17", "22:30", "07:30"],
    ];
    for (const [date, bedtime, wake] of nights) {
      const r = saveSleep(data, { date, bedtime, wake });
      if (!r.ok) throw new Error("expected save");
      data = r.data;
    }
    const old = saveSleep(data, {
      date: "2026-10-01",
      bedtime: "20:00",
      wake: "04:00",
    });
    if (!old.ok) throw new Error("expected save");
    const trend = sleepTrend(old.data, "2026-10-17");
    expect(trend.nights).toBe(4);
    expect(trend.average).toBe(480);
    expect(sleepTrend(emptyData(), "2026-10-17")).toEqual({
      average: null,
      nights: 0,
      window: [],
    });
  });
});
