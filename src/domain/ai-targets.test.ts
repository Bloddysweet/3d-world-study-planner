import { describe, it, expect } from "vitest";
import { seededData as emptyData } from "../data/demo";
import {
  catalogueFor,
  validateAiPlan,
  reviewTasks,
  chooseAlternative,
  commitAiTargets,
  duplicateKeys,
} from "./ai-targets";
import { expectedPlan, samplePaste } from "../../tests/fixtures/study-targets";
const request = () => ({
  text: samplePaste,
  catalogue: catalogueFor(emptyData()),
});
const copy = () => structuredClone(expectedPlan);
const ready = () =>
  reviewTasks(copy()).map((r) =>
    r.alternatives.length
      ? { ...chooseAlternative(r, 1), minutes: 30 }
      : { ...r, minutes: 30 },
  );
const options = {
  reviewed: true,
  allowNewSubjects: false,
  allowDuplicates: false,
};
describe("AI target proposals and safe confirmation", () => {
  it("preserves the user example as ten targets, not resources/headings or two OR tasks", () => {
    const p = validateAiPlan(copy(), request());
    expect(p.tasks).toHaveLength(10);
    expect(p.tasks[0]).toMatchObject({
      quantity: "10 questions",
      difficulty: "Expert",
      minutes: null,
    });
    expect(p.tasks[2]).toMatchObject({
      minutes: null,
      coverage: "Foundation Phase — first 3 hours of video",
    });
    expect(p.tasks.slice(3, 6).map((t) => t.range)).toEqual([
      "1-30",
      "1-15",
      "1-25",
    ]);
    expect(p.tasks[8].range).toBe("1-50");
    expect(p.tasks[9].alternatives).toHaveLength(2);
    expect(p.sharedResources[0].url).toContain(
      "https://resources.example/shared-pdf-group",
    );
  });
  it("rejects invented study estimates from practice quantities and video coverage", () => {
    const p = copy();
    p.tasks[0].minutes = 10;
    expect(() => validateAiPlan(p, request())).toThrow(/study-time/);
    const q = copy();
    q.tasks[2].minutes = 180;
    expect(() => validateAiPlan(q, request())).toThrow(/study-time/);
    const r = copy();
    r.tasks[0].source += " 45 min";
    r.tasks[0].minutes = 45;
    expect(
      validateAiPlan(r, {
        ...request(),
        text: samplePaste + "\n" + r.tasks[0].source,
      }).tasks[0].minutes,
    ).toBe(45);
  });
  it("rejects invented and executable URLs and invented evidence", () => {
    const p = copy();
    p.tasks[0].resources[0].url = "https://invented.example/book";
    expect(() => validateAiPlan(p, request())).toThrow();
    p.tasks[0].resources[0].url = "javascript:alert(1)";
    expect(() => validateAiPlan(p, request())).toThrow();
    const x = copy();
    x.tasks[0].source = "Not in the original paste";
    expect(() => validateAiPlan(x, request())).toThrow(/excerpt/);
  });
  it("rejects cross-subject and fabricated IDs", () => {
    const p = copy();
    p.tasks[0].subjectId = "invented";
    expect(() => validateAiPlan(p, request())).toThrow(/subject/);
    const s = emptyData();
    s.topics.push({
      id: "english-only",
      subjectId: "english",
      name: "Multiplication",
      group: "",
    });
    const q = copy();
    q.tasks[0].topicId = "english-only";
    expect(() =>
      validateAiPlan(q, { text: samplePaste, catalogue: catalogueFor(s) }),
    ).toThrow(/another subject/);
  });
  it("requires complete strict output and refuses generated schedules/test records", () => {
    expect(() => validateAiPlan({ ...copy(), tests: [] }, request())).toThrow();
    const p = copy();
    (p.tasks[0] as unknown as Record<string, unknown>).completedOn =
      "2026-10-17";
    expect(() => validateAiPlan(p, request())).toThrow();
  });
  it("does not persist proposals, guess times or choose OR alternatives", () => {
    const s = emptyData(),
      before = JSON.stringify(s),
      r = reviewTasks(validateAiPlan(copy(), request()));
    expect(r.every((t) => t.minutes === null)).toBe(true);
    expect(r[9].selectedAlternative).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
    expect(() =>
      commitAiTargets(s, r, copy(), "2026-10-17", options),
    ).toThrow();
  });
  it("commits once after explicit review/choice and estimates; retains resource ownership and quantities", () => {
    const s = emptyData(),
      before = JSON.stringify(s),
      result = commitAiTargets(s, ready(), copy(), "2026-10-17", options);
    expect(JSON.stringify(s)).toBe(before);
    expect(result.tasks).toHaveLength(10);
    expect(result.revisions).toHaveLength(0);
    expect(result.tests).toHaveLength(0);
    expect(result.tasks.every((t) => !t.completedOn)).toBe(true);
    expect(result.tasks[0].notes).toContain("10 questions");
    expect(result.tasks[0].notes).toContain("Expert");
    expect(result.tasks[2].notes).toContain(
      "resources.example/maths-foundation-video",
    );
    expect(result.tasks[6].notes).toContain(
      "resources.example/reasoning-folder",
    );
    expect(result.tasks[8].notes).toContain(
      "resources.example/english-ows-video",
    );
    expect(result.tasks[9].title).toBe("Practise reading comprehension");
    expect(result.tasks[9].notes).toContain("English Madhyam");
    expect(result.tasks[9].notes).not.toContain("- Nimisha");
    expect(
      result.tasks.every((t) => t.notes.includes("Shared resources")),
    ).toBe(true);
  });
  it("requires explicit acknowledgement, valid estimates and resolved choices", () => {
    const r = ready();
    expect(() =>
      commitAiTargets(emptyData(), r, copy(), "2026-10-17", {
        ...options,
        reviewed: false,
      }),
    ).toThrow();
    r[9].selectedAlternative = null;
    expect(() =>
      commitAiTargets(emptyData(), r, copy(), "2026-10-17", options),
    ).toThrow(/alternative/);
    r[9].selectedAlternative = 1;
    r[0].minutes = 0;
    expect(() =>
      commitAiTargets(emptyData(), r, copy(), "2026-10-17", options),
    ).toThrow();
  });
  it("requires permission for new subjects, creates them atomically and reuses new names", () => {
    const r = ready()
      .slice(0, 2)
      .map((t) => ({
        ...t,
        subjectId: null,
        subjectName: "My new subject",
        group: "Practice",
      }));
    const s = emptyData();
    expect(() => commitAiTargets(s, r, copy(), "2026-10-17", options)).toThrow(
      /Approve/,
    );
    expect(s.tasks).toHaveLength(0);
    expect(s.subjects).toHaveLength(6);
    const result = commitAiTargets(s, r, copy(), "2026-10-17", {
      ...options,
      allowNewSubjects: true,
    });
    expect(result.subjects).toHaveLength(7);
    expect(result.tasks).toHaveLength(2);
    expect(result.topics.every((t) => t.group === "Practice")).toBe(true);
  });
  it("reuses existing topics and does not overwrite their group", () => {
    const s = emptyData();
    s.topics.push({
      id: "existing",
      subjectId: "maths",
      name: "Multiplication",
      group: "Existing group",
    });
    const r = ready().slice(0, 1);
    r[0].group = "Different inferred group";
    const n = commitAiTargets(s, r, copy(), "2026-10-17", options);
    expect(n.topics).toHaveLength(1);
    expect(n.topics[0].group).toBe("Existing group");
    expect(n.tasks[0].topicId).toBe("existing");
  });
  it("flags within-plan and existing unfinished duplicates and prevents silent double-save", () => {
    const r = ready(),
      first = commitAiTargets(emptyData(), r, copy(), "2026-10-17", options);
    expect(duplicateKeys(first, r).size).toBe(10);
    expect(() =>
      commitAiTargets(first, r, copy(), "2026-10-17", options),
    ).toThrow(/duplicate/);
    expect(
      commitAiTargets(first, r, copy(), "2026-10-17", {
        ...options,
        allowDuplicates: true,
      }).tasks,
    ).toHaveLength(20);
    const duplicate = { ...r[0], key: "duplicate" };
    expect(duplicateKeys(emptyData(), [r[0], duplicate]).has("duplicate")).toBe(
      true,
    );
  });
  it("detects stale subject/topic assignments at save time without partial writes", () => {
    const s = emptyData(),
      r = ready();
    s.subjects[0].archived = true;
    expect(() => commitAiTargets(s, r, copy(), "2026-10-17", options)).toThrow(
      /no longer/,
    );
    expect(s.tasks).toHaveLength(0);
  });
  it("sends only active subject/topic metadata, not history, tasks, scores or secrets", () => {
    const s = emptyData();
    s.subjects[1].archived = true;
    const c = catalogueFor(s);
    expect(c.subjects.some((x) => x.id === "reasoning")).toBe(false);
    expect(Object.keys(c)).toEqual(["subjects", "topics"]);
    expect(Object.keys(c.subjects[0])).toEqual(["id", "name", "theme"]);
  });
});

describe("duration evidence regression", () => {
  it("allows a separate actual study estimate alongside video coverage", () => {
    const p = copy();
    p.tasks[2].source = "Watch first 3 hours of video — study estimate 45 min";
    p.tasks[2].minutes = 45;
    const r = { ...request(), text: request().text + "\n" + p.tasks[2].source };
    expect(validateAiPlan(p, r).tasks[2].minutes).toBe(45);
    p.tasks[2].minutes = 180;
    expect(() => validateAiPlan(p, r)).toThrow(/study-time/);
  });
  it("does not treat abbreviated or video-first coverage as study time", () => {
    for (const source of ["Watch first 3h video", "Video: first 3 hours"]) {
      const p = copy();
      p.tasks[2].source = source;
      p.tasks[2].minutes = 180;
      expect(() =>
        validateAiPlan(p, { ...request(), text: samplePaste + "\n" + source }),
      ).toThrow(/study-time/);
    }
  });
});
