import { addDays, daysBetween, normalize, uid } from "./model";
import type {
  AppData,
  Rating,
  Revision,
  Task,
  TestResult,
  Topic,
} from "./model";
export const clone = (s: AppData): AppData => structuredClone(s);
export function subjectFor(s: AppData, topicId: string) {
  return s.subjects.find(
    (a) => a.id === s.topics.find((t) => t.id === topicId)?.subjectId,
  );
}
export function activeTopic(s: AppData, topicId: string) {
  const subject = subjectFor(s, topicId);
  return !!subject && !subject.archived;
}
export function completeTask(
  input: AppData,
  taskId: string,
  date: string,
): AppData {
  const s = clone(input),
    task = s.tasks.find((t) => t.id === taskId);
  if (!task || task.completedOn || !activeTopic(s, task.topicId)) return input;
  task.completedOn = date;
  if (!task.revision) return s;
  let r = s.revisions.find(
    (a) => a.topicId === task.topicId && a.range === task.range,
  );
  const previous = r
    ? {
        step: r.step,
        due: r.due,
        lastCompletedOn: r.lastCompletedOn,
        revisionCount: r.revisionCount,
        cycle: r.cycle,
        coveredTasks: r.taskIds.length,
      }
    : undefined;
  if (!r) {
    r = {
      id: uid(),
      topicId: task.topicId,
      range: task.range,
      taskIds: [],
      step: 1,
      due: "",
      lastCompletedOn: date,
      revisionCount: 0,
    };
    s.revisions.push(r);
  }
  r.taskIds = [...new Set([...r.taskIds, task.id])];
  r.cycle = (r.cycle ?? 0) + 1;
  r.step = 1;
  r.due = addDays(date, s.preferences.gaps[0]);
  r.lastCompletedOn = date;
  r.revisionCount = 0;
  task.completionUndo = {
    revisionId: r.id,
    cycleAfter: r.cycle,
    dueAfter: r.due,
    previous,
  };
  return s;
}
/** Reopen only this task. Restore the prior schedule when possible, never erase genuine recall/test history. */
export function undoTaskCompletion(input: AppData, taskId: string): AppData {
  const original = input.tasks.find((t) => t.id === taskId);
  if (!original?.completedOn) return input;
  const s = clone(input),
    task = s.tasks.find((t) => t.id === taskId)!;
  const completedOn = task.completedOn!,
    undo = task.completionUndo;
  delete task.completedOn;
  delete task.completionUndo;
  const r = s.revisions.find((r) => r.taskIds.includes(taskId));
  if (!r) return s;
  r.taskIds = r.taskIds.filter((id) => id !== taskId);
  const reviews = s.reviews.filter((review) => review.revisionId === r.id);
  if (!r.taskIds.length && !reviews.length) {
    s.revisions = s.revisions.filter((schedule) => schedule.id !== r.id);
    return s;
  }
  const untouched =
    undo?.revisionId === r.id &&
    undo.cycleAfter === (r.cycle ?? 0) &&
    r.step === 1 &&
    r.revisionCount === 0 &&
    r.lastCompletedOn === completedOn &&
    !reviews.some((review) => (review.cycle ?? 0) === undo.cycleAfter);
  if (
    untouched &&
    undo.previous &&
    undo.previous.coveredTasks === r.taskIds.length
  ) {
    const before = undo.previous;
    const due = r.due !== undo.dueAfter ? r.due : before.due;
    Object.assign(r, {
      step: before.step,
      due,
      lastCompletedOn: before.lastCompletedOn,
      revisionCount: before.revisionCount,
      cycle: before.cycle,
    });
    return s;
  }
  // Older saved tasks have no undo snapshot; out-of-order undo also comes here.
  // Keep the current schedule if its latest evidence is still valid. Otherwise
  // rebuild from remaining completed work and retained review evidence only.
  const latestLearning = s.tasks
    .filter((t) => r.taskIds.includes(t.id) && t.completedOn)
    .map((t) => t.completedOn!)
    .sort()
    .at(-1);
  const lastReview = reviews.sort((a, b) => b.day.localeCompare(a.day))[0];
  if (lastReview && (!latestLearning || lastReview.day >= latestLearning)) {
    if (
      r.lastCompletedOn !== lastReview.day ||
      r.step !== lastReview.stepAfter ||
      r.revisionCount !==
        (lastReview.rating === "Forgot" ? 0 : lastReview.countBefore + 1)
    ) {
      r.step = lastReview.stepAfter;
      r.revisionCount =
        lastReview.rating === "Forgot" ? 0 : lastReview.countBefore + 1;
      r.lastCompletedOn = lastReview.day;
      r.cycle = lastReview.cycle ?? 0;
      r.due = addDays(
        lastReview.day,
        r.step === 7
          ? s.preferences.maintenanceDays
          : s.preferences.gaps[r.step - 1],
      );
    }
  } else if (latestLearning) {
    // An unrelated later completion is still the anchor; preserve its deferral.
    if (
      r.lastCompletedOn !== latestLearning ||
      r.step !== 1 ||
      r.revisionCount !== 0
    ) {
      r.step = 1;
      r.revisionCount = 0;
      r.lastCompletedOn = latestLearning;
      r.due = addDays(latestLearning, s.preferences.gaps[0]);
    }
  }
  return s;
}
export function nextStep(step: number, rating: Rating) {
  return rating === "Forgot"
    ? 1
    : Math.min(7, step + (rating === "Good" ? 1 : rating === "Easy" ? 2 : 0));
}
export function rateRevision(
  input: AppData,
  revisionId: string,
  rating: Rating,
  date: string,
  source: "recall" | "test" = "recall",
): AppData {
  const s = clone(input),
    r = s.revisions.find((a) => a.id === revisionId);
  if (!r || date < r.lastCompletedOn) return input;
  const sameDay = s.reviews.find(
    (a) => a.revisionId === r.id && a.day === date,
  );
  const sameCycle = sameDay && (sameDay.cycle ?? 0) === (r.cycle ?? 0);
  const stepBefore = sameCycle ? sameDay.stepBefore : r.step,
    countBefore = sameCycle ? sameDay.countBefore : r.revisionCount;
  r.step = nextStep(stepBefore, rating);
  r.due = addDays(
    date,
    r.step === 7
      ? s.preferences.maintenanceDays
      : s.preferences.gaps[r.step - 1],
  );
  r.lastCompletedOn = date;
  r.revisionCount = rating === "Forgot" ? 0 : countBefore + 1;
  const record = {
    id: sameDay?.id ?? uid(),
    revisionId: r.id,
    topicId: r.topicId,
    day: date,
    rating,
    source,
    stepBefore,
    countBefore,
    stepAfter: r.step,
    cycle: r.cycle ?? 0,
  };
  if (sameDay) s.reviews[s.reviews.indexOf(sameDay)] = record;
  else s.reviews.push(record);
  return s;
}
export function scoreRating(
  percent: number,
  thresholds: [number, number, number],
): Rating {
  return percent < thresholds[0]
    ? "Forgot"
    : percent < thresholds[1]
      ? "Hard"
      : percent < thresholds[2]
        ? "Good"
        : "Easy";
}
export function recordTest(input: AppData, test: TestResult): AppData {
  let s = clone(input);
  s.tests.push(test);
  for (const result of test.topics) {
    const schedules = s.revisions.filter((r) => r.topicId === result.topicId);
    if (!schedules.length) {
      const r: Revision = {
        id: uid(),
        topicId: result.topicId,
        range: "",
        taskIds: [],
        step: 1,
        due: test.day,
        lastCompletedOn: test.day,
        revisionCount: 0,
      };
      s.revisions.push(r);
      schedules.push(r);
    }
    // A topic score covers the topic; update each vocabulary range for that topic.
    // Historical results are retained but never move newer schedules backwards.
    for (const schedule of schedules)
      if (test.day >= schedule.lastCompletedOn)
        s = rateRevision(
          s,
          schedule.id,
          scoreRating(
            (result.score / result.total) * 100,
            s.preferences.thresholds,
          ),
          test.day,
          "test",
        );
  }
  return s;
}
export type PlanItem =
  | { kind: "task"; task: Task; rank: number; minutes: number; date: string }
  | {
      kind: "revision";
      revision: Revision;
      rank: number;
      minutes: number;
      date: string;
    };
export function dailyPlan(s: AppData, date: string) {
  const items: PlanItem[] = [
    ...s.tasks
      .filter(
        (t) =>
          !t.completedOn && t.plannedOn <= date && activeTopic(s, t.topicId),
      )
      .map((t) => ({
        kind: "task" as const,
        task: t,
        rank: t.priority ? 0 : t.plannedOn < date ? 2 : 3,
        minutes: t.minutes,
        date: t.plannedOn,
      })),
    ...s.revisions
      .filter((r) => r.due <= date && activeTopic(s, r.topicId))
      .map((r) => ({
        kind: "revision" as const,
        revision: r,
        rank: 1,
        minutes: s.preferences.revisionMinutes,
        date: r.due,
      })),
  ].sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date));
  const total = items.reduce((n, a) => n + a.minutes, 0),
    available = s.preferences.dailyMinutes;
  const suggested = items
    .filter(
      (a): a is Extract<PlanItem, { kind: "task" }> =>
        a.kind === "task" && a.rank === 3,
    )
    .sort((a, b) => b.minutes - a.minutes)[0];
  return {
    items,
    total,
    available,
    overload: Math.max(0, total - available),
    suggested,
  };
}
export function latestTopicScore(s: AppData, topicId: string) {
  const latest = s.tests
    .filter((t) => t.topics.some((a) => a.topicId === topicId))
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) || s.tests.indexOf(b) - s.tests.indexOf(a),
    )[0];
  const result = latest?.topics.find((a) => a.topicId === topicId);
  return result
    ? { percent: (result.score / result.total) * 100, date: latest.day }
    : null;
}
export type TopicStatus =
  "not_started" | "in_revision" | "ready_for_test" | "strong" | "weak";
export function topicStatus(s: AppData, topicId: string): TopicStatus {
  const score = latestTopicScore(s, topicId);
  const schedules = s.revisions.filter((a) => a.topicId === topicId);
  const fullyRevised =
    schedules.length > 0 && schedules.every((r) => r.revisionCount >= 3);
  const lastReview = s.reviews
    .filter((a) => a.topicId === topicId)
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  if ((score && score.percent < 50) || lastReview?.rating === "Forgot")
    return "weak";
  if (
    fullyRevised &&
    score &&
    score.percent >= 80 &&
    lastReview &&
    ["Good", "Easy"].includes(lastReview.rating)
  )
    return "strong";
  if (fullyRevised) return "ready_for_test";
  if (
    schedules.length ||
    s.tasks.some((t) => t.topicId === topicId && t.completedOn)
  )
    return "in_revision";
  return "not_started";
}
export const statusLabels: Record<TopicStatus, string> = {
  not_started: "Not started",
  in_revision: "In revision",
  ready_for_test: "Ready for test",
  strong: "Strong evidence",
  weak: "Needs attention",
};
export function ensureTopic(
  s: AppData,
  subjectId: string,
  name: string,
): Topic {
  const existing = s.topics.find(
    (t) => t.subjectId === subjectId && normalize(t.name) === normalize(name),
  );
  if (existing) return existing;
  const topic: Topic = { id: uid(), subjectId, name: name.trim(), group: "" };
  s.topics.push(topic);
  return topic;
}
export interface TaskDraft {
  subjectId: string;
  topic: string;
  title: string;
  minutes: number;
  priority: boolean;
  revision: boolean;
  range: string;
  notes: string;
}
export function addTasks(
  input: AppData,
  drafts: TaskDraft[],
  date: string,
): AppData {
  const s = clone(input);
  for (const draft of drafts) {
    if (
      !s.subjects.some((a) => a.id === draft.subjectId && !a.archived) ||
      !draft.title.trim() ||
      !draft.topic.trim() ||
      !Number.isInteger(draft.minutes) ||
      draft.minutes < 1 ||
      draft.minutes > 1440
    )
      throw new Error(
        "Check the subject, topic, title and minutes for every task.",
      );
    const topic = ensureTopic(s, draft.subjectId, draft.topic);
    s.tasks.push({
      id: uid(),
      topicId: topic.id,
      title: draft.title.trim(),
      minutes: draft.minutes,
      priority: draft.priority,
      revision: draft.revision,
      range: draft.range.trim(),
      notes: draft.notes,
      plannedOn: date,
      createdOn: date,
    });
  }
  return s;
}
export function deleteSubject(input: AppData, id: string): AppData {
  const s = clone(input),
    topicIds = new Set(
      s.topics.filter((t) => t.subjectId === id).map((t) => t.id),
    );
  s.subjects = s.subjects.filter((a) => a.id !== id);
  s.topics = s.topics.filter((a) => !topicIds.has(a.id));
  s.tasks = s.tasks.filter((a) => !topicIds.has(a.topicId));
  s.revisions = s.revisions.filter((a) => !topicIds.has(a.topicId));
  s.reviews = s.reviews.filter((a) => !topicIds.has(a.topicId));
  s.tests = s.tests.map((t) => ({
    ...t,
    topics: t.topics.filter((a) => !topicIds.has(a.topicId)),
  }));
  return s;
}
export function carriedLabel(task: Task, date: string) {
  const days = daysBetween(task.plannedOn, date);
  return days > 0
    ? `Carried ${days} ${days === 1 ? "day" : "days"}`
    : "New today";
}
