import { addDays, daysBetween } from "./model";
import type { AppData, WellnessWeek } from "./model";

export const lockedWeekError =
  "This week is locked. Unlock it before editing diet or gym plans.";

/** Monday of the week containing `value`. */
export function weekStartOf(value: string): string {
  const day = new Date(value + "T12:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
  return addDays(value, day === 0 ? -6 : 1 - day);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Existing week record, or an empty unlocked one for that Monday. */
export function wellnessWeek(data: AppData, weekStart: string): WellnessWeek {
  return (
    data.wellness.weeks.find((w) => w.weekStart === weekStart) ?? {
      weekStart,
      locked: false,
      days: [],
    }
  );
}

export function isWeekLocked(data: AppData, weekStart: string): boolean {
  return wellnessWeek(data, weekStart).locked;
}

export type WellnessResult =
  | { ok: true; data: AppData }
  | { ok: false; error: string };

function replaceWeek(data: AppData, week: WellnessWeek): AppData {
  const exists = data.wellness.weeks.some((w) => w.weekStart === week.weekStart);
  const weeks = exists
    ? data.wellness.weeks.map((w) => (w.weekStart === week.weekStart ? week : w))
    : [...data.wellness.weeks, week].sort((a, b) =>
        a.weekStart < b.weekStart ? -1 : 1,
      );
  return { ...data, wellness: { weeks } };
}

/** Update one day's diet/gym text. Refuses edits while the week is locked. */
export function setWellnessDay(
  data: AppData,
  weekStart: string,
  day: string,
  patch: { diet?: string; gym?: string },
): WellnessResult {
  const week = wellnessWeek(data, weekStart);
  if (week.locked) return { ok: false, error: lockedWeekError };
  const offset = daysBetween(weekStart, day);
  if (offset < 0 || offset > 6)
    return { ok: false, error: "That day is outside this week." };
  const existing = week.days.find((d) => d.day === day) ?? {
    day,
    diet: "",
    gym: "",
  };
  const next = {
    ...existing,
    diet: (patch.diet ?? existing.diet).slice(0, 300),
    gym: (patch.gym ?? existing.gym).slice(0, 300),
  };
  if (
    next.diet === existing.diet &&
    next.gym === existing.gym &&
    week.days.some((d) => d.day === day)
  )
    return { ok: true, data };
  const days = week.days.some((d) => d.day === day)
    ? week.days.map((d) => (d.day === day ? next : d))
    : [...week.days, next].sort((a, b) => (a.day < b.day ? -1 : 1));
  return { ok: true, data: replaceWeek(data, { ...week, days }) };
}

/** Lock or unlock a whole week. Locking preserves the plan read-only. */
export function setWeekLock(
  data: AppData,
  weekStart: string,
  locked: boolean,
): AppData {
  return replaceWeek(data, { ...wellnessWeek(data, weekStart), locked });
}

/** Weeks whose lock covers `on` (there is at most one). */
export function lockedWeekFor(data: AppData, on: string): WellnessWeek | null {
  const week = data.wellness.weeks.find((w) => w.weekStart === weekStartOf(on));
  return week?.locked ? week : null;
}
