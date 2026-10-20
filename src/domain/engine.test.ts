import { describe, expect, it } from "vitest";
import { addDays, dataSchema, daysBetween, validDay } from "./model";
import { seededData as emptyData } from "../data/demo";
import {
  addTasks,
  completeTask,
  undoTaskCompletion,
  dailyPlan,
  deleteSubject,
  rateRevision,
  recordTest,
  scoreRating,
  topicStatus,
} from "./engine";
import type { TaskDraft } from "./engine";
import { demoData } from "../data/demo";
const day = "2026-10-15";
const draft: TaskDraft = {
  subjectId: "maths",
  topic: "Percentage",
  title: "Solve 30 questions",
  minutes: 50,
  priority: false,
  revision: true,
  range: "",
  notes: "",
};
function learned() {
  const s = addTasks(emptyData(), [draft], day);
  return completeTask(s, s.tasks[0].id, day);
}
describe("local calendar days", () => {
  it("crosses month, year, leap day and DST without shifting dates", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(daysBetween("2026-03-07", "2026-03-10")).toBe(3);
  });
  it("rejects impossible or non-ISO dates", () => {
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("10/15/2026")).toBe(false);
    expect(validDay(day)).toBe(true);
  });
});
describe("learning and carry-forward", () => {
  it("creates no schedule before actual completion", () => {
    const s = addTasks(emptyData(), [draft], day);
    expect(s.revisions).toHaveLength(0);
    expect(completeTask(s, s.tasks[0].id, "2026-10-18").revisions[0].due).toBe(
      "2026-10-19",
    );
    expect(s.tasks[0].completedOn).toBeUndefined();
  });
  it("completion is idempotent and revision opt-out is respected", () => {
    let s = learned();
    expect(completeTask(s, s.tasks[0].id, day)).toBe(s);
    s = addTasks(s, [{ ...draft, revision: false }], day);
    expect(
      completeTask(s, s.tasks[1].id, day).revisions[0].taskIds,
    ).toHaveLength(1);
  });
  it("combines same-topic work and restarts from new completion", () => {
    let s = learned();
    s = rateRevision(s, s.revisions[0].id, "Easy", addDays(day, 1));
    s = addTasks(s, [draft], addDays(day, 2));
    s = completeTask(s, s.tasks[1].id, addDays(day, 2));
    expect(s.revisions).toHaveLength(1);
    expect(s.revisions[0]).toMatchObject({
      step: 1,
      due: addDays(day, 3),
      revisionCount: 0,
    });
    expect(s.revisions[0].taskIds).toHaveLength(2);
  });
  it("keeps distinct vocabulary ranges separate", () => {
    let s = addTasks(
      emptyData(),
      [
        { ...draft, range: "1-50" },
        { ...draft, range: "51-100" },
        { ...draft, range: "1-50" },
      ],
      day,
    );
    for (const t of s.tasks) s = completeTask(s, t.id, day);
    expect(s.revisions).toHaveLength(2);
    expect(s.revisions[0].taskIds).toHaveLength(2);
  });
  it("carries unfinished work, keeps overdue reviews single, and never auto-defers", () => {
    let s = learned();
    s = addTasks(s, [draft], day);
    const result = dailyPlan(s, addDays(day, 5));
    expect(result.items).toHaveLength(2);
    expect(s.tasks[1].plannedOn).toBe(day);
    expect(result.items[0].kind).toBe("revision");
    expect(result.items[1].rank).toBe(2);
  });
  it("orders priorities, reviews, carried work, then new tasks", () => {
    let s = learned();
    s = addTasks(s, [draft, { ...draft, priority: true }], day);
    s = addTasks(s, [draft], addDays(day, 2));
    expect(dailyPlan(s, addDays(day, 2)).items.map((a) => a.rank)).toEqual([
      0, 1, 2, 3,
    ]);
  });
  it("shows overload without dropping tasks; suggests only non-priority new work", () => {
    let s = addTasks(
      emptyData(),
      [
        { ...draft, minutes: 180 },
        { ...draft, minutes: 120, priority: true },
      ],
      day,
    );
    const p = dailyPlan(s, day);
    expect(p.overload).toBe(90);
    expect(p.items).toHaveLength(2);
    expect(p.suggested?.task.minutes).toBe(180);
    s.subjects[0].archived = true;
    expect(dailyPlan(s, day).items).toHaveLength(0);
  });
  it("rejects unknown/archived subjects or invalid minutes", () => {
    expect(() =>
      addTasks(emptyData(), [{ ...draft, subjectId: "missing" }], day),
    ).toThrow();
    expect(() =>
      addTasks(emptyData(), [{ ...draft, minutes: 0 }], day),
    ).toThrow();
  });
});
describe("adaptive revision ladder", () => {
  it.each([
    ["Forgot", 1, 1],
    ["Hard", 1, 1],
    ["Good", 2, 2],
    ["Easy", 3, 4],
  ] as const)("%s maps to step %s and gap %s", (rating, step, gap) => {
    const s = learned();
    const next = rateRevision(s, s.revisions[0].id, rating, addDays(day, 3));
    expect(next.revisions[0].step).toBe(step);
    expect(next.revisions[0].due).toBe(addDays(day, 3 + gap));
  });
  it("uses actual late recall date, not the old due date", () => {
    const s = learned();
    expect(
      rateRevision(s, s.revisions[0].id, "Good", addDays(day, 8)).revisions[0]
        .due,
    ).toBe(addDays(day, 10));
  });
  it("same-day rating corrections count once and use the original step", () => {
    let s = learned();
    const id = s.revisions[0].id;
    s = rateRevision(s, id, "Easy", addDays(day, 1));
    s = rateRevision(s, id, "Good", addDays(day, 1));
    expect(s.reviews).toHaveLength(1);
    expect(s.revisions[0]).toMatchObject({ step: 2, revisionCount: 1 });
  });
  it("new learning after an earlier same-day review does not revive the old cycle", () => {
    let s = learned();
    const id = s.revisions[0].id;
    s = rateRevision(s, id, "Easy", addDays(day, 1));
    s = rateRevision(s, id, "Easy", addDays(day, 2));
    s = addTasks(s, [draft], addDays(day, 2));
    s = completeTask(s, s.tasks[1].id, addDays(day, 2));
    s = rateRevision(s, id, "Good", addDays(day, 2));
    expect(s.revisions[0]).toMatchObject({ step: 2, revisionCount: 1 });
    expect(s.reviews.filter((r) => r.day === addDays(day, 2))).toHaveLength(1);
  });
  it("forgot restarts count; three recalls mark ready; maintenance stays at 60 days", () => {
    let s = learned();
    const id = s.revisions[0].id;
    for (let n = 1; n <= 3; n++)
      s = rateRevision(s, id, "Good", addDays(day, n));
    expect(topicStatus(s, s.topics[0].id)).toBe("ready_for_test");
    for (let n = 4; n <= 8; n++)
      s = rateRevision(s, id, "Easy", addDays(day, n));
    expect(s.revisions[0]).toMatchObject({ step: 7, due: addDays(day, 68) });
    s = rateRevision(s, id, "Forgot", addDays(day, 9));
    expect(s.revisions[0]).toMatchObject({ step: 1, revisionCount: 0 });
    expect(topicStatus(s, s.topics[0].id)).toBe("weak");
  });
});
describe("external scores and integrity", () => {
  it.each([
    [49, "Forgot"],
    [50, "Hard"],
    [69, "Hard"],
    [70, "Good"],
    [89, "Good"],
    [90, "Easy"],
  ] as const)("maps %s percent to %s", (percent, rating) => {
    expect(scoreRating(percent, [50, 70, 90])).toBe(rating);
  });
  it("overall-only scores do not touch topic schedules", () => {
    const s = learned(),
      n = recordTest(s, {
        id: "t",
        name: "Mock",
        day,
        score: 20,
        total: 100,
        minutes: 60,
        notes: "",
        topics: [],
      });
    expect(n.revisions).toEqual(s.revisions);
    expect(n.reviews).toHaveLength(0);
  });
  it("topic scores update all ranges but historical tests cannot rewind newer learning", () => {
    let s = learned();
    const test = {
      id: "t",
      name: "Mock",
      day: addDays(day, 2),
      score: 90,
      total: 100,
      minutes: 60,
      notes: "",
      topics: [{ topicId: s.topics[0].id, score: 90, total: 100 }],
    };
    s = recordTest(s, test);
    expect(s.revisions[0]).toMatchObject({ step: 3, revisionCount: 1 });
    const r = s.revisions[0];
    s = recordTest(s, {
      ...test,
      id: "t2",
      day,
      score: 0,
      topics: [{ topicId: s.topics[0].id, score: 0, total: 100 }],
    });
    expect(s.revisions[0]).toEqual(r);
  });
  it("deletion cleans references but retains overall test records", () => {
    let s = demoData(day);
    s = deleteSubject(s, "maths");
    expect(() => dataSchema.parse(s)).not.toThrow();
    expect(s.subjects.some((a) => a.id === "maths")).toBe(false);
    expect(s.tests).toHaveLength(1);
    expect(s.tests[0].topics).toHaveLength(0);
  });
  it("rejects future schema versions and missing references", () => {
    expect(dataSchema.safeParse({ ...emptyData(), version: 2 }).success).toBe(
      false,
    );
    const s = learned();
    s.tasks[0].topicId = "missing";
    expect(dataSchema.safeParse(s).success).toBe(false);
  });
  it("demo is valid, relative-dated, and independent of empty personal data", () => {
    const s = demoData(day);
    expect(dataSchema.safeParse(s).success).toBe(true);
    expect(s.tasks.length).toBeGreaterThan(0);
    expect(emptyData().tasks).toHaveLength(0);
  });
});

describe("range readiness and import evidence", () => {
  it("does not call a whole vocabulary topic ready until every range has three revisions", () => {
    let s = addTasks(
      emptyData(),
      [
        { ...draft, range: "1-50" },
        { ...draft, range: "51-100" },
      ],
      day,
    );
    for (const task of s.tasks) s = completeTask(s, task.id, day);
    for (let n = 1; n <= 3; n++)
      s = rateRevision(s, s.revisions[0].id, "Good", addDays(day, n));
    expect(topicStatus(s, s.topics[0].id)).toBe("in_revision");
    for (let n = 1; n <= 3; n++)
      s = rateRevision(s, s.revisions[1].id, "Good", addDays(day, n));
    expect(topicStatus(s, s.topics[0].id)).toBe("ready_for_test");
  });
  it("does not require or invent external-test duration", () => {
    const s = recordTest(learned(), {
      id: "no-time",
      name: "Untimed test",
      day,
      score: 1,
      total: 2,
      notes: "",
      topics: [],
    });
    expect(s.tests[0].minutes).toBeUndefined();
    expect(dataSchema.safeParse(s).success).toBe(true);
  });
  it("rejects revision coverage that pretends unfinished work was learned", () => {
    const s = learned();
    delete s.tasks[0].completedOn;
    expect(dataSchema.safeParse(s).success).toBe(false);
  });
  it("rejects duplicate same-day reviews instead of inflating evidence", () => {
    let s = learned();
    s = rateRevision(s, s.revisions[0].id, "Good", addDays(day, 1));
    s.reviews.push({ ...s.reviews[0], id: "duplicate-day" });
    expect(dataSchema.safeParse(s).success).toBe(false);
  });
});

describe("reversible task completion", () => {
  it("returns an accidental first completion to the plan and removes its unused revision", () => {
    const s = learned(),
      next = undoTaskCompletion(s, s.tasks[0].id);
    expect(next.tasks[0].completedOn).toBeUndefined();
    expect(next.tasks[0].completionUndo).toBeUndefined();
    expect(next.revisions).toHaveLength(0);
    expect(dailyPlan(next, day).items).toHaveLength(1);
    expect(topicStatus(next, next.topics[0].id)).toBe("not_started");
    expect(s.tasks[0].completedOn).toBe(day);
    expect(dataSchema.safeParse(next).success).toBe(true);
  });
  it("is idempotent for unfinished or missing tasks", () => {
    const s = emptyData();
    expect(undoTaskCompletion(s, "missing")).toBe(s);
    const next = addTasks(s, [draft], day);
    expect(undoTaskCompletion(next, next.tasks[0].id)).toBe(next);
  });
  it("undoes opt-out tasks without affecting another schedule", () => {
    let s = learned();
    s = addTasks(s, [{ ...draft, revision: false }], day);
    s = completeTask(s, s.tasks[1].id, day);
    const before = structuredClone(s.revisions);
    s = undoTaskCompletion(s, s.tasks[1].id);
    expect(s.revisions).toEqual(before);
    expect(s.tasks[1].completedOn).toBeUndefined();
  });
  it("restores the exact pre-completion schedule and genuine earlier reviews", () => {
    let s = learned();
    s = rateRevision(s, s.revisions[0].id, "Easy", addDays(day, 1));
    const prior = structuredClone(s.revisions[0]),
      reviews = structuredClone(s.reviews);
    s = addTasks(s, [draft], addDays(day, 3));
    s = completeTask(s, s.tasks[1].id, addDays(day, 3));
    s = undoTaskCompletion(s, s.tasks[1].id);
    expect(s.revisions[0]).toEqual(prior);
    expect(s.reviews).toEqual(reviews);
    expect(dataSchema.safeParse(s).success).toBe(true);
  });
  it("keeps an explicit review deferral when undoing newly added learning", () => {
    let s = learned();
    s = addTasks(s, [draft], addDays(day, 1));
    s = completeTask(s, s.tasks[1].id, addDays(day, 1));
    s.revisions[0].due = addDays(day, 10);
    s = undoTaskCompletion(s, s.tasks[1].id);
    expect(s.revisions[0].due).toBe(addDays(day, 10));
    expect(s.revisions[0].taskIds).toEqual([s.tasks[0].id]);
  });
  it("removes only the selected task from combined same-day coverage", () => {
    let s = addTasks(emptyData(), [draft, draft], day);
    for (const t of s.tasks) s = completeTask(s, t.id, day);
    s = undoTaskCompletion(s, s.tasks[1].id);
    expect(s.revisions[0].taskIds).toEqual([s.tasks[0].id]);
    expect(s.revisions[0].due).toBe(addDays(day, 1));
    s = undoTaskCompletion(s, s.tasks[0].id);
    expect(s.revisions).toHaveLength(0);
    expect(dataSchema.safeParse(s).success).toBe(true);
  });
  it("supports out-of-order undo without leaving a ghost schedule", () => {
    let s = addTasks(emptyData(), [draft, draft, draft], day);
    for (const t of s.tasks) s = completeTask(s, t.id, day);
    for (const n of [0, 2, 1]) {
      s = undoTaskCompletion(s, s.tasks[n].id);
      expect(dataSchema.safeParse(s).success).toBe(true);
    }
    expect(s.revisions).toHaveLength(0);
    expect(s.tasks.every((t) => !t.completedOn)).toBe(true);
  });
  it("keeps genuinely completed recalls after reopening their learning task", () => {
    let s = learned();
    s = rateRevision(s, s.revisions[0].id, "Good", addDays(day, 1));
    const before = structuredClone(s.revisions[0]),
      reviews = structuredClone(s.reviews);
    s = undoTaskCompletion(s, s.tasks[0].id);
    expect(s.reviews).toEqual(reviews);
    expect(s.revisions[0]).toEqual({ ...before, taskIds: [] });
    expect(dataSchema.safeParse(s).success).toBe(true);
  });
  it("preserves same-day Forgot evidence rather than mistaking it for untouched completion", () => {
    let s = learned();
    s = rateRevision(s, s.revisions[0].id, "Forgot", day);
    s = undoTaskCompletion(s, s.tasks[0].id);
    expect(s.reviews).toHaveLength(1);
    expect(s.revisions[0]).toMatchObject({
      revisionCount: 0,
      step: 1,
      taskIds: [],
    });
    expect(topicStatus(s, s.topics[0].id)).toBe("weak");
  });
  it("keeps external test records and test-started schedules intact", () => {
    let s = addTasks(emptyData(), [draft], day);
    s = recordTest(s, {
      id: "external",
      name: "Actual topic test",
      day,
      score: 90,
      total: 100,
      notes: "",
      topics: [{ topicId: s.topics[0].id, score: 90, total: 100 }],
    });
    const before = structuredClone(s.revisions[0]);
    s = completeTask(s, s.tasks[0].id, addDays(day, 1));
    s = undoTaskCompletion(s, s.tasks[0].id);
    expect(s.revisions[0]).toEqual(before);
    expect(s.tests).toHaveLength(1);
    expect(s.reviews).toHaveLength(1);
    expect(dataSchema.safeParse(s).success).toBe(true);
  });
  it("never touches another vocabulary range", () => {
    let s = addTasks(
      emptyData(),
      [
        { ...draft, range: "1-50" },
        { ...draft, range: "51-100" },
      ],
      day,
    );
    for (const t of s.tasks) s = completeTask(s, t.id, day);
    const other = structuredClone(s.revisions[1]);
    s = undoTaskCompletion(s, s.tasks[0].id);
    expect(s.revisions).toEqual([other]);
    expect(s.tasks[1].completedOn).toBe(day);
  });
  it("supports pre-update saved tasks without an undo snapshot", () => {
    let s = learned();
    delete s.tasks[0].completionUndo;
    s = undoTaskCompletion(s, s.tasks[0].id);
    expect(s.revisions).toHaveLength(0);
    s = learned();
    s = addTasks(s, [draft], addDays(day, 3));
    s = completeTask(s, s.tasks[1].id, addDays(day, 3));
    delete s.tasks[1].completionUndo;
    s = undoTaskCompletion(s, s.tasks[1].id);
    expect(s.revisions[0]).toMatchObject({
      due: addDays(day, 1),
      taskIds: [s.tasks[0].id],
      revisionCount: 0,
    });
    expect(dataSchema.safeParse(s).success).toBe(true);
  });
  it("can complete a reopened task again from its new actual completion date", () => {
    let s = learned();
    s = undoTaskCompletion(s, s.tasks[0].id);
    s = completeTask(s, s.tasks[0].id, addDays(day, 5));
    expect(s.revisions).toHaveLength(1);
    expect(s.revisions[0].due).toBe(addDays(day, 6));
    expect(dataSchema.safeParse(s).success).toBe(true);
  });
});
