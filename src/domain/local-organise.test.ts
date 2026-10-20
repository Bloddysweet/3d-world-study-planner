import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { applyProposals, parseTargets } from "./local-organise";
import { samplePaste } from "../../tests/fixtures/study-targets";

describe("local paste organiser", () => {
  it("turns the sample paste into exactly 10 tasks and 3 subjects in an empty workspace", () => {
    const proposals = parseTargets(samplePaste, emptyData());
    expect(proposals).toHaveLength(10);
    const data = applyProposals(emptyData(), proposals, "2026-10-20");
    expect(data.tasks).toHaveLength(10);
    expect(data.subjects.map((a) => a.name).sort()).toEqual([
      "ENGLISH",
      "MATHS",
      "REASONING",
    ]);
  });

  it("consumes uppercase bare lines as headings that propose subjects", () => {
    const p = parseTargets("MATHS\nSquares 1-30", emptyData());
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ subjectName: "MATHS", title: "Squares 1-30" });
  });

  it("keeps ordinary mixed-case lines as tasks, not headings", () => {
    const p = parseTargets("read a book", emptyData());
    expect(p).toHaveLength(1);
    expect(p[0].subjectName).toBeUndefined();
    expect(p[0].warning).toContain("subject");
  });

  it("joins an OR pair into one choose-one target", () => {
    const p = parseTargets(
      "ENGLISH\nNimisha Editorial\nOR\nReading Comprehension",
      emptyData(),
    );
    expect(p).toHaveLength(1);
    expect(p[0].title).toBe(
      "Nimisha Editorial OR Reading Comprehension",
    );
  });

  it("treats standalone links and NOTE lines as resources, not tasks", () => {
    const p = parseTargets(
      "MATHS\nTask one\n\nhttps://example.com/a\n\nNOTE- books are optional\n\nDownload : https://example.com/b",
      emptyData(),
    );
    expect(p).toHaveLength(1);
    expect(p[0].notes).toContain("https://example.com/a");
    expect(p[0].notes).toContain("https://example.com/b");
  });

  it("uses an indented block's parent line as the topic for its children", () => {
    const p = parseTargets(
      "MATHS\nLearn Day- 1/5\n   Squares 1-30\n   Cubes 1-15",
      emptyData(),
    );
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ topic: "Learn Day- 1/5", title: "Squares 1-30" });
    expect(p[1]).toMatchObject({ topic: "Learn Day- 1/5", title: "Cubes 1-15" });
  });
});
