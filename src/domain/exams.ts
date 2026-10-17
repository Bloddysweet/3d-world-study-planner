import { recordTest } from "./engine";
import { addDays, testSchema, validDay } from "./model";
import type { AppData, TestResult } from "./model";

export type ExamCoverage = NonNullable<
  TestResult["revisionExam"]
>["coverage"][number];
const token = (topicId: string, range: string, day: string) =>
  JSON.stringify([topicId, range, day]);

/** Read-only rolling checkpoint. Only actual recall creates a syllabus, never learning
 * completion, a future schedule, a topic status, or an exam's own score evidence.
 * One overdue checkpoint accumulates pending recalls; no synthetic exams/tasks are saved.
 */
export function revisionExamPlan(data: AppData, asOf: string) {
  if (!validDay(asOf)) throw new Error("Invalid exam date");
  const exams = data.tests.filter((t) => t.revisionExam);
  const covered = new Set(
    exams.flatMap((t) =>
      t.revisionExam!.coverage.flatMap((c) =>
        c.reviewDays.map((day) => token(c.topicId, c.range, day)),
      ),
    ),
  );
  const topicById = new Map(data.topics.map((t) => [t.id, t]));
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const revisions = new Map(data.revisions.map((r) => [r.id, r]));
  const groups = new Map<string, ExamCoverage>();
  for (const review of data.reviews) {
    const topic = topicById.get(review.topicId);
    const subject = topic && subjectById.get(topic.subjectId);
    if (
      review.source !== "recall" ||
      review.day > asOf ||
      !topic ||
      !subject ||
      subject.archived
    )
      continue;
    const revision = revisions.get(review.revisionId);
    if (
      !revision ||
      covered.has(token(review.topicId, revision.range, review.day))
    )
      continue;
    const key = JSON.stringify([review.topicId, revision.range]);
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        topicId: review.topicId,
        topicName: topic.name,
        subjectName: subject.name,
        range: revision.range,
        reviewDays: [],
      };
      groups.set(key, entry);
    }
    entry.reviewDays.push(review.day);
  }
  const coverage = [...groups.values()]
    .map((c) => ({ ...c, reviewDays: [...new Set(c.reviewDays)].sort() }))
    .sort(
      (a, b) =>
        a.subjectName.localeCompare(b.subjectName) ||
        a.topicName.localeCompare(b.topicName) ||
        a.range.localeCompare(b.range),
    );
  const topicIds = new Set(coverage.map((c) => c.topicId));
  const topics = data.topics.filter((t) => topicIds.has(t.id));
  const firstReview = coverage.flatMap((c) => c.reviewDays).sort()[0];
  const latestExam = exams
    .filter((t) => t.day <= asOf)
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  const intervalDays = data.preferences.examIntervalDays ?? 7;
  // Restart a new batch after an inactive period instead of inventing an overdue
  // deadline for material that had not even been revised at that deadline.
  const regularDue = latestExam
    ? addDays(latestExam.day, intervalDays)
    : undefined;
  const dueOn = !firstReview
    ? undefined
    : regularDue && firstReview <= regularDue
      ? regularDue
      : addDays(firstReview, intervalDays);
  return {
    coverage,
    topics,
    intervalDays,
    dueOn,
    latestExam,
    due: !!dueOn && dueOn <= asOf,
  };
}

/** Explicit completion only. The caller confirms the actual external exam covered
 * the entire displayed syllabus. Overall-only scores consume coverage, not revisions.
 */
export function recordRevisionExam(
  data: AppData,
  value: TestResult,
  asOf: string,
): AppData {
  const test = testSchema.parse(value);
  if (!validDay(asOf) || test.day > asOf)
    throw new Error("Use the actual exam date, not a future date.");
  if (data.tests.some((t) => t.id === test.id)) return data;
  const plan = revisionExamPlan(data, test.day);
  if (!plan.dueOn || !plan.coverage.length)
    throw new Error(
      "No untested revised topics are available on this date. Use a regular test record instead.",
    );
  const result = testSchema.parse({
    ...test,
    revisionExam: { scheduledFor: plan.dueOn, coverage: plan.coverage },
  });
  return recordTest(data, result);
}
