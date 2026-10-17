import { normalize } from "./model";
import type { AppData } from "./model";
import type { TaskDraft } from "./engine";
export type Proposal = TaskDraft & { warning: string };
const aliases: Record<string, string[]> = {
  maths: ["maths", "mathematics", "ssc maths", "math"],
  reasoning: ["reasoning", "ssc reasoning"],
  english: [
    "english",
    "vocabulary",
    "english and vocabulary",
    "english & vocabulary",
  ],
  gk: ["gk", "gs", "gk & gs", "general studies", "gk and general studies"],
  dsa: ["dsa", "data structures", "algorithms"],
  software: ["software", "software development", "development", "programming"],
};
export function parseTargets(text: string, s: AppData): Proposal[] {
  let subjectId = "";
  const result: Proposal[] = [],
    active = s.subjects.filter((a) => !a.archived);
  const matchSubject = (value: string) =>
    active.find(
      (a) =>
        normalize(a.name) === normalize(value) ||
        (a.id in aliases && aliases[a.id].includes(normalize(value))),
    );
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(/^[-*•]\s+|^\d+[.)]\s+/, "");
    if (!line) continue;
    const header = line.match(/^(.{1,100}):\s*$/);
    if (header) {
      subjectId = matchSubject(header[1])?.id ?? "";
      continue;
    }
    const prefix = line.match(/^([^:|]+):\s*(.+)$/);
    if (prefix && matchSubject(prefix[1])) {
      subjectId = matchSubject(prefix[1])!.id;
      line = prefix[2];
    }
    const priority = /^!|\[priority\]|\bhigh priority\b/i.test(line);
    line = line.replace(/^!\s*|\[priority\]\s*/gi, "");
    const duration = line.match(
      /\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i,
    );
    const minutes = duration
      ? Math.max(
          1,
          Math.min(
            1440,
            Math.round(
              Number(duration[1]) * (/^h/i.test(duration[2]) ? 60 : 1),
            ),
          ),
        )
      : 30;
    const pieces = line.split("|").map((a) => a.trim());
    let topic = "",
      title = line;
    if (pieces.length >= 2) {
      topic = pieces[0];
      title = pieces[1];
    } else if (line.includes(":") && !/^https?:/i.test(line)) {
      const index = line.indexOf(":");
      topic = line.slice(0, index).trim();
      title = line.slice(index + 1).trim();
    } else {
      const found = s.topics.find(
        (t) =>
          t.subjectId === subjectId &&
          normalize(line).includes(normalize(t.name)),
      );
      topic = found?.name ?? "";
    }
    const range = line.match(
      /\b(?:vocab(?:ulary)?|words)\s*(\d+)\s*[-–]\s*(\d+)/i,
    );
    const urls = line.match(/https?:\/\/[^\s|]+/g) ?? [];
    result.push({
      subjectId,
      topic,
      title: title || line,
      minutes,
      priority,
      revision: !/\[no revision\]/i.test(line),
      range: range ? `${range[1]}-${range[2]}` : "",
      notes: urls.length ? "Resources: " + urls.join("\n") : "",
      warning: !subjectId
        ? "Choose a subject — this line was not matched."
        : !topic
          ? "Give this task a topic before saving."
          : duration
            ? ""
            : "30-minute estimate: adjust if needed.",
    });
  }
  return result;
}
