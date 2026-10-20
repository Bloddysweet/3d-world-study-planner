import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import {
  isWeekLocked,
  lockedWeekError,
  setWeekLock,
  setWellnessDay,
  weekDays,
  weekStartOf,
  wellnessWeek,
} from "./wellness";

describe("diet & gym week lock", () => {
  it("finds the Monday of any week", () => {
    expect(weekStartOf("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStartOf("2026-10-21")).toBe("2026-10-19"); // Wednesday
    expect(weekStartOf("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(weekDays("2026-10-19")).toHaveLength(7);
    expect(weekDays("2026-10-19")[6]).toBe("2026-10-25");
  });

  it("saves diet and gym text per day", () => {
    let data = emptyData();
    const r1 = setWellnessDay(data, "2026-10-19", "2026-10-20", {
      diet: "Oats + dal + salad",
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    data = r1.data;
    const r2 = setWellnessDay(data, "2026-10-19", "2026-10-20", {
      gym: "Push day 45 min",
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(wellnessWeek(r2.data, "2026-10-19").days[0]).toEqual({
      day: "2026-10-20",
      diet: "Oats + dal + salad",
      gym: "Push day 45 min",
    });
  });

  it("refuses edits while the week is locked", () => {
    let data = setWeekLock(emptyData(), "2026-10-19", true);
    expect(isWeekLocked(data, "2026-10-19")).toBe(true);
    expect(
      setWellnessDay(data, "2026-10-19", "2026-10-20", { diet: "Rice" }),
    ).toEqual({ ok: false, error: lockedWeekError });
    data = setWeekLock(data, "2026-10-19", false);
    expect(isWeekLocked(data, "2026-10-19")).toBe(false);
    expect(
      setWellnessDay(data, "2026-10-19", "2026-10-20", { diet: "Rice" }).ok,
    ).toBe(true);
  });

  it("keeps weeks independent", () => {
    let data = setWeekLock(emptyData(), "2026-10-19", true);
    expect(
      setWellnessDay(data, "2026-10-26", "2026-10-27", { gym: "Legs" }).ok,
    ).toBe(true);
    expect(isWeekLocked(data, "2026-10-26")).toBe(false);
  });

  it("rejects days outside the week and clamps long text", () => {
    expect(
      setWellnessDay(emptyData(), "2026-10-19", "2026-10-26", { diet: "x" }),
    ).toEqual({ ok: false, error: "That day is outside this week." });
    const long = setWellnessDay(emptyData(), "2026-10-19", "2026-10-19", {
      diet: "a".repeat(500),
    });
    if (!long.ok) throw new Error("expected save");
    expect(wellnessWeek(long.data, "2026-10-19").days[0].diet).toHaveLength(300);
  });

  it("returns the same data for a no-op save", () => {
    const first = setWellnessDay(emptyData(), "2026-10-19", "2026-10-20", {
      diet: "Oats",
    });
    if (!first.ok) throw new Error("expected save");
    const again = setWellnessDay(first.data, "2026-10-19", "2026-10-20", {
      diet: "Oats",
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toBe(first.data);
  });
});
