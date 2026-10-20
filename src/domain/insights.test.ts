import { describe, expect, it } from "vitest";
import { addDays } from "./model";
import { seededData as emptyData } from "../data/demo";
import { addTasks, completeTask, recordTest } from "./engine";
import { insights } from "./insights";
const date = "2026-10-15";
function fixture() {
  let data = addTasks(
    emptyData(),
    [
      {
        subjectId: "maths",
        topic: "Percentage",
        title: "Practice questions",
        minutes: 30,
        priority: false,
        revision: true,
        range: "",
        notes: "",
      },
    ],
    date,
  );
  data = completeTask(data, data.tasks[0].id, date);
  return data;
}
describe("read-only analytics signals", () => {
  it("shows an absent average rather than invented progress", () => {
    const r = insights(emptyData(), date, "30");
    expect(r.average).toBeNull();
    expect(r.studyDays).toBe(0);
    expect(r.ratings.every((r) => r.count === 0)).toBe(true);
    expect(r.activity).toHaveLength(84);
  });
  it("uses inclusive calendar windows and excludes future records", () => {
    const data = fixture();
    data.tasks.push(
      { ...data.tasks[0], id: "old", completedOn: addDays(date, -30) },
      { ...data.tasks[0], id: "boundary", completedOn: addDays(date, -29) },
      { ...data.tasks[0], id: "future", completedOn: addDays(date, 1) },
    );
    expect(insights(data, date, "30").completed.map((t) => t.id)).toEqual([
      data.tasks[0].id,
      "boundary",
    ]);
    expect(insights(data, date, "all").completed).toHaveLength(3);
  });
  it("separates actual recalls from test-derived ratings", () => {
    const data = fixture(),
      r = data.revisions[0];
    data.reviews.push(
      {
        id: "recall",
        revisionId: r.id,
        topicId: r.topicId,
        day: date,
        rating: "Good",
        source: "recall",
        stepBefore: 1,
        countBefore: 0,
        stepAfter: 2,
      },
      {
        id: "test-rating",
        revisionId: r.id,
        topicId: r.topicId,
        day: date,
        rating: "Easy",
        source: "test",
        stepBefore: 2,
        countBefore: 1,
        stepAfter: 4,
      },
    );
    const report = insights(data, date, "7");
    expect(report.recalls).toHaveLength(1);
    expect(report.ratings.find((r) => r.rating === "Good")?.count).toBe(1);
    expect(report.ratings.find((r) => r.rating === "Easy")?.count).toBe(0);
    expect(report.studyDays).toBe(1);
  });
  it("averages real topic percentages without inferring them from overall scores", () => {
    const data = fixture();
    data.tests.push(
      {
        id: "test",
        name: "External mock",
        day: date,
        score: 80,
        total: 100,
        notes: "",
        topics: [
          { topicId: data.topics[0].id, score: 90, total: 100 },
          { topicId: "other", score: 1, total: 2 },
        ],
      },
      {
        id: "overall",
        name: "Overall only",
        day: date,
        score: 100,
        total: 100,
        notes: "",
        topics: [],
      },
    );
    expect(insights(data, date, "30").average).toBe(70);
    expect(insights(data, date, "30").scores).toHaveLength(2);
  });
  it("shows estimates from planned and completion dates, never tracked time", () => {
    const data = fixture();
    data.tasks[0].plannedOn = addDays(date, -1);
    const report = insights(data, date, "7");
    expect(report.week.find((d) => d.day === date)?.done).toBe(30);
    expect(report.week.find((d) => d.day === date)?.scheduled).toBe(0);
    expect(
      report.week.find((d) => d.day === addDays(date, -1))?.scheduled,
    ).toBe(30);
  });
  it("does not count topic test events twice in the heatmap", () => {
    const data = fixture(),
      r = data.revisions[0];
    data.reviews.push({
      id: "test-rating",
      revisionId: r.id,
      topicId: r.topicId,
      day: date,
      rating: "Easy",
      source: "test",
      stepBefore: 1,
      countBefore: 0,
      stepAfter: 3,
    });
    data.tests.push({
      id: "test",
      name: "Mock",
      day: date,
      score: 90,
      total: 100,
      notes: "",
      topics: [{ topicId: r.topicId, score: 90, total: 100 }],
    });
    expect(insights(data, date, "30").activity.at(-1)?.count).toBe(2);
  });
  it("counts historical external tests even when they cannot rewind newer schedules", () => {
    let data = fixture();
    const day = addDays(date, -2);
    data = recordTest(data, {
      id: "historical-test",
      name: "Earlier mock",
      day,
      score: 80,
      total: 100,
      notes: "",
      topics: [{ topicId: data.topics[0].id, score: 80, total: 100 }],
    });
    expect(data.reviews).toHaveLength(0);
    expect(
      insights(data, date, "7").activity.find((d) => d.day === day)?.count,
    ).toBe(1);
  });
  it("keeps archived evidence in history and never mutates the data", () => {
    const data = fixture();
    data.subjects[0].archived = true;
    const before = JSON.stringify(data);
    expect(insights(data, date, "all").completed).toHaveLength(1);
    expect(JSON.stringify(data)).toBe(before);
  });
});
