import { addDays, today } from "./model";
import type { AppData, SleepEntry } from "./model";

export const sleepError =
  "Check the times — that span is under 15 minutes or over 16 hours.";

function clock(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutes slept between bedtime and wake, crossing midnight when needed.
 *  Rejects spans under 15 minutes or over 16 hours (including equal times). */
export function sleepMinutes(bedtime: string, wake: string): number | null {
  const b = clock(bedtime),
    w = clock(wake);
  if (b === null || w === null) return null;
  const span = w > b ? w - b : w + 1440 - b;
  return span >= 15 && span <= 960 ? span : null;
}

export type SleepResult =
  | { ok: true; data: AppData }
  | { ok: false; error: string };

/** One entry per morning: saving again the same date updates it. A no-op
 *  update returns the same data reference. */
export function saveSleep(
  data: AppData,
  entry: { date: string; bedtime: string; wake: string },
): SleepResult {
  const minutes = sleepMinutes(entry.bedtime, entry.wake);
  if (minutes === null) return { ok: false, error: sleepError };
  const existing = data.sleep.find((s) => s.date === entry.date);
  if (
    existing &&
    existing.bedtime === entry.bedtime &&
    existing.wake === entry.wake &&
    existing.minutes === minutes
  )
    return { ok: true, data };
  const next: SleepEntry = {
    date: entry.date,
    bedtime: entry.bedtime,
    wake: entry.wake,
    minutes,
  };
  const sleep = existing
    ? data.sleep.map((s) => (s.date === entry.date ? next : s))
    : [...data.sleep, next].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { ok: true, data: { ...data, sleep } };
}

export function sleepFor(data: AppData, date: string): SleepEntry | undefined {
  return data.sleep.find((s) => s.date === date);
}

export type SleepTrend = {
  average: number | null;
  nights: number;
  window: SleepEntry[];
};

/** Average sleep across the 7-night window ending on `on` (inclusive). */
export function sleepTrend(data: AppData, on: string = today()): SleepTrend {
  const start = addDays(on, -6);
  const window = data.sleep
    .filter((s) => s.date >= start && s.date <= on)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const nights = window.length;
  return {
    average: nights
      ? Math.round(window.reduce((sum, s) => sum + s.minutes, 0) / nights)
      : null,
    nights,
    window,
  };
}
