import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Edit3,
  ChevronRight,
  Clock3,
  Flag,
  Plus,
  RotateCcw,
  RevisionIcon,
  CalendarClock,
  BookOpen,
  Link2,
  ClipboardPaste,
  ShieldCheck,
  ChevronLeft,
  Info,
} from "../components/icons";
import { revisionExamPlan } from "../domain/exams";
import { useApp } from "../data/AppProvider";
import {
  activeTopic,
  carriedLabel,
  completeTask,
  undoTaskCompletion,
  dailyPlan,
  rateRevision,
  subjectFor,
} from "../domain/engine";
import {
  addDays,
  daysBetween,
  displayDate,
  duration,
  ratings,
  today,
} from "../domain/model";
import type { Revision, Task } from "../domain/model";
import { saveSleep, sleepFor, sleepMinutes, sleepTrend } from "../domain/sleep";
import { saveStreak, streakStatus } from "../domain/streak";
import {
  Chip,
  Empty,
  Field,
  Heading,
  Modal,
  Page,
  SectionTitle,
  SubjectIcon,
  useDialog,
} from "../components/ui";
import { ImportForm, TaskForm, pasteExample } from "../components/forms";
export function ReviewForm({ revision }: { revision: Revision }) {
  const { data, update, notify } = useApp(),
    { close } = useDialog(),
    [recalled, setRecalled] = useState(false);
  const topic = data.topics.find((t) => t.id === revision.topicId)!;
  const descriptions = [
    "Couldn’t remember · restart at day 1",
    "Remembered with difficulty · same step",
    "Recalled correctly · next step",
    "Confident recall · skip one step",
  ];
  return (
    <Modal title={`Review: ${topic.name}`}>
      <div className="modal-body">
        <div className="tag-line">
          <Chip tone="purple">Step {revision.step} of 7</Chip>
          {revision.range && <Chip>Words {revision.range}</Chip>}
          <span className="muted small">
            {revision.revisionCount} completed revisions
          </span>
        </div>
        <p>
          Close your notes. Try explaining this topic or solving a few questions
          from memory. Then check your work.
        </p>
        <div className="recall-notes">
          <strong>Work covered by this revision</strong>
          {revision.taskIds.length ? (
            revision.taskIds.map((id) => (
              <p key={id}>• {data.tasks.find((t) => t.id === id)?.title}</p>
            ))
          ) : (
            <p>
              This schedule is retained from recorded recall or topic-test
              evidence.
            </p>
          )}
        </div>
        <label className="recall-check">
          <input
            autoFocus
            type="checkbox"
            checked={recalled}
            onChange={(e) => setRecalled(e.target.checked)}
          />
          I attempted recall and checked my answers.
        </label>
        <div className="rating-grid">
          {ratings.map((rating, i) => (
            <button
              key={rating}
              className={`rating rating-${i}`}
              disabled={!recalled}
              onClick={() => {
                update((s) => rateRevision(s, revision.id, rating, today()));
                notify(`Review saved as ${rating}. Next date is in Revisions.`);
                close();
              }}
            >
              <strong>{rating}</strong>
              <span>{descriptions[i]}</span>
            </button>
          ))}
        </div>
        <p className="muted small">
          Rating again on the same day replaces that day’s rating; it doesn’t
          count twice. Dates always start from actual completion.
        </p>
      </div>
    </Modal>
  );
}
export function DeferForm({
  task,
  revision,
}: {
  task?: Task;
  revision?: Revision;
}) {
  const { date, update, notify } = useApp(),
    { close } = useDialog(),
    [day, setDay] = useState(addDays(date, 1));
  return (
    <Modal title="Make room, intentionally">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update((s) =>
            task
              ? {
                  ...s,
                  tasks: s.tasks.map((t) =>
                    t.id === task.id ? { ...t, plannedOn: day } : t,
                  ),
                }
              : {
                  ...s,
                  revisions: s.revisions.map((r) =>
                    r.id === revision?.id ? { ...r, due: day } : r,
                  ),
                },
          );
          notify(`Moved to ${displayDate(day)}. No work was marked complete.`);
          close();
        }}
      >
        <div className="modal-body">
          <p>
            Only this {task ? "task" : "revision"} will move. Nothing is dropped
            or marked complete.
          </p>
          <Field label="Move to">
            <input
              autoFocus
              type="date"
              required
              min={addDays(date, 1)}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          {revision && (
            <div className="callout amber">
              Deferring a review does not improve your learning status. Its next
              interval will still start from the day you actually complete it.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={close}>
            Keep in today
          </button>
          <button className="btn primary">Confirm move</button>
        </div>
      </form>
    </Modal>
  );
}
export function TaskDetails({ task: initial }: { task: Task }) {
  const { data, update, notify } = useApp(),
    { open, close } = useDialog();
  const task = data.tasks.find((t) => t.id === initial.id) ?? initial,
    topic = data.topics.find((t) => t.id === task.topicId),
    subject = subjectFor(data, task.topicId);
  const schedules = data.revisions.filter((r) => r.taskIds.includes(task.id));
  return (
    <Modal variant="drawer" className="task-detail-view" title={task.title}>
      <div className="modal-body">
        <div className="tag-line">
          <Chip>
            {subject?.name} · {topic?.name}
          </Chip>
          {task.priority && <Chip tone="amber">Priority</Chip>}
          <Chip tone={task.completedOn ? "green" : ""}>
            {task.completedOn ? "Completed" : "Unfinished"}
          </Chip>
        </div>
        <SectionTitle title="Progress" />
        <div className="task-evidence-stats">
          <div>
            <strong>{task.minutes}m</strong>
            <span>estimated effort</span>
          </div>
          <div>
            <strong>{task.completedOn ? "Done" : "To do"}</strong>
            <span>actual completion</span>
          </div>
          <div>
            <strong>{schedules.length}</strong>
            <span>linked schedules</span>
          </div>
        </div>
        <p className="muted small">
          Estimates are not tracked time. No question-attempt accuracy is
          recorded for this task.
        </p>
        <SectionTitle title="Resources" />
        {(task.notes.match(/https?:\/\/[^\s]+/g) ?? []).map((url, i) => (
          <a
            key={i}
            className="resource task-resource"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <Link2 size={17} />
            <span>
              Open resource {i + 1}
              <small>{url}</small>
            </span>
            <ArrowRight size={15} />
          </a>
        ))}
        {!task.notes.match(/https?:\/\/[^\s]+/) && (
          <p className="muted small">
            No resource links yet. Add them through Edit.
          </p>
        )}
        <SectionTitle title="Revision" />
        <div className="callout soft">
          {!task.revision
            ? "Revision is off for this task."
            : schedules.length
              ? schedules.map((r) => (
                  <p key={r.id}>
                    Step {r.step} · {r.revisionCount} recorded reviews · next{" "}
                    {displayDate(r.due)}
                    {r.range ? ` · Words ${r.range}` : ""}
                  </p>
                ))
              : "Completing this task starts its topic/range schedule from the actual completion date."}
        </div>
        <SectionTitle title="History" />
        <ol className="task-timeline">
          <li>
            <strong>{displayDate(task.createdOn)}</strong>Added to your
            workspace
          </li>
          <li>
            <strong>{displayDate(task.plannedOn)}</strong>Current planned date
          </li>
          {task.completedOn && (
            <li>
              <strong>{displayDate(task.completedOn)}</strong>Marked completed
            </li>
          )}
        </ol>
        <SectionTitle title="Notes" />
        <div className="task-readonly-notes">
          {task.notes ||
            "No notes yet. Use Edit to add reflections or resource links."}
        </div>
      </div>
      <div className="modal-footer">
        <button
          className="btn primary"
          onClick={() => {
            update((s) =>
              task.completedOn
                ? undoTaskCompletion(s, task.id)
                : completeTask(s, task.id, today()),
            );
            notify(
              task.completedOn
                ? "Completion undone. Recorded evidence kept."
                : "Completed. Revision starts from actual completion.",
            );
          }}
        >
          {task.completedOn ? "Undo completion" : "Mark completed"}
        </button>
        {!task.completedOn && (
          <button
            className="btn"
            onClick={() => open(<DeferForm task={task} />)}
          >
            Move to another day
          </button>
        )}
        <button
          className="btn"
          onClick={() => open(<TaskForm initial={task} />)}
        >
          <Edit3 size={14} />
          Edit
        </button>
        <button className="btn" onClick={close}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
export function TaskRow({
  task,
  compact = false,
}: {
  task: Task;
  compact?: boolean;
}) {
  const { data, date, update, notify } = useApp(),
    { open } = useDialog(),
    subject = subjectFor(data, task.topicId)!;
  const topic = data.topics.find((t) => t.id === task.topicId)!;
  return (
    <div className={`task-row ${task.completedOn ? "done" : ""}`}>
      <span
        className={`task-status ${task.completedOn ? "is-complete" : ""}`}
        aria-hidden="true"
      >
        {task.completedOn ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </span>
      <button
        className="task-main"
        onClick={() => open(<TaskDetails task={task} />)}
      >
        <strong>{task.title}</strong>
        <span className="task-meta">
          <span style={{ color: subject.color }}>{subject.name}</span>
          <span>·</span>
          <span>
            {topic.name}
            {task.range ? ` · ${task.range}` : ""}
          </span>
          {!task.completedOn && !compact && (
            <Chip
              tone={
                task.priority ? "amber" : task.plannedOn < date ? "rose" : ""
              }
            >
              {task.priority ? (
                <>
                  <Flag size={10} />
                  Priority
                </>
              ) : (
                carriedLabel(task, date)
              )}
            </Chip>
          )}
        </span>
      </button>
      <span className="task-time">
        <Clock3 size={13} />
        {duration(task.minutes)}
      </span>
      <div className="task-actions">
        <button
          className="btn small-btn task-edit"
          aria-label={`Edit task: ${task.title}`}
          onClick={() => open(<TaskForm initial={task} />)}
        >
          <Edit3 size={13} />
          Edit
        </button>
        {task.completedOn ? (
          <>
            <Chip tone="green">
              <Check size={11} />
              Completed
            </Chip>
            <button
              className="btn small-btn task-undo"
              aria-label={`Undo completion: ${task.title}`}
              onClick={() => {
                update((s) => undoTaskCompletion(s, task.id));
                notify(
                  "Completion undone. Task is unfinished; recorded recalls and tests are kept.",
                );
              }}
            >
              <RotateCcw size={13} />
              Undo
            </button>
          </>
        ) : (
          <>
            <button
              className="btn small-btn primary task-complete"
              disabled={subject.archived}
              aria-label={`Mark completed: ${task.title}`}
              onClick={() => {
                update((s) => completeTask(s, task.id, today()));
                notify(
                  task.revision
                    ? "Completed! Revision scheduled from today. Undo is available in Completed or the subject."
                    : "Completed! No revision scheduled. Undo is available in Completed or the subject.",
                );
              }}
            >
              <Check size={14} />
              Mark completed
            </button>
            <button
              className="icon-btn defer-btn"
              aria-label={`Move task: ${task.title}`}
              onClick={() => open(<DeferForm task={task} />)}
            >
              <CalendarClock size={17} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export function RevisionRow({
  revision,
  allowEarly = false,
}: {
  revision: Revision;
  allowEarly?: boolean;
}) {
  const { data, date } = useApp(),
    { open } = useDialog();
  const topic = data.topics.find((t) => t.id === revision.topicId)!,
    subject = subjectFor(data, topic.id)!;
  const overdue = daysBetween(revision.due, date),
    due = revision.due <= date;
  return (
    <div className="revision-row">
      <SubjectIcon subject={subject} size={19} />
      <div className="revision-main">
        <strong>
          {topic.name}
          {revision.range && <span className="range"> · {revision.range}</span>}
        </strong>
        <span>
          {subject.name} · Step {revision.step} · {revision.revisionCount}{" "}
          reviews
        </span>
      </div>
      <Chip tone={overdue > 0 ? "rose" : due ? "purple" : ""}>
        {overdue > 0
          ? `${overdue}d overdue`
          : due
            ? "Due today"
            : displayDate(revision.due)}
      </Chip>
      <button
        className="btn small-btn"
        onClick={() => open(<ReviewForm revision={revision} />)}
        disabled={!due && !allowEarly}
      >
        <RevisionIcon size={14} />
        {due ? "Review" : "Review early"}
      </button>
      <button
        className="icon-btn defer-btn"
        aria-label={`Move revision: ${topic.name}`}
        onClick={() => open(<DeferForm revision={revision} />)}
      >
        <CalendarClock size={17} />
      </button>
    </div>
  );
}
export function TodayPage() {
  const { data, date, update, notify } = useApp(),
    { open } = useDialog(),
    plan = dailyPlan(data, date),
    [tab, setTab] = useState<"plan" | "done">("plan"),
    [paste, setPaste] = useState("");
  const exam = useMemo(() => revisionExamPlan(data, date), [data, date]);
  const streak = streakStatus(data, date);
  const [studied, setStudied] = useState(streak.studiedToday);
  const savedSleep = sleepFor(data, date);
  const [bedtime, setBedtime] = useState(savedSleep?.bedtime ?? "23:00");
  const [wake, setWake] = useState(savedSleep?.wake ?? "07:00");
  const [sleepErr, setSleepErr] = useState("");
  const sleepPreview = sleepMinutes(bedtime, wake);
  const trend = useMemo(() => sleepTrend(data, date), [data, date]);
  const lastNight = sleepFor(data, date);
  const completed = data.tasks.filter(
    (t) => t.completedOn === date && activeTopic(data, t.topicId),
  );
  const reviews = data.reviews.filter(
    (r) => r.day === date && activeTopic(data, r.topicId),
  );
  const groupNames = [
    "Priority",
    "Revisions due",
    "Carried forward",
    "New learning",
  ];
  return (
    <Page className="today-page">
      <Heading
        title="Today"
        description={`${displayDate(date, { weekday: "long", day: "numeric", month: "long" })} · ${plan.items.length} planned items · ${completed.length} tasks completed`}
        action={
          <>
            <button className="btn" onClick={() => open(<TaskForm />)}>
              <Plus size={15} />
              Add task
            </button>
            <Link className="btn" to="/settings">
              <Clock3 size={15} />
              Today's hours
            </Link>
          </>
        }
      />
      {exam.due && (
        <div className="exam-due-reminder">
          <CalendarClock size={21} />
          <div>
            <strong>Your revision exam is due</strong>
            <span>
              {exam.topics.length} revised{" "}
              {exam.topics.length === 1 ? "topic" : "topics"} · take it outside
              the app, then record the result.
            </span>
          </div>
          <Link className="btn" to="/tests">
            View exam plan <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="today-workspace">
        <aside className="today-sidebar">
          <section className="panel paste-target-card">
            <div className="card-title-icon">
              <span>
                <ClipboardPaste size={21} />
              </span>
              <div>
                <h2>Paste today’s targets</h2>
                <p>
                  All subjects in one go. You check everything before it’s
                  saved.
                </p>
              </div>
            </div>
            <label className="sr-only" htmlFor="today-paste">
              Today's target text
            </label>
            <textarea
              id="today-paste"
              rows={8}
              maxLength={20000}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={pasteExample}
            />
            <div className="paste-hints">
              <p>
                <Flag size={13} />
                Add <b>!</b> to mark a priority
              </p>
              <p>
                <Clock3 size={13} />
                Estimates like <b>45 min</b> set the time
              </p>
              <p>
                <BookOpen size={13} />
                Keep vocabulary ranges, e.g. <b>1–50</b>
              </p>
            </div>
            <button
              className="btn primary"
              onClick={() => open(<ImportForm initialText={paste} />)}
            >
              <ClipboardPaste size={15} />
              {paste.trim() ? "Read my plan" : "Paste targets"}
            </button>
            <small className="private-reading">
              <ShieldCheck size={13} />
              Read on this device · no AI or upload
            </small>
          </section>
          <section className="panel planning-explainer">
            <h3>
              <Info size={15} />
              How today was planned
            </h3>
            <div className="plan-order">
              <span>Priority</span>
              <ChevronRight size={12} />
              <span>Revisions due</span>
              <ChevronRight size={12} />
              <span>Carried</span>
              <ChevronRight size={12} />
              <span>New</span>
            </div>
            <p>
              Unfinished work stays in the next day’s plan. Nothing is marked
              complete automatically.
            </p>
            <p>Revision intervals start when you actually finish.</p>
          </section>
        </aside>
        <div className="today-main">
          <section className="panel checkin-card" aria-label="Daily check-in">
            <div className="checkin-part">
              <div className="checkin-head">
                <span className="checkin-icon">
                  <CheckCircle2 size={16} />
                </span>
                <div className="checkin-titles">
                  <h2>Study streak</h2>
                  <p>
                    {streak.count > 0
                      ? `${streak.count}-day streak`
                      : "Start your streak"}
                  </p>
                </div>
              </div>
              <div className="checkin-row">
                <label className="checkin-toggle">
                  <input
                    type="checkbox"
                    checked={studied}
                    onChange={(e) => setStudied(e.target.checked)}
                  />
                  <span>I studied today</span>
                </label>
                <button
                  className="btn primary checkin-save"
                  disabled={!studied}
                  onClick={() => {
                    update((s) => saveStreak(s, date));
                    notify("Streak saved.");
                  }}
                >
                  <Check size={14} />
                  Save streak
                </button>
              </div>
            </div>
            <div className="checkin-part">
              <div className="checkin-head">
                <span className="checkin-icon">
                  <Clock3 size={16} />
                </span>
                <div className="checkin-titles">
                  <h2>Sleep schedule</h2>
                  <p>
                    {lastNight
                      ? `Last night: ${duration(lastNight.minutes)}`
                      : "Log last night’s sleep"}
                  </p>
                </div>
                {sleepPreview && (
                  <span className="checkin-duration">
                    ≈ {duration(sleepPreview)}
                  </span>
                )}
              </div>
              <div className="checkin-row checkin-times">
                <label>
                  <span>Bedtime</span>
                  <input
                    type="time"
                    value={bedtime}
                    onChange={(e) => {
                      setBedtime(e.target.value);
                      setSleepErr("");
                    }}
                  />
                </label>
                <label>
                  <span>Wake up</span>
                  <input
                    type="time"
                    value={wake}
                    onChange={(e) => {
                      setWake(e.target.value);
                      setSleepErr("");
                    }}
                  />
                </label>
                <button
                  className="btn primary checkin-save"
                  onClick={() => {
                    const result = saveSleep(data, { date, bedtime, wake });
                    if (!result.ok) return setSleepErr(result.error);
                    update(() => result.data);
                    setSleepErr("");
                    notify("Sleep saved for this morning.");
                  }}
                >
                  Save sleep
                </button>
              </div>
              {sleepErr && (
                <small className="error" role="alert">
                  {sleepErr}
                </small>
              )}
              <div className="checkin-meta">
                {trend.window.length > 0 && (
                  <div className="sleep-history">
                    {trend.window
                      .slice(-7)
                      .reverse()
                      .map((s) => (
                        <span
                          className="sleep-chip"
                          key={s.date}
                          title={`${displayDate(s.date)} · ${s.bedtime}–${s.wake} · ${duration(s.minutes)}`}
                        >
                          {displayDate(s.date)}: {duration(s.minutes)}
                        </span>
                      ))}
                  </div>
                )}
                <p className="sleep-text">
                  {trend.nights
                    ? `7-night average: ${duration(trend.average!)} · ${trend.nights} night${trend.nights === 1 ? "" : "s"} logged.`
                    : "7-night average appears once you log a night."}
                </p>
              </div>
            </div>
          </section>
          <div className="today-budget panel">
            <div>
              <strong>{duration(plan.total)}</strong> planned of{" "}
              <strong>{duration(plan.available)}</strong> available{" "}
              <Chip tone={plan.overload ? "rose" : "green"}>
                {plan.overload
                  ? `${duration(plan.overload)} over`
                  : "Within budget"}
              </Chip>
            </div>
            <div className="budget-meter">
              <i
                style={{
                  width: `${Math.min(100, (plan.total / Math.max(1, plan.available)) * 100)}%`,
                }}
              />
            </div>
            <span>
              {completed.length} tasks done · {reviews.length} recalls / topic
              tests recorded today
            </span>
          </div>
          {!!plan.overload && (
            <div className="overload">
              <div>
                <span className="eyebrow">A GENTLER PLAN?</span>
                <h3>
                  You’re {duration(plan.overload)} over your daily budget.
                </h3>
                <p>
                  {plan.suggested
                    ? `You could move “${plan.suggested.task.title}” to make some room.`
                    : "Use the calendar button beside any item to choose what moves."}{" "}
                  Nothing moves without your say.
                </p>
              </div>
              {plan.suggested && (
                <button
                  className="btn"
                  onClick={() =>
                    open(<DeferForm task={plan.suggested!.task} />)
                  }
                >
                  Choose a day
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}
          <section className="panel plan-panel">
            <div className="panel-heading">
              <div className="tabs">
                <button
                  className={tab === "plan" ? "active" : ""}
                  onClick={() => setTab("plan")}
                >
                  Your plan <span>{plan.items.length}</span>
                </button>
                <button
                  className={tab === "done" ? "active" : ""}
                  onClick={() => setTab("done")}
                >
                  Completed <span>{completed.length + reviews.length}</span>
                </button>
              </div>
              <span className="muted small">
                {tab === "plan"
                  ? "One thing at a time."
                  : "Actual work, honestly recorded."}
              </span>
            </div>
            {tab === "plan" ? (
              plan.items.length ? (
                [0, 1, 2, 3].map((rank) => {
                  const items = plan.items.filter((a) => a.rank === rank);
                  return items.length ? (
                    <div className="plan-group" key={rank}>
                      <h3 className="group-heading">
                        {groupNames[rank]}
                        <span>{items.length}</span>
                      </h3>
                      {items.map((a) =>
                        a.kind === "task" ? (
                          <TaskRow key={a.task.id} task={a.task} />
                        ) : (
                          <RevisionRow
                            key={a.revision.id}
                            revision={a.revision}
                          />
                        ),
                      )}
                    </div>
                  ) : null;
                })
              ) : (
                <Empty
                  title="A fresh page for today"
                  action={
                    <button
                      className="btn primary"
                      onClick={() => open(<ImportForm />)}
                    >
                      Paste your first targets
                      <ArrowRight size={16} />
                    </button>
                  }
                >
                  Start small. Add a task or paste your daily targets, then
                  review before saving.
                </Empty>
              )
            ) : completed.length + reviews.length ? (
              <>
                <div>
                  {completed.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
                {reviews.map((r) => (
                  <div className="history-row" key={r.id}>
                    <CheckCircle2 size={17} />
                    <span>
                      {data.topics.find((t) => t.id === r.topicId)?.name}
                    </span>
                    <Chip>{r.rating}</Chip>
                    <span className="muted small">
                      {r.source === "test" ? "External test" : "Revision"}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <Empty title="Your wins will go here">
                Complete a task or revision when you’ve genuinely done the work.
              </Empty>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}
export function RevisionsPage() {
  const { data, date } = useApp(),
    { open } = useDialog(),
    [view, setView] = useState("due"),
    [subject, setSubject] = useState("all"),
    [selectedDay, setSelectedDay] = useState(""),
    [month, setMonth] = useState(date.slice(0, 7) + "-01"),
    [page, setPage] = useState(0),
    [compact, setCompact] = useState(
      () => window.matchMedia("(max-width: 640px)").matches,
    );
  const [calendarOpen, setCalendarOpen] = useState(!compact);
  const [guideOpen, setGuideOpen] = useState(!compact);
  useEffect(() => {
    setCalendarOpen(!compact);
    setGuideOpen(!compact);
  }, [compact]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const change = () => setCompact(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => setPage(0), [view, subject, selectedDay, compact]);
  const all = data.revisions.filter(
    (r) =>
      activeTopic(data, r.topicId) &&
      (subject === "all" || subjectFor(data, r.topicId)?.id === subject),
  );
  const due = all.filter((r) => r.due <= date),
    upcoming = all.filter((r) => r.due > date),
    schedules = (
      selectedDay
        ? all.filter((r) => r.due === selectedDay)
        : view === "due"
          ? due
          : upcoming
    ).sort((a, b) => a.due.localeCompare(b.due));
  const history = data.reviews
    .filter(
      (r) =>
        activeTopic(data, r.topicId) &&
        (subject === "all" || subjectFor(data, r.topicId)?.id === subject),
    )
    .sort((a, b) => b.day.localeCompare(a.day));
  const historyView = view === "history" && !selectedDay;
  const pageSize = compact ? 2 : 4;
  const total = historyView ? history.length : schedules.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const startIndex = currentPage * pageSize;
  const first = new Date(month + "T12:00:00Z");
  const start = addDays(month, -((first.getUTCDay() + 6) % 7));
  const shiftMonth = (offset: number) => {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + offset);
    setMonth(next.toISOString().slice(0, 10));
  };
  return (
    <Page className="revisions-page">
      <Heading
        title="Revisions"
        description="Counted from the day you actually finish. Missed reviews stay visible as one item, never a pile of duplicates."
        action={
          <Link className="btn" to="/today">
            Back to today <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="revision-summary">
        <div>
          <strong>{due.length}</strong>
          <span>due & overdue</span>
        </div>
        <div>
          <strong>{upcoming.length}</strong>
          <span>coming up</span>
        </div>
        <div>
          <strong>{history.length}</strong>
          <span>recorded recalls & tests</span>
        </div>
        <p>Recall first. Then check your notes and rate honestly.</p>
      </div>
      <div className="revisions-workspace">
        <div className="revisions-main">
          {" "}
          <section className="panel">
            <div className="panel-heading">
              <div className="tabs">
                {[
                  ["due", `Due now (${due.length})`],
                  ["upcoming", "Upcoming"],
                  ["history", "History"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={!selectedDay && view === key ? "active" : ""}
                    onClick={() => {
                      setView(key);
                      setSelectedDay("");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                aria-label="Filter revisions by subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="all">All subjects</option>
                {data.subjects
                  .filter((s) => !s.archived)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            {selectedDay && (
              <h3 className="group-heading">
                Reviews for {displayDate(selectedDay)}
              </h3>
            )}
            <div
              className={`revision-card-grid ${historyView ? "is-history" : ""}`}
            >
              {historyView ? (
                history.length ? (
                  history.slice(startIndex, startIndex + pageSize).map((r) => (
                    <div className="history-row" key={r.id}>
                      <RevisionIcon size={17} />
                      <div>
                        <strong>
                          {data.topics.find((t) => t.id === r.topicId)?.name}
                        </strong>
                        <span>
                          {displayDate(r.day)} ·{" "}
                          {r.source === "test" ? "Topic test" : "Recall"} · Step{" "}
                          {r.stepBefore} to {r.stepAfter}
                        </span>
                      </div>
                      <Chip tone={r.rating === "Forgot" ? "rose" : "green"}>
                        {r.rating}
                      </Chip>
                      {r.day === date && (
                        <button
                          className="text-link"
                          onClick={() =>
                            open(
                              <ReviewForm
                                revision={data.revisions.find(
                                  (a) => a.id === r.revisionId,
                                )!}
                              />,
                            )
                          }
                        >
                          Change rating
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty title="Your recall history starts here">
                    Rate a completed revision to see it here.
                  </Empty>
                )
              ) : schedules.length ? (
                schedules
                  .slice(startIndex, startIndex + pageSize)
                  .map((r) => (
                    <RevisionRow key={r.id} revision={r} allowEarly />
                  ))
              ) : (
                <Empty
                  title={
                    view === "due"
                      ? "A little breathing room."
                      : "Room for new learning."
                  }
                >
                  {view === "due"
                    ? "No reviews are due in this view. Complete a learning task to start its revision schedule."
                    : "Your upcoming reviews will appear here after you complete your work."}
                </Empty>
              )}
            </div>
            {total > 0 && (
              <nav className="revision-pagination" aria-label="Revision pages">
                <span role="status" aria-live="polite">
                  {startIndex + 1}–{Math.min(startIndex + pageSize, total)} of{" "}
                  {total} {historyView ? "records" : "reviews"}
                </span>
                <div>
                  <button
                    className="btn small-btn"
                    aria-label="Previous revision page"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  <span>
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <button
                    className="btn small-btn"
                    aria-label="Next revision page"
                    disabled={currentPage + 1 === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </nav>
            )}
          </section>
        </div>
        <aside className="revisions-sidebar">
          <details
            className="panel month-calendar"
            open={calendarOpen}
            onToggle={(e) => setCalendarOpen(e.currentTarget.open)}
          >
            <summary className="revision-tool-summary">
              Review calendar <ChevronRight size={16} />
            </summary>
            <div className="revision-tool-content">
              <div className="month-heading">
                <h2>
                  {displayDate(month, { month: "long", year: "numeric" })}
                </h2>
                <div>
                  <button
                    className="icon-btn"
                    aria-label="Previous month"
                    onClick={() => shiftMonth(-1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Next month"
                    onClick={() => shiftMonth(1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="month-weekdays">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className="month-grid">
                {Array.from({ length: 42 }, (_, i) => addDays(start, i)).map(
                  (day) => {
                    const count = all.filter((r) => r.due === day).length,
                      done = history.filter((r) => r.day === day).length;
                    return (
                      <button
                        key={day}
                        className={`${day.slice(0, 7) !== month.slice(0, 7) ? "outside-month" : ""} ${day === date ? "is-today" : ""} ${selectedDay === day ? "selected" : ""}`}
                        aria-label={`${displayDate(day, { day: "numeric", month: "long", year: "numeric" })}: ${count} due, ${done} recorded`}
                        aria-pressed={selectedDay === day}
                        onClick={() => {
                          setSelectedDay(selectedDay === day ? "" : day);
                          setView("upcoming");
                        }}
                      >
                        <span>{Number(day.slice(-2))}</span>
                        {count > 0 && (
                          <small className="calendar-due">{count}</small>
                        )}
                        {done > 0 && (
                          <small className="calendar-done">✓ {done}</small>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
              <div className="calendar-key">
                <span>
                  <i />
                  Due
                </span>
                <span>
                  <i />
                  Recorded
                </span>
                {selectedDay && (
                  <button
                    className="text-link"
                    onClick={() => setSelectedDay("")}
                  >
                    Clear date filter
                  </button>
                )}
              </div>
            </div>
          </details>
          <details
            className="panel schedule-explainer"
            open={guideOpen}
            onToggle={(e) => setGuideOpen(e.currentTarget.open)}
          >
            <summary className="revision-tool-summary">
              Schedule guide <ChevronRight size={16} />
            </summary>
            <div className="revision-tool-content">
              <SectionTitle
                title="How your schedule works"
                action={
                  <Link className="text-link" to="/settings">
                    Settings
                  </Link>
                }
              />
              <div className="schedule-steps">
                {data.preferences.gaps.map((gap, i) => (
                  <div key={i}>
                    <strong>{i + 1}</strong>
                    <b>+{gap}d</b>
                    <small>step {i + 1}</small>
                  </div>
                ))}
              </div>
              <p>
                Gaps start from each actual recall. Then{" "}
                {data.preferences.maintenanceDays}-day maintenance. New learning
                restarts its topic/range schedule.
              </p>
              <div className="rating-explainer">
                {[
                  ["Forgot", "Back to step 1"],
                  ["Hard", "Repeat the same step"],
                  ["Good", "Go to the next step"],
                  ["Easy", "Advance two steps"],
                ].map(([rating, text], i) => (
                  <div key={rating} className={`rating-guide-${i}`}>
                    <strong>{rating}</strong>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </aside>
      </div>
    </Page>
  );
}
