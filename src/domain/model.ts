import { z } from "zod";

export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
const day = z.string().refine(validDay, "Use a valid calendar date");
const id = z.string().min(1).max(150);
const text = z.string().trim().min(1).max(500);
export const themes = [
  "maths",
  "reasoning",
  "english",
  "gk",
  "dsa",
  "software",
  "generic",
] as const;
export const ratings = ["Forgot", "Hard", "Good", "Easy"] as const;
export const subjectSchema = z.object({
  id,
  name: text,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  theme: z.enum(themes),
  archived: z.boolean(),
});
const topicSchema = z.object({
  id,
  subjectId: id,
  name: text,
  group: z.string().max(100).default(""),
});
const revisionSchema = z.object({
  id,
  topicId: id,
  range: z.string().max(100).default(""),
  taskIds: z.array(id),
  step: z.number().int().min(1).max(7),
  due: day,
  lastCompletedOn: day,
  revisionCount: z.number().int().nonnegative(),
  cycle: z.number().int().nonnegative().optional(),
});
const reviewSchema = z.object({
  id,
  revisionId: id,
  topicId: id,
  day,
  rating: z.enum(ratings),
  source: z.enum(["recall", "test"]),
  stepBefore: z.number().int().min(1).max(7),
  countBefore: z.number().int().nonnegative(),
  stepAfter: z.number().int().min(1).max(7),
  cycle: z.number().int().nonnegative().optional(),
});
export const taskSchema = z.object({
  id,
  topicId: id,
  title: text,
  minutes: z.number().int().min(1).max(1440),
  priority: z.boolean(),
  revision: z.boolean(),
  range: z.string().max(100).default(""),
  plannedOn: day,
  createdOn: day,
  completedOn: day.optional(),
  notes: z.string().max(10000).default(""),
  completionUndo: z
    .object({
      revisionId: id,
      cycleAfter: z.number().int().nonnegative(),
      dueAfter: day,
      previous: revisionSchema
        .pick({
          step: true,
          due: true,
          lastCompletedOn: true,
          revisionCount: true,
          cycle: true,
        })
        .extend({ coveredTasks: z.number().int().nonnegative() })
        .optional(),
    })
    .optional(),
});
const score = z.number().finite().nonnegative().max(1000000);
// Historical syllabus snapshots intentionally survive topic/subject deletion.
// IDs here are provenance, not live references like test.topics.
const examCoverageSchema = z.object({
  topicId: id,
  topicName: text,
  subjectName: text,
  range: z.string().max(100),
  reviewDays: z
    .array(day)
    .min(1)
    .max(100000)
    .refine(
      (days) => new Set(days).size === days.length,
      "Duplicate covered review days",
    ),
});
export const testSchema = z
  .object({
    id,
    name: text,
    day,
    score,
    total: score.positive(),
    minutes: z.number().int().min(0).max(1440).optional(),
    notes: z.string().max(10000),
    topics: z.array(z.object({ topicId: id, score, total: score.positive() })),
    revisionExam: z
      .object({
        scheduledFor: day,
        coverage: z.array(examCoverageSchema).min(1).max(20000),
      })
      .optional(),
  })
  .superRefine((t, ctx) => {
    if (t.revisionExam) {
      const coverage = t.revisionExam.coverage;
      if (coverage.some((c) => c.reviewDays.some((d) => d > t.day)))
        ctx.addIssue({
          code: "custom",
          message: "An exam cannot cover future revisions",
        });
      if (
        new Set(coverage.map((c) => JSON.stringify([c.topicId, c.range])))
          .size !== coverage.length
      )
        ctx.addIssue({ code: "custom", message: "Duplicate exam topic/range" });
      if (
        t.topics.some(
          (topic) => !coverage.some((c) => c.topicId === topic.topicId),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Exam scores must belong to its syllabus",
        });
    }
    if (t.score > t.total || t.topics.some((a) => a.score > a.total))
      ctx.addIssue({ code: "custom", message: "Score cannot exceed total" });
    if (new Set(t.topics.map((a) => a.topicId)).size !== t.topics.length)
      ctx.addIssue({
        code: "custom",
        message: "Each topic can appear once per test",
      });
  });
const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM times");
export const sleepEntrySchema = z.object({
  date: day,
  bedtime: hhmm,
  wake: hhmm,
  minutes: z.number().int().min(15).max(960),
});
export const streakSchema = z.object({
  count: z.number().int().min(0).max(20000),
  lastOn: day.nullable(),
});
export const wellnessDaySchema = z.object({
  day,
  diet: z.string().max(300),
  gym: z.string().max(300),
});
export const wellnessWeekSchema = z.object({
  weekStart: day,
  locked: z.boolean(),
  days: z.array(wellnessDaySchema).max(7),
});
export const wellnessSchema = z.object({
  weeks: z.array(wellnessWeekSchema).max(520),
});
export const preferencesSchema = z.object({
  dailyMinutes: z.number().int().min(15).max(1440),
  revisionMinutes: z.number().int().min(1).max(240),
  gaps: z.array(z.number().int().min(1).max(365)).length(6),
  maintenanceDays: z.number().int().min(1).max(365),
  thresholds: z
    .tuple([z.number(), z.number(), z.number()])
    .refine(
      ([a, b, c]) => a > 0 && a < b && b < c && c <= 100,
      "Thresholds must increase, between 0 and 100",
    ),
  worldMode: z.enum(["3d", "2d"]),
  examIntervalDays: z.number().int().min(1).max(90).default(7),
});
export const dataSchema = z
  .object({
    version: z.literal(1),
    subjects: z.array(subjectSchema).max(1000),
    topics: z.array(topicSchema).max(20000),
    tasks: z.array(taskSchema).max(50000),
    revisions: z.array(revisionSchema).max(20000),
    reviews: z.array(reviewSchema).max(100000),
    tests: z.array(testSchema).max(20000),
    preferences: preferencesSchema,
    streak: streakSchema.default({ count: 0, lastOn: null }),
    sleep: z.array(sleepEntrySchema).max(20000).default([]),
    wellness: wellnessSchema.default({ weeks: [] }),
  })
  .superRefine((s, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (new Set(s.sleep.map((a) => a.date)).size !== s.sleep.length)
      error("Only one sleep entry per date is allowed");
    if (
      new Set(s.wellness.weeks.map((w) => w.weekStart)).size !==
      s.wellness.weeks.length
    )
      error("Only one wellness entry per week is allowed");
    if (
      s.wellness.weeks.some(
        (w) =>
          new Set(w.days.map((d) => d.day)).size !== w.days.length ||
          w.days.some((d) => d.day < w.weekStart || d.day > addDays(w.weekStart, 6)),
      )
    )
      error("Wellness days must be unique and inside their week");
    for (const key of [
      "subjects",
      "topics",
      "tasks",
      "revisions",
      "reviews",
      "tests",
    ] as const)
      if (new Set(s[key].map((a) => a.id)).size !== s[key].length)
        error("Duplicate IDs in " + key);
    const subjects = new Set(s.subjects.map((a) => a.id)),
      topics = new Set(s.topics.map((a) => a.id)),
      tasks = new Set(s.tasks.map((a) => a.id)),
      revisions = new Set(s.revisions.map((a) => a.id));
    const taskById = new Map(s.tasks.map((t) => [t.id, t]));
    const revisionById = new Map(s.revisions.map((r) => [r.id, r]));
    if (
      s.topics.some((a) => !subjects.has(a.subjectId)) ||
      s.tasks.some((a) => !topics.has(a.topicId)) ||
      s.revisions.some(
        (a) => !topics.has(a.topicId) || a.taskIds.some((t) => !tasks.has(t)),
      ) ||
      s.reviews.some(
        (a) => !topics.has(a.topicId) || !revisions.has(a.revisionId),
      ) ||
      s.tests.some((a) => a.topics.some((t) => !topics.has(t.topicId)))
    )
      error("Data contains missing references");
    if (
      new Set(s.revisions.map((a) => a.topicId + "\0" + a.range)).size !==
      s.revisions.length
    )
      error("A topic/range may only have one revision schedule");
    if (
      s.revisions.some((r) =>
        r.taskIds.some((t) => {
          const task = taskById.get(t);
          return (
            !task ||
            task.topicId !== r.topicId ||
            task.range !== r.range ||
            !task.completedOn
          );
        }),
      )
    )
      error("Revision tasks must be completed and belong to their topic/range");
    if (
      s.reviews.some(
        (r) => revisionById.get(r.revisionId)?.topicId !== r.topicId,
      )
    )
      error("Review topic must match its revision");
    if (
      new Set(s.reviews.map((r) => r.revisionId + "\0" + r.day)).size !==
      s.reviews.length
    )
      error("Only one review per revision per day is allowed");
  });
export type Subject = z.infer<typeof subjectSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Revision = z.infer<typeof revisionSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type TestResult = z.infer<typeof testSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type SleepEntry = z.infer<typeof sleepEntrySchema>;
export type Streak = z.infer<typeof streakSchema>;
export type WellnessWeek = z.infer<typeof wellnessWeekSchema>;
export type AppData = z.infer<typeof dataSchema>;
export type Rating = (typeof ratings)[number];
export type Theme = (typeof themes)[number];
export const uid = () => crypto.randomUUID();
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(value: string, count: number): string {
  const d = new Date(value + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) {
  return Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
}
export function displayDate(
  value: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Date(value + "T12:00:00").toLocaleDateString(
    undefined,
    options ?? { day: "numeric", month: "short" },
  );
}
export function duration(minutes: number) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
    : `${minutes}m`;
}
export const normalize = (s: string) =>
  s.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function emptyData(): AppData {
  return {
    version: 1,
    subjects: [],
    topics: [],
    tasks: [],
    revisions: [],
    reviews: [],
    tests: [],
    streak: { count: 0, lastOn: null },
    sleep: [],
    wellness: { weeks: [] },
    preferences: {
      dailyMinutes: 210,
      revisionMinutes: 20,
      gaps: [1, 2, 4, 7, 16, 30],
      maintenanceDays: 60,
      thresholds: [50, 70, 90],
      worldMode: "3d",
      examIntervalDays: 7,
    },
  };
}
