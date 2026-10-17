import { z } from "zod";
import { addTasks, clone, ensureTopic } from "./engine";
import { dataSchema, normalize, uid } from "./model";
import type { AppData } from "./model";

const name = z.string().trim().min(1).max(500);
const evidence = z.string().trim().min(1).max(6000);
const resourceSchema = z
  .object({ name, url: z.string().max(2000).nullable(), source: evidence })
  .strict();
const alternativeSchema = z
  .object({
    title: name,
    resources: z.array(resourceSchema).max(20),
    source: evidence,
  })
  .strict();
export const aiTaskSchema = z
  .object({
    subjectId: z.string().max(150).nullable(),
    subjectName: name,
    topicId: z.string().max(150).nullable(),
    topicName: name,
    group: z.string().max(100),
    title: name,
    minutes: z.number().int().min(1).max(1440).nullable(),
    quantity: z.string().max(200),
    difficulty: z.string().max(200),
    range: z.string().max(100),
    coverage: z.string().max(1000),
    priority: z.boolean(),
    revision: z.boolean().nullable(),
    resources: z.array(resourceSchema).max(20),
    alternatives: z.array(alternativeSchema).max(6),
    source: evidence,
    warnings: z.array(z.string().max(1000)).max(10),
  })
  .strict();
export const aiPlanSchema = z
  .object({
    tasks: z.array(aiTaskSchema).min(1).max(100),
    sharedResources: z.array(resourceSchema).max(30),
    sharedNotes: z
      .array(
        z.object({ text: z.string().max(2000), source: evidence }).strict(),
      )
      .max(20),
    questions: z.array(z.string().max(1000)).max(20),
  })
  .strict();
export const catalogueSchema = z
  .object({
    subjects: z
      .array(
        z
          .object({ id: z.string().max(150), name, theme: z.string().max(30) })
          .strict(),
      )
      .max(1000),
    topics: z
      .array(
        z
          .object({
            id: z.string().max(150),
            subjectId: z.string().max(150),
            name,
            group: z.string().max(100),
          })
          .strict(),
      )
      .max(20000),
  })
  .strict();
export const aiRequestSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(20000)
      .refine((s) => s.trim().length > 0),
    catalogue: catalogueSchema,
  })
  .strict();
export type AiPlan = z.infer<typeof aiPlanSchema>;
export type AiTask = z.infer<typeof aiTaskSchema>;
export type Catalogue = z.infer<typeof catalogueSchema>;
export type AiRequest = z.infer<typeof aiRequestSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export interface ReviewTask extends AiTask {
  key: string;
  selectedAlternative: number | null;
  notes: string;
  revision: boolean;
}
const compact = (s: string) => s.replace(/\s+/g, " ").trim();
export function validateAiPlan(value: unknown, request: AiRequest): AiPlan {
  const plan = aiPlanSchema.parse(value),
    text = compact(request.text);
  const quoted = (s: string) => {
    if (!text.includes(compact(s)))
      throw Error("A source excerpt was not found in your paste.");
  };
  const resource = (r: Resource) => {
    quoted(r.source);
    if (r.url !== null) {
      let u: URL;
      try {
        u = new URL(r.url);
      } catch {
        throw Error("Invalid resource URL.");
      }
      if (
        !["https:", "http:"].includes(u.protocol) ||
        !request.text.includes(r.url) ||
        !r.source.includes(r.url)
      )
        throw Error("A resource URL was not supplied in its source excerpt.");
    }
  };
  for (const t of plan.tasks) {
    quoted(t.source);
    if (t.minutes !== null) {
      const units = [
        ...t.source.matchAll(
          /\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi,
        ),
      ];
      const coverageSpans = [
        ...t.source.matchAll(
          /\b(?:(?:first|1st|initial)\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\s*(?:of\s+)?(?:the\s+)?video|video\s*[:–—-]?\s*(?:first|1st|initial)\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b)/gi,
        ),
      ];
      const explicit = units.some(
        (m) =>
          Math.round(Number(m[1]) * (/^h/i.test(m[2]) ? 60 : 1)) ===
            t.minutes &&
          !coverageSpans.some(
            (c) => m.index >= c.index && m.index < c.index + c[0].length,
          ),
      );
      if (!explicit)
        throw Error(
          "A study-time estimate was not explicitly supplied for this target.",
        );
    }
    if (t.subjectId !== null) {
      const s = request.catalogue.subjects.find((s) => s.id === t.subjectId);
      if (!s || normalize(s.name) !== normalize(t.subjectName))
        throw Error("Unknown or mismatched subject reference.");
    }
    if (t.topicId !== null) {
      const topic = request.catalogue.topics.find((p) => p.id === t.topicId);
      if (
        !topic ||
        !t.subjectId ||
        topic.subjectId !== t.subjectId ||
        normalize(topic.name) !== normalize(t.topicName)
      )
        throw Error("Topic belongs to another subject or was not supplied.");
    }
    t.resources.forEach(resource);
    for (const a of t.alternatives) {
      quoted(a.source);
      a.resources.forEach(resource);
    }
    if (t.alternatives.length === 1)
      throw Error("A choice needs at least two alternatives.");
  }
  plan.sharedResources.forEach(resource);
  plan.sharedNotes.forEach((n) => quoted(n.source));
  return plan;
}
export function catalogueFor(data: AppData): Catalogue {
  const subjects = data.subjects
      .filter((s) => !s.archived)
      .map(({ id, name, theme }) => ({ id, name, theme })),
    ids = new Set(subjects.map((s) => s.id));
  return {
    subjects,
    topics: data.topics
      .filter((t) => ids.has(t.subjectId))
      .map(({ id, subjectId, name, group }) => ({
        id,
        subjectId,
        name,
        group,
      })),
  };
}
const resourceNotes = (resources: Resource[]) =>
  resources.map((r) => `- ${r.name}${r.url ? " — " + r.url : ""}`).join("\n");
export function reviewTasks(plan: AiPlan): ReviewTask[] {
  return plan.tasks.map((t) => ({
    ...t,
    key: uid(),
    selectedAlternative: null,
    revision: t.revision ?? true,
    notes: resourceNotes(t.resources),
  }));
}
export function chooseAlternative(t: ReviewTask, index: number): ReviewTask {
  const a = t.alternatives[index];
  if (!a) throw Error("Choose an available alternative.");
  return {
    ...t,
    selectedAlternative: index,
    title: a.title,
    notes: resourceNotes([...t.resources, ...a.resources]),
  };
}
export function duplicateKeys(data: AppData, rows: ReviewTask[]): Set<string> {
  const seen = new Set(
      data.tasks
        .filter((t) => !t.completedOn)
        .map((t) => {
          const topic = data.topics.find((p) => p.id === t.topicId),
            s = data.subjects.find((s) => s.id === topic?.subjectId);
          return JSON.stringify([
            normalize(s?.name ?? ""),
            normalize(topic?.name ?? ""),
            normalize(t.title),
            normalize(t.range),
          ]);
        }),
    ),
    duplicates = new Set<string>();
  for (const t of rows) {
    const subject =
        data.subjects.find((s) => s.id === t.subjectId)?.name ?? t.subjectName,
      key = JSON.stringify([
        normalize(subject),
        normalize(t.topicName),
        normalize(t.title),
        normalize(t.range),
      ]);
    if (seen.has(key)) duplicates.add(t.key);
    seen.add(key);
  }
  return duplicates;
}
export function commitAiTargets(
  input: AppData,
  rows: ReviewTask[],
  plan: AiPlan,
  date: string,
  options: {
    allowNewSubjects: boolean;
    allowDuplicates: boolean;
    reviewed: boolean;
  },
): AppData {
  if (!options.reviewed || !rows.length)
    throw Error("Review the proposals before saving.");
  if (!options.allowDuplicates && duplicateKeys(input, rows).size)
    throw Error("Remove duplicates or explicitly approve them.");
  const data = clone(input);
  const drafts = rows.map((row) => {
    // Revalidate edited proposals too. UI state is never an authority for writes.
    aiTaskSchema.parse({
      ...Object.fromEntries(
        Object.keys(aiTaskSchema.shape).map((k) => [
          k,
          row[k as keyof ReviewTask],
        ]),
      ),
    });
    if (
      row.alternatives.length &&
      (row.selectedAlternative === null ||
        !row.alternatives[row.selectedAlternative])
    )
      throw Error("Choose one reading/activity alternative.");
    if (row.minutes === null)
      throw Error("Set a study-time estimate for every target.");
    let subject = row.subjectId
      ? data.subjects.find((s) => s.id === row.subjectId && !s.archived)
      : data.subjects.find(
          (s) =>
            !s.archived && normalize(s.name) === normalize(row.subjectName),
        );
    if (row.subjectId && !subject)
      throw Error("A selected subject is no longer available.");
    if (!subject) {
      if (!options.allowNewSubjects)
        throw Error("Approve creating the proposed subjects first.");
      subject = {
        id: uid(),
        name: row.subjectName.trim(),
        theme: "generic",
        color: "#718c6b",
        archived: false,
      };
      data.subjects.push(subject);
    }
    if (row.topicId) {
      const p = data.topics.find((p) => p.id === row.topicId);
      if (
        !p ||
        p.subjectId !== subject.id ||
        normalize(p.name) !== normalize(row.topicName)
      )
        throw Error("Recheck the topic and its subject.");
    }
    const existing = data.topics.find(
      (p) =>
        p.subjectId === subject.id &&
        normalize(p.name) === normalize(row.topicName),
    );
    const topic = ensureTopic(data, subject.id, row.topicName);
    if (!existing) topic.group = row.group.trim();
    const notes = [
      row.notes,
      row.quantity && `Quantity: ${row.quantity}`,
      row.difficulty && `Difficulty: ${row.difficulty}`,
      row.coverage && `Coverage: ${row.coverage}`,
      row.alternatives.length &&
        `Choose-one target. Selected alternative ${row.selectedAlternative! + 1}. Original alternatives:\n${row.alternatives.map((a) => "- " + a.title).join("\n")}`,
      plan.sharedResources.length &&
        `Shared resources (not separate tasks):\n${resourceNotes(plan.sharedResources)}`,
      plan.sharedNotes.map((n) => n.text).join("\n"),
      `Original source:\n${row.source}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (notes.length > 10000)
      throw Error(
        "Resource/source notes are too long. Shorten them before saving.",
      );
    return {
      subjectId: subject.id,
      topic: topic.name,
      title: row.title,
      minutes: row.minutes,
      priority: row.priority,
      revision: row.revision,
      range: row.range,
      notes,
    };
  });
  return dataSchema.parse(addTasks(data, drafts, date));
}
