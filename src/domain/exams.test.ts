import { describe, expect, it } from "vitest";
import {
  addTasks,
  completeTask,
  rateRevision,
  recordTest,
  deleteSubject,
} from "./engine";
import { revisionExamPlan, recordRevisionExam } from "./exams";
import { dataSchema, emptyData, testSchema, uid } from "./model";
import type { TestResult, AppData } from "./model";
import {
  readBackup,
  LocalStudyRepository,
  storageKey,
} from "../data/repository";

function learning(ranges = [""]) {
  let data = addTasks(
    emptyData(),
    ranges.map((range) => ({
      subjectId: "maths",
      topic: "Percentage",
      title: "Practice recalled material",
      minutes: 30,
      priority: false,
      revision: true,
      range,
      notes: "",
    })),
    "2026-09-30",
  );
  for (const task of data.tasks)
    data = completeTask(data, task.id, "2026-09-30");
  return data;
}
function revised(ranges = [""]) {
  let data = learning(ranges);
  for (const r of data.revisions)
    data = rateRevision(data, r.id, "Good", "2026-10-01");
  return data;
}
const result = (day = "2026-10-08"): TestResult => ({
  id: uid(),
  name: "Weekly external exam",
  day,
  score: 72,
  total: 100,
  notes: "Taken using my practice book",
  topics: [],
});
const save = (data: AppData, day = "2026-10-08") =>
  recordRevisionExam(data, result(day), "2026-12-31");

describe("revision exam checkpoints", () => {
  it("waits for an actual recall, not merely learning completion or a due schedule", () => {
    expect(revisionExamPlan(emptyData(), "2026-10-16").dueOn).toBeUndefined();
    expect(revisionExamPlan(learning(), "2026-10-16").topics).toEqual([]);
  });
  it("defaults to a seven-day interval from the first actual recall", () => {
    const d = revised();
    expect(revisionExamPlan(d, "2026-10-07")).toMatchObject({
      dueOn: "2026-10-08",
      due: false,
      intervalDays: 7,
    });
    expect(revisionExamPlan(d, "2026-10-08").due).toBe(true);
  });
  it("deduplicates topics while retaining all pending recall dates", () => {
    let d = revised();
    d = rateRevision(d, d.revisions[0].id, "Good", "2026-10-03");
    const p = revisionExamPlan(d, "2026-10-16");
    expect(p.topics).toHaveLength(1);
    expect(p.coverage[0].reviewDays).toEqual(["2026-10-01", "2026-10-03"]);
  });
  it("includes weak recalled topics without requiring the three-recall readiness milestone", () => {
    let d = learning();
    d = rateRevision(d, d.revisions[0].id, "Forgot", "2026-10-01");
    expect(d.revisions[0].revisionCount).toBe(0);
    expect(revisionExamPlan(d, "2026-10-08").topics).toHaveLength(1);
  });
  it("ignores future recalls and excludes test evidence from creating its own next exam", () => {
    let d = learning();
    d = rateRevision(d, d.revisions[0].id, "Good", "2026-10-02", "test");
    d = rateRevision(d, d.revisions[0].id, "Good", "2026-10-20");
    expect(revisionExamPlan(d, "2026-10-16").coverage).toEqual([]);
  });
  it("excludes archived subjects and restores the original checkpoint when unarchived", () => {
    const d = revised();
    d.subjects[0].archived = true;
    expect(revisionExamPlan(d, "2026-10-16").coverage).toEqual([]);
    d.subjects[0].archived = false;
    expect(revisionExamPlan(d, "2026-10-16").dueOn).toBe("2026-10-08");
  });
  it("keeps one overdue plan without mutating any data or generating duplicate exams", () => {
    const d = revised(),
      before = structuredClone(d);
    for (const date of ["2026-10-08", "2026-10-16", "2027-04-01"])
      expect(revisionExamPlan(d, date).dueOn).toBe("2026-10-08");
    expect(d).toEqual(before);
    expect(d.tests).toHaveLength(0);
  });
  it("records a completed syllabus only on explicit save; overall-only scores leave revisions untouched", () => {
    const d = revised(),
      out = save(d);
    expect(out.revisions).toEqual(d.revisions);
    expect(out.reviews).toEqual(d.reviews);
    expect(out.tests[0].revisionExam).toMatchObject({
      scheduledFor: "2026-10-08",
      coverage: [{ topicName: "Percentage", reviewDays: ["2026-10-01"] }],
    });
    expect(revisionExamPlan(out, "2026-10-16").coverage).toEqual([]);
    expect(d.tests).toEqual([]);
  });
  it("does not consume the exam syllabus when an unrelated ordinary result is recorded", () => {
    const out = recordTest(revised(), result());
    expect(out.tests[0].revisionExam).toBeUndefined();
    expect(revisionExamPlan(out, "2026-10-16").due).toBe(true);
  });
  it("does not re-enqueue a same-day replacement rating after the exam", () => {
    let d = save(revised(), "2026-10-01");
    d = rateRevision(d, d.revisions[0].id, "Hard", "2026-10-01");
    expect(revisionExamPlan(d, "2026-10-16").coverage).toEqual([]);
  });
  it("starts the next normal checkpoint from the actual exam date, not its missed due date", () => {
    let d = save(revised(), "2026-10-12");
    d = rateRevision(d, d.revisions[0].id, "Good", "2026-10-13");
    expect(revisionExamPlan(d, "2026-10-16")).toMatchObject({
      dueOn: "2026-10-19",
      due: false,
    });
  });
  it("restarts from a new recall after an inactive interval rather than inventing an overdue empty exam", () => {
    let d = save(revised());
    expect(revisionExamPlan(d, "2026-10-29").due).toBe(false);
    d = rateRevision(d, d.revisions[0].id, "Good", "2026-10-29");
    expect(revisionExamPlan(d, "2026-10-29").dueOn).toBe("2026-11-05");
  });
  it("a backdated exam consumes only material revised on or before its actual date", () => {
    let d = revised();
    d = rateRevision(d, d.revisions[0].id, "Good", "2026-10-10");
    d = save(d, "2026-10-08");
    expect(d.tests[0].revisionExam!.coverage[0].reviewDays).toEqual([
      "2026-10-01",
    ]);
    expect(revisionExamPlan(d, "2026-10-16")).toMatchObject({
      dueOn: "2026-10-15",
      coverage: [{ reviewDays: ["2026-10-10"] }],
    });
  });
  it("continues applying only actual topic scores through the existing revision rules", () => {
    const d = revised(),
      test = result();
    test.topics = [{ topicId: d.topics[0].id, score: 49, total: 100 }];
    const out = recordRevisionExam(d, test, "2026-10-08");
    expect(out.revisions[0]).toMatchObject({
      step: 1,
      due: "2026-10-09",
      revisionCount: 0,
    });
    expect(out.reviews.at(-1)?.source).toBe("test");
    expect(revisionExamPlan(out, "2026-10-20").coverage).toEqual([]);
  });
  it("retains separate vocabulary ranges without duplicating the topic or losing coverage", () => {
    const d = revised(["1–50", "51–100"]),
      p = revisionExamPlan(d, "2026-10-08");
    expect(p.topics).toHaveLength(1);
    expect(p.coverage.map((c) => c.range)).toEqual(["1–50", "51–100"]);
    expect(save(d).tests[0].revisionExam!.coverage).toHaveLength(2);
  });
  it("handles repeated saves idempotently and rejects empty/future exam completions", () => {
    const test = result(),
      d = recordRevisionExam(revised(), test, "2026-10-08");
    expect(recordRevisionExam(d, test, "2026-10-08")).toBe(d);
    expect(() => save(d)).toThrow(/No untested/);
    expect(() => save(learning())).toThrow(/No untested/);
    expect(() =>
      recordRevisionExam(revised(), result("2026-10-17"), "2026-10-16"),
    ).toThrow(/future/);
  });
  it("allows explicit early completion while retaining the original scheduled date", () => {
    const d = save(revised(), "2026-10-04");
    expect(d.tests[0].revisionExam!.scheduledFor).toBe("2026-10-08");
    expect(d.tests[0].day).toBe("2026-10-04");
  });
  it("keeps historical syllabus names after renaming and permanent deletion", () => {
    let d = save(revised());
    d.topics[0].name = "Renamed";
    d = deleteSubject(d, "maths");
    expect(() => dataSchema.parse(d)).not.toThrow();
    expect(d.tests[0].revisionExam!.coverage[0].topicName).toBe("Percentage");
    expect(revisionExamPlan(d, "2026-10-16").coverage).toEqual([]);
  });
  it("rejects invalid or fabricated future/duplicate syllabus metadata in backups", () => {
    const test = save(revised()).tests[0];
    test.revisionExam!.coverage[0].reviewDays = ["2026-10-09"];
    expect(() => testSchema.parse(test)).toThrow();
    test.revisionExam!.coverage[0].reviewDays = ["2026-10-01"];
    test.revisionExam!.coverage.push(test.revisionExam!.coverage[0]);
    expect(() => testSchema.parse(test)).toThrow();
    expect(() => revisionExamPlan(revised(), "2026-02-30")).toThrow();
  });
  it("validates interval edits and leaves original revision dates unchanged", () => {
    const d = revised();
    d.preferences.examIntervalDays = 14;
    expect(revisionExamPlan(d, "2026-10-08").dueOn).toBe("2026-10-15");
    expect(d.revisions[0].due).toBe("2026-10-03");
    for (const value of [0, 91, 1.5]) {
      d.preferences.examIntervalDays = value;
      expect(() => dataSchema.parse(d)).toThrow();
    }
  });
  it("loads legacy v1 storage/backups with a default interval and round-trips new completed exams", () => {
    const legacy = JSON.parse(JSON.stringify(revised()));
    delete legacy.preferences.examIntervalDays;
    const raw = JSON.stringify(legacy);
    expect(readBackup(raw).preferences.examIntervalDays).toBe(7);
    const map = new Map([[storageKey(false), raw]]);
    const repo = new LocalStudyRepository({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
    });
    expect(repo.load().status).toBe("ready");
    expect(map.get(storageKey(false))).toBe(raw);
    const completed = save(repo.load().data);
    repo.save(completed);
    expect(repo.load().data).toEqual(completed);
    expect(readBackup(JSON.stringify(completed))).toEqual(completed);
  });
});
