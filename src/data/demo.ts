import { addDays, emptyData } from "../domain/model";
import type { AppData } from "../domain/model";
import {
  addTasks,
  completeTask,
  rateRevision,
  recordTest,
} from "../domain/engine";
export function demoData(date: string): AppData {
  let s = emptyData();
  const topics: [string, string][] = [
    ["maths", "Percentage"],
    ["maths", "Time & Work"],
    ["maths", "Simple Interest"],
    ["maths", "Ratio & Proportion"],
    ["reasoning", "Coding-Decoding"],
    ["reasoning", "Number Series"],
    ["english", "Vocabulary"],
    ["gk", "Indian Polity"],
    ["dsa", "Arrays & Hashing"],
    ["software", "Java Collections"],
  ];
  for (const [subjectId, topic] of topics) {
    s = addTasks(
      s,
      [
        {
          subjectId,
          topic,
          title: `Study ${topic}`,
          minutes: 30,
          priority: false,
          revision: true,
          range: topic === "Vocabulary" ? "1-50" : "",
          notes: "",
        },
      ],
      addDays(date, -20),
    );
    s = completeTask(s, s.tasks.at(-1)!.id, addDays(date, -20));
  }
  for (const topic of s.topics.filter((t) =>
    [
      "Simple Interest",
      "Coding-Decoding",
      "Vocabulary",
      "Time & Work",
    ].includes(t.name),
  )) {
    const r = s.revisions.find((r) => r.topicId === topic.id)!;
    for (const n of [-19, -17, -13])
      s = rateRevision(s, r.id, "Good", addDays(date, n));
  }
  const strong = s.topics.find((t) => t.name === "Time & Work")!,
    weak = s.topics.find((t) => t.name === "Ratio & Proportion")!;
  s = recordTest(s, {
    id: "demo-test",
    name: "Practice mock #13",
    day: addDays(date, -2),
    score: 146,
    total: 200,
    minutes: 60,
    notes: "Sample results only. Your personal workspace is separate.",
    topics: [
      { topicId: strong.id, score: 9, total: 10 },
      { topicId: weak.id, score: 9, total: 20 },
    ],
  });
  s = addTasks(
    s,
    [
      {
        subjectId: "maths",
        topic: "Percentage",
        title: "Solve 30 Percentage questions",
        minutes: 50,
        priority: true,
        revision: true,
        range: "",
        notes: "Try without looking at the solution first.",
      },
    ],
    addDays(date, -1),
  );
  s = addTasks(
    s,
    [
      {
        subjectId: "dsa",
        topic: "Arrays & Hashing",
        title: "Practice two hash map problems",
        minutes: 45,
        priority: false,
        revision: true,
        range: "",
        notes: "",
      },
      {
        subjectId: "software",
        topic: "Java Collections",
        title: "Explore Java Collections",
        minutes: 40,
        priority: false,
        revision: false,
        range: "",
        notes: "",
      },
    ],
    date,
  );
  return s;
}
