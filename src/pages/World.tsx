import { Component, lazy, Suspense, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Edit3,
  Leaf,
  Plus,
  RotateCcw,
} from "../components/icons";
import { useApp } from "../data/AppProvider";
import {
  clone,
  ensureTopic,
  latestTopicScore,
  statusLabels,
  topicStatus,
  undoTaskCompletion,
} from "../domain/engine";
import type { TaskDraft } from "../domain/engine";
import { displayDate, normalize } from "../domain/model";
import type { Topic } from "../domain/model";
import { SubjectForm, TaskForm, TaskFields } from "../components/forms";
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
import { TaskRow } from "./Planner";
import { ImmersiveWorld } from "./ImmersiveWorld";
import { FlatWorldPage } from "./FlatWorld";
class WorldBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
const WorldSceneView = lazy(() => import("../components/WorldScene"));
export function WorldPage() {
  const { data } = useApp();
  return data.preferences.worldMode === "3d" ? (
    <ImmersiveWorld />
  ) : (
    <FlatWorldPage />
  );
}
export function TopicForm({
  subjectId,
  initial,
}: {
  subjectId: string;
  initial?: Topic;
}) {
  const { data, update, notify } = useApp(),
    { close } = useDialog();
  const [name, setName] = useState(initial?.name ?? ""),
    [group, setGroup] = useState(initial?.group ?? ""),
    [error, setError] = useState("");
  const tasks = data.tasks.filter((task) => task.topicId === initial?.id);
  const [reopened, setReopened] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>(() =>
    Object.fromEntries(
      tasks.map((task) => [
        task.id,
        {
          subjectId,
          topic: initial?.name ?? "",
          title: task.title,
          minutes: task.minutes,
          priority: task.priority,
          revision: task.revision,
          range: task.range,
          notes: task.notes,
        },
      ]),
    ),
  );
  function change<K extends keyof TaskDraft>(
    id: string,
    key: K,
    value: TaskDraft[K],
  ) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  }
  return (
    <Modal
      title={initial ? "Edit topic" : "Plant a new topic"}
      wide={tasks.length > 0}
    >
      <form
        onInvalidCapture={(e) => {
          const details = (e.target as HTMLElement).closest("details");
          if (details) details.open = true;
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Give this topic a name first.");
          if (
            data.topics.some(
              (t) =>
                t.subjectId === subjectId &&
                t.id !== initial?.id &&
                normalize(t.name) === normalize(name),
            )
          )
            return setError("This subject already has a topic with that name.");
          try {
            update((s) => {
              let next = clone(s);
              for (const id of reopened) next = undoTaskCompletion(next, id);
              if (initial)
                Object.assign(next.topics.find((t) => t.id === initial.id)!, {
                  name: name.trim(),
                  group: group.trim(),
                });
              else ensureTopic(next, subjectId, name).group = group.trim();
              for (const [id, draft] of Object.entries(drafts)) {
                const task = next.tasks.find((t) => t.id === id);
                if (!task) continue;
                Object.assign(task, {
                  title: draft.title.trim(),
                  minutes: draft.minutes,
                  priority: draft.priority,
                  notes: draft.notes,
                });
                if (!task.completedOn)
                  Object.assign(task, {
                    revision: draft.revision,
                    range: draft.range.trim(),
                  });
              }
              return next;
            });
            notify(
              tasks.length ? "Topic and task details saved." : "Topic saved.",
            );
            close();
          } catch {
            setError(
              "Check each task title, time estimate, range and notes before saving.",
            );
          }
        }}
      >
        <div className="modal-body">
          <p className="topic-subject-context">
            Subject:{" "}
            <strong>
              {data.subjects.find((s) => s.id === subjectId)?.name}
            </strong>
          </p>
          <Field label="Topic name">
            <input
              autoFocus
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Percentage"
            />
          </Field>
          <Field label="Group or chapter (optional)">
            <input
              maxLength={100}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="e.g. Arithmetic"
            />
          </Field>
          {tasks.length > 0 && (
            <section className="topic-tasks-form">
              <SectionTitle title="Tasks in this topic">
                Task text, time, vocabulary range, priority, revision and
                resource notes.
              </SectionTitle>
              {tasks.map((task, index) => (
                <details
                  className="topic-task-editor"
                  key={task.id}
                  open={index === 0}
                >
                  <summary>
                    <strong>{task.title}</strong>
                    <Chip tone={task.completedOn ? "green" : ""}>
                      {reopened.includes(task.id)
                        ? "Will be unfinished"
                        : task.completedOn
                          ? "Completed"
                          : "Unfinished"}
                    </Chip>
                  </summary>
                  <div className="task-editor-fields">
                    <TaskFields
                      draft={drafts[task.id]}
                      onChange={(key, value) => change(task.id, key, value)}
                      completed={
                        !!task.completedOn && !reopened.includes(task.id)
                      }
                    />
                    {task.completedOn &&
                      (reopened.includes(task.id) ? (
                        <div className="callout soft">
                          Completion will be undone when you save. Existing
                          recall and test history will be kept.
                        </div>
                      ) : (
                        <>
                          <p className="muted small">
                            Undo completion to change its range or revision
                            setting.
                          </p>
                          <button
                            type="button"
                            className="btn small-btn"
                            onClick={() =>
                              setReopened((ids) => [...ids, task.id])
                            }
                          >
                            <RotateCcw size={14} />
                            Undo completion
                          </button>
                        </>
                      ))}
                  </div>
                </details>
              ))}
            </section>
          )}
          {initial && !tasks.length && (
            <p className="muted small">
              No tasks yet. Add a task from this subject to set its duration,
              vocabulary range, revision preference and resource notes.
            </p>
          )}
          <ErrorText message={error} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary">
            {tasks.length ? "Save topic & tasks" : "Save topic"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function SubjectPage() {
  const { id } = useParams();
  return <SubjectScreen key={id} id={id} />;
}
function SubjectScreen({ id }: { id?: string }) {
  const [params, setParams] = useSearchParams();
  const expanded = params.get("topic");
  const { data, update, notify } = useApp(),
    { open } = useDialog(),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const revealTopic = (topicId: string) => {
    setFilter("all");
    setSearch("");
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (topicId) next.set("topic", topicId);
        else next.delete("topic");
        return next;
      },
      { replace: true },
    );
    if (topicId && topicId === expanded)
      requestAnimationFrame(() => {
        const card = document.getElementById(`topic-${topicId}`);
        card
          ?.querySelector<HTMLButtonElement>(".topic-toggle")
          ?.focus({ preventScroll: true });
        card?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      });
  };
  useEffect(() => {
    if (!expanded) return;
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`topic-${expanded}`);
      card
        ?.querySelector<HTMLButtonElement>(".topic-toggle")
        ?.focus({ preventScroll: true });
      card?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded]);
  const subject = data.subjects.find((s) => s.id === id);
  if (!subject)
    return (
      <Page>
        <Empty
          title="This island isn’t here"
          action={
            <Link to="/" className="btn">
              Back to your world
            </Link>
          }
        >
          It may have been deleted. Your other subjects are safe.
        </Empty>
      </Page>
    );
  const topics = data.topics.filter((t) => t.subjectId === subject.id),
    filtered = topics.filter(
      (t) =>
        (filter === "all" || topicStatus(data, t.id) === filter) &&
        normalize(`${t.name} ${t.group}`).includes(normalize(search)),
    );
  const toggleArchive = () => {
    if (
      confirm(
        subject.archived
          ? "Restore this subject and its learning history?"
          : "Archive this subject? Its tasks and revisions will pause, and all history will be kept.",
      )
    ) {
      update((s) => ({
        ...s,
        subjects: s.subjects.map((a) =>
          a.id === id ? { ...a, archived: !a.archived } : a,
        ),
      }));
      notify(
        subject.archived
          ? "Subject restored."
          : "Subject archived. History kept.",
      );
    }
  };
  return (
    <Page
      className={`subject-page ${data.preferences.worldMode === "2d" || subject.archived ? "is-2d" : ""}`}
    >
      <Link
        className="back-link"
        to={`/?island=${encodeURIComponent(subject.id)}`}
      >
        <ArrowLeft size={15} />
        Your world
      </Link>
      <Heading
        eyebrow="YOUR SUBJECT ISLAND"
        title={subject.name}
        description="Your topics, your work, your growing understanding."
        action={
          <>
            <button
              className="btn"
              onClick={() => open(<SubjectForm initial={subject} />)}
            >
              <Edit3 size={15} />
              Edit subject
            </button>
            <button
              className="btn primary"
              disabled={subject.archived}
              onClick={() => open(<TaskForm subjectId={subject.id} />)}
            >
              <Plus size={16} />
              Add task
            </button>
          </>
        }
      />
      {subject.archived && (
        <div className="callout amber spaced">
          This subject is archived. Your history is safe; restore it to resume
          learning.
          <button className="text-link" onClick={toggleArchive}>
            Restore subject
          </button>
        </div>
      )}
      <div className="subject-split">
        <div className="subject-visual-column">
          <div
            className="subject-banner"
            style={{ "--subject-color": subject.color } as React.CSSProperties}
          >
            <SubjectIcon subject={subject} size={35} />
            <div>
              <strong>{topics.length} topics to grow into.</strong>
              <p>
                Complete work, recall it, and check your understanding with
                external tests.
              </p>
            </div>
            <BookOpen size={58} strokeWidth={1} />
          </div>
          {!subject.archived && data.preferences.worldMode === "3d" && (
            <div className="subject-world">
              <div className="subject-world-caption">
                <span className="eyebrow">YOUR TOPIC GARDEN</span>
                <h2>See what’s taking root.</h2>
                <p>
                  {topics.length
                    ? "Select a plot to open its tasks below. Every colour follows your actual learning evidence."
                    : "Your first topic plot will appear when you add a topic. No pretend progress."}
                </p>
                <div className="garden-status-key">
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <span key={key}>
                      <i className={`garden-dot plot-${key}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <WorldBoundary
                fallback={
                  <div className="subject-garden-fallback">
                    <p>
                      The 3D garden could not load. Every topic is available in
                      the list below.
                    </p>
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <div className="subject-garden-fallback">
                      Preparing your garden…
                    </div>
                  }
                >
                  <WorldSceneView
                    subjects={[subject]}
                    selectedId={subject.id}
                    mode="subject"
                    immersive
                    activeTopicId={expanded}
                    onTopicSelect={revealTopic}
                    onFallback={() =>
                      update((s) => ({
                        ...s,
                        preferences: { ...s.preferences, worldMode: "2d" },
                      }))
                    }
                  />
                </Suspense>
              </WorldBoundary>
            </div>
          )}
        </div>
        <section className="subject-topic-column">
          <div className="subject-evidence-overview">
            {[
              ["Topics", topics.length],
              [
                "In revision",
                topics.filter((t) => topicStatus(data, t.id) === "in_revision")
                  .length,
              ],
              [
                "Ready for test",
                topics.filter(
                  (t) => topicStatus(data, t.id) === "ready_for_test",
                ).length,
              ],
              [
                "Needs attention",
                topics.filter((t) => topicStatus(data, t.id) === "weak").length,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <SectionTitle
            title="Your topics"
            action={
              <button
                className="btn"
                disabled={subject.archived}
                onClick={() => open(<TopicForm subjectId={subject.id} />)}
              >
                <Plus size={15} />
                New topic
              </button>
            }
          />
          <div className="topic-search">
            <label htmlFor="topic-search" className="sr-only">
              Search topics or chapters
            </label>
            <input
              id="topic-search"
              type="search"
              value={search}
              placeholder="Find a topic or chapter…"
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>
              {filtered.length} of {topics.length} topics
            </span>
          </div>
          <div
            className="topic-filters"
            role="group"
            aria-label="Topic status filters"
          >
            <button
              className={filter === "all" ? "active" : ""}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All topics
            </button>
            {Object.entries(statusLabels).map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {filtered.length ? (
            <div className="topic-list">
              {filtered.map((topic) => {
                const status = topicStatus(data, topic.id),
                  tasks = data.tasks.filter((t) => t.topicId === topic.id),
                  revisions = data.revisions.filter(
                    (r) => r.topicId === topic.id,
                  ),
                  score = latestTopicScore(data, topic.id);
                return (
                  <section
                    className={`panel topic-card status-${status} ${expanded === topic.id ? "active-topic" : ""}`}
                    id={`topic-${topic.id}`}
                    key={topic.id}
                  >
                    <div className="topic-header">
                      <button
                        className="topic-toggle"
                        aria-expanded={expanded === topic.id}
                        onClick={() =>
                          setParams(
                            (previous) => {
                              const next = new URLSearchParams(previous);
                              if (expanded === topic.id) next.delete("topic");
                              else next.set("topic", topic.id);
                              return next;
                            },
                            { replace: true },
                          )
                        }
                      >
                        <span className="topic-seed">
                          <Leaf size={21} />
                        </span>
                        <span>
                          {topic.group && <small>{topic.group}</small>}
                          <strong>{topic.name}</strong>
                          <span>
                            {tasks.filter((t) => t.completedOn).length} /{" "}
                            {tasks.length} tasks completed
                            {score
                              ? ` · Latest topic score ${Math.round(score.percent)}%`
                              : ""}
                          </span>
                        </span>
                      </button>
                      <Chip
                        tone={
                          status === "weak"
                            ? "rose"
                            : status === "strong"
                              ? "green"
                              : status === "ready_for_test"
                                ? "amber"
                                : status === "in_revision"
                                  ? "purple"
                                  : ""
                        }
                      >
                        {statusLabels[status]}
                      </Chip>
                      <button
                        className="icon-btn"
                        aria-label={`Edit topic: ${topic.name}`}
                        onClick={() =>
                          open(
                            <TopicForm
                              subjectId={subject.id}
                              initial={topic}
                            />,
                          )
                        }
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Add task to ${topic.name}`}
                        disabled={subject.archived}
                        onClick={() =>
                          open(
                            <TaskForm
                              subjectId={subject.id}
                              topic={topic.name}
                            />,
                          )
                        }
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    {expanded === topic.id && (
                      <div className="topic-details">
                        {revisions.length > 0 && (
                          <div className="topic-schedules">
                            {revisions.map((r) => (
                              <Link to="/revisions" key={r.id}>
                                <RotateCcw size={14} />
                                Next: {displayDate(r.due)}
                                {r.range ? ` · Words ${r.range}` : ""} · Step{" "}
                                {r.step}
                                <ChevronRight size={13} />
                              </Link>
                            ))}
                          </div>
                        )}
                        {tasks.length ? (
                          tasks.map((t) => (
                            <TaskRow task={t} key={t.id} compact />
                          ))
                        ) : (
                          <div className="topic-no-tasks">
                            <p className="muted">
                              This topic is ready for its first small step.
                            </p>
                            <button
                              className="text-link"
                              disabled={subject.archived}
                              onClick={() =>
                                open(
                                  <TaskForm
                                    subjectId={subject.id}
                                    topic={topic.name}
                                  />,
                                )
                              }
                            >
                              Add a learning task
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <Empty
              title={
                topics.length
                  ? "No topics in this view"
                  : "A little room for curiosity"
              }
              action={
                !topics.length && (
                  <button
                    className="btn primary"
                    disabled={subject.archived}
                    onClick={() => open(<TopicForm subjectId={subject.id} />)}
                  >
                    Add your first topic
                  </button>
                )
              }
            >
              {topics.length
                ? "Try another search or status filter to see your topics."
                : "Add topics as you need them, or create them automatically when adding tasks."}
            </Empty>
          )}
          <div className="subject-footer">
            <Link to="/settings" className="text-link">
              Manage all subjects
              <ArrowRight size={14} />
            </Link>
            <button className="text-link muted" onClick={toggleArchive}>
              {subject.archived ? "Restore subject" : "Archive this subject"}
            </button>
          </div>
        </section>
      </div>
    </Page>
  );
}
