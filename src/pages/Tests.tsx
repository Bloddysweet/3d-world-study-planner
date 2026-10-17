import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardCheck,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
} from "../components/icons";
import { revisionExamPlan, recordRevisionExam } from "../domain/exams";
import { useApp } from "../data/AppProvider";
import {
  recordTest,
  scoreRating,
  subjectFor,
  topicStatus,
} from "../domain/engine";
import {
  displayDate,
  duration,
  testSchema,
  uid,
  validDay,
} from "../domain/model";
import {
  Chip,
  Empty,
  ErrorText,
  Field,
  Heading,
  Modal,
  Page,
  SectionTitle,
  SubjectIcon,
  useDialog,
} from "../components/ui";
interface TopicScore {
  topicId: string;
  score: string;
  total: string;
}
export function TestForm({
  topicId,
  embedded = false,
  onDone,
  revisionExam = false,
}: {
  topicId?: string;
  revisionExam?: boolean;
  embedded?: boolean;
  onDone?: () => void;
}) {
  const { data, date, update, notify } = useApp(),
    { close } = useDialog();
  const [name, setName] = useState(revisionExam ? "Revision exam" : ""),
    [day, setDay] = useState(date),
    [score, setScore] = useState(""),
    [total, setTotal] = useState("100"),
    [minutes, setMinutes] = useState(""),
    [notes, setNotes] = useState(""),
    [topics, setTopics] = useState<TopicScore[]>(
      topicId ? [{ topicId, score: "", total: "100" }] : [],
    ),
    [error, setError] = useState("");
  const [confirmedExam, setConfirmedExam] = useState(false);
  const examPlan = useMemo(
    () => revisionExamPlan(data, validDay(day) ? day : date),
    [data, day, date],
  );
  const available = (revisionExam ? examPlan.topics : data.topics).filter(
    (t) => !subjectFor(data, t.id)?.archived,
  );
  const patch = (i: number, value: Partial<TopicScore>) =>
    setTopics((t) => t.map((a, n) => (n === i ? { ...a, ...value } : a)));
  const dismiss = () => (embedded ? onDone?.() : close());
  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const test = testSchema.parse({
            id: uid(),
            name,
            day,
            score: Number(score),
            total: Number(total),
            minutes: minutes.trim() ? Number(minutes) : undefined,
            notes,
            topics: topics.map((t) => ({
              topicId: t.topicId,
              score: Number(t.score),
              total: Number(t.total),
            })),
          });
          if (day > date)
            return setError(
              "Use the date you actually took the test, not a future date.",
            );
          if (revisionExam && !confirmedExam)
            return setError(
              "Confirm that you took the external exam covering its syllabus.",
            );
          update((s) =>
            revisionExam
              ? recordRevisionExam(s, test, date)
              : recordTest(s, test),
          );
          notify(
            revisionExam
              ? "Revision exam recorded. The next checkpoint follows your exam interval."
              : "Test recorded. Only topic-level scores adjusted revisions.",
          );
          dismiss();
        } catch (error) {
          if (
            revisionExam &&
            error instanceof Error &&
            !(error.name === "ZodError")
          )
            return setError(error.message);
          setError(
            "Check scores: each score must be between zero and its positive total. Choose each topic only once.",
          );
        }
      }}
    >
      <div className="modal-body">
        <div className="callout soft">
          <ClipboardCheck size={20} />
          <span>
            This is a record of a test taken elsewhere—not an in-app quiz.
            Overall scores alone never change topic schedules.
          </span>
        </div>
        {revisionExam && (
          <div className="exam-record-syllabus">
            <strong>
              {validDay(day)
                ? `Syllabus for ${displayDate(day)}`
                : "Choose the actual exam date"}
            </strong>
            <p className="muted small">
              {examPlan.topics.length} revised{" "}
              {examPlan.topics.length === 1 ? "topic" : "topics"} ·{" "}
              {examPlan.coverage.length} topic/range groups. Only revisions
              completed on or before this date are included.
            </p>
            <ul>
              {examPlan.coverage.map((c) => (
                <li key={JSON.stringify([c.topicId, c.range])}>
                  {c.subjectName} · {c.topicName}
                  {c.range ? ` · Words/range ${c.range}` : ""}
                </li>
              ))}
            </ul>
            {!examPlan.coverage.length && (
              <p>
                No untested revised topics on this date. Cancel and use a
                regular test record if needed.
              </p>
            )}
          </div>
        )}
        <div className="form-grid">
          <Field label="Test name">
            <input
              required
              autoFocus={!embedded}
              maxLength={500}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SSC Mock Test 01"
            />
          </Field>
          <Field label="Test date">
            <input
              type="date"
              required
              max={date}
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setConfirmedExam(false);
              }}
            />
          </Field>
        </div>
        <div className="form-grid three">
          <Field label="Your score">
            <input
              type="number"
              step="any"
              min={0}
              max={1000000}
              required
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 72"
            />
          </Field>
          <Field label="Out of">
            <input
              type="number"
              step="any"
              min={0.001}
              max={1000000}
              required
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </Field>
          <Field
            label="Time taken (minutes)"
            hint="Optional — leave blank if unknown."
          >
            <input
              type="number"
              min={0}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
        </div>
        <div className="overall-score-preview">
          <div>
            <span>OVERALL SCORE</span>
            <strong>
              {score.trim() ? score : "—"} <small>/ {total || "—"}</small>
            </strong>
          </div>
          <div>
            <span>Accuracy</span>
            <strong>
              {score.trim() && Number(total) > 0
                ? `${Math.round((Number(score) / Number(total)) * 100)}%`
                : "—"}
            </strong>
          </div>
          <p>
            Saved for your test journal. Only topic scores below can move
            revision dates.
          </p>
        </div>
        <SectionTitle
          title="Topic-level results"
          action={
            <button
              className="text-link"
              type="button"
              disabled={topics.length >= available.length}
              onClick={() =>
                setTopics((t) => [
                  ...t,
                  { topicId: "", score: "", total: "100" },
                ])
              }
            >
              <Plus size={15} />
              Add topic
            </button>
          }
        >
          Optional. Add these only if you have topic-specific scores.
        </SectionTitle>
        {topics.map((t, i) => (
          <div className="topic-score-row" key={i}>
            <Field label="Topic">
              <select
                required
                value={t.topicId}
                onChange={(e) => patch(i, { topicId: e.target.value })}
              >
                <option value="">Select topic</option>
                {available
                  .filter(
                    (a) =>
                      a.id === t.topicId ||
                      !topics.some((row) => row.topicId === a.id),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {subjectFor(data, a.id)?.name} · {a.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Score">
              <input
                type="number"
                step="any"
                required
                min={0}
                max={1000000}
                value={t.score}
                onChange={(e) => patch(i, { score: e.target.value })}
              />
            </Field>
            <Field label="Total">
              <input
                type="number"
                step="any"
                required
                min={0.001}
                max={1000000}
                value={t.total}
                onChange={(e) => patch(i, { total: e.target.value })}
              />
            </Field>
            <span className="topic-result-rating">
              {t.score.trim() &&
              Number(t.total) > 0 &&
              Number(t.score) <= Number(t.total)
                ? scoreRating(
                    (Number(t.score) / Number(t.total)) * 100,
                    data.preferences.thresholds,
                  )
                : "No score yet"}
            </span>
            <button
              className="icon-btn"
              type="button"
              aria-label={`Remove topic result ${i + 1}`}
              onClick={() => setTopics((t) => t.filter((_, n) => n !== i))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {topics.length > 0 && (
          <p className="muted small">
            Topic scores count as a revision on the test date. Below{" "}
            {data.preferences.thresholds[0]}% = Forgot; below{" "}
            {data.preferences.thresholds[1]}% = Hard; below{" "}
            {data.preferences.thresholds[2]}% = Good; otherwise Easy. A topic
            result applies to all its vocabulary ranges. Historical tests never
            rewind newer learning.
          </p>
        )}
        {!available.length && (
          <p className="muted small">
            Add a topic in a subject first to record topic-level results.
          </p>
        )}
        <Field label="Notes on mistakes (optional)">
          <textarea
            rows={3}
            maxLength={10000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was tricky? What will you do differently?"
          />
        </Field>
        {revisionExam && (
          <label className="recall-check">
            <input
              type="checkbox"
              checked={confirmedExam}
              onChange={(e) => setConfirmedExam(e.target.checked)}
            />
            I took this exam outside the app and covered every topic/range in
            the syllabus above.
          </label>
        )}
        <ErrorText message={error} />
      </div>
      <div className="modal-footer">
        <button className="btn" type="button" onClick={dismiss}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={
            revisionExam && (!confirmedExam || !examPlan.coverage.length)
          }
        >
          <ClipboardCheck size={16} />
          Save test result
        </button>
      </div>
    </form>
  );
  return embedded ? (
    <section className="panel inline-test-form">
      <SectionTitle
        title="Record a test result"
        action={<Chip>Draft · not saved yet</Chip>}
      />
      {form}
    </section>
  ) : (
    <Modal
      title={
        revisionExam ? "Record your revision exam" : "Record an external test"
      }
      wide
    >
      {form}
    </Modal>
  );
}
function RevisionExamPanel() {
  const { data, date } = useApp(),
    { open } = useDialog();
  const plan = useMemo(() => revisionExamPlan(data, date), [data, date]);
  const [page, setPage] = useState(0);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width:640px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width:640px)");
    const change = () => {
      setCompact(query.matches);
      setPage(0);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const pageSize = compact ? 2 : 4;
  const pages = Math.max(1, Math.ceil(plan.topics.length / pageSize));
  const current = Math.min(page, pages - 1);
  return (
    <section
      className="panel revision-exam-panel"
      aria-label="Revision exam plan"
    >
      <div className="exam-plan-heading">
        <div>
          <span className="eyebrow">YOUR REVISED-TOPIC CHECKPOINT</span>
          <h2>
            <CalendarClock size={23} /> Revision exam
          </h2>
        </div>
        <Chip tone={plan.due ? "rose" : "purple"}>
          {plan.due
            ? "Exam due"
            : plan.dueOn
              ? "Upcoming"
              : "Waiting for revisions"}
        </Chip>
      </div>
      <div className="exam-plan-summary">
        <strong>Every {plan.intervalDays} days</strong>
        {plan.dueOn && (
          <span>
            {" "}
            {plan.due ? "Due" : "Next exam"}:{" "}
            {displayDate(plan.dueOn, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
        <Link className="text-link" to="/settings">
          Change interval <ArrowRight size={13} />
        </Link>
      </div>
      <p className="muted small">
        Revise, take an exam using your book, PDF or test platform, then record
        the result here. This is a syllabus and reminder, not an in-app question
        paper.
      </p>
      {plan.topics.length ? (
        <>
          <p className="exam-plan-count">
            {plan.topics.length} revised{" "}
            {plan.topics.length === 1 ? "topic" : "topics"} ·{" "}
            {plan.coverage.length} topic/range groups not yet covered by a
            recorded revision exam.
          </p>
          <div className="exam-topic-grid">
            {plan.topics
              .slice(current * pageSize, current * pageSize + pageSize)
              .map((topic) => (
                <article key={topic.id}>
                  <SubjectIcon
                    subject={subjectFor(data, topic.id)!}
                    size={21}
                  />
                  <div>
                    <strong>{topic.name}</strong>
                    <span>{subjectFor(data, topic.id)!.name}</span>
                    <small>
                      {plan.coverage
                        .filter((c) => c.topicId === topic.id)
                        .map((c) =>
                          c.range
                            ? `Words/range ${c.range}`
                            : "Revised topic material",
                        )
                        .join(" · ")}
                    </small>
                  </div>
                </article>
              ))}
          </div>
          {pages > 1 && (
            <nav
              className="exam-plan-pagination"
              aria-label="Exam syllabus pages"
            >
              <button
                className="btn small-btn"
                aria-label="Previous syllabus page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <span>
                Page {current + 1} of {pages}
              </span>
              <button
                className="btn small-btn"
                aria-label="Next syllabus page"
                disabled={current + 1 === pages}
                onClick={() => setPage(current + 1)}
              >
                Next
                <ChevronRight size={15} />
              </button>
            </nav>
          )}
          <div className="exam-plan-action">
            <button
              className="btn primary"
              onClick={() => open(<TestForm revisionExam />)}
            >
              Record revision exam result <ArrowRight size={15} />
            </button>
            <span className="muted small">
              {plan.due
                ? "Missed a checkpoint? It stays due—no duplicate exams are created."
                : "You can record an exam early if you have actually taken it."}
            </span>
          </div>
        </>
      ) : (
        <p className="exam-plan-empty">
          {plan.latestExam
            ? "Your previous exam is recorded. Complete a new recall revision to build the next syllabus."
            : "Complete a recall revision to start your first exam interval. Completing a learning task alone does not count as revising."}
        </p>
      )}
      <p className="exam-plan-note">
        Weekly is a practical default, not a proven optimum. Exams never
        complete themselves. Overall-only scores do not change revision dates.
      </p>
    </section>
  );
}
export function TestsPage() {
  const { data } = useApp(),
    { open } = useDialog(),
    [expanded, setExpanded] = useState<string | null>(null),
    [formKey, setFormKey] = useState(0);
  const ready = data.topics.filter(
    (t) =>
      !subjectFor(data, t.id)?.archived &&
      ["ready_for_test", "strong"].includes(topicStatus(data, t.id)),
  );
  const tests = [...data.tests].sort((a, b) => b.day.localeCompare(a.day));
  return (
    <Page className="tests-page">
      <Heading
        eyebrow="CHECK YOUR UNDERSTANDING"
        title="Tests"
        description="Take tests anywhere—mock apps, books or PDFs—and record the result here. Only topic scores adjust revisions."
        action={
          <button className="btn primary" onClick={() => open(<TestForm />)}>
            <Plus size={16} />
            Record a test
          </button>
        }
      />
      <RevisionExamPanel />
      <div className="tests-layout">
        <section className="test-journal-column">
          <TestForm
            key={formKey}
            embedded
            onDone={() => setFormKey((key) => key + 1)}
          />
          <SectionTitle
            title="Recent results"
            action={<Chip>{tests.length} recorded</Chip>}
          />
          {tests.length ? (
            <div className="test-list">
              {tests.map((test) => (
                <article className="panel test-card" key={test.id}>
                  <button
                    className="test-card-main"
                    onClick={() =>
                      setExpanded(expanded === test.id ? null : test.id)
                    }
                    aria-expanded={expanded === test.id}
                  >
                    <span className="test-icon">
                      <ClipboardCheck size={24} />
                    </span>
                    <span>
                      <strong>{test.name}</strong>
                      <small>
                        {displayDate(test.day, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        ·{" "}
                        {test.minutes === undefined
                          ? "Time not recorded"
                          : duration(test.minutes)}{" "}
                        ·{" "}
                        {test.topics.length
                          ? `${test.topics.length} topic results`
                          : "Overall score only"}
                        {test.revisionExam && " · Revision exam"}
                      </small>
                    </span>
                    <span className="test-score">
                      <strong>
                        {Math.round((test.score / test.total) * 100)}
                        <small>%</small>
                      </strong>
                      <span>
                        {test.score} / {test.total}
                      </span>
                    </span>
                  </button>
                  {expanded === test.id && (
                    <div className="test-details">
                      {test.revisionExam && (
                        <div className="exam-history-syllabus">
                          <strong>Revision exam syllabus</strong>
                          <p className="muted small">
                            Scheduled for{" "}
                            {displayDate(test.revisionExam.scheduledFor)} ·
                            Taken {displayDate(test.day)}
                          </p>
                          <ul>
                            {test.revisionExam.coverage.map((c) => (
                              <li key={JSON.stringify([c.topicId, c.range])}>
                                {c.subjectName} · {c.topicName}
                                {c.range ? ` · Words/range ${c.range}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {test.topics.map((t) => (
                        <div className="score-detail" key={t.topicId}>
                          <span>
                            {data.topics.find((a) => a.id === t.topicId)?.name}
                          </span>
                          <strong>
                            {t.score} / {t.total}{" "}
                            <small>
                              ({Math.round((t.score / t.total) * 100)}%)
                            </small>
                          </strong>
                        </div>
                      ))}
                      {!test.topics.length && (
                        <p className="muted small">
                          No topic schedules were changed by this result.
                        </p>
                      )}
                      {test.notes && (
                        <div className="test-notes">
                          <strong>Reflections & mistakes</strong>
                          <p>{test.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Empty
                title="More than a number"
                action={
                  <button
                    className="btn primary"
                    onClick={() => open(<TestForm />)}
                  >
                    Record your first test
                    <Plus size={16} />
                  </button>
                }
              >
                Taken a mock test, a topic quiz or a coding assessment
                elsewhere? Keep the result and what you learned here.
              </Empty>
            </section>
          )}
        </section>
        <aside>
          <div className="note-card">
            <span className="eyebrow">READY FOR A CHECK-IN</span>
            <h3>
              Ready for a test <Chip tone="amber">{ready.length}</Chip>
            </h3>
            <p>
              After three completed revisions, a topic is ready for an external
              test. The scheduled exam above also includes topics with fewer
              recalls.
            </p>
            {ready.length ? (
              <div className="ready-topics">
                {ready.map((t) => (
                  <div key={t.id}>
                    <SubjectIcon subject={subjectFor(data, t.id)!} size={17} />
                    <span>{t.name}</span>
                    <button
                      className="icon-btn"
                      aria-label={`Record test for ${t.name}`}
                      onClick={() => open(<TestForm topicId={t.id} />)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ready-empty">
                Your ready-for-test topics will appear here as you revise.
              </p>
            )}
            <Link to="/revisions" className="text-link">
              Keep your recall rhythm
              <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mini-panel">
            <h3>How a topic score moves revisions</h3>
            <div className="score-threshold-strip">
              {["Forgot", "Hard", "Good", "Easy"].map((rating, i) => (
                <span
                  key={rating}
                  style={{
                    flex: [
                      data.preferences.thresholds[0],
                      data.preferences.thresholds[1] -
                        data.preferences.thresholds[0],
                      data.preferences.thresholds[2] -
                        data.preferences.thresholds[1],
                      100 - data.preferences.thresholds[2],
                    ][i],
                  }}
                >
                  {rating}
                </span>
              ))}
            </div>
            <p className="threshold-caption">
              0% · {data.preferences.thresholds.join("% · ")}% · 100%
            </p>
            <p>
              A strong overall score can hide a weak topic. Add topic scores
              when you have them—we won’t invent them.
            </p>
          </div>
          <section className="panel test-trend-card">
            <SectionTitle title="Recent test trend" />
            <div className="test-trend-bars">
              {tests.length ? (
                tests
                  .slice(0, 5)
                  .reverse()
                  .map((test) => (
                    <div key={test.id}>
                      <b>{Math.round((test.score / test.total) * 100)}%</b>
                      <i
                        style={{
                          height: `${Math.max(2, (test.score / test.total) * 100)}px`,
                        }}
                      />
                      <span>
                        {displayDate(test.day, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  ))
              ) : (
                <p>No test scores recorded yet.</p>
              )}
            </div>
            <p className="chart-footnote">
              Overall test percentages, not topic mastery.
            </p>
          </section>
        </aside>
      </div>
    </Page>
  );
}
