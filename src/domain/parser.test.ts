import { describe, expect, it } from "vitest";
import { seededData as emptyData } from "../data/demo";
import { parseTargets } from "./parser";
describe("local target proposals", () => {
  it("reads subject headings, explicit topic/task/duration and priority", () => {
    const s = emptyData();
    const p = parseTargets(
      "Maths:\n! Percentage | Solve 30 questions | 50 min\nDSA:\nArrays | Practice hashing | 1.5 hours",
      s,
    );
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({
      subjectId: "maths",
      topic: "Percentage",
      title: "Solve 30 questions",
      minutes: 50,
      priority: true,
    });
    expect(p[1]).toMatchObject({ subjectId: "dsa", minutes: 90 });
    expect(s.tasks).toHaveLength(0);
  });
  it("never invents missing subjects or topics", () => {
    const p = parseTargets(
      "Unknown subject:\nRead chapter 2\nEnglish:\nRead a book",
      emptyData(),
    );
    expect(p[0]).toMatchObject({ subjectId: "", topic: "" });
    expect(p[1]).toMatchObject({ subjectId: "english", topic: "" });
    expect(p.every((a) => a.warning.length > 0)).toBe(true);
  });
  it("supports custom dynamic subjects, vocabulary ranges, links and opt-out", () => {
    const s = emptyData();
    s.subjects.push({
      id: "physics",
      name: "Physics",
      theme: "generic",
      color: "#334455",
      archived: false,
    });
    const p = parseTargets(
      "Physics:\nMechanics | Solve motion questions | 30 min\nEnglish:\nVocabulary | Learn words 101–150 https://example.com/words [no revision] | 20 min",
      s,
    );
    expect(p[0].subjectId).toBe("physics");
    expect(p[1]).toMatchObject({ range: "101-150", revision: false });
    expect(p[1].notes).toContain("https://example.com/words");
  });
  it("keeps ambiguous lines editable, warns on estimates and ignores blank lines", () => {
    const p = parseTargets(
      "\nMaths:\nPercentage: Solve 20 problems\n\n",
      emptyData(),
    );
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ topic: "Percentage", minutes: 30 });
    expect(p[0].warning).toContain("estimate");
  });
  it("excludes archived subjects from automatic matching", () => {
    const s = emptyData();
    s.subjects[0].archived = true;
    expect(
      parseTargets("Maths:\nPercentage | Solve questions | 20 min", s)[0]
        .subjectId,
    ).toBe("");
  });
});
