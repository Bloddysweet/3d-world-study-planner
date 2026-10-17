import { addDays } from "./model";
import type { AppData } from "./model";
export type InsightPeriod = "7" | "30" | "all";
/** Read-only aggregates. Estimates are never presented as tracked study time. */
export function insights(data: AppData, date: string, period: InsightPeriod) {
  const starts = [
    date,
    ...data.tasks
      .map((t) => t.completedOn)
      .filter((day): day is string => !!day),
    ...data.reviews.map((r) => r.day),
    ...data.tests.map((t) => t.day),
  ]
    .filter((day) => day <= date)
    .sort();
  const start =
    period === "all" ? starts[0] : addDays(date, 1 - Number(period));
  const contains = (day: string) => day >= start && day <= date;
  const completed = data.tasks.filter(
    (t) => t.completedOn && contains(t.completedOn),
  );
  const reviews = data.reviews.filter((r) => contains(r.day));
  const recalls = reviews.filter((r) => r.source === "recall");
  const tests = data.tests.filter((t) => contains(t.day));
  const scores = tests.flatMap((t) =>
    t.topics.map((topic) => ({
      ...topic,
      percent: (topic.score / topic.total) * 100,
    })),
  );
  const studyDays = new Set([
    ...completed.map((t) => t.completedOn!),
    ...recalls.map((r) => r.day),
    ...tests.map((t) => t.day),
  ]).size;
  const average = scores.length
    ? scores.reduce((total, s) => total + s.percent, 0) / scores.length
    : null;
  const ratings = (["Forgot", "Hard", "Good", "Easy"] as const).map(
    (rating) => ({
      rating,
      count: recalls.filter((r) => r.rating === rating).length,
    }),
  );
  const activity = Array.from({ length: 84 }, (_, i) => {
    const day = addDays(date, i - 83);
    return {
      day,
      inPeriod: contains(day),
      count: contains(day)
        ? completed.filter((t) => t.completedOn === day).length +
          recalls.filter((r) => r.day === day).length +
          tests.filter((t) => t.day === day).length
        : 0,
    };
  });
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(date, i - 6);
    return {
      day,
      inPeriod: contains(day),
      scheduled: data.tasks
        .filter((t) => t.plannedOn === day)
        .reduce((sum, t) => sum + t.minutes, 0),
      done: completed
        .filter((t) => t.completedOn === day)
        .reduce((sum, t) => sum + t.minutes, 0),
    };
  });
  return {
    start,
    studyDays,
    completed,
    recalls,
    tests,
    scores,
    average,
    ratings,
    activity,
    week,
  };
}
