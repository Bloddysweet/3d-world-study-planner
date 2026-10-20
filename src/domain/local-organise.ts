// Local paste organiser: applies parsed proposals to a workspace, creating
// subjects that the paste's uppercase headings introduced (the only case where
// new subjects are invented — mixed-case unknown headings never create).
import { addTasks } from "./engine";
import { normalize, themes, uid } from "./model";
import type { AppData, Subject, Theme } from "./model";
import { parseTargets } from "./parser";
import type { Proposal } from "./parser";

export { parseTargets };
export type { Proposal };

const palette = ["#5576ce", "#9672c5", "#c89b49", "#4c9a95", "#6d9b61", "#cb8268"];

function subjectId(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function applyProposals(
  data: AppData,
  proposals: Proposal[],
  date: string,
): AppData {
  let next = data;
  const known = new Set(next.subjects.map((a) => a.id));
  const drafts = [];
  let shade = next.subjects.length;
  for (const proposal of proposals) {
    const { subjectName, warning, ...draft } = proposal;
    if (subjectName) {
      const existing = next.subjects.find(
        (a) =>
          a.id === draft.subjectId ||
          normalize(a.name) === normalize(subjectName),
      );
      if (existing) {
        draft.subjectId = existing.id;
      } else {
        const theme = (themes as readonly string[]).includes(draft.subjectId)
          ? (draft.subjectId as Theme)
          : "generic";
        const subject: Subject = {
          id: draft.subjectId || subjectId(subjectName) || uid(),
          name: subjectName,
          color: palette[shade++ % palette.length],
          theme,
          archived: false,
        };
        if (known.has(subject.id)) subject.id = uid();
        known.add(subject.id);
        draft.subjectId = subject.id;
        next = { ...next, subjects: [...next.subjects, subject] };
      }
    }
    drafts.push({ ...draft, topic: draft.topic.trim() || "General" });
  }
  return addTasks(next, drafts, date);
}
