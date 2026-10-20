import { addDays, daysBetween } from "./model";
import type { AppData } from "./model";

/** Mark `on` as a studied day. Idempotent: saving the same day twice keeps the
 *  streak untouched. A consecutive day extends it; a gap restarts at 1. */
export function saveStreak(data: AppData, on: string): AppData {
  const streak = data.streak ?? { count: 0, lastOn: null };
  if (streak.lastOn === on) return data;
  const count =
    streak.lastOn !== null && daysBetween(streak.lastOn, on) === 1
      ? Math.min(streak.count + 1, 20000)
      : 1;
  return { ...data, streak: { count, lastOn: on } };
}

export function streakStatus(data: AppData, on: string): {
  count: number;
  studiedToday: boolean;
} {
  const streak = data.streak ?? { count: 0, lastOn: null };
  return { count: streak.count, studiedToday: streak.lastOn === on };
}

/** Whether `on` is exactly one day after the last studied day. */
export function continuesStreak(lastOn: string | null, on: string): boolean {
  return lastOn !== null && daysBetween(lastOn, on) === 1;
}

export { addDays };
