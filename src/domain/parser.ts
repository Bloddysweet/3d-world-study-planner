import { normalize } from "./model";
import type { AppData } from "./model";
import type { TaskDraft } from "./engine";
export type Proposal = TaskDraft & { warning: string; subjectName?: string };
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
const upperHead = (value: string) =>
  value === value.toUpperCase() && /[A-Z]/.test(value);
const bareHead = (value: string) =>
  value.length >= 2 && value.length <= 40 && !/[\d|:]/.test(value);
const linkOnly = (line: string) =>
  /^(\[https?:\/\/[^\]]+\]\([^)]+\)|https?:\/\/\S+)$/i.test(line) ||
  (/^(?:download|link|video|resource|drive|file)\s*[:—-]\s*\S+$/i.test(line) &&
    /https?:\/\//i.test(line));
const urlsOf = (line: string) => line.match(/https?:\/\/[^\s|\])]+/g) ?? [];

type Block = {
  lead: string;
  children: string[];
  resources: string[];
  orJoin: boolean;
};

export function parseTargets(text: string, s: AppData): Proposal[] {
  const active = s.subjects.filter((a) => !a.archived);
  const matchSubject = (value: string) =>
    active.find(
      (a) =>
        normalize(a.name) === normalize(value) ||
        (a.id in aliases && aliases[a.id].includes(normalize(value))),
    );

  // ---- pass 1: group lines into lead + indented children blocks ---------
  const blocks: Block[] = [];
  let pendingOr = false;
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw
      .trim()
      .replace(/^[-*•]\s+/, "")
      .replace(/^\d+[.)]\s+/, "");
    if (!trimmed) continue;
    if (/^note\b/i.test(trimmed)) continue;
    if (linkOnly(trimmed)) {
      const urls = urlsOf(trimmed);
      if (urls.length && blocks.length)
        blocks[blocks.length - 1].resources.push(...urls);
      continue;
    }
    if (/^or$/i.test(trimmed)) {
      pendingOr = true;
      continue;
    }
    const child = /^\s/.test(raw) && blocks.length > 0;
    if (child) {
      if (pendingOr) {
        blocks[blocks.length - 1].orJoin = true;
        pendingOr = false;
      }
      blocks[blocks.length - 1].children.push(trimmed);
      continue;
    }
    blocks.push({
      lead: trimmed,
      children: [],
      resources: [],
      orJoin: pendingOr,
    });
    pendingOr = false;
  }

  // ---- pass 2: headings, parents-as-topics, OR joins, tasks ------------
  const result: Proposal[] = [];
  let subjectId = "",
    subjectName = "";

  const make = (line: string, forcedTopic?: string): Proposal => {
    let work = line;
    const priority = /^!|\[priority\]|\bhigh priority\b/i.test(work);
    work = work.replace(/^!\s*|\[priority\]\s*/gi, "");
    const duration = work.match(
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
    const pieces = work.split("|").map((a) => a.trim());
    let topic = forcedTopic ?? "",
      title = work;
    if (pieces.length >= 2) {
      topic = pieces[0];
      title = pieces[1];
    } else if (work.includes(":") && !/^https?:/i.test(work)) {
      const index = work.indexOf(":");
      topic = work.slice(0, index).trim();
      title = work.slice(index + 1).trim();
    } else if (!topic && subjectId) {
      const found = s.topics.find(
        (t) =>
          t.subjectId === subjectId &&
          normalize(work).includes(normalize(t.name)),
      );
      topic = found?.name ?? "";
    }
    const range = work.match(
      /\b(?:vocab(?:ulary)?|words)\s*(\d+)\s*[-–]\s*(\d+)/i,
    );
    const urls = urlsOf(work);
    return {
      subjectId,
      subjectName: subjectName || undefined,
      topic,
      title: title || work,
      minutes,
      priority,
      revision: !/\[no revision\]/i.test(work),
      range: range ? `${range[1]}-${range[2]}` : "",
      notes: urls.length ? "Resources: " + urls.join("\n") : "",
      warning: !subjectId
        ? "Choose a subject — this line was not matched."
        : !topic
          ? "Give this task a topic before saving."
          : duration
            ? ""
            : "30-minute estimate: adjust if needed.",
    };
  };

  for (const block of blocks) {
    const header = block.lead.match(/^(.{1,100}):\s*$/);
    const isHeading =
      !!header ||
      (bareHead(block.lead) && (matchSubject(block.lead) || upperHead(block.lead)));
    if (isHeading) {
      const name = (header ? header[1] : block.lead).trim();
      const matched = matchSubject(name);
      if (matched) {
        subjectId = matched.id;
        subjectName = "";
      } else if (upperHead(name)) {
        subjectName = name;
        subjectId =
          name
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "subject";
      } else {
        subjectId = "";
        subjectName = "";
      }
      for (const child of block.children) {
        const proposal = make(child);
        if (block.resources.length && !proposal.notes)
          proposal.notes = "Resources: " + block.resources.join("\n");
        result.push(proposal);
      }
      continue;
    }
    if (block.orJoin && result.length) {
      const last = result[result.length - 1];
      last.title = `${last.title} OR ${block.lead}`;
      if (block.resources.length)
        last.notes = [last.notes, "Resources: " + block.resources.join("\n")]
          .filter(Boolean)
          .join("\n");
      continue;
    }
    if (block.children.length) {
      block.children.forEach((child, i) => {
        const proposal = make(child, block.lead);
        if (
          block.resources.length &&
          i === block.children.length - 1 &&
          !proposal.notes
        )
          proposal.notes = "Resources: " + block.resources.join("\n");
        result.push(proposal);
      });
      continue;
    }
    const proposal = make(block.lead);
    if (block.resources.length && !proposal.notes)
      proposal.notes = "Resources: " + block.resources.join("\n");
    result.push(proposal);
  }
  return result;
}
